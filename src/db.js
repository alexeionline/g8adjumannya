const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const defaultDbPath = path.join(__dirname, '..', 'data', 'bot.sqlite');
const dbPath = process.env.DATABASE_PATH || defaultDbPath;

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS daily_counts (
    chat_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    date TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (chat_id, user_id, date),
    FOREIGN KEY (user_id) REFERENCES users (user_id)
  );
`);

const upsertUserStmt = db.prepare(`
  INSERT INTO users (user_id, username, first_name, last_name, updated_at)
  VALUES (@user_id, @username, @first_name, @last_name, @updated_at)
  ON CONFLICT(user_id) DO UPDATE SET
    username = excluded.username,
    first_name = excluded.first_name,
    last_name = excluded.last_name,
    updated_at = excluded.updated_at
`);

const addCountStmt = db.prepare(`
  INSERT INTO daily_counts (chat_id, user_id, date, count, updated_at)
  VALUES (@chat_id, @user_id, @date, @count, @updated_at)
  ON CONFLICT(chat_id, user_id, date) DO UPDATE SET
    count = count + excluded.count,
    updated_at = excluded.updated_at
  RETURNING count
`);

const getStatusStmt = db.prepare(`
  SELECT
    dc.user_id,
    dc.count,
    u.username,
    u.first_name,
    u.last_name
  FROM daily_counts dc
  LEFT JOIN users u ON u.user_id = dc.user_id
  WHERE dc.chat_id = ? AND dc.date = ?
  ORDER BY dc.count DESC, dc.user_id ASC
`);

function upsertUser(from) {
  if (!from || !from.id) {
    return;
  }

  const now = new Date().toISOString();
  upsertUserStmt.run({
    user_id: from.id,
    username: from.username || null,
    first_name: from.first_name || null,
    last_name: from.last_name || null,
    updated_at: now,
  });
}

function addCount({ chatId, userId, date, delta }) {
  const now = new Date().toISOString();
  const row = addCountStmt.get({
    chat_id: chatId,
    user_id: userId,
    date,
    count: delta,
    updated_at: now,
  });

  return row ? row.count : 0;
}

function getStatusByDate(chatId, date) {
  return getStatusStmt.all(chatId, date);
}

module.exports = {
  addCount,
  getStatusByDate,
  upsertUser,
};
