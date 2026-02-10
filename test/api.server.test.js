const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

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

function loadApiAppWithDbMock(dbMock, env = {}) {
  const dbPath = require.resolve('../src/db');
  const serverPath = require.resolve('../src/api/server');
  const oldDbCache = require.cache[dbPath];
  const oldServerCache = require.cache[serverPath];
  const oldEnv = {};

  for (const [k, v] of Object.entries(env)) {
    oldEnv[k] = process.env[k];
    process.env[k] = v;
  }

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

      for (const [k, v] of Object.entries(oldEnv)) {
        if (v == null) delete process.env[k];
        else process.env[k] = v;
      }
    },
  };
}

function getRouteHandlers(app, method, fullPath) {
  const m = method.toLowerCase();

  if (fullPath.startsWith('/api/v2/')) {
    const subPath = fullPath.slice('/api/v2'.length);
    const mount = app._router.stack.find(
      (entry) => entry.name === 'router' && entry.regexp && String(entry.regexp).includes('api\\/v2')
    );
    if (!mount) throw new Error('v2 router mount not found');

    const layer = mount.handle.stack.find(
      (entry) => entry.route && entry.route.path === subPath && entry.route.methods[m]
    );
    if (!layer) throw new Error(`Route ${method.toUpperCase()} ${fullPath} not found`);
    return layer.route.stack.map((s) => s.handle);
  }

  const layer = app._router.stack.find(
    (entry) => entry.route && entry.route.path === fullPath && entry.route.methods[m]
  );
  if (!layer) throw new Error(`Route ${method.toUpperCase()} ${fullPath} not found`);
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
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        if (err) reject(err);
        else resolve();
      };

      try {
        const maybe = handler(req, res, done);
        if (maybe && typeof maybe.then === 'function') {
          maybe.then(() => done()).catch(done);
        } else if (handler.length < 3) {
          done();
        } else {
          queueMicrotask(() => {
            if (!settled && payload !== null) done();
          });
        }
      } catch (err) {
        done(err);
      }
    });
    await run();
  }

  await run();
  return { statusCode, payload };
}

function createInitData(botToken, { userId = 42, username = 'alex', authDate = Math.floor(Date.now() / 1000) } = {}) {
  const user = JSON.stringify({ id: userId, username });
  const pairs = [
    ['auth_date', String(authDate)],
    ['query_id', 'AAEAAAE'],
    ['user', user],
  ];

  const dataCheckString = pairs
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const hash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  const params = new URLSearchParams();
  pairs.forEach(([k, v]) => params.set(k, v));
  params.set('hash', hash);
  return params.toString();
}

function makeV2Token(userId, secret = 's1') {
  return jwt.sign({ user_id: userId }, secret, { expiresIn: '1h' });
}

test('v1 auth middleware rejects missing bearer token', async () => {
  const { app, restore } = loadApiAppWithDbMock(buildDbMock());
  try {
    const res = await invokeRoute(app, { method: 'get', path: '/status' });
    assert.equal(res.statusCode, 401);
  } finally {
    restore();
  }
});

test('v1 /status maps totals from approaches and filters zero rows', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [1, 2],
    getStatusByDateV2: async () => [
      { user_id: 1, username: 'neo' },
      { user_id: 2, username: 'trinity' },
    ],
    getApproachesCountsByChatAndDate: async () => [
      { user_id: 1, approaches: [{ count: 30 }, { count: 20 }] },
      { user_id: 2, approaches: [] },
    ],
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
    assert.equal(res.payload.rows.length, 1);
    assert.deepEqual(res.payload.rows[0], {
      user_id: 1,
      username: 'neo',
      first_name: null,
      count: 50,
      approaches: [{ count: 30 }, { count: 20 }],
    });
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

test('v1 /approaches validates date_to bounds and allows exactly 365-day range', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [42],
    getApproachesByUserDate: async () => [],
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

    const tooLong = await invokeRoute(app, {
      method: 'get',
      path: '/approaches',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42', date: '2025-01-01', date_to: '2026-02-10' },
    });
    assert.equal(tooLong.statusCode, 400);

    const ok = await invokeRoute(app, {
      method: 'get',
      path: '/approaches',
      headers: { authorization: 'Bearer t' },
      query: { user_id: '42', date: '2025-02-10', date_to: '2026-02-10' },
    });
    assert.equal(ok.statusCode, 200);
  } finally {
    restore();
  }
});

