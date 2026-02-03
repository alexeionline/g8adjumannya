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
  const lockId = 482901236;
  await pool.query('SELECT pg_advisory_lock($1)', [lockId]);
  try {
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

      CREATE TABLE IF NOT EXISTS shared_chats (
        chat_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (chat_id, user_id),
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      );

      CREATE TABLE IF NOT EXISTS records (
        chat_id BIGINT NOT NULL,
        user_id BIGINT NOT NULL,
        max_add INTEGER NOT NULL DEFAULT 0,
        record_count INTEGER NOT NULL DEFAULT 0,
        record_date DATE NOT NULL,
        max_add_initialized BOOLEAN NOT NULL DEFAULT FALSE,
        updated_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (chat_id, user_id),
        FOREIGN KEY (user_id) REFERENCES users (user_id)
      );

      CREATE TABLE IF NOT EXISTS api_tokens (
        token TEXT PRIMARY KEY,
        chat_id BIGINT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL
      );

      CREATE TABLE IF NOT EXISTS migration_flags (
        name TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL
      );
    `);

    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS api_tokens_chat_id_idx
      ON api_tokens (chat_id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS shared_chats_user_id_idx
      ON shared_chats (user_id);
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'records' AND column_name = 'max_add'
        ) THEN
          ALTER TABLE records ADD COLUMN max_add INTEGER NOT NULL DEFAULT 0;
          UPDATE records SET max_add = record_count;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'records' AND column_name = 'record_count'
        ) THEN
          ALTER TABLE records ADD COLUMN record_count INTEGER NOT NULL DEFAULT 0;
          UPDATE records SET record_count = max_add;
        END IF;

        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'records' AND column_name = 'max_add_initialized'
        ) THEN
          ALTER TABLE records ADD COLUMN max_add_initialized BOOLEAN NOT NULL DEFAULT FALSE;
        END IF;
      END $$;
    `);

    await pool.query(`
      UPDATE records
      SET max_add = 0,
          record_count = 0,
          record_date = CURRENT_DATE,
          max_add_initialized = TRUE
      WHERE max_add_initialized IS DISTINCT FROM TRUE;
    `);

    const runBackfill = false;
    const backfillKey = 'backfill_daily_counts_2025_11_23_2026_01_23_164828938';

    if (runBackfill) {
      const backfillCheck = await pool.query(
        'SELECT 1 FROM migration_flags WHERE name = $1 LIMIT 1',
        [backfillKey]
      );

      if (backfillCheck.rowCount === 0) {
        await pool.query('BEGIN');
        try {
          await pool.query(
            'INSERT INTO migration_flags (name, applied_at) VALUES ($1, NOW())',
            [backfillKey]
          );

          await pool.query(
            `
              INSERT INTO users (user_id, username, first_name, last_name, updated_at)
              VALUES ($1, NULL, NULL, NULL, NOW())
              ON CONFLICT (user_id) DO UPDATE
                SET updated_at = EXCLUDED.updated_at
            `,
            ['164828938']
          );

          await pool.query(
            `
              INSERT INTO daily_counts (chat_id, user_id, date, count, updated_at)
              SELECT $2, $1, d::date, $5, NOW()
              FROM generate_series($3::date, $4::date, interval '1 day') AS d
              ON CONFLICT (chat_id, user_id, date) DO UPDATE
                SET count = EXCLUDED.count,
                    updated_at = EXCLUDED.updated_at
            `,
            ['164828938', '-1001476494800', '2025-11-23', '2026-01-23', 100]
          );

          await pool.query('COMMIT');
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      }
    }
  } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [lockId]);
  }
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
  let total = 0;
  const sharedChatIds = await getSharedChatIds(userId);
  const shouldShare = sharedChatIds.some((id) => String(id) === String(chatId));

  await pool.query('BEGIN');
  try {
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
    total = result.rows[0] ? result.rows[0].count : 0;

    if (shouldShare) {
      const otherChatIds = sharedChatIds.filter((id) => String(id) !== String(chatId));
      for (const targetChatId of otherChatIds) {
        await pool.query(
          `
            INSERT INTO daily_counts (chat_id, user_id, date, count, updated_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT(chat_id, user_id, date) DO UPDATE SET
              count = daily_counts.count + excluded.count,
              updated_at = excluded.updated_at
          `,
          [targetChatId, userId, date, delta, now]
        );
      }
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  return total;
}

async function updateRecord({ chatId, userId, count, date }) {
  const now = new Date().toISOString();
  const sharedChatIds = await getSharedChatIds(userId);
  const shouldShare = sharedChatIds.some((id) => String(id) === String(chatId));
  await pool.query('BEGIN');
  try {
    await pool.query(
      `
        INSERT INTO records (
          chat_id,
          user_id,
          max_add,
          record_count,
          record_date,
          max_add_initialized,
          updated_at
        )
        VALUES ($1, $2, $3, $3, $4, TRUE, $5)
        ON CONFLICT(chat_id, user_id) DO UPDATE SET
          max_add = GREATEST(records.max_add, excluded.max_add),
          record_count = GREATEST(records.record_count, excluded.record_count),
          record_date = CASE
            WHEN excluded.max_add > records.max_add THEN excluded.record_date
            ELSE records.record_date
          END,
          max_add_initialized = TRUE,
          updated_at = excluded.updated_at
      `,
      [chatId, userId, count, date, now]
    );

    if (shouldShare) {
      const otherChatIds = sharedChatIds.filter((id) => String(id) !== String(chatId));
      for (const targetChatId of otherChatIds) {
        await pool.query(
          `
            INSERT INTO records (
              chat_id,
              user_id,
              max_add,
              record_count,
              record_date,
              max_add_initialized,
              updated_at
            )
            VALUES ($1, $2, $3, $3, $4, TRUE, $5)
            ON CONFLICT(chat_id, user_id) DO UPDATE SET
              max_add = GREATEST(records.max_add, excluded.max_add),
              record_count = GREATEST(records.record_count, excluded.record_count),
              record_date = CASE
                WHEN excluded.max_add > records.max_add THEN excluded.record_date
                ELSE records.record_date
              END,
              max_add_initialized = TRUE,
              updated_at = excluded.updated_at
          `,
          [targetChatId, userId, count, date, now]
        );
      }
    }

    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }
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

async function getUserHistory(chatId, userId) {
  const result = await pool.query(
    `
      SELECT
        date,
        count
      FROM daily_counts
      WHERE chat_id = $1 AND user_id = $2
      ORDER BY date ASC
    `,
    [chatId, userId]
  );

  return result.rows;
}

async function hasUserReached100(chatId, userId) {
  const result = await pool.query(
    `
      SELECT 1
      FROM daily_counts
      WHERE chat_id = $1
        AND user_id = $2
        AND count >= 100
      LIMIT 1
    `,
    [chatId, userId]
  );

  return result.rowCount > 0;
}

async function addSharedChat(chatId, userId) {
  const now = new Date().toISOString();
  await pool.query(
    `
      INSERT INTO shared_chats (chat_id, user_id, created_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (chat_id, user_id) DO NOTHING
    `,
    [chatId, userId, now]
  );
}

async function removeSharedChat(chatId, userId) {
  await pool.query(
    `
      DELETE FROM shared_chats
      WHERE chat_id = $1 AND user_id = $2
    `,
    [chatId, userId]
  );
}

async function getSharedChatIds(userId) {
  const result = await pool.query(
    `
      SELECT chat_id
      FROM shared_chats
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows.map((row) => row.chat_id);
}

async function syncTodayCounts(chatIds, userId, date) {
  if (!chatIds.length) {
    return 0;
  }

  const totalResult = await pool.query(
    `
      SELECT COALESCE(SUM(count), 0) AS total
      FROM daily_counts
      WHERE user_id = $1
        AND chat_id = ANY($2)
        AND date = $3
    `,
    [userId, chatIds, date]
  );

  const total = Number(totalResult.rows[0]?.total || 0);
  if (!total) {
    return 0;
  }

  const now = new Date().toISOString();
  await pool.query('BEGIN');
  try {
    for (const chatId of chatIds) {
      await pool.query(
        `
          INSERT INTO daily_counts (chat_id, user_id, date, count, updated_at)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT(chat_id, user_id, date) DO UPDATE SET
            count = excluded.count,
            updated_at = excluded.updated_at
        `,
        [chatId, userId, date, total, now]
      );
    }
    await pool.query('COMMIT');
  } catch (error) {
    await pool.query('ROLLBACK');
    throw error;
  }

  return total;
}

async function getUserById(userId) {
  const result = await pool.query(
    `
      SELECT
        user_id,
        username,
        first_name,
        last_name
      FROM users
      WHERE user_id = $1
      LIMIT 1
    `,
    [userId]
  );

  return result.rows[0] || null;
}

async function getRecordsByChat(chatId) {
  const result = await pool.query(
    `
      SELECT
        r.user_id,
        r.max_add,
        r.record_date,
        u.username,
        u.first_name,
        u.last_name
      FROM records r
      LEFT JOIN users u ON u.user_id = r.user_id
      WHERE r.chat_id = $1
      ORDER BY r.record_count DESC, r.user_id ASC
    `,
    [chatId]
  );

  return result.rows;
}

async function getChatRecord(chatId) {
  const result = await pool.query(
    `
      SELECT
        r.user_id,
        r.max_add,
        r.record_date,
        u.username,
        u.first_name,
        u.last_name
      FROM records r
      LEFT JOIN users u ON u.user_id = r.user_id
      WHERE r.chat_id = $1
        AND r.max_add = (
          SELECT MAX(max_add) FROM records WHERE chat_id = $1
        )
      ORDER BY r.user_id ASC
    `,
    [chatId]
  );

  return result.rows;
}

async function createApiToken(chatId, token) {
  const now = new Date().toISOString();
  await pool.query(
    `
      INSERT INTO api_tokens (token, chat_id, created_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (chat_id) DO NOTHING
    `,
    [token, chatId, now]
  );
}

async function getApiTokenByChat(chatId) {
  const result = await pool.query(
    `
      SELECT token
      FROM api_tokens
      WHERE chat_id = $1
      LIMIT 1
    `,
    [chatId]
  );

  return result.rows[0] ? result.rows[0].token : null;
}

async function getChatIdByToken(token) {
  const result = await pool.query(
    `
      SELECT chat_id
      FROM api_tokens
      WHERE token = $1
      LIMIT 1
    `,
    [token]
  );

  return result.rows[0] ? result.rows[0].chat_id : null;
}

module.exports = {
  initDb,
  addCount,
  updateRecord,
  getStatusByDate,
  getUserHistory,
  hasUserReached100,
  addSharedChat,
  removeSharedChat,
  getSharedChatIds,
  syncTodayCounts,
  getUserById,
  getRecordsByChat,
  getChatRecord,
  createApiToken,
  getChatIdByToken,
  getApiTokenByChat,
  upsertUser,
};
