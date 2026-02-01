require('dotenv').config();

const express = require('express');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
const {
  addCount,
  getChatIdByToken,
  getRecordsByChat,
  getStatusByDate,
  getUserHistory,
  initDb,
  upsertUser,
} = require('../db');

dayjs.extend(customParseFormat);

const app = express();
app.use(express.json());

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

app.use(authMiddleware);

app.get('/health', (req, res) => {
  res.json({ ok: true });
});

app.post('/add', async (req, res) => {
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

app.get('/status', async (req, res) => {
  const date = req.query.date
    ? dayjs(req.query.date, 'YYYY-MM-DD', true)
    : dayjs();
  if (!date.isValid()) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }

  const rows = await getStatusByDate(req.chatId, date.format('YYYY-MM-DD'));
  res.json({ date: date.format('YYYY-MM-DD'), rows });
});

app.get('/records', async (req, res) => {
  const rows = await getRecordsByChat(req.chatId);
  res.json({ rows });
});

app.get('/history', async (req, res) => {
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
