import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PCN drafting keeps DOCX template settings local to the workspace', () => {
  const drafting = read('components/PcnDraftingWorkspaceView.tsx');
  const workspace = read('components/PcnWorkspace.tsx');
  const shell = read('components/PgdcnAppShell.tsx');

  assert.match(drafting, /PcnDocxSettingsModal/);
  assert.match(drafting, /Cài đặt DOCX/);
  assert.match(workspace, /templates=\{pcn\.templates\}/);
  assert.match(workspace, /onUploadTemplate=\{pcn\.uploadPcnTemplate\}/);
  assert.match(workspace, /onReviewTemplate=\{pcn\.reviewPcnTemplate\}/);
  assert.doesNotMatch(workspace, /onOpenSettings=\{\(\) => openSection\('settings'\)\}/);
  assert.doesNotMatch(shell, /section === 'users' \|\| section === 'settings'/);
});
