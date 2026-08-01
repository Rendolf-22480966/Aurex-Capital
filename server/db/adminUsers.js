const { prepare, transaction } = require('./connection');
const { insertAuditLogRecord } = require('./audit');
const { deleteSessionsForUser } = require('./sessions');
const { findUserById } = require('./repository');

function getManageableUser(userId, adminId) {
  const user = findUserById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  if (user.role === 'admin') {
    const err = new Error('Cannot modify admin accounts');
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (userId === adminId) {
    const err = new Error('Cannot modify your own account');
    err.code = 'FORBIDDEN';
    throw err;
  }
  return user;
}

function setUserStatus(userId, status) {
  prepare(
    `UPDATE users SET status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(status, userId);
}

function suspendUser({ adminId, userId, reason = '' }) {
  const user = getManageableUser(userId, adminId);
  if (user.status === 'suspended') throw new Error('Account is already suspended');
  if (user.status === 'deleted') throw new Error('Cannot suspend a deleted account');

  return transaction(() => {
    setUserStatus(userId, 'suspended');
    deleteSessionsForUser(userId);
    insertAuditLogRecord({
      action: 'ADMIN_SUSPEND_USER',
      adminId,
      targetUserId: userId,
      payload: { reason: reason || 'Account suspended by administrator' },
    });
    return findUserById(userId);
  });
}

function activateUser({ adminId, userId }) {
  const user = getManageableUser(userId, adminId);
  if (user.status === 'active') throw new Error('Account is already active');
  if (user.status === 'deleted') throw new Error('Cannot activate a deleted account');

  return transaction(() => {
    setUserStatus(userId, 'active');
    insertAuditLogRecord({
      action: 'ADMIN_ACTIVATE_USER',
      adminId,
      targetUserId: userId,
      payload: { previous_status: user.status },
    });
    return findUserById(userId);
  });
}

function deleteUser({ adminId, userId, reason = '' }) {
  const user = getManageableUser(userId, adminId);
  if (user.status === 'deleted') throw new Error('Account is already deleted');

  return transaction(() => {
    setUserStatus(userId, 'deleted');
    deleteSessionsForUser(userId);
    insertAuditLogRecord({
      action: 'ADMIN_DELETE_USER',
      adminId,
      targetUserId: userId,
      payload: { reason: reason || 'Account deleted by administrator', email: user.email },
    });
    return findUserById(userId);
  });
}

function getUserAdminDetail(userId) {
  const user = findUserById(userId);
  if (!user) return null;

  const holdings = prepare(
    `SELECT coin_id, coin_symbol, coin_name, quantity, avg_cost_usd
     FROM holdings h
     JOIN portfolios p ON p.id = h.portfolio_id
     WHERE p.user_id = ? AND h.quantity > 0
     ORDER BY coin_symbol`
  ).all(userId);

  const stats = prepare(
    `SELECT
      COUNT(*) AS total_transactions,
      COUNT(CASE WHEN type IN ('buy','sell') THEN 1 END) AS trade_count,
      COUNT(CASE WHEN type = 'deposit' THEN 1 END) AS deposit_count
     FROM transactions WHERE user_id = ?`
  ).get(userId);

  const recent = prepare(
    `SELECT public_id, type, amount, currency, description, created_at
     FROM transactions WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 5`
  ).all(userId);

  return { user, holdings, stats, recent_transactions: recent };
}

module.exports = {
  suspendUser,
  activateUser,
  deleteUser,
  getUserAdminDetail,
  getManageableUser,
};
