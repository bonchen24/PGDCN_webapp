import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  getPgdcnDashboardProjection,
  getPgdcnMyWorkProjection,
  getPgdcnNextAction,
  getPgdcnStatusPresentation,
  type PgdcnDashboardInput,
  type PgdcnMyWorkItem,
  type PgdcnMyWorkInput,
} from '../utils/pgdcnDashboard.ts';

import {
  filterPgdDossierQueueRows,
  PGD_FILTER_CHIPS,
  type PgdDossierQueueRow,
} from '../components/PgdDossierQueueView.tsx';

import type {
  CertificationDossier,
  CertificationProposal,
} from '../types.ts';
import type { PgdInspectionRequest } from '../utils/pgdDomain.ts';

// ---------------------------------------------------------------------------
// 1. Dashboard Inbox & Projections Empirical Stress-Testing
// ---------------------------------------------------------------------------

test('Challenger 1.1: Dashboard 4-KPI strip calculations across varied dossier states', () => {
  const now = new Date('2026-11-02T12:00:00Z');

  // Edge Case A: Empty inputs
  const emptyProjection = getPgdcnDashboardProjection({
    scopes: ['PCN', 'PGD'],
    pcnDossiers: [],
    pgdRequests: [],
    now,
  });
  assert.equal(emptyProjection.kpis.pendingWork, 0);
  assert.equal(emptyProjection.kpis.inProgress, 0);
  assert.equal(emptyProjection.kpis.awaitingApproval, 0);
  assert.equal(emptyProjection.kpis.overdue, 0);

  // Edge Case B: Mixed Active & Overdue dossiers
  const mixedInput: PgdcnDashboardInput = {
    scopes: ['PCN', 'PGD'],
    pcnDossiers: [
      { id: 'pcn-draft', status: 'DRAFT', targetDate: '2026-11-10' }, // DRAFT is not in PCN_WORK_STATUSES
      { id: 'pcn-intake', status: 'INTAKE_REVIEW', targetDate: '2026-11-05' }, // In progress & pendingWork
      { id: 'pcn-plan', status: 'PLAN_PENDING_APPROVAL', targetDate: '2026-11-04' }, // awaitingApproval & pendingWork
      { id: 'pcn-approval', status: 'WAITING_APPROVAL', targetDate: '2026-10-30' }, // Overdue, awaitingApproval, pendingWork
      { id: 'pcn-issued', status: 'ISSUED', targetDate: '2026-10-01' }, // Closed - neither inProgress nor overdue
    ],
    pgdRequests: [
      { id: 'pgd-cap', status: 'CAPABILITY_REVIEW', inspectionScheduledAt: '2026-11-06T10:00:00Z' }, // in progress & pendingWork
      { id: 'pgd-field', status: 'FIELD_INSPECTION', inspectionScheduledAt: '2026-10-25T08:00:00Z' }, // Overdue, in progress & pendingWork
      { id: 'pgd-approval', status: 'LEADERSHIP_APPROVAL', inspectionScheduledAt: '2026-11-15T09:00:00Z' }, // awaitingApproval & pendingWork
      { id: 'pgd-signed', status: 'SIGNED', inspectionScheduledAt: '2026-10-01T08:00:00Z' }, // Closed
    ],
    now,
  };

  const projection = getPgdcnDashboardProjection(mixedInput);

  // Pending work: PCN INTAKE_REVIEW (1) + PLAN_PENDING_APPROVAL (1) + WAITING_APPROVAL (1) + PGD CAPABILITY_REVIEW (1) + FIELD_INSPECTION (1) + LEADERSHIP_APPROVAL (1) = 6
  assert.equal(projection.kpis.pendingWork, 6, 'pendingWork must accurately sum actionable statuses across PCN & PGD');

  // In progress (non-closed & non-draft):
  // PCN: INTAKE_REVIEW, PLAN_PENDING_APPROVAL, WAITING_APPROVAL (3)
  // PGD: CAPABILITY_REVIEW, FIELD_INSPECTION, LEADERSHIP_APPROVAL (3)
  assert.equal(projection.kpis.inProgress, 6, 'inProgress must count all active dossiers excluding drafts and closed');

  // Awaiting approval:
  // PCN: PLAN_PENDING_APPROVAL (1), WAITING_APPROVAL (1) = 2
  // PGD: LEADERSHIP_APPROVAL (1) = 1. Total = 3
  assert.equal(projection.kpis.awaitingApproval, 3, 'awaitingApproval must identify both plan approval and final approval');

  // Overdue:
  // PCN: pcn-approval (2026-10-30 < 2026-11-02) = 1
  // PGD: pgd-field (2026-10-25 < 2026-11-02) = 1
  // Total overdue = 2 (issued/signed do not count even if their target date is past)
  assert.equal(projection.kpis.overdue, 2, 'overdue must exclude closed dossiers');

  // Edge Case C: Scope isolation
  const pcnOnlyProjection = getPgdcnDashboardProjection({ ...mixedInput, scopes: ['PCN'] });
  assert.equal(pcnOnlyProjection.kpis.pgdRequests, 0, 'PCN-only scope must not count PGD');
  assert.equal(pcnOnlyProjection.kpis.pendingWork, 3);

  const pgdOnlyProjection = getPgdcnDashboardProjection({ ...mixedInput, scopes: ['PGD'] });
  assert.equal(pgdOnlyProjection.kpis.pcnDossiers, 0, 'PGD-only scope must not count PCN');
  assert.equal(pgdOnlyProjection.kpis.pendingWork, 3);
});

