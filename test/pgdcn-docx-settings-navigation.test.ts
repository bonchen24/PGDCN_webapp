import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PCN document drafting header exposes a DOCX settings action for the PCN workspace', () => {
  const source = read('components/PcnDraftingWorkspaceView.tsx');
  assert.match(source, /Cài đặt DOCX/);
  assert.match(source, /setDocxSettingsOpen\(true\)/);
  assert.match(source, /PcnDocxSettingsModal/);
});

test('PGD document creation header exposes a DOCX settings action for the PGD workspace', () => {
  const source = read('components/PgdDraftingWorkspaceView.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(source, /Cài đặt DOCX/);
  assert.match(source, /onOpenSettings/);
  assert.match(workspace, /onOpenSettings=\{isAdmin \? \(\) => setDocxSettingsOpen\(true\)/);
});

test('DOCX settings is a local modal and not shared system settings', () => {
  const generation = read('components/PgdDraftingWorkspaceView.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const source = read('components/PgdcnSystemSettingsView.tsx');
  const pcnWorkspace = read('components/PcnDraftingWorkspaceView.tsx');
  const shell = read('components/PgdcnAppShell.tsx');
  assert.match(generation, /onOpenSettings/);
  assert.match(workspace, /PgdDocxSettingsModal/);
  assert.match(pcnWorkspace, /PcnDocxSettingsModal/);
  assert.match(source, /PcnUserManagementView/);
  assert.doesNotMatch(source, /PcnSettingsView|PgdTemplateSettingsWorkspace|Mẫu DOCX chính thức|Template DOCX PCN|Template DOCX PGD/);
  assert.doesNotMatch(shell, /pgdTemplates=\{pgd\.documentTemplates\}/);
});

test('domain DOCX actions open locally without per-domain settings entries', () => {
  const sidebar = read('components/PgdSidebar.tsx');
  const shell = read('components/PgdcnAppShell.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const sharedSidebar = read('components/PgdcnSidebar.tsx');
  assert.match(workspace, /docxSettingsOpen/);
  assert.match(workspace, /setDocxSettingsOpen\(true\)/);
  assert.doesNotMatch(sidebar, /settings:|users:|customers:/);
  assert.doesNotMatch(workspace, /activeSection === 'settings'/);
  assert.doesNotMatch(sidebar, /Cài đặt PCN|Cài đặt PGD/);
  assert.doesNotMatch(sharedSidebar, /Cài đặt PCN|Cài đặt PGD/);
  assert.doesNotMatch(shell, /if \(section === 'settings'\)/);
});
