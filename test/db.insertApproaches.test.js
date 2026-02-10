const test = require('node:test');
const assert = require('node:assert/strict');

test('insertApproaches performs a single bulk insert query', async () => {
  const dbPath = require.resolve('../src/db');
  const pgPath = require.resolve('pg');
  const oldDbCache = require.cache[dbPath];
  const oldPgCache = require.cache[pgPath];
  const oldDatabaseUrl = process.env.DATABASE_URL;

  const calls = [];
  const fakePool = {
    query: async (sql, params) => {
      calls.push({ sql, params });
      return {
        rows: [
          { id: 1, user_id: 7, date: '2026-02-10', count: 5, created_at: 'x' },
          { id: 2, user_id: 7, date: '2026-02-10', count: 10, created_at: 'x' },
        ],
      };
    },
  };

  try {
    process.env.DATABASE_URL = 'postgres://local/test';
    require.cache[pgPath] = {
      id: pgPath,
      filename: pgPath,
      loaded: true,
      exports: {
        Pool: function Pool() {
          return fakePool;
        },
      },
    };
    delete require.cache[dbPath];

    const { insertApproaches } = require('../src/db');
    const rows = await insertApproaches(7, '2026-02-10', [5, 10]);

    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /UNNEST\(\$3::int\[\]\)/);
    assert.equal(calls[0].params[0], 7);
    assert.equal(calls[0].params[1], '2026-02-10');
    assert.deepEqual(calls[0].params[2], [5, 10]);
    assert.equal(typeof calls[0].params[3], 'string');
    assert.equal(rows.length, 2);
  } finally {
    if (oldDbCache) require.cache[dbPath] = oldDbCache;
    else delete require.cache[dbPath];
    if (oldPgCache) require.cache[pgPath] = oldPgCache;
    else delete require.cache[pgPath];
    if (oldDatabaseUrl == null) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
  }
});