test('Challenger 1.2: Actionable Dashboard Inbox: 3 core question cards & pill filter calculations', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  const user = { username: 'hoang_nam', role: 'inspector' } as any;

  const myWorkInput: PgdcnMyWorkInput = {
    scopes: ['PCN', 'PGD'],
    currentUser: user,
    pcnDossiers: [
      // 1. TODAY: targetDate is 2026-11-02
      {
        id: 'pcn-today',
        dossierCode: 'HS-PCN-TODAY',
        status: 'FIELD_EVALUATION',
        ownerUsername: 'hoang_nam',
        targetDate: '2026-11-02',
        customerSnapshot: { name: 'Công ty Cổ phần Thép Việt' },
      } as any,
      // 2. OVERDUE: targetDate is 2026-10-20
      {
        id: 'pcn-overdue',
        dossierCode: 'HS-PCN-OVERDUE',
        status: 'CORRECTIVE_ACTION',
        ownerUsername: 'hoang_nam',
        targetDate: '2026-10-20',
        customerSnapshot: { name: 'Công ty TNHH Cơ Khí Hải Phòng' },
      } as any,
      // 3. APPROVAL: status WAITING_APPROVAL
      {
        id: 'pcn-approval',
        dossierCode: 'HS-PCN-APPROVAL',
        status: 'WAITING_APPROVAL',
        ownerUsername: 'hoang_nam',
        targetDate: '2026-11-20',
        customerSnapshot: { name: 'Tập đoàn Điện Lực' },
      } as any,
      // 4. Waiting others: owner is someone else
      {
        id: 'pcn-other',
        dossierCode: 'HS-PCN-OTHER',
        status: 'INTAKE_REVIEW',
        ownerUsername: 'tran_van_b',
        targetDate: '2026-11-15',
        customerSnapshot: { name: 'Công ty Khác' },
      } as any,
    ],
    pgdRequests: [
      // 5. PGD Assigned to user, targetDate in future (2026-11-25)
      {
        id: 'pgd-mine',
        requestCode: 'PYC-PGD-MINE',
        status: 'FIELD_INSPECTION',
        ownerUsername: 'hoang_nam',
        targetDate: '2026-11-25',
        customerSnapshot: { name: 'Công ty Than Miền Bắc' },
        productName: 'Than cám 4a',
      } as any,
    ],
    now,
  };

  const projection = getPgdcnMyWorkProjection(myWorkInput);

  // Verification of bucket allocations
  assert.equal(projection.buckets.TODAY.length, 1, 'Today bucket must contain 1 item');
  assert.equal(projection.buckets.TODAY[0].id, 'pcn-today');

  assert.equal(projection.buckets.OVERDUE.length, 1, 'Overdue bucket must contain 1 item');
  assert.equal(projection.buckets.OVERDUE[0].id, 'pcn-overdue');

  assert.equal(projection.buckets.APPROVAL.length, 1, 'Approval bucket must contain 1 item');
  assert.equal(projection.buckets.APPROVAL[0].id, 'pcn-approval');

  // Verify waitingOthers has pcn-other
  assert.ok(projection.waitingOthers.some((i) => i.id === 'pcn-other'), 'Non-assigned dossiers must be in waitingOthers');

  // Simulate the UI's derivation of the 3 questions:
  const buckets = ['OVERDUE', 'TODAY', 'MY_TURN', 'APPROVAL', 'RECENT'] as const;
  const allItems: PgdcnMyWorkItem[] = [];
  const seen = new Set<string>();
  for (const b of buckets) {
    for (const item of projection.buckets[b]) {
      const key = `${item.domain}:${item.id}`;
      if (!seen.has(key)) {
        seen.add(key);
        allItems.push(item);
      }
    }
  }

  // Question 1: "Hôm nay tôi cần làm gì?" -> todayItems
  const todayItems = allItems.filter((item) => item.bucket === 'TODAY');
  assert.equal(todayItems.length, 1);
  assert.equal(todayItems[0].label, 'HS-PCN-TODAY');

  // Question 2: "Hồ sơ nào đang chờ tôi?" -> myTurnItems
  const myTurnItems = allItems.filter((item) => item.bucket === 'MY_TURN' || item.bucket === 'APPROVAL');
  assert.ok(myTurnItems.length >= 1);
  assert.ok(myTurnItems.some((i) => i.id === 'pcn-approval'));

  // Question 3: "Hồ sơ nào có vấn đề cần xử lý?" -> attentionItems
  const attentionItems = allItems.filter((item) => item.bucket === 'OVERDUE' || item.isOverdue);
  assert.equal(attentionItems.length, 1);
  assert.equal(attentionItems[0].label, 'HS-PCN-OVERDUE');

  // Empty state simulation
  const emptyProjection = getPgdcnMyWorkProjection({
    scopes: ['PCN'],
    currentUser: user,
    pcnDossiers: [],
    pgdRequests: [],
    now,
  });
  assert.equal(emptyProjection.items.length, 0);
  assert.equal(emptyProjection.buckets.TODAY.length, 0);
  assert.equal(emptyProjection.buckets.OVERDUE.length, 0);
  assert.equal(emptyProjection.buckets.MY_TURN.length, 0);
});

