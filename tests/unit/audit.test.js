const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = path.join(os.tmpdir(), `aurex-audit-test-${Date.now()}`);

before(async () => {
  process.env.DATA_DIR = tmpDir;
  process.env.JWT_SECRET = 'audit-test-secret';
  const db = require('../../server/db');
  await db.init();
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

test('hashAuditRecord is deterministic', () => {
  const audit = require('../../server/db/audit');
  const record = {
    sequence_num: 1,
    action: 'ADMIN_DEPOSIT',
    admin_id: 1,
    target_user_id: 2,
    transaction_id: 3,
    payload_json: '{"amount":100}',
    prev_hash: audit.GENESIS_HASH,
    created_at: '2026-01-01T00:00:00.000Z',
  };
  const h1 = audit.hashAuditRecord(record);
  const h2 = audit.hashAuditRecord(record);
  assert.equal(h1, h2);
  assert.match(h1, /^[a-f0-9]{64}$/);
});

test('appendAuditLog builds a valid chain', () => {
  const audit = require('../../server/db/audit');
  audit.insertAuditLogRecord({
    action: 'ADMIN_DEPOSIT',
    adminId: 1,
    targetUserId: 2,
    payload: { amount: 50 },
  });
  audit.insertAuditLogRecord({
    action: 'ADMIN_WITHDRAW',
    adminId: 1,
    targetUserId: 2,
    payload: { amount: 10 },
  });

  const summary = audit.verifyAuditChain();
  assert.equal(summary.valid, true);
  assert.equal(summary.count, 2);

  const detailed = audit.verifyAuditChainDetailed();
  assert.equal(detailed.valid, true);
  assert.equal(detailed.records.length, 2);
  assert.equal(detailed.records[0].prev_ok, true);
  assert.equal(detailed.records[1].prev_hash, detailed.records[0].record_hash);
});

test('tampered record_hash fails verification', () => {
  const { prepare } = require('../../server/db/connection');
  const audit = require('../../server/db/audit');

  audit.insertAuditLogRecord({
    action: 'ADMIN_RESET',
    adminId: 1,
    payload: { note: 'test' },
  });

  prepare('UPDATE admin_audit_logs SET record_hash = ? WHERE sequence_num = 1').run('deadbeef');
  const result = audit.verifyAuditChain();
  assert.equal(result.valid, false);
  assert.ok(result.brokenAt);
});