test('v1 /records maps legacy shape', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getSharedUserIdsByChat: async () => [42],
    getRecordsByChatV2: async () => [{ user_id: 42, username: 'neo', best_approach: 60, best_day_date: '2026-02-10' }],
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/records',
      headers: { authorization: 'Bearer t' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.rows[0], {
      user_id: 42,
      username: 'neo',
      first_name: null,
      max_add: 60,
      record_date: '2026-02-10',
    });
  } finally {
    restore();
  }
});

test('v1 /chats returns chat-bound token scope', async () => {
  const dbMock = buildDbMock({
    getChatIdByToken: async () => -1001,
    getChatMeta: async () => ({ title: 'Alpha', updated_at: new Date().toISOString() }),
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/chats',
      headers: { authorization: 'Bearer t' },
    });

    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.payload.rows, [{ chat_id: -1001, title: 'Alpha' }]);
  } finally {
    restore();
  }
});

test('v2 auth middleware rejects invalid bearer token', async () => {
  const { app, restore } = loadApiAppWithDbMock(buildDbMock(), {
    JWT_SECRET: 's1',
    BOT_TOKEN: 'bot-token',
  });

  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/chats',
      headers: { authorization: 'Bearer invalid.jwt' },
    });
    assert.equal(res.statusCode, 401);
  } finally {
    restore();
  }
});

test('v2 /auth validates init_data and returns jwt token', async () => {
  let upserted = null;
  const dbMock = buildDbMock({
    upsertUserV2: async (userId, username) => {
      upserted = { userId, username };
    },
  });
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const { app, restore } = loadApiAppWithDbMock(dbMock, env);

  try {
    const initData = createInitData(env.BOT_TOKEN, { userId: 99, username: 'neo' });
    const res = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/auth',
      body: { init_data: initData },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.user_id, 99);
    assert.equal(typeof res.payload.token, 'string');
    assert.deepEqual(upserted, { userId: 99, username: 'neo' });
  } finally {
    restore();
  }
});

test('v2 /auth rejects missing and stale init_data', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const { app, restore } = loadApiAppWithDbMock(buildDbMock(), env);

  try {
    const missing = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/auth',
      body: {},
    });
    assert.equal(missing.statusCode, 400);

    const staleTs = Math.floor(Date.now() / 1000) - 2 * 24 * 60 * 60;
    const staleInitData = createInitData(env.BOT_TOKEN, { authDate: staleTs });
    const stale = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/auth',
      body: { init_data: staleInitData },
    });
    assert.equal(stale.statusCode, 401);
  } finally {
    restore();
  }
});

test('v2 /add validates payload and supports count/counts forms', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = makeV2Token(7, env.JWT_SECRET);
  let insertArgs = null;
  const dbMock = buildDbMock({
    insertApproaches: async (userId, date, counts) => {
      insertArgs = { userId, date, counts };
      return counts.map((count, idx) => ({ id: idx + 1, user_id: userId, date, count, created_at: 'x' }));
    },
    getTotalForUserDateV2: async () => 33,
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    const missing = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/add',
      headers: { authorization: `Bearer ${token}` },
      body: {},
    });
    assert.equal(missing.statusCode, 400);

    const badCounts = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/add',
      headers: { authorization: `Bearer ${token}` },
      body: { counts: [5, 0] },
    });
    assert.equal(badCounts.statusCode, 400);

    const futureDate = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/add',
      headers: { authorization: `Bearer ${token}` },
      body: { count: 10, date: '2999-01-01' },
    });
    assert.equal(futureDate.statusCode, 400);

    const single = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/add',
      headers: { authorization: `Bearer ${token}` },
      body: { count: 33, date: '2026-02-10' },
    });
    assert.equal(single.statusCode, 201);
    assert.deepEqual(insertArgs, { userId: 7, date: '2026-02-10', counts: [33] });

    const many = await invokeRoute(app, {
      method: 'post',
      path: '/api/v2/add',
      headers: { authorization: `Bearer ${token}` },
      body: { counts: [5, 15], date: '2026-02-10' },
    });
    assert.equal(many.statusCode, 201);
    assert.deepEqual(insertArgs, { userId: 7, date: '2026-02-10', counts: [5, 15] });
  } finally {
    restore();
  }
});

