import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PDFDocument } from 'pdf-lib';
import PizZip from 'pizzip';

import {
  buildPcnDossierDocumentContext,
  buildPcnDossierCoverDocx,
  buildPcnDossierCoverPdf,
  buildPcnAssignmentFormDocx,
  buildPcnAssignmentFormPdf,
  buildPcnEvaluationPlanDocx,
  buildPcnEvaluationPlanPdf,
  buildPcnFieldInspectionDocx,
  buildPcnFieldInspectionPdf,
  buildPcnSampleTakingDocx,
  buildPcnSampleTakingPdf,
  buildPcnSampleCodingDocx,
  buildPcnSampleCodingPdf,
  buildPcnEvaluationReportDocx,
  buildPcnEvaluationReportPdf,
  buildPcnLabRequestDocx,
  buildPcnLabRequestPdf,
  buildPcnSampleHandoverDocx,
  buildPcnSampleHandoverPdf,
  buildPcnSampleReturnDocx,
  buildPcnSampleReturnPdf,
  buildPcnProposalFormDocx,
  buildPcnProposalFormPdf,
  buildPcnProposalSummaryDocx,
  buildPcnProposalSummaryPdf,
  PCN_DOCUMENT_IDENTITY,
  getPcnDocumentSourceUpdatedAt,
} from '../utils/pcnDocumentGeneration.ts';
import { getPcnDocumentContextConflict, getPcnDocumentPreflightIssues } from '../utils/pcnDocumentFreshness.ts';
import { getPcnGeneratedDocumentLineageSummary, getPcnGeneratedDocumentsForKind } from '../utils/pcnGeneratedDocumentView.ts';
import type { OutboundLabRequest, PcnCertificationField, PcnDossierAttachment, PcnDossierDocument, PcnDocumentRequirement, PcnGeneratedDocument } from '../types.ts';

const server = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const store = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const generationApi = fs.readFileSync(new URL('../utils/pcnDocumentGenerationApi.ts', import.meta.url), 'utf8');
const dossierDocumentApi = fs.readFileSync(new URL('../utils/pcnDossierDocumentApi.ts', import.meta.url), 'utf8');
const detail = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const outputModal = fs.readFileSync(new URL('../components/PcnDocumentOutputModal.tsx', import.meta.url), 'utf8');
const panel = fs.readFileSync(new URL('../components/PcnDocumentGenerationPanel.tsx', import.meta.url), 'utf8');
const types = fs.readFileSync(new URL('../types.ts', import.meta.url), 'utf8');
const freshness = fs.readFileSync(new URL('../utils/pcnDocumentFreshness.ts', import.meta.url), 'utf8');

const dossier = {
  id: 'dossier-generated-0665',
  dossierCode: 'QC4-2026-0665',
  proposalId: 'proposal-generated-0665',
  customerSnapshot: { name: 'Công ty TNHH Mẫu', address: 'Hà Nội' },
  fieldCodes: ['QC4'],
  method: 'METHOD_1' as const,
  status: 'ON_HOLD' as const,
  evaluatorUsername: 'evaluator.qc4',
  reviewerUsername: 'reviewer.qc4',
  targetDate: '2026-09-10',
  evaluationAt: '2026-08-28T05:00:00.000Z',
  labRequestIds: [],
  returnedResultIds: [],
  createdAt: '2026-08-28T00:00:00.000Z',
  updatedAt: '2026-08-28T03:30:00.000Z',
  historicalImport: {
    batchId: 'pcn-history-pilot-v1',
    sourceFamily: 'QC4' as const,
    sourceFolderName: '0665 Bình đun nước siêu tốc',
    sourceRelativePath: 'Hồ sơ lô hàng mới/0665 Bình đun nước siêu tốc',
    reviewStatus: 'REVIEWED' as const,
    unresolvedFields: [],
    importedAt: '2026-08-28T00:00:00.000Z',
  },
};

const proposal = {
  id: dossier.proposalId,
  proposalCode: 'DN-QC4-2026-0665',
  channel: 'OTHER' as const,
  status: 'CONVERTED' as const,
  dossierId: dossier.id,
  customerSnapshot: { ...dossier.customerSnapshot },
  productName: 'Bình đun nước siêu tốc',
  model: 'KETTLE-01',
  brand: 'PCN Brand',
  manufacturer: 'Nhà sản xuất mẫu',
  quantity: 1,
  fieldCodes: ['QC4'],
  receivedAt: dossier.createdAt,
  updatedAt: dossier.updatedAt,
  historicalImport: dossier.historicalImport,
};

