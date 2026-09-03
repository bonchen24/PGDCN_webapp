import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdInspectionCertificate,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from '../utils/pgdDomain.ts';
import { buildPgdAssistantReview, getPgdAssistantCandidates } from '../utils/pgdAssistant.ts';

const request: PgdInspectionRequest = {
  id: 'request-1', domain: 'pgd', status: 'RESULTS_REVIEW', requestCode: 'PYC-GD-001',
  intakeChannel: 'DIRECT', requester: { name: 'Nguyen Van A' },
  customerSnapshot: { name: 'Công ty thép A', address: 'Hà Nội' },
  productGroup: 'STEEL_METAL', catalogItemId: 'steel-1', productName: 'Thép cuộn',
  quantity: 10, unit: 'tấn', inspectionScope: 'Kiểm tra số lượng và chất lượng',
  inspectionLocation: 'Kho A', standards: ['TCVN 1651'], documentPointers: [], sampleIds: ['sample-1'],
  labRequestIds: ['lab-1'], payment: { status: 'NOT_REQUIRED' }, createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T09:00:00.000Z',
};

const assignment: PgdInspectionAssignment = { id: 'assignment-1', domain: 'pgd', requestId: request.id, inspectorUsernames: ['inspector'], status: 'APPROVED' };
const inspection: PgdFieldInspection = { id: 'inspection-1', domain: 'pgd', requestId: request.id, performedAt: '2026-09-01T10:00:00.000Z', location: 'Kho A', inspectorUsernames: ['inspector'], sampleIds: ['sample-1'], completed: true };
const sample: PgdSample = { id: 'sample-1', domain: 'pgd', requestId: request.id, sampleCode: 'M-001', description: 'Mẫu thép', quantity: 1, disposition: 'LAB' };
const labRequest: PgdLabRequest = { id: 'lab-1', domain: 'pgd', requestId: request.id, sampleId: sample.id, status: 'RESULT_RECEIVED', laboratoryName: 'PTN A', testItems: ['C'], resultId: 'result-1' };
const labResult: PgdLabResult = { id: 'result-1', domain: 'pgd', requestId: request.id, labRequestId: labRequest.id, receivedAt: '2026-09-01T12:00:00.000Z', values: [{ key: 'C', label: 'Carbon', value: 0.2 }], acceptedAt: '2026-09-01T13:00:00.000Z' };
const report: PgdInspectionReport = { id: 'report-1', domain: 'pgd', requestId: request.id, title: 'Báo cáo giám định', standardSnapshot: ['TCVN 1651'], values: [], conclusion: 'Phù hợp', status: 'DRAFT', createdAt: '2026-09-01T14:00:00.000Z', updatedAt: '2026-09-01T14:00:00.000Z' };
const certificate: PgdInspectionCertificate = { id: 'certificate-1', domain: 'pgd', requestId: request.id, title: 'Chứng thư giám định', conclusion: 'Phù hợp', status: 'DRAFT', createdAt: '2026-09-01T14:00:00.000Z', updatedAt: '2026-09-01T14:00:00.000Z' };

test('PGD assistant evaluates five operational stations with provenance', () => {
  const review = buildPgdAssistantReview({ request, assignments: [assignment], fieldInspections: [inspection], samples: [sample], labRequests: [labRequest], labResults: [labResult], reports: [report], certificates: [certificate] });
  assert.deepEqual(review.criteria.map((item) => item.id), ['INTAKE_CAPABILITY', 'PREPARATION', 'FIELD_SAMPLING', 'LAB_RESULTS', 'REPORT_APPROVAL_RETURN']);
  assert.ok(review.criteria.every((item) => item.source === 'RULES' && item.provenance.length > 0));
  assert.equal(review.criteria.every((item) => item.status === 'PASS'), true);
});

test('PGD assistant marks unavailable evidence as NOT_EVALUABLE and never mutates input', () => {
  const before = JSON.stringify(request);
  const review = buildPgdAssistantReview({ request: { ...request, status: 'FIELD_INSPECTION', sampleIds: [], labRequestIds: [] }, assignments: [], fieldInspections: [], samples: [], labRequests: [], labResults: [], reports: [], certificates: [] });
  assert.equal(review.criteria.find((item) => item.id === 'FIELD_SAMPLING')?.status, 'NOT_EVALUABLE');
  assert.equal(review.criteria.find((item) => item.id === 'LAB_RESULTS')?.status, 'NOT_EVALUABLE');
  assert.equal(JSON.stringify(request), before);
});

test('PGD assistant candidates exclude terminal and cancelled requests', () => {
  const items = getPgdAssistantCandidates([{ ...request, status: 'RESULTS_REVIEW' }, { ...request, id: 'signed', status: 'SIGNED' }, { ...request, id: 'cancelled', status: 'CANCELLED' }]);
  assert.deepEqual(items.map((item) => item.requestId), ['request-1']);
  assert.equal(items[0]?.requestCode, 'PYC-GD-001');
});
