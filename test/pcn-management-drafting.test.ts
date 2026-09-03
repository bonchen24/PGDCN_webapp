import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

import type { CertificationDossier, CertificationProposal, PcnDocumentRequirement, PcnDossierDocument, PcnSampleLot, PcnSampleRoute, OutboundLabRequest, ReturnedTestResult } from '../types.ts';
import { buildPcnLabOperationsRows } from '../utils/pcnLabOperations.ts';
import { buildPcnAssistantRecommendations, buildPcnAssistantSnapshot } from '../utils/pcnAssistant.ts';
import { buildPcnDraftManualSource, buildPcnDraftSourceValues, getPcnDraftFieldDefinitions, validatePcnDraftAction, validatePcnDraftValues } from '../utils/pcnDrafting.ts';
import { getPcnOperationalTemplateForKind } from '../utils/pcnOperationalTemplateCatalog.ts';
import { validatePcnDraftSourceSelection } from '../utils/pcnDraftSourcePolicy.ts';

const dossier = (overrides: Partial<CertificationDossier> = {}): CertificationDossier => ({
  id: 'd-1', dossierCode: 'PCN-001', proposalId: 'p-1', fieldCodes: ['QC4'], method: 'METHOD_1', status: 'AWAITING_RESULTS', labRequestIds: ['pyc-1'], returnedResultIds: [], ...overrides,
});
const proposal: CertificationProposal = {
  id: 'p-1', proposalCode: 'DN-001', channel: 'DIRECT', status: 'CONVERTED', dossierId: 'd-1',
  customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' }, productName: 'Thiết bị A', model: 'M1', brand: 'B', productType: 'Điện', specifications: '220V', manufacturer: 'NSX', quantity: 1, fieldCodes: ['QC4'], receivedAt: '2026-08-01',
};

const serverSource = fs.readFileSync(path.resolve(process.cwd(), 'server.ts'), 'utf8');

test('PCN lab projection keeps one row per sample route and links the outbound PYC', () => {
  const lot: PcnSampleLot = { id: 'lot-1', dossierId: 'd-1', lotCode: 'LO-01', sampleName: 'Mẫu A', quantity: 2, unit: 'bộ', fieldCodes: ['QC4'], routeIds: ['route-1'], status: 'AT_LAB', currentLocation: 'Phòng thử EMC' };
  const route: PcnSampleRoute = { id: 'route-1', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'SENT', labRequestId: 'pyc-1', sentAt: '2026-08-10' };
  const request: OutboundLabRequest = { id: 'pyc-1', pycNumber: 'PYC-001', dossierId: 'd-1', fieldCode: 'QC4', laboratoryName: 'Phòng thử EMC', status: 'SENT', requestedAt: '2026-08-09' };
  const rows = buildPcnLabOperationsRows({ dossiers: [dossier()], proposals: [proposal], sampleLots: [lot], sampleRoutes: [route], labRequests: [request], returnedResults: [] });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].pycNumber, 'PYC-001');
  assert.equal(rows[0].lotCode, 'LO-01');
  assert.equal(rows[0].routeStatus, 'SENT');
});

test('PCN assistant points to missing results and overdue dossiers without mutating data', () => {
  const overdue = dossier({ targetDate: '2026-08-01' });
  const recommendations = buildPcnAssistantRecommendations({ dossiers: [overdue], proposals: [proposal], requirements: [] as PcnDocumentRequirement[], documents: [] as PcnDossierDocument[], labRequests: [], sampleLots: [] as PcnSampleLot[], sampleRoutes: [] as PcnSampleRoute[], returnedResults: [] as ReturnedTestResult[], now: '2026-08-31T00:00:00.000Z' });
  assert.ok(recommendations.some((item) => item.dossierId === 'd-1' && item.kind === 'RESULT_PENDING'));
  assert.ok(recommendations.some((item) => item.dossierId === 'd-1' && item.kind === 'OVERDUE'));
});

test('draft workspace validates only the selected form fields and allows independent drafting', () => {
  const fields = getPcnDraftFieldDefinitions('COMMERCIAL');
  assert.ok(fields.some((field) => field.key === 'so_hop_dong' && field.required));
  const result = validatePcnDraftValues('COMMERCIAL', { ten_cong_ty: 'Công ty A' });
  assert.deepEqual(result.missingKeys, ['so_hop_dong', 'ngay_hop_dong', 'phi_dich_vu', 'dieu_khoan_thanh_toan']);
});

