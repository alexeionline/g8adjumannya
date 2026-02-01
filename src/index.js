require('dotenv').config();

const crypto = require('crypto');
const { Telegraf, session } = require('telegraf');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const {
  addCount,
  createApiToken,
  getApiTokenByChat,
  getRecordsByChat,
  getStatusByDate,
  initDb,
  updateRecord,
  upsertUser,
} = require('./db');
const { createAddHandler } = require('./handlers/add');
const { createApiTokenHandler } = require('./handlers/apiToken');
const { createRecordHandler } = require('./handlers/record');
const { createForceHandler } = require('./handlers/force');
const { createStatusHandler } = require('./handlers/status');
const { createDeletionHelpers } = require('./utils/deletionQueue');
const {
  formatAddHeader,
  formatDisplayName,
  formatIndexEmoji,
  formatProgressBar,
} = require('./utils/format');
const { createParsers } = require('./utils/parse');
const { COMMANDS_TEXT, ERRORS, FORCE_MESSAGES } = require('./constants/text');

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
    { command: 'force', description: 'Замотивировать участника' },
    { command: 'record', description: 'Показать рекорды чата' },
    { command: 'web', description: 'Открыть веб‑приложение' },
    { command: 'status', description: 'Показать статус за дату' },
  ])
  .catch((error) => {
    console.error('Failed to set bot commands:', error);
  });

const { sendEphemeral, scheduleDeleteMessage } = createDeletionHelpers(bot, 30_000);
const { parseAdd, parseRecord, parseStatusDate } = createParsers(dayjs, ERRORS);
const handleAdd = createAddHandler({
  dayjs,
  upsertUser,
  addCount,
  updateRecord,
  formatDisplayName,
  formatAddHeader,
  sendEphemeral,
});
const handleRecord = createRecordHandler({
  dayjs,
  getRecordsByChat,
  formatDisplayName,
  formatIndexEmoji,
  sendEphemeral,
  errors: ERRORS,
});
const handleStatus = createStatusHandler({
  dayjs,
  getStatusByDate,
  formatDisplayName,
  formatProgressBar,
  formatIndexEmoji,
  sendEphemeral,
  errors: ERRORS,
});
const handleForce = createForceHandler({
  forceMessages: FORCE_MESSAGES,
  errors: ERRORS,
  sendEphemeral,
});
const handleApiToken = createApiTokenHandler({
  createApiToken,
  getApiTokenByChat,
  sendEphemeral,
});

bot.start((ctx) => {
  sendEphemeral(ctx, COMMANDS_TEXT);
  handleApiToken(ctx);
});

bot.use((ctx, next) => {
  const text = ctx.message && ctx.message.text;
  if (text && text.trim().startsWith('/')) {
    scheduleDeleteMessage(ctx);
  }

  return next();
});

bot.command('add', async (ctx) => {
  const value = parseAdd(ctx.message && ctx.message.text);
  if (Number.isFinite(value)) {
    return handleAdd(ctx, value);
  }

  await sendEphemeral(ctx, 'Сколько отжиманий добавить?', {
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
    return sendEphemeral(ctx, ERRORS.WAITING_NONE);
  }

  ctx.session.waitingForAdd = false;
  delete ctx.session.waitingForAddUntil;

  return sendEphemeral(ctx, ERRORS.WAITING_CANCELLED);
});

bot.command('status', async (ctx) => {
  const parsed = parseStatusDate(ctx.message && ctx.message.text);
  if (!parsed) {
    return sendEphemeral(ctx, ERRORS.STATUS_FORMAT);
  }

  return handleStatus(ctx, parsed);
});

bot.command('record', async (ctx) => {
  return handleRecord(ctx);
});

bot.command('force', async (ctx) => {
  return handleForce(ctx);
});

bot.command('web', async (ctx) => {
  const url = process.env.WEB_APP_URL;
  if (!url) {
    return sendEphemeral(ctx, ERRORS.WEB_MISSING);
  }

  let token = await getApiTokenByChat(ctx.chat.id);
  if (!token) {
    token = crypto.randomBytes(24).toString('hex');
    await createApiToken(ctx.chat.id, token);
  }

  const webUrl = new URL(url);
  webUrl.searchParams.set('token', token);
  webUrl.searchParams.set('api_base', webUrl.origin);
  if (ctx.from && ctx.from.id) {
    webUrl.searchParams.set('user_id', String(ctx.from.id));
  }

  const isPrivate = ctx.chat && ctx.chat.type === 'private';
  const button = { text: 'Open Web App', web_app: { url: webUrl.toString() } };

  if (!isPrivate) {
    try {
      await ctx.telegram.sendMessage(ctx.from.id, 'Открыть веб‑приложение:', {
        reply_markup: {
          inline_keyboard: [[button]],
        },
      });
      const botUsername = ctx.botInfo && ctx.botInfo.username ? ctx.botInfo.username : '';
      const dmLink = botUsername ? `https://t.me/${botUsername}` : '';
      const text = dmLink
        ? `Добавил кнопку в личку: ${dmLink}`
        : 'Добавил кнопку в личку.';
      return sendEphemeral(ctx, text, undefined, 10_000);
    } catch (error) {
      return sendEphemeral(ctx, 'Не могу написать в личку. Открой диалог с ботом и отправь /start.');
    }
  }

  return sendEphemeral(ctx, 'Открыть веб‑приложение:', {
    reply_markup: {
      inline_keyboard: [[button]],
    },
  });
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

      return sendEphemeral(ctx, ERRORS.WAITING_EXPIRED);
    }

    const value = Number.parseInt(text, 10);
    if (!Number.isFinite(value)) {
      return sendEphemeral(ctx, ERRORS.ENTER_NUMBER);
    }

    if (value < 0) {
      return sendEphemeral(ctx, ERRORS.NON_NEGATIVE);
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

async function startBot(options = {}) {
  const { skipInitDb = false } = options;
  if (!skipInitDb) {
    await initDb();
  }
  await bot.launch();
}

if (require.main === module) {
  startBot().catch((error) => {
    console.error('Не удалось запустить бота:', error);
    process.exit(1);
  });
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

module.exports = { startBot };
