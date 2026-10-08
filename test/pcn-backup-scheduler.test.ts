import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getBackupAutoPrefix, getBackupPrefix, getBackupRetentionPolicy } from '../utils/backupManager.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('backup prefixes follow the active database profile', () => {
  assert.equal(getBackupPrefix('pcn'), 'pcn_certification');
  assert.equal(getBackupPrefix('ddt'), 'ddt_lab');
  assert.equal(getBackupAutoPrefix('pcn'), 'pcn_certification_auto_');
  assert.equal(getBackupAutoPrefix('ddt'), 'ddt_lab_auto_');
});

test('backup scheduler is disabled under the manual-only policy', () => {
  assert.doesNotMatch(serverSource, /createBackup\(['"]auto['"]\)/);
  assert.doesNotMatch(serverSource, /setInterval\(runScheduledBackup/);
  assert.match(serverSource, /getBackupRetentionPolicy\(\)/);
});

test('manual backup retention has bounded count and total size defaults', () => {
  assert.deepEqual(getBackupRetentionPolicy({} as NodeJS.ProcessEnv), {
    retentionCount: 3,
    maxTotalBytes: 2 * 1024 * 1024 * 1024,
  });
});

// --- End of pcn-backup-scheduler.test.ts ---
