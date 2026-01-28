require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const {
  addCount,
  getChatRecord,
  getRecordsByChat,
  getStatusByDate,
  initDb,
  updateRecord,
  upsertUser,
} = require('./db');

dayjs.extend(customParseFormat);

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(token);

bot.use(session());

bot.telegram
  .setMyCommands([
    { command: 'add', description: 'Добавить отжимания за сегодня' },
    { command: 'record', description: 'Показать рекорды чата' },
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

const INDEX_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
const ADD_PHRASES = [
  'Ты крут, username!',
  'Ты машина, username!',
  'Еба ты лютый, username!',
  'Все это видят?',
  'Дядя, тебя не остановить!',
  'Красавчик, username!',
  'Жёстко идёшь, username!',
  'Уровень зверя, username!',
  'Это мощь, username!',
  'Так держать, username!',
  'Стальной режим, username!',
  'Пушка, username!',
  'Энергия топ, username!',
  'Вот это темп, username!',
  'Продолжай в том же духе, username!',
];

function formatIndexEmoji(index) {
  return INDEX_EMOJIS[index] || `${index + 1}.`;
}

function formatProgressBar(count) {
  const totalBlocks = 5;
  const completedBlocks = Math.min(totalBlocks, Math.floor(count / 20));
  const remainingBlocks = totalBlocks - completedBlocks;
  return `${'🟢'.repeat(completedBlocks)}${'⚪'.repeat(remainingBlocks)}`;
}

function formatAddHeader(name) {
  const phrase = ADD_PHRASES[Math.floor(Math.random() * ADD_PHRASES.length)];
  return phrase.replace('username', name);
}

function escapeHtml(text) {
  return text.replace(/[&<>]/g, (ch) => {
    if (ch === '&') return '&amp;';
    if (ch === '<') return '&lt;';
    return '&gt;';
  });
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

function parseRecord(text) {
  if (!text) {
    return false;
  }

  const normalized = stripLeadingMention(text);
  return /\/?record(?:@\w+)?\s*$/i.test(normalized);
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
  await updateRecord({
    chatId: ctx.chat.id,
    userId: ctx.from.id,
    count: value,
    date: today,
  });

  const name = ctx.from && ctx.from.username ? `@${ctx.from.username}` : formatDisplayName(ctx.from);
  const header = formatAddHeader(name);
  const message = `${header} +${value} / Всего: ${total}`;

  return ctx.reply(message);
}

async function handleRecord(ctx) {
  const records = await getRecordsByChat(ctx.chat.id);
  if (!records.length) {
    return ctx.reply('Рекордов пока нет.');
  }

  const chatRecord = await getChatRecord(ctx.chat.id);
  const chatTop =
    chatRecord.length > 0
      ? `🏆 ${chatRecord[0].max_add} отжиманий — ${chatRecord
          .map((row) => formatDisplayName(row))
          .join(', ')} (${dayjs(chatRecord[0].record_date).format('DD.MM.YYYY')})`
      : 'Рекорд чата пока не установлен.';

  const lines = records.map((row, index) => {
    const name = formatDisplayName(row);
    const date = dayjs(row.record_date).format('DD.MM.YYYY');
    const medalOrIndex =
      index === 0
        ? '🥇'
        : index === 1
          ? '🥈'
          : index === 2
            ? '🥉'
            : formatIndexEmoji(index);
    return `${medalOrIndex} [${row.max_add}] ${name} (${date})`;
  });

  const message = ['Рекорды чата', `Общий рекорд: ${chatTop}`, '', ...lines].join('\n');
  return ctx.reply(message);
}

async function handleStatus(ctx, parsed) {
  if (parsed.error) {
    return ctx.reply(parsed.error);
  }

  const rows = await getStatusByDate(ctx.chat.id, parsed.date);
  if (!rows.length) {
    return ctx.reply(`Результатов за ${parsed.label} нет.`);
  }

  const isToday = parsed.date === dayjs().format('YYYY-MM-DD');
  const header = isToday ? 'Текущий статус' : `Статус на ${parsed.label}`;
  const lines = rows.map((row, index) => {
    const name = formatDisplayName(row);
    const progressBar = formatProgressBar(row.count);
    const indexEmoji = formatIndexEmoji(index);
    return `${indexEmoji} ${progressBar} ${row.count} ${name}`;
  });

  const message = [header, ...lines].join('\n');
  return ctx.reply(message);
}

bot.command('add', async (ctx) => {
  const value = parseAdd(ctx.message && ctx.message.text);
  if (Number.isFinite(value)) {
    return handleAdd(ctx, value);
  }

  await ctx.reply('Сколько отжиманий добавить?', {
    reply_markup: { force_reply: true, selective: true },
  });
  ctx.session = {
    ...ctx.session,
    waitingForAdd: true,
    waitingForAddUntil: Date.now() + 15_000,
  };
});

bot.command('cancel', async (ctx) => {
  if (!ctx.session || !ctx.session.waitingForAdd) {
    return ctx.reply('Сейчас нет активного ожидания.');
  }

  ctx.session.waitingForAdd = false;
  delete ctx.session.waitingForAddUntil;

  return ctx.reply('Ожидание отменено.');
});

bot.command('status', async (ctx) => {
  const parsed = parseStatusDate(ctx.message && ctx.message.text);
  if (!parsed) {
    return ctx.reply('Формат: status или status DD.MM.YYYY.');
  }

  return handleStatus(ctx, parsed);
});

bot.command('record', async (ctx) => {
  return handleRecord(ctx);
});

bot.on('text', async (ctx) => {
  const text = ctx.message && ctx.message.text;
  if (!text || text.trim().startsWith('/')) {
    return;
  }

  const reply = ctx.message && ctx.message.reply_to_message;
  const isReplyToAddPrompt =
    reply &&
    reply.from &&
    ctx.botInfo &&
    reply.from.id === ctx.botInfo.id &&
    typeof reply.text === 'string' &&
    reply.text.startsWith('Сколько отжиманий добавить');

  if ((ctx.session && ctx.session.waitingForAdd) || isReplyToAddPrompt) {
    if (ctx.session.waitingForAddUntil && Date.now() > ctx.session.waitingForAddUntil) {
      ctx.session.waitingForAdd = false;
      delete ctx.session.waitingForAddUntil;

      return ctx.reply('Время ожидания истекло. Введи /add, чтобы начать заново.');
    }

    const value = Number.parseInt(text, 10);
    if (!Number.isFinite(value)) {
      return ctx.reply('Введи число.');
    }

    if (value < 0) {
      return ctx.reply('Число должно быть нулевым или положительным.');
    }

    ctx.session.waitingForAdd = false;
    delete ctx.session.waitingForAddUntil;
    return handleAdd(ctx, value);
  }

  if (parseRecord(text)) {
    return handleRecord(ctx);
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
