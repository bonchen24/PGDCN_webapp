import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildBackupActivity, getBackupActivityPayload } from '../utils/backupManager.ts';

const managerSource = fs.readFileSync(new URL('../utils/backupManager.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('backup create and delete activity records preserve action, archive and actor', () => {
  const created = buildBackupActivity('CREATED', 'pcn_certification_manual_20260829-080000.zip', {
    username: 'pcn-admin',
    name: 'Admin PCN',
    role: 'admin',
  }, '2026-08-29T02:00:00.000Z');
  const deleted = buildBackupActivity('DELETED', created.entityLabel || '', {
    username: 'pcn-admin',
    name: 'Admin PCN',
    role: 'admin',
  }, '2026-08-29T03:00:00.000Z');

  assert.equal(created.action, 'CREATED');
  assert.equal(deleted.action, 'DELETED');
  assert.equal(created.entityType, 'SYSTEM');
  assert.equal(created.entityId, `backup:${created.entityLabel}`);
  assert.equal(deleted.entityId, created.entityId);
  assert.equal(created.actorUsername, 'pcn-admin');
  assert.equal(created.source, 'SYSTEM');
  assert.match(created.summary, /pcn_certification_manual/);
});

test('backup activity payload keeps the document id outside JSONB data', () => {
  const log = buildBackupActivity('CREATED', 'pcn.zip', {}, '2026-08-29T02:00:00.000Z');
  const payload = getBackupActivityPayload(log);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, 'id'), false);
  assert.equal(payload.entityLabel, 'pcn.zip');
});

test('backup mutations use an append-only audit boundary and the documented contract', () => {
  assert.match(managerSource, /export async function recordBackupActivity/);
  assert.match(managerSource, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
  assert.match(serverSource, /recordBackupActivity\('CREATED'/);
  assert.match(serverSource, /recordBackupActivity\('DELETED'/);
  assert.match(designSource, /Audit thao tác archive/);
});

// --- End of pcn-backup-audit-actions.test.ts ---
