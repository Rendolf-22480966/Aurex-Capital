const crypto = require('crypto');
const { prepare, persist } = require('./connection');

const VERIFY_HOURS = 24;
const RESET_HOURS = 1;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createEmailToken(userId, type) {
  const token = generateToken();
  const hours = type === 'verify' ? VERIFY_HOURS : RESET_HOURS;
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  prepare(
    `UPDATE email_tokens SET used_at = datetime('now')
     WHERE user_id = ? AND type = ? AND used_at IS NULL`
  ).run(userId, type);

  prepare(
    `INSERT INTO email_tokens (user_id, token_hash, type, expires_at)
     VALUES (?, ?, ?, ?)`
  ).run(userId, hashToken(token), type, expiresAt);

  return { token, expiresAt };
}

function findValidToken(token, type) {
  if (!token) return null;
  return (
    prepare(
      `SELECT et.*, u.email, u.first_name, u.last_name, u.email_verified_at
       FROM email_tokens et
       JOIN users u ON u.id = et.user_id
       WHERE et.token_hash = ? AND et.type = ?
         AND et.used_at IS NULL
         AND datetime(et.expires_at) > datetime('now')
       LIMIT 1`
    ).get(hashToken(token), type) || null
  );
}

function consumeToken(token, type) {
  const row = findValidToken(token, type);
  if (!row) return null;
  prepare(`UPDATE email_tokens SET used_at = datetime('now') WHERE id = ?`).run(row.id);
  persist();
  return row;
}

module.exports = {
  VERIFY_HOURS,
  RESET_HOURS,
  createEmailToken,
  findValidToken,
  consumeToken,
  hashToken,
};
