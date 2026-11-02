import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import PgdcnDossierTemplateEditor from '../components/PgdcnDossierTemplateEditor.tsx';
import { toPcnDossierTemplateEditorModel } from '../utils/pgdcnDossierTemplate.ts';
import type { PcnWorkflowTemplate } from '../types.ts';

const editor = readFileSync(new URL('../components/PgdcnDossierTemplateEditor.tsx', import.meta.url), 'utf8');
const canvas = readFileSync(new URL('../components/PgdcnDossierTemplateCanvas.tsx', import.meta.url), 'utf8');
const inspector = readFileSync(new URL('../components/PgdcnDossierTemplateInspector.tsx', import.meta.url), 'utf8');
const stageBuilder = readFileSync(new URL('../components/PgdcnDossierTemplateStageBuilder.tsx', import.meta.url), 'utf8');

test('visual editor exposes palette, lane/column canvas and draft actions', () => {
  assert.match(editor, /data-testid="pgdcn-dossier-template-editor"/);
  assert.match(editor, /data-testid="pgdcn-dossier-template-palette"/);
  assert.match(editor, /data-testid="pgdcn-dossier-template-save"/);
  assert.match(editor, /Lưu bản nháp/);
  assert.doesNotMatch(editor, /onPreview|Xem trước Archify|Archify/);
  assert.match(editor, /data-testid="pgdcn-dossier-template-metadata"/);
  assert.match(editor, /Mã bộ hồ sơ/);
  assert.match(editor, /Áp dụng cho/);
  assert.doesNotMatch(editor, /<textarea/);
  assert.match(canvas, /DndContext/);
  assert.match(canvas, /useDroppable/);
  assert.match(canvas, /lane/);
  assert.match(canvas, /column/);
});

test('document-stage builder is the default view and keeps the graph behind Advanced', () => {
  const template: PcnWorkflowTemplate = {
    id: 'stage-view-template',
    code: 'PCN-STAGE-VIEW',
    name: 'Mẫu kiểm tra nhóm giai đoạn',
    appliesTo: { fieldCodes: ['QC4'] },
    version: 1,
    status: 'DRAFT',
    nodes: [
      { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: [], active: true, sortOrder: 10 },
      { id: 'end', kind: 'END', label: 'Lưu trữ', requirementIds: [], active: true, sortOrder: 20 },
    ],
    transitions: [{ id: 'start-end', fromNodeId: 'start', toNodeId: 'end', condition: 'ALWAYS' }],
    createdAt: '2026-09-06T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-09-06T00:00:00.000Z',
    updatedBy: 'admin',
  };
  const markup = renderToStaticMarkup(createElement(PgdcnDossierTemplateEditor, {
    model: toPcnDossierTemplateEditorModel(template),
    requirements: [],
    onChange: () => undefined,
    onSaveDraft: async () => undefined,
    canMutate: true,
  }));

  assert.match(markup, /data-testid="pgdcn-dossier-template-stage-builder"/);
  assert.match(markup, /Tiếp nhận yêu cầu &amp; tài liệu khách hàng/);
  assert.match(markup, /Hành động khắc phục/);
  assert.match(markup, /Phát hành, bàn giao &amp; lưu trữ/);
  assert.match(markup, /Mở nâng cao/);
  assert.match(markup, /Tạo yêu cầu mới/);
  assert.doesNotMatch(markup, /data-testid="pgdcn-dossier-template-canvas"/);
  assert.match(stageBuilder, /renameRequirement/);
  assert.match(stageBuilder, /moveRequirement/);
  assert.match(stageBuilder, /aria-label=\{`Chuyển .* lên`\}/);
  assert.match(stageBuilder, /aria-label=\{`Chuyển .* xuống`\}/);
  assert.match(stageBuilder, /Gỡ yêu cầu/);
});

