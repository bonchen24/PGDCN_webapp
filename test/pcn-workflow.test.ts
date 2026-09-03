import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PCN_CERTIFICATION_FIELDS,
  getOfficialPcnResultRound,
  getPcnDossierManualNextStatuses,
  getPcnDossierMethodChangeDenial,
  getPcnDossierStatusLabel,
  getPcnDossierStatusMutationDenial,
  getPcnTemplateCode,
  isPcnDossierTransitionAllowed,
  transitionPcnDossier,
} from '../utils/pcnWorkflow.ts';
import {
  classifyPcnDocumentType,
  evaluatePcnSampleAcceptance,
  markPcnProposalConverted,
} from '../utils/pcnPolicy.ts';

test('registers the active PCN certification fields as expandable work areas', () => {
  assert.deepEqual(
    DEFAULT_PCN_CERTIFICATION_FIELDS.map((field) => ({ code: field.code, name: field.name })),
    [
      { code: 'QC4', name: 'Quy chuẩn 4' },
      { code: 'QC9', name: 'Quy chuẩn 9' },
    ],
  );
  assert.equal('primaryField' in DEFAULT_PCN_CERTIFICATION_FIELDS[0], false);
});

test('allows a dossier to move from intake to assignment but rejects skipping the dossier lifecycle', () => {
  assert.equal(isPcnDossierTransitionAllowed('INTAKE_REVIEW', 'ASSIGNED'), true);
  assert.equal(isPcnDossierTransitionAllowed('INTAKE_REVIEW', 'ISSUED'), false);
  assert.deepEqual(transitionPcnDossier('INTAKE_REVIEW', 'ASSIGNED'), {
    status: 'ASSIGNED',
    statusLabel: 'Đã phân công',
  });
  assert.equal(getPcnDossierStatusLabel('WAITING_APPROVAL'), 'Chờ phê duyệt');
});

test('requires customer delivery before a dossier can enter archive', () => {
  assert.equal(isPcnDossierTransitionAllowed('ISSUED', 'DELIVERED'), true);
  assert.equal(isPcnDossierTransitionAllowed('ISSUED', 'ARCHIVED'), false);
  assert.equal(isPcnDossierTransitionAllowed('DELIVERED', 'ARCHIVED'), true);
});

test('routes delivery and archive transitions through the issuance boundary', () => {
  assert.match(getPcnDossierStatusMutationDenial('TECHNICAL_REVIEW', 'WAITING_APPROVAL') || '', /bộ phát hành|trình phê duyệt/i);
  assert.match(getPcnDossierStatusMutationDenial('WAITING_APPROVAL', 'APPROVED') || '', /phê duyệt/i);
  assert.match(getPcnDossierStatusMutationDenial('WAITING_APPROVAL', 'TECHNICAL_REVIEW') || '', /phê duyệt/i);
  assert.match(getPcnDossierStatusMutationDenial('APPROVED', 'ISSUED') || '', /cấp số/i);
  assert.match(getPcnDossierStatusMutationDenial('ISSUED', 'DELIVERED') || '', /module phát hành|giao khách hàng/i);
  assert.match(getPcnDossierStatusMutationDenial('DELIVERED', 'ARCHIVED') || '', /module phát hành|lưu trữ/i);
  assert.equal(getPcnDossierStatusMutationDenial('TECHNICAL_REVIEW', 'ASSIGNED'), null);
  assert.equal(getPcnDossierManualNextStatuses('TECHNICAL_REVIEW').includes('WAITING_APPROVAL'), false);
  assert.equal(getPcnDossierManualNextStatuses('WAITING_APPROVAL').includes('APPROVED'), false);
  assert.equal(getPcnDossierManualNextStatuses('WAITING_APPROVAL').includes('TECHNICAL_REVIEW'), false);
  assert.equal(getPcnDossierManualNextStatuses('APPROVED').includes('ISSUED'), false);
  assert.deepEqual(getPcnDossierManualNextStatuses('ISSUED'), []);
  assert.deepEqual(getPcnDossierManualNextStatuses('DELIVERED'), []);
});

