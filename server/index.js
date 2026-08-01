require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, '..', 'public');
const indexHtml = path.join(publicDir, 'index.html');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aurex-capital' });
});

function sendApp(req, res, next) {
  res.sendFile(indexHtml, (err) => {
    if (err) next(err);
  });
}

async function start() {
  await db.init();
  const { router: apiRouter } = require('./routes/api');
  app.use('/api', apiRouter);

  app.get('/', sendApp);
  app.get(/^\/(?!api(?:\/|$)).*/, sendApp);

  app.use((err, req, res, next) => {
    console.error(err);
    if (res.headersSent) return next(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  const server = app.listen(PORT, HOST, () => {
    console.log(`Aurex Capital running on ${HOST}:${PORT}`);
    console.log('Live market data powered by CoinGecko API');
  });

  server.on('error', (err) => {
    console.error('Server failed to start:', err);
    process.exit(1);
  });
}

start().catch((err) => {
  console.error('Startup failed:', err);
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
