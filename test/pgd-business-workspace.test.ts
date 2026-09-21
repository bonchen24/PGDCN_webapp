import test from 'node:test';
import assert from 'node:assert/strict';

import type { PgdFieldInspection, PgdInspectionRequest, PgdLabRequest, PgdLabResult, PgdSample } from '../utils/pgdDomain.ts';
import type { PgdBusinessFacts } from '../utils/pgdBusinessWorkspace.ts';
import { buildPgdBusinessBlockers, buildPgdBusinessTimeline, buildPgdSampleEvidence, resolvePgdEvidenceNextAction } from '../utils/pgdBusinessWorkspace.ts';
import { normalizePgdFieldSession } from '../utils/pgdWorkflow.ts';

const request = {
  id: 'request-1',
  domain: 'pgd',
  requestCode: 'PGD-001',
  status: 'WAITING_LAB_RESULTS',
  intakeChannel: 'EMAIL',
  requester: { name: 'Requester' },
  customerSnapshot: { name: 'Customer' },
  productGroup: 'STEEL_METAL',
  catalogItemId: 'catalog-1',
  productName: 'Steel coil',
  quantity: 100,
  unit: 'tấn',
  inspectionScope: 'Lấy mẫu và thử nghiệm',
  inspectionLocation: 'Kho A',
  standards: ['TCVN'],
  documentPointers: [],
  sampleIds: ['sample-1', 'sample-2'],
  labRequestIds: ['lab-1', 'lab-2'],
  createdAt: '2026-09-20T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
} as unknown as PgdInspectionRequest;

const sample = (id: string, code: string, quantity: number, sampledAt = '2026-09-21T08:00:00.000Z'): PgdSample => ({
  id,
  domain: 'pgd',
  requestId: request.id,
  sampleCode: code,
  description: code + ' sample',
  quantity,
  unit: 'mẫu',
  disposition: 'LAB',
  sampledAt,
  samplingLocation: 'Kho A',
  sampledByUsername: 'inspector',
});

const labRequest = (id: string, sampleId: string, status: PgdLabRequest['status'] = 'SENT'): PgdLabRequest => ({
  id,
  domain: 'pgd',
  requestId: request.id,
  sampleId,
  status,
  laboratoryName: 'PTN TVCI',
  testItems: ['Thành phần hóa'],
  handover: { sentAt: '2026-09-21T10:00:00.000Z', quantity: 1 },
});

const labResult = (id: string, labRequestId: string): PgdLabResult => ({
  id,
  domain: 'pgd',
  requestId: request.id,
  labRequestId,
  receivedAt: '2026-09-21T12:00:00.000Z',
  values: [{ key: 'fe', label: 'Fe', value: 98, unit: '%' }],
});

const plan = (quantities: number[]) => ({
  id: 'plan-1',
  domain: 'pgd' as const,
  requestId: request.id,
  inspectionDate: '2026-09-21',
  team: [],
  productLines: [],
  schedule: [],
  samplingLines: quantities.map((quantity, index) => ({ sampleCode: 'M0' + (index + 1), description: 'Sampling line', quantity, destination: 'LAB' as const })),
  status: 'CONFIRMED' as const,
  createdAt: '2026-09-20T08:00:00.000Z',
  updatedAt: '2026-09-21T08:00:00.000Z',
});

function facts(overrides: Partial<PgdBusinessFacts> = {}): PgdBusinessFacts {
  return {
    request,
    inspectionPlans: [plan([9])],
    assignments: [{ requestId: request.id, status: 'APPROVED', inspectorUsernames: ['inspector'] }],
    fieldInspections: [],
    caseEvents: [],
    fieldActivityLogs: [],
    samples: [],
    labRequests: [],
    labResults: [],
    approvals: [],
    ...overrides,
  };
}

test('normalizes legacy field inspection into a completed field session', () => {
  const legacy = { id: 'field-legacy', domain: 'pgd', requestId: request.id, performedAt: '2026-09-20T08:30:00.000Z', location: 'Kho A', inspectorUsernames: ['inspector'], sampleIds: [], completed: true } as unknown as PgdFieldInspection;
  const normalized = normalizePgdFieldSession(legacy);
  assert.equal(normalized.startedAt, legacy.performedAt);
  assert.equal(normalized.status, 'COMPLETED');
  assert.equal(normalized.completed, true);
});

