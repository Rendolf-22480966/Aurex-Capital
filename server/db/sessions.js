const crypto = require('crypto');
const { prepare } = require('./connection');

const SESSION_DAYS = 7;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId, { ip = null, userAgent = null } = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000).toISOString();

  prepare(
    `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?)`
  ).run(userId, tokenHash, expiresAt, ip, userAgent);

  return { token, expiresAt };
}

function findSessionByToken(token) {
  if (!token) return null;
  const tokenHash = hashToken(token);
  const row = prepare(
    `SELECT s.*, u.id AS uid, u.role, u.status, u.email, u.username
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND datetime(s.expires_at) > datetime('now')
     LIMIT 1`
  ).get(tokenHash);
  return row || null;
}

function deleteSessionByToken(token) {
  if (!token) return;
  prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
}

function deleteSessionsForUser(userId) {
  prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

module.exports = {
  SESSION_DAYS,
  createSession,
  findSessionByToken,
  deleteSessionByToken,
  deleteSessionsForUser,
  hashToken,
};
