const USERNAME_REGEX = /@([A-Za-z0-9_]{5,})/;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function getMentionFromEntities(message) {
  const text = message.text || '';
  const entities = message.entities || [];
  for (const entity of entities) {
    if (entity.type === 'text_mention' && entity.user) {
      const user = entity.user;
      const name = user.first_name || user.username || 'User';
      return { html: escapeHtml(name), useHtml: true };
    }
    if (entity.type === 'mention') {
      const mentionText = text.slice(entity.offset, entity.offset + entity.length);
      return { html: escapeHtml(mentionText), useHtml: true };
    }
  }
  return null;
}

function createForceHandler({ forceMessages, errors, sendEphemeral }) {
  return async function handleForce(ctx) {
    const message = ctx.message;
    if (!message) {
      return sendEphemeral(ctx, errors.FORCE_FORMAT);
    }

    const text = message.text || '';
    let mentionHtml = null;
    let useHtml = false;

    const fromEntities = getMentionFromEntities(message);
    if (fromEntities) {
      mentionHtml = fromEntities.html;
      useHtml = true;
    } else {
      const match = text.match(USERNAME_REGEX);
      if (!match) {
        return sendEphemeral(ctx, errors.FORCE_FORMAT);
      }
      const username = match[1];
      mentionHtml = escapeHtml('@' + username);
      useHtml = true;
    }

    const forceMessage = forceMessages[Math.floor(Math.random() * forceMessages.length)];
    const replyText = `${mentionHtml} ${escapeHtml(forceMessage)}`;
    const extra = useHtml ? { parse_mode: 'HTML' } : undefined;
    return sendEphemeral(ctx, replyText, extra, 180_000);
  };
}

module.exports = { createForceHandler };
