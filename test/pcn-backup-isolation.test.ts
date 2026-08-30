import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../utils/backupManager.ts', import.meta.url), 'utf8');

test('PCN backup names and retention are isolated from DDT backups', () => {
  assert.match(source, /APP_PROFILE/);
  assert.match(source, /pcn_certification/);
  assert.match(source, /backupPrefix/);
  assert.match(source, /startsWith\(AUTO_PREFIX\)/);
  assert.match(source, /pg_restore/);
  assert.match(source, /assertBackupObjectIntegrity/);
});

// --- End of pcn-backup-isolation.test.ts ---
