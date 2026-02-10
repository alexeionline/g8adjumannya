const test = require('node:test');
const assert = require('node:assert/strict');

function buildDbMock(overrides = {}) {
  return {
    addCount: async () => {},
    getChatIdByToken: async () => null,
    getUserById: async () => null,
    getApproachesCountsByChatAndDate: async () => [],
    getChatMeta: async () => null,
    getSharedChatsByUser: async () => [],
    getSharedUserIdsByChat: async () => [],
    getApproachById: async () => null,
    getApproachesByUserDate: async () => [],
    getDisplayNameV2: (row) => row.username || `User ${row.user_id}`,
    getHistoryByUserIdV2: async () => [],
    getRecordsByChatV2: async () => [],
    getStatusByDateV2: async () => [],
    getTotalForUserDateV2: async () => 0,
    initDb: async () => {},
    insertApproaches: async () => [],
    isUserSharedInChat: async () => false,
    deleteApproach: async () => true,
    updateApproachCount: async () => null,
    upsertUser: async () => {},
    upsertChatMeta: async () => {},
    upsertUserV2: async () => {},
    ...overrides,
  };
}

function loadApiAppWithDbMock(dbMock) {
  const dbPath = require.resolve('../src/db');
  const serverPath = require.resolve('../src/api/server');
  const oldDbCache = require.cache[dbPath];
  const oldServerCache = require.cache[serverPath];

  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: dbMock,
  };
  delete require.cache[serverPath];

  const { createApiApp } = require('../src/api/server');
  const app = createApiApp();

  return {
    app,
    restore() {
      if (oldDbCache) require.cache[dbPath] = oldDbCache;
      else delete require.cache[dbPath];
      if (oldServerCache) require.cache[serverPath] = oldServerCache;
      else delete require.cache[serverPath];
    },
  };
}

