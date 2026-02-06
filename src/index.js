require('dotenv').config();

const crypto = require('crypto');
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
  getTotalCountForUserDate,
  hasUserReached100,
  initDb,
  removeSharedChat,
  setCountForUserDate,
  syncUserRecord,
  updateRecord,
  upsertUser,
} = require('./db');
const { createAddHandler } = require('./handlers/add');
const { createApiTokenHandler } = require('./handlers/apiToken');
const { createRecordHandler } = require('./handlers/record');
const { createForceHandler } = require('./handlers/force');
const { createShareHandler } = require('./handlers/share');
const { createHideHandler } = require('./handlers/hide');
const { createStatusHandler } = require('./handlers/status');
const { createDeletionHelpers } = require('./utils/deletionQueue');
const {
  formatAddHeader,
  formatDisplayName,
  formatIndexEmoji,
  formatProgressBar,
} = require('./utils/format');
const { createParsers } = require('./utils/parse');
const { COMMANDS_TEXT, ERRORS, FORCE_MESSAGES, FIRST_100_MESSAGE, HELP_TEXT } = require('./constants/text');

dayjs.extend(customParseFormat);

/** Команда выполняется только если она первое слово в сообщении (чтобы не срабатывало на "отправь /add 10"). */
function isCommandFirstInMessage(text, commandName) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  const re = new RegExp(`^/${commandName}(@\\w+)?(\\s|$)`);
  return re.test(t);
}

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
  getTotalCountForUserDate,
  updateRecord,
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
const handleApiToken = createApiTokenHandler({
  createApiToken,
  getApiTokenByChat,
  sendEphemeral,
});

bot.start((ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'start')) return;
  sendEphemeral(ctx, COMMANDS_TEXT);
  handleApiToken(ctx);
});

bot.use((ctx, next) => {
  const text = ctx.message && ctx.message.text;
  if (text && text.trim().startsWith('/')) {
    const command = text.trim().split(/\s+/)[0].slice(1);
    const commandName = command.split('@')[0].toLowerCase();
    if (commandName === 'status' || commandName === 'record') {
      scheduleDeleteMessage(ctx, TEN_SECONDS_MS);
    } else if (commandName !== 'add') {
      scheduleDeleteMessage(ctx);
    }
  }

  return next();
});

bot.command('add', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'add')) return;
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

bot.command('cancel', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'cancel')) return;
  if (!ctx.session || !ctx.session.waitingForAdd) {
    return sendEphemeral(ctx, ERRORS.WAITING_NONE);
  }

  ctx.session.waitingForAdd = false;
  delete ctx.session.waitingForAddUntil;

  return sendEphemeral(ctx, ERRORS.WAITING_CANCELLED);
});

bot.command('status', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'status')) return;
  const parsed = parseStatusDate(ctx.message && ctx.message.text);
  if (!parsed) {
    return sendEphemeral(ctx, ERRORS.STATUS_FORMAT);
  }

  return handleStatus(ctx, parsed);
});

bot.command('record', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'record')) return;
  return handleRecord(ctx);
});

bot.command('force', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'force')) return;
  return handleForce(ctx);
});

bot.command('share', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'share')) return;
  return handleShare(ctx);
});

bot.command('hide', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'hide')) return;
  return handleHide(ctx);
});

bot.command('help', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'help')) return;
  return sendEphemeral(ctx, HELP_TEXT);
});

bot.command('web', async (ctx) => {
  if (!isCommandFirstInMessage(ctx.message?.text, 'web')) return;
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

    const parsed = parseAddNumbers(text);
    if (!parsed) {
      return sendEphemeral(ctx, ERRORS.ENTER_NUMBER);
    }

    ctx.session.waitingForAdd = false;
    delete ctx.session.waitingForAddUntil;
    return handleAdd(ctx, parsed);
  }

  if (parseRecord(text)) {
    return handleRecord(ctx);
  }

  const addParsed = parseAdd(text);
  if (addParsed) {
    return handleAdd(ctx, addParsed);
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
