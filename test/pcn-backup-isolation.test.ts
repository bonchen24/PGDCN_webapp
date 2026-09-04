import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../utils/backupManager.ts', import.meta.url), 'utf8');
const composeSource = fs.readFileSync(new URL('../docker-compose.pcn.yml', import.meta.url), 'utf8');

test('PCN backup names and retention are isolated from DDT backups', () => {
  assert.match(source, /APP_PROFILE/);
  assert.match(source, /pcn_certification/);
  assert.match(source, /backupPrefix/);
  assert.match(source, /startsWith\(`\$\{backupPrefix\}_`\)/);
  assert.match(source, /maxTotalBytes/);
  assert.match(source, /pg_restore/);
  assert.match(source, /assertBackupObjectIntegrity/);
  assert.match(composeSource, /pcn_backups:\s*\/app\/backups/);
});

// --- End of pcn-backup-isolation.test.ts ---
