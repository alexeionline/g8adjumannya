function createAddHandler({ dayjs, upsertUser, addCount, updateRecord, formatDisplayName, formatAddHeader, sendEphemeral }) {
  return async function handleAdd(ctx, value) {
    await upsertUser(ctx.from);

    const today = dayjs().format('YYYY-MM-DD');
    const total = await addCount({
      chatId: ctx.chat.id,
      userId: ctx.from.id,
      date: today,
      delta: value,
    });
    await updateRecord({
      chatId: ctx.chat.id,
      userId: ctx.from.id,
      count: value,
      date: today,
    });

    const name = ctx.from && ctx.from.username ? ctx.from.username : formatDisplayName(ctx.from);
    const header = formatAddHeader(name);
    const message = `${header} +${value} / Всего: ${total}`;

    return sendEphemeral(ctx, message);
  };
}

module.exports = { createAddHandler };
