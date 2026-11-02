import assert from 'node:assert/strict';
import test from 'node:test';

import type { DossierTemplateRequirementDefinition } from '../types.ts';
import { applyPgdDossierConditionalRequirements, buildPgdDossierChecklist, getPgdDossierRequirementStationKey, markPgdDossierChecklistPresent, reconcilePgdDossierChecklist } from '../utils/pgdDossier.ts';
import { buildPgdDossierPackageManifest } from '../utils/pgdDossierPackage.ts';
import { filterPgdWorkflowTemplatesByScope, selectPgdPublishedWorkflowTemplate, snapshotPgdWorkflowTemplate, type PgdWorkflowTemplate } from '../utils/pgdWorkflowTemplate.ts';

const requiredDefinition: DossierTemplateRequirementDefinition = {
  domain: 'PGD',
  id: 'pgd-custom-7f91',
  code: 'SITE_PHOTOS',
  name: 'Ảnh hiện trường',
  level: 'REQUIRED',
  source: 'UPLOAD_EXTERNAL',
  ownerRole: 'PGD_FIELD_INSPECTOR',
  multiplicity: 'MULTIPLE',
};

const conditionalDefinition: DossierTemplateRequirementDefinition = {
  ...requiredDefinition,
  id: 'pgd-custom-9a11',
  code: 'CORRECTIVE_EVIDENCE',
  name: 'Bằng chứng khắc phục',
  level: 'CONDITIONAL',
  condition: 'RESULT_FAILED',
};

const template: PgdWorkflowTemplate = {
  domain: 'pgd',
  id: 'pgd-workflow-other-v1',
  code: 'PGD-OTHER-01',
  name: 'Hồ sơ nhóm khác',
  appliesTo: { productGroups: ['OTHER'], methodCodes: ['METHOD_7'] },
  version: 1,
  status: 'PUBLISHED',
  stages: [{ id: 'onsite-assessment', label: 'Đánh giá tại chỗ', sortOrder: 30, requirementIds: [requiredDefinition.id, conditionalDefinition.id] }],
  requirementDefinitions: [requiredDefinition, conditionalDefinition],
  nodes: [
    { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementCodes: [], active: true, sortOrder: 10, stageId: 'intake-documents' },
    { id: 'end', kind: 'END', label: 'Kết thúc', requirementCodes: [], active: true, sortOrder: 20, stageId: 'issuance-archive' },
  ],
  transitions: [{ id: 'start-end', fromNodeId: 'start', toNodeId: 'end', condition: 'ALWAYS' }],
  createdAt: '2026-11-02T00:00:00.000Z',
  createdBy: 'admin',
  updatedAt: '2026-11-02T00:00:00.000Z',
  updatedBy: 'admin',
};

test('PGD template selection respects product group and method and snapshots custom policy', () => {
  assert.equal(selectPgdPublishedWorkflowTemplate([template], { productGroup: 'OTHER', methodCode: 'METHOD_7' })?.id, template.id);
  assert.equal(selectPgdPublishedWorkflowTemplate([template], { productGroup: 'COAL', methodCode: 'METHOD_7' }), undefined);
  const snapshot = snapshotPgdWorkflowTemplate(template, { capturedAt: '2026-11-02T00:00:00.000Z', capturedBy: 'operator' });
  assert.equal(snapshot.templateVersion, 1);
  assert.deepEqual(snapshot.stages, template.stages);
  assert.deepEqual(snapshot.requirementDefinitions, template.requirementDefinitions);
  assert.deepEqual(snapshot.nodes.map((node) => node.id), ['start', 'end']);
});

test('does not select a published personal proposal for a new PGD request', () => {
  assert.equal(selectPgdPublishedWorkflowTemplate([{ ...template, scope: 'PERSONAL' }], { productGroup: 'OTHER', methodCode: 'METHOD_7' }), undefined);
});

test('PGD bootstrap scope filter limits proposals to their creator and retains shared published templates', () => {
  const common = { ...template, id: 'common', scope: 'COMMON' as const };
  const ownDraft = { ...template, id: 'own', scope: 'PERSONAL' as const, status: 'DRAFT' as const, createdBy: 'staff-1' };
  const otherDraft = { ...template, id: 'other', scope: 'PERSONAL' as const, status: 'DRAFT' as const, createdBy: 'staff-2' };
  const commonDraft = { ...template, id: 'common-draft', scope: 'COMMON' as const, status: 'DRAFT' as const };
  const personalPublished = { ...template, id: 'personal-published', scope: 'PERSONAL' as const };
  const wrongDomain = { ...template, id: 'pcn', domain: 'PCN' as any };
  const visible = filterPgdWorkflowTemplatesByScope([common, ownDraft, otherDraft, commonDraft, personalPublished, wrongDomain], {
    username: 'staff-1',
    canManage: false,
    canPropose: true,
  });
  assert.deepEqual(visible.map((item) => item.id), ['common', 'own']);
  assert.deepEqual(filterPgdWorkflowTemplatesByScope([common, ownDraft, otherDraft], {
    username: 'manager',
    canManage: true,
    canPropose: false,
  }).map((item) => item.id), ['common', 'own', 'other']);
  assert.deepEqual(filterPgdWorkflowTemplatesByScope([common, ownDraft], {
    username: 'viewer',
    canManage: false,
    canPropose: false,
  }).map((item) => item.id), ['common']);
});

