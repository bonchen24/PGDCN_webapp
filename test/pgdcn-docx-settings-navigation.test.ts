import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PCN document drafting header exposes a DOCX settings action for the PCN workspace', () => {
  const source = read('components/PcnDraftingWorkspaceView.tsx');
  assert.match(source, /Cài đặt DOCX/);
  assert.match(source, /onOpenSettings/);
});

test('PGD document creation header exposes a DOCX settings action for the PGD workspace', () => {
  const source = read('components/PgdDocumentGenerationPanel.tsx');
  assert.match(source, /Cài đặt DOCX/);
  assert.match(source, /onOpenSettings/);
});

test('shared system settings does not own PCN DOCX template management', () => {
  const source = read('components/PgdcnSystemSettingsView.tsx');
  assert.doesNotMatch(source, /PcnSettingsView/);
  assert.doesNotMatch(source, /onUploadTemplate/);
});

test('PGD owns a separate DOCX settings section and keeps it out of shared navigation', () => {
  const sidebar = read('components/PgdSidebar.tsx');
  const shell = read('components/PgdcnAppShell.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const sharedSidebar = read('components/PgdcnSidebar.tsx');
  assert.match(sidebar, /settings/);
  assert.match(sidebar, /Cài đặt PGD/);
  assert.match(workspace, /activeSection === 'settings'/);
  assert.match(sharedSidebar, /section: 'settings'/);
  assert.doesNotMatch(shell, /section === 'settings'\) return \{ domain: 'department', section: 'system-settings' \}/);
});
