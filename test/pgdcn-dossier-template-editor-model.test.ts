import assert from 'node:assert/strict';
import test from 'node:test';

import type { PcnDocumentRequirement, PcnWorkflowTemplate } from '../types.ts';
import { getPgdDossierRequirements } from '../utils/pgdDossier.ts';
import {
  DEFAULT_DOSSIER_TEMPLATE_STAGES,
  connectDossierTemplateEditorNodes,
  countTemplateRequirements,
  fromPcnDossierTemplateEditorModel,
  fromPgdDossierTemplateEditorModel,
  moveDossierTemplateEditorNode,
  setDossierTemplateStageRequirement,
  toPcnDossierTemplateEditorModel,
  toPgdDossierTemplateEditorModel,
  validateDossierTemplateEditorModel,
} from '../utils/pgdcnDossierTemplate.ts';

const pcnRequirement = (id: string): PcnDocumentRequirement => ({
  id,
  fieldCode: id.startsWith('QC9-') ? 'QC9' : 'QC4',
  code: id.split('-').slice(1).join('-'),
  name: id,
  stages: ['INTAKE'],
  required: true,
  active: true,
  sortOrder: 1,
});

const pcnTemplate: PcnWorkflowTemplate = {
  id: 'pcn-qc4-v1',
  code: 'PCN-QC4',
  name: 'PCN QC4',
  appliesTo: { fieldCodes: ['QC4'] },
  version: 1,
  status: 'DRAFT',
  nodes: [
    { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: ['QC4-PROPOSAL'], active: true, sortOrder: 10, laneId: 'intake', column: 1 },
    { id: 'end', kind: 'END', label: 'Lưu trữ', requirementIds: [], active: true, sortOrder: 20, laneId: 'archive', column: 2 },
  ],
  transitions: [{ id: 'edge-start-end', fromNodeId: 'start', toNodeId: 'end', condition: 'ALWAYS' }],
  createdAt: '2026-09-06T00:00:00.000Z',
  createdBy: 'admin',
  updatedAt: '2026-09-06T00:00:00.000Z',
  updatedBy: 'admin',
};

test('PCN and PGD adapters keep domain-specific requirement references', () => {
  const pcnModel = toPcnDossierTemplateEditorModel(pcnTemplate, [pcnRequirement('QC4-PROPOSAL')]);
  const pgdModel = toPgdDossierTemplateEditorModel({
    domain: 'pgd',
    id: 'pgd-v1',
    code: 'PGD-V1',
    name: 'PGD',
    appliesTo: { productGroups: ['OTHER'], methodCodes: ['METHOD_7'] },
    version: 1,
    status: 'DRAFT',
    nodes: [{ id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementCodes: ['REQUEST_PYC'], active: true, sortOrder: 1 }],
    transitions: [],
    createdAt: '2026-09-06T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-09-06T00:00:00.000Z',
    updatedBy: 'admin',
  }, getPgdDossierRequirements('OTHER'));

  assert.equal(pcnModel.domain, 'PCN');
  assert.deepEqual(pcnModel.nodes[0].requirementRefs, ['QC4-PROPOSAL']);
  assert.equal(pgdModel.domain, 'PGD');
  assert.deepEqual(pgdModel.nodes[0].requirementRefs, ['REQUEST_PYC']);
  assert.equal(countTemplateRequirements(pcnModel), 1);
});

test('editor movement changes only layout and keeps node identity', () => {
  const model = toPcnDossierTemplateEditorModel(pcnTemplate, [pcnRequirement('QC4-PROPOSAL')]);
  const moved = moveDossierTemplateEditorNode(model, 'start', { laneId: 'review', column: 4, sortOrder: 99 });
  assert.equal(moved.nodes.find((node) => node.id === 'start')?.laneId, 'review');
  assert.equal(moved.nodes.find((node) => node.id === 'start')?.column, 4);
  assert.equal(moved.nodes.find((node) => node.id === 'start')?.sortOrder, 99);
  assert.deepEqual(moved.nodes.map((node) => node.id), model.nodes.map((node) => node.id));
  assert.deepEqual(moved.transitions, model.transitions);
});

