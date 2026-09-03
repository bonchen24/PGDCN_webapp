import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { CertificationDossier, PcnUserAccount, ReturnedTestResult } from '../types.ts';
import type { PcnDossierDocumentContext } from '../utils/pcnDocumentGeneration.ts';
import {
  applyPcnApprovalDecision,
  buildPcnApprovalSteps,
  getPcnApprovalDecisionDenial,
  getNextPendingPcnApprovalStep,
  isPcnApprovalComplete,
} from '../utils/pcnApproval.ts';
import {
  buildPcnIssuancePackage,
  getPcnIssuanceOfficialDocumentReadiness,
  getPcnIssuanceReadiness,
  approvePcnIssuancePackage,
  issuePcnIssuancePackage,
  deliverPcnIssuancePackage,
  archivePcnIssuancePackage,
} from '../utils/pcnIssuance.ts';
import { PCN_TEMPLATE_CATALOG } from '../utils/pcnTemplateCatalog.ts';

const dossier: CertificationDossier = {
  id: 'dossier-1',
  dossierCode: 'HS-2026-001',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_5',
  status: 'APPROVED',
  labRequestIds: ['lab-1'],
  returnedResultIds: ['result-1'],
};

const passedResult: ReturnedTestResult = {
  id: 'result-1',
  dossierId: dossier.id,
  labRequestId: 'lab-1',
  round: 1,
  outcome: 'PASS',
  receivedAt: '2026-08-27T08:00:00.000Z',
};

const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

test('creates one effective leadership PCN approval step', () => {
  const steps = buildPcnApprovalSteps('dossier-1', '2026-08-27T08:00:00.000Z');
  assert.equal(steps.length, 1);
  assert.deepEqual(steps.map((step) => step.sequence), [1]);
  assert.equal(steps[0].role, 'Lãnh đạo');
  assert.equal(getNextPendingPcnApprovalStep(steps)?.id, steps[0].id);
});

test('the leadership approval step records approval and return reasons', () => {
  const steps = buildPcnApprovalSteps('dossier-1', '2026-08-27T08:00:00.000Z');
  const approved = applyPcnApprovalDecision(steps, steps[0].id, 'APPROVE', 'Đã kiểm tra', '2026-08-27T08:02:00.000Z');
  assert.equal(approved[0].status, 'APPROVED');
  assert.equal(getNextPendingPcnApprovalStep(approved), undefined);
  assert.equal(isPcnApprovalComplete(approved), true);
  assert.throws(
    () => applyPcnApprovalDecision(approved, steps[0].id, 'APPROVE', undefined, '2026-08-27T08:02:30.000Z'),
    /tuần tự|hoàn tất|pending/i,
  );

  const returned = applyPcnApprovalDecision(steps, steps[0].id, 'RETURN', 'Bổ sung biên bản đánh giá', '2026-08-27T08:03:00.000Z');
  assert.equal(returned[0].status, 'RETURNED');
  assert.equal(returned[0].comment, 'Bổ sung biên bản đánh giá');
  assert.equal(isPcnApprovalComplete(returned), false);
});

test('approval decisions require the assigned or role-appropriate PCN actor', () => {
  const steps = buildPcnApprovalSteps('dossier-1', '2026-08-27T08:00:00.000Z');
  const expert: PcnUserAccount = { username: 'expert', name: 'Chuyên gia', role: 'staff', systemRole: 'staff', departmentRoleCode: 'CERTIFICATION_EXPERT', fieldCodes: ['QC4'], active: true };
  const reviewer: PcnUserAccount = { username: 'reviewer', name: 'Soát xét', role: 'staff', systemRole: 'staff', departmentRoleCode: 'TECHNICAL_REVIEWER', fieldCodes: ['QC4'], active: true };
  const leader: PcnUserAccount = { username: 'leader', name: 'Lãnh đạo', role: 'admin', systemRole: 'admin', departmentRoleCode: 'LEADERSHIP', fieldCodes: ['QC4'], active: true };
  const viewer: PcnUserAccount = { username: 'viewer', name: 'Chỉ xem', role: 'viewer', systemRole: 'viewer', departmentRoleCode: 'LEADERSHIP', fieldCodes: ['QC4'], active: true };
  const leaderOutsideField: PcnUserAccount = { ...leader, username: 'leader-qc9', fieldCodes: ['QC9'] };

  assert.equal(getPcnApprovalDecisionDenial(steps[0], leader), null);
  assert.match(getPcnApprovalDecisionDenial(steps[0], expert) || '', /chức vụ|vai trò/i);
  assert.match(getPcnApprovalDecisionDenial(steps[0], reviewer) || '', /chức vụ|vai trò/i);
  assert.match(getPcnApprovalDecisionDenial(steps[0], viewer) || '', /viewer|đọc|chức vụ|vai trò/i);
  assert.match(getPcnApprovalDecisionDenial({ ...steps[0], assigneeUsername: 'reviewer' }, expert) || '', /đích danh|giao/i);
  assert.match(getPcnApprovalDecisionDenial(steps[0], leaderOutsideField, ['QC4']) || '', /lĩnh vực/i);
});