test('inspector provides searchable checklist references and visual node actions', () => {
  assert.match(inspector, /Tìm tài liệu|Tìm kiếm/);
  assert.match(inspector, /type="checkbox"/);
  assert.match(inspector, /Nối tới/);
  assert.match(inspector, /Xóa bước/);
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
test('canvas keeps horizontal scrolling on a local viewport around fixed-width content', () => {
  assert.match(canvas, /<section[^>]*data-testid="pgdcn-dossier-template-canvas"[^>]*className="mobile-scroll-x min-w-0 max-w-full overflow-x-auto[^\"]*"/);
  assert.match(canvas, /<div className="min-w-\[960px\] grid grid-cols-\[148px_repeat\(6,minmax\(150px,1fr\)\)\]/);
  assert.doesNotMatch(canvas, /<section[^>]*data-testid="pgdcn-dossier-template-canvas"[^>]*className="[^\"]*min-w-\[960px\]/);
});
test('selected node inspector exposes lane and column placement controls', () => {
  assert.match(inspector, /Vị trí trên lưu trình/);
  assert.match(inspector, /const LANE_OPTIONS = \[[\s\S]*value: 'default'[\s\S]*value: 'intake'[\s\S]*value: 'preparation'[\s\S]*value: 'field'[\s\S]*value: 'lab'[\s\S]*value: 'review'[\s\S]*value: 'archive'/);
  assert.match(inspector, /Vùng[\s\S]*<select[\s\S]*value=\{node\.laneId \|\| 'default'\}[\s\S]*LANE_OPTIONS\.map/);
  assert.match(inspector, /Cột[\s\S]*<select[\s\S]*value=\{node\.column\}[\s\S]*>1<\/option>[\s\S]*>6<\/option>/);
  assert.match(inspector, /props\.onChangeNode\(\{ laneId:/);
  assert.match(inspector, /props\.onChangeNode\(\{ column:/);
  assert.match(inspector, /Vùng[\s\S]*min-h-11/);
  assert.match(inspector, /Cột[\s\S]*min-h-11/);
  assert.match(inspector, /htmlFor=\{`\$\{idPrefix\}-requirement-search`\}/);
  assert.match(inspector, /placeholder="Tìm tài liệu"/);
  assert.match(inspector, /useId/);
  assert.match(inspector, /htmlFor=\{`\$\{idPrefix\}-node-label`\}/);
  assert.match(inspector, /id=\{`\$\{idPrefix\}-node-label`\} required aria-required="true" aria-describedby=\{`\$\{idPrefix\}-node-label-hint`\}/);
  assert.match(inspector, /htmlFor=\{`\$\{idPrefix\}-transition-label`\}/);
  assert.match(inspector, /id=\{`\$\{idPrefix\}-transition-label`\} required aria-required="true" aria-describedby=\{`\$\{idPrefix\}-transition-label-hint`\}/);
  assert.match(inspector, /fieldset className="mt-4 min-w-0"><legend[^>]*>Phạm vi áp dụng điều kiện/);
  assert.match(inspector, /type=\{props\.domain === 'PCN' \? 'radio' : 'checkbox'\}/);
  assert.match(inspector, /min-w-0 max-w-full overflow-x-clip/);
  assert.match(inspector, /grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2/);
  assert.match(inspector, /focus-visible:ring-2/);
});

test('canvas exposes keyboard controls for selecting, connecting, and moving nodes', () => {
  assert.match(canvas, /useDraggable/);
  assert.match(canvas, /setActivatorNodeRef/);
  assert.match(canvas, /aria-pressed=\{selected\}/);
  assert.match(canvas, /onClick=\{onSelect\}/);
  assert.match(canvas, /role="group" aria-label=\{`Di chuyển \$\{nodeLabel\}`\}/);
  assert.match(canvas, /props\.onMoveNode\(node\.id, \{ \.\.\.position, sortOrder: node\.sortOrder \}\)/);
  assert.match(canvas, /disabled=\{!target\}/);
  assert.match(canvas, /onClick=\{onBeginConnection\}/);
  assert.match(canvas, /onClick=\{onCompleteConnection\}/);
  assert.match(canvas, /focus-visible:ring-2/);
  assert.match(canvas, /id=\{`pgdcn-template-node-select-\$\{node\.id\}`\}/);
  assert.match(canvas, /document\.getElementById\(`pgdcn-template-node-select-\$\{node\.id\}`\)\?\.focus\(\)/);
  assert.doesNotMatch(canvas, /role="button" tabIndex=\{0\}/);
});
