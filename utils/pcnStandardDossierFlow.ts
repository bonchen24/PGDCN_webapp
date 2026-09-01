// Author: Codex
// OS support: Browser/Node (test harness only)
// Description: Source-surveyed PCN dossier fixtures and a deterministic end-to-end flow runner.

import type {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  OutboundLabRequest,
  PcnApprovalStep,
  PcnCertificationFieldCode,
  PcnCertificationMethod,
  PcnDossierDocument,
  PcnDossierDocumentWaiver,
  PcnDossierStatus,
  PcnSampleLabCode,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import { applyPcnApprovalDecision, buildPcnApprovalSteps } from './pcnApproval.ts';
import { buildPcnDossierChecklist, getPcnDocumentRequirements } from './pcnDossierDocuments.ts';
import { getPcnDossierStageGateDenial, buildPcnDossierStageGate } from './pcnDossierStageGate.ts';
import { getPcnSampleLabCodesForFields, buildPcnSampleLot, transitionPcnSampleRoute } from './pcnSampleFlow.ts';
import { buildPcnLabRequest, transitionPcnLabRequest } from './pcnLabRouting.ts';
import { buildPcnReturnedResult, markOfficialPcnResults } from './pcnResultPolicy.ts';
import { buildPcnIssuancePackage, approvePcnIssuancePackage, archivePcnIssuancePackage, deliverPcnIssuancePackage, getPcnIssuanceReadiness, issuePcnIssuancePackage } from './pcnIssuance.ts';
import { getPcnDossierStatusMutationDenial, transitionPcnDossier } from './pcnWorkflow.ts';
import { evaluatePcnSampleAcceptance, markPcnProposalConverted } from './pcnPolicy.ts';

export interface PcnStandardLabArtifact {
  labCode: PcnSampleLabCode;
  pycNumber: string;
  reportNumber: string;
  sourceFileName: string;
}

export interface PcnStandardDossierFixture {
  sourceLabel: string;
  sourceRelativeFolder: string;
  fieldCode: PcnCertificationFieldCode;
  method: PcnCertificationMethod;
  dossierCode: string;
  intakeLabel: 'Đề nghị';
  outboundRequestLabel: 'PYC gửi phòng thử nghiệm';
  proposal: CertificationProposal;
  sampleName: string;
  sampleModel: string;
  sampleQuantity: number;
  lotCode: string;
  sourceFiles: Readonly<Record<string, readonly string[]>>;
  /** Optional relative-path hints used only by the source survey/seed command. */
  sourceFilePathHints?: Readonly<Record<string, string>>;
  labArtifacts: readonly PcnStandardLabArtifact[];
  waivers: Readonly<Record<string, string>>;
}

const QC4_SOURCE_FOLDER = 'Hồ sơ chứng nhận QCVN4 2026/2026/Kết quả QCVN4 2026/0583 Đại Dương 2 quạt màn 2 full';
const QC9_SOURCE_FOLDER = 'Hồ sơ chứng nhận QCVN9 2026/KQ chứng nhận QC9-26/IEMM 0499-19 Canzy TF ok';

const qc4Proposal: CertificationProposal = {
  id: 'standard-proposal-qc4-0583',
  proposalCode: 'DN-QC4-0583',
  channel: 'DIRECT',
  status: 'RECEIVED',
  customerSnapshot: {
    name: 'Công ty TNHH MTV Đại Dương LS',
    address: 'Số 47/1, đường Bà Triệu, phường Kỳ Lừa, tỉnh Lạng Sơn',
    contactPerson: 'Người đại diện theo hồ sơ nguồn',
  },
  warehouseAddress: 'Tổ dân phố 2 thôn Đoài, Mai xá, phường Nam Định, tỉnh Ninh Bình',
  productName: 'Quạt điện (quạt màn), loại 5 cánh',
  productType: 'Quạt điện',
  model: 'JY-680; JY-920',
  brand: 'Chưa ghi nhận trên biểu mẫu nguồn',
  specifications: '220 V; 50 Hz; 10 W / 15 W',
  manufacturer: 'Theo hồ sơ nhập khẩu của khách hàng',
  quantity: 2,
  fieldCodes: ['QC4'],
  receivedAt: '2026-04-06T00:00:00.000Z',
};

const qc9Proposal: CertificationProposal = {
  id: 'standard-proposal-qc9-0499-19',
  proposalCode: 'DN-QC9-0499-19',
  channel: 'DIRECT',
  status: 'RECEIVED',
  customerSnapshot: {
    name: 'CÔNG TY CỔ PHẦN CANZY VIỆT NAM',
    address: 'C15-C16, khu đấu giá Tân Triều, đường Yên Xá, phường Hà Đông, thành phố Hà Nội',
    contactPerson: 'Người đại diện theo hồ sơ nguồn',
  },
  warehouseAddress: 'Kho hàng nhập khẩu theo hồ sơ Canzy',
  productName: 'Bếp điện từ đôi, cố định',
  productType: 'Thiết bị điện',
  model: 'CZ-I70072C.NEW; CZ-I93922C.SERIAL 8.0',
  brand: 'CANZY',
  specifications: '220-240 V; 50-60 Hz; 4400 W (2200 W + 2200 W)',
  manufacturer: 'ZHONGSHAN FANSHENG ELECTRIC APPLIANCES CO., LTD',
  manufacturerAddress: 'No.268 10th Building Dongfu Rd, Dongfeng, Zhongshan, Guangdong, China',
  quantity: 2,
  fieldCodes: ['QC9'],
  receivedAt: '2026-05-29T00:00:00.000Z',
};

/**
 * These two fixtures are normalized from the standard source sets surveyed on
 * the PCN Desktop folder. They contain metadata and file names only; the
 * Desktop binaries are never imported into the application runtime.
 */
export const PCN_STANDARD_DOSSIER_FIXTURES: readonly PcnStandardDossierFixture[] = [
  {
    sourceLabel: 'QC4 · 0583 Đại Dương · hồ sơ lô hàng đầy đủ',
    sourceRelativeFolder: QC4_SOURCE_FOLDER,
    fieldCode: 'QC4',
    method: 'METHOD_7',
    dossierCode: 'IEMM.26/HQA/0583.2A-SP',
    intakeLabel: 'Đề nghị',
    outboundRequestLabel: 'PYC gửi phòng thử nghiệm',
    proposal: qc4Proposal,
    sampleName: 'Quạt điện (quạt màn)',
    sampleModel: 'JY-680; JY-920',
    sampleQuantity: 2,
    lotCode: 'PCN-QC4-0583.2A-M01',
    sourceFiles: {
      PROPOSAL: ['Đề nghị CNSP theo PT7 QC4.doc'],
      COMMERCIAL: ['HDNK03-DD-2026DAKY.pdf', 'HDTM 03-DD-2026DAKY.pdf', 'PDG03-DD-2026DA KY.pdf'],
      ASSIGNMENT_FORM: ['Nhap data Bien ban 0583.docx'],
      EVALUATION_PLAN: ['Nhap data Bien ban 0583.docx'],
      FIELD_INSPECTION: ['BB KQ DANH GIA TAI HIEN TRUONG DA KY.pdf'],
      LAB_REQUEST: ['PYC 0583 2 Quạt FULL.docx'],
      SAMPLE_CODING: ['BB LAY MAU DA KY.pdf'],
      SAMPLE_HANDOVER: ['BB Hiện trường-BB lấy mẫu-Đại Dương LS.doc'],
      TEST_REPORT: ['ITD 430-26-M01 full quattran (0583).docx', 'ITD 430-26-M02 full quattran (0583).docx'],
      CERTIFICATION_RESULT: ['Nhap data Bien ban 0583.docx'],
      CERTIFICATE: ['Nhap data GCN 0583.docx'],
      DECISION: ['Nhap data Quyet Dinh 0583.docx'],
      CLIENT_PACKAGE: ['Dấu mềm.docx', 'MAU NHAN DD DAKY.pdf'],
      ARCHIVE_SCAN: ['Nhap data GCN 0583.docx'],
    },
    labArtifacts: [
      { labCode: 'PERFORMANCE', pycNumber: 'ITD 430-26-M01', reportNumber: 'ITD 430-26-M01', sourceFileName: 'ITD 430-26-M01 full quattran (0583).docx' },
      { labCode: 'EMC', pycNumber: 'ITD 430-26-M02', reportNumber: 'ITD 430-26-M02', sourceFileName: 'ITD 430-26-M02 full quattran (0583).docx' },
      { labCode: 'ELECTRICAL_SAFETY', pycNumber: 'ITD 430-26-M01/M02', reportNumber: 'ITD 430-26-M01/M02', sourceFileName: 'ITD 430-26-M01 full quattran (0583).docx' },
    ],
    waivers: {},
  },
  {
    sourceLabel: 'QC9 · 0499-19 Canzy · hồ sơ sản phẩm có PYC/KQTN/GCN/QĐ',
    sourceRelativeFolder: QC9_SOURCE_FOLDER,
    fieldCode: 'QC9',
    method: 'METHOD_1',
    dossierCode: 'IEMM.26/EMC/0499-SP-19',
    intakeLabel: 'Đề nghị',
    outboundRequestLabel: 'PYC gửi phòng thử nghiệm',
    proposal: qc9Proposal,
    sampleName: 'Bếp điện từ đôi, cố định',
    sampleModel: 'CZ-I70072C.NEW; CZ-I93922C.SERIAL 8.0',
    sampleQuantity: 2,
    lotCode: 'PCN-QC9-0499-19-M01',
    sourceFiles: {
      PROPOSAL: ['BM-QT-06-05a De nghi chung nhan san pham theo phuong thuc 1 NEW - Copy.doc'],
      LAB_REQUEST: ['PYC 1739.pdf', 'PYC 1441.pdf'],
      SAMPLE_CODING: ['bb lấy mẫu.doc'],
      SAMPLE_HANDOVER: ['bb lấy mẫu.doc'],
      SAMPLE_RETURN: ['0499-19.docx'],
      TEST_REPORT: ['TEST REPORT-DTNCVN 2606-01739.pdf', 'TEST REPORT-DTNCVN 2606-01741.pdf'],
      CERTIFICATION_RESULT: ['IEMM 0499-SP-19- Loại nội dung dài.docx'],
      CERTIFICATE: ['IEMM 0499-SP-19- Loại nội dung dài.docx'],
      DECISION: ['IEMM 0499-SP-19-Quyết định.doc'],
      CLIENT_PACKAGE: ['IEMM 0499-SP-19- Loại nội dung dài.docx', 'IEMM 0499-SP-19-Quyết định.doc'],
      ARCHIVE_SCAN: ['IEMM 0499-SP-19- Loại nội dung dài.docx'],
    },
    sourceFilePathHints: {
      '0499-19.docx': 'Biên bản, giấy tờ, báo giá, công văn/Biên bản nhận  trả mẫu/0499-canzy/0499-19.docx',
    },
    labArtifacts: [
      { labCode: 'PERFORMANCE', pycNumber: 'PYC 1739', reportNumber: 'DTNCVN 2606-01739', sourceFileName: 'TEST REPORT-DTNCVN 2606-01739.pdf' },
      { labCode: 'EMC', pycNumber: 'PYC 1441', reportNumber: 'DTNCVN 2606-01741', sourceFileName: 'TEST REPORT-DTNCVN 2606-01741.pdf' },
      { labCode: 'ELECTRICAL_SAFETY', pycNumber: 'PYC 1739', reportNumber: 'DTNCVN 2606-01739', sourceFileName: 'TEST REPORT-DTNCVN 2606-01739.pdf' },
    ],
    waivers: {
      'QC9-COMMERCIAL': 'Bộ nguồn 0499-19 không lưu riêng báo giá/hợp đồng; đã đối chiếu hồ sơ nhập khẩu và xác nhận bổ sung trước khi phát hành.',
      'QC9-ASSIGNMENT_FORM': 'Bộ nguồn 0499-19 không lưu riêng phiếu phân công; thông tin người phụ trách được xác nhận trong hồ sơ PCN.',
      'QC9-EVALUATION_PLAN': 'Bộ nguồn 0499-19 không lưu riêng kế hoạch đánh giá; nội dung đánh giá được xác nhận từ bộ hồ sơ chuẩn.',
      'QC9-FIELD_INSPECTION': 'Bộ nguồn 0499-19 không lưu riêng biên bản hiện trường; đã đánh dấu thiếu và xác nhận căn cứ hồ sơ nguồn.',
    },
  },
];

export interface PcnStandardDossierFlowResult {
  stageKeys: string[];
  dossier: CertificationDossier;
  proposal: CertificationProposal;
  documents: PcnDossierDocument[];
  sampleLot: PcnSampleLot;
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  returnedResults: ReturnedTestResult[];
  approvalSteps: PcnApprovalStep[];
  issuance: IssuancePackage;
  stageGates: ReturnType<typeof buildPcnDossierStageGate>[];
  waivers: Record<string, string>;
  waivedRequirementIds: string[];
}

const FLOW_TIMES = {
  start: '2026-08-31T01:00:00.000Z',
  intake: '2026-08-31T01:05:00.000Z',
  sample: '2026-08-31T02:00:00.000Z',
  labReceived: '2026-08-31T03:00:00.000Z',
  result: '2026-08-31T04:00:00.000Z',
  approval: '2026-08-31T05:00:00.000Z',
  issued: '2026-08-31T06:00:00.000Z',
  delivered: '2026-08-31T07:00:00.000Z',
  archived: '2026-08-31T08:00:00.000Z',
} as const;

function fileMimeType(fileName: string): string {
  const extension = fileName.toLowerCase().split('.').pop();
  if (extension === 'pdf') return 'application/pdf';
  if (extension === 'doc' || extension === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (extension === 'xlsx') return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  return 'application/octet-stream';
}

function markDocumentPresent(document: PcnDossierDocument, fileName: string): PcnDossierDocument {
  const assetId = `source-asset-${document.id}`;
  return {
    ...document,
    currentVersionId: assetId,
    status: 'PRESENT',
    versions: [{
      assetId,
      fileName,
      mimeType: fileMimeType(fileName),
      byteSize: 1,
      uploadedAt: FLOW_TIMES.start,
      uploadedBy: 'source-survey',
    }],
  };
}

function normalizeWaivers(fixture: PcnStandardDossierFixture): Record<string, PcnDossierDocumentWaiver> {
  return Object.fromEntries(Object.entries(fixture.waivers).map(([requirementId, reason]) => [requirementId, {
    requirementId,
    reason,
    decidedAt: FLOW_TIMES.intake,
    decidedByUsername: 'luongxuanhung',
  }]));
}

function buildSourceBackedChecklist(fixture: PcnStandardDossierFixture, dossierId: string): { documents: PcnDossierDocument[]; waivers: Record<string, PcnDossierDocumentWaiver> } {
  const waivers = normalizeWaivers(fixture);
  const checklist = buildPcnDossierChecklist(dossierId, [fixture.fieldCode], undefined, FLOW_TIMES.start);
  const requiredCodes = new Set(getPcnDocumentRequirements([fixture.fieldCode]).filter((item) => item.required).map((item) => item.id));
  const documents = checklist.map((document) => {
    const requirementCode = document.requirementId.slice(`${fixture.fieldCode}-`.length);
    const sourceFile = fixture.sourceFiles[requirementCode]?.[0];
    if (sourceFile) return markDocumentPresent(document, sourceFile);
    if (requiredCodes.has(document.requirementId) && !waivers[document.requirementId]) {
      throw new Error(`Bộ hồ sơ chuẩn ${fixture.dossierCode} thiếu fixture cho ${document.requirementId}`);
    }
    return document;
  });
  return { documents, waivers };
}

function advanceDossier(
  dossier: CertificationDossier,
  nextStatus: PcnDossierStatus,
  documents: PcnDossierDocument[],
  waivers: Record<string, PcnDossierDocumentWaiver>,
): CertificationDossier {
  const denial = getPcnDossierStageGateDenial({ dossier, nextStatus, documents, documentWaivers: waivers });
  if (denial) throw new Error(`${dossier.dossierCode}: ${denial}`);
  const next = transitionPcnDossier(dossier.status, nextStatus);
  return { ...dossier, status: next.status, updatedAt: FLOW_TIMES.intake };
}

export function buildPcnStandardDossierFlow(fixture: PcnStandardDossierFixture): PcnStandardDossierFlowResult {
  const dossierId = `standard-dossier-${fixture.fieldCode.toLowerCase()}-${fixture.proposal.proposalCode.toLowerCase()}`;
  const convertedProposal = markPcnProposalConverted(fixture.proposal, dossierId, FLOW_TIMES.intake);
  let dossier: CertificationDossier = {
    id: dossierId,
    dossierCode: fixture.dossierCode,
    proposalId: fixture.proposal.id,
    customerSnapshot: fixture.proposal.customerSnapshot,
    fieldCodes: [fixture.fieldCode],
    method: fixture.method,
    status: 'DRAFT',
    ownerUsername: 'tranhoangphuong',
    labRequestIds: [],
    returnedResultIds: [],
    sampleLotIds: [],
    createdAt: FLOW_TIMES.start,
    updatedAt: FLOW_TIMES.start,
    documentWaivers: normalizeWaivers(fixture),
  };
  const { documents, waivers } = buildSourceBackedChecklist(fixture, dossierId);

  for (const nextStatus of ['INTAKE_REVIEW', 'AWAITING_DOCUMENTS', 'ASSIGNED', 'PLAN_PENDING_APPROVAL', 'FIELD_EVALUATION', 'AWAITING_SAMPLING'] as const) {
    dossier = advanceDossier(dossier, nextStatus, documents, waivers);
  }

  const sampleAcceptance = evaluatePcnSampleAcceptance({
    isSealed: true,
    isUnused: true,
    matchesProposal: true,
    sampleCount: fixture.sampleQuantity,
    minimumSampleCount: 1,
  });
  if (!sampleAcceptance.accepted) throw new Error(`${fixture.dossierCode}: mẫu chuẩn không đạt điều kiện tiếp nhận.`);

  const sampleLotResult = buildPcnSampleLot({
    id: `sample-lot-${fixture.fieldCode.toLowerCase()}-${fixture.proposal.proposalCode.toLowerCase()}`,
    dossierId,
    lotCode: fixture.lotCode,
    sampleName: fixture.sampleName,
    model: fixture.sampleModel,
    brand: fixture.proposal.brand,
    quantity: fixture.sampleQuantity,
    unit: 'mẫu',
    fieldCodes: [fixture.fieldCode],
    labCodes: getPcnSampleLabCodesForFields([fixture.fieldCode]),
    receivedAt: FLOW_TIMES.sample,
  }, FLOW_TIMES.sample);
  let sampleRoutes = sampleLotResult.routes;
  dossier = { ...dossier, sampleLotIds: [sampleLotResult.lot.id], status: 'AWAITING_SAMPLING' };

  const labRequests: OutboundLabRequest[] = [];
  const returnedResults: ReturnedTestResult[] = [];
  sampleRoutes = sampleRoutes.map((initialRoute) => {
    const artifact = fixture.labArtifacts.find((item) => item.labCode === initialRoute.labCode);
    if (!artifact) throw new Error(`${fixture.dossierCode}: thiếu dữ liệu PYC/KQTN cho tuyến ${initialRoute.labCode}`);
    const request = buildPcnLabRequest({
      id: `lab-request-${dossierId}-${initialRoute.labCode.toLowerCase()}`,
      dossierId,
      fieldCode: fixture.fieldCode,
      laboratoryName: initialRoute.labName,
      sampleLotId: sampleLotResult.lot.id,
      sampleRouteId: initialRoute.id,
      pycNumber: artifact.pycNumber,
      targetDate: '2026-09-10',
      criteria: fixture.proposal.specifications,
      handoverAt: FLOW_TIMES.sample,
    }, FLOW_TIMES.sample);
    labRequests.push({ ...request, ...transitionPcnLabRequest(request.status, 'SENT') });
    let route = transitionPcnSampleRoute(initialRoute, 'SENT', { labRequestId: request.id }, FLOW_TIMES.sample);
    route = transitionPcnSampleRoute(route, 'RECEIVED', {}, FLOW_TIMES.labReceived);
    route = transitionPcnSampleRoute(route, 'RESULT_RETURNED', {}, FLOW_TIMES.result);
    const result = buildPcnReturnedResult({
      id: `returned-result-${dossierId}-${initialRoute.labCode.toLowerCase()}`,
      dossierId,
      labRequestId: request.id,
      round: 1,
      outcome: 'PASS',
      receivedAt: FLOW_TIMES.result,
      reportNumber: artifact.reportNumber,
      fileAssetId: `private-scan-${dossierId}-${initialRoute.labCode.toLowerCase()}`,
      ocrEvidence: {
        provider: 'PADDLEOCR',
        sourceFileName: artifact.sourceFileName,
        confidence: 0.98,
        confirmedAt: FLOW_TIMES.result,
        confirmedBy: 'tranhoangphuong',
      },
    }, FLOW_TIMES.result);
    returnedResults.push(result);
    route = transitionPcnSampleRoute(route, 'RETURNED_TO_PCN', { labRequestId: request.id }, FLOW_TIMES.result);
    return transitionPcnSampleRoute(route, 'CLOSED', {}, FLOW_TIMES.archived);
  });
  const officialResults = markOfficialPcnResults(returnedResults);
  dossier = { ...dossier, labRequestIds: labRequests.map((request) => request.id), returnedResultIds: officialResults.map((result) => result.id), status: 'SENT_TO_LAB' };
  dossier = advanceDossier(dossier, 'AWAITING_RESULTS', documents, waivers);
  dossier = advanceDossier(dossier, 'TECHNICAL_REVIEW', documents, waivers);

  if (!getPcnDossierStatusMutationDenial(dossier.status, 'WAITING_APPROVAL')) {
    throw new Error(`${fixture.dossierCode}: flow không đi qua boundary phát hành.`);
  }
  const issuanceDraft = buildPcnIssuancePackage({ id: `issuance-${dossierId}`, dossier: { id: dossier.id, method: dossier.method }, now: FLOW_TIMES.approval });
  const approvalSteps = buildPcnApprovalSteps(dossierId, FLOW_TIMES.approval);
  const pendingIssuance: IssuancePackage = { ...issuanceDraft, status: 'PENDING_APPROVAL', approvalStepIds: approvalSteps.map((step) => step.id) };
  dossier = { ...dossier, status: 'WAITING_APPROVAL', issuancePackageId: pendingIssuance.id };
  let completedApprovalSteps = approvalSteps;
  for (const step of approvalSteps) {
    completedApprovalSteps = applyPcnApprovalDecision(completedApprovalSteps, step.id, 'APPROVE', 'Đã kiểm tra bộ hồ sơ chuẩn.', FLOW_TIMES.approval);
  }
  dossier = { ...dossier, status: 'APPROVED' };
  const issuanceReadiness = getPcnIssuanceReadiness({ status: dossier.status }, officialResults, completedApprovalSteps);
  if (!issuanceReadiness.ready) throw new Error(`${fixture.dossierCode}: chưa đủ điều kiện phát hành: ${issuanceReadiness.reasons.join('; ')}`);
  const approvedIssuance = approvePcnIssuancePackage(pendingIssuance, FLOW_TIMES.approval);
  const issued = issuePcnIssuancePackage(approvedIssuance, {
    issuanceNumber: `${fixture.dossierCode}-GCN`,
    signerUsername: 'luongxuanhung',
    issuedAt: FLOW_TIMES.issued,
  });
  dossier = { ...dossier, status: 'ISSUED' };
  const delivered = deliverPcnIssuancePackage(issued, { recipient: fixture.proposal.customerSnapshot.name, deliveredAt: FLOW_TIMES.delivered, note: 'Giao bộ hồ sơ chuẩn để kiểm thử flow PCN.' });
  dossier = { ...dossier, status: 'DELIVERED' };
  const archived = archivePcnIssuancePackage(delivered, FLOW_TIMES.archived);
  dossier = { ...dossier, status: 'ARCHIVED' };

  const stageGateStatuses: Array<{ status: PcnDossierStatus; label: string }> = [
    { status: 'FIELD_EVALUATION', label: 'INTAKE' },
    { status: 'SENT_TO_LAB', label: 'SAMPLING_LAB' },
    { status: 'TECHNICAL_REVIEW', label: 'RESULTS' },
    { status: 'APPROVED', label: 'APPROVAL' },
    { status: 'ARCHIVED', label: 'DELIVERY_ARCHIVE' },
  ];
  const stageGates = stageGateStatuses.map(({ status }) => buildPcnDossierStageGate({ dossier: { ...dossier, status }, documents, documentWaivers: waivers }));
  return {
    stageKeys: stageGateStatuses.map((item) => item.label),
    dossier,
    proposal: convertedProposal,
    documents,
    sampleLot: { ...sampleLotResult.lot, status: 'CLOSED', currentLocation: 'Đã hoàn tất' },
    sampleRoutes,
    labRequests,
    returnedResults: officialResults,
    approvalSteps: completedApprovalSteps,
    issuance: archived,
    stageGates,
    waivers: { ...fixture.waivers },
    waivedRequirementIds: Object.keys(fixture.waivers).sort(),
  };
}

// --- End of pcnStandardDossierFlow.ts ---
