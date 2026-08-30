import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type {
  CertificationDossier,
  CertificationProposal,
  IssuancePackage,
  OutboundLabRequest,
  PcnCertificationField,
  PcnDossierDocument,
  PcnDocumentRequirement,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '../types.ts';
import {
  buildPcnOperationsRegisterRows,
  filterPcnOperationsRegisterRows,
  toPcnOperationsRegisterCsv,
} from '../utils/pcnOperationsRegister.ts';

const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

const fields: PcnCertificationField[] = [
  { code: 'QC4', name: 'Quy chuẩn 4', standardRefs: ['QCVN 4:2009/BKHCN'], active: true },
];

const proposal: CertificationProposal = {
  id: 'proposal-1',
  proposalCode: 'DN-2026-001',
  channel: 'DIRECT',
  status: 'CONVERTED',
  dossierId: 'dossier-1',
  customerId: 'customer-1',
  customerSnapshot: { name: 'Công ty ABC', address: 'Hà Nội' },
  productName: 'Bếp điện từ',
  model: 'AB-01',
  brand: 'Arber',
  quantity: 2,
  fieldCodes: ['QC4'],
  receivedAt: '2026-08-01T08:00:00.000Z',
};

const dossier: CertificationDossier = {
  id: 'dossier-1',
  dossierCode: 'HS-2026-001',
  proposalId: proposal.id,
  fieldCodes: ['QC4'],
  method: 'METHOD_5',
  status: 'AWAITING_RESULTS',
  evaluatorUsername: 'evaluator-1',
  evaluationAt: '2026-08-05T08:00:00.000Z',
  effectiveAt: '2026-08-12T08:00:00.000Z',
  labRequestIds: ['lab-1'],
  returnedResultIds: ['result-1'],
  sampleLotIds: ['lot-1'],
};

const labRequest: OutboundLabRequest = {
  id: 'lab-1',
  pycNumber: 'PYC-2026-001',
  dossierId: dossier.id,
  fieldCode: 'QC4',
  laboratoryName: 'Phòng thử EMC',
  status: 'RECEIVED',
  requestedAt: '2026-08-03T08:00:00.000Z',
  criteria: 'An toàn điện; EMC',
  receivedAt: '2026-08-04T08:00:00.000Z',
};

const sampleLot: PcnSampleLot = {
  id: 'lot-1',
  dossierId: dossier.id,
  lotCode: 'LOT-2026-001',
  sampleName: proposal.productName,
  model: proposal.model,
  quantity: 2,
  fieldCodes: ['QC4'],
  routeIds: ['route-1'],
  status: 'RESULTS_PENDING',
  currentLocation: 'Phòng thử EMC',
  receivedAt: '2026-08-02T08:00:00.000Z',
};

const sampleRoute: PcnSampleRoute = {
  id: 'route-1',
  sampleLotId: sampleLot.id,
  labCode: 'EMC',
  labName: 'Phòng thử EMC',
  status: 'RESULT_RETURNED',
  resultReturnedAt: '2026-08-08T08:00:00.000Z',
  returnedAt: '2026-08-10T08:00:00.000Z',
};

const result: ReturnedTestResult = {
  id: 'result-1',
  dossierId: dossier.id,
  labRequestId: labRequest.id,
  round: 1,
  outcome: 'PASS',
  receivedAt: '2026-08-08T08:00:00.000Z',
  reportNumber: 'EMC 001-26-M01',
};

const issuance: IssuancePackage = {
  id: 'issuance-1',
  dossierId: dossier.id,
  certificateTemplateCode: 'BM-QT-03-02b',
  decisionTemplateCode: 'BM-QĐ-03-01b',
  documentType: 'CERTIFICATE',
  status: 'ISSUED',
  fileAssetIds: [],
  issuanceNumber: 'GCN-PCN-2026-001',
  issuedAt: '2026-08-12T08:00:00.000Z',
};

const documentRequirements: PcnDocumentRequirement[] = [
  { id: 'req-proposal', fieldCode: 'QC4', code: 'PROPOSAL_FORM', name: 'Đề nghị chứng nhận', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
  { id: 'req-review', fieldCode: 'QC4', code: 'TECHNICAL_REVIEW', name: 'Bảng kiểm soát kỹ thuật', stages: ['TECHNICAL_REVIEW'], required: true, active: true, sortOrder: 2 },
];

const dossierDocuments: PcnDossierDocument[] = [
  {
    id: 'document-proposal', dossierId: dossier.id, requirementId: 'req-proposal', fieldCode: 'QC4', status: 'PRESENT', currentVersionId: 'asset-proposal',
    versions: [{ assetId: 'asset-proposal', fileName: 'de-nghi.docx', uploadedAt: '2026-08-01T09:00:00.000Z' }],
  },
  {
    id: 'document-review', dossierId: dossier.id, requirementId: 'req-review', fieldCode: 'QC4', status: 'PRESENT', currentVersionId: 'asset-missing',
    versions: [{ assetId: 'asset-review-old', fileName: 'kiem-tra-cu.pdf', uploadedAt: '2026-08-01T09:00:00.000Z' }],
  },
];

test('builds one operational register row from linked PCN records', () => {
  const [row] = buildPcnOperationsRegisterRows({
    proposals: [proposal],
    dossiers: [dossier],
    sampleLots: [sampleLot],
    sampleRoutes: [sampleRoute],
    labRequests: [labRequest],
    returnedResults: [result],
    issuancePackages: [issuance],
    fields,
  });

  assert.equal(row.dossierId, dossier.id);
  assert.equal(row.registrationCode, proposal.proposalCode);
  assert.equal(row.customerName, 'Công ty ABC');
  assert.equal(row.sampleReceivedAt, sampleLot.receivedAt);
  assert.equal(row.sampleQuantity, 2);
  assert.deepEqual(row.sampleLocations, ['Phòng thử EMC']);
  assert.deepEqual(row.standardRefs, ['QCVN 4:2009/BKHCN']);
  assert.equal(row.lastResultReceivedAt, result.receivedAt);
  assert.deepEqual(row.reportNumbers, ['EMC 001-26-M01']);
  assert.deepEqual(row.labStatuses, ['Phòng thử EMC: RESULT_RETURNED']);
  assert.equal(row.issuanceNumber, issuance.issuanceNumber);
  assert.equal(row.sampleReturnedAt, sampleRoute.returnedAt);
  assert.equal(row.evaluationAt, dossier.evaluationAt);
  assert.equal(row.effectiveAt, dossier.effectiveAt);
  assert.equal(row.evaluatorUsername, dossier.evaluatorUsername);
  assert.deepEqual(row.testCriteria, ['An toàn điện; EMC']);
});

test('projects current station and completeness from the canonical dossier checklist', () => {
  const [row] = buildPcnOperationsRegisterRows({
    proposals: [proposal], dossiers: [dossier], sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [labRequest], returnedResults: [result], issuancePackages: [issuance], fields,
    documentRequirements, dossierDocuments,
  });

  assert.equal(row.ownerUsername, undefined);
  assert.equal(row.stationKey, 'RESULTS');
  assert.equal(row.stationTitle, 'Chờ kết quả');
  assert.equal(row.requiredDocumentTotal, 2);
  assert.equal(row.requiredDocumentPresent, 1);
  assert.equal(row.missingRequiredCount, 1);
  assert.equal(row.completenessScore, 63);
  assert.deepEqual(row.stationMissingLabels, ['Bảng kiểm soát kỹ thuật']);
  assert.deepEqual(row.missingRequiredByStage, [{ stage: 'TECHNICAL_REVIEW', label: 'KQTN & soát xét', labels: ['Bảng kiểm soát kỹ thuật'] }]);
});

test('does not infer missing dates from notes or filenames and tolerates orphaned links', () => {
  const [row] = buildPcnOperationsRegisterRows({
    proposals: [{ ...proposal, id: 'proposal-2', proposalCode: 'DN-2026-002', dossierId: 'dossier-2', receivedAt: '2026-08-15T08:00:00.000Z' }],
    dossiers: [{ ...dossier, id: 'dossier-2', proposalId: 'proposal-2', evaluatorUsername: undefined, evaluationAt: undefined, effectiveAt: undefined, labRequestIds: ['missing-lab'], returnedResultIds: ['missing-result'], sampleLotIds: ['missing-lot'], status: 'INTAKE_REVIEW' }],
    sampleLots: [],
    sampleRoutes: [],
    labRequests: [],
    returnedResults: [],
    issuancePackages: [],
    fields,
  });

  assert.equal(row.receivedAt, '2026-08-15T08:00:00.000Z');
  assert.equal(row.sampleReceivedAt, undefined);
  assert.equal(row.sampleQuantity, undefined);
  assert.deepEqual(row.sampleLocations, []);
  assert.deepEqual(row.standardRefs, ['QCVN 4:2009/BKHCN']);
  assert.equal(row.lastResultReceivedAt, undefined);
  assert.equal(row.sampleReturnedAt, undefined);
  assert.equal(row.evaluationAt, undefined);
  assert.equal(row.effectiveAt, undefined);
  assert.deepEqual(row.reportNumbers, []);
  assert.deepEqual(row.testCriteria, []);
});

test('uses the dossier customer snapshot when the proposal row is unavailable', () => {
  const [row] = buildPcnOperationsRegisterRows({
    proposals: [],
    dossiers: [{ ...dossier, proposalId: 'proposal-missing', customerSnapshot: { name: 'Khách hàng lịch sử', address: 'Địa chỉ trong hồ sơ' } }],
    sampleLots: [],
    sampleRoutes: [],
    labRequests: [],
    returnedResults: [],
    issuancePackages: [],
    fields,
  });

  assert.equal(row.customerName, 'Khách hàng lịch sử');
  assert.equal(row.customerAddress, 'Địa chỉ trong hồ sơ');
});

test('filters the register by year, field, status and workbook-style search terms', () => {
  const rows = buildPcnOperationsRegisterRows({ proposals: [proposal], dossiers: [dossier], sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [labRequest], returnedResults: [result], issuancePackages: [issuance] });
  assert.equal(filterPcnOperationsRegisterRows(rows, { year: '2026', fieldCode: 'QC4', status: 'AWAITING_RESULTS', query: 'AB-01' }).length, 1);
  assert.equal(filterPcnOperationsRegisterRows(rows, { status: 'ISSUED' }).length, 0);
  assert.equal(filterPcnOperationsRegisterRows(rows, { query: 'không tồn tại' }).length, 0);
});

test('filters the register by completeness and dossier ownership without changing source rows', () => {
  const [incompleteRow] = buildPcnOperationsRegisterRows({ proposals: [proposal], dossiers: [dossier], sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [labRequest], returnedResults: [result], issuancePackages: [issuance], documentRequirements, dossierDocuments });
  const completeAssignedRow = {
    ...incompleteRow,
    dossierId: 'dossier-2',
    dossierCode: 'HS-2026-002',
    registrationCode: 'DN-2026-002',
    missingRequiredCount: 0,
    requiredDocumentPresent: incompleteRow.requiredDocumentTotal,
    completenessScore: 100,
    missingRequiredByStage: [],
    stationMissingLabels: [],
    ownerUsername: 'owner-1',
  };
  const rows = [incompleteRow, completeAssignedRow];

  assert.equal(filterPcnOperationsRegisterRows(rows, { completeness: 'INCOMPLETE' }).length, 1);
  assert.equal(filterPcnOperationsRegisterRows(rows, { completeness: 'COMPLETE' }).length, 1);
  assert.equal(filterPcnOperationsRegisterRows(rows, { assignment: 'UNASSIGNED' }).length, 1);
  assert.equal(filterPcnOperationsRegisterRows(rows, { assignment: 'ASSIGNED' }).length, 1);
  assert.equal(incompleteRow.ownerUsername, undefined);
  assert.equal(completeAssignedRow.missingRequiredCount, 0);
});

test('exports a safe, escaped CSV snapshot without file bytes or machine paths', () => {
  const rows = buildPcnOperationsRegisterRows({ proposals: [proposal], dossiers: [dossier], sampleLots: [sampleLot], sampleRoutes: [sampleRoute], labRequests: [labRequest], returnedResults: [result], issuancePackages: [issuance] });
  const csv = toPcnOperationsRegisterCsv(rows);
  assert.match(csv, /Mã đăng ký/);
  assert.match(csv, /DN-2026-001/);
  assert.match(csv, /GCN-PCN-2026-001/);
  const csvLines = csv.split('\r\n').filter(Boolean);
  const csvCellCount = (line: string) => line.match(/"(?:[^"]|"")*"/g)?.length || 0;
  assert.match(csvLines[0], /"Chỉ tiêu thử"/);
  assert.match(csvLines[0], /"Số lượng mẫu"/);
  assert.match(csvLines[0], /"Nơi nhận\/đang giữ mẫu"/);
  assert.match(csvLines[0], /"Tiêu chuẩn"/);
  assert.equal(csvCellCount(csvLines[0]), csvCellCount(csvLines[1]));
  assert.doesNotMatch(csv, /base64|Desktop|C:\\\\Users/i);
  assert.match(toPcnOperationsRegisterCsv([{ ...rows[0], customerName: '=HYPERLINK("x")' }]), /'=HYPERLINK/);
});

test('PCN shell exposes the read-only operations register and opens canonical dossiers', () => {
  assert.match(workspaceSource, /PcnOperationsRegisterView/);
  assert.match(workspaceSource, /'operationsRegister'/);
  assert.match(workspaceSource, /activeSection === 'operationsRegister'/);
  assert.match(workspaceSource, /onOpenDossier=\{\(dossier, initialTab\) => \{ setSelectedDossierTab\(initialTab\); setSelectedDossierId\(dossier\.id\); \}\}/);
  assert.match(workspaceSource, /getPcnPipelineStation/);
  assert.match(workspaceSource, /getPcnDossierStationTab/);
  assert.match(workspaceSource, /selectedDossierId/);
  assert.match(workspaceSource, /documentRequirements=\{pcn\.documentRequirements\}/);
  assert.match(workspaceSource, /dossierDocuments=\{pcn\.dossierDocuments\}/);
  assert.match(designSource, /Sổ điều hành PCN.*báo cáo dẫn xuất read-only/s);
  assert.match(designSource, /không tạo collection hay bản sao nghiệp vụ riêng/);
  const registerSource = fs.readFileSync(new URL('../components/PcnOperationsRegisterView.tsx', import.meta.url), 'utf8');
  assert.match(registerSource, /Ngày đánh giá/);
  assert.match(registerSource, /Ngày hiệu lực/);
  assert.match(registerSource, /Chỉ tiêu thử/);
  assert.match(registerSource, /row\.testCriteria/);
  assert.match(registerSource, /Số lượng mẫu/);
  assert.match(registerSource, /Nơi nhận\/đang giữ mẫu/);
  assert.match(registerSource, /Tiêu chuẩn/);
  assert.match(registerSource, /fields, proposals/);
  assert.match(registerSource, /Mức hoàn thiện/);
  assert.match(registerSource, /missingRequiredByStage/);
  assert.match(registerSource, /Tài liệu bắt buộc còn thiếu/);
  assert.match(registerSource, /Bước hiện tại/);
  assert.match(registerSource, /row\.requiredDocumentPresent/);
  assert.match(registerSource, /row\.missingRequiredCount/);
  assert.match(registerSource, /Còn thiếu tài liệu bắt buộc/);
  assert.match(registerSource, /Chưa phân công/);
  assert.match(designSource, /Số lượng mẫu.*PcnSampleLot\.quantity/s);
  assert.match(designSource, /PcnSampleLot\.currentLocation/s);
  assert.match(designSource, /PcnCertificationField\.standardRefs/s);
});

test('operations register opens each dossier at the region for its current station', () => {
  const registerSource = fs.readFileSync(new URL('../components/PcnOperationsRegisterView.tsx', import.meta.url), 'utf8');
  assert.match(registerSource, /getPcnDossierStationTab/);
  assert.match(registerSource, /onOpenDossier: \(dossier: CertificationDossier, initialTab\?: PcnDossierDetailTab\) => void/);
  assert.match(registerSource, /getPcnDossierStationTab\(row\.stationKey, hasHistoricalReview\)/);
  assert.match(registerSource, /dossier\.historicalImport \|\| proposal\?\.historicalImport/);
  assert.match(workspaceSource, /onOpenDossier=\{\(dossier, initialTab\) => \{ setSelectedDossierTab\(initialTab\); setSelectedDossierId\(dossier\.id\); \}\}/);
  assert.match(workspaceSource, /onOpenDossier=\{\(dossier, initialTab\) => \{ setSelectedDossierTab\(initialTab\); setSelectedDossierId\(dossier\.id\); \}\} \/>/);
});

// --- End of pcn-operations-register.test.ts ---
