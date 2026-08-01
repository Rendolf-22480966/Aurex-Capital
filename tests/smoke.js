const assert = require('node:assert/strict');

const BASE = (process.env.TEST_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

async function main() {
  console.log(`Smoke testing ${BASE}\n`);

  let r = await request('/health');
  if (!r.res.ok || !r.data.ok) fail('/health should return ok:true');
  pass('/health');

  r = await request('/api/health');
  if (!r.res.ok || !r.data.version) fail('/api/health should return version');
  pass(`/api/health v${r.data.version}`);

  const features = r.data.features || [];
  for (const f of ['server_watchlist', 'rate_limiting', 'audit_chain_verify']) {
    if (!features.includes(f)) fail(`missing feature: ${f}`);
  }
  pass('feature flags present');

  r = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'admin@aurex.capital', password: 'admin123' }),
  });
  if (!r.res.ok || !r.data.token) fail('admin login failed');
  pass('admin login');
  const token = r.data.token;
  const auth = { Authorization: `Bearer ${token}` };

  r = await request('/api/watchlist', { headers: auth });
  if (!r.res.ok || !Array.isArray(r.data.coin_ids)) fail('GET /watchlist failed');
  pass('GET /watchlist');

  r = await request('/api/watchlist/toggle', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ coinId: 'bitcoin' }),
  });
  if (!r.res.ok || typeof r.data.watchlisted !== 'boolean') fail('POST /watchlist/toggle failed');
  pass('POST /watchlist/toggle');

  r = await request('/api/admin/audit/verify', { headers: auth });
  if (!r.res.ok || typeof r.data.valid !== 'boolean') fail('GET /admin/audit/verify failed');
  pass(`audit chain valid=${r.data.valid} (${r.data.count} records)`);

  r = await request('/api/market/global');
  if (!r.res.ok) fail('GET /market/global failed');
  if (!r.res.headers.get('x-ratelimit-limit')) fail('rate limit headers missing');
  pass('GET /market/global + rate-limit headers');

  r = await request('/api/dashboard/user', { headers: auth });
  if (!r.res.ok || !r.data.summary) fail('GET /dashboard/user failed');
  pass('GET /dashboard/user');

  console.log('\nAll smoke tests passed.');
}

main().catch((err) => {
  console.error('\nSmoke test error:', err.message);
  console.error('Make sure the server is running: npm start');
  process.exit(1);
});
