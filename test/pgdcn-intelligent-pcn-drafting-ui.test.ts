import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspace = fs.readFileSync(new URL('../components/PcnDraftingWorkspaceView.tsx', import.meta.url), 'utf8');

test('PCN drafting keeps save available while required data is incomplete and shows save progress', () => {
  const actionBarStart = workspace.indexOf('<DraftingStickyActionBar');
  const actionBarEnd = workspace.indexOf('</DraftingStickyActionBar>', actionBarStart);
  const actionBar = workspace.slice(actionBarStart, actionBarEnd);

  assert.ok(/const canSaveDraft = \['EDITING', 'SAVED', 'BLOCKED', 'ERROR'\]\.includes\(draftingState\) \|\| \(hasUnsavedChanges && !hasAttachedOutput\)/.test(workspace));
  assert.ok(/\{canSaveDraft &&/.test(actionBar));
  assert.match(actionBar, /onClick=\{\(\) => void save\(\)\}/);
  assert.match(actionBar, /busyAction === 'SAVE' \? 'Đang lưu…' : 'Lưu bản nháp'/);
  assert.match(actionBar, /disabled=\{busy\}/);
});
test('PCN next-step links open collapsed field sections before focusing an issue', () => {
  assert.ok(/instanceof HTMLDetailsElement[\s\S]*?\.open = true/.test(workspace));
});

test('PCN drafting saves changed values before regenerating and blocks review of stale outputs', () => {
  const generateStart = workspace.indexOf('const generate = async () => {');
  const generateEnd = workspace.indexOf('const reviewOutput', generateStart);
  const generate = workspace.slice(generateStart, generateEnd);

  assert.ok(/if \(!currentId \|\| hasUnsavedChanges\)/.test(generate));
  assert.ok(/const outputIsStale = currentOutputs\.length > 0 && hasUnsavedChanges/.test(workspace));
  assert.ok(/if \(outputIsStale\) return/.test(workspace));
});

test('PCN drafting announces save, attach and stale-output states in readiness guidance', () => {
  assert.ok(/busyAction === 'SAVE'\s*\? 'Đang lưu bản nháp/.test(workspace));
  assert.ok(/busyAction === 'CONFIRM'\s*\? 'Đang gắn tài liệu/.test(workspace));
  assert.ok(/outputIsStale\s*\? 'Bản nháp đã thay đổi/.test(workspace));
});

test('PCN drafting exposes an A4 PDF preview alongside generated outputs', () => {
  assert.ok(workspace.includes("import { PcnFilePreviewButton } from './PcnDossierFilePreview';"));
  assert.ok(/output\.format === 'PDF'[\s\S]*?Xem trước A4[\s\S]*?PcnFilePreviewButton/.test(workspace));
  assert.match(workspace, /Lưu & sinh DOCX \+ PDF/);
  assert.match(workspace, /Đang sinh tài liệu/);
});
