const { prepare, transaction } = require('./connection');
const { insertAuditLogRecord } = require('./audit');

const TYPE_LABELS = {
  deposit: 'Deposit',
  withdrawal: 'Withdrawal',
  received: 'Received',
  sent: 'Sent',
  buy: 'Buy',
  sell: 'Sell',
};

function formatTransactionForUser(row) {
  if (!row) return null;
  const isTrade = row.type === 'buy' || row.type === 'sell';
  return {
    id: row.public_id,
    type: row.type,
    label: TYPE_LABELS[row.type] || row.type,
    amount: row.amount,
    currency: row.currency,
    asset_symbol: row.asset_symbol,
    asset_name: row.asset_name,
    coin_id: row.coin_id,
    coin_symbol: row.asset_symbol || (isTrade ? row.currency : null),
    coin_name: row.asset_name,
    side: isTrade ? row.type : null,
    amount_coin: isTrade ? row.amount : null,
    price_usd: row.price_usd,
    total_usd: row.total_usd ?? (row.currency === 'USD' ? row.amount : null),
    status: row.status,
    description: row.description,
    created_at: row.created_at,
  };
}

function getUserLedger(userId, limit = 100) {
  const rows = prepare(
    `SELECT public_id, type, amount, currency, asset_symbol, asset_name, coin_id,
            price_usd, total_usd, status, description, created_at
     FROM transactions
     WHERE user_id = ?
     ORDER BY created_at DESC
     LIMIT ?`
  ).all(userId, limit);
  return rows.map(formatTransactionForUser);
}

function adminDepositFunds({ adminId, userId, amount, note }) {
  const value = Number(amount);
  if (!value || value <= 0) throw new Error('Amount must be greater than zero');

  return transaction(() => {
    const portfolio = prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId);
    if (!portfolio) throw new Error('User portfolio not found');

    prepare(
      `UPDATE portfolios SET cash_balance_usd = cash_balance_usd + ?, updated_at = datetime('now') WHERE id = ?`
    ).run(value, portfolio.id);

    const description = String(note || '').trim() || 'Funds added to your account';
    const txn = insertLedgerTransaction({
      userId,
      portfolioId: portfolio.id,
      type: 'deposit',
      amount: value,
      currency: 'USD',
      totalUsd: value,
      description,
      source: 'admin',
      adminId,
    });

    insertAuditLogRecord({
      action: 'ADMIN_DEPOSIT',
      adminId,
      targetUserId: userId,
      transactionId: txn.id,
      payload: { amount: value, description },
    });

    return txn;
  });
}

function adminWithdrawFunds({ adminId, userId, amount, note }) {
  const value = Number(amount);
  if (!value || value <= 0) throw new Error('Amount must be greater than zero');

  return transaction(() => {
    const portfolio = prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId);
    if (!portfolio) throw new Error('User portfolio not found');
    if (portfolio.cash_balance_usd < value) throw new Error('Insufficient user balance');

    prepare(
      `UPDATE portfolios SET cash_balance_usd = cash_balance_usd - ?, updated_at = datetime('now') WHERE id = ?`
    ).run(value, portfolio.id);

    const description = String(note || '').trim() || 'Funds withdrawn from your account';
    const txn = insertLedgerTransaction({
      userId,
      portfolioId: portfolio.id,
      type: 'withdrawal',
      amount: value,
      currency: 'USD',
      totalUsd: value,
      description,
      source: 'admin',
      adminId,
    });

    insertAuditLogRecord({
      action: 'ADMIN_WITHDRAW',
      adminId,
      targetUserId: userId,
      transactionId: txn.id,
      payload: { amount: value, description },
    });

    return txn;
  });
}

