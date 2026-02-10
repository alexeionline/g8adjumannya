require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const jwt = require('jsonwebtoken');
const path = require('path');
const dayjs = require('dayjs');
const { Telegram } = require('telegraf');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const {
  addCount,
  getChatIdByToken,
  getUserById,
  getApproachesCountsByChatAndDate,
  getChatMeta,
  getSharedChatsByUser,
  getSharedUserIdsByChat,
  getApproachById,
  getApproachesByUserDate,
  getDisplayNameV2,
  getHistoryByUserIdV2,
  getRecordsByChatV2,
  getStatusByDateV2,
  getTotalForUserDateV2,
  initDb,
  insertApproaches,
  isUserSharedInChat,
  deleteApproach,
  updateApproachCount,
  upsertUser,
  upsertChatMeta,
  upsertUserV2,
} = require('../db');
const { formatAddHeader, formatDisplayName } = require('../utils/format');

const JWT_SECRET = process.env.JWT_SECRET || process.env.BOT_TOKEN || 'fallback-change-me';
const JWT_EXPIRES_IN = '30d';
const INIT_DATA_MAX_AGE_SEC = 24 * 60 * 60; // 24 hours
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

dayjs.extend(customParseFormat);
const telegram = process.env.BOT_TOKEN ? new Telegram(process.env.BOT_TOKEN) : null;
const CHAT_META_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function normalizeUser(userId, user) {
  if (!user) {
    return { user_id: userId };
  }
  return {
    user_id: user.id || user.user_id || userId,
    username: user.username || null,
    first_name: user.first_name || null,
    last_name: user.last_name || null,
  };
}

function notifyAddInChat(chatId, user, delta, total) {
  if (!telegram) {
    return;
  }
  const name = formatDisplayName(user);
  const header = formatAddHeader(name);
  const message = `${header} +${delta} / Всего: ${total}`;
  telegram.sendMessage(chatId, message).catch(() => {});
}

async function resolveChatTitle(chatId) {
  const fallback = `Chat ${chatId}`;
  const cached = await getChatMeta(chatId).catch(() => null);
  const cachedTitle = cached?.title || null;
  const isFresh = cached?.updated_at
    ? Date.now() - new Date(cached.updated_at).getTime() < CHAT_META_TTL_MS
    : false;

  if (cachedTitle && isFresh) {
    return cachedTitle;
  }

  if (!telegram) {
    return cachedTitle || fallback;
  }

  try {
    const chat = await telegram.getChat(chatId);
    const title = chat?.title || chat?.username || cachedTitle || fallback;
    await upsertChatMeta(chatId, title).catch(() => {});
    return title;
  } catch {
    return cachedTitle || fallback;
  }
}

async function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const token = match[1];
    const chatId = await getChatIdByToken(token);
    if (!chatId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    req.chatId = chatId;
    return next();
  } catch (error) {
    console.error('Auth error:', error);
    return res.status(500).json({ error: 'Auth error' });
  }
}

/**
 * Validates Telegram WebApp initData per https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 * @param {string} initData - raw query string from Telegram WebApp
 * @param {string} botToken - BOT_TOKEN
 * @returns {{ user: { id: number, username?: string } }}
 */
