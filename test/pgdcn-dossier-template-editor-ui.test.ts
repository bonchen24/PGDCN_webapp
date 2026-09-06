import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const editor = readFileSync(new URL('../components/PgdcnDossierTemplateEditor.tsx', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('../components/PgdcnDossierTemplateCanvas.tsx', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../components/PgdcnDossierTemplateInspector.tsx', import.meta.url), 'utf8');

test('visual editor exposes palette, lane/column canvas and draft actions', () => {
  assert.match(editor, /data-testid="pgdcn-dossier-template-editor"/);
  assert.match(editor, /data-testid="pgdcn-dossier-template-palette"/);
  assert.match(editor, /data-testid="pgdcn-dossier-template-save"/);
  assert.match(editor, /Lưu bản nháp/);
  assert.match(editor, /onPreview/);
  assert.match(editor, /data-testid="pgdcn-dossier-template-metadata"/);
  assert.match(editor, /Mã bộ hồ sơ/);
  assert.match(editor, /Áp dụng cho/);
  assert.doesNotMatch(editor, /<textarea/);
  assert.match(canvas, /DndContext/);
  assert.match(canvas, /useDroppable/);
  assert.match(canvas, /lane/);
  assert.match(canvas, /column/);
});

test('inspector provides searchable checklist references and visual node actions', () => {
  assert.match(inspector, /Tìm tài liệu|Tìm kiếm/);
  assert.match(inspector, /type="checkbox"/);
  assert.match(inspector, /Nối tới/);
  assert.match(inspector, /Xóa node/);
  assert.match(inspector, /required/);
  assert.doesNotMatch(inspector, /<textarea/);
  assert.doesNotMatch(inspector, /JSON editor|JSON Editor/);
});

test('workflow connections can be selected and configured without JSON', () => {
  assert.match(editor, /selectedTransitionId/);
  assert.match(editor, /setSelectedTransitionId/);
  assert.match(canvas, /onSelectTransition/);
  assert.match(canvas, /selectedTransitionId/);
  assert.match(inspector, /Chính sách trả về/);
  assert.match(inspector, /Điều kiện/);
  assert.match(inspector, /Phạm vi áp dụng điều kiện/);
  assert.match(inspector, /Giá trị phương thức/);
  assert.match(inspector, /<select/);
  assert.doesNotMatch(inspector, /<textarea/);
});

test('switching template models resets stale editor selection', () => {
  assert.match(editor, /setDraft\(props\.model\)/);
  assert.match(editor, /modelKeyRef\.current !== modelKey/);
  assert.match(editor, /setSelectedNodeId\(undefined\)/);
  assert.match(editor, /setSelectedTransitionId\(undefined\)/);
});