test('connecting the same source and target is idempotent and creates a stable edge id', () => {
  const model = toPcnDossierTemplateEditorModel(pcnTemplate, [pcnRequirement('QC4-PROPOSAL')]);
  const connected = connectDossierTemplateEditorNodes(model, 'start', 'end');
  const repeated = connectDossierTemplateEditorNodes(connected, 'start', 'end');
  assert.equal(connected.transitions.length, model.transitions.length);
  assert.equal(repeated.transitions.length, connected.transitions.length);
  assert.equal(repeated.transitions.find((edge) => edge.fromNodeId === 'start' && edge.toNodeId === 'end')?.id, 'edge-start-end');
});

test('editor validator rejects cross-domain requirements and accepts the PCN model', () => {
  const model = toPcnDossierTemplateEditorModel(pcnTemplate, [pcnRequirement('QC4-PROPOSAL')]);
  assert.equal(validateDossierTemplateEditorModel(model).valid, true);
  const invalid = {
    ...model,
    nodes: model.nodes.map((node) => node.id === 'start' ? { ...node, requirementRefs: ['REQUEST_PYC'] } : node),
  };
  const result = validateDossierTemplateEditorModel(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.includes('domain')));
});

test('editor validator requires visible parameters for conditional transitions', () => {
  const model = toPcnDossierTemplateEditorModel(pcnTemplate, [pcnRequirement('QC4-PROPOSAL')]);
  const conditional = { ...model, transitions: [{ ...model.transitions[0], condition: 'FIELD_MATCH' as const }] };
  const missingConfig = validateDossierTemplateEditorModel(conditional);
  assert.equal(missingConfig.valid, false);
  assert.ok(missingConfig.errors.some((error) => error.includes('tham số')));
  const configured = { ...conditional, transitions: [{ ...conditional.transitions[0], conditionConfig: { expectedFieldCodes: ['QC4'] } }] };
  assert.equal(validateDossierTemplateEditorModel(configured).valid, true);
});

test('incomplete draft templates can be saved while publish validation still requires a complete topology', () => {
  const model = toPcnDossierTemplateEditorModel(pcnTemplate, [pcnRequirement('QC4-PROPOSAL')]);
  const incomplete = { ...model, nodes: [model.nodes[0]], transitions: [] };
  assert.equal(validateDossierTemplateEditorModel(incomplete).valid, false);
  assert.equal(validateDossierTemplateEditorModel(incomplete, { allowIncompleteDraft: true }).valid, true);
});

test('default dossier template stages expose the approved seven Vietnamese groups', () => {
  assert.deepEqual(DEFAULT_DOSSIER_TEMPLATE_STAGES.map(({ id, label }) => [id, label]), [
    ['intake-documents', 'Tiếp nhận yêu cầu & tài liệu khách hàng'],
    ['scope-assignment', 'Xem xét yêu cầu & phân công'],
    ['onsite-assessment', 'Đánh giá/giám định tại chỗ'],
    ['testing-evidence', 'Thử nghiệm & tổng hợp bằng chứng'],
    ['corrective-action', 'Hành động khắc phục'],
    ['review-approval', 'Soát xét & phê duyệt kết quả'],
    ['issuance-archive', 'Phát hành, bàn giao & lưu trữ'],
  ]);
});

test('PCN stage grouping round-trips explicit stage IDs without changing parallel topology', () => {
  const branchTemplate: PcnWorkflowTemplate = {
    ...pcnTemplate,
    nodes: [
      { id: 'start', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: ['QC4-PROPOSAL'], active: true, sortOrder: 10, stageId: 'intake-documents' },
      { id: 'split', kind: 'PARALLEL_SPLIT', label: 'Tách nhánh', requirementIds: [], active: true, sortOrder: 20, stageId: 'scope-assignment' },
      { id: 'field', kind: 'DOCUMENT_TASK', label: 'Tại chỗ', requirementIds: [], active: true, sortOrder: 30, stageId: 'onsite-assessment' },
      { id: 'lab', kind: 'DOCUMENT_TASK', label: 'Thử nghiệm', requirementIds: [], active: true, sortOrder: 40, stageId: 'testing-evidence' },
      { id: 'join', kind: 'PARALLEL_JOIN', label: 'Gom nhánh', requirementIds: [], active: true, sortOrder: 50, stageId: 'review-approval', joinPolicy: 'ALL' },
      { id: 'end', kind: 'END', label: 'Lưu trữ', requirementIds: [], active: true, sortOrder: 60, stageId: 'issuance-archive' },
    ] as PcnWorkflowTemplate['nodes'],
    transitions: [
      { id: 'start-split', fromNodeId: 'start', toNodeId: 'split', condition: 'ALWAYS' },
      { id: 'split-field', fromNodeId: 'split', toNodeId: 'field', condition: 'ALWAYS' },
      { id: 'split-lab', fromNodeId: 'split', toNodeId: 'lab', condition: 'ALWAYS' },
      { id: 'field-join', fromNodeId: 'field', toNodeId: 'join', condition: 'ALWAYS' },
      { id: 'lab-join', fromNodeId: 'lab', toNodeId: 'join', condition: 'ALWAYS' },
      { id: 'join-end', fromNodeId: 'join', toNodeId: 'end', condition: 'ALWAYS' },
    ],
  };

  const model = toPcnDossierTemplateEditorModel(branchTemplate);
  const saved = fromPcnDossierTemplateEditorModel(model, branchTemplate);

  assert.deepEqual(model.nodes.map((node) => node.stageId), branchTemplate.nodes.map((node) => node.stageId));
  assert.deepEqual(saved.nodes.map((node) => node.id), branchTemplate.nodes.map((node) => node.id));
  assert.deepEqual(saved.transitions, branchTemplate.transitions);
});

