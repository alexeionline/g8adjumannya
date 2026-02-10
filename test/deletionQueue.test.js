const test = require('node:test');
const assert = require('node:assert/strict');

const { createDeletionHelpers } = require('../src/utils/deletionQueue');

test('sendEphemeral enqueues and deletes message', async () => {
  const deleted = [];
  const bot = {
    telegram: {
      deleteMessage: async (chatId, messageId) => {
        deleted.push({ chatId, messageId });
      },
    },
  };
  const helpers = createDeletionHelpers(bot, 1);
  const ctx = {
    reply: async () => ({ chat: { id: 1 }, message_id: 99 }),
  };
  await helpers.sendEphemeral(ctx, 'hi');
  await new Promise((resolve) => setTimeout(resolve, 10));
  assert.deepEqual(deleted, [{ chatId: 1, messageId: 99 }]);
});

test('cancelDeletion prevents deletion for queued message', async () => {
  const deleted = [];
  const bot = {
    telegram: {
      deleteMessage: async (chatId, messageId) => {
        deleted.push({ chatId, messageId });
      },
    },
  };
  const helpers = createDeletionHelpers(bot, 20);
  helpers.enqueueDeletion(1, 10, 20);
  helpers.cancelDeletion(1, 10);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(deleted.length, 0);
});