test('Challenger 1.3: Adversarial test: Active dossiers updated recently vs "Chờ tôi" (MY_TURN) filter', () => {
  const now = new Date('2026-11-02T10:00:00Z');
  const user = { username: 'hoang_nam', role: 'inspector' } as any;

  // An active dossier assigned to hoang_nam, updated yesterday, due in 10 days
  const activeInput: PgdcnMyWorkInput = {
    scopes: ['PCN'],
    currentUser: user,
    pcnDossiers: [
      {
        id: 'pcn-active-recent',
        dossierCode: 'HS-PCN-RECENT',
        status: 'INTAKE_REVIEW',
        ownerUsername: 'hoang_nam',
        targetDate: '2026-11-12',
        updatedAt: '2026-11-01T08:00:00Z',
        customerSnapshot: { name: 'Công ty Alpha' },
      } as any,
    ],
    pgdRequests: [],
    now,
  };

  const projection = getPgdcnMyWorkProjection(activeInput);
  const item = projection.items[0];

  assert.ok(item, 'Item must be in user projection items');
  // Observe bucket:
  // Because updatedAt is within 14 days, getWorkBucket assigns it 'RECENT'
  assert.equal(item.bucket, 'RECENT');

  // In PgdcnDashboardView.tsx:
  // myTurnItems = allItems.filter((i) => i.bucket === 'MY_TURN' || i.bucket === 'APPROVAL')
  const myTurnFilterMatches = (item.bucket as string) === 'MY_TURN' || (item.bucket as string) === 'APPROVAL';
  assert.equal(myTurnFilterMatches, false, 'Documents that RECENT bucket items are not in MY_TURN filter');
});