const fields: PcnCertificationField[] = [{ code: 'QC4', name: 'Quy chuẩn 4', standardRefs: ['QCVN 4'], active: true }];
const documents: PcnDossierDocument[] = [
  { id: 'dossier-document-1', dossierId: dossier.id, fieldCode: 'QC4' as const, requirementId: 'QC4-PROPOSAL', status: 'PRESENT' as const, versions: [{ assetId: 'asset-proposal', fileName: 'de-nghi.pdf', uploadedAt: dossier.createdAt }] },
  { id: 'dossier-document-2', dossierId: dossier.id, fieldCode: 'QC4' as const, requirementId: 'QC4-CERTIFICATE', status: 'MISSING' as const, versions: [] },
];
const documentRequirements: PcnDocumentRequirement[] = [
  { id: 'QC4-PROPOSAL', fieldCode: 'QC4' as const, code: 'PROPOSAL', name: 'Đề nghị / đơn đăng ký', stages: ['INTAKE'], required: true, active: true, sortOrder: 10 },
  { id: 'QC4-CERTIFICATE', fieldCode: 'QC4' as const, code: 'CERTIFICATE', name: 'Giấy chứng nhận', stages: ['ISSUANCE'], required: true, active: true, sortOrder: 70 },
];
const attachments: PcnDossierAttachment[] = [
  { id: 'attachment-1', dossierId: dossier.id, fieldCode: 'QC4' as const, kind: 'PROPOSAL' as const, fileName: 'de-nghi.pdf', sourceRelativePath: '01/de-nghi.pdf', assetId: 'pcn-file-hist-1', mimeType: 'application/pdf', byteSize: 1200, sha256: 'a'.repeat(64), importedAt: dossier.createdAt },
];
const context = buildPcnDossierDocumentContext({ dossier, proposal, fields, documents, documentRequirements, attachments });
const labRequest: OutboundLabRequest = {
  id: 'lab-request-generated-0665',
  pycNumber: 'PYC-QC4-0665-01',
  dossierId: dossier.id,
  fieldCode: 'QC4',
  laboratoryName: 'Phòng thử nghiệm Hiệu suất',
  status: 'DRAFT',
  requestedAt: '2026-08-28T04:00:00.000Z',
  targetDate: '2026-09-05',
  criteria: 'QCVN 4:2009/BKHCN',
  handoverNote: 'Giao mẫu theo biên bản đã xác nhận.',
  updatedAt: '2026-08-28T04:30:00.000Z',
};

test('PCN document context is canonical, deterministic and contains checklist plus file metadata', () => {
  const repeated = buildPcnDossierDocumentContext({ dossier, proposal, fields, documents, documentRequirements, attachments });

  assert.equal(context.contextHash, repeated.contextHash);
  assert.equal(context.dossierCode, dossier.dossierCode);
  assert.equal(context.proposalCode, proposal.proposalCode);
  assert.equal(context.proposalChannel, proposal.channel);
  assert.equal(context.proposalReceivedAt, proposal.receivedAt);
  assert.equal(context.checklist.length, 2);
  assert.equal(context.checklist[0].status, 'PRESENT');
  assert.equal(context.attachments[0].sourceRelativePath, '01/de-nghi.pdf');
  assert.doesNotMatch(JSON.stringify(context), /base64|data:application/i);
});