test('aggregates expected units, samples and linked lab results without zero fallback', () => {
  const summary = buildPgdSampleEvidence(facts({
    inspectionPlans: [plan([5, 4])],
    samples: [sample('sample-1', 'M01', 4), sample('sample-2', 'M07', 4)],
    labRequests: [labRequest('lab-1', 'sample-1'), labRequest('lab-2', 'sample-2')],
    labResults: [labResult('result-1', 'lab-1')],
  }));
  assert.equal(summary.expectedUnits, 9);
  assert.equal(summary.sampledUnits, 8);
  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.labRequestCount, 2);
  assert.equal(summary.resultCount, 1);
  assert.equal(summary.pendingLabRequestCount, 1);
  assert.equal(summary.rows.find((row) => row.sampleCode === 'M07')?.state, 'Đang chờ KQTN');
  assert.equal(buildPgdSampleEvidence(facts({ inspectionPlans: [plan([])] })).expectedUnits, undefined);
});

test('merges, sorts and deduplicates business timeline events', () => {
  const session = { id: 'field-1', domain: 'pgd', requestId: request.id, performedAt: '2026-09-21T09:00:00.000Z', startedAt: '2026-09-21T09:00:00.000Z', location: 'Kho A', inspectorUsernames: ['inspector'], sampleIds: [], completed: true, status: 'COMPLETED' as const } as unknown as PgdFieldInspection;
  const event = { id: 'event-1', domain: 'pgd' as const, requestId: request.id, occurredAt: '2026-09-21T07:00:00.000Z', activity: 'Tiếp nhận hồ sơ', actorUsername: 'receiver', createdAt: '2026-09-21T07:00:00.000Z', updatedAt: '2026-09-21T07:00:00.000Z' };
  const timeline = buildPgdBusinessTimeline(facts({ fieldInspections: [session], caseEvents: [event, event] }));
  assert.equal(timeline.filter((item) => item.sourceId === 'event-1').length, 1);
  assert.equal(timeline[0]?.kind, 'FIELD_SESSION');
  assert.equal(timeline.at(-1)?.kind, 'CASE_EVENT');
});

test('applies evidence-first next action precedence and status fallback', () => {
  const pending = resolvePgdEvidenceNextAction(facts({
    inspectionPlans: [plan([5, 4])],
    samples: [sample('sample-1', 'M01', 4), sample('sample-2', 'M07', 4)],
    labRequests: [labRequest('lab-1', 'sample-1'), labRequest('lab-2', 'sample-2')],
    labResults: [labResult('result-1', 'lab-1')],
  }));
  assert.equal(pending.label, 'Tiếp nhận KQTN M07');
  assert.equal(pending.source, 'EVIDENCE');
  assert.equal(pending.target, 'LAB_RESULTS');

  const review = resolvePgdEvidenceNextAction(facts({
    inspectionPlans: [plan([2])],
    samples: [sample('sample-1', 'M01', 2)],
    labRequests: [labRequest('lab-1', 'sample-1', 'RESULT_RECEIVED')],
    labResults: [labResult('result-1', 'lab-1')],
  }));
  assert.equal(review.label, 'Đánh giá kết quả thử nghiệm');

  const sampleGap = resolvePgdEvidenceNextAction(facts({
    inspectionPlans: [plan([9])],
    samples: [sample('sample-1', 'M01', 4)],
  }));
  assert.equal(sampleGap.label, 'Tiếp tục lấy mẫu');

  const fallback = resolvePgdEvidenceNextAction(facts({ request: { ...request, status: 'DRAFT' } as PgdInspectionRequest, inspectionPlans: [], assignments: [], samples: [], labRequests: [], labResults: [] }));
  assert.equal(fallback.source, 'STATUS_FALLBACK');
  assert.equal(fallback.label, 'Bổ sung hồ sơ');
});

test('emits blocker targets from real evidence only', () => {
  const blockers = buildPgdBusinessBlockers(facts({
    missingRequiredCount: 1,
    samples: [sample('sample-1', 'M01', 1)],
    labRequests: [labRequest('lab-1', 'sample-1')],
  }));
  assert.deepEqual(blockers.map((blocker) => blocker.target), ['DOCUMENTS', 'LAB_RESULTS']);
  assert.ok(blockers.every((blocker) => blocker.reason.length > 0 && blocker.source.length > 0));
});