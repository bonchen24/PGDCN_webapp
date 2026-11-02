import assert from 'node:assert/strict';
import test from 'node:test';

import type { CertificationDossier, PcnWorkflowTemplate } from '../types.ts';
import {
  PCN_WORKFLOW_CONDITIONS,
  getPcnWorkflowForDossier,
  selectPcnPublishedWorkflowTemplate,
  snapshotPcnWorkflowTemplate,
  validatePcnWorkflowTemplate,
} from '../utils/pcnWorkflowTemplate.ts';

const baseTemplate = (overrides: Partial<PcnWorkflowTemplate> = {}): PcnWorkflowTemplate => ({
  id: 'workflow-qc4-v1',
  code: 'QC4-STANDARD',
  name: 'QC4 tiêu chuẩn',
  appliesTo: { fieldCodes: ['QC4'], methods: ['METHOD_1'] },
  version: 1,
  status: 'PUBLISHED',
  nodes: [
    { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: ['req-intake'], actionKey: 'INTAKE', active: true, sortOrder: 1 },
    { id: 'end', kind: 'END', label: 'Hoàn tất', requirementIds: [], active: true, sortOrder: 2 },
  ],
  transitions: [
    { id: 'intake-end', fromNodeId: 'intake', toNodeId: 'end', condition: PCN_WORKFLOW_CONDITIONS.ALWAYS },
  ],
  createdAt: '2026-09-06T00:00:00.000Z',
  createdBy: 'admin',
  updatedAt: '2026-09-06T00:00:00.000Z',
  updatedBy: 'admin',
  ...overrides,
});

const dossier = (overrides: Partial<CertificationDossier> = {}): CertificationDossier => ({
  id: 'dossier-1',
  dossierCode: 'PCN-260906-01',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'DRAFT',
  labRequestIds: [],
  returnedResultIds: [],
  ...overrides,
});

test('validates workflow graph topology and allowlisted conditions', () => {
  const valid = validatePcnWorkflowTemplate(baseTemplate());
  assert.equal(valid.valid, true);

  const invalid = validatePcnWorkflowTemplate(baseTemplate({
    transitions: [{ id: 'bad', fromNodeId: 'missing', toNodeId: 'end', condition: 'return eval(1)' as any }],
  }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /fromNodeId|điều kiện|condition/i);
});

test('validates condition configuration for field and method branches', () => {
  const valid = validatePcnWorkflowTemplate(baseTemplate({
    transitions: [{ id: 'intake-end', fromNodeId: 'intake', toNodeId: 'end', condition: 'FIELD_MATCH', conditionConfig: { expectedFieldCodes: ['QC4'] } }],
  }));
  assert.equal(valid.valid, true);
  const invalid = validatePcnWorkflowTemplate(baseTemplate({
    transitions: [{ id: 'intake-end', fromNodeId: 'intake', toNodeId: 'end', condition: 'METHOD_MATCH', conditionConfig: {} }],
  }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /expectedMethod|METHOD_MATCH|phương thức/i);
});

test('rejects invalid join policies and duplicate topology ids', () => {
  const invalid = validatePcnWorkflowTemplate(baseTemplate({
    nodes: [
      { id: 'join', kind: 'PARALLEL_JOIN', label: 'Gom', requirementIds: [], joinPolicy: 'QUORUM', quorum: 0, active: true, sortOrder: 1 },
      { id: 'join', kind: 'END', label: 'Trùng', requirementIds: [], active: true, sortOrder: 2 },
    ],
    transitions: [],
  }));
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join(' '), /duy nhất|quorum|QUORUM/i);
});

test('selects the most specific published template deterministically', () => {
  const generic = baseTemplate({ id: 'generic', code: 'GENERIC', version: 8, appliesTo: { fieldCodes: [] }, updatedAt: '2026-09-08T00:00:00.000Z' });
  const specific = baseTemplate({ id: 'specific', version: 2, updatedAt: '2026-09-01T00:00:00.000Z' });
  const retired = baseTemplate({ id: 'retired', status: 'RETIRED', version: 99 });
  assert.equal(selectPcnPublishedWorkflowTemplate([generic, retired, specific], dossier())?.id, 'specific');
  assert.equal(selectPcnPublishedWorkflowTemplate([specific], dossier({ fieldCodes: ['QC9'] })), undefined);
});

test('does not select a published personal proposal for a new dossier', () => {
  const personalProposal = baseTemplate({ id: 'personal', scope: 'PERSONAL' });
  assert.equal(selectPcnPublishedWorkflowTemplate([personalProposal], dossier()), undefined);
});

test('snapshots a published template without sharing mutable topology', () => {
  const template = baseTemplate();
  const captured = snapshotPcnWorkflowTemplate(template, { capturedAt: '2026-09-06T01:00:00.000Z', capturedBy: 'manager' });
  assert.equal(captured.templateVersion, template.version);
  assert.equal(captured.templateCode, template.code);
  assert.notEqual(captured.nodes, template.nodes);
  captured.nodes[0].label = 'Đã thay đổi trong hồ sơ';
  assert.equal(template.nodes[0].label, 'Tiếp nhận');
});

test('uses the dossier snapshot before a newer template revision and adapts legacy dossiers', () => {
  const current = baseTemplate({ id: 'current', code: 'QC4-STANDARD', version: 2, nodes: [{ id: 'new', kind: 'END', label: 'Mới', requirementIds: [], active: true, sortOrder: 1 }], transitions: [] });
  const snap = snapshotPcnWorkflowTemplate(baseTemplate(), { capturedAt: '2026-09-06T02:00:00.000Z', capturedBy: 'admin' });
  const withSnapshot = dossier({ workflowTemplateId: 'workflow-qc4-v1', workflowTemplateVersion: 1, workflowSnapshot: snap });
  assert.equal(getPcnWorkflowForDossier(withSnapshot, [current]).nodes[0].id, 'intake');
  const legacy = getPcnWorkflowForDossier(dossier({ status: 'TECHNICAL_REVIEW' }), []);
  assert.ok(legacy.nodes.length > 5);
  assert.ok(legacy.nodes.some((node) => node.actionKey === 'TECHNICAL_REVIEW'));
});