function validateTelegramInitData(initData, botToken) {
  if (!initData || typeof initData !== 'string' || !botToken) {
    throw new Error('Invalid init data or bot token');
  }
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    throw new Error('Missing hash');
  }
  const authDate = params.get('auth_date');
  if (!authDate) {
    throw new Error('Missing auth_date');
  }
  const authTs = parseInt(authDate, 10);
  if (Number.isNaN(authTs) || Date.now() / 1000 - authTs > INIT_DATA_MAX_AGE_SEC) {
    throw new Error('auth_date expired or invalid');
  }
  const dataCheckArr = [];
  params.forEach((value, key) => {
    if (key !== 'hash') {
      dataCheckArr.push(`${key}=${value}`);
    }
  });
  dataCheckArr.sort();
  const dataCheckString = dataCheckArr.join('\n');
  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const computedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const expectedHash = String(hash).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
    throw new Error('Invalid hash format');
  }
  const provided = Buffer.from(expectedHash, 'hex');
  const computed = Buffer.from(computedHash, 'hex');
  if (provided.length !== computed.length || !crypto.timingSafeEqual(provided, computed)) {
    throw new Error('Invalid signature');
  }
  const userStr = params.get('user');
  if (!userStr) {
    throw new Error('Missing user');
  }
  let user;
  try {
    user = JSON.parse(userStr);
  } catch {
    throw new Error('Invalid user payload');
  }
  const parsedUserId = Number(user?.id);
  if (!Number.isFinite(parsedUserId)) {
    throw new Error('Invalid user id');
  }
  return {
    user: {
      id: parsedUserId,
      username: user.username || null,
    },
  };
}

function parseRequiredChatId(rawChatId) {
  if (rawChatId == null || rawChatId === '') {
    return { error: 'chat_id is required' };
  }
  const value = Number(rawChatId);
  if (!Number.isFinite(value)) {
    return { error: 'chat_id must be a number' };
  }
  return { value };
}

