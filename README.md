# Aurex Capital — Live Crypto Paper Trading Platform

Level 400 cryptography / end-of-school project. Paper trading with **live CoinGecko market data**, user dashboards, dual ledger, hash-chained admin audit log, and a separate admin console.

**GitHub:** [Rendolf-22480966/Aurex-Capital](https://github.com/Rendolf-22480966/Aurex-Capital)

## Quick start

```bash
git clone https://github.com/Rendolf-22480966/Aurex-Capital.git
cd Aurex-Capital
npm install
cp .env.example .env   # optional — edit JWT_SECRET / COINGECKO_API_KEY
npm start
```

| URL | Purpose |
|-----|---------|
| http://localhost:3000 | User platform (markets, trading, dashboard) |
| http://localhost:3000/admin | Admin console (separate UI) |
| http://localhost:3000/api/health | API version + feature flags |

## Features

- **Live market terminal** — CoinGecko REST proxy (no mock data)
- **Paper trading** — $10,000 virtual USD, buy/sell at live prices
- **User dashboard** — portfolio allocation, holdings, activity feed
- **Auth** — registration, sessions, email verification, password reset
- **Dual ledger** — user / admin / system transaction sources
- **Server watchlist** — synced per account (guests use localStorage)
- **Admin console** — user management, suspend/activate/delete, fund operations
- **Audit log** — SHA-256 hash-chained tamper-evident admin actions + verify tool
- **Rate limiting** — protects auth and market API routes

## Demo accounts

| Role | Email | Password | URL |
|------|-------|----------|-----|
| Admin | `admin@aurex.capital` | `admin123` | `/admin` |
| User | Register any email | your choice | `/` |

## Testing

```bash
# Unit tests (audit chain, watchlist — no server needed)
npm test

# Smoke tests (server must be running on PORT 3000)
npm start          # terminal 1
npm run test:smoke # terminal 2

# Smoke against deployed URL
TEST_BASE_URL=https://your-app.onrender.com npm run test:smoke
```

### Lecturer demo checklist

1. **Markets** — live prices load, search works, coin detail + chart opens
2. **Register / login** — new account gets $10,000 virtual balance
3. **Trade** — buy BTC, see holding + activity update
4. **Watchlist** — star coins while logged in, refresh — persists
5. **Dashboard** — allocation bar, recent activity
6. **Admin** (`/admin`) — login, deposit funds to a user, check audit log
7. **Verify Chain** — Audit Log → Verify Chain → green integrity report
8. **Health** — `/api/health` shows `version: 3.8.0`

## Environment variables

Copy `.env.example` → `.env`. **Never commit `.env`.**

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Recommended | Random string for session tokens |
| `COINGECKO_API_KEY` | Recommended | Demo key from [coingecko.com/api](https://www.coingecko.com/en/api) |
| `PORT` | Optional | Default `3000` |
| `APP_URL` | Optional | Base URL for email links |
| `DATA_DIR` | Optional | SQLite file location (auto `/tmp` on Render/Railway) |
| `COINGECKO_API_BASE` | Optional | Default CoinGecko v3 URL |
| `RATE_LIMIT_*_MAX` | Optional | Auth / market / API rate limits |

## Deploy

> **This is a Node.js app, not a static site.** Netlify / GitHub Pages cannot run the backend. Use **Railway** or **Render**.

### Railway (recommended — easy phone demo)

1. [railway.com/new/github](https://railway.com/new/github) → connect **`Rendolf-22480966/Aurex-Capital`**
2. **Variables:**
   - `JWT_SECRET` = long random string
   - `COINGECKO_API_KEY` = your CoinGecko demo key
3. **Settings → Networking → Generate Domain**
4. Verify: `https://YOUR-URL/health` → `{"ok":true,"service":"aurex-capital"}`
5. Verify API: `https://YOUR-URL/api/health` → version + features

Database uses `/tmp/aurex-data` automatically on Railway (no volume required for demos).

### Render (free tier)

Use **Web Service**, not Static Site. Or deploy via included `render.yaml` (Blueprint).

1. [render.com](https://render.com) → **New → Web Service**
2. Connect repo, settings:
   - **Build command:** `npm install`
   - **Start command:** `npm start`
   - **Health check path:** `/health`
3. Environment variables:
   - `JWT_SECRET`, `COINGECKO_API_KEY`
   - `DATA_DIR=/tmp/aurex-data` (recommended on free tier)
4. After deploy: `npm run test:smoke` with `TEST_BASE_URL` set to your Render URL

### Post-deploy verification

```bash
curl https://YOUR-URL/api/health
curl https://YOUR-URL/health
TEST_BASE_URL=https://YOUR-URL npm run test:smoke
```

### Troubleshooting

| Symptom | Fix |
|---------|-----|
| 404 on `/` | Created Static Site instead of Web Service — recreate as Node Web Service |
| 502 / cold start | Wait 30–60s on free tier, then refresh |
| CoinGecko 429 | Add `COINGECKO_API_KEY`; server caches + rate-limits client requests |
| Data lost after redeploy | Free tier `/tmp` is ephemeral — use `DATA_DIR` on a persistent volume for production |
| Admin login fails | Use `admin@aurex.capital` / `admin123` at `/admin` |

## Architecture

```
Browser (public/)  →  Express (/api/*)  →  CoinGecko API
                     ↓
                  sql.js SQLite (users, trades, audit chain, watchlists)
```

- **Frontend:** Vanilla HTML/CSS/JS SPA
- **Backend:** Node.js + Express
- **Database:** sql.js (pure JS SQLite — no native build step)
- **Admin UI:** Separate `admin.html` at `/admin`

## CoinGecko endpoints proxied

| Endpoint | Purpose |
|----------|---------|
| `GET /coins/markets` | Markets, gainers, losers, watchlist |
| `GET /global` | Global stats |
| `GET /search/trending` | Trending |
| `GET /coins/{id}` | Coin detail |
| `GET /coins/{id}/market_chart` | Charts |
| `GET /search` | Search |
| `GET /simple/price` | Trade pricing |

## License

MIT
