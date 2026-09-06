import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PgdFieldInspection,
  PgdApprovalStep,
  PgdInspectionAssignment,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdInspectionCertificate,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from '../utils/pgdDomain.ts';
import type { PgdCaseEvent, PgdFieldActivityLog, PgdInspectionPlan, PgdLabResultReview } from '../utils/pgdArtifacts.ts';
import { buildPgdAssistantReview, getPgdAssistantCandidates } from '../utils/pgdAssistant.ts';

const request: PgdInspectionRequest = {
  id: 'request-1', domain: 'pgd', status: 'RESULTS_REVIEW', requestCode: 'PGD-260905-01',
  intakeChannel: 'DIRECT', requester: { name: 'Nguyen Van A' },
  customerSnapshot: { name: 'Công ty thép A', address: 'Hà Nội', contactPerson: 'Tran Thi B' },
  productGroup: 'STEEL_METAL', catalogItemId: 'steel-1', productName: 'Thép cuộn',
  productDetails: { productForm: 'Cuộn', grade: 'SS400', dimensions: '10mm', origin: 'Việt Nam', manufacturerLotCode: 'LOT-01' },
  quantity: 10, unit: 'tấn', inspectionScope: 'Kiểm tra số lượng và chất lượng',
  inspectionLocation: 'Kho A', method: 'QT-GĐ-10', standards: ['TCVN 1651'], documentPointers: [], sampleIds: ['sample-1'],
  inspectionScheduledAt: '2026-09-01T10:00:00.000Z',
  labRequestIds: ['lab-1'], createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z',
};

