const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SESSION_COOKIE = 'aurex_session';

function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const idx = part.indexOf('=');
        if (idx === -1) return [part, ''];
        return [part.slice(0, idx), decodeURIComponent(part.slice(idx + 1))];
      })
  );
}

function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);

  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE] || null;
}

function setSessionCookie(res, token) {
  const maxAge = db.SESSION_DAYS * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function authMiddleware(req, res, next) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  const session = db.findSessionByToken(token);
  if (session) {
    if (session.status === 'suspended') {
      return res.status(403).json({ error: 'Account is suspended' });
    }
    if (session.status === 'deleted') {
      return res.status(403).json({ error: 'Account is no longer available' });
    }
    req.user = { id: session.user_id, username: session.username, email: session.email, role: session.role };
    req.sessionToken = token;
    return next();
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.findUserById(payload.id);
    if (!user) return res.status(401).json({ error: 'Invalid or expired token' });
    if (user.status === 'suspended') return res.status(403).json({ error: 'Account is suspended' });
    if (user.status === 'deleted') return res.status(403).json({ error: 'Account is no longer available' });
    req.user = { id: user.id, username: user.username, email: user.email, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function adminMiddleware(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    username: user.username,
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    role: user.role,
    status: user.status,
    email_verified: !!user.email_verified_at,
    balance_usd: user.balance_usd,
    created_at: user.created_at,
  };
}

function issueAuthResponse(res, user, req) {
  const session = db.createSession(user.id, {
    ip: req.ip,
    userAgent: req.headers['user-agent'],
  });
  setSessionCookie(res, session.token);

  return { token: session.token, user: publicUser(user) };
}

module.exports = {
  SESSION_COOKIE,
  authMiddleware,
  adminMiddleware,
  publicUser,
  issueAuthResponse,
  setSessionCookie,
  clearSessionCookie,
  extractToken,
};
