import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('shared PGDCN UI primitives define accessible compact surfaces', () => {
  const primitivePath = new URL('../components/PgdcnUiPrimitives.tsx', import.meta.url);
  assert.equal(fs.existsSync(primitivePath), true);
  const source = fs.readFileSync(primitivePath, 'utf8');
  for (const marker of ['PgdcnPageHeader', 'PgdcnToolbar', 'PgdcnStatusBadge', 'PgdcnWorkflowRail', 'PgdcnStatePanel', 'min-w-0', 'mobile-touch-target', 'aria-current', 'mobile-scroll-x']) {
    assert.ok(source.includes(marker), `Missing UI primitive marker: ${marker}`);
  }
});

test('PCN and PGD surfaces use the shared presentation rhythm', () => {
  for (const path of ['../components/PcnOperationsRegisterView.tsx', '../components/PgdWorkspace.tsx', '../components/PcnDossierDetailView.tsx', '../components/PgdDossierOperationsPanel.tsx']) {
    const source = read(path);
    assert.match(source, /PgdcnUiPrimitives|PgdcnPageHeader|PgdcnToolbar|PgdcnWorkflowRail|PgdcnStatePanel/);
  }
});

test('dossier detail exposes a horizontally scrollable workflow rail', () => {
  const source = read('../components/PcnDossierDetailView.tsx');
  assert.match(source, /PgdcnWorkflowRail|mobile-scroll-x/);
});
