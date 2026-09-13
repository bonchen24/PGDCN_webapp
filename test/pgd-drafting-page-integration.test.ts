import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PGD drafting workspace is source-first and checklist-integrated', () => {
  const workspace = read('components/PgdDraftingWorkspaceView.tsx');
  const generation = read('components/PgdDocumentGenerationPanel.tsx');
  const dossier = read('utils/pgdDossier.ts');

  assert.match(workspace, /getPgdDossierRequirements/);
  assert.match(workspace, /getCurrentPgdDossierDocuments/);
  assert.match(workspace, /fetchDossierDocuments/);
  assert.match(workspace, /MISSING|PRESENT|WAIVED/);
  assert.match(workspace, /Checklist tài liệu|Tài liệu theo bước/);
  assert.match(workspace, /Bổ sung tệp ngoại sinh/);
  assert.match(workspace, /initialRequirementCode/);
  assert.match(workspace, /onAttachGenerated/);
  assert.match(generation, /Xác nhận vào bộ hồ sơ/);
  assert.match(generation, /text-rose-600/);
  assert.match(generation, /pgd-document-field-sections/);
  assert.match(generation, /<fieldset/);
  assert.match(dossier, /getPgdDossierRequirementStationKey/);
});
