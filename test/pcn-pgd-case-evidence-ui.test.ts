import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const read = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('PGD request detail exposes the dossier evidence and sample register modules', () => {
  const panelPath = path.join(root, 'components/PgdCaseEvidencePanel.tsx');
  assert.equal(fs.existsSync(panelPath), true, 'PGD evidence panel must exist');
  if (!fs.existsSync(panelPath)) return;
  const panel = fs.readFileSync(panelPath, 'utf8');
  const workspace = read('components/PgdWorkspace.tsx');
  assert.match(workspace, /PgdCaseEvidencePanel/);
  assert.match(panel, /Hồ sơ chứng từ/);
  assert.match(panel, /Mẫu PTN/);
  assert.match(panel, /Mẫu lưu/);
  assert.match(panel, /Hủy mẫu/);
  assert.match(panel, /saveDossierDocument/);
  assert.match(panel, /destroyPgdSample/);
  assert.match(panel, /requirementCode/);
  assert.match(panel, /getPgdOperationalStepAccess/);
  assert.match(panel, /fileInputRef/);
  assert.doesNotMatch(panel, /QC20|\/api\/db|Desktop|UNC/i);
  assert.doesNotMatch(workspace, /PgdCaseEvidencePanel[^\n]*reportAccess\.editable/);
  assert.match(workspace, /getPgdDossierRequirements\(request\.productGroup\)/);
  assert.match(workspace, /dossierError/);
});

test('PGD evidence UI keeps generated output separate from source dossier evidence', () => {
  const panelPath = path.join(root, 'components/PgdCaseEvidencePanel.tsx');
  assert.equal(fs.existsSync(panelPath), true, 'PGD evidence panel must exist');
  if (!fs.existsSync(panelPath)) return;
  const panel = read('components/PgdCaseEvidencePanel.tsx');
  assert.match(panel, /dossierDocuments/);
  assert.match(panel, /pgdDossierDocuments/);
  assert.doesNotMatch(panel, /PgdGeneratedDocument|pgdDocuments/);
  assert.match(panel, /retainedUntil|retentionStatus/);
  assert.match(panel, /fileAssetId|download/);
});
