const test = require('node:test');
const assert = require('node:assert/strict');

const { createShareHandler } = require('../src/handlers/share');
const { createHideHandler } = require('../src/handlers/hide');

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
