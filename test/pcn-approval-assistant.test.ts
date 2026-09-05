import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  PCN_APPROVAL_REVIEW_CRITERIA,
  buildPcnApprovalReview,
  getPcnApprovalReviewCandidates,
  type PcnApprovalReviewInput,
} from '../utils/pcnApprovalReview.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

const dossier = (overrides: Record<string, unknown> = {}) => ({
  id: 'dossier-1',
  dossierCode: 'IEMM.26/HQA/0001.7A-SP',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_7',
  status: 'TECHNICAL_REVIEW',
  labRequestIds: ['pyc-1'],
  returnedResultIds: ['result-1'],
  sampleLotIds: ['lot-1'],
  ...overrides,
} as any);

const proposal = (overrides: Record<string, unknown> = {}) => ({
  id: 'proposal-1',
  proposalCode: 'ITDC 001-26',
  channel: 'DIRECT',
  status: 'CONVERTED',
  customerSnapshot: { name: 'Hưng Thịnh Phát', address: 'Hà Nội' },
  productName: 'Dây cáp điện và quạt thông gió',
  model: 'RVSP 2x0.75',
  brand: 'Nedfon',
  quantity: 7,
  fieldCodes: ['QC4'],
  receivedAt: '2026-01-03T00:00:00.000Z',
  ...overrides,
} as any);

