import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  buildBackupRestoreActivity,
  mergeBackupActivityLogsForRestore,
} from '../utils/backupManager.ts';

const existingLog = {
  id: 'activity-before-restore',
  createdAt: '2026-08-29T01:00:00.000Z',
  actorName: 'Admin PCN',
  actorUsername: 'pcn-admin',
  action: 'UPDATED' as const,
  entityType: 'PCN_DOSSIER' as const,
  entityId: 'dossier-1',
  summary: 'Cập nhật hồ sơ trước khôi phục',
  source: 'UI' as const,
};

const restoredLog = {
  id: 'activity-from-archive',
  createdAt: '2026-08-28T01:00:00.000Z',
  actorName: 'Nhân sự PCN',
  action: 'CREATED' as const,
  entityType: 'PCN_PROPOSAL' as const,
  entityId: 'proposal-1',
  summary: 'Tạo đề nghị trong archive',
  source: 'UI' as const,
};

const managerSource = fs.readFileSync(new URL('../utils/backupManager.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('restore merge keeps current logs, archive logs and the restore event without overwriting', () => {
  const restoreLog = buildBackupRestoreActivity('pcn_certification_manual_20260829-080000.zip', {
    username: 'pcn-admin',
    name: 'Admin PCN',
    role: 'admin',
  }, '2026-08-29T02:00:00.000Z');

  const merged = mergeBackupActivityLogsForRestore(
    [existingLog],
    [restoredLog],
    restoreLog,
  );

  assert.deepEqual(merged.map((item) => item.id), [restoredLog.id, existingLog.id, restoreLog.id]);
  assert.equal(merged.find((item) => item.id === existingLog.id)?.summary, existingLog.summary);
  assert.equal(restoreLog.action, 'RESTORED');
  assert.equal(restoreLog.entityType, 'SYSTEM');
  assert.equal(restoreLog.source, 'RESTORE');
  assert.equal(restoreLog.actorUsername, 'pcn-admin');
  assert.match(restoreLog.summary, /pcn_certification_manual/);
});

test('restore merge rejects a conflicting activity id instead of silently overwriting history', () => {
  assert.throws(
    () => mergeBackupActivityLogsForRestore(
      [{ ...existingLog, summary: 'Nội dung hiện tại' }],
      [existingLog],
      buildBackupRestoreActivity('pcn.zip', {}, '2026-08-29T02:00:00.000Z'),
    ),
    /activity log.*trùng|conflict/i,
  );
});

test('server restore preserves activity logs and records the signed-in PCN actor', () => {
  assert.match(managerSource, /readActivityLogsForRestore/);
  assert.match(managerSource, /finalizeRestoreActivityLogs/);
  assert.match(managerSource, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
  assert.match(serverSource, /const actor = getPcnSessionUser\(req\);/);
  assert.match(serverSource, /restoreBackup\(filename, actor \?/);
});

// --- End of pcn-backup-activity-preservation.test.ts ---
