const db = require('../db');
const mailer = require('../email/mailer');

async function sendVerificationForUser(userId) {
  const user = db.findUserById(userId);
  if (!user || user.email_verified_at) return null;

  const { token } = db.createEmailToken(userId, 'verify');
  return mailer.sendVerificationEmail(user, token);
}

async function sendPasswordResetForEmail(email) {
  const user = db.findUserByEmail(email);
  if (!user || user.status === 'suspended') {
    return { sent: true, previewUrl: undefined };
  }

  const { token } = db.createEmailToken(user.id, 'reset');
  db.deleteSessionsForUser(user.id);
  const result = await mailer.sendPasswordResetEmail(user, token);
  return result;
}

module.exports = {
  sendVerificationForUser,
  sendPasswordResetForEmail,
};
