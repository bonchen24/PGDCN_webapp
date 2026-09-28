import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL('../' + relativePath, import.meta.url), 'utf8');

test('PGD embedded generation delegates to exactly one workspace review surface', () => {
  const workspace = read('components/PgdDraftingWorkspaceView.tsx');
  const generation = read('components/PgdDocumentGenerationPanel.tsx');

  assert.equal((workspace.match(/<DraftingOutputReviewShell/g) || []).length, 1);
  assert.match(workspace, /showReadiness=\{false\}/);
  assert.match(workspace, /showOutputReview=\{false\}/);
  assert.match(workspace, /onReviewOutput=\{focusOutputReview\}/);
  assert.match(workspace, /onStateChange=\{handleGenerationStateChange\}/);
  assert.match(workspace, /testId="pgd-drafting-readiness"/);
  assert.doesNotMatch(workspace, /Review output|Review-before-attach/);
  assert.match(generation, /showOutputReview\?: boolean/);
  assert.match(generation, /lastOutput && showOutputReview/);
});

test('PCN and PGD drafting keep business-facing Vietnamese labels and the external-file path', () => {
  const pcn = read('components/PcnDraftingWorkspaceView.tsx');
  const pgd = read('components/PgdDraftingWorkspaceView.tsx');
  const source = pcn + '\n' + pgd;

  assert.match(source, /Soát xét tài liệu|Soát xét trước khi gắn/);
  assert.match(source, /Xác nhận đã soát xét/);
  assert.match(source, /Xác nhận & gắn vào bộ hồ sơ/);
  assert.match(source, /Bổ sung tệp ngoại sinh/);
  assert.doesNotMatch(source, /Review output|Review-before-attach|Context →|Missing data/);
});
