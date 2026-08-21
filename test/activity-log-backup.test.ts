// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for activity log backup and PostgreSQL import support

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildBackupPayload } from '../utils/notificationBackup.ts';
import { toPostgresDocuments } from '../scripts/importBackupToPostgres.ts';

test('backup payload carries activity logs separately from notifications', () => {
  const log = {
    id: 'activity-1',
    actorName: 'Admin',
    action: 'UPDATED' as const,
    entityType: 'REQUEST' as const,
    summary: 'Sửa phiếu',
    source: 'UI' as const,
    createdAt: '2026-08-18T00:00:00.000Z',
  };
  const backup = buildBackupPayload({ requests: [], notifications: [] }, '2026-08-18T00:00:00.000Z', [log]);
  assert.deepEqual(backup.activityLogs, [log]);
  assert.deepEqual(backup.notifications, []);
});

test('CLI backup conversion imports activityLogs by id', () => {
  const documents = toPostgresDocuments({ activityLogs: [{ id: 'activity-1', summary: 'Sửa phiếu' }] });
  assert.deepEqual(documents, [{ collectionName: 'activityLogs', documentId: 'activity-1', data: { summary: 'Sửa phiếu' } }]);
});

test('settings backup loads activity logs explicitly instead of Zustand hydration', () => {
  const source = fs.readFileSync(new URL('../components/SettingsModal.tsx', import.meta.url), 'utf8');
  assert.match(source, /fetchAll\(\)/);
  assert.match(source, /buildBackupPayload\(state,\s*backupTimestamp,\s*activityLogs\)/);
  assert.match(source, /activityLogsCount/);
});

test('restore merges backup activity logs without deleting existing history', () => {
  const source = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');
  assert.match(source, /normalizeBackupActivityLogs/);
  assert.match(source, /activityLogClient\.appendBatch/);
  assert.doesNotMatch(source, /batchDeleteFromPostgres\(['"]activityLogs['"]/);
});

test('CLI importer keeps existing activity log ids append-only', () => {
  const source = fs.readFileSync(new URL('../scripts/importBackupToPostgres.ts', import.meta.url), 'utf8');
  assert.match(source, /document\.collectionName === 'activityLogs'/);
  assert.match(source, /ON CONFLICT \(collection_name, document_id\) DO NOTHING/);
});

// --- End of activity-log-backup.test.ts ---
