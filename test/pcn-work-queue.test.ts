import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal, PcnDossierDocument, PcnDocumentRequirement } from '../types.ts';
import { buildPcnWorkQueueRows, filterPcnWorkQueueRows } from '../utils/pcnWorkQueue.ts';

const workQueueView = fs.readFileSync(new URL('../components/PcnWorkQueueView.tsx', import.meta.url), 'utf8');
const workspaceView = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const labRequestView = fs.readFileSync(new URL('../components/PcnLabRequestView.tsx', import.meta.url), 'utf8');
const resultReturnView = fs.readFileSync(new URL('../components/PcnResultReturnView.tsx', import.meta.url), 'utf8');
const issuanceView = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
const sampleFlowView = fs.readFileSync(new URL('../components/PcnSampleFlowView.tsx', import.meta.url), 'utf8');

const proposals: CertificationProposal[] = [
  {
    id: 'proposal-1', proposalCode: 'DN-001', channel: 'DIRECT', status: 'CONVERTED',
    customerSnapshot: { name: 'Công ty Alpha', address: 'Hà Nội' }, productName: 'Thiết bị A',
    quantity: 1, fieldCodes: ['QC4'], receivedAt: '2026-08-01T00:00:00.000Z',
  },
  {
    id: 'proposal-2', proposalCode: 'DN-002', channel: 'EMAIL', status: 'CONVERTED',
    customerSnapshot: { name: 'Công ty Beta', address: 'Hà Nội' }, productName: 'Thiết bị B',
    quantity: 1, fieldCodes: ['QC9'], receivedAt: '2026-08-02T00:00:00.000Z',
  },
];

const dossiers: CertificationDossier[] = [
  {
    id: 'dossier-1', dossierCode: 'HS-001', proposalId: 'proposal-1', fieldCodes: ['QC4'], method: 'METHOD_1',
    status: 'FIELD_EVALUATION', evaluatorUsername: 'nguyenvana', targetDate: '2026-08-27T00:00:00.000Z',
    labRequestIds: [], returnedResultIds: [], updatedAt: '2026-08-26T00:00:00.000Z',
  },
  {
    id: 'dossier-2', dossierCode: 'HS-002', proposalId: 'proposal-2', fieldCodes: ['QC9'], method: 'METHOD_5',
    status: 'WAITING_APPROVAL', reviewerUsername: 'reviewer-1', targetDate: '2026-08-30T00:00:00.000Z',
    labRequestIds: [], returnedResultIds: [], updatedAt: '2026-08-25T00:00:00.000Z',
  },
  {
    id: 'dossier-3', dossierCode: 'HS-003', proposalId: 'proposal-1', fieldCodes: ['QC4'], method: 'METHOD_1',
    status: 'AWAITING_RESULTS', targetDate: 'not-a-date', labRequestIds: [], returnedResultIds: [],
    updatedAt: '2026-08-28T00:00:00.000Z',
  },
  {
    id: 'dossier-4', dossierCode: 'HS-004', proposalId: 'proposal-1', fieldCodes: ['QC4'], method: 'METHOD_1',
    status: 'ARCHIVED', labRequestIds: [], returnedResultIds: [], updatedAt: '2026-08-28T00:00:00.000Z',
  },
];

test('work queue maps lifecycle steps, urgency, assignment and excludes closed dossiers', () => {
  const rows = buildPcnWorkQueueRows({
    dossiers,
    proposals,
    currentUsername: 'NGUYENVANA',
    now: '2026-08-28T00:00:00.000Z',
  });

  assert.deepEqual(rows.map((row) => row.dossierId), ['dossier-1', 'dossier-2', 'dossier-3']);
  assert.equal(rows[0].stepLabel, 'Đánh giá hiện trường');
  assert.equal(rows[0].targetSection, 'fields');
  assert.equal(rows[0].priority, 'OVERDUE');
  assert.equal(rows[0].assignedToCurrentUser, true);
  assert.equal(rows[1].stepLabel, 'Phê duyệt hồ sơ');
  assert.equal(rows[1].targetSection, 'issuance');
  assert.equal(rows[1].priority, 'DUE_SOON');
  assert.equal(rows[1].assignedToCurrentUser, false);
  assert.equal(rows[2].priority, 'NORMAL');
  assert.equal(rows[2].targetDate, undefined);
});

