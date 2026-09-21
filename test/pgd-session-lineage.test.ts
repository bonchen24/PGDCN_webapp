import test from 'node:test';
import assert from 'node:assert/strict';

import type { PgdFieldInspection, PgdInspectionRequest, PgdSample } from '../utils/pgdDomain.ts';
import { buildPgdSampleEvidence } from '../utils/pgdBusinessWorkspace.ts';
import { combinePgdLocalDateTime, normalizePgdFieldSession, toPgdLocalDateTimeFields } from '../utils/pgdWorkflow.ts';

const request = {
  id: 'pgd-request-session',
  domain: 'pgd',
  requestCode: 'PGD-SESSION-01',
  status: 'FIELD_INSPECTION',
  inspectionLocation: 'Kho thực tế',
  productName: 'Hàng hóa',
  quantity: 100,
  unit: 'tấn',
  sampleIds: [],
  labRequestIds: [],
} as unknown as PgdInspectionRequest;

const sample = (id: string, quantity: number): PgdSample => ({
  id,
  domain: 'pgd',
  requestId: request.id,
  sampleCode: id.toUpperCase(),
  description: 'Mẫu ' + id,
  quantity,
  unit: 'mẫu',
  disposition: 'LAB',
  sampledAt: '2026-09-20T03:00:00.000Z',
});

test('field session normalizes legacy timestamp/status and keeps sampleIds', () => {
  const legacy = { id: 'session-legacy', domain: 'pgd', requestId: request.id, performedAt: '2026-09-20T03:00:00.000Z', location: 'Kho thực tế', inspectorUsernames: ['ktv'], sampleIds: ['sample-1'], completed: false } as unknown as PgdFieldInspection;
  const normalized = normalizePgdFieldSession(legacy);
  assert.equal(normalized.startedAt, legacy.performedAt);
  assert.equal(normalized.status, 'DRAFT');
  assert.deepEqual(normalized.sampleIds, ['sample-1']);
});

test('sample evidence resolves session lineage and separates count from quantity', () => {
  const session = { id: 'session-1', domain: 'pgd', requestId: request.id, performedAt: '2026-09-20T03:00:00.000Z', startedAt: '2026-09-20T03:00:00.000Z', sessionCode: 'PGD-01', location: 'Kho thực tế', inspectorUsernames: ['ktv'], sampleIds: ['sample-1'], completed: true, status: 'COMPLETED' as const } as unknown as PgdFieldInspection;
  const summary = buildPgdSampleEvidence({
    request,
    fieldInspections: [session],
    inspectionPlans: [{ id: 'plan-1', domain: 'pgd', requestId: request.id, inspectionDate: '2026-09-20', team: [], productLines: [], schedule: [], samplingLines: [{ sampleCode: 'M01', description: 'Mẫu', quantity: 2, destination: 'LAB' }], status: 'CONFIRMED', createdAt: '2026-09-19T08:00:00.000Z', updatedAt: '2026-09-19' }],
    samples: [sample('sample-1', 4), sample('sample-2', 2)],
    labRequests: [],
    labResults: [],
  });
  assert.equal(summary.expectedSampleCount, 2);
  assert.equal(summary.actualSampleCount, 2);
  assert.equal(summary.actualSampleQuantity, 6);
  assert.equal(summary.rows.find((row) => row.id === 'sample-1')?.sessionCode, 'PGD-01');
  assert.equal(summary.rows.find((row) => row.id === 'sample-2')?.sessionCode, undefined);
});

test('datetime helpers preserve an entered past local session time', () => {
  const iso = combinePgdLocalDateTime('2026-09-18', '08:15');
  assert.ok(iso);
  const fields = toPgdLocalDateTimeFields(iso);
  assert.equal(fields.date, '2026-09-18');
  assert.equal(fields.time, '08:15');
});