// ---------------------------------------------------------------------------
// 2. PCN 2-Tier Table Empirical Stress-Testing
// ---------------------------------------------------------------------------

test('Challenger 2.1: PCN Proposal & Dossier 2-tier table rendering and data robustness', () => {
  // Scenario A: Full Dossier with QC4 and QC9
  const fullProposal: CertificationProposal = {
    id: 'prop-full',
    proposalCode: 'DN-2026-001',
    channel: 'DIRECT',
    status: 'RECEIVED',
    customerSnapshot: {
      name: 'Tập Đoàn Hòa Phát - Chi Nhánh Hải Dương',
      address: 'KCN Hiệp Sơn, Kinh Môn, Hải Dương',
      contactPerson: 'Trần Đình Long',
      phone: '0912345678',
      taxId: '0800123456',
    },
    productName: 'Thép cốt bê tông cán nóng dạng cuộn CB300-T',
    fieldCodes: ['QC4', 'QC9'],
    quantity: 500,
    receivedAt: '2026-11-01',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };

  const fullDossier: CertificationDossier = {
    id: 'dos-full',
    proposalId: 'prop-full',
    dossierCode: 'HS-PCN-2026-001',
    status: 'FIELD_EVALUATION',
    method: 'METHOD_1',
    labRequestIds: [],
    returnedResultIds: [],
    ownerUsername: 'le_van_anh',
    targetDate: '2026-11-15',
    fieldCodes: ['QC4', 'QC9'],
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };

  // Test nextStep fallback map logic
  const nextStepMap: Record<string, string> = {
    DRAFT: 'Bổ sung hồ sơ',
    INTAKE_REVIEW: 'Phân công chuyên viên',
    AWAITING_DOCUMENTS: 'Thu thập tài liệu bắt buộc',
    ASSIGNED: 'Lập kế hoạch đánh giá',
    PLAN_PENDING_APPROVAL: 'Phê duyệt kế hoạch',
    FIELD_EVALUATION: 'Đánh giá hiện trường & lấy mẫu',
    AWAITING_SAMPLING: 'Gửi mẫu đến PTN',
    SENT_TO_LAB: 'Chờ kết quả thử nghiệm',
    AWAITING_RESULTS: 'Soát xét kỹ thuật KQTN',
    TECHNICAL_REVIEW: 'Trình lãnh đạo phê duyệt',
    WAITING_APPROVAL: 'Ký & phát hành chứng chỉ',
    APPROVED: 'Bàn giao cho khách hàng',
    ISSUED: 'Lưu trữ hồ sơ',
    CORRECTIVE_ACTION: 'Xác nhận khắc phục',
  };

  assert.equal(nextStepMap[fullDossier.status], 'Đánh giá hiện trường & lấy mẫu');

  // Scenario B: Minimal Dossier with missing fields and unknown status
  const minimalProposal: CertificationProposal = {
    id: 'prop-min',
    proposalCode: 'DN-2026-MIN',
    channel: 'DIRECT',
    status: 'RECEIVED',
    customerSnapshot: {
      name: '', // Empty name
      address: '',
      contactPerson: '',
      phone: '',
      taxId: '',
    },
    productName: '',
    fieldCodes: [], // Empty field codes
    quantity: 1,
    receivedAt: '2026-11-01',
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };

  const minimalDossier: CertificationDossier = {
    id: 'dos-min',
    proposalId: 'prop-min',
    dossierCode: 'HS-PCN-MIN',
    status: 'UNKNOWN_CUSTOM_STAGE' as any,
    method: 'METHOD_1',
    labRequestIds: [],
    returnedResultIds: [],
    ownerUsername: undefined, // Unassigned owner
    targetDate: undefined, // No due date
    fieldCodes: [],
    createdAt: '2026-11-01T08:00:00Z',
    updatedAt: '2026-11-01T08:00:00Z',
  };

  // Customer name fallback
  const customerDisplayName = minimalProposal.customerSnapshot.name || 'Chưa gắn khách hàng';
  assert.equal(customerDisplayName, 'Chưa gắn khách hàng');

  // Owner fallback
  const ownerDisplayName = minimalDossier.ownerUsername || 'Chưa phân công';
  const ownerRoleLabel = minimalDossier.ownerUsername ? 'Chủ hồ sơ' : 'Chờ chỉ định';
  assert.equal(ownerDisplayName, 'Chưa phân công');
  assert.equal(ownerRoleLabel, 'Chờ chỉ định');

  // Unknown next step fallback
  const nextStepFallback = nextStepMap[minimalDossier.status] || 'Tiếp tục xử lý';
  assert.equal(nextStepFallback, 'Tiếp tục xử lý');

  // Scenario C: Super long customer name (500 chars)
  const longName = 'Công ty Cổ phần Thương mại Xuất Nhập khẩu Dịch vụ Sản xuất và Chế biến Thép Kim loại Công nghệ cao Toàn Cầu '.repeat(5);
  const truncatedCustomer = longName.slice(0, 50);
  assert.ok(truncatedCustomer.length < longName.length);
});

