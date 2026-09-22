import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

function read(relativePath: string): string {
  return fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
}

const pcnDrafting = read('components/PcnDraftingWorkspaceView.tsx');
const pgdDrafting = read('components/PgdDraftingWorkspaceView.tsx');
const pgdGeneration = read('components/PgdDocumentGenerationPanel.tsx');
const sharedDraftingPrimitives = read('components/PgdcnDraftingPrimitives.tsx');
const pcnSettings = read('components/PcnDocxSettingsModal.tsx');
const pgdSettings = read('components/PgdDocxSettingsModal.tsx');
const draftingRoute = read('app/pgdcn/pcn/drafting/page.tsx');
const appShell = read('components/PgdcnAppShell.tsx');

test('PCN and PGD drafting workspaces share a responsive two-region drafting foundation', () => {
  for (const source of [pcnDrafting, pgdDrafting]) {
    assert.match(source, /pcn-page-surface/);
    assert.match(source, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(18rem,22rem\)\]/);
    assert.match(source, /DraftingOutputReviewShell|drafting-outputs/);
    assert.match(source, /PgdcnDraftingPrimitives/);
    assert.match(source, /testId=".*-drafting-orientation"/);
    assert.doesNotMatch(source, /Workspace độc lập/);
  }
  assert.match(sharedDraftingPrimitives, /DraftingHeader/);
  assert.match(sharedDraftingPrimitives, /DraftingContextStatusBar/);
  assert.match(sharedDraftingPrimitives, /DraftingReadinessPanel/);
  assert.match(sharedDraftingPrimitives, /DraftingFieldSection/);
  assert.match(sharedDraftingPrimitives, /DraftingStickyActionBar/);
  assert.match(sharedDraftingPrimitives, /DraftingOutputReviewShell/);
  for (const step of ['Chọn tài liệu', 'Kiểm tra dữ liệu', 'Sinh & soát', 'Gắn hồ sơ']) assert.match(sharedDraftingPrimitives, new RegExp(step));
  assert.match(sharedDraftingPrimitives, /sticky bottom-0/);
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
test('direct PCN drafting route opens the drafting workspace without context', () => {
  assert.match(draftingRoute, /initialPcnDraftingOpen=\{true\}/);
  assert.match(appShell, /initialPcnDraftingOpen\?: boolean/);
  assert.match(appShell, /initialPcnDraftingOpen \|\| initialPcnDraftDossierId \? 'drafting' : 'proposals'/);
});

test('direct drafting routes pass the return target into the shared shell', () => {
  const pgdRoute = read('app/pgdcn/pgd/drafting/page.tsx');
  assert.match(draftingRoute, /returnTo\?: string \| string\[\]/);
  assert.match(draftingRoute, /initialPcnDraftReturnTo=\{scalar\(searchParams\?\.returnTo\)\}/);
  assert.match(pgdRoute, /returnTo\?: string \| string\[\]/);
  assert.match(pgdRoute, /initialPgdDraftReturnTo=\{scalar\(searchParams\?\.returnTo\)\}/);
  assert.match(appShell, /initialPcnDraftReturnTo/);
  assert.match(appShell, /initialPgdDraftReturnTo/);
});
