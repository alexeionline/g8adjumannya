const test = require('node:test');
const assert = require('node:assert/strict');
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

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  const addr = server.address();
  const baseUrl = `http://127.0.0.1:${addr.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())));
  }
}

test('integration: /health responds with ok', async (t) => {
  const { app, restore } = loadApiAppWithDbMock(buildDbMock());
  try {
    try {
      await withServer(app, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/health`);
        assert.equal(res.status, 200);
        const json = await res.json();
        assert.deepEqual(json, { ok: true });
      });
    } catch (err) {
      if (err && err.code === 'EPERM') {
        t.skip('Network listen is blocked in this sandbox');
        return;
      }
      throw err;
    }
  } finally {
    restore();
  }
});

test('integration: /api/v2/auth is rate-limited', async (t) => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const { app, restore } = loadApiAppWithDbMock(buildDbMock(), env);
  try {
    try {
      await withServer(app, async (baseUrl) => {
        let lastStatus = 0;
        for (let i = 0; i < 25; i += 1) {
          const res = await fetch(`${baseUrl}/api/v2/auth`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({}),
          });
          lastStatus = res.status;
        }
        assert.equal(lastStatus, 429);
      });
    } catch (err) {
      if (err && err.code === 'EPERM') {
        t.skip('Network listen is blocked in this sandbox');
        return;
      }
      throw err;
    }
  } finally {
    restore();
  }
});

test('integration: async route errors are normalized by error middleware', async (t) => {
  const env = { JWT_SECRET: 's1', BOT_TOKEN: 'bot-token' };
  const token = jwt.sign({ user_id: 7 }, env.JWT_SECRET, { expiresIn: '1h' });
  const dbMock = buildDbMock({
    isUserSharedInChat: async () => {
      throw new Error('boom');
    },
  });
  const { app, restore } = loadApiAppWithDbMock(dbMock, env);
  try {
    try {
      await withServer(app, async (baseUrl) => {
        const res = await fetch(`${baseUrl}/api/v2/status?chat_id=-1001`, {
          headers: { authorization: `Bearer ${token}` },
        });
        assert.equal(res.status, 500);
        const json = await res.json();
        assert.equal(json.error, 'Internal server error');
      });
    } catch (err) {
      if (err && err.code === 'EPERM') {
        t.skip('Network listen is blocked in this sandbox');
        return;
      }
      throw err;
    }
  } finally {
    restore();
  }
});
