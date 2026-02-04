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

      CREATE TABLE IF NOT EXISTS user_records (
        user_id BIGINT PRIMARY KEY,
        max_add INTEGER NOT NULL DEFAULT 0,
        record_count INTEGER NOT NULL DEFAULT 0,
        record_date DATE NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
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
      CREATE INDEX IF NOT EXISTS shared_chats_chat_id_idx
      ON shared_chats (chat_id);
    `);

    await pool.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'created_at'
        ) THEN
          ALTER TABLE users ADD COLUMN created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
          UPDATE users u SET created_at = COALESCE(
            (SELECT MIN(updated_at) FROM daily_counts dc WHERE dc.user_id = u.user_id),
            u.created_at
          );
        END IF;
      END $$;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS daily_adds (
        id         BIGSERIAL PRIMARY KEY,
        user_id    BIGINT NOT NULL REFERENCES users (user_id),
        date       DATE NOT NULL,
        count      INTEGER NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        migrated   BOOLEAN NOT NULL DEFAULT FALSE,
        CONSTRAINT daily_adds_count_range CHECK (count > 0 AND count <= 1000),
        CONSTRAINT daily_adds_date_not_future CHECK (date <= CURRENT_DATE)
      );
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS daily_adds_user_date_idx ON daily_adds (user_id, date);
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS daily_adds_user_date_migrated_idx ON daily_adds (user_id, date) WHERE migrated = FALSE;
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS daily_adds_created_at_idx ON daily_adds (created_at);
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

    await pool.query(`
      INSERT INTO user_records (user_id, max_add, record_count, record_date, updated_at)
      SELECT DISTINCT ON (user_id)
        user_id,
        max_add,
        record_count,
        record_date,
        updated_at
      FROM records
      ORDER BY user_id, record_count DESC, max_add DESC, record_date DESC
      ON CONFLICT (user_id) DO UPDATE SET
        max_add = GREATEST(user_records.max_add, excluded.max_add),
        record_count = GREATEST(user_records.record_count, excluded.record_count),
        record_date = CASE
          WHEN excluded.record_count > user_records.record_count THEN excluded.record_date
          ELSE user_records.record_date
        END,
        updated_at = excluded.updated_at;
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

    // Миграция данных из daily_counts в daily_adds (один раз). Пользователи бота не теряют историю.
    const migrateToDailyAddsKey = 'migrate_daily_counts_to_daily_adds_v1';
    const migrateCheck = await pool.query(
      'SELECT 1 FROM migration_flags WHERE name = $1 LIMIT 1',
      [migrateToDailyAddsKey]
    );
    if (migrateCheck.rowCount === 0) {
      await pool.query('BEGIN');
      try {
        await pool.query(
          'INSERT INTO migration_flags (name, applied_at) VALUES ($1, NOW())',
          [migrateToDailyAddsKey]
        );
        // Пользователи из daily_counts без записи в users (на всякий случай)
        await pool.query(`
          INSERT INTO users (user_id, username, first_name, last_name, updated_at, created_at)
          SELECT dc.user_id, NULL, NULL, NULL, NOW(),
                 COALESCE((SELECT MIN(updated_at) FROM daily_counts WHERE user_id = dc.user_id), NOW())
          FROM (SELECT DISTINCT user_id FROM daily_counts) dc
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.user_id = dc.user_id)
        `);
        // Копируем каждую запись daily_counts как один «подход» в daily_adds (migrated=TRUE — не в рекорды).
        // count > 1000 ограничиваем одним рядом 1000, чтобы не нарушать CHECK (1–1000).
        await pool.query(`
          INSERT INTO daily_adds (user_id, date, count, created_at, migrated)
          SELECT user_id, date, LEAST(count, 1000), updated_at, TRUE
          FROM daily_counts
          WHERE count > 0
        `);
        await pool.query('COMMIT');
      } catch (error) {
        await pool.query('ROLLBACK');
        throw error;
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
  const writeChatId = await resolveWriteChatId(chatId, userId);
  const result = await pool.query(
    `
      INSERT INTO daily_counts (chat_id, user_id, date, count, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(chat_id, user_id, date) DO UPDATE SET
        count = daily_counts.count + excluded.count,
        updated_at = excluded.updated_at
      RETURNING count
    `,
    [writeChatId, userId, date, delta, now]
  );

  // Двойная запись в daily_adds: данные из бота / v1 API видны и в v2 (history, status).
  // Отрицательный delta (correct в боте) в daily_adds не отражаем — правки делаются в v2 UI.
  if (delta > 0 && delta <= 1000) {
    await pool.query(
      `
        INSERT INTO daily_adds (user_id, date, count, created_at, migrated)
        VALUES ($1, $2, $3, $4, FALSE)
      `,
      [userId, date, delta, now]
    ).catch((err) => {
      console.error('addCount: daily_adds insert failed (v2 sync):', err.message);
    });
  }

  return result.rows[0] ? result.rows[0].count : 0;
}

async function getTotalCountForUserDate(userId, date) {
  const result = await pool.query(
    `
      SELECT COALESCE(SUM(count), 0) AS total
      FROM daily_counts
      WHERE user_id = $1 AND date = $2
    `,
    [userId, date]
  );
  return Number(result.rows[0]?.total ?? 0);
}

async function setCountForUserDate(chatId, userId, date, count) {
  const writeChatId = await resolveWriteChatId(chatId, userId);
  const now = new Date().toISOString();
  await pool.query(
    `DELETE FROM daily_counts WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );
  if (count >= 0) {
    await pool.query(
      `
        INSERT INTO daily_counts (chat_id, user_id, date, count, updated_at)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [writeChatId, userId, date, count, now]
    );
  }
}

async function getBestRecordForUser(userId) {
  const result = await pool.query(
    `
      SELECT date, SUM(count) AS total
      FROM daily_counts
      WHERE user_id = $1
      GROUP BY date
      ORDER BY total DESC NULLS LAST
      LIMIT 1
    `,
    [userId]
  );
  const row = result.rows[0];
  return row
    ? { record_count: Number(row.total), record_date: row.date }
    : { record_count: 0, record_date: new Date().toISOString().slice(0, 10) };
}

async function syncUserRecord(userId) {
  const { record_count, record_date } = await getBestRecordForUser(userId);
  const now = new Date().toISOString();
  await pool.query(
    `
      INSERT INTO user_records (user_id, max_add, record_count, record_date, updated_at)
      VALUES ($1, $2, $2, $3, $4)
      ON CONFLICT (user_id) DO UPDATE SET
        record_count = excluded.record_count,
        record_date = excluded.record_date,
        updated_at = excluded.updated_at
    `,
    [userId, record_count, record_date, now]
  );
}

async function updateRecord({ chatId, userId, count, date }) {
  const now = new Date().toISOString();
  await pool.query(
    `
      INSERT INTO user_records (
        user_id,
        max_add,
        record_count,
        record_date,
        updated_at
      )
      VALUES ($1, $2, $2, $3, $4)
      ON CONFLICT(user_id) DO UPDATE SET
        max_add = GREATEST(user_records.max_add, excluded.max_add),
        record_count = GREATEST(user_records.record_count, excluded.record_count),
        record_date = CASE
          WHEN excluded.record_count > user_records.record_count THEN excluded.record_date
          ELSE user_records.record_date
        END,
        updated_at = excluded.updated_at
    `,
    [userId, count, date, now]
  );
}

async function getStatusByDate(chatId, date) {
  const sharedUsers = await getSharedUserIdsByChat(chatId);
  if (!sharedUsers.length) {
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

  const sharedResult = await pool.query(
    `
      SELECT
        su.user_id,
        COALESCE(SUM(dc.count), 0) AS count,
        u.username,
        u.first_name,
        u.last_name
      FROM (
        SELECT UNNEST($1::bigint[]) AS user_id
      ) su
      LEFT JOIN daily_counts dc
        ON dc.user_id = su.user_id
       AND dc.date = $2
      LEFT JOIN users u ON u.user_id = su.user_id
      GROUP BY su.user_id, u.username, u.first_name, u.last_name
    `,
    [sharedUsers, date]
  );

  const localResult = await pool.query(
    `
      SELECT
        dc.user_id,
        dc.count,
        u.username,
        u.first_name,
        u.last_name
      FROM daily_counts dc
      LEFT JOIN users u ON u.user_id = dc.user_id
      WHERE dc.chat_id = $1
        AND dc.date = $2
        AND dc.user_id <> ALL($3)
    `,
    [chatId, date, sharedUsers]
  );

  const rows = sharedResult.rows.concat(localResult.rows);
  rows.sort((a, b) => {
    if (b.count !== a.count) {
      return Number(b.count) - Number(a.count);
    }
    return String(a.user_id).localeCompare(String(b.user_id));
  });

  return rows;
}

async function getUserHistory(chatId, userId) {
  const isShared = await isUserSharedInChat(chatId, userId);
  if (!isShared) {
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

  const result = await pool.query(
    `
      SELECT
        dc.date,
        SUM(dc.count) AS count
      FROM daily_counts dc
      WHERE dc.user_id = $1
      GROUP BY dc.date
      ORDER BY dc.date ASC
    `,
    [userId]
  );

  return result.rows;
}

async function hasUserReached100(chatId, userId) {
  const isShared = await isUserSharedInChat(chatId, userId);
  if (!isShared) {
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

  const result = await pool.query(
    `
      SELECT 1
      FROM daily_counts
      WHERE user_id = $1
        AND count >= 100
      LIMIT 1
    `,
    [userId]
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

async function getCanonicalSharedChatId(userId) {
  const result = await pool.query(
    `
      SELECT MIN(chat_id) AS chat_id
      FROM shared_chats
      WHERE user_id = $1
    `,
    [userId]
  );

  return result.rows[0] ? result.rows[0].chat_id : null;
}

async function getSharedUserIdsByChat(chatId) {
  const result = await pool.query(
    `
      SELECT user_id
      FROM shared_chats
      WHERE chat_id = $1
    `,
    [chatId]
  );

  return result.rows.map((row) => row.user_id);
}

async function isUserSharedInChat(chatId, userId) {
  const result = await pool.query(
    `
      SELECT 1
      FROM shared_chats
      WHERE chat_id = $1 AND user_id = $2
      LIMIT 1
    `,
    [chatId, userId]
  );

  return result.rowCount > 0;
}

async function resolveWriteChatId(chatId, userId) {
  const isShared = await isUserSharedInChat(chatId, userId);
  if (!isShared) {
    return chatId;
  }
  const canonicalChatId = await getCanonicalSharedChatId(userId);
  return canonicalChatId || chatId;
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
      WITH eligible_users AS (
        SELECT DISTINCT user_id
        FROM daily_counts
        WHERE chat_id = $1
        UNION
        SELECT user_id
        FROM shared_chats
        WHERE chat_id = $1
      ),
      best_records AS (
        SELECT
          ur.user_id,
          ur.max_add,
          ur.record_date,
          ur.record_count
        FROM user_records ur
        JOIN eligible_users eu ON eu.user_id = ur.user_id
      )
      SELECT
        br.user_id,
        br.max_add,
        br.record_date,
        br.record_count,
        u.username,
        u.first_name,
        u.last_name
      FROM best_records br
      LEFT JOIN users u ON u.user_id = br.user_id
      ORDER BY br.record_count DESC, br.user_id ASC
    `,
    [chatId]
  );

  return result.rows;
}

async function getChatRecord(chatId) {
  const records = await getRecordsByChat(chatId);
  if (!records.length) {
    return [];
  }

  const maxCount = records.reduce(
    (current, row) => Math.max(current, Number(row.record_count || 0)),
    0
  );
  return records.filter((row) => Number(row.record_count || 0) === maxCount);
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

// --- API v2 / daily_adds ---

async function upsertUserV2(userId, username) {
  const now = new Date().toISOString();
  await pool.query(
    `
      INSERT INTO users (user_id, username, first_name, last_name, updated_at)
      VALUES ($1, $2, NULL, NULL, $3)
      ON CONFLICT (user_id) DO UPDATE SET
        username = EXCLUDED.username,
        updated_at = EXCLUDED.updated_at
    `,
    [userId, username ?? null, now]
  );
}

async function insertApproaches(userId, date, counts) {
  if (!counts.length) {
    return [];
  }
  const now = new Date().toISOString();
  const rows = [];
  for (const count of counts) {
    const result = await pool.query(
      `
        INSERT INTO daily_adds (user_id, date, count, created_at, migrated)
        VALUES ($1, $2, $3, $4, FALSE)
        RETURNING id, user_id, date, count, created_at
      `,
      [userId, date, count, now]
    );
    rows.push(result.rows[0]);
  }
  return rows;
}

async function getTotalForUserDateV2(userId, date) {
  const result = await pool.query(
    `
      SELECT COALESCE(SUM(count), 0) AS total
      FROM daily_adds
      WHERE user_id = $1 AND date = $2
    `,
    [userId, date]
  );
  return Number(result.rows[0]?.total ?? 0);
}

async function getApproachesByUserDate(userId, date, dateTo = null) {
  const endDate = dateTo || date;
  const result = await pool.query(
    `
      SELECT id, user_id, date, count, created_at, migrated
      FROM daily_adds
      WHERE user_id = $1 AND date >= $2 AND date <= $3
      ORDER BY created_at ASC
    `,
    [userId, date, endDate]
  );
  return result.rows;
}

async function getApproachById(id) {
  const result = await pool.query(
    `
      SELECT id, user_id, date, count, created_at, migrated
      FROM daily_adds
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function updateApproachCount(id, userId, count) {
  const result = await pool.query(
    `
      UPDATE daily_adds
      SET count = $2
      WHERE id = $1 AND user_id = $3
      RETURNING id, user_id, date, count, created_at, migrated
    `,
    [id, count, userId]
  );
  return result.rows[0] || null;
}

async function deleteApproach(id, userId) {
  const result = await pool.query(
    `
      DELETE FROM daily_adds
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `,
    [id, userId]
  );
  return result.rowCount > 0;
}

/**
 * Возвращает для каждого user_id из списка массив подходов { id, count } за дату (порядок по created_at).
 * @returns {Promise<Array<{ user_id: number, approaches: Array<{ id: number, count: number }> }>>}
 */
async function getApproachesCountsByChatAndDate(chatUserIds, date) {
  if (!chatUserIds.length) {
    return [];
  }
  const result = await pool.query(
    `
      SELECT user_id, id, count AS approach_count, created_at
      FROM daily_adds
      WHERE user_id = ANY($1::bigint[]) AND date = $2
      ORDER BY user_id, created_at ASC
    `,
    [chatUserIds, date]
  );
  const byUser = {};
  for (const uid of chatUserIds) {
    byUser[uid] = [];
  }
  for (const row of result.rows) {
    const uid = Number(row.user_id);
    if (byUser[uid]) {
      byUser[uid].push({
        id: Number(row.id),
        count: Number(row.approach_count) || 0,
      });
    }
  }
  return chatUserIds.map((uid) => ({ user_id: uid, approaches: byUser[uid] || [] }));
}

async function getStatusByDateV2(chatUserIds, date) {
  if (!chatUserIds.length) {
    return [];
  }
  const result = await pool.query(
    `
      SELECT
        u.user_id,
        COALESCE(SUM(da.count), 0)::int AS total,
        us.username
      FROM (SELECT UNNEST($1::bigint[]) AS user_id) u
      LEFT JOIN daily_adds da ON da.user_id = u.user_id AND da.date = $2
      LEFT JOIN users us ON us.user_id = u.user_id
      GROUP BY u.user_id, us.username
      ORDER BY total DESC, u.user_id ASC
    `,
    [chatUserIds, date]
  );
  const rows = result.rows.map((r) => ({ user_id: r.user_id, total: r.total, username: r.username }));
  return rows;
}

async function getRecordsByChatV2(chatUserIds) {
  if (!chatUserIds.length) {
    return [];
  }
  const result = await pool.query(
    `
      WITH day_totals AS (
        SELECT user_id, date, SUM(count) AS day_total
        FROM daily_adds
        WHERE user_id = ANY($1::bigint[]) AND migrated = FALSE
        GROUP BY user_id, date
      ),
      best_day AS (
        SELECT DISTINCT ON (user_id) user_id, date AS best_day_date, day_total AS best_day_total
        FROM day_totals
        ORDER BY user_id, day_total DESC, date DESC
      ),
      best_approach AS (
        SELECT user_id, MAX(count) AS best_approach
        FROM daily_adds
        WHERE user_id = ANY($1::bigint[]) AND migrated = FALSE
        GROUP BY user_id
      )
      SELECT
        bd.user_id,
        bd.best_day_date,
        bd.best_day_total,
        COALESCE(ba.best_approach, 0) AS best_approach,
        u.username
      FROM best_day bd
      LEFT JOIN best_approach ba ON ba.user_id = bd.user_id
      LEFT JOIN users u ON u.user_id = bd.user_id
      ORDER BY bd.best_day_total DESC, ba.best_approach DESC NULLS LAST, bd.user_id ASC
    `,
    [chatUserIds]
  );
  return result.rows;
}

async function getHistoryByUserIdV2(userId) {
  const result = await pool.query(
    `
      SELECT date, SUM(count) AS total
      FROM daily_adds
      WHERE user_id = $1
      GROUP BY date
      ORDER BY date ASC
    `,
    [userId]
  );
  return result.rows;
}

function getDisplayNameV2(row) {
  if (row.username) {
    return row.username;
  }
  return `User ${row.user_id}`;
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
  getCanonicalSharedChatId,
  getSharedUserIdsByChat,
  isUserSharedInChat,
  resolveWriteChatId,
  getUserById,
  getRecordsByChat,
  getChatRecord,
  getTotalCountForUserDate,
  setCountForUserDate,
  getBestRecordForUser,
  syncUserRecord,
  createApiToken,
  getChatIdByToken,
  getApiTokenByChat,
  upsertUser,
  // v2 / daily_adds
  upsertUserV2,
  insertApproaches,
  getTotalForUserDateV2,
  getApproachesByUserDate,
  getApproachById,
  updateApproachCount,
  deleteApproach,
  getApproachesCountsByChatAndDate,
  getStatusByDateV2,
  getRecordsByChatV2,
  getHistoryByUserIdV2,
  getDisplayNameV2,
};
