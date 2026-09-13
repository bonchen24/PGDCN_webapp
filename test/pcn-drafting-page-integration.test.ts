import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace = fs.readFileSync('components/PcnDraftingWorkspaceView.tsx', 'utf8');
const documents = fs.readFileSync('utils/pcnDossierDocuments.ts', 'utf8');

test('PCN drafting workspace is source-first and checklist-integrated', () => {
  assert.match(workspace, /getPcnDocumentRequirements/);
  assert.match(workspace, /buildPcnDossierInspection/);
  assert.match(workspace, /documentRequirements/);
  assert.match(workspace, /dossierDocuments/);
  assert.match(workspace, /Checklist tài liệu/);
  assert.match(workspace, /MISSING/);
  assert.match(workspace, /PRESENT/);
  assert.match(workspace, /WAIVED/);
  assert.match(workspace, /Bổ sung tệp ngoại sinh/);
  assert.match(workspace, /selectedRequirementId/);
  assert.match(workspace, /Xác nhận & gắn vào bộ hồ sơ/);
  assert.match(workspace, /text-rose-600/);
  assert.match(documents, /getPcnDraftFormRequirementCode/);
});