test('issuance package maps method 5 templates and requires a completed approval chain', () => {
  const issuance = buildPcnIssuancePackage({ id: 'issue-1', dossier, now: '2026-08-27T08:00:00.000Z' });
  assert.equal(issuance.certificateTemplateCode, 'BM-QT-03-02b');
  assert.equal(issuance.decisionTemplateCode, 'BM-QĐ-03-01b');
  assert.equal(issuance.status, 'DRAFT');

  const steps = buildPcnApprovalSteps(dossier.id, '2026-08-27T08:00:00.000Z').map((step) => ({ ...step, status: 'APPROVED' as const }));
  assert.equal(getPcnIssuanceReadiness(dossier, [passedResult], steps).ready, true);
  const approved = approvePcnIssuancePackage(issuance);
  const issued = issuePcnIssuancePackage(approved, {
    issuanceNumber: 'GCN-PCN-2026-001',
    signerUsername: 'authorized-signer',
    issuedAt: '2026-08-27T09:00:00.000Z',
  });
  assert.equal(issued.status, 'ISSUED');
  assert.equal(issued.issuanceNumber, 'GCN-PCN-2026-001');
});

test('issuance package rejects impossible or timezone-free issue dates', () => {
  const approved = approvePcnIssuancePackage(buildPcnIssuancePackage({ id: 'issue-invalid-date', dossier, now: '2026-08-27T08:00:00.000Z' }));
  assert.throws(
    () => issuePcnIssuancePackage(approved, { issuanceNumber: 'GCN-INVALID', signerUsername: 'authorized-signer', issuedAt: '2026-02-30T00:00:00.000Z' }),
    /ngày.*hợp lệ|timestamp/i,
  );
  assert.throws(
    () => issuePcnIssuancePackage(approved, { issuanceNumber: 'GCN-NO-TZ', signerUsername: 'authorized-signer', issuedAt: '2026-08-27T09:00:00' }),
    /ISO-8601|timestamp/i,
  );
});

test('delivery records normalize calendar dates and reject ambiguous or impossible timestamps', () => {
  const issued = issuePcnIssuancePackage({
    ...buildPcnIssuancePackage({ id: 'issue-delivery-date', dossier, now: '2026-08-27T08:00:00.000Z' }),
    status: 'APPROVED',
  }, {
    issuanceNumber: 'GCN-DELIVERY-DATE',
    signerUsername: 'authorized-signer',
    issuedAt: '2026-08-27T09:00:00.000Z',
  });

  assert.equal(deliverPcnIssuancePackage(issued, {
    recipient: 'Công ty TNHH ABC',
    deliveredAt: '2026-08-28',
  }).deliveredAt, '2026-08-28T00:00:00.000Z');
  assert.throws(
    () => deliverPcnIssuancePackage(issued, { recipient: 'Công ty TNHH ABC', deliveredAt: '2026-02-30' }),
    /ngày.*hợp lệ|timestamp/i,
  );
  assert.throws(
    () => deliverPcnIssuancePackage(issued, { recipient: 'Công ty TNHH ABC', deliveredAt: '2026-08-28T09:00:00' }),
    /ISO-8601|timestamp/i,
  );
});

test('issuance readiness blocks while any returned result is still pending', () => {
  const steps = buildPcnApprovalSteps(dossier.id, '2026-08-27T08:00:00.000Z').map((step) => ({ ...step, status: 'APPROVED' as const }));
  const readiness = getPcnIssuanceReadiness(dossier, [
    passedResult,
    { ...passedResult, id: 'result-pending', round: 2, outcome: 'PENDING' as const },
  ], steps);
  assert.equal(readiness.ready, false);
  assert.match(readiness.reasons.join('; '), /chờ bổ sung/i);
});

test('issuance readiness is scoped to the new certification workflow', () => {
  const steps = buildPcnApprovalSteps(dossier.id, '2026-08-27T08:00:00.000Z').map((step) => ({ ...step, status: 'APPROVED' as const }));
  const readiness = getPcnIssuanceReadiness(dossier, [passedResult], steps);
  assert.equal(readiness.ready, true);
  assert.doesNotMatch(readiness.reasons.join('; '), /lịch sử|historical/i);
});