test('PCN PYC document context binds the selected outbound request without copying file bytes', async () => {
  const labContext = buildPcnDossierDocumentContext({
    dossier,
    proposal,
    fields,
    documents,
    documentRequirements,
    attachments,
    labRequests: [labRequest],
    labRequestId: labRequest.id,
  });

  assert.equal(labContext.labRequest?.requestId, labRequest.id);
  assert.equal(labContext.labRequest?.pycNumber, labRequest.pycNumber);
  assert.equal(labContext.labRequest?.laboratoryName, labRequest.laboratoryName);
  assert.notEqual(labContext.contextHash, context.contextHash);
  assert.doesNotMatch(JSON.stringify(labContext), /base64|data:application/i);

  const docx = buildPcnLabRequestDocx(labContext);
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  assert.match(documentXml, new RegExp(PCN_DOCUMENT_IDENTITY.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(documentXml, /PHIẾU YÊU CẦU THỬ NGHIỆM PCN/);
  assert.match(documentXml, /PYC-QC4-0665-01/);
  assert.match(documentXml, /Phòng thử nghiệm Hiệu suất/);

  const pdf = await buildPcnLabRequestPdf(labContext);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const pdfDocument = await PDFDocument.load(pdf);
  assert.ok(pdfDocument.getPageCount() >= 1);
  assert.equal(pdfDocument.getTitle(), `${PCN_DOCUMENT_IDENTITY} • PHIẾU YÊU CẦU THỬ NGHIỆM PCN`);
});

test('PCN handover documents bind the canonical handover facts to DOCX/PDF context', async () => {
  const sampleLot = {
    id: 'lot-handover-0665', dossierId: dossier.id, lotCode: 'LOT-QC4-0665', sampleName: 'Bình đun nước siêu tốc',
    model: 'KETTLE-01', brand: 'PCN Brand', quantity: 2, unit: 'cái', fieldCodes: ['QC4'],
    routeIds: ['route-handover-0665'], status: 'PREPARED' as const, currentLocation: 'Kho PCN',
    receivedAt: '2026-08-29T06:00:00.000Z', updatedAt: '2026-08-29T06:30:00.000Z',
  };
  const sampleRoute = {
    id: 'route-handover-0665', sampleLotId: sampleLot.id, labCode: 'EMC' as const,
    labName: 'Phòng thử EMC', status: 'SENT' as const, labRequestId: labRequest.id,
    sentAt: '2026-08-30T08:00:00.000Z', receivedAt: '2026-08-30T09:00:00.000Z', resultReturnedAt: '', returnedAt: '', note: '',
    updatedAt: '2026-08-30T09:00:00.000Z',
  };
  const handoverRequest = {
    ...labRequest,
    sampleLotId: sampleLot.id,
    sampleRouteId: sampleRoute.id,
    handoverDetails: {
      senderName: 'Trần Hoàng Phương', senderUnit: 'PCN', receiverName: 'Vũ Thị Thắm', receiverUnit: 'Phòng thử EMC',
      handoverAt: '2026-08-30T08:00:00.000Z', receivedAt: '2026-08-30T09:00:00.000Z', location: 'Kho PCN',
      vehicle: '29A-123.45', driver: 'Nguyễn Văn A', quantity: 2, sampleCodes: ['PCN-QC4-0665-M01', 'PCN-QC4-0665-M02'], note: 'Niêm phong nguyên vẹn',
    },
  };
  const handoverContext = buildPcnDossierDocumentContext({
    dossier, proposal, fields, documents, documentRequirements, attachments,
    sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [handoverRequest], sampleRouteId: sampleRoute.id,
  });
  const handover = handoverContext.sampleHandover as unknown as Record<string, unknown>;
  assert.equal(handover.senderName, 'Trần Hoàng Phương');
  assert.equal(handover.receiverName, 'Vũ Thị Thắm');
  assert.equal(handover.location, 'Kho PCN');
  assert.equal(handover.vehicle, '29A-123.45');
  assert.deepEqual(handover.sampleCodes, ['PCN-QC4-0665-M01', 'PCN-QC4-0665-M02']);

  const docx = buildPcnSampleHandoverDocx(handoverContext);
  const documentXml = new PizZip(docx).file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /Trần Hoàng Phương/);
  assert.match(documentXml, /Vũ Thị Thắm/);
  assert.match(documentXml, /29A-123.45/);
  assert.match(documentXml, /PCN-QC4-0665-M01, PCN-QC4-0665-M02/);

  const pdf = await buildPcnSampleHandoverPdf(handoverContext);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
});

test('PCN PYC document context rejects a request outside the dossier', () => {
  assert.throws(() => buildPcnDossierDocumentContext({
    dossier,
    proposal,
    fields,
    documents,
    documentRequirements,
    attachments,
    labRequests: [{ ...labRequest, dossierId: 'another-dossier' }],
    labRequestId: labRequest.id,
  }), /Không tìm thấy PYC thuộc hồ sơ/);
});

test('generated document source timestamp follows the newest linked dossier or proposal update', () => {
  assert.equal(
    getPcnDocumentSourceUpdatedAt('2026-08-28T10:00:00.000Z', '2026-08-28T12:00:00.000Z'),
    '2026-08-28T12:00:00.000Z',
  );
  assert.equal(
    getPcnDocumentSourceUpdatedAt('2026-08-28T13:00:00.000Z', '2026-08-28T12:00:00.000Z'),
    '2026-08-28T13:00:00.000Z',
  );
  assert.equal(getPcnDocumentSourceUpdatedAt('2026-02-30T13:00:00.000Z', 'not-a-date'), undefined);
  assert.equal(getPcnDocumentSourceUpdatedAt(undefined, 'not-a-date'), undefined);
});

test('document preflight reports warnings separately from blocking route errors', () => {
  const issues = getPcnDocumentPreflightIssues({
    kind: 'DOSSIER_COVER',
    hasSampleRoute: true,
    checklist: [
      { name: 'Đề nghị / đơn đăng ký', required: true, status: 'PRESENT' },
      { name: 'Giấy chứng nhận', required: true, status: 'MISSING' },
    ],
  });

  assert.deepEqual(issues, [
    { severity: 'WARNING', code: 'MISSING_REQUIRED_CHECKLIST', message: 'Thiếu tài liệu bắt buộc: Giấy chứng nhận.' },
  ]);

  assert.deepEqual(getPcnDocumentPreflightIssues({ kind: 'SAMPLE_HANDOVER', hasSampleRoute: false, checklist: [] }), [
    { severity: 'BLOCKING', code: 'SAMPLE_ROUTE_REQUIRED', message: 'Biên bản giao/nhận mẫu cần chọn một tuyến mẫu hợp lệ.' },
  ]);
  assert.deepEqual(getPcnDocumentPreflightIssues({ kind: 'SAMPLE_TAKING', hasSampleRoute: false, checklist: [] }), [
    { severity: 'BLOCKING', code: 'SAMPLE_ROUTE_REQUIRED', message: 'Biên bản lấy mẫu cần chọn một tuyến mẫu hợp lệ.' },
  ]);
  assert.deepEqual(getPcnDocumentPreflightIssues({ kind: 'SAMPLE_RETURN', hasSampleRoute: false, checklist: [] }), [
    { severity: 'BLOCKING', code: 'SAMPLE_ROUTE_REQUIRED', message: 'Biên bản trả mẫu cần chọn một tuyến mẫu hợp lệ.' },
  ]);
  assert.deepEqual(getPcnDocumentPreflightIssues({ kind: 'SAMPLE_CODING', hasSampleRoute: false, checklist: [] }), [
    { severity: 'BLOCKING', code: 'SAMPLE_ROUTE_REQUIRED', message: 'Biên bản mã hóa mẫu cần chọn một tuyến mẫu hợp lệ.' },
  ]);
  assert.deepEqual(getPcnDocumentPreflightIssues({ kind: 'LAB_REQUEST', hasSampleRoute: true, hasLabRequest: false, checklist: [] }), [
    { severity: 'BLOCKING', code: 'LAB_REQUEST_REQUIRED', message: 'PYC gửi PTN cần chọn một PYC thuộc hồ sơ.' },
  ]);
});

test('document generation detects a context changed after preflight', () => {
  const contextHash = 'a'.repeat(64);
  assert.equal(getPcnDocumentContextConflict(contextHash, contextHash), undefined);
  assert.deepEqual(getPcnDocumentContextConflict(contextHash, 'b'.repeat(64)), {
    severity: 'BLOCKING',
    code: 'CONTEXT_CHANGED',
    message: 'Dữ liệu hồ sơ đã thay đổi sau preflight; hãy kiểm tra lại trước khi sinh tài liệu.',
  });
  assert.equal(getPcnDocumentContextConflict(undefined, contextHash), undefined);
});

test('PCN cover generator creates readable DOCX and PDF from the same context', async () => {
  const docx = buildPcnDossierCoverDocx(context);
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /QC4-2026-0665/);
  assert.match(documentXml, /MỤC LỤC TỆP HỒ SƠ/);
  assert.match(documentXml, /de-nghi.pdf/);

  const pdf = await buildPcnDossierCoverPdf(context);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const pdfDocument = await PDFDocument.load(pdf);
  assert.ok(pdfDocument.getPageCount() >= 1);
});

