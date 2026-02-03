function createShareHandler({ dayjs, upsertUser, addSharedChat, getSharedChatIds, syncTodayCounts, sendEphemeral }) {
  return async function handleShare(ctx) {
    await upsertUser(ctx.from);
    await addSharedChat(ctx.chat.id, ctx.from.id);

    const chatIds = await getSharedChatIds(ctx.from.id);
    const today = dayjs().format('YYYY-MM-DD');
    await syncTodayCounts(chatIds, ctx.from.id, today);

    return sendEphemeral(ctx, 'Связал этот чат с твоими результатами. Теперь они синхронизируются.');
  };
}

module.exports = { createShareHandler };
