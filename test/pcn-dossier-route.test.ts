import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

test('PCN dossier has a dedicated refreshable route', () => {
  const page = read('app/pgdcn/pcn/dossiers/[dossierId]/page.tsx');
  assert.match(page, /params/);
  assert.match(page, /initialDossierId/);
  assert.match(page, /searchParams|initialDossierTab/);
  assert.match(page, /initialDossierNodeId/);
  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(shell, /initialPcnDossierId/);
  assert.match(shell, /initialPcnDossierNodeId/);
  assert.match(shell, /PcnWorkspace[^\n]*initialDossierId/);
  assert.match(shell, /router\.push\([^\n]*dossiers/);
});

test('standalone dossier detail is an in-page workspace, not a modal overlay', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  const detail = read('components/PcnDossierDetailView.tsx');
  assert.match(workspace, /standaloneDossier/);
  assert.match(workspace, /standalone/);
  assert.match(detail, /standalone\?: boolean/);
  assert.match(detail, /standalone \? '[^']*' : 'fixed inset-0/);
  assert.match(detail, /initialNodeId/);
});

test('closing the standalone dossier route clears the selected dossier before returning to the register', () => {
  const workspace = read('components/PcnWorkspace.tsx');
  assert.match(workspace, /useEffect\(\(\) => \{\n    setSelectedDossierId\(initialDossierId\);\n    setSelectedDossierTab\(initialDossierTab\);\n  \}, \[initialDossierId, initialDossierTab\]\);/);
});

test('switching workspace navigation from a standalone dossier replaces the dossier route', () => {
  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(shell, /if \(initialPcnDossierId\) \{\n      router\.replace\(target\.domain === 'department' \? '\/pgdcn' : target\.domain === 'PCN' \? '\/pgdcn\/pcn' : '\/pgdcn\/pgd'\);\n    \}/);
});