test('PGD stage grouping preserves explicit stages and keeps unmapped legacy nodes', () => {
  const legacyTemplate = {
    domain: 'pgd' as const,
    id: 'pgd-legacy-v1',
    code: 'PGD-LEGACY',
    name: 'PGD legacy',
    appliesTo: { productGroups: ['OTHER' as const], methodCodes: ['METHOD_7'] },
    version: 1,
    status: 'DRAFT' as const,
    nodes: [
      { id: 'legacy-work', kind: 'DOCUMENT_TASK' as const, label: 'Việc cũ', requirementCodes: ['REQUEST_PYC'], active: true, sortOrder: 1 },
      { id: 'legacy-end', kind: 'END' as const, label: 'Kết thúc', requirementCodes: [], active: true, sortOrder: 2 },
    ],
    transitions: [{ id: 'legacy-edge', fromNodeId: 'legacy-work', toNodeId: 'legacy-end', condition: 'ALWAYS' as const }],
    createdAt: '2026-09-06T00:00:00.000Z',
    createdBy: 'admin',
    updatedAt: '2026-09-06T00:00:00.000Z',
    updatedBy: 'admin',
  };
  const explicitTemplate = {
    ...legacyTemplate,
    nodes: legacyTemplate.nodes.map((node, index) => ({ ...node, stageId: index === 0 ? 'intake-documents' : 'issuance-archive' })),
  } as typeof legacyTemplate & { nodes: Array<(typeof legacyTemplate.nodes)[number] & { stageId: string }> };

  const model = toPgdDossierTemplateEditorModel(explicitTemplate);
  const saved = fromPgdDossierTemplateEditorModel(model, explicitTemplate as any);

  assert.deepEqual(model.nodes.map((node) => node.stageId), ['intake-documents', 'issuance-archive']);
  assert.deepEqual(saved.nodes.map((node) => node.id), ['legacy-work', 'legacy-end']);
  assert.deepEqual(saved.transitions, legacyTemplate.transitions);
});

test('removing a document from a stage grouping preserves execution refs and survives editor round-trip', () => {
  const model = toPcnDossierTemplateEditorModel(pcnTemplate);
  const originalTransitions = structuredClone(model.transitions);
  const stageId = model.nodes.find((node) => node.requirementRefs.includes('QC4-PROPOSAL'))!.stageId!;

  const regrouped = setDossierTemplateStageRequirement(model, stageId, 'QC4-PROPOSAL', false);
  assert.deepEqual(regrouped.stages?.find((stage) => stage.id === stageId)?.requirementIds, []);
  assert.deepEqual(regrouped.nodes.find((node) => node.id === 'start')?.requirementRefs, ['QC4-PROPOSAL']);
  assert.deepEqual(regrouped.transitions, originalTransitions);

  const saved = fromPcnDossierTemplateEditorModel(regrouped, pcnTemplate);
  const reopened = toPcnDossierTemplateEditorModel(saved);
  assert.deepEqual(reopened.stages?.find((stage) => stage.id === stageId)?.requirementIds, []);
  assert.deepEqual(reopened.nodes.find((node) => node.id === 'start')?.requirementRefs, ['QC4-PROPOSAL']);
  assert.deepEqual(reopened.transitions, originalTransitions);
});
