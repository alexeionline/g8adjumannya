require('dotenv').config();

const express = require('express');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const {
  addCount,
  getRecordsByChat,
  getStatusByDate,
  getUserHistory,
  initDb,
  upsertUser,
} = require('../db');

dayjs.extend(customParseFormat);

const app = express();
app.use(express.json());

function loadTokenMap() {
  if (process.env.API_TOKENS_JSON) {
    const parsed = JSON.parse(process.env.API_TOKENS_JSON);
    const map = new Map();
    Object.entries(parsed).forEach(([token, chats]) => {
      map.set(token, Array.isArray(chats) ? chats.map(Number) : []);
    });
    return map;
  }

  if (process.env.API_TOKEN && process.env.API_CHAT_ID) {
    return new Map([[process.env.API_TOKEN, [Number(process.env.API_CHAT_ID)]]]);
  }

  throw new Error('API auth config missing (API_TOKENS_JSON or API_TOKEN+API_CHAT_ID).');
}

const tokenMap = loadTokenMap();

function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = match[1];
  const allowedChats = tokenMap.get(token);
  if (!allowedChats) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.allowedChats = allowedChats;
  return next();
}

function parseChatId(req) {
  const raw = req.body.chat_id ?? req.query.chat_id;
  const chatId = Number(raw);
  return Number.isFinite(chatId) ? chatId : null;
}

function requireChatAccess(req, res, next) {
  const chatId = parseChatId(req);
  if (!chatId) {
    return res.status(400).json({ error: 'chat_id is required' });
  }

  if (!req.allowedChats.includes(chatId)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  req.chatId = chatId;
  return next();
}

app.use(authMiddleware);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/add', requireChatAccess, async (req, res) => {
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

  if (req.body.user && req.body.user.id === userId) {
    await upsertUser(req.body.user);
  }

  const total = await addCount({
    chatId: req.chatId,
    userId,
    date: date.format('YYYY-MM-DD'),
    delta,
  });

  res.json({ total });
});

app.get('/status', requireChatAccess, async (req, res) => {
  const date = req.query.date
    ? dayjs(req.query.date, 'YYYY-MM-DD', true)
    : dayjs();
  if (!date.isValid()) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const rows = await getStatusByDate(req.chatId, date.format('YYYY-MM-DD'));
  res.json({ date: date.format('YYYY-MM-DD'), rows });
});

app.get('/records', requireChatAccess, async (req, res) => {
  const rows = await getRecordsByChat(req.chatId);
  res.json({ rows });
});

app.get('/history', requireChatAccess, async (req, res) => {
  const userId = Number(req.query.user_id);
  if (!Number.isFinite(userId)) {
    return res.status(400).json({ error: 'user_id is required' });
  }

  const rows = await getUserHistory(req.chatId, userId);
  const days = rows.reduce((acc, row) => {
    acc[row.date] = row.count;
    return acc;
  }, {});

  res.json({ user_id: userId, chat_id: req.chatId, days });
});

const port = Number(process.env.API_PORT || 3000);

initDb()
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start API:', error);
    process.exit(1);
  });
