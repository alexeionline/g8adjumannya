const test = require('node:test');
const assert = require('node:assert/strict');

const { createRecordHandler } = require('../src/handlers/record');
const { ERRORS } = require('../src/constants/text');

test('record handler reports empty records', async () => {
  const calls = [];
  const handler = createRecordHandler({
    dayjs: () => ({ format: () => '10.02.2026' }),
    getSharedUserIdsByChat: async () => [1],
    getRecordsByChatV2: async () => [],
    formatDisplayName: () => 'u',
    formatIndexEmoji: () => '4.',
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
    errors: ERRORS,
  });
  await handler({ chat: { id: 1 } });
  assert.equal(calls[0][1], ERRORS.RECORDS_EMPTY);
});

test('record handler renders medal rows', async () => {
  const calls = [];
  const handler = createRecordHandler({
    dayjs: () => ({ format: () => '10.02.2026' }),
    getSharedUserIdsByChat: async () => [1, 2],
    getRecordsByChatV2: async () => [
      { user_id: 1, best_approach: 55, best_day_date: '2026-02-10', username: 'alex' },
      { user_id: 2, best_approach: 40, best_day_date: '2026-02-10', username: 'maria' },
    ],
    formatDisplayName: (r) => r.username,
    formatIndexEmoji: (i) => `${i + 1}.`,
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
    errors: ERRORS,
  });
  await handler({ chat: { id: 1 } });
  assert.match(calls[0][1], /🥇 \[55\] alex/);
  assert.match(calls[0][1], /🥈 \[40\] maria/);
});