test('v2 /status validates access, date and returns mapped rows', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = makeV2Token(7, env.JWT_SECRET);
  const dbMock = buildDbMock({
    isUserSharedInChat: async (chatId, userId) => chatId === -1001 && userId === 7,
    getSharedUserIdsByChat: async () => [7, 8],
    getStatusByDateV2: async () => [
      { user_id: 7, username: 'neo' },
      { user_id: 8, username: 'morpheus' },
    ],
    getApproachesCountsByChatAndDate: async () => [
      { user_id: 7, approaches: [{ count: 15 }] },
      { user_id: 8, approaches: [] },
    ],
    getDisplayNameV2: (row) => `@${row.username}`,
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    const missingChat = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/status',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(missingChat.statusCode, 400);

    const badDate = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/status',
      headers: { authorization: `Bearer ${token}` },
      query: { chat_id: '-1001', date: '2026-99-99' },
    });
    assert.equal(badDate.statusCode, 400);

    const denied = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/status',
      headers: { authorization: `Bearer ${token}` },
      query: { chat_id: '-1002' },
    });
    assert.equal(denied.statusCode, 403);

    const ok = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/status',
      headers: { authorization: `Bearer ${token}` },
      query: { chat_id: '-1001', date: '2026-02-10' },
    });
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.payload.rows, [{ user_id: 7, display_name: '@neo', total: 15 }]);
  } finally {
    restore();
  }
});

test('v2 /records validates chat and returns display mapping', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = makeV2Token(7, env.JWT_SECRET);
  const dbMock = buildDbMock({
    isUserSharedInChat: async (chatId) => chatId === -1001,
    getSharedUserIdsByChat: async () => [7],
    getRecordsByChatV2: async () => [{ user_id: 7, username: 'neo', best_approach: 55, best_day_total: 180, best_day_date: '2026-02-01' }],
    getDisplayNameV2: () => 'Neo',
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    const missing = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/records',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(missing.statusCode, 400);

    const denied = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/records',
      headers: { authorization: `Bearer ${token}` },
      query: { chat_id: '-1002' },
    });
    assert.equal(denied.statusCode, 403);

    const ok = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/records',
      headers: { authorization: `Bearer ${token}` },
      query: { chat_id: '-1001' },
    });
    assert.equal(ok.statusCode, 200);
    assert.equal(ok.payload.rows[0].display_name, 'Neo');
  } finally {
    restore();
  }
});

test('v2 /chats returns shared chat ids with resolved titles', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = makeV2Token(7, env.JWT_SECRET);
  const now = new Date().toISOString();
  const dbMock = buildDbMock({
    getSharedChatsByUser: async () => [-1001, -1002],
    getChatMeta: async (chatId) => ({ title: `Chat ${chatId}`, updated_at: now }),
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    const res = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/chats',
      headers: { authorization: `Bearer ${token}` },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.rows.length, 2);
    assert.equal(res.payload.rows[0].title, 'Chat -1001');
  } finally {
    restore();
  }
});

test('v2 /history validates user_id and supports own history', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = makeV2Token(7, env.JWT_SECRET);
  const dbMock = buildDbMock({
    getHistoryByUserIdV2: async () => [{ date: '2026-02-10', total: '120' }],
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    const badUser = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/history',
      headers: { authorization: `Bearer ${token}` },
      query: { user_id: 'abc' },
    });
    assert.equal(badUser.statusCode, 400);

    const denied = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/history',
      headers: { authorization: `Bearer ${token}` },
      query: { user_id: '8' },
    });
    assert.equal(denied.statusCode, 403);

    const ok = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/history',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(ok.payload.days, { '2026-02-10': 120 });
  } finally {
    restore();
  }
});