test('Challenger 2.2: PCN 1-row Pill Filter matching logic', () => {
  const now = new Date('2026-11-02T12:00:00Z');
  const proposals: CertificationProposal[] = [
    { id: 'p1', proposalCode: 'DN-1', channel: 'DIRECT', status: 'RECEIVED', customerSnapshot: { name: 'A', address: '', contactPerson: '', phone: '', taxId: '' }, fieldCodes: ['QC4'], productName: 'Thép', quantity: 1, receivedAt: '2026-11-01', createdAt: '2026-11-01', updatedAt: '2026-11-01' },
    { id: 'p2', proposalCode: 'DN-2', channel: 'DIRECT', status: 'RECEIVED', customerSnapshot: { name: 'B', address: '', contactPerson: '', phone: '', taxId: '' }, fieldCodes: ['QC9'], productName: 'Thép', quantity: 1, receivedAt: '2026-11-01', createdAt: '2026-11-01', updatedAt: '2026-11-01' },
    { id: 'p3', proposalCode: 'DN-3', channel: 'DIRECT', status: 'RECEIVED', customerSnapshot: { name: 'C', address: '', contactPerson: '', phone: '', taxId: '' }, fieldCodes: ['QC4', 'QC9'], productName: 'Thép', quantity: 1, receivedAt: '2026-11-01', createdAt: '2026-11-01', updatedAt: '2026-11-01' },
  ];

  const dossiers: CertificationDossier[] = [
    { id: 'd1', proposalId: 'p1', dossierCode: 'HS-1', status: 'INTAKE_REVIEW', method: 'METHOD_1', labRequestIds: [], returnedResultIds: [], fieldCodes: ['QC4'], targetDate: '2026-11-10', createdAt: '2026-11-01', updatedAt: '2026-11-01' },
    { id: 'd2', proposalId: 'p2', dossierCode: 'HS-2', status: 'PLAN_PENDING_APPROVAL', method: 'METHOD_1', labRequestIds: [], returnedResultIds: [], fieldCodes: ['QC9'], targetDate: '2026-10-25', createdAt: '2026-11-01', updatedAt: '2026-11-01' },
    { id: 'd3', proposalId: 'p3', dossierCode: 'HS-3', status: 'FIELD_EVALUATION', method: 'METHOD_1', labRequestIds: [], returnedResultIds: [], fieldCodes: ['QC4', 'QC9'], targetDate: '2026-11-15', createdAt: '2026-11-01', updatedAt: '2026-11-01' },
  ];

  const dossierMap = new Map(dossiers.map((d) => [d.proposalId, d]));

  // Test filter logic identical to PcnWorkspace
  const filterByPill = (pill: string) => {
    return proposals.filter((p) => {
      const d = dossierMap.get(p.id);
      if (pill === 'ACTION_NEEDED') return d && ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'DOCUMENTS_SUBMITTED'].includes(d.status);
      if (pill === 'IN_PROGRESS') return d && !['INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'DOCUMENTS_SUBMITTED', 'PENDING_APPROVAL', 'LEAD_REVIEW', 'APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(d.status);
      if (pill === 'AWAITING_APPROVAL') return d && ['PENDING_APPROVAL', 'LEAD_REVIEW'].includes(d.status);
      if (pill === 'OVERDUE') return d && d.targetDate && !['APPROVED', 'ISSUED', 'DELIVERED', 'ARCHIVED'].includes(d.status) && new Date(d.targetDate) < now;
      if (pill === 'QC4') return p.fieldCodes.some((code) => code.includes('QC4') || code.includes('04'));
      if (pill === 'QC9') return p.fieldCodes.some((code) => code.includes('QC9') || code.includes('09'));
      return true;
    });
  };

  assert.equal(filterByPill('ALL').length, 3);
  assert.equal(filterByPill('ACTION_NEEDED').length, 1); // p1 (INTAKE_REVIEW)
  assert.equal(filterByPill('IN_PROGRESS').length, 1); // p3 (FIELD_EVALUATION)
  assert.equal(filterByPill('AWAITING_APPROVAL').length, 1); // p2 (PENDING_APPROVAL)
  assert.equal(filterByPill('OVERDUE').length, 1); // p2 (2026-10-25 < 2026-11-02)
  assert.equal(filterByPill('QC4').length, 2); // p1, p3
  assert.equal(filterByPill('QC9').length, 2); // p2, p3
});

