require('dotenv').config();

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Telegraf, session } = require('telegraf');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const {
  addCount,
  addSharedChat,
  createApiToken,
  getApiTokenByChat,
  getRecordsByChatV2,
  getSharedUserIdsByChat,
  getStatusByDateV2,
  getTotalForUserDateV2,
  hasUserReached100,
  initDb,
  removeSharedChat,
  upsertUser,
} = require('./db');
const { createAddHandler } = require('./handlers/add');
const { createRecordHandler } = require('./handlers/record');
const { createForceHandler } = require('./handlers/force');
const { createShareHandler } = require('./handlers/share');
const { createHideHandler } = require('./handlers/hide');
const { createStatusHandler } = require('./handlers/status');
const { createDeletionHelpers } = require('./utils/deletionQueue');
const {
  createCommandCleanupMiddleware,
  dispatchPlainText,
  registerCommandHandler,
} = require('./bot/dispatcher');
const {
  formatAddHeader,
  formatDisplayName,
  formatIndexEmoji,
  formatProgressBar,
} = require('./utils/format');
const { createParsers } = require('./utils/parse');
const { COMMANDS_TEXT, ERRORS, FORCE_MESSAGES, FIRST_100_MESSAGE, HELP_TEXT } = require('./constants/text');

dayjs.extend(customParseFormat);
const JWT_SECRET = process.env.JWT_SECRET || process.env.BOT_TOKEN || 'fallback-change-me';

const token = process.env.BOT_TOKEN;
if (!token) {
  throw new Error('BOT_TOKEN is required');
}

const bot = new Telegraf(token);

bot.use(session());

bot.telegram
  .setMyCommands([
    { command: 'add', description: 'Добавить отжимания за сегодня' },
    { command: 'status', description: 'Показать статус за дату' },
    { command: 'record', description: 'Показать рекорды чата' },
    { command: 'share', description: 'Связать результаты между чатами' },
    { command: 'hide', description: 'Скрыть результаты в этом чате' },
    { command: 'web', description: 'Открыть веб‑приложение' },
    { command: 'force', description: 'Замотивировать участника' },
    { command: 'help', description: 'Справка по боту' },
  ])
  .catch((error) => {
    console.error('Failed to set bot commands:', error);
  });

const { sendEphemeral, scheduleDeleteMessage } = createDeletionHelpers(bot, 30_000);
const TEN_MINUTES_MS = 10 * 60 * 1000;
const TEN_SECONDS_MS = 10 * 1000;
const sendAddReply = (ctx, text, extra) => sendEphemeral(ctx, text, extra, TEN_MINUTES_MS);
const sendStatusReply = (ctx, text, extra) => sendEphemeral(ctx, text, extra, TEN_MINUTES_MS);
const sendRecordReply = (ctx, text, extra) => sendEphemeral(ctx, text, extra, TEN_MINUTES_MS);
const { parseAdd, parseAddNumbers, parseRecord, parseStatusDate } = createParsers(dayjs, ERRORS);
const handleAdd = createAddHandler({
  dayjs,
  upsertUser,
  addSharedChat,
  addCount,
  getTotalForUserDateV2,
  hasUserReached100,
  formatDisplayName,
  formatAddHeader,
  sendEphemeral: sendAddReply,
  first100Message: FIRST_100_MESSAGE,
});
const handleRecord = createRecordHandler({
  dayjs,
  getSharedUserIdsByChat,
  getRecordsByChatV2,
  formatDisplayName,
  formatIndexEmoji,
  sendEphemeral: sendRecordReply,
  errors: ERRORS,
});
const handleStatus = createStatusHandler({
  dayjs,
  getSharedUserIdsByChat,
  getStatusByDateV2,
  formatDisplayName,
  formatProgressBar,
  formatIndexEmoji,
  sendEphemeral: sendStatusReply,
  errors: ERRORS,
});
const handleForce = createForceHandler({
  forceMessages: FORCE_MESSAGES,
  errors: ERRORS,
  sendEphemeral,
});
const handleShare = createShareHandler({
  upsertUser,
  addSharedChat,
  sendEphemeral,
});
const handleHide = createHideHandler({
  removeSharedChat,
  sendEphemeral,
});

bot.start((ctx) => {
  if (!(ctx.message?.text || '').trim().startsWith('/start')) return;
  return sendEphemeral(ctx, COMMANDS_TEXT);
});

bot.use(
  createCommandCleanupMiddleware({
    scheduleDeleteMessage,
    shortTtlMs: TEN_SECONDS_MS,
  })
);

registerCommandHandler(bot, 'add', async (ctx) => {
  const parsed = parseAdd(ctx.message && ctx.message.text);
  if (parsed) {
    return handleAdd(ctx, parsed);
  }

  await sendAddReply(ctx, 'Сколько отжиманий добавить?', {
    reply_markup: { force_reply: true, selective: true },
  });
  ctx.session = {
    ...ctx.session,
    waitingForAdd: true,
    waitingForAddUntil: Date.now() + 15_000,
  };
});

registerCommandHandler(bot, 'cancel', async (ctx) => {
  if (!ctx.session || !ctx.session.waitingForAdd) {
    return sendEphemeral(ctx, ERRORS.WAITING_NONE);
  }

  ctx.session.waitingForAdd = false;
  delete ctx.session.waitingForAddUntil;

  return sendEphemeral(ctx, ERRORS.WAITING_CANCELLED);
});

registerCommandHandler(bot, 'status', async (ctx) => {
  const parsed = parseStatusDate(ctx.message && ctx.message.text);
  if (!parsed) {
    return sendEphemeral(ctx, ERRORS.STATUS_FORMAT);
  }

  return handleStatus(ctx, parsed);
});

registerCommandHandler(bot, 'record', async (ctx) => handleRecord(ctx));

registerCommandHandler(bot, 'force', async (ctx) => handleForce(ctx));

registerCommandHandler(bot, 'share', async (ctx) => handleShare(ctx));

registerCommandHandler(bot, 'hide', async (ctx) => handleHide(ctx));

registerCommandHandler(bot, 'help', async (ctx) => sendEphemeral(ctx, HELP_TEXT));

registerCommandHandler(bot, 'web', async (ctx) => {
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
  webUrl.searchParams.set('chat_id', String(ctx.chat.id));
  if (ctx.from && ctx.from.id) {
    webUrl.searchParams.set('user_id', String(ctx.from.id));
    const v2Token = jwt.sign({ user_id: ctx.from.id }, JWT_SECRET, { expiresIn: '30d' });
    webUrl.searchParams.set('v2_token', v2Token);
    webUrl.searchParams.set('api_base_v2', `${webUrl.origin}/api/v2`);
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
  return dispatchPlainText(ctx, {
    parseAdd,
    parseAddNumbers,
    parseRecord,
    parseStatusDate,
    handleAdd,
    handleRecord,
    handleStatus,
    sendEphemeral,
    errors: ERRORS,
  });
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
