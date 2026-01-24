require('dotenv').config();

const { Telegraf } = require('telegraf');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { addCount, getStatusByDate, initDb, upsertUser } = require('./db');

dayjs.extend(customParseFormat);

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(token);

bot.telegram
  .setMyCommands([
    { command: 'add', description: 'Добавить отжимания за сегодня' },
    { command: 'status', description: 'Показать статус за дату' },
  ])
  .catch((error) => {
    console.error('Failed to set bot commands:', error);
  });

function formatDisplayName(row) {
  if (row.username) {
    return `@${row.username}`;
  }

  const parts = [row.first_name, row.last_name].filter(Boolean);
  if (parts.length) {
    return parts.join(' ');
  }

  return `User ${row.user_id}`;
}

function stripLeadingMention(text) {
  if (!text) {
    return text;
  }

  const trimmed = text.trim();
  const match = trimmed.match(/^@\w+\s+/);
  if (!match) {
    return trimmed;
  }

  return trimmed.slice(match[0].length);
}

function parseAdd(text) {
  if (!text) {
    return null;
  }

  const normalized = stripLeadingMention(text);
  const match = normalized.match(/\/?add(?:@\w+)?\s+(\d+)/i);
  if (!match) {
    return null;
  }

  const value = Number.parseInt(match[1], 10);
  if (!Number.isFinite(value) || value < 0) {
    return null;
  }

  return value;
}

function parseStatusDate(text) {
  if (!text) {
    return null;
  }

  const normalized = stripLeadingMention(text);
  const match = normalized.match(/\/?status(?:@\w+)?(?:\s+(\d{2}\.\d{2}\.\d{4}))?/i);
  if (!match) {
    return null;
  }

  if (!match[1]) {
    return { date: dayjs().format('YYYY-MM-DD'), label: dayjs().format('DD.MM.YYYY') };
  }

  const parsed = dayjs(match[1], 'DD.MM.YYYY', true);
  if (!parsed.isValid()) {
    return { error: 'Неверный формат даты. Пример: status 24.01.2026' };
  }

  return { date: parsed.format('YYYY-MM-DD'), label: match[1] };
}

bot.start((ctx) => {
  ctx.reply(
    [
      'Привет! Я бот для челленджа 100 отжиманий.',
      'Команды:',
      'add X — добавить отжимания за сегодня',
      'status — статус за сегодня',
      'status DD.MM.YYYY — статус за дату',
    ].join('\n')
  );
});

async function handleAdd(ctx, value) {
  await upsertUser(ctx.from);

  const today = dayjs().format('YYYY-MM-DD');
  const total = await addCount({
    chatId: ctx.chat.id,
    userId: ctx.from.id,
    date: today,
    delta: value,
  });

  if (value === 0) {
    return ctx.reply('Отметил участие. Ты на правильном пути, но надо лучше стараться!');
  }

  if (total >= 100) {
    return ctx.reply(`Поздравляю! Сегодняшний челлендж закрыт. Итого: ${total}.`);
  }

  return ctx.reply(`Добавил ${value}. Текущий результат: ${total}/100.`);
}

async function handleStatus(ctx, parsed) {
  if (parsed.error) {
    return ctx.reply(parsed.error);
  }

  const rows = await getStatusByDate(ctx.chat.id, parsed.date);
  if (!rows.length) {
    return ctx.reply(`Результатов за ${parsed.label} нет.`);
  }

  const lines = rows.map((row, index) => {
    const name = formatDisplayName(row);
    const done = row.count >= 100 ? '✅' : '…';
    return `${index + 1}. ${name} — ${row.count}/100 ${done}`;
  });

  return ctx.reply([`Статус на ${parsed.label}`, '', ...lines].join('\n'));
}

bot.command('add', async (ctx) => {
  const value = parseAdd(ctx.message && ctx.message.text);
  if (!value) {
    return ctx.reply('Формат: add X (X — положительное число).');
  }

  return handleAdd(ctx, value);
});

bot.command('status', async (ctx) => {
  const parsed = parseStatusDate(ctx.message && ctx.message.text);
  if (!parsed) {
    return ctx.reply('Формат: status или status DD.MM.YYYY.');
  }

  return handleStatus(ctx, parsed);
});

bot.on('text', async (ctx) => {
  const text = ctx.message && ctx.message.text;
  if (!text || text.trim().startsWith('/')) {
    return;
  }

  const value = parseAdd(text);
  if (value) {
    return handleAdd(ctx, value);
  }

  const parsed = parseStatusDate(text);
  if (parsed) {
    return handleStatus(ctx, parsed);
  }
});

async function start() {
  await initDb();
  await bot.launch();
}

start().catch((error) => {
  console.error('Не удалось запустить бота:', error);
  process.exit(1);
});

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
