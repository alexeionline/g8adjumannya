function createShareHandler({ upsertUser, addSharedChat, sendEphemeral }) {
  return async function handleShare(ctx) {
    await upsertUser(ctx.from);
    await addSharedChat(ctx.chat.id, ctx.from.id);
    return sendEphemeral(ctx, 'Связал этот чат с твоими результатами. Теперь они синхронизируются.');
  };
}

module.exports = { createShareHandler };