test('PCN proposal summary generator preserves canonical proposal fields in both formats', async () => {
  const docx = buildPcnProposalSummaryDocx(context);
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /PHIẾU TÓM TẮT ĐỀ NGHỊ/);
  assert.match(documentXml, /DN-QC4-2026-0665/);
  assert.match(documentXml, /KETTLE-01/);
  const pdf = await buildPcnProposalSummaryPdf(context);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
});

test('PCN proposal form generator preserves intake, attachments and signature sections', async () => {
  const docx = buildPcnProposalFormDocx(context);
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /ĐỀ NGHỊ CHỨNG NHẬN/);
  assert.match(documentXml, /Mã Đề nghị/);
  assert.match(documentXml, /HỒ SƠ, TÀI LIỆU KÈM THEO/);
  assert.match(documentXml, /CAM KẾT/);
  assert.match(documentXml, /Người yêu cầu/);
  assert.match(documentXml, /de-nghi\.pdf/);

  const pdf = await buildPcnProposalFormPdf(context);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
});

test('PCN evaluation report generator preserves evaluation assignments and checklist state in both formats', async () => {
  assert.equal(context.evaluatorUsername, 'evaluator.qc4');
  assert.equal(context.reviewerUsername, 'reviewer.qc4');
  assert.equal(context.targetDate, '2026-09-10');
  assert.equal(context.evaluationAt, '2026-08-28T05:00:00.000Z');

  const docx = buildPcnEvaluationReportDocx(context);
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /BÁO CÁO ĐÁNH GIÁ HỒ SƠ PCN/);
  assert.match(documentXml, /evaluator\.qc4/);
  assert.match(documentXml, /reviewer\.qc4/);
  assert.match(documentXml, /Giấy chứng nhận/);
  assert.equal((documentXml.match(/CHECKLIST HỒ SƠ/g) || []).length, 1);
  assert.match(documentXml, /không thay thế biên bản đánh giá đã ký/i);

  const pdf = await buildPcnEvaluationReportPdf(context);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
});

test('PCN sample return generator preserves the selected route and return confirmation in both formats', async () => {
  const sampleLot = {
    id: 'lot-generated-0665', dossierId: dossier.id, lotCode: 'LOT-QC4-0665', sampleName: 'Bình đun nước siêu tốc',
    model: 'KETTLE-01', brand: 'PCN Brand', quantity: 1, unit: 'cái', fieldCodes: ['QC4'],
    routeIds: ['route-generated-0665'], status: 'RETURNED_TO_PCN' as const, currentLocation: 'Kho PCN',
    receivedAt: '2026-08-28T06:00:00.000Z', updatedAt: '2026-08-29T06:00:00.000Z',
  };
  const sampleRoute = {
    id: 'route-generated-0665', sampleLotId: sampleLot.id, labCode: 'PERFORMANCE' as const,
    labName: 'Phòng thử nghiệm Hiệu suất', status: 'RETURNED_TO_PCN' as const, labRequestId: labRequest.id,
    sentAt: '2026-08-28T07:00:00.000Z', receivedAt: '2026-08-28T08:00:00.000Z',
    resultReturnedAt: '2026-08-28T12:00:00.000Z', returnedAt: '2026-08-29T06:00:00.000Z',
    note: 'Mẫu trả đủ, nguyên trạng.', updatedAt: '2026-08-29T06:00:00.000Z',
  };
  const returnContext = buildPcnDossierDocumentContext({
    dossier, proposal, fields, documents, documentRequirements, attachments,
    sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [labRequest], sampleRouteId: sampleRoute.id,
  });
  const docx = buildPcnSampleReturnDocx(returnContext);
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /BIÊN BẢN TRẢ MẪU/);
  assert.match(documentXml, /route-generated-0665/);
  assert.match(documentXml, /Mẫu trả đủ, nguyên trạng/);

  const pdf = await buildPcnSampleReturnPdf(returnContext);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
});

