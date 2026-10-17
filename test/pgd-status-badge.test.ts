import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');

test('PGD workspace status badges use the shared PGD badge and retain their status label', () => {
  const statusBadge = workspaceSource.match(/function StatusBadge\([\s\S]*?\n\}/)?.[0];

  assert.ok(statusBadge, 'Missing the PGD workspace StatusBadge wrapper');
  assert.match(statusBadge, /<PgdcnStatusBadge compact domain="PGD" status=\{status\} label=\{getPgdStatusLabel\(status\)\} \/>/);
  assert.equal([...workspaceSource.matchAll(/<StatusBadge\s+status=\{request\.status\}\s*\/>/g)].length, 3);
});
