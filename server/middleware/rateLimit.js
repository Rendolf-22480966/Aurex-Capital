const buckets = new Map();

function clientKey(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
}

function createRateLimiter({ windowMs, max, name = 'default' }) {
  return (req, res, next) => {
    const key = `${name}:${clientKey(req)}`;
    const now = Date.now();
    let bucket = buckets.get(key);

    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfter));
      return res.status(429).json({
        error: 'Too many requests — please slow down',
        retryAfter,
      });
    }

    next();
  };
}

const authLimiter = createRateLimiter({
  name: 'auth',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_AUTH_MAX) || 20,
});

const marketLimiter = createRateLimiter({
  name: 'market',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MARKET_MAX) || 90,
});

const apiLimiter = createRateLimiter({
  name: 'api',
  windowMs: 60 * 1000,
  max: Number(process.env.RATE_LIMIT_API_MAX) || 180,
});

module.exports = {
  createRateLimiter,
  authLimiter,
  marketLimiter,
  apiLimiter,
};