test('PCN sample taking generator preserves the selected lot, route and collection confirmation in both formats', async () => {
  const sampleLot = {
    id: 'lot-taking-0665', dossierId: dossier.id, lotCode: '0109-01', sampleName: 'Bình đun nước siêu tốc',
    model: 'KETTLE-01', brand: 'PCN Brand', quantity: 1, unit: 'cái', fieldCodes: ['QC4'],
    routeIds: ['route-taking-0665'], status: 'PREPARED' as const, currentLocation: 'Kho khách hàng',
    receivedAt: '2026-08-28T06:00:00.000Z', updatedAt: '2026-08-28T06:30:00.000Z',
  };
  const sampleRoute = {
    id: 'route-taking-0665', sampleLotId: sampleLot.id, labCode: 'PERFORMANCE' as const,
    labName: 'Phòng thử nghiệm Hiệu suất', status: 'PENDING' as const, labRequestId: labRequest.id,
    sentAt: '', receivedAt: '', resultReturnedAt: '', returnedAt: '', note: 'Lấy mẫu tại kho khách hàng.',
    updatedAt: '2026-08-28T06:30:00.000Z',
  };
  const takingContext = buildPcnDossierDocumentContext({
    dossier, proposal, fields, documents, documentRequirements, attachments,
    sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [labRequest], sampleRouteId: sampleRoute.id,
  });
  const docx = buildPcnSampleTakingDocx(takingContext);
  const zip = new PizZip(docx);
  const documentXml = zip.file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /BIÊN BẢN LẤY MẪU/);
  assert.match(documentXml, /0109-01/);
  assert.match(documentXml, /Lấy mẫu tại kho khách hàng/);

  const pdf = await buildPcnSampleTakingPdf(takingContext);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
});

