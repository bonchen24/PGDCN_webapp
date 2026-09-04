import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';

import { assertBackupObjectIntegrity } from '../utils/backupIntegrity.ts';

const managerSource = fs.readFileSync(new URL('../utils/backupManager.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

const body = Buffer.from('PCN archive object', 'utf8');
const sha256 = createHash('sha256').update(body).digest('hex');

test('backup integrity accepts the exact object described by the manifest', () => {
  assert.doesNotThrow(() => assertBackupObjectIntegrity({ objectPath: 'dossier/a.pdf', byteSize: body.byteLength, sha256 }, body));
});

test('backup integrity rejects truncated or tampered objects before restore', () => {
  assert.throws(
    () => assertBackupObjectIntegrity({ objectPath: 'dossier/a.pdf', byteSize: body.byteLength, sha256 }, Buffer.from('truncated', 'utf8')),
    /byte size|SHA-256/i,
  );
  assert.throws(
    () => assertBackupObjectIntegrity({ objectPath: 'dossier/a.pdf', byteSize: body.byteLength, sha256: '0'.repeat(64) }, body),
    /SHA-256/i,
  );
});

test('backup integrity keeps legacy manifests with no checksum size-safe', () => {
  assert.doesNotThrow(() => assertBackupObjectIntegrity({ objectPath: 'dossier/a.pdf', byteSize: body.byteLength, sha256: null }, body));
});

test('restore requires archive preflight before any destructive restore operation', () => {
  assert.match(managerSource, /verifyBackupArchive\(filename\)/);
  assert.match(managerSource, /if \(!verification\.ok\)/);
  assert.match(managerSource, /Không thể khôi phục archive chưa qua kiểm chứng/);
  assert.match(designSource, /Preflight trước restore archive máy chủ/);
});

test('backup storage accepts the deployment service-role fallback used by Docker', () => {
  assert.match(managerSource, /SUPABASE_SERVICE_ROLE_KEY\s*\|\|\s*process\.env\.SERVICE_ROLE_KEY/);
});

// --- End of pcn-backup-integrity.test.ts ---
