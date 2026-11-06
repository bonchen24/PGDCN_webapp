import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file: string) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const pgdPanel = read('components/PgdDossierStepWorkPanel.tsx');
const pgdWorkspace = read('components/PgdWorkspace.tsx');
const pgdDrafting = read('components/PgdDraftingWorkspaceView.tsx');
const pcnPanel = read('components/PcnDossierNodeWorkPanel.tsx');
const pcnDetail = read('components/PcnDossierDetailView.tsx');
const pcnOperationalModal = read('components/PcnOperationalFormModal.tsx');

test('PGD drafts in its dossier only when a matching template exists', () => {
  assert.match(pgdPanel, /getPgdDocumentTemplateForRequirement/);
  assert.match(pgdPanel, /hasMatchingDraftTemplate/);
  assert.match(pgdPanel, /const canDraftInPlace = Boolean\(stageEditable && templateKind && requirement && hasMatchingDraftTemplate && onDraftInPlace\)/);
  assert.match(pgdWorkspace, /onDraftInPlace=\{\(input\) => setDraftingModalContext\(input\)\}/);
  assert.match(pgdWorkspace, /initialRequestId=\{request\.id\}[\s\S]*?initialRequirementCode=\{draftingModalContext\.requirementCode\}[\s\S]*?initialTemplateKind=\{draftingModalContext\.templateKind\}/);
  assert.match(pgdWorkspace, /window\.confirm\('Đóng phần soạn thảo\?/);
  assert.match(pgdDrafting, /if \(onClose\) \{[\s\S]*?onClose\(\)/);
});

test('PCN uses the existing operational form and secure node document generator in place', () => {
  assert.match(pcnDetail, /canDraftNodeInPlace/);
  assert.match(pcnDetail, /getPcnNodeDraftFormKind\(item\.code\)[\s\S]*?getPcnNodeDocumentGenerationKind\(item\.code\)/);
  assert.match(pcnDetail, /setOperationalFormOpen\(operationalKind\)/);
  assert.match(pcnDetail, /saveOperationalForm\(target\.kind, value, true\)[\s\S]*?generateAndAttachDossierNodeDocument\(dossier\.id, target\.nodeId, target\.requirementId\)/);
  assert.match(pcnDetail, /setSelectedReaderFileId\(`document:\$\{result\.document\.id\}:\$\{version\.assetId\}`\)/);
  assert.match(pcnOperationalModal, /catch \(error\)[\s\S]*?setSaveError/);
  assert.match(pcnOperationalModal, /confirmCloseWithUnsavedChanges/);
  assert.match(pcnOperationalModal, /onClick=\{closeForm\}/);
  assert.match(pcnDetail, /confirmCloseWithUnsavedChanges=\{Boolean\(nodeDraftingTarget\)\}/);
  assert.match(pcnPanel, /canDraftInPlace \? <button[\s\S]*?onDraftInPlace\?\.\(item\)/);
});

test('DOCX preview stays same-origin, read-only, and omits metadata-only PCN rows', () => {
  const preview = read('components/PgdcnDocxPreview.tsx');
  assert.match(preview, /fetch\(url, \{ credentials: 'same-origin', signal: controller\.signal \}\)/);
  assert.match(preview, /mammoth\.extractRawText/);
  assert.match(preview, /<pre className="whitespace-pre-wrap break-words font-sans">\{state\.text/);
  assert.match(preview, /Bản xem chỉ đọc/);
  assert.doesNotMatch(preview, /https?:\/\//);
  assert.match(pcnDetail, /!attachment\.metadataOnly && Boolean\(attachment\.assetId\)/);
  assert.match(pcnDetail, /setMobileWorkspaceTab\('auxiliary'\)/);
});

// --- End of dossier-in-place-drafting-and-preview-contract.test.ts ---
