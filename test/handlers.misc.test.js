const test = require('node:test');
const assert = require('node:assert/strict');

const { createApiTokenHandler } = require('../src/handlers/apiToken');
const { createShareHandler } = require('../src/handlers/share');
const { createHideHandler } = require('../src/handlers/hide');

test('apiToken handler returns existing token without creating new one', async () => {
  const calls = [];
  const handler = createApiTokenHandler({
    createApiToken: async () => {
      throw new Error('should not create');
    },
    getApiTokenByChat: async () => 'abc',
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
  });
  await handler({ chat: { id: 1 } });
  assert.equal(calls[0][1], 'API token: abc');
});

test('share handler links chat and sends confirmation', async () => {
  const calls = [];
  const shareHandler = createShareHandler({
    upsertUser: async () => {},
    addSharedChat: async () => {},
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
  });
  await shareHandler({ chat: { id: 2 }, from: { id: 7 } });
  assert.match(calls[0][1], /синхронизируются/i);
});

test('hide handler removes chat link and sends confirmation', async () => {
  const calls = [];
  const hideHandler = createHideHandler({
    removeSharedChat: async () => {},
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
  });
  await hideHandler({ chat: { id: 2 }, from: { id: 7 } });
  assert.match(calls[0][1], /удалена/i);
});
