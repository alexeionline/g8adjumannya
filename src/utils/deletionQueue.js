function createDeletionHelpers(bot, delayMs = 30_000) {
  const deletionQueue = [];
  const deletionIndex = new Map();
  let deletionTimer = null;

  function enqueueDeletion(chatId, messageId, overrideDelayMs) {
    const effectiveDelay = Number.isFinite(overrideDelayMs) ? overrideDelayMs : delayMs;
    const deleteAt = Date.now() + effectiveDelay;
    const key = `${chatId}:${messageId}`;
    if (deletionIndex.has(key)) {
      return;
    }

    const entry = { chatId, messageId, deleteAt };
    deletionQueue.push(entry);
    deletionIndex.set(key, entry);
    deletionQueue.sort((a, b) => a.deleteAt - b.deleteAt);
    scheduleDeletionTimer();
  }

  function scheduleDeletionTimer() {
    if (deletionTimer) {
      clearTimeout(deletionTimer);
    }

    if (!deletionQueue.length) {
      deletionTimer = null;
      return;
    }

    const delay = Math.max(0, deletionQueue[0].deleteAt - Date.now());
    deletionTimer = setTimeout(processDeletionQueue, delay);
  }

  function processDeletionQueue() {
    const now = Date.now();
    while (deletionQueue.length && deletionQueue[0].deleteAt <= now) {
      const entry = deletionQueue.shift();
      const key = `${entry.chatId}:${entry.messageId}`;
      deletionIndex.delete(key);
      bot.telegram.deleteMessage(entry.chatId, entry.messageId).catch(() => {});
    }

    scheduleDeletionTimer();
  }

  function sendEphemeral(ctx, text, extra, overrideDelayMs) {
    return ctx.reply(text, extra).then((message) => {
      if (!message || !message.chat || !message.message_id) {
        return message;
      }

      enqueueDeletion(message.chat.id, message.message_id, overrideDelayMs);
      return message;
    });
  }

  async function sendTyping(ctx, text, extra, overrideDelayMs, intervalMs = 1000, caret = '|') {
    const content = typeof text === 'string' ? text : '';
    if (!content) {
      return sendEphemeral(ctx, '', extra, overrideDelayMs);
    }

    const words = content.split(/\s+/).filter(Boolean);
    const initialWord = words[0] || '';
    const message = await ctx.reply(`${initialWord}${caret}`, extra);
    if (!message || !message.chat || !message.message_id) {
      return message;
    }

    enqueueDeletion(message.chat.id, message.message_id, overrideDelayMs);

    for (let i = 1; i < words.length; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
      const nextText = `${words.slice(0, i + 1).join(' ')}${caret}`;
      await ctx.telegram
        .editMessageText(message.chat.id, message.message_id, undefined, nextText, extra)
        .catch(() => {});
    }

    const finalText = `${content}...`;
    await ctx.telegram
      .editMessageText(message.chat.id, message.message_id, undefined, finalText, extra)
      .catch(() => {});

    return message;
  }

  function scheduleDeleteMessage(ctx, overrideDelayMs) {
    if (!ctx || !ctx.chat || !ctx.message || !ctx.message.message_id) {
      return;
    }

    enqueueDeletion(ctx.chat.id, ctx.message.message_id, overrideDelayMs);
  }

  return {
    enqueueDeletion,
    scheduleDeleteMessage,
    sendEphemeral,
    sendTyping,
  };
}

module.exports = { createDeletionHelpers };
