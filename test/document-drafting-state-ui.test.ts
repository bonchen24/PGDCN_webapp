import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pcnSource = fs.readFileSync(new URL('../components/PcnDraftingWorkspaceView.tsx', import.meta.url), 'utf8');
const pgdSource = fs.readFileSync(new URL('../components/PgdDocumentGenerationPanel.tsx', import.meta.url), 'utf8');

test('PCN drafting workspace exposes an explicit state contract and readiness region', () => {
  assert.match(pcnSource, /data-testid="pcn-drafting-workspace"/);
  assert.match(pcnSource, /data-testid="pcn-drafting-state"/);
  assert.match(pcnSource, /data-testid="pcn-drafting-readiness"/);
  assert.match(pcnSource, /data-testid="pcn-drafting-outputs"/);
  assert.match(pcnSource, /aria-live="polite"/);
  assert.match(pcnSource, /EMPTY|EDITING|SAVED|GENERATING|READY|BLOCKED|ERROR/);
});

test('PGD document generation exposes explicit state, readiness and output regions', () => {
  assert.match(pgdSource, /data-testid="pgd-document-generation"/);
  assert.match(pgdSource, /data-testid="pgd-document-state"/);
  assert.match(pgdSource, /data-testid="pgd-document-readiness"/);
  assert.match(pgdSource, /data-testid="pgd-document-outputs"/);
  assert.match(pgdSource, /aria-live="polite"/);
  assert.match(pgdSource, /EMPTY|EDITING|SAVED|GENERATING|READY|BLOCKED|ERROR/);
});

test('document drafting source keeps Vietnamese strings UTF-8 clean', () => {
  assert.doesNotMatch(`${pcnSource}\n${pgdSource}`, /(?:Ã.|Ä.|áº|Â.)/);
});