test('v2 /approaches validates date/date_to and returns mapped list', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = makeV2Token(7, env.JWT_SECRET);
  let capturedArgs = null;
  const dbMock = buildDbMock({
    getApproachesByUserDate: async (...args) => {
      capturedArgs = args;
      return [{ id: 1, user_id: 7, date: '2026-02-10', count: 20, created_at: 'x', migrated: false }];
    },
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    const missingDate = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/approaches',
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(missingDate.statusCode, 400);

    const badOrder = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/approaches',
      headers: { authorization: `Bearer ${token}` },
      query: { date: '2026-02-10', date_to: '2026-02-01' },
    });
    assert.equal(badOrder.statusCode, 400);

    const tooLong = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/approaches',
      headers: { authorization: `Bearer ${token}` },
      query: { date: '2025-01-01', date_to: '2026-02-10' },
    });
    assert.equal(tooLong.statusCode, 400);

    const ok = await invokeRoute(app, {
      method: 'get',
      path: '/api/v2/approaches',
      headers: { authorization: `Bearer ${token}` },
      query: { date: '2026-02-10', date_to: '2026-02-10' },
    });
    assert.equal(ok.statusCode, 200);
    assert.deepEqual(capturedArgs, [7, '2026-02-10', '2026-02-10']);
    assert.equal(ok.payload[0].id, 1);
  } finally {
    restore();
  }
});

test('v2 patch/delete approaches enforce ownership and return total', async () => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = makeV2Token(7, env.JWT_SECRET);

  let patched = false;
  let deleted = false;
  const dbMock = buildDbMock({
    getApproachById: async (id) => {
      if (id === 1) return { id: 1, user_id: 8, date: '2026-02-10' };
      if (id === 2) return { id: 2, user_id: 7, date: '2026-02-10' };
      return null;
    },
    updateApproachCount: async (id, userId, count) => {
      patched = true;
      return { id, user_id: userId, date: '2026-02-10', count, created_at: 'x' };
    },
    deleteApproach: async () => {
      deleted = true;
      return true;
    },
    getTotalForUserDateV2: async () => 88,
  });

  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    const patchInvalid = await invokeRoute(app, {
      method: 'patch',
      path: '/api/v2/approaches/:id',
      headers: { authorization: `Bearer ${token}` },
      params: { id: 'abc' },
      body: { count: 20 },
    });
    assert.equal(patchInvalid.statusCode, 400);

    const patchDenied = await invokeRoute(app, {
      method: 'patch',
      path: '/api/v2/approaches/:id',
      headers: { authorization: `Bearer ${token}` },
      params: { id: '1' },
      body: { count: 20 },
    });
    assert.equal(patchDenied.statusCode, 403);

    const patchOk = await invokeRoute(app, {
      method: 'patch',
      path: '/api/v2/approaches/:id',
      headers: { authorization: `Bearer ${token}` },
      params: { id: '2' },
      body: { count: 20 },
    });
    assert.equal(patchOk.statusCode, 200);
    assert.equal(patchOk.payload.total, 88);
    assert.equal(patched, true);

    const deleteNotFound = await invokeRoute(app, {
      method: 'delete',
      path: '/api/v2/approaches/:id',
      headers: { authorization: `Bearer ${token}` },
      params: { id: '999' },
    });
    assert.equal(deleteNotFound.statusCode, 404);

    const deleteDenied = await invokeRoute(app, {
      method: 'delete',
      path: '/api/v2/approaches/:id',
      headers: { authorization: `Bearer ${token}` },
      params: { id: '1' },
    });
    assert.equal(deleteDenied.statusCode, 403);

    const deleteOk = await invokeRoute(app, {
      method: 'delete',
      path: '/api/v2/approaches/:id',
      headers: { authorization: `Bearer ${token}` },
      params: { id: '2' },
    });
    assert.equal(deleteOk.statusCode, 200);
    assert.equal(deleteOk.payload.total, 88);
    assert.equal(deleted, true);
  } finally {
    restore();
  }
});
