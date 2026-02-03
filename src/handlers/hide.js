function createHideHandler({ removeSharedChat, sendEphemeral }) {
  return async function handleHide(ctx) {
    await removeSharedChat(ctx.chat.id, ctx.from.id);
    return sendEphemeral(ctx, 'Связка этого чата с твоими результатами удалена.');
  };
}

module.exports = { createHideHandler };
