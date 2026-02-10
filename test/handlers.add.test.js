const test = require('node:test');
const assert = require('node:assert/strict');

const { createAddHandler } = require('../src/handlers/add');

function makeCtx() {
  return {
    chat: { id: -1001 },
    from: { id: 42, username: 'alex' },
  };
}

test('add handler creates one add entry and sends one reply when total < 100', async () => {
  const calls = [];
  const sendEphemeral = async (...args) => {
    calls.push(args);
    return { ok: true };
  };

  const handler = createAddHandler({
    dayjs: () => ({
      format: () => '2026-02-10',
      add: () => ({ toISOString: () => '2026-02-10T09:00:00.000Z' }),
      toISOString: () => '2026-02-10T09:00:00.000Z',
    }),
    upsertUser: async () => {},
    addSharedChat: async () => {},
    addCount: async () => {},
    getTotalForUserDateV2: async () => 50,
    updateRecord: async () => {},
    hasUserReached100: async () => false,
    formatDisplayName: () => 'alex',
    formatAddHeader: () => 'header',
    sendEphemeral,
    first100Message: '100!',
  });

  await handler(makeCtx(), { sum: 20, max: 20, values: [20] });
  assert.equal(calls.length, 1);
  assert.match(calls[0][1], /Всего: 50/);
});

test('add handler sends celebratory message when crossing 100 first time', async () => {
  const calls = [];
  const adds = [];
  const sendEphemeral = async (...args) => {
    calls.push(args);
    return { ok: true };
  };

  const handler = createAddHandler({
    dayjs: () => ({
      format: () => '2026-02-10',
      add: (i) => ({ toISOString: () => `2026-02-10T09:0${i}:00.000Z` }),
      toISOString: () => '2026-02-10T09:00:00.000Z',
    }),
    upsertUser: async () => {},
    addSharedChat: async () => {},
    addCount: async (payload) => adds.push(payload),
    getTotalForUserDateV2: async () => 110,
    updateRecord: async () => {},
    hasUserReached100: async () => false,
    formatDisplayName: () => 'alex',
    formatAddHeader: () => 'header',
    sendEphemeral,
    first100Message: '100!',
  });

  await handler(makeCtx(), { sum: 30, max: 15, values: [10, 5, 15] });
  assert.equal(adds.length, 3);
  assert.equal(calls.length, 2);
  assert.equal(calls[1][1], '100!');
});
