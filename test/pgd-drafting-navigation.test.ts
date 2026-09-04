import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) =>
  fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

const shell = fs.readFileSync(new URL('../components/PgdcnAppShell.tsx', import.meta.url), 'utf8');
const sidebar = fs.readFileSync(new URL('../components/PgdcnSidebar.tsx', import.meta.url), 'utf8');
const workspace = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const legacySidebar = fs.readFileSync(new URL('../components/PgdSidebar.tsx', import.meta.url), 'utf8');

test('PGD groups intake inside the dossier register and labels the drafting workspace clearly', () => {
  assert.match(sidebar, /\{ section: 'requests', label: 'Hồ sơ PYC'/);
  assert.doesNotMatch(sidebar.slice(sidebar.indexOf('const PGD_ITEMS'), sidebar.indexOf('const isTargetActive')), /section: 'intake'/);
  assert.match(sidebar, /\{ section: 'templates', label: 'Soạn thảo tài liệu'/);
  assert.match(legacySidebar, /requests: 'Hồ sơ PYC'/);
  assert.match(legacySidebar, /templates: 'Soạn thảo tài liệu'/);
  assert.doesNotMatch(legacySidebar, /const mainSections[^\n]*'intake'/);
});

test('PGD opens a create-PYC modal from the dossier register', () => {
  assert.match(workspace, /intakeOpen/);
  assert.match(workspace, /role="dialog"/);
  assert.match(workspace, /Tạo PYC/);
  assert.match(workspace, /PgdIntakeForm/);
  assert.match(workspace, /setIntakeOpen\(true\)/);
  assert.doesNotMatch(workspace, /activeSection === 'intake' \? <PgdIntakeForm/);
  assert.match(shell, /initialDomain === 'PGD' \? \{ domain: 'PGD', section: 'requests' \}/);
  assert.match(shell, /const openPgdWorkspace = \(\) => \{[\s\S]*section: 'requests'/);
});

test('PGD exposes the preparation station and keeps DOCX settings in the workspace', () => {
  assert.match(legacySidebar, /preparation: 'Chuẩn bị & Phân công'/);
  assert.match(workspace, /PgdDocxSettingsModal/);
  assert.match(workspace, /docxSettingsOpen/);
  assert.match(workspace, /setDocxSettingsOpen\(true\)/);
  assert.doesNotMatch(legacySidebar, /settings:|users:|customers:/);
});

test('PGD drafting keeps structured cells in the local DOCX settings flow', () => {
  const generation = read('components/PgdDocumentGenerationPanel.tsx');
  const tableEditor = read('components/PgdTableFieldEditor.tsx');
  const cellManager = read('components/PgdCellManager.tsx');
  assert.match(generation, /PgdTableFieldEditor/);
  assert.match(generation, /PgdCellManager/);
  assert.match(generation, /Quản lý cell và placeholder PGD/);
  assert.match(tableEditor, /tableColumns/);
  assert.match(tableEditor, /Thêm dòng/);
  assert.match(cellManager, /Danh sách cell PGD/);
});

// --- End of pgd-drafting-navigation.test.ts ---