function adminCreditCrypto({
  adminId,
  userId,
  coinId,
  coinSymbol,
  coinName,
  quantity,
  priceUsd = 0,
  note,
}) {
  const qty = Number(quantity);
  if (!coinId || !qty || qty <= 0) throw new Error('Valid coin and quantity required');

  const symbol = String(coinSymbol || coinId).toUpperCase();
  const name = coinName || coinId;
  const price = Number(priceUsd) || 0;

  return transaction(() => {
    const portfolio = prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId);
    if (!portfolio) throw new Error('User portfolio not found');

    const holding = prepare(
      'SELECT * FROM holdings WHERE portfolio_id = ? AND coin_id = ?'
    ).get(portfolio.id, coinId);

    if (holding) {
      const newQty = holding.quantity + qty;
      const newAvg =
        price > 0
          ? (holding.quantity * holding.avg_cost_usd + qty * price) / newQty
          : holding.avg_cost_usd;
      prepare(
        'UPDATE holdings SET quantity = ?, avg_cost_usd = ?, updated_at = datetime(\'now\') WHERE id = ?'
      ).run(newQty, newAvg, holding.id);
    } else {
      prepare(
        `INSERT INTO holdings (portfolio_id, coin_id, coin_symbol, coin_name, quantity, avg_cost_usd)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(portfolio.id, coinId, symbol, name, qty, price);
    }

    const totalUsd = price > 0 ? qty * price : null;
    const description = String(note || '').trim() || `Received ${name}`;
    const txn = insertLedgerTransaction({
      userId,
      portfolioId: portfolio.id,
      type: 'received',
      amount: qty,
      currency: symbol,
      assetSymbol: symbol,
      assetName: name,
      coinId,
      priceUsd: price || null,
      totalUsd,
      description,
      source: 'admin',
      adminId,
    });

    insertAuditLogRecord({
      action: 'ADMIN_CREDIT_CRYPTO',
      adminId,
      targetUserId: userId,
      transactionId: txn.id,
      payload: { coinId, coinSymbol: symbol, coinName: name, quantity: qty, priceUsd: price, description },
    });

    return txn;
  });
}

function adminResetAccount({ adminId, userId, amount = 10000 }) {
  return transaction(() => {
    const portfolio = prepare('SELECT * FROM portfolios WHERE user_id = ?').get(userId);
    if (!portfolio) throw new Error('User portfolio not found');

    prepare(
      'UPDATE portfolios SET cash_balance_usd = ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(amount, portfolio.id);
    prepare('DELETE FROM holdings WHERE portfolio_id = ?').run(portfolio.id);
    prepare('DELETE FROM transactions WHERE user_id = ?').run(userId);

    const txn = insertLedgerTransaction({
      userId,
      portfolioId: portfolio.id,
      type: 'deposit',
      amount,
      currency: 'USD',
      totalUsd: amount,
      description: 'Account reset — starting balance restored',
      source: 'admin',
      adminId,
    });

    insertAuditLogRecord({
      action: 'ADMIN_RESET_ACCOUNT',
      adminId,
      targetUserId: userId,
      transactionId: txn.id,
      payload: { amount },
    });

    return txn;
  });
}

function insertLedgerTransaction({
  userId,
  portfolioId,
  type,
  amount,
  currency = 'USD',
  assetSymbol = null,
  assetName = null,
  coinId = null,
  priceUsd = null,
  totalUsd = null,
  description,
  source = 'user',
  adminId = null,
}) {
  const publicId = `TXN-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  const result = prepare(
    `INSERT INTO transactions
     (public_id, user_id, portfolio_id, type, amount, currency, asset_symbol, asset_name,
      coin_id, price_usd, total_usd, status, description, source, admin_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?)`
  ).run(
    publicId,
    userId,
    portfolioId,
    type,
    amount,
    currency,
    assetSymbol,
    assetName,
    coinId,
    priceUsd,
    totalUsd,
    description,
    source,
    adminId
  );
  return { id: result.lastInsertRowid, public_id: publicId };
}

module.exports = {
  TYPE_LABELS,
  formatTransactionForUser,
  getUserLedger,
  adminDepositFunds,
  adminWithdrawFunds,
  adminCreditCrypto,
  adminResetAccount,
  insertLedgerTransaction,
};
