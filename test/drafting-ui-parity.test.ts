import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const pcnDrafting = read('components/PcnDraftingWorkspaceView.tsx');
const pgdDrafting = read('components/PgdDraftingWorkspaceView.tsx');
const pgdGeneration = read('components/PgdDocumentGenerationPanel.tsx');
const pcnSettings = read('components/PcnDocxSettingsModal.tsx');
const pgdSettings = read('components/PgdDocxSettingsModal.tsx');

test('PCN and PGD drafting workspaces share the PCN three-zone anatomy', () => {
  for (const source of [pcnDrafting, pgdDrafting]) {
    assert.match(source, /pcn-page-surface/);
    assert.match(source, /xl:grid-cols-\[250px_minmax\(0,1fr\)_270px\]/);
    assert.match(source, /Kết quả sinh file|Kết quả sinh gần nhất/);
  }
  assert.match(`${pcnDrafting}\n${pgdGeneration}`, /sticky bottom-0/);
  assert.match(`${pcnDrafting}\n${pgdGeneration}`, /mobile-touch-target/);
  assert.match(pcnDrafting, /data-testid="pcn-drafting-workspace"/);
  assert.match(pgdDrafting, /data-testid="pgd-drafting-workspace"/);
  assert.match(pgdDrafting, /data-testid="pgd-drafting-readiness"/);
  assert.match(pgdDrafting, /mobile-safe-bottom/);
});

test('PCN and PGD DOCX settings use the same mobile modal contract', () => {
  for (const source of [pcnSettings, pgdSettings]) {
    assert.match(source, /role="dialog"/);
    assert.match(source, /max-w-4xl/);
    assert.match(source, /flex max-h-\[calc\(100dvh-1rem\)\] min-h-0/);
    assert.match(source, /shrink-0/);
    assert.match(source, /mobile-scroll-y min-h-0 flex-1/);
    assert.match(source, /mobile-touch-target/);
    assert.match(source, /focus-visible:ring/);
  }
  assert.match(pcnSettings, /data-testid="pcn-docx-settings-modal"/);
  assert.match(pgdSettings, /data-testid="pgd-docx-settings-modal"/);
});

test('drafting parity sources keep Vietnamese text UTF-8 clean', () => {
  assert.doesNotMatch(`${pcnDrafting}\n${pgdDrafting}\n${pcnSettings}\n${pgdSettings}`, /(?:Ã.|Ä.|áº|Â.)/);
});