function authV2Middleware(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const payload = jwt.verify(match[1], JWT_SECRET);
    if (payload.user_id == null) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.userId = Number(payload.user_id);
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

function asyncRoute(handler) {
  return (req, res, next) => {
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createRateLimiter({ windowMs, max, keyFn }) {
  const buckets = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = String(keyFn(req) || req.ip || 'global');
    const bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= max) {
      const retryAfterSec = Math.ceil((bucket.resetAt - now) / 1000);
      res.set('Retry-After', String(Math.max(1, retryAfterSec)));
      return res.status(429).json({ error: 'Too many requests' });
    }
    bucket.count += 1;
    return next();
  };
}

function createApiApp() {
  const app = express();
  app.use(express.json());

  const distPath = path.join(__dirname, '../../web/dist');
  app.use(express.static(distPath));

  app.get('/health', (req, res) => {
    res.json({ ok: true });
  });

  app.post('/add', authMiddleware, async (req, res) => {
  const userId = Number(req.body.user_id);
  const delta = Number(req.body.delta);
  if (!Number.isFinite(userId) || !Number.isFinite(delta) || delta < 0) {
    return res.status(400).json({ error: 'user_id and delta are required' });
  }

  const date = req.body.date
    ? dayjs(req.body.date, 'YYYY-MM-DD', true)
    : dayjs();
  if (!date.isValid()) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  let normalizedUser = normalizeUser(userId, req.body.user);
  if (req.body.user && req.body.user.id === userId) {
    await upsertUser(req.body.user);
  }

  if (!normalizedUser.username && !normalizedUser.first_name && !normalizedUser.last_name) {
    const storedUser = await getUserById(userId);
    if (storedUser) {
      normalizedUser = storedUser;
    }
  }

  await addCount({
    chatId: req.chatId,
    userId,
    date: date.format('YYYY-MM-DD'),
    delta,
  });
  const dateStr = date.format('YYYY-MM-DD');
  const total = await getTotalForUserDateV2(userId, dateStr);

  notifyAddInChat(req.chatId, normalizedUser, delta, total);
  res.json({ total });
  });

  app.get('/status', authMiddleware, async (req, res) => {
    try {
      const date = req.query.date
        ? dayjs(req.query.date, 'YYYY-MM-DD', true)
        : dayjs();
      if (!date.isValid()) {
        return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
      }
      const dateStr = date.format('YYYY-MM-DD');
      const chatUserIds = await getSharedUserIdsByChat(req.chatId);
      const statusRows = await getStatusByDateV2(chatUserIds, dateStr);
      const approachesByUser = await getApproachesCountsByChatAndDate(chatUserIds, dateStr);
      const approachesMap = Object.fromEntries(approachesByUser.map((a) => [a.user_id, a.approaches]));
      const allRows = statusRows.map((r) => {
        const approaches = approachesMap[r.user_id] || [];
        const countFromApproaches = approaches.reduce((s, a) => s + (Number(a.count) || 0), 0);
        return {
          user_id: r.user_id,
          username: r.username ?? null,
          first_name: null,
          count: countFromApproaches,
          approaches,
        };
      });
      const rows = allRows.filter((r) => r.count > 0);
      return res.json({ date: dateStr, rows });
    } catch (err) {
      console.error('GET /status error:', err.message || err);
      return res.status(500).json({ error: 'Failed to load status', detail: err.message || String(err) });
    }
  });

  app.patch('/approaches/:id', authMiddleware, async (req, res) => {
    const id = Number(req.params.id);
    const userId = Number(req.body?.user_id);
    const count = Number(req.body?.count);
    if (!Number.isFinite(id) || !Number.isFinite(userId)) {
      return res.status(400).json({ error: 'id and user_id required' });
    }
    if (!Number.isFinite(count) || count < 1 || count > 1000) {
      return res.status(400).json({ error: 'count must be between 1 and 1000' });
    }
    const approach = await getApproachById(id);
    if (!approach) return res.status(404).json({ error: 'approach not found' });
    const ownerId = Number(approach.user_id);
    const chatUserIds = await getSharedUserIdsByChat(req.chatId);
    const chatUserIdsNum = chatUserIds.map((uid) => Number(uid));
    if (!chatUserIdsNum.includes(ownerId)) {
      return res.status(403).json({ error: 'no access to this approach' });
    }
    if (ownerId !== userId) {
      return res.status(403).json({ error: 'user_id does not own this approach' });
    }
    const updated = await updateApproachCount(id, userId, count);
    const total = await getTotalForUserDateV2(userId, updated.date);
    return res.json({ approach: { id: updated.id, user_id: updated.user_id, date: updated.date, count: updated.count }, total });
  });

  app.delete('/approaches/:id', authMiddleware, async (req, res) => {
    const id = Number(req.params.id);
    const userId = Number(req.body?.user_id ?? req.query.user_id);
    if (!Number.isFinite(id) || !Number.isFinite(userId)) {
      return res.status(400).json({ error: 'id and user_id required' });
    }
    const approach = await getApproachById(id);
    if (!approach) return res.status(404).json({ error: 'approach not found' });
    const ownerId = Number(approach.user_id);
    const chatUserIds = await getSharedUserIdsByChat(req.chatId);
    const chatUserIdsNum = chatUserIds.map((uid) => Number(uid));
    if (!chatUserIdsNum.includes(ownerId)) {
      return res.status(403).json({ error: 'no access to this approach' });
    }
    if (ownerId !== userId) {
      return res.status(403).json({ error: 'user_id does not own this approach' });
    }
    await deleteApproach(id, userId);
    const total = await getTotalForUserDateV2(userId, approach.date);
    return res.json({ total });
  });

  app.get('/records', authMiddleware, async (req, res) => {
    const chatUserIds = await getSharedUserIdsByChat(req.chatId);
    const rows = await getRecordsByChatV2(chatUserIds);
    const mapped = rows.map((r) => ({
      user_id: r.user_id,
      username: r.username ?? null,
      first_name: null,
      max_add: r.best_approach,
      record_date: r.best_day_date,
    }));
    res.json({ rows: mapped });
  });

  app.get('/history', authMiddleware, async (req, res) => {
  const userId = Number(req.query.user_id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const chatUserIds = await getSharedUserIdsByChat(req.chatId);
  const chatUserIdsNum = chatUserIds.map((uid) => Number(uid));
  if (!chatUserIdsNum.includes(userId)) {
    return res.status(403).json({ error: 'no access to this user' });
  }

  const rows = await getHistoryByUserIdV2(userId);
  const days = rows.reduce((acc, row) => {
    const key = dayjs(row.date).format('YYYY-MM-DD');
    acc[key] = Number(row.total ?? row.count ?? 0);
    return acc;
  }, {});

    res.json({ user_id: userId, chat_id: req.chatId, days });
  });

  app.get('/approaches', authMiddleware, async (req, res) => {
    const userId = Number(req.query.user_id);
    if (!Number.isFinite(userId)) {
      return res.status(400).json({ error: 'user_id is required' });
    }

    const chatUserIds = await getSharedUserIdsByChat(req.chatId);
    const chatUserIdsNum = chatUserIds.map((uid) => Number(uid));
    if (!chatUserIdsNum.includes(userId)) {
      return res.status(403).json({ error: 'no access to this user' });
    }

    const dateStr = req.query.date;
    if (!dateStr) {
      return res.status(400).json({ error: 'date is required' });
    }
    const date = dayjs(dateStr, 'YYYY-MM-DD', true);
    if (!date.isValid()) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }

    const dateToStr = req.query.date_to;
    let dateTo = null;
    if (dateToStr) {
      dateTo = dayjs(dateToStr, 'YYYY-MM-DD', true);
      if (!dateTo.isValid()) {
        return res.status(400).json({ error: 'date_to must be YYYY-MM-DD' });
      }
      if (dateTo.isBefore(date)) {
        return res.status(400).json({ error: 'date_to must be >= date' });
      }
      if (dateTo.diff(date, 'day') > 365) {
        return res.status(400).json({ error: 'date range must not exceed 365 days' });
      }
      dateTo = dateTo.format('YYYY-MM-DD');
    }

    const list = await getApproachesByUserDate(userId, date.format('YYYY-MM-DD'), dateTo);
    return res.json(
      list.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        date: a.date,
        count: a.count,
        created_at: a.created_at,
        migrated: a.migrated,
      }))
    );
  });

  // v1 compatibility: token is chat-bound, so return current chat only.
  app.get('/chats', authMiddleware, async (req, res) => {
    const title = await resolveChatTitle(req.chatId);
    return res.json({
      rows: [{ chat_id: req.chatId, title }],
    });
  });

  // --- API v2 (JWT, user_id, daily_adds) ---
  const v2 = express.Router();
  const authLimiter = createRateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 20,
    keyFn: (req) => `auth:${req.ip || 'unknown'}`,
  });
  const addLimiter = createRateLimiter({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: 60,
    keyFn: (req) => `add:${req.userId ?? req.ip ?? 'unknown'}`,
  });

  v2.post('/auth', authLimiter, asyncRoute(async (req, res) => {
    const initData = req.body?.init_data;
    if (!initData || typeof initData !== 'string') {
      return res.status(400).json({ error: 'init_data is required' });
    }
    const botToken = process.env.BOT_TOKEN;
    if (!botToken) {
      return res.status(500).json({ error: 'Auth not configured' });
    }
    try {
      const { user } = validateTelegramInitData(initData, botToken);
      const userId = user.id;
      const username = user.username ?? null;
      await upsertUserV2(userId, username);
      const token = jwt.sign({ user_id: userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
      return res.status(200).json({ token, user_id: userId });
    } catch (err) {
      console.error('v2 auth error:', err.message);
      return res.status(401).json({ error: 'Invalid init data' });
    }
  }));

  v2.post('/add', authV2Middleware, addLimiter, asyncRoute(async (req, res) => {
    const userId = req.userId;
    const date = req.body.date
      ? dayjs(req.body.date, 'YYYY-MM-DD', true)
      : dayjs();
    if (!date.isValid()) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const dateStr = date.format('YYYY-MM-DD');
    if (dateStr > dayjs().format('YYYY-MM-DD')) {
      return res.status(400).json({ error: 'date cannot be in the future' });
    }
    let counts = [];
    if (Array.isArray(req.body.counts) && req.body.counts.length > 0) {
      counts = req.body.counts.map((c) => Number(c)).filter((c) => Number.isFinite(c) && c >= 1 && c <= 1000);
      if (counts.length !== req.body.counts.length) {
        return res.status(400).json({ error: 'each count must be between 1 and 1000' });
      }
      if (counts.length > 100) {
        return res.status(400).json({ error: 'at most 100 approaches per request' });
      }
    } else if (req.body.count != null && Number.isFinite(Number(req.body.count))) {
      const c = Number(req.body.count);
      if (c < 1 || c > 1000) {
        return res.status(400).json({ error: 'count must be between 1 and 1000' });
      }
      counts = [c];
    } else {
      return res.status(400).json({ error: 'specify count or non-empty counts' });
    }
    const approaches = await insertApproaches(userId, dateStr, counts);
    const total = await getTotalForUserDateV2(userId, dateStr);
    return res.status(201).json({
      approaches: approaches.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        date: a.date,
        count: a.count,
        created_at: a.created_at,
      })),
      total,
    });
  }));

  v2.get('/status', authV2Middleware, asyncRoute(async (req, res) => {
    const parsedChatId = parseRequiredChatId(req.query.chat_id);
    if (parsedChatId.error) {
      return res.status(400).json({ error: parsedChatId.error });
    }
    const chatIdNum = parsedChatId.value;
    const inChat = await isUserSharedInChat(chatIdNum, req.userId);
    if (!inChat) {
      return res.status(403).json({ error: 'no access to this chat' });
    }
    const date = req.query.date
      ? dayjs(req.query.date, 'YYYY-MM-DD', true)
      : dayjs();
    if (!date.isValid()) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const chatUserIds = await getSharedUserIdsByChat(chatIdNum);
    const dateStr = date.format('YYYY-MM-DD');
    const statusRows = await getStatusByDateV2(chatUserIds, dateStr);
    const approachesByUser = await getApproachesCountsByChatAndDate(chatUserIds, dateStr);
    const approachesMap = Object.fromEntries(approachesByUser.map((a) => [a.user_id, a.approaches]));
    const rows = statusRows
      .map((r) => {
        const approaches = approachesMap[r.user_id] || [];
        const total = approaches.reduce((s, a) => s + (Number(a.count) || 0), 0);
        return { user_id: r.user_id, username: r.username, total };
      })
      .filter((r) => r.total > 0);
    const withDisplay = rows.map((r) => ({
      user_id: r.user_id,
      display_name: getDisplayNameV2(r),
      total: r.total,
    }));
    return res.json({ date: dateStr, rows: withDisplay });
  }));

  v2.get('/records', authV2Middleware, asyncRoute(async (req, res) => {
    const parsedChatId = parseRequiredChatId(req.query.chat_id);
    if (parsedChatId.error) {
      return res.status(400).json({ error: parsedChatId.error });
    }
    const chatIdNum = parsedChatId.value;
    const inChat = await isUserSharedInChat(chatIdNum, req.userId);
    if (!inChat) {
      return res.status(403).json({ error: 'no access to this chat' });
    }
    const chatUserIds = await getSharedUserIdsByChat(chatIdNum);
    const rows = await getRecordsByChatV2(chatUserIds);
    const withDisplay = rows.map((r) => ({
      user_id: r.user_id,
      display_name: getDisplayNameV2(r),
      best_approach: r.best_approach,
      best_day_total: r.best_day_total,
      best_day_date: r.best_day_date,
    }));
    return res.json({ rows: withDisplay });
  }));

  v2.get('/chats', authV2Middleware, asyncRoute(async (req, res) => {
    const chatIds = await getSharedChatsByUser(req.userId);
    const rows = await Promise.all(chatIds.map(async (chatId) => ({
      chat_id: chatId,
      title: await resolveChatTitle(chatId),
    })));
    return res.json({ rows });
  }));

  v2.get('/history', authV2Middleware, asyncRoute(async (req, res) => {
    const requestedUserId = req.query.user_id != null ? Number(req.query.user_id) : req.userId;
    if (!Number.isFinite(requestedUserId)) {
      return res.status(400).json({ error: 'user_id must be a number' });
    }
    if (requestedUserId !== req.userId) {
      return res.status(403).json({ error: 'access denied' });
    }
    const rows = await getHistoryByUserIdV2(requestedUserId);
    const days = {};
    for (const row of rows) {
      const key = dayjs(row.date).format('YYYY-MM-DD');
      days[key] = Number(row.total);
    }
    return res.json({ user_id: requestedUserId, days });
  }));

  v2.get('/approaches', authV2Middleware, asyncRoute(async (req, res) => {
    const dateStr = req.query.date;
    if (!dateStr) {
      return res.status(400).json({ error: 'date is required' });
    }
    const date = dayjs(dateStr, 'YYYY-MM-DD', true);
    if (!date.isValid()) {
      return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
    }
    const dateToStr = req.query.date_to;
    let dateTo = null;
    if (dateToStr) {
      dateTo = dayjs(dateToStr, 'YYYY-MM-DD', true);
      if (!dateTo.isValid()) {
        return res.status(400).json({ error: 'date_to must be YYYY-MM-DD' });
      }
      if (dateTo.isBefore(date)) {
        return res.status(400).json({ error: 'date_to must be >= date' });
      }
      if (dateTo.diff(date, 'day') > 365) {
        return res.status(400).json({ error: 'date range must not exceed 365 days' });
      }
      dateTo = dateTo.format('YYYY-MM-DD');
    }
    const list = await getApproachesByUserDate(req.userId, date.format('YYYY-MM-DD'), dateTo);
    return res.json(
      list.map((a) => ({
        id: a.id,
        user_id: a.user_id,
        date: a.date,
        count: a.count,
        created_at: a.created_at,
        migrated: a.migrated,
      }))
    );
  }));

  v2.patch('/approaches/:id', authV2Middleware, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'invalid id' });
    }
    const count = Number(req.body?.count);
    if (!Number.isFinite(count) || count < 1 || count > 1000) {
      return res.status(400).json({ error: 'count must be between 1 and 1000' });
    }
    const approach = await getApproachById(id);
    if (!approach) {
      return res.status(404).json({ error: 'approach not found' });
    }
    if (Number(approach.user_id) !== req.userId) {
      return res.status(403).json({ error: 'access denied' });
    }
    const updated = await updateApproachCount(id, req.userId, count);
    const total = await getTotalForUserDateV2(req.userId, updated.date);
    return res.json({
      approach: {
        id: updated.id,
        user_id: updated.user_id,
        date: updated.date,
        count: updated.count,
        created_at: updated.created_at,
      },
      total,
    });
  }));

  v2.delete('/approaches/:id', authV2Middleware, asyncRoute(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'invalid id' });
    }
    const approach = await getApproachById(id);
    if (!approach) {
      return res.status(404).json({ error: 'approach not found' });
    }
    if (Number(approach.user_id) !== req.userId) {
      return res.status(403).json({ error: 'access denied' });
    }
    await deleteApproach(id, req.userId);
    const total = await getTotalForUserDateV2(req.userId, approach.date);
    return res.json({ total });
  }));

  app.use('/api/v2', v2);

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }
    console.error('API error:', err?.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  });

  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });

  return app;
}

async function startApi() {
  await initDb();
  const app = createApiApp();
  const port = Number(process.env.PORT || process.env.API_PORT || 3000);
  app.listen(port, () => {
    console.log(`API listening on ${port}`);
  });
}

if (require.main === module) {
  startApi().catch((error) => {
    console.error('Failed to start API:', error);
    process.exit(1);
  });
}

module.exports = { createApiApp, startApi };
