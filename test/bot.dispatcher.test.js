const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isCommandFirstInMessage,
  registerCommandHandler,
  createCommandCleanupMiddleware,
  dispatchPlainText,
} = require('../src/bot/dispatcher');

test('isCommandFirstInMessage matches command only at start', () => {
  assert.equal(isCommandFirstInMessage('/add 10', 'add'), true);
  assert.equal(isCommandFirstInMessage('   /add@bot 10', 'add'), true);
  assert.equal(isCommandFirstInMessage('text /add 10', 'add'), false);
  assert.equal(isCommandFirstInMessage('', 'add'), false);
});

test('registerCommandHandler calls wrapped handler only for proper command placement', async () => {
  let wrapped = null;
  const bot = {
    command(name, fn) {
      assert.equal(name, 'status');
      wrapped = fn;
    },
  };
  let called = 0;
  registerCommandHandler(bot, 'status', async () => {
    called += 1;
  });
  await wrapped({ message: { text: '/status 10.02.2026' } });
  await wrapped({ message: { text: 'show /status' } });
  assert.equal(called, 1);
});

test('createCommandCleanupMiddleware applies proper TTL policies', () => {
  const calls = [];
  const middleware = createCommandCleanupMiddleware({
    scheduleDeleteMessage: (ctx, ttl) => calls.push({ text: ctx.message.text, ttl }),
    shortTtlMs: 10_000,
  });

  let nextCalls = 0;
  const next = () => {
    nextCalls += 1;
  };

  middleware({ message: { text: '/status' } }, next);
  middleware({ message: { text: '/record' } }, next);
  middleware({ message: { text: '/add 10' } }, next);
  middleware({ message: { text: '/help' } }, next);

  assert.equal(nextCalls, 4);
  assert.deepEqual(calls, [
    { text: '/status', ttl: 10_000 },
    { text: '/record', ttl: 10_000 },
    { text: '/help', ttl: undefined },
  ]);
});

test('createCommandCleanupMiddleware skips forwarded command messages', () => {
  const calls = [];
  const middleware = createCommandCleanupMiddleware({
    scheduleDeleteMessage: () => calls.push('delete'),
    shortTtlMs: 10_000,
  });

  let nextCalls = 0;
  middleware(
    {
      message: {
        text: '/help',
        forward_from: { id: 1 },
      },
    },
    () => {
      nextCalls += 1;
    }
  );

  assert.deepEqual(calls, []);
  assert.equal(nextCalls, 0);
});

test('dispatchPlainText handles waiting-for-add happy path', async () => {
  let added = null;
  const ctx = {
    message: { text: '15' },
    session: { waitingForAdd: true, waitingForAddUntil: Date.now() + 10_000 },
    botInfo: { id: 1 },
  };
  const deps = {
    parseAdd: () => null,
    parseAddNumbers: () => [15],
    parseRecord: () => false,
    parseStatusDate: () => null,
    handleAdd: async (_ctx, parsed) => {
      added = parsed;
    },
    handleRecord: async () => {},
    handleStatus: async () => {},
    sendEphemeral: async () => {},
    errors: { WAITING_EXPIRED: 'expired', ENTER_NUMBER: 'enter number' },
  };

  await dispatchPlainText(ctx, deps);
  assert.deepEqual(added, [15]);
  assert.equal(ctx.session.waitingForAdd, false);
  assert.equal('waitingForAddUntil' in ctx.session, false);
});

test('dispatchPlainText expires waiting state and sends error', async () => {
  const sent = [];
  const ctx = {
    message: { text: '15' },
    session: { waitingForAdd: true, waitingForAddUntil: Date.now() - 1 },
    botInfo: { id: 1 },
  };
  const deps = {
    parseAdd: () => null,
    parseAddNumbers: () => [15],
    parseRecord: () => false,
    parseStatusDate: () => null,
    handleAdd: async () => {},
    handleRecord: async () => {},
    handleStatus: async () => {},
    sendEphemeral: async (_ctx, text) => {
      sent.push(text);
    },
    errors: { WAITING_EXPIRED: 'expired', ENTER_NUMBER: 'enter number' },
  };

  await dispatchPlainText(ctx, deps);
  assert.deepEqual(sent, ['expired']);
  assert.equal(ctx.session.waitingForAdd, false);
});

test('dispatchPlainText routes record/add/status messages', async () => {
  const calls = [];
  const ctx = { message: { text: 'record me' }, session: {}, botInfo: { id: 1 } };
  const deps = {
    parseAdd: () => [10],
    parseAddNumbers: () => null,
    parseRecord: (text) => text.includes('record'),
    parseStatusDate: () => ({ date: '2026-02-10' }),
    handleAdd: async () => calls.push('add'),
    handleRecord: async () => calls.push('record'),
    handleStatus: async () => calls.push('status'),
    sendEphemeral: async () => {},
    errors: { WAITING_EXPIRED: 'expired', ENTER_NUMBER: 'enter number' },
  };

  await dispatchPlainText(ctx, deps);
  assert.deepEqual(calls, ['record']);

  ctx.message.text = 'add 10';
  deps.parseRecord = () => false;
  await dispatchPlainText(ctx, deps);
  assert.deepEqual(calls, ['record', 'add']);

  ctx.message.text = 'status 10.02.2026';
  deps.parseAdd = () => null;
  await dispatchPlainText(ctx, deps);
  assert.deepEqual(calls, ['record', 'add', 'status']);
});
