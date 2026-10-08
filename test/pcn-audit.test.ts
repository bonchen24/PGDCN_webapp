import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnActivityLog, buildPcnAuditActor } from '../utils/pcnAudit.ts';

const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('PCN audit records carry a PCN entity, actor snapshot and diff', () => {
  const log = buildPcnActivityLog({
    id: 'activity-pcn-1',
    action: 'STATUS_CHANGED',
    entityType: 'PCN_DOSSIER',
    entityId: 'dossier-1',
    entityLabel: 'HS-2026-001',
    summary: 'Chuyển hồ sơ sang chờ KQTN',
    actor: { username: 'pcn-admin', name: 'Quản trị PCN', role: 'admin' },
    changes: [{ field: 'status', before: 'SENT_TO_LAB', after: 'AWAITING_RESULTS' }],
  });
  assert.equal(log.entityType, 'PCN_DOSSIER');
  assert.equal(log.actorUsername, 'pcn-admin');
  assert.equal(log.source, 'UI');
  assert.equal(log.changes?.[0].field, 'status');
});

test('PCN store writes audit records alongside business mutations', () => {
  assert.match(storeSource, /activityLogs/);
  assert.match(storeSource, /createPcnIntake|updatePcnDossier|createPcnCustomer/);
  assert.doesNotMatch(storeSource, /saveDoc\('activityLogs'/);
});

test('PCN audit actor preserves the signed-in user snapshot', () => {
  assert.deepEqual(buildPcnAuditActor({
    username: 'pcn-reviewer',
    name: 'Chuyên gia PCN',
    role: 'tester',
    position: 'Chuyên gia thẩm xét',
  }), {
    username: 'pcn-reviewer',
    name: 'Chuyên gia PCN',
    role: 'tester',
    position: 'Chuyên gia thẩm xét',
  });
  assert.match(storeSource, /usePcnSessionStore\.getState\(\)\.currentUser/);
  assert.doesNotMatch(storeSource, /actor: \{ name: 'Người dùng PCN' \}/);
});

test('PCN activity logs are append-only at the database API boundary', () => {
  assert.match(serverSource, /"PCN_DOSSIER"/);
  assert.match(serverSource, /collectionName === ["']activityLogs["']/);
  assert.match(serverSource, /ON CONFLICT \(collection_name, document_id\)\s+DO NOTHING/);
  assert.match(serverSource, /Activity log PCN là append-only/);
});

// --- End of pcn-audit.test.ts ---