test('work queue projects the same dossier completeness and station missing labels', () => {
  const requirements: PcnDocumentRequirement[] = [
    { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
    { id: 'QC4-REPORT', fieldCode: 'QC4', code: 'TEST_REPORT', name: 'KQTN', stages: ['TECHNICAL_REVIEW'], required: true, active: true, sortOrder: 2 },
    { id: 'QC4-RETIRED', fieldCode: 'QC4', code: 'OLD', name: 'Mục đã ngừng dùng', stages: ['INTAKE'], required: true, active: false, sortOrder: 3 },
  ];
  const documents: PcnDossierDocument[] = [{
    id: 'document-proposal', dossierId: 'dossier-1', requirementId: 'QC4-PROPOSAL', fieldCode: 'QC4', status: 'PRESENT', currentVersionId: 'asset-proposal',
    versions: [{ assetId: 'asset-proposal', fileName: 'de-nghi.pdf', uploadedAt: '2026-08-26T00:00:00.000Z' }],
  }];
  const row = buildPcnWorkQueueRows({ dossiers: [dossiers[0]], proposals, currentUsername: 'nguyenvana', documentRequirements: requirements, dossierDocuments: documents })[0];

  assert.equal(row.requiredDocumentTotal, 2);
  assert.equal(row.requiredDocumentPresent, 1);
  assert.equal(row.missingRequiredCount, 1);
  assert.equal(row.completenessScore, 63);
  assert.deepEqual(row.stationMissingLabels, []);
});

test('work queue projects the current station and core metadata gaps for manager triage', () => {
  const row = buildPcnWorkQueueRows({
    dossiers: [{ ...dossiers[0], ownerUsername: undefined }],
    proposals: [{ ...proposals[0], productName: '' }],
    currentUsername: 'nguyenvana',
  })[0];

  assert.equal(row.stationKey, 'EVALUATION');
  assert.equal(row.stationNumber, 4);
  assert.equal(row.stationTitle, 'Đánh giá');
  assert.equal(row.stationActionLabel, 'Ghi nhận đánh giá');
  assert.equal(row.coreFieldTotal, 6);
  assert.equal(row.coreFieldPresent, 4);
  assert.deepEqual(row.missingCoreLabels, ['Sản phẩm', 'Chủ hồ sơ']);
});

test('work queue preserves the single dossier owner separately from step assignee', () => {
  const row = buildPcnWorkQueueRows({
    dossiers: [{ ...dossiers[0], ownerUsername: 'owner-1' }],
    proposals,
  })[0];

  assert.equal(row.ownerUsername, 'owner-1');
  assert.equal(row.assigneeUsername, 'nguyenvana');
  assert.match(workQueueView, /row\.ownerUsername/);
  assert.match(workQueueView, /Chủ hồ sơ/);
});

test('work queue keeps draft and rejected dossiers visible for operational follow-up', () => {
  const rows = buildPcnWorkQueueRows({
    dossiers: [
      { ...dossiers[0], id: 'dossier-draft', dossierCode: 'HS-DRAFT', status: 'DRAFT' },
      { ...dossiers[0], id: 'dossier-rejected', dossierCode: 'HS-REJECTED', status: 'REJECTED' },
    ],
    proposals,
  });

  const byStatus = new Map(rows.map((row) => [row.status, row]));
  assert.equal(byStatus.get('DRAFT')?.stepLabel, 'Hoàn thiện Đề nghị và mở hồ sơ');
  assert.equal(byStatus.get('DRAFT')?.targetSection, 'proposals');
  assert.equal(byStatus.get('REJECTED')?.stepLabel, 'Xử lý hồ sơ bị từ chối');
  assert.equal(byStatus.get('REJECTED')?.targetSection, 'proposals');
});

test('work queue carries required document gaps grouped by document stage', () => {
  const requirements: PcnDocumentRequirement[] = [
    { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
    { id: 'QC4-REPORT', fieldCode: 'QC4', code: 'TEST_REPORT', name: 'KQTN', stages: ['TECHNICAL_REVIEW'], required: true, active: true, sortOrder: 2 },
  ];
  const row = buildPcnWorkQueueRows({ dossiers: [dossiers[0]], proposals, documentRequirements: requirements })[0];

  assert.deepEqual(row.missingRequiredByStage, [
    { stage: 'INTAKE', label: 'Tiếp nhận & đầu vào', labels: ['Đề nghị'] },
    { stage: 'TECHNICAL_REVIEW', label: 'KQTN & đánh giá / hoàn thiện & soát xét trước duyệt', labels: ['KQTN'] },
  ]);
  assert.match(workQueueView, /missingRequiredByStage/);
  assert.match(workQueueView, /Tài liệu bắt buộc còn thiếu/);
});

test('work queue filters only by operational audience and never infers a missing deadline', () => {
  const rows = buildPcnWorkQueueRows({ dossiers, proposals, currentUsername: 'nguyenvana', now: '2026-08-28T00:00:00.000Z' });
  assert.deepEqual(filterPcnWorkQueueRows(rows, { scope: 'MINE' }).map((row) => row.dossierId), ['dossier-1']);
  assert.deepEqual(filterPcnWorkQueueRows(rows, { scope: 'OVERDUE' }).map((row) => row.dossierId), ['dossier-1']);
  assert.equal(filterPcnWorkQueueRows(rows, { scope: 'ALL' }).some((row) => row.dossierId === 'dossier-4'), false);
});

test('historical hold records never enter the active work queue', () => {
  const historicalDossier: CertificationDossier = {
    id: 'dossier-history', dossierCode: 'HS-HISTORY', proposalId: 'proposal-1', fieldCodes: ['QC4'], method: 'METHOD_1',
    status: 'ON_HOLD', labRequestIds: [], returnedResultIds: [], updatedAt: '2026-08-28T01:00:00.000Z',
    historicalImport: {
      batchId: 'batch-1', sourceFamily: 'QC4', sourceFolderName: '0665', sourceRelativePath: '0665',
      reviewStatus: 'PENDING_REVIEW', unresolvedFields: ['method'], importedAt: '2026-08-28T00:00:00.000Z',
    },
  };

  assert.deepEqual(buildPcnWorkQueueRows({ dossiers: [historicalDossier], proposals, now: '2026-08-28T00:00:00.000Z' }), []);
});

test('non-historical hold work opens the dossier operations module', () => {
  const row = buildPcnWorkQueueRows({
    dossiers: [{
      ...dossiers[0],
      id: 'dossier-operational-hold',
      dossierCode: 'HS-OP-HOLD',
      status: 'ON_HOLD',
    }],
    proposals,
    now: '2026-08-28T00:00:00.000Z',
  })[0];

  assert.equal(row.stepLabel, 'Xử lý ngoại lệ hồ sơ');
  assert.equal(row.ownerLabel, 'Lãnh đạo phòng');
  assert.equal(row.targetSection, 'fields');
});

test('work queue evaluates PCN targetDate as a Vietnam calendar date', () => {
  const makeDossier = (id: string, targetDate: string): CertificationDossier => ({
    id,
    dossierCode: id.toUpperCase(),
    proposalId: 'proposal-1',
    fieldCodes: ['QC4'],
    method: 'METHOD_1',
    status: 'FIELD_EVALUATION',
    targetDate,
    labRequestIds: [],
    returnedResultIds: [],
  });
  const rows = buildPcnWorkQueueRows({
    dossiers: [
      makeDossier('today', '2026-08-29'),
      makeDossier('yesterday', '2026-08-28'),
      makeDossier('three-days', '2026-09-01'),
      makeDossier('four-days', '2026-09-02'),
      makeDossier('invalid', '2026-02-30'),
    ],
    now: '2026-08-29T04:00:00.000Z',
  });
  const byId = new Map(rows.map((row) => [row.dossierId, row]));

  assert.equal(byId.get('today')?.priority, 'DUE_SOON');
  assert.equal(byId.get('yesterday')?.priority, 'OVERDUE');
  assert.equal(byId.get('three-days')?.priority, 'DUE_SOON');
  assert.equal(byId.get('four-days')?.priority, 'NORMAL');
  assert.equal(byId.get('invalid')?.priority, 'NORMAL');
  assert.equal(byId.get('invalid')?.targetDate, undefined);
});

test('work queue only assigns the explicit person relevant to the current step', () => {
  const base: CertificationDossier = {
    id: 'assignment-base',
    dossierCode: 'ASSIGNMENT-BASE',
    proposalId: 'proposal-1',
    fieldCodes: ['QC4'],
    method: 'METHOD_1',
    status: 'FIELD_EVALUATION',
    evaluatorUsername: 'evaluator-1',
    reviewerUsername: 'reviewer-1',
    labRequestIds: [],
    returnedResultIds: [],
  };
  const statuses: CertificationDossier['status'][] = [
    'ASSIGNED', 'FIELD_EVALUATION', 'CORRECTIVE_ACTION', 'TECHNICAL_REVIEW',
    'AWAITING_DOCUMENTS', 'PLAN_PENDING_APPROVAL', 'WAITING_APPROVAL', 'SENT_TO_LAB',
    'AWAITING_RESULTS', 'APPROVED', 'ISSUED', 'DELIVERED', 'ON_HOLD',
  ];
  const rows = buildPcnWorkQueueRows({
    dossiers: statuses.map((status) => ({ ...base, id: `assignment-${status}`, dossierCode: `ASSIGNMENT-${status}`, status })),
    proposals,
  });
  const byStatus = new Map(rows.map((row) => [row.status, row]));

  assert.equal(byStatus.get('ASSIGNED')?.assigneeUsername, 'evaluator-1');
  assert.equal(byStatus.get('FIELD_EVALUATION')?.assigneeUsername, 'evaluator-1');
  assert.equal(byStatus.get('CORRECTIVE_ACTION')?.assigneeUsername, 'evaluator-1');
  assert.equal(byStatus.get('TECHNICAL_REVIEW')?.assigneeUsername, 'reviewer-1');
  for (const status of ['AWAITING_DOCUMENTS', 'PLAN_PENDING_APPROVAL', 'WAITING_APPROVAL', 'SENT_TO_LAB', 'AWAITING_RESULTS', 'APPROVED', 'ISSUED', 'DELIVERED', 'ON_HOLD'] as const) {
    assert.equal(byStatus.get(status)?.assigneeUsername, undefined, `Không được suy diễn assignee cho ${status}`);
    assert.equal(byStatus.get(status)?.assignedToCurrentUser, false);
  }
});

test('work queue UI states when the group has no individual assignee', () => {
  assert.match(workQueueView, /assignmentLabel/);
  assert.match(workQueueView, /Chưa phân công cá nhân/);
  assert.match(workQueueView, /Nhóm và trạng thái phân công/);
  assert.match(workQueueView, /documentRequirements/);
  assert.match(workQueueView, /dossierDocuments/);
  assert.match(workQueueView, /completenessScore/);
  assert.match(workQueueView, /Tài liệu còn thiếu/);
  assert.match(workQueueView, /row\.stationTitle/);
  assert.match(workQueueView, /row\.stationActionLabel/);
  assert.match(workQueueView, /row\.missingCoreLabels/);
  assert.match(workQueueView, /Xem tất cả/);
});

test('work queue keeps primary filters and dossier actions touch-friendly', () => {
  assert.equal((workQueueView.match(/min-h-11/g) || []).length >= 2, true);
  assert.match(workQueueView, /onOpenDossier: \(dossier: CertificationDossier/);
  assert.match(workQueueView, /onOpenDossier\(dossier\)/);
  assert.match(workQueueView, /Mở hồ sơ/);
  assert.match(workspaceView, /onOpenDossier=\{onOpenDossier\}/);
});

test('work queue lets an eligible staff member claim an unassigned dossier without exposing a transfer action', () => {
  assert.match(workQueueView, /onClaimDossier\?: \(dossier: CertificationDossier\) => Promise<void>/);
  assert.match(workQueueView, /getPcnOwnerAssignmentAuthorityDenial/);
  assert.match(workQueueView, /getPcnDossierAssignmentDenial/);
  assert.match(workQueueView, /!dossier\.ownerUsername/);
  assert.match(workQueueView, /Nhận hồ sơ/);
  assert.match(workQueueView, /Đang nhận/);
  assert.match(workspaceView, /onClaimDossier=\{claimPcnDossier\}/);
});

test('work queue remains a compact priority projection instead of a second dossier card', () => {
  assert.match(workQueueView, /data-testid="pcn-work-queue"/);
  assert.match(workQueueView, /data-testid="pcn-work-queue-row"/);
  assert.match(workQueueView, /Hàng đợi là projection gọn/);
  assert.doesNotMatch(workQueueView, /Thông tin lõi còn thiếu:/);
  assert.doesNotMatch(workQueueView, /Hồ sơ cập nhật gần đây/);
});

test('work queue stays focused on active dossier completeness', () => {
  assert.doesNotMatch(workQueueView, /PcnHistoricalScopeBadge|historicalImport/);
});

test('work queue module targets retain the dossier context in destination views', () => {
  assert.match(workspaceView, /initialDossierId=\{focusedDossierId\}/);
  assert.match(labRequestView, /initialDossierId\?: string/);
  assert.match(labRequestView, /request\.dossierId === initialDossierId/);
  assert.match(resultReturnView, /initialDossierId\?: string/);
  assert.match(resultReturnView, /result\.dossierId === initialDossierId/);
  assert.match(issuanceView, /initialDossierId\?: string/);
  assert.match(issuanceView, /dossier\.id === initialDossierId/);
  assert.match(sampleFlowView, /initialDossierId\?: string/);
  assert.match(sampleFlowView, /lot\.dossierId === initialDossierId/);
});

// --- End of pcn-work-queue.test.ts ---
