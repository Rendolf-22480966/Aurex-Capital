require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const db = require('./db');

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const publicDir = path.join(__dirname, '..', 'public');
const indexHtml = path.join(publicDir, 'index.html');
const adminHtml = path.join(publicDir, 'admin.html');

const app = express();
let apiReady = false;

app.set('trust proxy', 1);
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(publicDir, {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-store');
    }
  },
}));

app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'aurex-capital', apiReady });
});

function sendApp(req, res, next) {
  res.sendFile(indexHtml, (err) => {
    if (err) next(err);
  });
}

function sendAdmin(req, res, next) {
  res.sendFile(adminHtml, (err) => {
    if (err) next(err);
  });
}

app.use((req, res, next) => {
  if (req.path.startsWith('/api') && !apiReady) {
    return res.status(503).json({
      error: 'Server is starting up — please retry in a few seconds',
      retryAfter: 3,
    });
  }
  next();
});

app.get('/admin', sendAdmin);
app.get('/', sendApp);
app.get(/^\/(?!api(?:\/|$)|admin(?:\/|$)).*/, sendApp);

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

(async () => {
  try {
    await db.init();
    const { router: apiRouter } = require('./routes/api');
    app.use('/api', apiRouter);
    apiReady = true;
    console.log('API ready');

    const coingecko = require('./coingecko');
    coingecko.warmMarketCache();
  } catch (err) {
    console.error('Startup failed:', err);
    process.exit(1);
  }
})();

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});
