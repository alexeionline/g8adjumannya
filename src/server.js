require('dotenv').config();

const { initDb } = require('./db');
const { createApiApp } = require('./api/server');
const { startBot } = require('./index');

async function start() {
  await initDb();

  const app = createApiApp();
  const port = Number(process.env.PORT || process.env.API_PORT || 3000);
  app.listen(port, () => {
    console.log(`Server listening on ${port}`);
  });

  await startBot({ skipInitDb: true });
}

start().catch((error) => {
  console.error('Не удалось запустить сервис:', error);
  process.exit(1);
});