test('draft form inputs mirror required placeholders from the selected PCN template', () => {
  const kinds = ['ASSIGNMENT_FORM', 'FIELD_INSPECTION', 'LAB_REQUEST', 'EVALUATION_REPORT', 'CERTIFICATION_RESULT', 'CLIENT_PACKAGE'] as const;
  for (const kind of kinds) {
    const template = getPcnOperationalTemplateForKind(kind);
    assert.ok(template);
    const fields = getPcnDraftFieldDefinitions(kind);
    for (const key of template.requiredPlaceholderKeys) {
      assert.ok(fields.some((field) => field.key === key && field.required), `${kind} must expose required field ${key}`);
    }
  }
});

test('draft workspace permits saving an incomplete draft but blocks generation with missing fields', () => {
  assert.deepEqual(validatePcnDraftAction('COMMERCIAL', {}, 'SAVE'), { valid: true, missingKeys: [] });
  assert.deepEqual(validatePcnDraftAction('COMMERCIAL', {}, 'GENERATE').missingKeys, ['so_hop_dong', 'ngay_hop_dong', 'ten_cong_ty', 'phi_dich_vu', 'dieu_khoan_thanh_toan']);
});

test('draft generation revalidates required fields at the server boundary', () => {
  assert.match(serverSource, /validatePcnDraftAction\(draft\.formKind, draft\.values, 'GENERATE'\)/);
});

test('draft workspace can build a non-persistent manual source from entered values', () => {
  const manual = buildPcnDraftManualSource({ id: 'draft-1', fieldCodes: ['QC4'], values: {
    so_dang_ky: 'DN-MANUAL-01', ma_ho_so: 'HS-MANUAL-01', ten_cong_ty: 'Công ty nhập tay', loai_sp: 'Thiết bị nhập tay', so_luong_mau: '3',
  } }, '2026-08-31T00:00:00.000Z');
  assert.equal(manual.proposal.proposalCode, 'DN-MANUAL-01');
  assert.equal(manual.proposal.customerSnapshot.name, 'Công ty nhập tay');
  assert.equal(manual.proposal.quantity, 3);
  assert.equal(manual.dossier.dossierCode, 'HS-MANUAL-01');
  assert.deepEqual(manual.dossier.fieldCodes, ['QC4']);
});

test('independent drafting exposes the dossier cover and certification-result templates', () => {
  assert.ok(getPcnDraftFieldDefinitions('DOSSIER_COVER' as any).some((field) => field.key === 'nguoi_danh_gia'));
  assert.ok(getPcnDraftFieldDefinitions('CERTIFICATION_RESULT' as any).some((field) => field.key === 'ket_luan_chung_nhan' && field.required));
  assert.match(serverSource, /'DOSSIER_COVER'/);
  assert.match(serverSource, /'CERTIFICATION_RESULT'/);
});

test('draft source prefills sample, PYC and handover forms from the dossier sample flow', () => {
  const lot: PcnSampleLot = { id: 'lot-1', dossierId: 'd-1', lotCode: 'LO-QC4-01', sampleName: 'Thiết bị A', quantity: 2, unit: 'bộ', fieldCodes: ['QC4'], routeIds: ['route-1'], status: 'AT_LAB', currentLocation: 'Phòng thử EMC' };
  const route: PcnSampleRoute = { id: 'route-1', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'RECEIVED', labRequestId: 'pyc-1', sentAt: '2026-08-10' };
  const request: OutboundLabRequest = { id: 'pyc-1', pycNumber: 'PYC-001', dossierId: 'd-1', fieldCode: 'QC4', laboratoryName: 'Phòng thử EMC', status: 'RECEIVED', requestedAt: '2026-08-09', handoverAt: '2026-08-10', handoverDetails: { senderName: 'PCN', receiverName: 'PTN EMC', handoverAt: '2026-08-10', location: 'Kho PCN', quantity: 2, sampleCodes: ['LO-QC4-01'] } };
  const values = buildPcnDraftSourceValues(proposal, dossier(), { sampleLots: [lot], sampleRoutes: [route], labRequests: [request] });
  assert.equal(values.ma_lo, 'LO-QC4-01');
  assert.equal(values.seal_stamp, 'LO-QC4-01');
  assert.equal(values.so_luong_mau, '2');
  assert.equal(values.so_pyc, 'PYC-001');
  assert.equal(values.phong_thu_nghiem, 'Phòng thử EMC');
  assert.equal(values.ngay_giao_mau, '2026-08-10');
  assert.equal(values.nguoi_nhan, 'PTN EMC');
});

