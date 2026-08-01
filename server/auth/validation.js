const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function validateRegistration({ firstName, lastName, email, password, confirmPassword }) {
  const errors = [];
  const first = String(firstName || '').trim();
  const last = String(lastName || '').trim();
  const mail = normalizeEmail(email);
  const pass = String(password || '');
  const confirm = String(confirmPassword || '');

  if (first.length < 2) errors.push('First name must be at least 2 characters');
  if (last.length < 2) errors.push('Last name must be at least 2 characters');
  if (!EMAIL_RE.test(mail)) errors.push('A valid email address is required');
  if (pass.length < 8) errors.push('Password must be at least 8 characters');
  if (pass !== confirm) errors.push('Passwords do not match');

  return {
    errors,
    data: { firstName: first, lastName: last, email: mail, password: pass },
  };
}

function validateLogin({ email, password }) {
  const errors = [];
  const identifier = String(email || '').trim();
  const pass = String(password || '');

  if (!identifier) errors.push('Email is required');
  if (!pass) errors.push('Password is required');

  return { errors, data: { email: identifier, password: pass } };
}

function validateForgotPassword({ email }) {
  const errors = [];
  const mail = normalizeEmail(email);
  if (!EMAIL_RE.test(mail)) errors.push('A valid email address is required');
  return { errors, data: { email: mail } };
}

function validateResetPassword({ token, password, confirmPassword }) {
  const errors = [];
  const pass = String(password || '');
  const confirm = String(confirmPassword || '');
  const rawToken = String(token || '').trim();

  if (!rawToken) errors.push('Reset token is required');
  if (pass.length < 8) errors.push('Password must be at least 8 characters');
  if (pass !== confirm) errors.push('Passwords do not match');

  return { errors, data: { token: rawToken, password: pass } };
}

module.exports = {
  validateRegistration,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  normalizeEmail,
  EMAIL_RE,
};