function getRouteHandlers(app, method, routePath) {
  const layer = app._router.stack.find(
    (entry) => entry.route && entry.route.path === routePath && entry.route.methods[method]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${routePath} not found`);
  return layer.route.stack.map((s) => s.handle);
}

async function invokeRoute(app, { method, path, headers = {}, query = {}, body = {}, params = {} }) {
  const handlers = getRouteHandlers(app, method, path);
  const req = { headers, query, body, params, method: method.toUpperCase() };
  let statusCode = 200;
  let payload = null;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      payload = data;
      return this;
    },
  };

  let idx = 0;
  async function run() {
    if (idx >= handlers.length) return;
    const handler = handlers[idx++];
    await new Promise((resolve, reject) => {
      try {
        const maybe = handler(req, res, (err) => (err ? reject(err) : resolve()));
        if (maybe && typeof maybe.then === 'function') {
          maybe.then(resolve).catch(reject);
        } else if (handler.length < 3) {
          resolve();
        }
      } catch (err) {
        reject(err);
      }
    });
    await run();
  }

  await run();
  return { statusCode, payload };
}

test('v1 /history returns daily_adds-based history when user is shared in chat', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async (token) => (token === 't' ? -1001 : null),
    getSharedUserIdsByChat: async () => [42],
    getHistoryByUserIdV2: async () => [{ date: '2026-02-10', total: '120' }],
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/history',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.days, { '2026-02-10': 120 });
  } finally {
    restore();
  }
});

test('v1 /history denies access for user outside shared chat', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [100, 200],
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/history',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42' },
    });
    assert.equal(res.statusCode, 403);
  } finally {
    restore();
  }
});

test('v1 /approaches proxies list for shared user and date range', async () => {
  let capturedArgs = null;
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [42],
    getApproachesByUserDate: async (...args) => {
      capturedArgs = args;
      return [{ id: 1, user_id: 42, date: '2026-02-10', count: 20, created_at: '2026-02-10T10:00:00.000Z', migrated: false }];
    },
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/approaches',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42', date: '2026-02-01', date_to: '2026-02-10' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.length, 1);
    assert.deepEqual(capturedArgs, [42, '2026-02-01', '2026-02-10']);
  } finally {
    restore();
  }
});

test('v1 /status builds count from approaches sum', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [42],
    getStatusByDateV2: async () => [{ user_id: 42, total: 999, username: 'alex' }],
    getApproachesCountsByChatAndDate: async () => [{ user_id: 42, approaches: [{ id: 1, count: 10 }, { id: 2, count: 15 }] }],
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/status',
      headers: { authorization: 'Bearer t' },
      query: { date: '2026-02-10' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.rows[0].count, 25);
  } finally {
    restore();
  }
});

test('v1 /status validates date format', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/status',
      headers: { authorization: 'Bearer t' },
      query: { date: '10-02-2026' },
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, 'date must be YYYY-MM-DD');
  } finally {
    restore();
  }
});

test('v1 /status filters zero-count rows', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [42],
    getStatusByDateV2: async () => [{ user_id: 42, total: 0, username: 'alex' }],
    getApproachesCountsByChatAndDate: async () => [{ user_id: 42, approaches: [] }],
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/status',
      headers: { authorization: 'Bearer t' },
      query: { date: '2026-02-10' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.rows, []);
  } finally {
    restore();
  }
});

test('v1 /history requires user_id', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/history',
      headers: { authorization: 'Bearer t' },
      query: {},
    });
    assert.equal(res.statusCode, 400);
    assert.equal(res.payload.error, 'user_id is required');
  } finally {
    restore();
  }
});

test('v1 /approaches validates date_to range and order', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [42],
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const reversed = await invokeRoute(app, {
      method: 'get',
      path: '/approaches',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42', date: '2026-02-10', date_to: '2026-02-01' },
    });
    assert.equal(reversed.statusCode, 400);
    assert.equal(reversed.payload.error, 'date_to must be >= date');

    const tooLong = await invokeRoute(app, {
      method: 'get',
      path: '/approaches',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42', date: '2025-01-01', date_to: '2026-02-10' },
    });
    assert.equal(tooLong.statusCode, 400);
    assert.equal(tooLong.payload.error, 'date range must not exceed 365 days');
  } finally {
    restore();
  }
});

test('v1 /approaches denies access for non-shared user', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [100],
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/approaches',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42', date: '2026-02-10' },
    });
    assert.equal(res.statusCode, 403);
    assert.equal(res.payload.error, 'no access to this user');
  } finally {
    restore();
  }
});

test('v1 /add validates body and returns total', async () => {
  const addCalls = [];
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    addCount: async (payload) => addCalls.push(payload),
    getTotalForUserDateV2: async () => 37,
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const bad = await invokeRoute(app, {
      method: 'post',
      path: '/add',
      headers: { authorization: 'Bearer t' },
      body: { user_id: 42, delta: -1 },
    });
    assert.equal(bad.statusCode, 400);

    const ok = await invokeRoute(app, {
      method: 'post',
      path: '/add',
      headers: { authorization: 'Bearer t' },
      body: { user_id: 42, delta: 12, date: '2026-02-10' },
    });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.payload.total, 37);
    assert.equal(addCalls.length, 1);
    assert.deepEqual(addCalls[0], {
      chatId: -1001,
      userId: 42,
      date: '2026-02-10',
      delta: 12,
    });
  } finally {
    restore();
  }
});

test('v1 /records maps v2 records shape', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [42],
    getRecordsByChatV2: async () => [
      { user_id: 42, username: 'alex', best_approach: 55, best_day_date: '2026-02-10' },
    ],
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/records',
      headers: { authorization: 'Bearer t' },
    });
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.rows, [
      {
        user_id: 42,
        username: 'alex',
        first_name: null,
        max_add: 55,
        record_date: '2026-02-10',
      },
    ]);
  } finally {
    restore();
  }
});

test('v1 /chats returns current chat title fallback', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getChatMeta: async () => null,
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/chats',
      headers: { authorization: 'Bearer t' },
    });
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.rows[0].chat_id, -1001);
    assert.match(res.payload.rows[0].title, /^Chat /);
  } finally {
    restore();
  }
});
