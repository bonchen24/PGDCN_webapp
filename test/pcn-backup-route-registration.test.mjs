import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('backup route handlers are included in Git despite the top-level backups ignore rule', () => {
  const ignore = readFileSync(path.join(repoRoot, '.gitignore'), 'utf8');
  assert.match(ignore, /^backups\/$/m, 'keep ignoring generated top-level backup archives');
  assert.match(ignore, /^!app\/api\/backups\/$/m, 'unignore the API route directory');
  assert.match(ignore, /^!app\/api\/backups\/\*\*$/m, 'unignore the server-owned backup API handlers');
});

test('backup list route is real and enforces server-side Admin authorization before listing', () => {
  const source = readFileSync(path.join(repoRoot, 'app/api/backups/route.ts'), 'utf8');
  const authIndex = source.indexOf('requirePcnAdmin(req)');
  const listIndex = source.indexOf('listBackups()');
  assert.ok(source.includes('export async function GET'), 'GET handler must exist');
  assert.ok(authIndex >= 0 && listIndex > authIndex, 'Admin authorization must run before backup listing');
});

test('every backup handler has a server-side Admin guard before its operation', () => {
  const handlers = [
    ['app/api/backups/route.ts', 'listBackups()'],
    ['app/api/backups/run/route.ts', 'createBackup('],
    ['app/api/backups/[filename]/route.ts', 'deleteBackup('],
    ['app/api/backups/[filename]/download/route.ts', 'getBackupPath('],
    ['app/api/backups/[filename]/restore/route.ts', 'restoreBackup('],
    ['app/api/backups/[filename]/verify/route.ts', 'verifyBackupArchive('],
  ];

  for (const [relativePath, operation] of handlers) {
    const source = readFileSync(path.join(repoRoot, relativePath), 'utf8');
    const guardIndex = source.indexOf('requirePcnAdmin(req)');
    const operationIndex = source.indexOf(operation);
    assert.ok(guardIndex >= 0 && operationIndex > guardIndex, `${relativePath} must authorize Admin before ${operation}`);
  }
});
