const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({
  connectionString,
  ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false },
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      user_id BIGINT PRIMARY KEY,
      username TEXT,
      first_name TEXT,
      last_name TEXT,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_counts (
      chat_id BIGINT NOT NULL,
      user_id BIGINT NOT NULL,
      date DATE NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL,
      PRIMARY KEY (chat_id, user_id, date),
      FOREIGN KEY (user_id) REFERENCES users (user_id)
    );
  `);
}

async function upsertUser(from) {
  if (!from || !from.id) {
    return;
  }

  const now = new Date().toISOString();
  await pool.query(
    `
      INSERT INTO users (user_id, username, first_name, last_name, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(user_id) DO UPDATE SET
        username = excluded.username,
        first_name = excluded.first_name,
        last_name = excluded.last_name,
        updated_at = excluded.updated_at
    `,
    [from.id, from.username || null, from.first_name || null, from.last_name || null, now]
  );
}

async function addCount({ chatId, userId, date, delta }) {
  const now = new Date().toISOString();
  const result = await pool.query(
    `
      INSERT INTO daily_counts (chat_id, user_id, date, count, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(chat_id, user_id, date) DO UPDATE SET
        count = daily_counts.count + excluded.count,
        updated_at = excluded.updated_at
      RETURNING count
    `,
    [chatId, userId, date, delta, now]
  );

  return result.rows[0] ? result.rows[0].count : 0;
}

async function getStatusByDate(chatId, date) {
  const result = await pool.query(
    `
      SELECT
        dc.user_id,
        dc.count,
        u.username,
        u.first_name,
        u.last_name
      FROM daily_counts dc
      LEFT JOIN users u ON u.user_id = dc.user_id
      WHERE dc.chat_id = $1 AND dc.date = $2
      ORDER BY dc.count DESC, dc.user_id ASC
    `,
    [chatId, date]
  );

  return result.rows;
}

module.exports = {
  initDb,
  addCount,
  getStatusByDate,
  upsertUser,
};
