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

test('shared system settings owns PCN and PGD DOCX configuration', () => {
  const source = read('components/PgdcnSystemSettingsView.tsx');
  assert.match(source, /PcnSettingsView/);
  assert.match(source, /PgdTemplateSettingsWorkspace/);
  assert.match(source, /Template DOCX PCN/);
  assert.match(source, /Template DOCX PGD/);
});

test('domain DOCX actions route to shared system settings without per-domain settings entries', () => {
  const sidebar = read('components/PgdSidebar.tsx');
  const shell = read('components/PgdcnAppShell.tsx');
  const workspace = read('components/PgdWorkspace.tsx');
  const sharedSidebar = read('components/PgdcnSidebar.tsx');
  assert.match(sidebar, /settings/);
  assert.match(workspace, /activeSection === 'settings'/);
  assert.doesNotMatch(sidebar, /Cài đặt PCN|Cài đặt PGD/);
  assert.doesNotMatch(sharedSidebar, /Cài đặt PCN|Cài đặt PGD/);
  assert.match(shell, /if \(section === 'settings'\) return \{ domain: 'department', section: 'system-settings' \}/);
  assert.match(shell, /system-settings/);
});
