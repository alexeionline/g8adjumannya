function createCorrectHandler({
  dayjs,
  upsertUser,
  addCount,
  setCountForUserDate,
  getTotalCountForUserDate,
  syncUserRecord,
  sendEphemeral,
}) {
  return async function handleCorrect(ctx, parsed) {
    const { mode, value } = parsed;

    await upsertUser(ctx.from);

    const today = dayjs().format('YYYY-MM-DD');
    const chatId = ctx.chat.id;
    const userId = ctx.from.id;

    if (mode === 'set') {
      await setCountForUserDate(chatId, userId, today, value);
    } else if (mode === 'add') {
      await addCount({ chatId, userId, date: today, delta: value });
    } else {
      await addCount({ chatId, userId, date: today, delta: -value });
    }

    await syncUserRecord(userId);

    const total = await getTotalCountForUserDate(userId, today);

    let actionText;
    if (mode === 'set') {
      actionText = `Установлено: ${value}`;
    } else if (mode === 'add') {
      actionText = `Добавлено ${value}`;
    } else {
      actionText = `Отнято ${value}`;
    }

    const message = `Исправлено. ${actionText} / Сегодня: ${total}`;
    return sendEphemeral(ctx, message);
  };
}

module.exports = { createCorrectHandler };
