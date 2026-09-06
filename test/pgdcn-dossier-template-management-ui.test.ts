import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const sidebar = readFileSync(new URL('../components/PgdcnSidebar.tsx', import.meta.url), 'utf8');
const shell = readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');
const management = readFileSync(new URL('../components/PgdcnDossierTemplateManagementView.tsx', import.meta.url), 'utf8');
const editor = readFileSync(new URL('../components/PgdcnDossierTemplateEditor.tsx', import.meta.url), 'utf8');
const settings = readFileSync(new URL('../components/PgdcnSystemSettingsView.tsx', import.meta.url), 'utf8');

test('shared navigation exposes Hồ sơ mẫu to eligible managers', () => {
  assert.match(sidebar, /dossier-templates/);
  assert.match(sidebar, /Hồ sơ mẫu/);
  assert.match(sidebar, /isPcnSystemManager|PGD_MANAGER/);
  assert.match(shell, /PgdcnDossierTemplateManagementView/);
});

test('management workspace separates PCN and PGD requirements and lifecycle actions', () => {
  assert.match(management, /PCN/);
  assert.match(management, /PGD/);
  assert.match(management, /Tìm kiếm|Tìm bộ hồ sơ/);
  assert.match(management, /Đang áp dụng|Bản nháp|Đã ngừng/);
  assert.match(management, /Tạo revision/);
  assert.match(editor, /Lưu bản nháp/);
  assert.match(management, /requirementIds|requirementCodes/);
  assert.match(editor, /selectedNodeId/);
  assert.doesNotMatch(management, /<textarea/);
});

test('template cards expose their application scope without opening the editor', () => {
  assert.match(management, /Phạm vi áp dụng/);
  assert.match(management, /QC4/);
  assert.match(management, /Thép và kim loại/);
  assert.match(management, /data-testid=\{`pgdcn-dossier-template-scope-/);
});

test('settings no longer renders raw JSON workflow editor as the primary surface', () => {
  assert.doesNotMatch(settings, /PcnWorkflowTemplateManagementView/);
  assert.doesNotMatch(settings, /topologyJson|Nodes và transitions \(JSON\)/);
  assert.match(settings, /Cấu hình PCN/);
});
