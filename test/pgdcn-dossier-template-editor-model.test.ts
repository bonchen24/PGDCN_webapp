import assert from 'node:assert/strict';
import test from 'node:test';

import type { PcnDocumentRequirement, PcnWorkflowTemplate } from '../types.ts';
import { getPgdDossierRequirements } from '../utils/pgdDossier.ts';
import {
  connectDossierTemplateEditorNodes,
  countTemplateRequirements,
  fromPcnDossierTemplateEditorModel,
  fromPgdDossierTemplateEditorModel,
  moveDossierTemplateEditorNode,
  toPcnDossierTemplateEditorModel,
  toPgdDossierTemplateEditorModel,
  validateDossierTemplateEditorModel,
} from '../utils/pgdcnDossierTemplate.ts';
import type { DossierRequirementPolicy } from '../utils/pgdcnDossierRequirementPolicy.ts';

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

test('dossier-template adapters keep per-requirement policies in both domain revisions', () => {
  const policy: DossierRequirementPolicy = {
    defaultClass: 'DEFAULT_OPTIONAL',
    sourceMode: 'MULTI',
    cardinality: { min: 1, max: 4 },
  };
  const pcnSource = { ...pcnTemplate, requirementPolicies: { 'QC4-PROPOSAL': policy } } as unknown as PcnWorkflowTemplate;
  const pcnModel = toPcnDossierTemplateEditorModel(pcnSource);
  const pcnRoundTrip = fromPcnDossierTemplateEditorModel(pcnModel, pcnSource);
  assert.deepEqual(pcnModel.requirementPolicies?.['QC4-PROPOSAL'], policy);
  assert.deepEqual(pcnRoundTrip.requirementPolicies?.['QC4-PROPOSAL'], policy);

  const pgdSource = {
    domain: 'pgd', id: 'pgd-v1', code: 'PGD-V1', name: 'PGD', appliesTo: { productGroups: ['OTHER'] }, version: 1,
    status: 'DRAFT', nodes: [{ id: 'intake', kind: 'DOCUMENT_TASK', label: 'Intake', requirementCodes: ['REQUEST_PYC'], active: true, sortOrder: 1 }],
    transitions: [], createdAt: '2026-09-06T00:00:00.000Z', createdBy: 'admin', updatedAt: '2026-09-06T00:00:00.000Z', updatedBy: 'admin',
    requirementPolicies: { REQUEST_PYC: policy },
  } as unknown as Parameters<typeof toPgdDossierTemplateEditorModel>[0];
  const pgdModel = toPgdDossierTemplateEditorModel(pgdSource);
  const pgdRoundTrip = fromPgdDossierTemplateEditorModel(pgdModel, pgdSource);
  assert.deepEqual(pgdModel.requirementPolicies?.REQUEST_PYC, policy);
  assert.deepEqual(pgdRoundTrip.requirementPolicies?.REQUEST_PYC, policy);
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
