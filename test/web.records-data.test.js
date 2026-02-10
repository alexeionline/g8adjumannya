const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadWebModule(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  return import(pathToFileURL(fullPath).href);
}

test('web normalizeRecordsRows maps and sorts records including total_all', async () => {
  const { normalizeRecordsRows } = await loadWebModule('web/src/stores/data.utils.js');

  const rows = normalizeRecordsRows([
    {
      user_id: '2',
      display_name: 'maria',
      best_approach: 30,
      best_day_total: 150,
      best_day_date: '2026-02-10',
      total_all: 2000,
      joined_at: '2025-12-01',
    },
    {
      user_id: '1',
      username: 'alex',
      max_add: 55,
      record_date: '2026-02-09',
      total: 3100,
    },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].user_id, 1);
  assert.equal(rows[0].best_approach, 55);
  assert.equal(rows[0].best_day_total, 0);
  assert.equal(rows[0].best_day_date, '2026-02-09');
  assert.equal(rows[0].total_all, 3100);
  assert.equal(rows[1].joined_at, '2025-12-01');
  assert.equal(rows[1].total_all, 2000);
});

test('web demo records include total_all for all users', async () => {
  const { buildDemoByChat } = await loadWebModule('web/src/stores/data.demo.js');

  const demo = buildDemoByChat();
  const chats = Object.values(demo);
  assert.ok(chats.length >= 1);

  for (const chat of chats) {
    assert.ok(Array.isArray(chat.recordsRows));
    assert.ok(chat.recordsRows.length > 0);
    for (const row of chat.recordsRows) {
      assert.equal(typeof row.total_all, 'number');
      assert.ok(Number.isFinite(row.total_all));
      assert.ok(row.total_all > 0);
      assert.equal(typeof row.joined_at, 'string');
      assert.match(row.joined_at, /^\d{4}-\d{2}-\d{2}$/);
    }
  }
});
