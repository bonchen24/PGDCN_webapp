import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PCN node drafting is the primary document path', () => {
  const panel = read('components/PcnDossierNodeWorkPanel.tsx');
  const workspace = read('components/PcnDraftingWorkspaceView.tsx');
  const api = read('utils/pcnDraftApi.ts');
  const server = read('server.legacy.ts');
  assert.match(panel, /Soạn thảo tài liệu/);
  assert.match(workspace, /Xác nhận.*gắn vào bộ hồ sơ/);
  assert.match(workspace, /pcn-draft-field-sections/);
  assert.match(workspace, /getPcnDraftFieldSection/);
  assert.match(api, /confirmPcnDraftOutput/);
  assert.match(server, /drafts\/.*outputs\/.*attach|draft-output|draftId/);
});