test('requires a confirmed reason when entering a dossier exception lane', async () => {
  const workflow = await import('../utils/pcnWorkflow.ts');
  const getExceptionReasonDenial = (workflow as any).getPcnDossierExceptionReasonDenial as ((status: string, reason?: string) => string | null) | undefined;
  assert.equal(typeof getExceptionReasonDenial, 'function');
  assert.match(getExceptionReasonDenial?.('ON_HOLD', '') || '', /lý do/i);
  assert.match(getExceptionReasonDenial?.('REJECTED', '   ') || '', /lý do/i);
  assert.match(getExceptionReasonDenial?.('CANCELLED', 'x'.repeat(1001)) || '', /dài|độ dài/i);
  assert.equal(getExceptionReasonDenial?.('ASSIGNED', ''), null);
  assert.equal(getExceptionReasonDenial?.('ON_HOLD', 'Chờ người vận hành rà soát'), null);
});

test('maps certification methods to PCN certificate and decision templates', () => {
  assert.equal(getPcnTemplateCode('METHOD_1', 'CERTIFICATE'), 'BM-QT-03-02a');
  assert.equal(getPcnTemplateCode('METHOD_5', 'DECISION'), 'BM-QĐ-03-01b');
  assert.equal(getPcnTemplateCode('METHOD_7', 'CERTIFICATE'), 'BM-QT-03-02c');
});

test('locks dossier method after an issuance package exists', () => {
  assert.equal(getPcnDossierMethodChangeDenial({ method: 'METHOD_1' }, 'METHOD_5', false), null);
  assert.equal(getPcnDossierMethodChangeDenial({ method: 'METHOD_1' }, 'METHOD_1', true), null);
  assert.match(
    getPcnDossierMethodChangeDenial({ method: 'METHOD_1' }, 'METHOD_5', true) || '',
    /đã có bộ phát hành/i,
  );
});

test('uses the second retry result as official after the first round failed', () => {
  assert.equal(
    getOfficialPcnResultRound([
      { round: 1, outcome: 'FAIL' },
      { round: 2, outcome: 'PASS' },
    ]),
    2,
  );
  assert.equal(getOfficialPcnResultRound([{ round: 1, outcome: 'PASS' }]), 1);
});

test('keeps PCN intake Đề nghị distinct from outbound PYC', () => {
  assert.equal(classifyPcnDocumentType('Đề nghị'), 'CERTIFICATION_PROPOSAL');
  assert.equal(classifyPcnDocumentType('PYC gửi PTN'), 'OUTBOUND_LAB_REQUEST');
  assert.throws(() => classifyPcnDocumentType('Phiếu yêu cầu đầu vào'), /Đề nghị/);
});

test('accepts only a sealed unused sample matching the Đề nghị', () => {
  assert.deepEqual(evaluatePcnSampleAcceptance({
    isSealed: true,
    isUnused: true,
    matchesProposal: true,
    sampleCount: 2,
    minimumSampleCount: 1,
  }), { accepted: true, reasons: [] });

  assert.deepEqual(evaluatePcnSampleAcceptance({
    isSealed: false,
    isUnused: true,
    matchesProposal: true,
    sampleCount: 2,
    minimumSampleCount: 1,
  }), { accepted: false, reasons: ['Mẫu chưa niêm phong hoặc không còn nguyên trạng'] });
});

test('marks a Đề nghị as converted and keeps its dossier backlink', () => {
  const converted = markPcnProposalConverted({
    id: 'proposal-1',
    proposalCode: 'DN-2026-001',
    channel: 'DIRECT',
    status: 'RECEIVED',
    customerSnapshot: { name: 'Công ty A', address: '' },
    productName: 'Thiết bị A',
    quantity: 1,
    fieldCodes: ['QC4'],
    receivedAt: '2026-08-27T08:00:00.000Z',
  }, 'dossier-1', '2026-08-27T09:00:00.000Z');
  assert.equal(converted.status, 'CONVERTED');
  assert.equal(converted.dossierId, 'dossier-1');
  assert.equal(converted.updatedAt, '2026-08-27T09:00:00.000Z');
});

// --- End of pcn-workflow.test.ts ---