const assignment: PgdInspectionAssignment = { id: 'assignment-1', domain: 'pgd', requestId: request.id, inspectorUsernames: ['inspector'], status: 'APPROVED' };
const inspection: PgdFieldInspection = { id: 'inspection-1', domain: 'pgd', requestId: request.id, performedAt: '2026-09-01T10:00:00.000Z', location: 'Kho A', inspectorUsernames: ['inspector'], lotObservation: 'Nhãn lô rõ ràng', measurements: { width: 10 }, inspectionResult: 'Phù hợp', sampleIds: ['sample-1'], completed: true };
const sample: PgdSample = { id: 'sample-1', domain: 'pgd', requestId: request.id, sampleCode: 'M-001', description: 'Mẫu thép', quantity: 1, disposition: 'LAB', sealNumber: 'SEAL-01', sampledAt: '2026-09-01T10:30:00.000Z', samplingLocation: 'Kho A', sampledByUsername: 'inspector', handedOverAt: '2026-09-01T11:00:00.000Z' };
const labRequest: PgdLabRequest = { id: 'lab-1', domain: 'pgd', requestId: request.id, sampleId: sample.id, status: 'RESULT_RECEIVED', laboratoryName: 'PTN A', testItems: ['C'], resultId: 'result-1' };
const labResult: PgdLabResult = { id: 'result-1', domain: 'pgd', requestId: request.id, labRequestId: labRequest.id, receivedAt: '2026-09-01T12:00:00.000Z', values: [{ key: 'C', label: 'Carbon', value: 0.2 }], acceptedAt: '2026-09-01T13:00:00.000Z' };
const report: PgdInspectionReport = { id: 'report-1', domain: 'pgd', requestId: request.id, title: 'Báo cáo giám định', standardSnapshot: ['TCVN 1651'], values: [], conclusion: 'Phù hợp', status: 'DRAFT', createdAt: '2026-09-01T14:00:00.000Z', updatedAt: '2026-09-01T14:00:00.000Z' };
const certificate: PgdInspectionCertificate = { id: 'certificate-1', domain: 'pgd', requestId: request.id, title: 'Chứng thư giám định', conclusion: 'Phù hợp', status: 'DRAFT', createdAt: '2026-09-01T14:00:00.000Z', updatedAt: '2026-09-01T14:00:00.000Z' };
const approvals: PgdApprovalStep[] = [
  { id: 'approval-technical', domain: 'pgd', requestId: request.id, sequence: 1, role: 'TECHNICAL_REVIEW', status: 'APPROVED', actedByUsername: 'reviewer', actedAt: '2026-09-01T15:00:00.000Z' },
  { id: 'approval-leadership', domain: 'pgd', requestId: request.id, sequence: 2, role: 'LEADERSHIP_APPROVAL', status: 'APPROVED', actedByUsername: 'leader', actedAt: '2026-09-01T16:00:00.000Z' },
];
const inspectionPlan: PgdInspectionPlan = { id: 'plan-1', domain: 'pgd', requestId: request.id, inspectionDate: '2026-09-01', team: [{ username: 'inspector', role: 'INSPECTOR' }], productLines: [{ productName: 'Thép cuộn', standard: 'TCVN 1651' }], schedule: [{ startTime: '10:00', activity: 'Kiểm tra hiện trường' }], status: 'COMPLETED', createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T10:00:00.000Z' };
const caseEvent: PgdCaseEvent = { id: 'event-1', domain: 'pgd', requestId: request.id, occurredAt: '2026-09-01T10:30:00.000Z', activity: 'Khách hàng xác nhận hiện trường', actorUsername: 'inspector', customerConfirmed: true, createdAt: '2026-09-01T10:30:00.000Z', updatedAt: '2026-09-01T10:30:00.000Z' };
const fieldActivityLog: PgdFieldActivityLog = { id: 'activity-1', domain: 'pgd', requestId: request.id, session: 'MORNING', entries: [{ time: '10:00', activity: 'Kiểm tra lô thép' }], createdAt: '2026-09-01T10:00:00.000Z', updatedAt: '2026-09-01T10:30:00.000Z' };
const labResultReview: PgdLabResultReview = { id: 'lab-review-1', domain: 'pgd', requestId: request.id, labResultIds: ['result-1'], completeness: 'COMPLETE', conformity: 'CONFORMING', conclusion: 'Kết quả phù hợp', status: 'FINAL', reviewerUsername: 'reviewer', reviewedAt: '2026-09-01T14:00:00.000Z', createdAt: '2026-09-01T14:00:00.000Z', updatedAt: '2026-09-01T14:00:00.000Z' };
const dossierText = { assetId: 'asset-dossier', fileName: 'PYC.docx', text: 'Người yêu cầu: Nguyen Van A. Khách hàng: Công ty thép A. Thép cuộn SS400, lô LOT-01, TCVN 1651. Biên bản hiện trường và kết quả PTN đính kèm.', tab: 'documents' as const };

test('PGD assistant evaluates eleven independent criteria with provenance', () => {
  const review = buildPgdAssistantReview({ request, assignments: [assignment], fieldInspections: [inspection], samples: [sample], labRequests: [labRequest], labResults: [labResult], reports: [report], certificates: [certificate], approvals, inspectionPlans: [inspectionPlan], caseEvents: [caseEvent], fieldActivityLogs: [fieldActivityLog], labResultReviews: [labResultReview], documentTexts: [dossierText] });
  assert.deepEqual(review.criteria.map((item) => item.id), ['REQUEST_IDENTITY', 'CUSTOMER_CONTACT', 'PRODUCT_PROFILE', 'SCOPE_AND_STANDARDS', 'DOSSIER_DOCUMENTS', 'ASSIGNMENT_CAPABILITY', 'INSPECTION_PLAN', 'FIELD_EVIDENCE', 'SAMPLING_CHAIN', 'LAB_RESULTS_REVIEW', 'REPORT_APPROVAL_RETURN']);
  assert.equal(review.criteria.length, 11);
  assert.ok(review.criteria.every((item) => item.source === 'RULES' && item.provenance.length > 0));
  assert.equal(review.criteria.every((item) => item.status === 'PASS'), true);
});

test('PGD assistant marks unavailable evidence as NOT_EVALUABLE and never mutates input', () => {
  const before = JSON.stringify(request);
  const review = buildPgdAssistantReview({ request: { ...request, status: 'FIELD_INSPECTION', sampleIds: [], labRequestIds: [] }, assignments: [], fieldInspections: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [] });
  assert.equal(review.criteria.find((item) => item.id === 'FIELD_EVIDENCE')?.status, 'NOT_EVALUABLE');
  assert.equal(review.criteria.find((item) => item.id === 'LAB_RESULTS_REVIEW')?.status, 'NOT_EVALUABLE');
  assert.equal(JSON.stringify(request), before);
});

test('PGD assistant keeps a readable review while marking an unreadable file for manual checking', () => {
  const review = buildPgdAssistantReview({
    request,
    assignments: [assignment],
    fieldInspections: [inspection],
    samples: [sample],
    labRequests: [labRequest],
    labResults: [labResult],
    reports: [report],
    certificates: [certificate],
    approvals,
    unreadableFiles: [{
      assetId: 'asset-legacy',
      fileName: 'Bien ban cu.doc',
      reason: 'Định dạng Word cũ cần đối chiếu thủ công.',
      criterionId: 'FIELD_EVIDENCE',
      tab: 'documents',
    }],
  } as any);
  const field = review.criteria.find((item) => item.id === 'FIELD_EVIDENCE');
  assert.equal(field?.status, 'NOT_EVALUABLE');
  assert.match(field?.findings[0]?.message || '', /Bien ban cu\.doc/);
  assert.equal(field?.findings[0]?.evidence?.[0]?.assetId, 'asset-legacy');
  assert.equal(review.readOnly, true);
});

test('PGD assistant does not pass the report station without the approval chain', () => {
  const review = buildPgdAssistantReview({ request, assignments: [assignment], fieldInspections: [inspection], samples: [sample], labRequests: [labRequest], labResults: [labResult], reports: [report], certificates: [certificate], approvals: [] });
  const reportCriterion = review.criteria.find((item) => item.id === 'REPORT_APPROVAL_RETURN');
  assert.equal(reportCriterion?.status, 'WARNING');
  assert.match(reportCriterion?.findings.map((finding) => finding.message).join(' '), /phê duyệt/i);
});

test('PGD assistant candidates exclude terminal and cancelled requests', () => {
  const items = getPgdAssistantCandidates([{ ...request, status: 'RESULTS_REVIEW' }, { ...request, id: 'signed', status: 'SIGNED' }, { ...request, id: 'cancelled', status: 'CANCELLED' }]);
  assert.deepEqual(items.map((item) => item.requestId), ['request-1']);
  assert.equal(items[0]?.requestCode, 'PGD-260905-01');
});
