import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildPgdDossierIndex,
  createPgdCaseEvent,
  createPgdFieldActivityLog,
  createPgdInspectionPlan,
  createPgdLabResultReview,
} from '../utils/pgdArtifacts.ts';

test('creates a steel inspection plan with a time-boxed agenda and product lines', () => {
  const plan = createPgdInspectionPlan({
    id: 'plan-1',
    requestId: 'req-1',
    inspectionDate: '2026-09-03',
    team: [{ username: 'nam', role: 'LEAD' }],
    productLines: [{ productName: 'Thép thanh', grade: 'S35C', standard: 'JIS G4051:2009' }],
    schedule: [{ startTime: '08:30', endTime: '09:00', activity: 'Họp khai mạc' }],
    samplingLines: [{ sampleCode: 'M01', description: 'Mẫu đại diện gửi PTN', quantity: 1, unit: 'mẫu', destination: 'LAB' }],
  }, '2026-09-03T08:00:00.000Z');
  assert.equal(plan.domain, 'pgd');
  assert.equal(plan.schedule[0].activity, 'Họp khai mạc');
  assert.equal(plan.samplingLines?.[0].destination, 'LAB');
  assert.throws(() => createPgdInspectionPlan({ id: 'bad', requestId: 'req-1', inspectionDate: '2026-09-03', team: [], productLines: [], schedule: [] }));
});

test('normalizes case events and field notes without turning them into audit logs', () => {
  const event = createPgdCaseEvent({ id: 'event-1', requestId: 'req-1', occurredAt: '2026-09-03T08:30:00.000Z', activity: '  Kiểm tra hồ sơ  ', actorUsername: ' nam ', evidenceAssetIds: ['asset-1', 'asset-1'] });
  const note = createPgdFieldActivityLog({ id: 'note-1', requestId: 'req-1', session: 'MORNING', entries: [{ time: '10:00', activity: '  Đo kích thước ', comments: ' Đã chụp ảnh ' }] });
  assert.equal(event.domain, 'pgd');
  assert.equal(event.activity, 'Kiểm tra hồ sơ');
  assert.equal(event.actorUsername, 'nam');
  assert.deepEqual(event.evidenceAssetIds, ['asset-1']);
  assert.equal(note.entries[0].time, '10:00');
  assert.equal(note.entries[0].activity, 'Đo kích thước');
  assert.equal(note.entries[0].comments, 'Đã chụp ảnh');
});

test('blocks result review until every required laboratory result is present', () => {
  assert.throws(() => createPgdLabResultReview({ id: 'review-1', requestId: 'req-1', labResultIds: [], completeness: 'INCOMPLETE', conformity: 'NOT_REVIEWED', conclusion: '' }));
  const review = createPgdLabResultReview({ id: 'review-2', requestId: 'req-1', labResultIds: ['lab-result-1'], completeness: 'COMPLETE', conformity: 'CONFORMING', conclusion: 'Phù hợp' });
  assert.equal(review.domain, 'pgd');
});

test('builds a dossier index from current PGD documents only', () => {
  const index = buildPgdDossierIndex({ requestId: 'req-1', entries: [{ requirementCode: 'FIELD', title: 'Biên bản hiện trường', status: 'PRESENT', pageCount: 2 }] });
  assert.equal(index.domain, 'pgd');
  assert.equal(index.entries[0].pageCount, 2);
});
