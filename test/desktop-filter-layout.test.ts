import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('dossier summary search and filters stay in one local horizontal toolbar', () => {
  const source = read('components/PgdcnDossierSummaryGrid.tsx');
  assert.match(source, /data-testid="dossier-summary-toolbar"/);
  assert.match(source, /pgdcn-toolbar-nowrap/);
  assert.match(source, /pgdcn-toolbar-search/);
});

test('PGD selector and register filters stay in one local horizontal toolbar', () => {
  const selector = read('components/PgdDossierSelector.tsx');
  const register = read('components/PgdWorkspace.tsx');
  assert.match(selector, /data-testid="pgd-dossier-selector-filters"/);
  assert.match(selector, /pgdcn-toolbar-nowrap/);
  assert.match(register, /data-testid="pgd-register-toolbar"/);
  assert.match(register, /pgdcn-toolbar-nowrap/);
});

test('PCN proposal and sample register filters stay in one local horizontal toolbar', () => {
  const proposal = read('components/PcnWorkspace.tsx');
  const samples = read('components/PcnLabOperationsView.tsx');
  assert.match(proposal, /data-testid="pcn-proposal-filters"/);
  assert.match(proposal, /pgdcn-toolbar-nowrap/);
  assert.match(samples, /data-testid="sample-register-toolbar"/);
  assert.match(samples, /pgdcn-toolbar-nowrap/);
});

test('sidebar navigation closes an open dossier before changing workspace', () => {
  const shell = read('components/PgdcnAppShell.tsx');
  const pcnWorkspace = read('components/PcnWorkspace.tsx');
  const pgdWorkspace = read('components/PgdWorkspace.tsx');
  assert.match(shell, /const navigate = \(target: PgdcnNavigationTarget\) => \{\s*setFocusedPgdRequestId\(undefined\);/);
  assert.match(pcnWorkspace, /const openSection = \(section: PcnSection, entityKey\?: string\) => \{[^}]*setSelectedDossierId\(undefined\)/);
  assert.match(pgdWorkspace, /const openSection = \(section: PgdEntrySection, preserveRequest = false\) => \{[^}]*if \(!preserveRequest\) \{\s*setSelectedRequestId\(undefined\)/);
});