function input(overrides: Partial<PcnApprovalReviewInput> = {}): PcnApprovalReviewInput {
  return {
    fieldCode: 'QC4',
    dossier: dossier(),
    proposal: proposal(),
    requirements: [
      { id: 'QC4-PROPOSAL', fieldCode: 'QC4', code: 'PROPOSAL', name: 'Đề nghị', stages: ['INTAKE'], required: true, active: true, sortOrder: 1 },
      { id: 'QC4-TEST_REPORT', fieldCode: 'QC4', code: 'TEST_REPORT', name: 'Báo cáo thử nghiệm', stages: ['RESULTS'], required: true, active: true, sortOrder: 2 },
    ] as any,
    documents: [
      {
        id: 'doc-proposal', dossierId: 'dossier-1', requirementId: 'QC4-PROPOSAL', fieldCode: 'QC4',
        currentVersionId: 'asset-proposal', status: 'PRESENT',
        versions: [{ assetId: 'asset-proposal', fileName: 'PYC 0001.docx', uploadedAt: '2026-01-03T00:00:00.000Z' }],
      },
    ] as any,
    labRequests: [{ id: 'pyc-1', pycNumber: 'ITDC 001-26', dossierId: 'dossier-1', fieldCode: 'QC4', laboratoryName: 'IEMM', status: 'RESULT_RETURNED', requestedAt: '2026-01-03T00:00:00.000Z' }] as any,
    sampleLots: [{ id: 'lot-1', dossierId: 'dossier-1', lotCode: 'LOT-1', sampleName: 'Dây cáp điện', quantity: 4, fieldCodes: ['QC4'], routeIds: ['route-1'], status: 'CLOSED', currentLocation: 'PCN' }] as any,
    sampleRoutes: [{ id: 'route-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'IEMM', status: 'RESULT_RETURNED', sequence: 1, labRequestId: 'pyc-1' }] as any,
    returnedResults: [{ id: 'result-1', dossierId: 'dossier-1', labRequestId: 'pyc-1', round: 1, outcome: 'PASS', receivedAt: '2026-01-16T00:00:00.000Z', reportNumber: 'ITDC 001-26-M01', fileAssetId: 'asset-result' }] as any,
    documentTexts: [
      { assetId: 'asset-proposal', fileName: 'PYC 0001.docx', text: 'M01 RVSP 2x0.75; M03 RVSP 2x1; M03 RVSP 2x1.5; M04 RVSP 3x1', page: 1, confidence: 0.99 },
      { assetId: 'asset-result', fileName: 'ITDC 001-26-M01.pdf', text: 'Sample M01. Standard IEC 60227-5:2011. Result: PASS.', page: 3, confidence: 0.98 },
      { assetId: 'asset-evaluation', fileName: 'Bien ban danh gia.docx', text: 'Tiêu chuẩn sản phẩm: TCVN 5699-2-15:2013', page: 2, confidence: 0.96 },
      { assetId: 'asset-certificate', fileName: 'GCN 0001.docx', text: 'Tiêu chuẩn sản phẩm: TCVN 5699-2-80:2007', page: 1, confidence: 0.96 },
    ],
    ...overrides,
  };
}

test('approval assistant candidates are field/status scoped and exclude historical dossiers', () => {
  const candidates = getPcnApprovalReviewCandidates({
    dossiers: [
      dossier(),
      dossier({ id: 'dossier-2', dossierCode: 'WAIT-1', status: 'WAITING_APPROVAL' }),
      dossier({ id: 'dossier-3', dossierCode: 'DRAFT-1', status: 'DRAFT' }),
      dossier({ id: 'dossier-4', dossierCode: 'OLD-1', historicalImport: { batchId: 'old', sourceFamily: 'QC4', sourceFolderName: 'old', sourceRelativePath: 'old', reviewStatus: 'PENDING_REVIEW', unresolvedFields: [], importedAt: '2026-01-01T00:00:00.000Z' } }),
      dossier({ id: 'dossier-5', dossierCode: 'QC9-1', fieldCodes: ['QC9'] }),
    ] as any,
    proposals: [proposal(), proposal({ id: 'proposal-2', proposalCode: 'WAIT-2' })] as any,
    requirements: [],
    documents: [],
    fieldCode: 'QC4',
  });

  assert.deepEqual(candidates.map((item) => item.dossierId), ['dossier-2', 'dossier-1']);
  assert.equal(candidates.every((item) => item.fieldCode === 'QC4'), true);
});

test('approval review detects missing required documents without inventing a pass', () => {
  const report = buildPcnApprovalReview(input());
  const completeness = report.criteria.find((criterion) => criterion.id === 'COMPLETENESS');
  assert.equal(completeness?.status, 'ERROR');
  assert.match(completeness?.findings[0]?.message || '', /Báo cáo thử nghiệm/);
  assert.equal(report.summary.conclusion, 'CẦN KIỂM TRA/BỔ SUNG');
});

test('approval review detects a sample sequence gap and links the PYC evidence', () => {
  const report = buildPcnApprovalReview(input());
  const sample = report.criteria.find((criterion) => criterion.id === 'SAMPLE_PYC');
  const finding = sample?.findings.find((item) => item.code === 'SAMPLE_SEQUENCE_GAP');
  assert.ok(finding);
  assert.equal(finding?.severity, 'CRITICAL');
  assert.equal(finding?.evidence[0]?.assetId, 'asset-proposal');
  assert.equal(finding?.evidence[0]?.page, 1);
});

test('approval review detects conflicting standard references across documents', () => {
  const report = buildPcnApprovalReview(input({
    requirements: [],
    documents: [],
  }));
  const identity = report.criteria.find((criterion) => criterion.id === 'IDENTITY');
  const finding = identity?.findings.find((item) => item.code === 'STANDARD_REFERENCE_MISMATCH');
  assert.ok(finding);
  assert.ok((finding?.evidence.length || 0) >= 2);
  assert.match(finding?.message || '', /5699-2-15:2013/);
  assert.match(finding?.message || '', /5699-2-80:2007/);
});

test('approval review flags basic document typography issues with source evidence', () => {
  const report = buildPcnApprovalReview(input({
    documentTexts: [{ assetId: 'asset-proposal', fileName: 'De nghi.docx', text: 'Đơn vị  : Hưng Thịnh   Phát. Mẫu M01', page: 1, confidence: 0.96 }],
  }));
  const quality = report.criteria.find((criterion) => criterion.id === 'DOCUMENT_QUALITY');
  const finding = quality?.findings.find((item) => item.code === 'TYPOGRAPHIC_ANOMALY');
  assert.ok(finding);
  assert.equal(finding?.evidence[0]?.assetId, 'asset-proposal');
  assert.equal(quality?.status, 'WARNING');
});

test('review criteria stay advisory and never expose an approval action', () => {
  assert.deepEqual(PCN_APPROVAL_REVIEW_CRITERIA.map((criterion) => criterion.id), [
    'ENTRY_GATE', 'COMPLETENESS', 'IDENTITY', 'COMMERCIAL', 'FIELD_EVALUATION',
    'SAMPLE_PYC', 'LAB_RESULTS', 'TECHNICAL_ASSESSMENT', 'CERTIFICATE_DECISION',
    'DOCUMENT_QUALITY', 'SYSTEM_LOGIC',
  ]);
  const report = buildPcnApprovalReview(input());
  assert.equal('approvalAction' in report, false);
  assert.equal('nextStatus' in report, false);
});

test('approval assistant exposes read-only review boundaries and PaddleOCR primary processing', () => {
  assert.match(serverSource, /app\.get\('\/api\/pcn\/approval-assistant\/candidates'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/approval-assistant\/review'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/approval-assistant\/export'/);
  assert.match(serverSource, /tvci_ocr_service|OCR_SERVICE_URL/);
  assert.match(serverSource, /collectPaddleOcr/);
  assert.match(serverSource, /requestPaddleOcr/);
  assert.match(serverSource, /fetchApprovalAssistantOcrPage/);
  assert.match(serverSource, /fetchApprovalAssistantGeminiPage/);
  assert.match(serverSource, /getPersonalGeminiClient/);
  assert.match(serverSource, /GEMINI_API_KEY_MISSING/);
  assert.match(serverSource, /extractPcnDocxEmbeddedImages/);
  const route = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/approval-assistant/review'"));
  const reviewRoute = route.slice(0, route.indexOf("app.post('/api/pcn/approval-assistant/export'"));
  assert.doesNotMatch(reviewRoute, /applyPcnApprovalDecision|approvalSteps|issuancePackages/);
  assert.doesNotMatch(reviewRoute, /UPDATE app_documents|INSERT INTO app_documents|DELETE FROM app_documents/);
  assert.doesNotMatch(reviewRoute, /25\s*\*\s*1024\s*\*\s*1024|25\s*MB/i);
});
