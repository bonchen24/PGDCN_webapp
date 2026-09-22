import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const workspace = read('components/PgdDraftingWorkspaceView.tsx');
const generation = read('components/PgdDocumentGenerationPanel.tsx');

test('PGD drafting hydrates deep context and keeps the request/template context locked by default', () => {
  assert.match(workspace, /initialRequestId\?\: string/);
  assert.match(workspace, /initialRequirementCode\?\: string/);
  assert.match(workspace, /initialTemplateKind\?\: PgdDocumentTemplateKind/);
  assert.match(workspace, /isLoaded/);
  assert.match(workspace, /deepTemplate|deepRequirementTemplate/);
  assert.match(workspace, /contextLocked/);
  assert.match(workspace, /Bối cảnh hồ sơ đã mở sẵn/);
});

test('PGD drafting lists exact missing labels and supports focus/scroll to a field', () => {
  assert.match(generation, /readinessIssueItems/);
  assert.match(generation, /onIssueClick=\{\(item\) => focusField\(item\.key\)\}/);
  assert.match(generation, /scrollIntoView\(\{ behavior: 'smooth'/);
  assert.match(generation, /Bắt buộc: \{cell\.label\}/);
  assert.match(generation, /missingCount/);
  assert.match(generation, /collapsible defaultOpen=\{group\.missingCount > 0/);
});

test('PGD drafting persists drafts through the dedicated backend boundary', () => {
  assert.match(workspace, /fetchPgdDraftWorkspaces/);
  assert.match(workspace, /savePgdDraftWorkspace/);
  assert.match(workspace, /Bản nháp đã lưu/);
  assert.doesNotMatch(workspace, /không tự lưu qua reload/);
});

test('PGD drafting exposes READY/generated review state before attach', () => {
  assert.match(workspace, /READY · Đã sinh tài liệu/);
  assert.match(workspace, /Review-before-attach/);
  assert.match(workspace, /templateCode.*templateVersion/);
  assert.match(generation, /documentState === 'READY'/);
  assert.match(generation, /Review output/);
});

test('PGD drafting exposes explicit review and attach success states', () => {
  assert.match(workspace, /Xác nhận đã soát xét/);
  assert.match(workspace, /Xác nhận & gắn vào bộ hồ sơ/);
  assert.match(workspace, /ATTACHED · Đã gắn đúng mục hồ sơ/);
  assert.match(workspace, /pgd-drafting-attach-success/);
  assert.match(generation, /ATTACHED · Đã gắn vào hồ sơ/);
});
