function createAddHandler({
  dayjs,
  upsertUser,
  addCount,
  getTotalCountForUserDate,
  updateRecord,
  hasUserReached100,
  formatDisplayName,
  formatAddHeader,
  sendEphemeral,
  first100Message,
}) {
  return async function handleAdd(ctx, value) {
    await upsertUser(ctx.from);

    const today = dayjs().format('YYYY-MM-DD');
    const hadReached100 = await hasUserReached100(ctx.chat.id, ctx.from.id);
    await addCount({
      chatId: ctx.chat.id,
      userId: ctx.from.id,
      date: today,
      delta: value,
    });
    const total = await getTotalCountForUserDate(ctx.from.id, today);
    await updateRecord({
      chatId: ctx.chat.id,
      userId: ctx.from.id,
      count: value,
      date: today,
    });

    const name = ctx.from && ctx.from.username ? ctx.from.username : formatDisplayName(ctx.from);
    const header = formatAddHeader(name);
    const message = `${header} +${value} / Всего: ${total}`;

    const response = await sendEphemeral(ctx, message);
    if (!hadReached100 && total >= 100) {
      await sendEphemeral(ctx, first100Message);
    }
    return response;
  };
}

module.exports = { createAddHandler };
