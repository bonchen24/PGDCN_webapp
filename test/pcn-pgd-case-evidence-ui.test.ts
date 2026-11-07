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
  assert.doesNotMatch(panel, /QC20|\/api\/db|Desktop|\bUNC\b/i);
  assert.doesNotMatch(workspace, /PgdCaseEvidencePanel[^\n]*reportAccess\.editable/);
  assert.match(workspace, /getPgdDossierRequirementsWithCustom\(request\.productGroup/);
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

test('PGD evidence form protects unsaved dossier data when its request or requirement changes', () => {
  const panel = read('components/PgdCaseEvidencePanel.tsx');

  assert.match(panel, /const hasUnsavedDocumentForm =/);
  assert.match(panel, /form\.documentNumber\.trim\(\)/);
  assert.match(panel, /form\.documentDate\.trim\(\)/);
  assert.match(panel, /documentDateDraft\.trim\(\)/);
  assert.match(panel, /form\.note\.trim\(\)/);
  assert.match(panel, /form\.file/);
  assert.match(panel, /form\.title\.trim\(\) !== \(currentRequirement\?\.title \|\| ''\)\.trim\(\)/);
  assert.match(panel, /requirements\.find\(\(requirement\) => requirement\.code === requirementCode\) \|\| requirements\[0\]/);
  assert.match(panel, /documentFormRef\.current\?\.reset\(\)/);
  assert.match(panel, /fileInputRef\.current\.value = ''/);
  assert.match(panel, /const hasUnsavedCurrentDocumentForm =/);
  assert.match(panel, /data-document-date-input/);
  assert.match(panel, /key=\{formResetVersion\}/);
  assert.match(panel, /previousRequestIdRef/);
  assert.match(panel, /previousInitialRequirementCodeRef/);
  assert.match(panel, /const formRequestIdRef = useRef\(request\.id\)/);
  assert.match(panel, /formRequestIdRef\.current !== request\.id/);
  assert.match(panel, /globalThis\.confirm\(/);
  assert.match(panel, /Bạn có tệp, thông tin hoặc tiêu đề chứng từ chưa lưu/);
  assert.match(panel, /hasUnsavedCurrentDocumentForm\(\) && !globalThis\.confirm\(REQUIREMENT_CHANGE_CONFIRMATION\)\) return;/);
  assert.match(panel, /onRequirementChange[\s\S]*?hasUnsavedCurrentDocumentForm/);
  assert.match(panel, /requestChanged[\s\S]*?clearDocumentForm/);
  assert.match(panel, /\}, \[initialRequirementCode, request\.id, clearDocumentForm, hasUnsavedCurrentDocumentForm\]\);/);
});