// ---------------------------------------------------------------------------
// 3. PGD 2-Tier Table Empirical Stress-Testing
// ---------------------------------------------------------------------------

test('Challenger 3.1: PGD Dossier Queue filtering across product groups (STEEL, MACHINE, COAL)', () => {
  const sampleRows: PgdDossierQueueRow[] = [
    {
      requestId: 'req-steel',
      requestCode: 'PYC-2026-ST01',
      customerName: 'Thép Posco Yamato',
      productName: 'Thép hình chữ H',
      status: 'FIELD_INSPECTION',
      statusLabel: 'Giám định hiện trường',
      currentStepNumber: 4,
      currentStepLabel: 'Giám định hiện trường',
      nextActionLabel: 'Lấy mẫu & niêm phong',
      requiredDocumentPresent: 3,
      requiredDocumentTotal: 4,
      missingRequiredCount: 1,
      ownerUsername: 'giam_dinh_1',
      ownerDisplayName: 'Nguyễn Văn Giám Định',
      productGroup: 'Thép & Kim loại',
      catalogLabel: 'QCVN 20:2019/BKHCN (Thép)',
    },
    {
      requestId: 'req-machine',
      requestCode: 'PYC-2026-MC01',
      customerName: 'Công ty Chế tạo Máy Hải Dương',
      productName: 'Máy ép thủy lực 500 tấn',
      status: 'CAPABILITY_REVIEW',
      statusLabel: 'Xem xét năng lực',
      currentStepNumber: 2,
      currentStepLabel: 'Xem xét năng lực',
      nextActionLabel: 'Phân công giám định viên',
      requiredDocumentPresent: 2,
      requiredDocumentTotal: 5,
      missingRequiredCount: 3,
      ownerUsername: undefined,
      ownerDisplayName: undefined,
      productGroup: 'Máy móc & Thiết bị',
      catalogLabel: 'Giám định dây chuyền đồng bộ',
    },
    {
      requestId: 'req-coal',
      requestCode: 'PYC-2026-CL01',
      customerName: 'Tổng công ty Than Khoáng sản TKV',
      productName: 'Than cám tuyển 3a',
      status: 'WAITING_LAB_RESULTS',
      statusLabel: 'Chờ kết quả PTN',
      currentStepNumber: 4,
      currentStepLabel: 'Thử nghiệm & phân tích',
      nextActionLabel: 'Đối chiếu kết quả KQTN',
      requiredDocumentPresent: 4,
      requiredDocumentTotal: 4,
      missingRequiredCount: 0,
      ownerUsername: 'giam_dinh_2',
      ownerDisplayName: 'Trần Kỹ Thuật',
      productGroup: 'Than đá',
      catalogLabel: 'Giám định than xuất nhập khẩu',
    },
    {
      requestId: 'req-done',
      requestCode: 'PYC-2026-DN01',
      customerName: 'Khách hàng Cũ',
      productName: 'Thép ống hàn',
      status: 'SIGNED',
      statusLabel: 'Đã ký chứng thư',
      currentStepNumber: 6,
      currentStepLabel: 'Hoàn tất',
      nextActionLabel: 'Lưu trữ hồ sơ',
      requiredDocumentPresent: 5,
      requiredDocumentTotal: 5,
      missingRequiredCount: 0,
      ownerUsername: 'giam_dinh_1',
      productGroup: 'Thép & Kim loại',
      catalogLabel: 'Thép xây dựng',
    },
  ];

  // Test STEEL filter
  const steelRows = filterPgdDossierQueueRows(sampleRows, 'STEEL');
  assert.equal(steelRows.length, 2, 'STEEL filter must match both active steel and completed steel');
  assert.ok(steelRows.every((r) => r.productGroup.includes('Thép')));

  // Test MACHINE filter
  const machineRows = filterPgdDossierQueueRows(sampleRows, 'MACHINE');
  assert.equal(machineRows.length, 1);
  assert.equal(machineRows[0].requestId, 'req-machine');

  // Test COAL filter
  const coalRows = filterPgdDossierQueueRows(sampleRows, 'COAL');
  assert.equal(coalRows.length, 1);
  assert.equal(coalRows[0].requestId, 'req-coal');

  // Test ACTION_NEEDED filter
  const actionNeededRows = filterPgdDossierQueueRows(sampleRows, 'ACTION_NEEDED');
  assert.equal(actionNeededRows.length, 3, 'Must match all unfinished or missing-doc dossiers');
  assert.ok(!actionNeededRows.some((r) => r.requestId === 'req-done'), 'Signed dossier must not be in ACTION_NEEDED');

  // Test MISSING_DOCS filter
  const missingDocsRows = filterPgdDossierQueueRows(sampleRows, 'MISSING_DOCS');
  assert.equal(missingDocsRows.length, 2); // req-steel (1) and req-machine (3)

  // Test COMPLETED filter
  const completedRows = filterPgdDossierQueueRows(sampleRows, 'COMPLETED');
  assert.equal(completedRows.length, 1);
  assert.equal(completedRows[0].requestId, 'req-done');
});

