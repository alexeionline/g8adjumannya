function createAddHandler({
  dayjs,
  upsertUser,
  addSharedChat,
  addCount,
  getTotalCountForUserDate,
  updateRecord,
  hasUserReached100,
  formatDisplayName,
  formatAddHeader,
  sendEphemeral,
  first100Message,
}) {
  return async function handleAdd(ctx, parsed) {
    const { sum, max, values } = parsed;

    await upsertUser(ctx.from);
    await addSharedChat(ctx.chat.id, ctx.from.id);

    const today = dayjs().format('YYYY-MM-DD');
    const hadReached100 = await hasUserReached100(ctx.chat.id, ctx.from.id);
    const baseTime = dayjs();
    for (let i = 0; i < values.length; i += 1) {
      const createdAt = values.length > 1 ? baseTime.add(i, 'minute').toISOString() : undefined;
      await addCount({
        chatId: ctx.chat.id,
        userId: ctx.from.id,
        date: today,
        delta: values[i],
        createdAt,
      });
    }
    const total = await getTotalCountForUserDate(ctx.from.id, today);
    await updateRecord({
      chatId: ctx.chat.id,
      userId: ctx.from.id,
      count: max,
      date: today,
    });

    const name = ctx.from && ctx.from.username ? ctx.from.username : formatDisplayName(ctx.from);
    const header = formatAddHeader(name);
    const addPart =
      values.length === 1
        ? `+${values[0]}`
        : `Сумма +${sum} (${values.join(' + ')})`;
    const message = `${header} ${addPart} / Всего: ${total}`;

    const response = await sendEphemeral(ctx, message);
    if (!hadReached100 && total >= 100) {
      await sendEphemeral(ctx, first100Message);
    }
    return response;
  };
}

module.exports = { createAddHandler };
