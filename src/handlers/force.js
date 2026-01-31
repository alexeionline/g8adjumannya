const USERNAME_REGEX = /@([A-Za-z0-9_]{5,})/;

function createForceHandler({ forceMessages, errors, sendEphemeral }) {
  return async function handleForce(ctx) {
    const text = ctx.message && ctx.message.text ? ctx.message.text : '';
    const match = text.match(USERNAME_REGEX);
    if (!match) {
      return sendEphemeral(ctx, errors.FORCE_FORMAT);
    }

    const mention = `@${match[1]}`;
    const message = forceMessages[Math.floor(Math.random() * forceMessages.length)];
    return sendEphemeral(ctx, `${mention} ${message}`, undefined, 60_000);
  };
}

module.exports = { createForceHandler };
