import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PcnDossierDocument,
  PcnDossierDocumentWaiver,
  PcnDocumentRequirement,
  PcnWorkflowNodeDefinition,
} from '../types.ts';
import {
  buildPcnDossierNodeBusinessFacts,
  buildPcnDossierNodeWorkProjection,
  type PcnDossierNodeBusinessFact,
} from '../utils/pcnDossierNodeWork.ts';
import type { PcnWorkflowRuntimeNode } from '../utils/pcnWorkflowRuntime.ts';

function requirement(id: string, code: string, required: boolean): PcnDocumentRequirement {
  return { id, fieldCode: 'QC4', code, name: code, required, active: true, sortOrder: 1, stages: [] };
}

function node(overrides: Partial<PcnWorkflowNodeDefinition> = {}): PcnWorkflowNodeDefinition {
  return {
    id: 'sampling',
    kind: 'DOCUMENT_TASK',
    label: 'Lấy mẫu',
    actionKey: 'SAMPLING_LAB',
    requirementIds: ['req-present', 'req-missing', 'req-optional'],
    active: true,
    sortOrder: 10,
    ...overrides,
  };
}

function runtimeNode(overrides: Partial<PcnWorkflowRuntimeNode> = {}): PcnWorkflowRuntimeNode {
  return {
    id: 'sampling',
    kind: 'DOCUMENT_TASK',
    label: 'Lấy mẫu',
    actionKey: 'SAMPLING_LAB',
    requirementIds: ['req-present', 'req-missing', 'req-optional'],
    status: 'IN_PROGRESS',
    cycleNo: 1,
    isActive: true,
    ...overrides,
  };
}

function document(requirementId: string, status: PcnDossierDocument['status']): PcnDossierDocument {
  return { id: `doc-${requirementId}`, dossierId: 'dossier-1', requirementId, fieldCode: 'QC4', status, versions: [] };
}

function businessFact(overrides: Partial<PcnDossierNodeBusinessFact> = {}): PcnDossierNodeBusinessFact {
  return { id: 'sample-route', label: 'Tuyến mẫu / PYC', status: 'COMPLETED', actionLabel: 'Mở sổ mẫu', ...overrides };
}

test('node projection keeps only node requirements and exposes source-aware actions', () => {
  const projection = buildPcnDossierNodeWorkProjection({
    node: node(),
    runtimeNode: runtimeNode(),
    requirements: [
      requirement('req-present', 'SAMPLE_HANDOVER', true),
      requirement('req-missing', 'LAB_REQUEST', true),
      requirement('req-optional', 'SAMPLE_RETURN', false),
      requirement('unrelated', 'CERTIFICATE', true),
    ],
    documents: [document('req-present', 'PRESENT')],
    businessFacts: [businessFact()],
  });

  assert.deepEqual(projection.documents.map((item) => item.requirementId), ['req-present', 'req-missing', 'req-optional']);
  assert.equal(projection.documents.find((item) => item.requirementId === 'req-present')?.status, 'PRESENT');
  assert.deepEqual(projection.documents.find((item) => item.requirementId === 'req-present')?.actions, ['VIEW', 'REPLACE', 'REMOVE_CURRENT']);
  assert.deepEqual(projection.documents.find((item) => item.requirementId === 'req-missing')?.actions, ['UPLOAD', 'CREATE_FROM_FORM', 'WAIVE']);
  assert.equal(projection.documents.find((item) => item.requirementId === 'req-optional')?.required, false);
  assert.equal(projection.businessFacts[0]?.status, 'COMPLETED');
  assert.equal(projection.canContinue, false);
  assert.match(projection.suggestions.join(' '), /LAB_REQUEST/);
});

test('valid waiver resolves a required missing document while optional gaps do not block continuation', () => {
  const waivers: Record<string, PcnDossierDocumentWaiver> = {
    'req-missing': { requirementId: 'req-missing', reason: 'PTN bổ sung sau', decidedAt: '2026-09-06T00:00:00.000Z', decidedBy: 'leader' },
  };
  const projection = buildPcnDossierNodeWorkProjection({
    node: node(),
    runtimeNode: runtimeNode(),
    requirements: [requirement('req-present', 'SAMPLE_HANDOVER', true), requirement('req-missing', 'LAB_REQUEST', true), requirement('req-optional', 'SAMPLE_RETURN', false)],
    documents: [document('req-present', 'PRESENT')],
    documentWaivers: waivers,
    businessFacts: [businessFact()],
  });

  assert.equal(projection.documents.find((item) => item.requirementId === 'req-missing')?.status, 'WAIVED');
  assert.equal(projection.documents.find((item) => item.requirementId === 'req-optional')?.status, 'MISSING');
  assert.equal(projection.canContinue, true);
  assert.equal(projection.unresolvedRequiredCount, 0);
});

test('incomplete business evidence blocks continuation and gives the matching action suggestion', () => {
  const projection = buildPcnDossierNodeWorkProjection({
    node: node({ requirementIds: [] }),
    runtimeNode: runtimeNode({ requirementIds: [] }),
    requirements: [],
    businessFacts: [businessFact({ id: 'result', label: 'KQTN', status: 'ATTENTION', actionLabel: 'Tiếp nhận KQTN', reason: 'Chưa có KQTN chính thức' })],
  });

  assert.equal(projection.canContinue, false);
  assert.equal(projection.businessFacts[0]?.status, 'ATTENTION');
  assert.match(projection.suggestions.join(' '), /Tiếp nhận KQTN/);
});

test('completed node remains editable but mutations require a rework cycle', () => {
  const projection = buildPcnDossierNodeWorkProjection({
    node: node({ requirementIds: ['req-present'] }),
    runtimeNode: runtimeNode({ status: 'COMPLETED', isActive: false, cycleNo: 3 }),
    requirements: [requirement('req-present', 'SAMPLE_HANDOVER', true)],
    documents: [document('req-present', 'PRESENT')],
  });

  assert.equal(projection.isEditable, true);
  assert.equal(projection.requiresReworkOnMutation, true);
  assert.equal(projection.cycleNo, 3);
});

test('business work facts are derived from stored approval and result evidence', () => {
  const pendingApproval = buildPcnDossierNodeBusinessFacts({ actionKey: 'APPROVAL', dossierId: 'dossier-1', approvalSteps: [] });
  assert.equal(pendingApproval[0]?.status, 'ATTENTION');
  assert.match(pendingApproval[0]?.actionLabel || '', /phê duyệt/i);

  const completedReview = buildPcnDossierNodeBusinessFacts({
    actionKey: 'TECHNICAL_REVIEW',
    dossierId: 'dossier-1',
    results: [{ id: 'result-1', dossierId: 'dossier-1', labRequestId: 'pyc-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-06T00:00:00.000Z' }],
  });
  assert.equal(completedReview[0]?.status, 'COMPLETED');
  assert.equal(completedReview[0]?.actionLabel, 'Mở KQTN');
});
