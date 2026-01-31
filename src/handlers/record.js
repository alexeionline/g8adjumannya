function createRecordHandler({ dayjs, getRecordsByChat, formatDisplayName, formatIndexEmoji, sendEphemeral }) {
  return async function handleRecord(ctx) {
    const records = await getRecordsByChat(ctx.chat.id);
    if (!records.length) {
      return sendEphemeral(ctx, 'Рекордов пока нет.');
    }

    const lines = records.map((row, index) => {
      const name = formatDisplayName(row);
      const date = dayjs(row.record_date).format('DD.MM.YYYY');
      const medalOrIndex =
        index === 0
          ? '🥇'
          : index === 1
            ? '🥈'
            : index === 2
              ? '🥉'
              : formatIndexEmoji(index);
      return `${medalOrIndex} [${row.max_add}] ${name} (${date})`;
    });

    const message = lines.join('\n');
    return sendEphemeral(ctx, message);
  };
}

module.exports = { createRecordHandler };
