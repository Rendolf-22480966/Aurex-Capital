# Aurex Capital — Live CoinGecko Dashboard

Paper trading platform with a **live cryptocurrency market terminal** powered by the [CoinGecko API](https://www.coingecko.com/en/api).

## Quick start

```bash
git clone https://github.com/Rendolf-22480966/Aurex-Capital.git
cd Aurex-Capital
npm install
npm start
```

Open **http://localhost:3000**

## Deploy (live demo for lecturer / portfolio)

### Why Netlify showed "Page not found"

Aurex Capital is **not a static website**. It needs:

- **Node.js server** (Express) for `/api/*` routes
- **CoinGecko API proxy** (API key stays on server)
- **SQLite** for paper trading accounts

Netlify’s default hosting only serves static files (`HTML/CSS/JS`). It **cannot** run your Express backend, so you get a broken site or Netlify’s 404 page.

### Recommended: Railway (easiest — works on your phone)

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.com/new/template?template=https://github.com/Rendolf-22480966/Aurex-Capital)

**Or manual setup:**

1. Go to **[railway.com/new/github](https://railway.com/new/github)** → sign in with GitHub
2. Select repo **`Rendolf-22480966/Aurex-Capital`**
3. Click the service → **Variables** → add only these two:
   - `JWT_SECRET` = `aurex-capital-rendolf-2026-secret`
   - `COINGECKO_API_KEY` = your CoinGecko demo key
4. **Settings → Networking → Generate Domain**
5. Open your URL on your phone — login: `admin` / `admin123`

No volume setup needed for testing (database uses `/tmp` automatically on Railway).

**Verify:** `https://YOUR-URL/health` → `{"ok":true,"service":"aurex-capital"}`

### Alternative: Render (free, works with this project)

**Important:** You must use **Web Service**, not **Static Site**. A Static Site cannot run Node/Express and will always show 404 or a blank page.

1. Push your code to **GitHub**
2. Go to [render.com](https://render.com) → **New → Web Service** (not Static Site)
3. Connect repo: `Rendolf-22480966/Aurex-Capital`
4. Settings:
   - **Root directory:** leave blank
   - **Runtime:** Node
   - **Build command:** `npm install && npm rebuild better-sqlite3 --build-from-source`
   - **Start command:** `npm start`
   - **Publish directory:** leave empty
5. **Environment variables** (Render dashboard → Environment):
   - `COINGECKO_API_KEY` = your CoinGecko Demo key
   - `JWT_SECRET` = any long random string (e.g. 32+ chars)
   - `DATA_DIR` = `/tmp/aurex-data` (optional; SQLite storage on Render)
6. Deploy → open `https://your-app.onrender.com`

**Verify it works:** open `https://your-app.onrender.com/health` — you should see `{"ok":true,"service":"aurex-capital"}`.

Or use the included `render.yaml` for Blueprint deploy (**New → Blueprint** → connect repo).

#### If you still see 404 or timeout

| Symptom | Fix |
|---------|-----|
| **404 Not Found** on `/` and `/health` | You likely created a **Static Site**. Delete it and create a **Web Service** instead. |
| **Request timed out** (60–120s) | Deploy failed or app crashed on start. Open Render → **Logs** and look for `better-sqlite3` or `EADDRINUSE` errors. |
| **502 Bad Gateway** | Server starting — wait 30s on free tier (cold start), then refresh. |
| Build fails on `better-sqlite3` | Set build command to `npm install && npm rebuild better-sqlite3 --build-from-source` |

### Netlify (not recommended for this app)

Netlify static deploy will **not** run live CoinGecko data or paper trading. If you only need a static preview of the UI, set **Publish directory** to `public` — but **Overview/Markets will not load real data** without a backend.

Use **Render** or **Railway** instead for the full dashboard.

### Vercel

Same limitation as Netlify for Express + SQLite — use Render unless you refactor to serverless functions.

## Environment variables

Create a `.env` file in the project root (copy from `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `COINGECKO_API_KEY` | Recommended | Free Demo key from [coingecko.com/api](https://www.coingecko.com/en/api) |
| `JWT_SECRET` | Recommended | Random string for auth tokens |
| `PORT` | Optional | Server port (default `3000`) |
| `COINGECKO_API_BASE` | Optional | Default `https://api.coingecko.com/api/v3` |

**Never commit `.env` to GitHub.** The API key stays server-side only.

## CoinGecko endpoints used

| Endpoint | Purpose |
|----------|---------|
| `GET /coins/markets` | Market table, gainers, losers, watchlist |
| `GET /global` | Global market overview stats |
| `GET /search/trending` | Trending coins |
| `GET /coins/{id}` | Individual coin detail page |
| `GET /coins/{id}/market_chart` | Price charts (1D–MAX) |
| `GET /search` | Global coin search |
| `GET /simple/price` | Paper trade & portfolio pricing |

## Deploy (Render / Railway / Vercel)

- **Render / Railway:** Deploy as Node web service. Set env vars in dashboard. Start command: `npm start`.
- **Vercel:** Requires serverless API routes refactor; **Render or Railway recommended** for this Express app.

## API plan limitations (Demo / Free)

- Rate limits apply (~10–30 calls/min without key, higher with Demo key)
- Server caches responses (60s–5min) and queues requests to avoid 429 errors
- CoinGecko WebSocket requires a paid plan — architecture uses REST polling at safe intervals
- Historical `max` chart range may be limited on Demo plan (365 days)

## Demo accounts

| Role | Username | Password |
|------|----------|----------|
| Admin | admin | admin123 |

Register any username for $10,000 virtual USD paper trading.

## License

MIT