test('PCN generation panel selects only the active document kind and keeps newest first', () => {
  const generated: PcnGeneratedDocument[] = [
    { id: 'cover-old', dossierId: dossier.id, kind: 'DOSSIER_COVER', format: 'PDF', fileName: 'cover-old.pdf', fileAssetId: 'asset-cover-old', mimeType: 'application/pdf', byteSize: 10, sha256: '1'.repeat(64), contextHash: 'ctx-1', sourceUpdatedAt: dossier.updatedAt, generatedAt: '2026-08-28T01:00:00.000Z', generatedBy: 'user-1' },
    { id: 'summary-new', dossierId: dossier.id, kind: 'PROPOSAL_SUMMARY', format: 'DOCX', fileName: 'summary-new.docx', fileAssetId: 'asset-summary-new', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', byteSize: 20, sha256: '2'.repeat(64), contextHash: 'ctx-2', sourceUpdatedAt: dossier.updatedAt, generatedAt: '2026-08-28T03:00:00.000Z', generatedBy: 'user-1' },
    { id: 'cover-new', dossierId: dossier.id, kind: 'DOSSIER_COVER', format: 'DOCX', fileName: 'cover-new.docx', fileAssetId: 'asset-cover-new', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', byteSize: 30, sha256: '3'.repeat(64), contextHash: 'ctx-3', sourceUpdatedAt: dossier.updatedAt, generatedAt: '2026-08-28T02:00:00.000Z', generatedBy: 'user-1' },
    { id: 'other-dossier', dossierId: 'another-dossier', kind: 'PROPOSAL_SUMMARY', format: 'PDF', fileName: 'other.pdf', fileAssetId: 'asset-other', mimeType: 'application/pdf', byteSize: 40, sha256: '4'.repeat(64), contextHash: 'ctx-4', sourceUpdatedAt: dossier.updatedAt, generatedAt: '2026-08-28T04:00:00.000Z', generatedBy: 'user-1' },
  ];

  assert.deepEqual(getPcnGeneratedDocumentsForKind(generated, dossier.id, 'DOSSIER_COVER').map((item) => item.id), ['cover-new', 'cover-old']);
  assert.deepEqual(getPcnGeneratedDocumentsForKind(generated, dossier.id, 'PROPOSAL_SUMMARY').map((item) => item.id), ['summary-new']);
  assert.deepEqual(getPcnGeneratedDocumentsForKind([
    { id: 'pyc-1', dossierId: dossier.id, kind: 'LAB_REQUEST', labRequestId: 'lab-1', format: 'DOCX', fileName: 'pyc-1.docx', fileAssetId: 'asset-pyc-1', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', byteSize: 20, sha256: '5'.repeat(64), contextHash: 'ctx-pyc-1', generatedAt: '2026-08-28T03:00:00.000Z' },
    { id: 'pyc-2', dossierId: dossier.id, kind: 'LAB_REQUEST', labRequestId: 'lab-2', format: 'PDF', fileName: 'pyc-2.pdf', fileAssetId: 'asset-pyc-2', mimeType: 'application/pdf', byteSize: 20, sha256: '6'.repeat(64), contextHash: 'ctx-pyc-2', generatedAt: '2026-08-28T04:00:00.000Z' },
  ], dossier.id, 'LAB_REQUEST', undefined, 'lab-1').map((item) => item.id), ['pyc-1']);
  assert.deepEqual(getPcnGeneratedDocumentsForKind([
    { id: 'return-1', dossierId: dossier.id, kind: 'SAMPLE_RETURN', sampleRouteId: 'route-1', format: 'DOCX', fileName: 'return-1.docx', fileAssetId: 'asset-return-1', mimeType: 'application/octet-stream', byteSize: 20, sha256: '7'.repeat(64), contextHash: 'ctx-return-1', generatedAt: '2026-08-28T03:00:00.000Z' },
    { id: 'return-2', dossierId: dossier.id, kind: 'SAMPLE_RETURN', sampleRouteId: 'route-2', format: 'PDF', fileName: 'return-2.pdf', fileAssetId: 'asset-return-2', mimeType: 'application/octet-stream', byteSize: 20, sha256: '8'.repeat(64), contextHash: 'ctx-return-2', generatedAt: '2026-08-28T04:00:00.000Z' },
  ], dossier.id, 'SAMPLE_RETURN', 'route-1').map((item) => item.id), ['return-1']);
  const takingDocuments: PcnGeneratedDocument[] = [
    { id: 'taking-route-1-docx', dossierId: dossier.id, kind: 'SAMPLE_TAKING', sampleRouteId: 'route-1', format: 'DOCX', fileName: 'taking-route-1.docx', fileAssetId: 'asset-taking-route-1-docx', mimeType: 'application/octet-stream', byteSize: 20, sha256: '9'.repeat(64), contextHash: 'ctx-taking-route-1', generatedAt: '2026-08-28T05:00:00.000Z' },
    { id: 'taking-route-2-pdf', dossierId: dossier.id, kind: 'SAMPLE_TAKING', sampleRouteId: 'route-2', format: 'PDF', fileName: 'taking-route-2.pdf', fileAssetId: 'asset-taking-route-2-pdf', mimeType: 'application/octet-stream', byteSize: 20, sha256: 'a'.repeat(64), contextHash: 'ctx-taking-route-2', generatedAt: '2026-08-28T06:00:00.000Z' },
  ];
  const takingLineage = getPcnGeneratedDocumentLineageSummary(takingDocuments, dossier.id, 'SAMPLE_TAKING', 'route-1');
  assert.deepEqual(takingLineage.lineages.flatMap((lineage) => [lineage.docx?.id, lineage.pdf?.id].filter(Boolean)), ['taking-route-1-docx']);
  assert.match(panel, /selectedKind/);
  assert.match(panel, /initialKind/);
  assert.match(panel, /setSelectedKind\(initialKind/);
  assert.match(panel, /getPcnGeneratedDocumentsForKind/);
  assert.match(panel, /EVALUATION_REPORT/);
  assert.match(panel, /Báo cáo đánh giá/);
  assert.match(panel, /SAMPLE_RETURN/);
  assert.match(panel, /Biên bản trả mẫu/);
  assert.match(panel, /const PCN_SAMPLE_ROUTE_GENERATED_KINDS:[\s\S]{0,220}'SAMPLE_TAKING',[\s\S]{0,40}'SAMPLE_HANDOVER',[\s\S]{0,40}'SAMPLE_RETURN',[\s\S]{0,40}'SAMPLE_CODING'/);
  assert.match(panel, /function requiresSampleRoute/);
  assert.match(panel, /const lineageSummary = useMemo\(\(\) => getPcnGeneratedDocumentLineageSummary\([\s\S]{0,800}requiresSampleRoute\(selectedKind\) \? activeRouteId : undefined/);
  assert.doesNotMatch(panel, /\['SAMPLE_TAKING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN', 'SAMPLE_CODING'\]\.includes/);
  assert.match(panel, /aria-label="Biểu mẫu cần sinh"/);
  assert.doesNotMatch(panel, /role="tablist"/);
  assert.doesNotMatch(panel, /role="tab"/);
});

test('PCN Word/PDF generation exposes a context-bound lineage summary', () => {
  const generated: PcnGeneratedDocument[] = [
    { id: 'cover-old-pdf', dossierId: dossier.id, kind: 'DOSSIER_COVER', format: 'PDF', fileName: 'cover-old.pdf', fileAssetId: 'asset-cover-old-pdf', mimeType: 'application/pdf', byteSize: 10, sha256: '1'.repeat(64), contextHash: 'ctx-old', sourceUpdatedAt: '2026-08-28T02:00:00.000Z', generatedAt: '2026-08-28T02:01:00.000Z', generatedBy: 'user-1' },
    { id: 'cover-new-docx', dossierId: dossier.id, kind: 'DOSSIER_COVER', format: 'DOCX', fileName: 'cover-new.docx', fileAssetId: 'asset-cover-new-docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', byteSize: 20, sha256: '2'.repeat(64), contextHash: 'ctx-new', sourceUpdatedAt: dossier.updatedAt, generatedAt: '2026-08-28T03:00:00.000Z', generatedBy: 'user-1' },
    { id: 'cover-new-pdf', dossierId: dossier.id, kind: 'DOSSIER_COVER', format: 'PDF', fileName: 'cover-new.pdf', fileAssetId: 'asset-cover-new-pdf', mimeType: 'application/pdf', byteSize: 30, sha256: '3'.repeat(64), contextHash: 'ctx-new', sourceUpdatedAt: dossier.updatedAt, generatedAt: '2026-08-28T03:01:00.000Z', generatedBy: 'user-1' },
  ];

  const complete = getPcnGeneratedDocumentLineageSummary(generated, dossier.id, 'DOSSIER_COVER', undefined, dossier.updatedAt);
  assert.equal(complete.status, 'COMPLETE');
  assert.equal(complete.latest?.contextHash, 'ctx-new');
  assert.equal(complete.latest?.docx?.id, 'cover-new-docx');
  assert.equal(complete.latest?.pdf?.id, 'cover-new-pdf');

  const stale = getPcnGeneratedDocumentLineageSummary(generated, dossier.id, 'DOSSIER_COVER', undefined, '2026-08-29T00:00:00.000Z');
  assert.equal(stale.status, 'STALE');

  const mismatch = getPcnGeneratedDocumentLineageSummary([
    { ...generated[1], contextHash: 'ctx-docx' },
    { ...generated[2], contextHash: 'ctx-pdf' },
  ], dossier.id, 'DOSSIER_COVER', undefined, dossier.updatedAt);
  assert.equal(mismatch.status, 'CONTEXT_MISMATCH');
  assert.equal(mismatch.latest?.status, 'MISSING_DOCX');
  assert.equal(mismatch.lineages.some((lineage) => lineage.status === 'MISSING_PDF'), true);

  const missingPdf = getPcnGeneratedDocumentLineageSummary([generated[1]], dossier.id, 'DOSSIER_COVER', undefined, dossier.updatedAt);
  assert.equal(missingPdf.status, 'MISSING_PDF');
  assert.match(panel, /getPcnGeneratedDocumentLineageSummary/);
  assert.match(panel, /Đủ Word \+ PDF/);
  assert.match(panel, /Khác ngữ cảnh dữ liệu/);
});

test('PCN generated documents stay in private Storage and expose a dedicated UI action', () => {
  assert.match(types, /interface PcnGeneratedDocument/);
  assert.match(server, /pcnGeneratedDocuments/);
  assert.match(server, /app\.post\('\/api\/pcn\/documents\/generate'/);
  const generationRoute = server.slice(server.indexOf("app.post('/api/pcn/documents/generate'"), server.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"));
  assert.match(generationRoute, /getPcnSessionUser\(req\)/);
  assert.match(generationRoute, /res\.status\(401\)/);
  assert.match(server, /contextHash/);
  assert.match(server, /PROPOSAL_SUMMARY/);
  assert.match(server, /PROPOSAL_FORM/);
  assert.match(server, /ASSIGNMENT_FORM/);
  assert.match(server, /EVALUATION_PLAN/);
  assert.match(server, /FIELD_INSPECTION/);
  assert.match(server, /SAMPLE_TAKING/);
  assert.match(server, /SAMPLE_CODING/);
  assert.match(server, /EVALUATION_REPORT/);
  assert.match(server, /LAB_REQUEST/);
  assert.match(server, /SAMPLE_RETURN/);
  const officialGenerationRoute = server.slice(server.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"));
  assert.doesNotMatch(officialGenerationRoute, /PROPOSAL_FORM/);
  assert.match(server, /labRequestId/);
  assert.match(server, /getPcnDocumentSourceUpdatedAt\(dossier\.updatedAt, proposal\.updatedAt/);
  assert.match(server, /ensurePrivateBucket/);
  assert.match(server, /withPgTransaction/);
  assert.match(server, /source_document_id !== existing\.id/);
  assert.match(server, /source_json_path !== 'fileAssetId'/);
  assert.match(server, /'pcnGeneratedDocuments', \$4, 'fileAssetId'/);
  assert.match(store, /generatedDocuments/);
  assert.match(store, /generateDossierDocuments:/);
  assert.match(detail, /PcnDocumentOutputModal/);
  assert.match(detail, /kind=\{documentOutput\.kind\}/);
  assert.match(detail, /getPcnDossierStationGenerationKind/);
  assert.match(detail, /onGenerate=\{onGenerateDocuments\}/);
  assert.match(panel, /buildPcnDossierDocumentContext|contextHash/);
  assert.match(panel, /Mở tệp/);
  assert.match(panel, /PcnFilePreviewButton/);
  assert.match(panel, /generatedAt/);
  assert.match(panel, /Phiếu tóm tắt Đề nghị/);
  assert.match(panel, /ASSIGNMENT_FORM/);
  assert.match(panel, /EVALUATION_PLAN/);
  assert.match(panel, /FIELD_INSPECTION/);
  assert.match(panel, /SAMPLE_TAKING/);
  assert.match(panel, /SAMPLE_CODING/);
  assert.match(panel, /PYC gửi PTN/);
  assert.match(panel, /Cần sinh lại/);
  assert.match(panel, /getPcnDocumentSourceUpdatedAt/);
  assert.match(panel, /requireVerifiedPrivateAsset: true/);
  assert.match(panel, /filter\(\(template\) => template\.documentKind === 'CERTIFICATE' \|\| template\.documentKind === 'DECISION'\)/);
  assert.match(panel, /getPcnUserDisplayName/);
  assert.match(panel, /users: PcnUserAccount\[\]/);
  assert.match(outputModal, /PcnDocumentGenerationPanel[\s\S]{0,1200}users=\{users\}/);
  assert.doesNotMatch(panel, /pcnDocumentGeneration/);
  assert.match(panel, /pcnDocumentFreshness/);
  assert.match(freshness, /export function getPcnDocumentSourceUpdatedAt/);
  assert.match(outputModal, /proposalUpdatedAt=\{proposalUpdatedAt\}/);
  assert.doesNotMatch(panel, /base64|arrayBuffer\(\)|readAsDataURL/i);
});

test('generated forms can be explicitly confirmed into the matching dossier checklist item', () => {
  assert.match(server, /\/api\/pcn\/dossiers\/:dossierId\/documents\/confirm-generated/);
  assert.match(store, /confirmGeneratedDocument/);
  assert.match(detail, /onConfirmGenerated/);
  assert.match(detail, /documentRequirements=\{requirements\}/);
  assert.match(panel, /getPcnGeneratedDocumentRequirementCode/);
  assert.match(panel, /onConfirmGenerated/);
  assert.match(panel, /Xác nhận vào checklist/);
  assert.match(dossierDocumentApi, /confirmPcnGeneratedDocumentIntoChecklist/);
});

test('PCN document generation exposes a read-only preflight before creating files', () => {
  const generationRoute = server.slice(server.indexOf("app.post('/api/pcn/documents/generate'"), server.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"));
  assert.match(generationRoute, /dryRun/);
  assert.match(generationRoute, /documents: \[\], activityLogs: \[\]/);
  assert.match(generationApi, /dryRun/);
  assert.match(generationApi, /labRequestId/);
  assert.match(store, /preflightDossierDocuments/);
  assert.match(detail, /onPreflight/);
  assert.match(panel, /Kiểm tra dữ liệu/);
  assert.match(panel, /getPcnDocumentPreflightIssues/);
  assert.match(panel, /preflight/);
  assert.match(panel, /LAB_REQUEST/);
  assert.match(panel, /PROPOSAL_FORM/);
  assert.match(panel, /SAMPLE_TAKING/);
  assert.match(panel, /SAMPLE_RETURN/);
  assert.match(panel, /Đề nghị chứng nhận đầy đủ/);
});

test('PCN generation binds file creation to the preflight context hash', () => {
  const generationRoute = server.slice(server.indexOf("app.post('/api/pcn/documents/generate'"), server.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"));
  assert.match(generationRoute, /expectedContextHash/);
  assert.match(generationRoute, /getPcnDocumentContextConflict/);
  assert.match(generationRoute, /statusCode: 409/);
  assert.match(generationApi, /expectedContextHash/);
  assert.match(store, /expectedContextHash/);
  assert.match(panel, /preflight\.contextHash/);
  assert.match(panel, /ngữ cảnh dữ liệu đã thay đổi/);
});

test('PCN operational forms preserve the same dossier context in Word and PDF', async () => {
  const forms = [
    { title: 'PHIẾU PHÂN CÔNG CHỨNG NHẬN', docx: buildPcnAssignmentFormDocx(context), pdf: await buildPcnAssignmentFormPdf(context) },
    { title: 'KẾ HOẠCH ĐÁNH GIÁ CNSP', docx: buildPcnEvaluationPlanDocx(context), pdf: await buildPcnEvaluationPlanPdf(context) },
    { title: 'BIÊN BẢN KIỂM TRA TẠI HIỆN TRƯỜNG', docx: buildPcnFieldInspectionDocx(context), pdf: await buildPcnFieldInspectionPdf(context) },
  ];

  for (const form of forms) {
    const documentXml = new PizZip(form.docx).file('word/document.xml')?.asText() || '';
    assert.match(documentXml, new RegExp(form.title));
    assert.match(documentXml, /QC4-2026-0665/);
    assert.match(documentXml, /evaluator\.qc4/);
    assert.match(documentXml, /không thay thế/i);
    assert.equal(form.pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok((await PDFDocument.load(form.pdf)).getPageCount() >= 1);
  }
});

test('PCN sample coding form binds the selected sample route and lot', async () => {
  const sampleLot = {
    id: 'lot-coding-0665', dossierId: dossier.id, lotCode: 'LOT-QC4-0665', sampleName: 'Bình đun nước siêu tốc',
    model: 'KETTLE-01', brand: 'PCN Brand', quantity: 1, unit: 'cái', fieldCodes: ['QC4'],
    routeIds: ['route-coding-0665'], status: 'PREPARED' as const, currentLocation: 'Kho PCN',
    receivedAt: '2026-08-28T06:00:00.000Z', updatedAt: '2026-08-29T06:00:00.000Z',
  };
  const sampleRoute = {
    id: 'route-coding-0665', sampleLotId: sampleLot.id, labCode: 'PERFORMANCE' as const,
    labName: 'Phòng thử nghiệm Hiệu suất', status: 'PENDING' as const, labRequestId: labRequest.id,
    sentAt: '', receivedAt: '', resultReturnedAt: '', returnedAt: '', note: '', updatedAt: '2026-08-29T06:00:00.000Z',
  };
  const codingContext = buildPcnDossierDocumentContext({
    dossier, proposal, fields, documents, documentRequirements, attachments,
    sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [labRequest], sampleRouteId: sampleRoute.id,
  });
  const docx = buildPcnSampleCodingDocx(codingContext);
  const documentXml = new PizZip(docx).file('word/document.xml')?.asText() || '';
  assert.match(documentXml, /BIÊN BẢN MÃ HÓA MẪU/);
  assert.match(documentXml, /LOT-QC4-0665/);
  assert.match(documentXml, /route-coding-0665/);
  const pdf = await buildPcnSampleCodingPdf(codingContext);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 1);
});

// --- End of pcn-document-generation.test.ts ---
