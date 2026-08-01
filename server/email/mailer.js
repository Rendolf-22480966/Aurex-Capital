function getAppUrl() {
  return (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
}

function isDevPreviewEnabled() {
  return process.env.NODE_ENV !== 'production' || process.env.EMAIL_DEV_PREVIEW === 'true';
}

function logEmail({ to, subject, link }) {
  console.log(`[Aurex Email] To: ${to}`);
  console.log(`[Aurex Email] Subject: ${subject}`);
  console.log(`[Aurex Email] Link: ${link}`);
}

async function sendVerificationEmail(user, token) {
  const link = `${getAppUrl()}/?verify=${encodeURIComponent(token)}`;
  logEmail({
    to: user.email,
    subject: 'Verify your Aurex Capital email',
    link,
  });
  return { sent: true, previewUrl: isDevPreviewEnabled() ? link : undefined };
}

async function sendPasswordResetEmail(user, token) {
  const link = `${getAppUrl()}/?reset=${encodeURIComponent(token)}`;
  logEmail({
    to: user.email,
    subject: 'Reset your Aurex Capital password',
    link,
  });
  return { sent: true, previewUrl: isDevPreviewEnabled() ? link : undefined };
}

module.exports = {
  getAppUrl,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
