import assert from 'node:assert/strict';
import test from 'node:test';

import type { ActivityLog, CertificationDossier, CertificationProposal, PcnDossierDocument, PcnDocumentRequirement } from '../types.ts';
import { buildPcnDossierWorkflowMap, buildPcnWorkflowOverview } from '../utils/pcnWorkflowMap.ts';

const dossier: CertificationDossier = {
  id: 'dossier-workflow-map',
  dossierCode: 'HS-WORKFLOW-MAP',
  proposalId: 'proposal-workflow-map',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'AWAITING_DOCUMENTS',
  ownerUsername: 'owner-qc4',
  labRequestIds: [],
  returnedResultIds: [],
  createdAt: '2026-07-28T00:00:00.000Z',
  updatedAt: '2026-08-29T00:00:00.000Z',
};

const proposal: CertificationProposal = {
  id: 'proposal-workflow-map',
  proposalCode: 'DN-WORKFLOW-MAP',
  channel: 'DIRECT',
  status: 'CONVERTED',
  customerSnapshot: { name: 'Công ty Workflow', address: 'Hà Nội' },
  productName: 'Thiết bị workflow',
  quantity: 1,
  fieldCodes: ['QC4'],
  receivedAt: '2026-07-28T00:00:00.000Z',
};

const requirements: PcnDocumentRequirement[] = [
  { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
  { id: 'QC4-COMMERCIAL', fieldCode: 'QC4', code: 'COMMERCIAL', name: 'Báo giá', stages: ['INTAKE'], required: true, active: true, sortOrder: 2 },
  { id: 'QC4-LAB', fieldCode: 'QC4', code: 'LAB_REQUEST', name: 'PYC', stages: ['LAB_ROUTING'], required: true, active: true, sortOrder: 3 },
];

const documents: PcnDossierDocument[] = [
  {
    id: 'document-proposal',
    dossierId: dossier.id,
    requirementId: 'QC4-PROPOSAL',
    fieldCode: 'QC4',
    currentVersionId: 'asset-proposal',
    versions: [{ assetId: 'asset-proposal', fileName: 'de-nghi.docx', uploadedAt: '2026-07-28T00:00:00.000Z' }],
    status: 'PRESENT',
  },
];

function statusLog(after: string, createdAt: string, before = ''): ActivityLog {
  return {
    id: `activity-${after}-${createdAt}`,
    createdAt,
    actorName: 'Người dùng PCN',
    action: 'STATUS_CHANGED',
    entityType: 'PCN_DOSSIER',
    entityId: dossier.id,
    summary: `Hồ sơ chuyển ${after}`,
    source: 'UI',
    changes: [{ field: 'status', before, after }],
  };
}

test('maps the current dossier status to one current node and neighboring nodes', () => {
  const result = buildPcnDossierWorkflowMap({ dossier, activityLogs: [], requirements, documents, now: '2026-08-30T00:00:00.000Z' });

  assert.equal(result.currentNodeKey, 'DOCUMENTS');
  assert.equal(result.currentNode.state, 'CURRENT');
  assert.equal(result.nodes.find((node) => node.key === 'INTAKE')?.state, 'COMPLETED');
  assert.equal(result.nodes.find((node) => node.key === 'ASSIGNMENT')?.state, 'FUTURE');
  assert.equal(result.currentNode.missingDocumentCount, 1);
  assert.equal(result.currentNode.blocked, false);
  assert.equal(result.hasReturned, false);
});

test('maps a corrective-action dossier to the return node and preserves visited history', () => {
  const result = buildPcnDossierWorkflowMap({
    dossier: { ...dossier, status: 'CORRECTIVE_ACTION' },
    activityLogs: [
      statusLog('AWAITING_RESULTS', '2026-08-01T00:00:00.000Z', 'SENT_TO_LAB'),
      statusLog('CORRECTIVE_ACTION', '2026-08-03T00:00:00.000Z', 'AWAITING_RESULTS'),
    ],
    requirements,
    documents,
    now: '2026-08-04T00:00:00.000Z',
  });

  assert.equal(result.currentNodeKey, 'CORRECTION');
  assert.equal(result.currentNode.state, 'CURRENT');
  assert.equal(result.currentNode.returned, true);
  assert.equal(result.hasReturned, true);
  assert.equal(result.nodes.find((node) => node.key === 'RESULTS')?.state, 'COMPLETED');
  assert.equal(result.nodes.find((node) => node.key === 'APPROVAL')?.state, 'FUTURE');
});

test('marks an on-hold dossier as a blocked exception without inventing a primary step', () => {
  const result = buildPcnDossierWorkflowMap({
    dossier: { ...dossier, status: 'ON_HOLD', exceptionReason: 'Chờ đối chiếu nguồn' },
    activityLogs: [],
    requirements,
    documents,
  });

  assert.equal(result.currentNodeKey, 'EXCEPTIONS');
  assert.equal(result.currentNode.state, 'EXCEPTION');
  assert.equal(result.currentNode.blocked, true);
  assert.equal(result.currentNode.returned, false);
  assert.equal(result.currentNode.exceptionReason, 'Chờ đối chiếu nguồn');
});

test('counts overdue and missing-document dossiers by workflow node', () => {
  const result = buildPcnWorkflowOverview({
    dossiers: [{ ...dossier, targetDate: '2026-08-01' }],
    proposals: [proposal],
    requirements,
    documents,
    now: '2026-08-30T00:00:00.000Z',
  });

  const node = result.nodes.find((item) => item.key === 'DOCUMENTS');
  assert.equal(node?.count, 1);
  assert.equal(node?.overdueCount, 1);
  assert.equal(node?.missingDocumentCount, 1);
  assert.equal(result.nodes.find((item) => item.key === 'INTAKE')?.count, 0);
});

test('aggregate workflow keeps one exception count and does not duplicate dossier counts', () => {
  const result = buildPcnWorkflowOverview({
    dossiers: [
      dossier,
      { ...dossier, id: 'dossier-hold', dossierCode: 'HS-HOLD', status: 'ON_HOLD', exceptionReason: 'Tạm dừng' },
      { ...dossier, id: 'dossier-issued', dossierCode: 'HS-ISSUED', status: 'ISSUED' },
    ],
    proposals: [proposal],
    requirements,
    documents,
    now: '2026-08-30T00:00:00.000Z',
  });

  assert.equal(result.nodes.reduce((sum, node) => sum + node.count, 0), 3);
  assert.equal(result.nodes.find((node) => node.key === 'EXCEPTIONS')?.count, 1);
  assert.equal(result.nodes.find((node) => node.key === 'ISSUANCE')?.count, 1);
});