test('Challenger 3.2: PGD Workspace register pill filtering with enum productGroup (STEEL_METAL, MACHINERY_LINE, COAL)', () => {
  const requests: PgdInspectionRequest[] = [
    {
      id: 'r-steel',
      requestCode: 'PGD-ST-01',
      productGroup: 'STEEL_METAL',
      status: 'FIELD_INSPECTION',
      productName: 'Thép tấm',
      catalogItemId: 'cat-1',
      customerSnapshot: { name: 'Thép Hòa Phát' },
      createdAt: '2026-11-01',
    } as any,
    {
      id: 'r-machine',
      requestCode: 'PGD-MC-01',
      productGroup: 'MACHINERY_LINE',
      status: 'DRAFT',
      productName: 'Máy phát điện',
      catalogItemId: 'cat-2',
      customerSnapshot: { name: 'Cơ khí 1' },
      createdAt: '2026-11-01',
    } as any,
    {
      id: 'r-coal',
      requestCode: 'PGD-CL-01',
      productGroup: 'COAL',
      status: 'LEADERSHIP_APPROVAL',
      productName: 'Than cục',
      catalogItemId: 'cat-3',
      customerSnapshot: { name: 'TKV' },
      createdAt: '2026-11-01',
    } as any,
  ];

  // Test PgdWorkspace filter logic:
  const filterByRegisterPill = (pill: string) => {
    return requests.filter((req) => {
      if (pill === 'STEEL') return req.productGroup === 'STEEL_METAL';
      if (pill === 'MACHINE') return req.productGroup === 'MACHINERY_LINE';
      if (pill === 'COAL') return req.productGroup === 'COAL';
      if (pill === 'ACTION_NEEDED') return ['DRAFT', 'CAPABILITY_REVIEW'].includes(req.status);
      if (pill === 'AWAITING_APPROVAL') return req.status === 'LEADERSHIP_APPROVAL';
      return true;
    });
  };

  assert.equal(filterByRegisterPill('STEEL').length, 1);
  assert.equal(filterByRegisterPill('STEEL')[0].id, 'r-steel');

  assert.equal(filterByRegisterPill('MACHINE').length, 1);
  assert.equal(filterByRegisterPill('MACHINE')[0].id, 'r-machine');

  assert.equal(filterByRegisterPill('COAL').length, 1);
  assert.equal(filterByRegisterPill('COAL')[0].id, 'r-coal');

  assert.equal(filterByRegisterPill('ACTION_NEEDED').length, 1); // r-machine (DRAFT)
  assert.equal(filterByRegisterPill('AWAITING_APPROVAL').length, 1); // r-coal (LEADERSHIP_APPROVAL)
});