test('assistant snapshot carries the five-step dossier context and sample flow for AI questions', () => {
  const lot: PcnSampleLot = { id: 'lot-1', dossierId: 'd-1', lotCode: 'LO-QC4-01', sampleName: 'Thiết bị A', quantity: 2, fieldCodes: ['QC4'], routeIds: ['route-1'], status: 'AT_LAB', currentLocation: 'Phòng thử EMC' };
  const route: PcnSampleRoute = { id: 'route-1', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'RECEIVED', labRequestId: 'pyc-1' };
  const request: OutboundLabRequest = { id: 'pyc-1', pycNumber: 'PYC-001', dossierId: 'd-1', fieldCode: 'QC4', laboratoryName: 'Phòng thử EMC', status: 'RECEIVED', requestedAt: '2026-08-09' };
  const snapshot = buildPcnAssistantSnapshot({ dossiers: [dossier()], proposals: [proposal], requirements: [], documents: [], labRequests: [request], sampleLots: [lot], sampleRoutes: [route], returnedResults: [] });
  assert.equal(snapshot.dossiers[0].workflowStage, 'Bước 3 · KQTN & đánh giá');
  assert.equal(snapshot.dossiers[0].completeness.requiredDocumentTotal >= 0, true);
  assert.equal(snapshot.samples[0].lotCode, 'LO-QC4-01');
  assert.equal(snapshot.routes[0].laboratory, 'Phòng thử EMC');
  assert.equal(snapshot.pyc[0].code, 'PYC-001');
});

test('assistant handles overdue exception dossiers without assuming a workflow stage', () => {
  const recommendations = buildPcnAssistantRecommendations({
    dossiers: [dossier({ status: 'ON_HOLD', targetDate: '2026-08-01' })],
    proposals: [proposal],
    requirements: [],
    documents: [],
    labRequests: [],
    sampleLots: [],
    sampleRoutes: [],
    returnedResults: [],
    now: '2026-08-31T00:00:00.000Z',
  });
  const overdue = recommendations.find((item) => item.kind === 'OVERDUE');
  assert.ok(overdue);
  assert.match(overdue.description, /ngoại lệ/i);
});

test('AI assistant route uses the active PCN projection and related sample collections', () => {
  assert.match(serverSource, /filterPcnFutureWorkSnapshot\(\{ proposals, dossiers, customers: \[\] \}\)/);
  assert.match(serverSource, /buildPcnAssistantSnapshot\(\{/);
  assert.match(serverSource, /collection_name = 'pcnSampleLots'/);
  assert.match(serverSource, /collection_name = 'pcnSampleRoutes'/);
  assert.match(serverSource, /collection_name = 'pcnDocumentRequirements'/);
});

test('draft source policy rejects missing, mismatched or historical source records', () => {
  assert.throws(() => validatePcnDraftSourceSelection({ sourceProposalId: 'p-1', sourceDossierId: 'd-2', proposal, dossier: dossier({ id: 'd-2', proposalId: 'other-proposal' }) }), /không thuộc cùng một bộ hồ sơ/i);
  assert.throws(() => validatePcnDraftSourceSelection({ sourceProposalId: 'p-1' }), /Không tìm thấy Đề nghị nguồn/i);
  assert.throws(() => validatePcnDraftSourceSelection({ sourceProposalId: 'p-1', proposal: { ...proposal, historicalImport: { sourceBatchId: 'legacy' } as any } }), /hồ sơ lịch sử/i);
  assert.match(serverSource, /validatePcnDraftSourceSelection\(/);
  assert.match(serverSource, /validatePcnDraftSourceSelection\(\{ sourceProposalId: draft\.sourceProposalId/);
});
