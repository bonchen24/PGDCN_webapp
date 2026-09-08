import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const pcnDetail = read('components/PcnDossierDetailView.tsx');
const pgdWorkspace = read('components/PgdWorkspace.tsx');
const nodePanel = read('components/PcnDossierNodeWorkPanel.tsx');
const drafting = read('components/PcnDraftingWorkspaceView.tsx');
const draftRoute = read('app/pgdcn/pcn/drafting/page.tsx');
const shell = read('components/PgdcnAppShell.tsx');

test('PCN dossier keeps a compact mobile focus surface and safe action footer', () => {
  assert.match(pcnDetail, /data-testid="pcn-dossier-mobile-header"/);
  assert.match(pcnDetail, /data-testid="pcn-dossier-mobile-actions"/);
  assert.match(pcnDetail, /data-testid="pcn-dossier-mobile-region"/);
  assert.match(pcnDetail, /mobile-safe-bottom/);
  assert.match(pcnDetail, /mobile-scroll-y/);
  assert.match(pcnDetail, /min-w-0/);
});

test('PGD dossier keeps mobile header actions and a safe footer without Vietnamese mojibake', () => {
  assert.match(pgdWorkspace, /data-testid="pgd-dossier-mobile-header"/);
  assert.match(pgdWorkspace, /data-testid="pgd-dossier-mobile-actions"/);
  assert.match(pgdWorkspace, /data-testid="pgd-dossier-mobile-footer"/);
  assert.match(pgdWorkspace, /mobile-safe-bottom/);
  assert.match(pgdWorkspace, /min-w-0/);
  assert.doesNotMatch(pgdWorkspace, /(?:Ã.|Ä.|áº|Â.)/);
});

test('node documents expose a DOCX drafting action that preserves dossier context in a new tab', () => {
  assert.match(nodePanel, /onOpenDrafting/);
  assert.match(nodePanel, /Tạo DOCX/);
  assert.match(nodePanel, /target="_blank"|window\.open/);
  assert.match(drafting, /initialDossierId|initialRequirementId/);
  assert.match(draftRoute, /searchParams/);
  assert.match(shell, /initialPcnDraftDossierId/);
});
