import assert from 'node:assert/strict';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal, PcnWorkflowTemplate } from '../types.ts';
import { buildPcnWorkflowBackfillPlan } from '../utils/pcnWorkflowBackfill.ts';

const template: PcnWorkflowTemplate = {
  id: 'workflow-qc4-v1',
  code: 'QC4-STANDARD',
  name: 'QC4 tiêu chuẩn',
  appliesTo: { fieldCodes: [], methods: ['METHOD_1'] },
  version: 1,
  status: 'PUBLISHED',
  nodes: [
    { id: 'intake', kind: 'DOCUMENT_TASK', label: 'Tiếp nhận', requirementIds: ['QC4-REQ', 'QC9-REQ'], active: true, sortOrder: 1 },
    { id: 'end', kind: 'END', label: 'Hoàn tất', requirementIds: [], active: true, sortOrder: 2 },
  ],
  transitions: [{ id: 'intake-end', fromNodeId: 'intake', toNodeId: 'end', condition: 'ALWAYS' }],
  createdAt: '2026-09-06T00:00:00.000Z',
  createdBy: 'admin',
  updatedAt: '2026-09-06T00:00:00.000Z',
  updatedBy: 'admin',
};

const dossier = (overrides: Partial<CertificationDossier> = {}): CertificationDossier => ({
  id: 'dossier-1',
  dossierCode: 'PCN-260906-01',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'ON_HOLD',
  labRequestIds: [],
  returnedResultIds: [],
  ...overrides,
});

const proposal: CertificationProposal = {
  id: 'proposal-1',
  proposalCode: 'DN-260906-01',
  channel: 'DIRECT',
  status: 'CONVERTED',
  customerSnapshot: { name: 'Khách hàng', address: '', taxId: '', phone: '', email: '', contactPerson: '' },
  productName: 'Sản phẩm',
  quantity: 1,
  fieldCodes: ['QC4'],
  receivedAt: '2026-09-06T00:00:00.000Z',
};

test('plans a snapshot and task seed for legacy dossiers without mutating existing snapshots', () => {
  const existingSnapshot = { templateCode: 'OLD', templateVersion: 3, nodes: [], transitions: [], capturedAt: '2026-09-05T00:00:00.000Z', capturedBy: 'admin' };
  const result = buildPcnWorkflowBackfillPlan({
    dossiers: [dossier(), dossier({ id: 'dossier-2', proposalId: 'proposal-2', workflowSnapshot: existingSnapshot })],
    proposals: [proposal],
    templates: [template],
    now: '2026-09-06T02:00:00.000Z',
    actor: 'pcn-migration',
  });

  assert.equal(result.plans.length, 1);
  assert.equal(result.plans[0].dossierId, 'dossier-1');
  assert.equal(result.plans[0].dossier.workflowTemplateId, 'workflow-qc4-v1');
  assert.equal(result.plans[0].dossier.workflowTemplateVersion, 1);
  assert.equal(result.plans[0].dossier.workflowSnapshot?.templateCode, 'QC4-STANDARD');
  assert.deepEqual(result.plans[0].dossier.workflowSnapshot?.nodes[0].requirementIds, ['QC4-REQ']);
  assert.deepEqual(result.plans[0].tasks.map((task) => [task.nodeId, task.status]), [['intake', 'READY'], ['end', 'LOCKED']]);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /đã có snapshot/i);
});