test('issuance document readiness requires approved templates and linked issuance data before cấp số', () => {
  const context = {
    dossierId: dossier.id,
    dossierCode: dossier.dossierCode,
    proposalCode: 'P-2026-001',
    customerName: 'Công ty ABC',
    customerAddress: 'Hà Nội',
    customerTaxId: '',
    customerContactPerson: '',
    customerPhone: '',
    customerEmail: '',
    productName: 'Sản phẩm QC4',
    productType: 'Thiết bị',
    specifications: '',
    warehouseAddress: '',
    model: 'M-01',
    brand: 'ABC',
    manufacturer: '',
    manufacturerAddress: '',
    quantity: 1,
    method: dossier.method,
    status: dossier.status,
    fieldNames: ['Quy chuẩn 4'],
    reviewStatus: '',
    unresolvedFields: [],
    checklist: [],
    attachments: [],
    contextHash: 'issuance-context',
  } as PcnDossierDocumentContext;
  const templates = PCN_TEMPLATE_CATALOG
    .filter((template) => template.fieldCode === 'QC4' && ['CERTIFICATE', 'DECISION'].includes(template.documentKind))
    .map((template) => ({ ...template, status: 'APPROVED' as const, fileAssetId: `asset-${template.id}`, storageScope: 'PCN_PRIVATE' as const }));
  const issuance = { issuanceNumber: 'GCN-2026-001', issuedAt: '2026-08-29T00:00:00.000Z', signerUsername: 'leader' };

  assert.equal(getPcnIssuanceOfficialDocumentReadiness({ context, issuance, templates, fieldCodes: dossier.fieldCodes }).ready, true);
  const missingDecision = getPcnIssuanceOfficialDocumentReadiness({
    context,
    issuance,
    templates: templates.filter((template) => template.documentKind !== 'DECISION'),
    fieldCodes: dossier.fieldCodes,
  });
  assert.equal(missingDecision.ready, false);
  assert.match(missingDecision.reasons.join('; '), /DECISION.*template/i);
  const missingPrivateAsset = getPcnIssuanceOfficialDocumentReadiness({
    context,
    issuance,
    templates,
    fieldCodes: dossier.fieldCodes,
    privateTemplateAssetIds: new Set<string>(),
  });
  assert.equal(missingPrivateAsset.ready, false);
  assert.match(missingPrivateAsset.reasons.join('; '), /MISSING_PRIVATE_ASSET/i);
});

test('issued package must be delivered before it can be archived', () => {
  const issued = issuePcnIssuancePackage({
    ...buildPcnIssuancePackage({ id: 'issue-2', dossier, now: '2026-08-27T08:00:00.000Z' }),
    status: 'APPROVED',
  }, {
    issuanceNumber: 'GCN-PCN-2026-002',
    signerUsername: 'authorized-signer',
    issuedAt: '2026-08-27T09:00:00.000Z',
  });
  assert.throws(() => archivePcnIssuancePackage(issued), /giao/i);
  const delivered = deliverPcnIssuancePackage(issued, {
    recipient: 'Công ty TNHH ABC',
    deliveredAt: '2026-08-28T09:00:00.000Z',
    note: 'Giao bản giấy tại quầy tiếp nhận',
  });
  assert.equal(delivered.status, 'DELIVERED');
  assert.equal(delivered.deliveryRecipient, 'Công ty TNHH ABC');
  const archived = archivePcnIssuancePackage(delivered, '2026-08-29T09:00:00.000Z');
  assert.equal(archived.status, 'ARCHIVED');
  assert.equal(archived.archivedAt, '2026-08-29T09:00:00.000Z');
});

test('PCN store exposes audited delivery and archive mutations', () => {
  assert.match(storeSource, /deliverPackage:/);
  assert.match(storeSource, /archivePackage:/);
  assert.match(storeSource, /deliverPcnIssuance/);
  assert.match(storeSource, /archivePcnIssuance/);
  assert.doesNotMatch(storeSource, /saveDoc\('issuancePackages'/);
  const deliverRoute = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/deliver'"), serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/archive'"));
  assert.match(deliverRoute, /normalizePcnUtcTimestamp\('Ngày giao'/);
  assert.match(deliverRoute, /JSON\.stringify\(\{ issuanceId, recipient, deliveredAt, note \}\)/);
});

test('issuance UI exposes approval and issuance actions without testing schedules', () => {
  const issuanceView = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');
  const approvalModal = fs.readFileSync(new URL('../components/PcnApprovalModal.tsx', import.meta.url), 'utf8');
  assert.match(issuanceView, /PcnApprovalModal/);
  assert.match(issuanceView, /Mở phê duyệt/);
  assert.match(issuanceView, /Cấp số phát hành/);
  assert.match(issuanceView, /Giao khách hàng/);
  assert.match(issuanceView, /Lưu trữ/);
  assert.doesNotMatch(issuanceView, /historicalReviewIncomplete/);
  assert.match(issuanceView, /issuanceTemplatesReady/);
  assert.match(issuanceView, /Chưa thể cấp số: \{issuanceTemplateReasons/);
  assert.match(issuanceView, /Chưa thể cấp số/);
  assert.match(issuanceView, /PcnFilePreviewButton/);
  assert.match(issuanceView, /Xem nhanh/);
  assert.match(approvalModal, /Phê duyệt/);
  assert.doesNotMatch(issuanceView, /Lịch ITD|Lịch EMC|auto.?schedule/i);
});

// --- End of pcn-approval-issuance.test.ts ---