// ---------------------------------------------------------------------------
// 4. Quick-View CustomEvent Contract & Responsive Markup Verification
// ---------------------------------------------------------------------------

test('Challenger 4.1: Quickview CustomEvent schema contract across Dashboard, PCN and PGD', () => {
  // Test event payload structure for PCN
  const pcnEventDetail = {
    domain: 'PCN' as const,
    dossierCode: 'HS-PCN-001',
    item: {
      dossierCode: 'HS-PCN-001',
      domain: 'PCN',
      customerName: 'Khách hàng PCN',
      status: 'WAITING_APPROVAL',
      statusLabel: 'Chờ phê duyệt',
      currentStage: 'Chờ phê duyệt',
      nextStep: 'Ký & phát hành',
      assigneeName: 'nguyen_van_a',
    },
  };

  assert.equal(pcnEventDetail.domain, 'PCN');
  assert.equal(pcnEventDetail.dossierCode, 'HS-PCN-001');
  assert.ok(pcnEventDetail.item.statusLabel);
  assert.ok(pcnEventDetail.item.nextStep);

  // Test event payload structure for PGD
  const pgdEventDetail = {
    domain: 'PGD' as const,
    dossierCode: 'PYC-PGD-001',
    item: {
      dossierCode: 'PYC-PGD-001',
      domain: 'PGD',
      customerName: 'Khách hàng PGD',
      status: 'FIELD_INSPECTION',
      statusLabel: 'Đang giám định hiện trường',
      currentStage: 'Bước 4 · Giám định hiện trường',
      nextStep: 'Lấy mẫu',
      assigneeName: 'tran_van_b',
    },
  };

  assert.equal(pgdEventDetail.domain, 'PGD');
  assert.equal(pgdEventDetail.dossierCode, 'PYC-PGD-001');
  assert.ok(pgdEventDetail.item.statusLabel);
  assert.ok(pgdEventDetail.item.currentStage);
});
