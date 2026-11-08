import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspace = fs.readFileSync('components/PcnDraftingWorkspaceView.tsx', 'utf8');
const documents = fs.readFileSync('utils/pcnDossierDocuments.ts', 'utf8');
const inspection = fs.readFileSync('utils/pcnDossierInspection.ts', 'utf8');

test('PCN drafting workspace is source-first and checklist-integrated', () => {
  assert.match(workspace, /getPcnDossierRequirementsWithCustom/);
  assert.match(workspace, /buildPcnDossierInspection/);
  assert.match(workspace, /documentRequirements/);
  assert.match(workspace, /dossierDocuments/);
  assert.match(workspace, /data-testid="pcn-drafting-checklist"/);
  assert.match(workspace, /source\.dossier/);
  assert.match(inspection, /MISSING/);
  assert.match(inspection, /PRESENT/);
  assert.match(inspection, /WAIVED/);
  assert.match(workspace, /Bổ sung tệp ngoại sinh/);
  assert.match(workspace, /selectedRequirementId/);
  assert.match(workspace, /resolvePcnDraftFormKindForRequirementCode/);
  assert.match(workspace, /Xác nhận & gắn vào bộ hồ sơ/);
  assert.match(workspace, /text-rose-600/);
  assert.match(documents, /getPcnDraftFormRequirementCode/);
});
