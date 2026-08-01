const crypto = require('crypto');
const { prepare, transaction } = require('./connection');

const GENESIS_HASH = 'GENESIS';

function hashAuditRecord(record) {
  const payload = [
    record.sequence_num,
    record.action,
    record.admin_id,
    record.target_user_id ?? '',
    record.transaction_id ?? '',
    record.payload_json,
    record.prev_hash,
    record.created_at,
  ].join('|');
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function getLastAuditRecord() {
  return prepare(
    'SELECT * FROM admin_audit_logs ORDER BY sequence_num DESC LIMIT 1'
  ).get();
}

function insertAuditLogRecord({ action, adminId, targetUserId = null, transactionId = null, payload = {} }) {
  const last = getLastAuditRecord();
  const sequenceNum = last ? last.sequence_num + 1 : 1;
  const prevHash = last ? last.record_hash : GENESIS_HASH;
  const createdAt = new Date().toISOString();
  const payloadJson = JSON.stringify(payload);

  const record = {
    sequence_num: sequenceNum,
    action,
    admin_id: adminId,
    target_user_id: targetUserId,
    transaction_id: transactionId,
    payload_json: payloadJson,
    prev_hash: prevHash,
    created_at: createdAt,
  };
  record.record_hash = hashAuditRecord(record);

  prepare(
    `INSERT INTO admin_audit_logs
     (sequence_num, action, admin_id, target_user_id, transaction_id, payload_json, prev_hash, record_hash, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    record.sequence_num,
    record.action,
    record.admin_id,
    record.target_user_id,
    record.transaction_id,
    record.payload_json,
    record.prev_hash,
    record.record_hash,
    record.created_at
  );

  return { ...record, id: record.sequence_num };
}

function appendAuditLog(params) {
  return transaction(() => insertAuditLogRecord(params));
}

function verifyAuditChain() {
  const report = verifyAuditChainDetailed();
  return {
    valid: report.valid,
    count: report.count,
    brokenAt: report.brokenAt,
    message: report.message,
  };
}

function verifyAuditChainDetailed() {
  const logs = prepare('SELECT * FROM admin_audit_logs ORDER BY sequence_num ASC').all();
  if (!logs.length) {
    return {
      valid: true,
      count: 0,
      message: 'No audit records yet',
      genesis: GENESIS_HASH,
      records: [],
    };
  }

  let expectedPrev = GENESIS_HASH;
  const records = [];
  let brokenAt = null;
  let failureMessage = null;

  for (const log of logs) {
    const prevOk = log.prev_hash === expectedPrev;
    const expectedHash = hashAuditRecord(log);
    const hashOk = log.record_hash === expectedHash;
    const valid = prevOk && hashOk;

    records.push({
      sequence_num: log.sequence_num,
      action: log.action,
      prev_hash: log.prev_hash,
      record_hash: log.record_hash,
      expected_hash: expectedHash,
      prev_ok: prevOk,
      hash_ok: hashOk,
      valid,
      created_at: log.created_at,
    });

    if (!valid && !brokenAt) {
      brokenAt = log.sequence_num;
      failureMessage = !prevOk
        ? `Chain broken at sequence ${log.sequence_num}: prev_hash mismatch`
        : `Tamper detected at sequence ${log.sequence_num}: record_hash invalid`;
    }

    expectedPrev = log.record_hash;
  }

  const valid = !brokenAt;
  return {
    valid,
    count: logs.length,
    brokenAt,
    message: valid ? 'Audit chain integrity verified' : failureMessage,
    genesis: GENESIS_HASH,
    head_hash: logs[logs.length - 1].record_hash,
    records,
  };
}

function getAuditLogBySequence(sequenceNum) {
  return prepare(
    `SELECT a.*,
            admin_u.email AS admin_email,
            admin_u.first_name AS admin_first_name,
            admin_u.last_name AS admin_last_name,
            target_u.email AS target_email,
            target_u.first_name AS target_first_name,
            target_u.last_name AS target_last_name
     FROM admin_audit_logs a
     LEFT JOIN users admin_u ON admin_u.id = a.admin_id
     LEFT JOIN users target_u ON target_u.id = a.target_user_id
     WHERE a.sequence_num = ?`
  ).get(sequenceNum);
}

function getAuditActionSummary() {
  return prepare(
    `SELECT action, COUNT(*) AS count
     FROM admin_audit_logs
     GROUP BY action
     ORDER BY count DESC`
  ).all();
}

function getAuditLogs(limit = 100, action = null) {
  if (action) {
    return prepare(
      `SELECT a.*,
              admin_u.email AS admin_email,
              target_u.email AS target_email
       FROM admin_audit_logs a
       LEFT JOIN users admin_u ON admin_u.id = a.admin_id
       LEFT JOIN users target_u ON target_u.id = a.target_user_id
       WHERE a.action = ?
       ORDER BY a.sequence_num DESC
       LIMIT ?`
    ).all(action, limit);
  }
  return prepare(
    `SELECT a.*,
            admin_u.email AS admin_email,
            target_u.email AS target_email
     FROM admin_audit_logs a
     LEFT JOIN users admin_u ON admin_u.id = a.admin_id
     LEFT JOIN users target_u ON target_u.id = a.target_user_id
     ORDER BY a.sequence_num DESC
     LIMIT ?`
  ).all(limit);
}

module.exports = {
  GENESIS_HASH,
  appendAuditLog,
  insertAuditLogRecord,
  verifyAuditChain,
  verifyAuditChainDetailed,
  getAuditLogs,
  getAuditLogBySequence,
  getAuditActionSummary,
  hashAuditRecord,
};
