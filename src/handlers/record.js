function createRecordHandler({
  dayjs,
  getSharedUserIdsByChat,
  getRecordsByChatV2,
  formatDisplayName,
  formatIndexEmoji,
  sendEphemeral,
  errors,
}) {
  return async function handleRecord(ctx) {
    const chatUserIds = await getSharedUserIdsByChat(ctx.chat.id);
    const records = await getRecordsByChatV2(chatUserIds);
    if (!records.length) {
      return sendEphemeral(ctx, errors.RECORDS_EMPTY);
    }

    const lines = records.map((row, index) => {
      const name = formatDisplayName(row);
      const date = dayjs(row.best_day_date).format('DD.MM.YYYY');
      const medalOrIndex =
        index === 0
          ? '🥇'
          : index === 1
            ? '🥈'
            : index === 2
              ? '🥉'
              : formatIndexEmoji(index);
      return `${medalOrIndex} [${row.best_approach}] ${name} (${date})`;
    });

    const message = lines.join('\n');
    return sendEphemeral(ctx, message);
  };
}

module.exports = { createRecordHandler };
