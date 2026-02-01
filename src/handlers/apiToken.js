const crypto = require('crypto');

function createApiTokenHandler({ createApiToken, getApiTokenByChat, sendEphemeral }) {
  return async function handleApiToken(ctx) {
    const existing = await getApiTokenByChat(ctx.chat.id);
    if (existing) {
      return sendEphemeral(ctx, `API token: ${existing}`);
    }

    const token = crypto.randomBytes(24).toString('hex');
    await createApiToken(ctx.chat.id, token);
    return sendEphemeral(ctx, `API token: ${token}`);
  };
}

module.exports = { createApiTokenHandler };
