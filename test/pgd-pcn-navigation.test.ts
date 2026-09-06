import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PGD sidebar exposes management pages, not operational stations', () => {
  const sharedSidebar = read('components/PgdcnSidebar.tsx');
  const legacySidebar = read('components/PgdSidebar.tsx');
  const expected = [
    "section: 'requests'",
    "section: 'operations'",
    "section: 'templates'",
  ];
  for (const marker of expected) assert.match(sharedSidebar, new RegExp(marker));
  assert.match(legacySidebar, /\['dashboard', 'requests', 'operations', 'templates'\]/);
  for (const marker of ["section: 'preparation'", "section: 'field'", "section: 'labs'", "section: 'results'"]) {
    assert.doesNotMatch(sharedSidebar, new RegExp(marker));
    assert.doesNotMatch(legacySidebar, new RegExp(marker));
  }
});

test('PGD dossier detail uses a PCN-style full-screen focus workspace', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(workspace, /data-testid="pgd-dossier-focus-shell"/);
  assert.match(workspace, /aria-label={`Không gian làm việc hồ sơ PGD/);
  assert.match(workspace, /PgdWorkflowMap/);
  assert.match(read('components/PgdWorkflowMap.tsx'), /PcnArchifyWorkflowEmbed/);
  assert.doesNotMatch(workspace, /role="dialog" aria-modal="true" aria-label={`Chi tiết hồ sơ/);
  assert.match(workspace, /max-h-\[100dvh\]|h-\[100dvh\]/);
});

test('PGD operations page remains a read-only projection that opens the dossier', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(workspace, /const operationProjection/);
  assert.match(workspace, /onOpen=\{\(\) => openRequest/);
  assert.match(workspace, /Sổ điều hành PGD/);
});
