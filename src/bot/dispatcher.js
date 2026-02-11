function isCommandFirstInMessage(text, commandName) {
  if (!text || typeof text !== 'string') return false;
  const t = text.trim();
  const re = new RegExp(`^/${commandName}(@\\w+)?(\\s|$)`);
  return re.test(t);
}

function registerCommandHandler(bot, commandName, handler) {
  bot.command(commandName, async (ctx) => {
    if (!isCommandFirstInMessage(ctx.message?.text, commandName)) return;
    return handler(ctx);
  });
}

function createCommandCleanupMiddleware({
  scheduleDeleteMessage,
  commandExclusions = [],
  shortTtlCommands = ['status', 'record'],
  shortTtlMs,
  commandTtlMsByName = {},
}) {
  return (ctx, next) => {
    const msg = ctx.message;
    const text = msg && msg.text;
    const isForwarded = msg && (msg.forward_from || msg.forward_from_chat || msg.forward_origin);
    if (isForwarded && text && text.trim().startsWith('/')) {
      return;
    }

    if (text && text.trim().startsWith('/')) {
      const command = text.trim().split(/\s+/)[0].slice(1);
      const commandName = command.split('@')[0].toLowerCase();
      if (Number.isFinite(commandTtlMsByName[commandName])) {
        scheduleDeleteMessage(ctx, commandTtlMsByName[commandName]);
      } else if (shortTtlCommands.includes(commandName)) {
        scheduleDeleteMessage(ctx, shortTtlMs);
      } else if (!commandExclusions.includes(commandName)) {
        scheduleDeleteMessage(ctx);
      }
    }

    return next();
  };
}

async function dispatchPlainText(ctx, deps) {
  const { parseAdd, parseAddNumbers, parseRecord, parseStatusDate, handleAdd, handleRecord, handleStatus, sendEphemeral, errors } = deps;
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
      return sendEphemeral(ctx, errors.WAITING_EXPIRED);
    }

    const parsed = parseAddNumbers(text);
    if (!parsed) {
      return sendEphemeral(ctx, errors.ENTER_NUMBER);
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
}

module.exports = {
  isCommandFirstInMessage,
  registerCommandHandler,
  createCommandCleanupMiddleware,
  dispatchPlainText,
};
