import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('PGD drafting uses the PCN-style single-form workspace anatomy', () => {
  const workspace = read('../components/PgdDraftingWorkspaceView.tsx');
  const generator = read('../components/PgdDocumentGenerationPanel.tsx');

  assert.match(workspace, /draftTitle/);
  assert.match(workspace, /aria-label="Nguồn hồ sơ PGD"/);
  assert.match(workspace, /aria-label="Loại tài liệu PGD"/);
  assert.match(workspace, /Bản đã lưu/);
  assert.match(workspace, /Kết quả sinh tệp/);
  assert.doesNotMatch(generator, /aria-label="Loại template tài liệu PGD"/);
  assert.doesNotMatch(generator, /TEMPLATE_KIND_LABELS/);
});
