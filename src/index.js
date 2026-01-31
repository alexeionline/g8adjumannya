require('dotenv').config();

const { Telegraf, session } = require('telegraf');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const { addCount, getRecordsByChat, getStatusByDate, initDb, updateRecord, upsertUser } = require('./db');
const { createAddHandler } = require('./handlers/add');
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

bot.start((ctx) => {
  sendEphemeral(ctx, COMMANDS_TEXT);
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
