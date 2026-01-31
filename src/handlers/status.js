function createStatusHandler({ dayjs, getStatusByDate, formatDisplayName, formatProgressBar, formatIndexEmoji, sendEphemeral }) {
  return async function handleStatus(ctx, parsed) {
    if (parsed.error) {
      return sendEphemeral(ctx, parsed.error);
    }

    const rows = await getStatusByDate(ctx.chat.id, parsed.date);
    if (!rows.length) {
      return sendEphemeral(ctx, `Результатов за ${parsed.label} нет.`);
    }

    const isToday = parsed.date === dayjs().format('YYYY-MM-DD');
    const header = isToday ? null : `Статус на ${parsed.label}`;
    const lines = rows.map((row, index) => {
      const name = formatDisplayName(row);
      const progressBar = formatProgressBar(row.count);
      const indexEmoji = formatIndexEmoji(index);
      return `${indexEmoji} ${progressBar} ${row.count} ${name}`;
    });

    const message = (header ? [header] : []).concat(lines).join('\n');
    return sendEphemeral(ctx, message);
  };
}

module.exports = { createStatusHandler };
