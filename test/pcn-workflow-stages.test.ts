import assert from 'node:assert/strict';
import test from 'node:test';

import type { CertificationDossier, PcnDossierDocument, PcnDocumentRequirement } from '../types.ts';
import {
  PCN_WORKFLOW_STAGES,
  canCreatePcnLabRequest,
  canProcessPcnGeneratedDocument,
  canProcessPcnOperationalForm,
  getPcnWorkflowStage,
  getPcnWorkflowStageByKey,
} from '../utils/pcnWorkflowStages.ts';
import {
  buildPcnDossierStageGate,
  canAdvancePcnDossierStage,
  canProcessPcnDossierRequirement,
  getPcnDossierStageGateDenial,
} from '../utils/pcnDossierStageGate.ts';
import {
  buildPcnDossierWorkflowMap,
  buildPcnWorkflowOverview,
} from '../utils/pcnWorkflowMap.ts';

const dossier: CertificationDossier = {
  id: 'dossier-stage-gate',
  dossierCode: 'HS-STAGE-GATE',
  proposalId: 'proposal-stage-gate',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'INTAKE_REVIEW',
  ownerUsername: 'owner-qc4',
  labRequestIds: [],
  returnedResultIds: [],
};

const requirements: PcnDocumentRequirement[] = [
  { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
  { id: 'QC4-ASSIGNMENT', fieldCode: 'QC4', code: 'ASSIGNMENT', name: 'Phiếu phân công', stages: ['INTAKE'], required: true, active: true, sortOrder: 2 },
  { id: 'QC4-LAB', fieldCode: 'QC4', code: 'LAB_REQUEST', name: 'PYC gửi PTN', stages: ['LAB_ROUTING'], required: true, active: true, sortOrder: 3 },
];

const presentProposal: PcnDossierDocument = {
  id: 'document-proposal',
  dossierId: dossier.id,
  requirementId: 'QC4-PROPOSAL',
  fieldCode: 'QC4',
  currentVersionId: 'asset-proposal',
  versions: [{ assetId: 'asset-proposal', fileName: 'de-nghi.pdf', uploadedAt: '2026-08-31T00:00:00.000Z' }],
  status: 'PRESENT',
};

test('exposes exactly five user-facing PCN workflow stages', () => {
  assert.deepEqual(PCN_WORKFLOW_STAGES.map((stage) => stage.key), [
    'INTAKE', 'SAMPLING_LAB', 'RESULTS', 'TECHNICAL_REVIEW', 'APPROVAL',
  ]);
  assert.equal(PCN_WORKFLOW_STAGES.length, 5);
  assert.equal(getPcnWorkflowStage('FIELD_EVALUATION')?.key, 'INTAKE');
  assert.equal(getPcnWorkflowStage('TECHNICAL_REVIEW')?.key, 'TECHNICAL_REVIEW');
  assert.equal(getPcnWorkflowStageByKey('SAMPLING_LAB')?.title, 'Lấy mẫu & gửi PTN');
});

test('an incomplete stage blocks the next stage and reports unresolved documents', () => {
  const gate = buildPcnDossierStageGate({ dossier, requirements, documents: [presentProposal] });

  assert.equal(gate.currentStageKey, 'INTAKE');
  assert.equal(gate.complete, false);
  assert.deepEqual(gate.missingRequirementIds, ['QC4-ASSIGNMENT']);
  assert.equal(canAdvancePcnDossierStage({ dossier, nextStatus: 'AWAITING_SAMPLING', requirements, documents: [presentProposal] }), false);
});

test('custom conditional requirements block only when their result condition applies', () => {
  const conditionalDossier: CertificationDossier = {
    ...dossier,
    workflowSnapshot: {
      templateCode: 'CONDITIONAL-DOCS',
      templateVersion: 1,
      nodes: [],
      transitions: [],
      capturedAt: '2026-10-10T00:00:00.000Z',
      capturedBy: 'admin',
      requirementDefinitions: [{
        domain: 'PCN',
        id: 'conditional-proof',
        code: 'CONDITIONAL_PROOF',
        name: 'Conditional evidence after a failed result',
        level: 'CONDITIONAL',
        condition: 'RESULT_FAILED',
        source: 'UPLOAD_EXTERNAL',
        ownerRole: 'CUSTOMER',
        multiplicity: 'SINGLE',
      }],
    },
  };
  const baseRequirements = requirements.filter((item) => item.id === 'QC4-PROPOSAL');

  const inapplicable = buildPcnDossierStageGate({
    dossier: conditionalDossier,
    requirements: baseRequirements,
    documents: [presentProposal],
  });
  assert.equal(inapplicable.complete, true);

  const applicable = buildPcnDossierStageGate({
    dossier: conditionalDossier,
    requirements: baseRequirements,
    documents: [presentProposal],
    resultOutcome: 'FAIL',
  });
  assert.equal(applicable.complete, false);
  assert.deepEqual(applicable.missingRequirementIds, ['conditional-proof']);

  const satisfied = buildPcnDossierStageGate({
    dossier: conditionalDossier,
    requirements: baseRequirements,
    documents: [presentProposal, {
      id: 'conditional-proof-document',
      dossierId: dossier.id,
      requirementId: 'conditional-proof',
      fieldCode: 'QC4',
      currentVersionId: 'conditional-proof-asset',
      versions: [{ assetId: 'conditional-proof-asset', fileName: 'proof.pdf', uploadedAt: '2026-10-10T00:00:00.000Z' }],
      status: 'PRESENT',
    }],
    resultOutcome: 'FAIL',
  });
  assert.equal(satisfied.complete, true);
});

test('a skipped required document only resolves the gate with a non-empty reason', () => {
  const gate = buildPcnDossierStageGate({
    dossier,
    requirements,
    documents: [presentProposal],
    documentWaivers: {
      'QC4-ASSIGNMENT': {
        requirementId: 'QC4-ASSIGNMENT',
        reason: 'Không phát sinh đánh giá tại hiện trường theo phạm vi đã phê duyệt.',
        decidedAt: '2026-08-31T01:00:00.000Z',
        decidedBy: 'owner-qc4',
        decidedByUsername: 'owner-qc4',
      },
    },
  });

  assert.equal(gate.complete, true);
  assert.equal(gate.waivedCount, 1);
  assert.equal(canAdvancePcnDossierStage({
    dossier,
    nextStatus: 'AWAITING_SAMPLING',
    requirements,
    documents: [presentProposal],
    documentWaivers: gate.documentWaivers,
  }), true);
});

test('an incomplete waiver cannot satisfy a stage gate', () => {
  const gate = buildPcnDossierStageGate({
    dossier,
    requirements,
    documents: [presentProposal],
    documentWaivers: {
      'QC4-ASSIGNMENT': {
        requirementId: 'QC4-ASSIGNMENT',
        reason: 'Có lý do nhưng thiếu người quyết định.',
        decidedAt: '2026-08-31T01:00:00.000Z',
      },
    },
  });

  assert.equal(gate.complete, false);
  assert.deepEqual(gate.missingRequirementIds, ['QC4-ASSIGNMENT']);
});

test('a dossier cannot jump over a user-facing stage', () => {
  const documents = [presentProposal, {
    ...presentProposal,
    id: 'document-lab',
    requirementId: 'QC4-LAB',
    currentVersionId: 'asset-lab',
    versions: [{ assetId: 'asset-lab', fileName: 'pyc.pdf', uploadedAt: '2026-08-31T00:00:00.000Z' }],
  } satisfies PcnDossierDocument];

  const denial = getPcnDossierStageGateDenial({
    dossier: { ...dossier, status: 'INTAKE_REVIEW' },
    nextStatus: 'AWAITING_RESULTS',
    requirements,
    documents,
  });
  assert.equal(denial, 'Không thể nhảy từ bước 1 sang bước 3; phải hoàn tất bước 2 trước.');
  assert.equal(canAdvancePcnDossierStage({
    dossier: { ...dossier, status: 'INTAKE_REVIEW' },
    nextStatus: 'AWAITING_RESULTS',
    requirements,
    documents,
  }), false);
});

test('compact workflow projections expose five steps and collapse detailed statuses', () => {
  const overview = buildPcnWorkflowOverview({
    dossiers: [{ ...dossier, status: 'AWAITING_DOCUMENTS' }],
    compact: true,
    requirements,
    documents: [presentProposal],
  });
  const detail = buildPcnDossierWorkflowMap({
    dossier: { ...dossier, status: 'AWAITING_DOCUMENTS' },
    compact: true,
    requirements,
    documents: [presentProposal],
  });

  assert.deepEqual(overview.nodes.map((node) => node.key), [
    'INTAKE', 'SAMPLING_LAB', 'RESULTS', 'TECHNICAL_REVIEW', 'APPROVAL', 'EXCEPTIONS',
  ]);
  assert.equal(detail.nodes.length, 6);
  assert.equal(detail.currentNodeKey, 'INTAKE');
  assert.equal(detail.currentNode.currentStatus, 'AWAITING_DOCUMENTS');
});

test('document processing is limited to the current or completed user-facing step', () => {
  const samplingDossier = { ...dossier, status: 'AWAITING_SAMPLING' as const };
  const intakeRequirement = requirements[0];
  const labRequirement = requirements[2];
  const futureResultRequirement: PcnDocumentRequirement = {
    id: 'QC4-RESULT',
    fieldCode: 'QC4',
    code: 'TEST_REPORT',
    name: 'Kết quả thử nghiệm',
    stages: ['TECHNICAL_REVIEW'],
    required: true,
    active: true,
    sortOrder: 4,
  };

  assert.equal(canProcessPcnDossierRequirement(samplingDossier, intakeRequirement), true);
  assert.equal(canProcessPcnDossierRequirement(samplingDossier, labRequirement), true);
  assert.equal(canProcessPcnDossierRequirement(samplingDossier, futureResultRequirement), false);
  assert.equal(canProcessPcnOperationalForm(samplingDossier, 'SAMPLE_TAKING'), true);
  assert.equal(canProcessPcnOperationalForm(samplingDossier, 'EVALUATION_REPORT'), false);
  assert.equal(canProcessPcnOperationalForm(samplingDossier, 'COMMERCIAL'), true);
  assert.equal(canCreatePcnLabRequest({ status: 'INTAKE_REVIEW' }), false);
  assert.equal(canCreatePcnLabRequest(samplingDossier), true);
  assert.equal(canCreatePcnLabRequest({ status: 'CORRECTIVE_ACTION' }), true);
  assert.equal(canCreatePcnLabRequest({ status: 'TECHNICAL_REVIEW' }), false);
  assert.equal(canProcessPcnGeneratedDocument(samplingDossier, 'LAB_REQUEST'), true);
  assert.equal(canProcessPcnGeneratedDocument(samplingDossier, 'EVALUATION_REPORT'), false);
  assert.equal(canProcessPcnGeneratedDocument(samplingDossier, 'PROPOSAL_FORM'), true);
});
