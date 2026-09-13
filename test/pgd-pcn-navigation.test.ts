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

test('PGD dossier detail uses a native full-screen focus workspace', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(workspace, /data-testid="pgd-dossier-focus-shell"/);
  assert.match(workspace, /aria-label={`Không gian làm việc hồ sơ PGD/);
  assert.match(workspace, /PgdDossierFlow/);
  assert.match(workspace, /PgdDossierStepWorkPanel/);
  assert.doesNotMatch(workspace, /PgdWorkflowMap/);
  assert.doesNotMatch(workspace, /role="dialog" aria-modal="true" aria-label={`Chi tiết hồ sơ/);
  assert.match(workspace, /max-h-\[100dvh\]|h-\[100dvh\]/);
});

test('PGD operations page remains a read-only projection that opens the dossier', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(workspace, /const operationProjection/);
  assert.match(workspace, /onOpenRequest=\{openRequest\}/);
  assert.match(workspace, /PgdSummaryRegisterView/);
});

test('shared PGD navigation focuses the requested record and clears that focus on close', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(workspace, /initialRequestId\?: string/);
  assert.match(workspace, /onRequestClose\?: \(\) => void/);
  assert.match(workspace, /setSelectedRequestId\(initialRequestId\)/);
  assert.match(workspace, /onRequestClose\?\.\(\)/);
  assert.match(workspace, /<PgdRequestDetail request=\{selectedRequest\}/);
  assert.match(shell, /focusedPgdRequestId/);
  assert.match(shell, /setFocusedPgdRequestId\(requestId\)/);
  assert.match(shell, /initialRequestId=\{focusedPgdRequestId\}/);
  assert.match(shell, /onRequestClose=\{\(\) => setFocusedPgdRequestId\(undefined\)\}/);
});

test('PGD notifications forward the target record and generic navigation clears stale PGD focus', () => {
  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(shell, /target\.domain === 'PGD'[\s\S]*openPgdRequest\(target\.recordId\)/);
  assert.match(shell, /const navigate = \(target: PgdcnNavigationTarget\) => \{[\s\S]*setFocusedPgdRequestId\(undefined\)/);
  assert.match(shell, /const openPcnDossier = \(dossierId: string, initialTab\?: PcnDossierDetailTab\) => \{[\s\S]*setFocusedPgdRequestId\(undefined\)/);
});
