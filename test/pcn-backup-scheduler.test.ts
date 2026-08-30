import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getBackupAutoPrefix, getBackupPrefix } from '../utils/backupManager.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('backup prefixes follow the active database profile', () => {
  assert.equal(getBackupPrefix('pcn'), 'pcn_certification');
  assert.equal(getBackupPrefix('ddt'), 'ddt_lab');
  assert.equal(getBackupAutoPrefix('pcn'), 'pcn_certification_auto_');
  assert.equal(getBackupAutoPrefix('ddt'), 'ddt_lab_auto_');
});

test('automatic backup scheduler uses the active profile prefix', () => {
  assert.match(serverSource, /getBackupAutoPrefix\(\)/);
  assert.doesNotMatch(serverSource, /startsWith\("ddt_lab_auto_"\)/);
});

// --- End of pcn-backup-scheduler.test.ts ---
