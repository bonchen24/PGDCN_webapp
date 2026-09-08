import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('desktop dossier summary filters stay in one grid row while mobile can stack', () => {
  const source = read('components/PgdcnDossierSummaryGrid.tsx');
  assert.match(source, /data-testid="dossier-summary-toolbar"/);
  assert.match(source, /lg:grid-cols-\[minmax\(0,1fr\)_repeat\(/);
});

test('PGD selector and register filters use multi-column desktop toolbars', () => {
  const selector = read('components/PgdDossierSelector.tsx');
  const register = read('components/PgdWorkspace.tsx');
  assert.match(selector, /data-testid="pgd-dossier-selector-filters"/);
  assert.match(selector, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(/);
  assert.match(register, /data-testid="pgd-register-toolbar"/);
  assert.match(register, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(/);
});

test('PCN proposal and sample register filters use multi-column desktop toolbars', () => {
  const proposal = read('components/PcnWorkspace.tsx');
  const samples = read('components/PcnLabOperationsView.tsx');
  assert.match(proposal, /data-testid="pcn-proposal-filters"/);
  assert.match(proposal, /md:grid-cols-\[minmax\(0,1fr\)_190px_170px_auto\]/);
  assert.match(samples, /data-testid="sample-register-toolbar"/);
  assert.match(samples, /md:grid-cols-\[minmax\(0,1fr\)_minmax\(/);
});

test('sidebar navigation closes an open dossier before changing workspace', () => {
  const shell = read('components/PgdcnAppShell.tsx');
  const pcnWorkspace = read('components/PcnWorkspace.tsx');
  const pgdWorkspace = read('components/PgdWorkspace.tsx');
  assert.match(shell, /const navigate = \(target: PgdcnNavigationTarget\) => \{\s*setFocusedPgdRequestId\(undefined\);/);
  assert.match(pcnWorkspace, /const openSection = \(section: PcnSection, entityKey\?: string\) => \{[^}]*setSelectedDossierId\(undefined\)/);
  assert.match(pgdWorkspace, /const openSection = \(section: PgdEntrySection, preserveRequest = false\) => \{[^}]*if \(!preserveRequest\) \{\s*setSelectedRequestId\(undefined\)/);
});