test('custom PGD checklist entries start missing and preserve condition policy without blocking by default', () => {
  const checklist = buildPgdDossierChecklist('OTHER', '2026-11-02T00:00:00.000Z', [requiredDefinition, conditionalDefinition]);
  const required = checklist.find((item) => item.requirementCode === requiredDefinition.id)!;
  const conditional = checklist.find((item) => item.requirementCode === conditionalDefinition.id)!;
  assert.equal(required.status, 'MISSING');
  assert.equal(required.required, true);
  assert.equal(required.multiplicity, 'MULTIPLE');
  assert.equal(conditional.status, 'MISSING');
  assert.equal(conditional.required, false);
  assert.equal(conditional.requirementLevel, 'CONDITIONAL');
  assert.equal(conditional.condition, 'RESULT_FAILED');
  assert.equal(getPgdDossierRequirementStationKey(requiredDefinition.id, 'FIELD_INSPECTION'), 'FIELD_SAMPLING');

  const reconciled = reconcilePgdDossierChecklist('OTHER', checklist, [{ requirementCode: requiredDefinition.id, id: 'doc-1', version: 1 }], '2026-11-02T00:01:00.000Z');
  assert.equal(reconciled.find((item) => item.requirementCode === requiredDefinition.id)?.status, 'PRESENT');
  assert.equal(reconciled.find((item) => item.requirementCode === conditionalDefinition.id)?.status, 'MISSING');
});

test('custom upload and generated attachment remain gated until the current file is explicitly confirmed', () => {
  const checklist = buildPgdDossierChecklist('OTHER', '2026-11-02T00:00:00.000Z', [requiredDefinition, conditionalDefinition]);
  const uploaded = markPgdDossierChecklistPresent('OTHER', checklist, {
    requirementCode: requiredDefinition.id,
    id: 'upload-v1',
    version: 1,
  }, '2026-11-02T00:01:00.000Z', 'UPLOADED');
  const generated = markPgdDossierChecklistPresent('OTHER', uploaded, {
    requirementCode: conditionalDefinition.id,
    id: 'generated-v1',
    version: 1,
  }, '2026-11-02T00:02:00.000Z', 'GENERATED');
  assert.equal(generated.find((item) => item.requirementCode === requiredDefinition.id)?.status, 'UPLOADED');
  assert.equal(generated.find((item) => item.requirementCode === conditionalDefinition.id)?.status, 'GENERATED');

  const pointers = [
    { id: 'upload-v1', domain: 'pgd' as const, requestId: 'request-1', fileName: 'upload.pdf', sourceCollection: 'pgdDossierDocuments' as const, sourceDocumentId: 'upload-v1', version: 1, checksum: 'a'.repeat(64), fileAssetId: 'asset-upload', kind: 'DOSSIER_DOCUMENT' as const },
    { id: 'generated-v1', domain: 'pgd' as const, requestId: 'request-1', fileName: 'draft.docx', sourceCollection: 'pgdDossierDocuments' as const, sourceDocumentId: 'generated-v1', version: 1, checksum: 'b'.repeat(64), fileAssetId: 'asset-generated', kind: 'DOSSIER_DOCUMENT' as const },
  ];
  const blockedManifest = buildPgdDossierPackageManifest({ dossierCode: 'PGD-1', pointers, checklist: generated });
  assert.equal(blockedManifest.complete, false);
  assert.ok(blockedManifest.missingRequirementCodes.includes(requiredDefinition.id));

  const confirmed = markPgdDossierChecklistPresent('OTHER', generated, {
    requirementCode: requiredDefinition.id,
    id: 'upload-v1',
    version: 1,
  }, '2026-11-02T00:03:00.000Z', 'CONFIRMED');
  const confirmedManifest = buildPgdDossierPackageManifest({ dossierCode: 'PGD-1', pointers, checklist: confirmed });
  assert.equal(confirmed.find((item) => item.requirementCode === conditionalDefinition.id)?.status, 'GENERATED');
  assert.equal(confirmedManifest.missingRequirementCodes.includes(requiredDefinition.id), false);
  assert.equal(confirmedManifest.missingRequirementCodes.includes(conditionalDefinition.id), false);
});

test('PGD conditional requirements activate only from a final matching lab-result review', () => {
  const checklist = buildPgdDossierChecklist('OTHER', '2026-11-02T00:00:00.000Z', [conditionalDefinition]);
  const draftReview = applyPgdDossierConditionalRequirements(checklist, { status: 'DRAFT', conformity: 'NON_CONFORMING' }, '2026-11-02T00:01:00.000Z');
  const finalFailure = applyPgdDossierConditionalRequirements(checklist, { status: 'FINAL', conformity: 'NON_CONFORMING' }, '2026-11-02T00:02:00.000Z');
  const finalPass = applyPgdDossierConditionalRequirements(checklist, { status: 'FINAL', conformity: 'CONFORMING' }, '2026-11-02T00:03:00.000Z');
  assert.equal(draftReview.find((item) => item.requirementCode === conditionalDefinition.id)?.required, false);
  assert.equal(finalFailure.find((item) => item.requirementCode === conditionalDefinition.id)?.required, true);
  assert.equal(finalPass.find((item) => item.requirementCode === conditionalDefinition.id)?.required, false);

  const customChecklist = finalFailure.filter((item) => item.requirementCode === conditionalDefinition.id);
  const manifest = buildPgdDossierPackageManifest({ dossierCode: 'PGD-1', pointers: [], checklist: customChecklist });
  assert.deepEqual(manifest.missingRequirementCodes, [conditionalDefinition.id]);
  assert.equal(manifest.complete, false);
});
