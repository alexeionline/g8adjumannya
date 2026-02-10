const test = require('node:test');
const assert = require('node:assert/strict');

const { createStatusHandler } = require('../src/handlers/status');
const { ERRORS } = require('../src/constants/text');

test('status handler returns parse error immediately', async () => {
  const calls = [];
  const handler = createStatusHandler({
    dayjs: () => ({ format: () => '2026-02-10' }),
    getSharedUserIdsByChat: async () => [],
    getStatusByDateV2: async () => [],
    formatDisplayName: () => 'u',
    formatProgressBar: () => 'bar',
    formatIndexEmoji: () => '1.',
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
    errors: ERRORS,
  });

  await handler({ chat: { id: 1 } }, { error: 'bad' });
  assert.equal(calls.length, 1);
  assert.equal(calls[0][1], 'bad');
});

test('status handler renders rows for date', async () => {
  const calls = [];
  const handler = createStatusHandler({
    dayjs: () => ({ format: () => '2026-02-10' }),
    getSharedUserIdsByChat: async () => [1, 2],
    getStatusByDateV2: async () => [{ user_id: 1, total: 60, username: 'alex' }],
    formatDisplayName: (r) => r.username,
    formatProgressBar: () => '🟢🟢🟢⚪⚪',
    formatIndexEmoji: () => '1️⃣',
    sendEphemeral: async (...args) => {
      calls.push(args);
      return {};
    },
    errors: ERRORS,
  });

  await handler({ chat: { id: 1 } }, { date: '2026-02-09', label: '09.02.2026' });
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /Статус на 09\.02\.2026/);
  assert.match(calls[0][1], /60 alex/);
});
