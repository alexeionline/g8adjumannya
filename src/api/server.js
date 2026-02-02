require('dotenv').config();

const express = require('express');
const path = require('path');
const dayjs = require('dayjs');
const { Telegram } = require('telegraf');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const {
  addCount,
  getChatIdByToken,
  getRecordsByChat,
  getStatusByDate,
  getUserHistory,
  getUserById,
  initDb,
  upsertUser,
} = require('../db');
const { formatAddHeader, formatDisplayName } = require('../utils/format');

dayjs.extend(customParseFormat);
const telegram = process.env.BOT_TOKEN ? new Telegram(process.env.BOT_TOKEN) : null;

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

  const total = await addCount({
    chatId: req.chatId,
    userId,
    date: date.format('YYYY-MM-DD'),
    delta,
  });

  notifyAddInChat(req.chatId, normalizedUser, delta, total);
  res.json({ total });
  });

  app.get('/status', authMiddleware, async (req, res) => {
  const date = req.query.date
    ? dayjs(req.query.date, 'YYYY-MM-DD', true)
    : dayjs();
  if (!date.isValid()) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const rows = await getStatusByDate(req.chatId, date.format('YYYY-MM-DD'));
    res.json({ date: date.format('YYYY-MM-DD'), rows });
  });

  app.get('/records', authMiddleware, async (req, res) => {
    const rows = await getRecordsByChat(req.chatId);
    res.json({ rows });
  });

  app.get('/history', authMiddleware, async (req, res) => {
  const userId = Number(req.query.user_id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const rows = await getUserHistory(req.chatId, userId);
  const days = rows.reduce((acc, row) => {
    const key = dayjs(row.date).format('YYYY-MM-DD');
    acc[key] = row.count;
    return acc;
  }, {});

    res.json({ user_id: userId, chat_id: req.chatId, days });
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
