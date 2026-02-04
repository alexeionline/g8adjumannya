function createStatusHandler({
  dayjs,
  getSharedUserIdsByChat,
  getStatusByDateV2,
  formatDisplayName,
  formatProgressBar,
  formatIndexEmoji,
  sendEphemeral,
  errors,
}) {
  return async function handleStatus(ctx, parsed) {
    if (parsed.error) {
      return sendEphemeral(ctx, parsed.error);
    }

    const chatUserIds = await getSharedUserIdsByChat(ctx.chat.id);
    const statusRows = await getStatusByDateV2(chatUserIds, parsed.date);
    const rows = statusRows.map((r) => ({ ...r, count: r.total }));
    if (!rows.length) {
      return sendEphemeral(ctx, errors.NO_RESULTS(parsed.label));
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
