import assert from 'node:assert/strict';
import test from 'node:test';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
} from '../types.ts';
import {
  buildPcnLabDispatchPayload,
  buildPcnLabIntegrationFingerprint,
  getPcnLabIntegrationEventId,
  mapPcnLabStatusEvent,
} from '../utils/pcnLabIntegration.ts';

const requestFixture = (): OutboundLabRequest => ({
  id: 'pyc-1',
  pycNumber: 'PYC-001',
  dossierId: 'd-1',
  fieldCode: 'QC4',
  laboratoryName: 'Hiệu suất',
  sampleLotId: 'lot-1',
  sampleRouteId: 'r-1',
  status: 'DRAFT',
  requestedAt: '2026-08-31T03:00:00.000Z',
  targetDate: '2026-09-03',
  criteria: 'TCVN 5699-2-9',
});

const lotFixture = (): PcnSampleLot => ({
  id: 'lot-1',
  dossierId: 'd-1',
  lotCode: 'LO-01',
  sampleName: 'Bếp điện',
  model: 'M-01',
  brand: 'Brand A',
  quantity: 2,
  unit: 'mẫu',
  fieldCodes: ['QC4'],
  routeIds: ['r-1'],
  status: 'PREPARED',
  currentLocation: 'Kho PCN',
});

const sampleItemsFixture = (): PcnSampleItem[] => [
  { id: 'item-1', sampleLotId: 'lot-1', sampleCode: 'M-01', sampleType: 'Bếp điện', model: 'M-01', brand: 'Brand A', quantity: 2, unit: 'mẫu' },
  { id: 'item-2', sampleLotId: 'lot-1', sampleCode: 'M-02', sampleType: 'Quạt điện', model: 'M-02', brand: 'Brand A', quantity: 1, unit: 'mẫu' },
];

const routeFixture = (): PcnSampleRoute => ({
  id: 'r-1',
  sampleLotId: 'lot-1',
  labCode: 'PERFORMANCE',
  labName: 'Phòng thử Hiệu suất',
  status: 'PENDING',
  sequence: 1,
});

const dossierFixture = (): CertificationDossier => ({
  id: 'd-1',
  dossierCode: 'PCN-001',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_1',
  status: 'SENT_TO_LAB',
  labRequestIds: ['pyc-1'],
  returnedResultIds: [],
});

const proposalFixture = (): CertificationProposal => ({
  id: 'proposal-1',
  proposalCode: 'DN-001',
  customerId: 'customer-1',
  fieldCodes: ['QC4'],
  status: 'ACCEPTED',
  createdAt: '2026-08-30T03:00:00.000Z',
  updatedAt: '2026-08-30T03:00:00.000Z',
} as unknown as CertificationProposal);

test('dispatch payload contains PCN route identity and no credential/file fields', () => {
  const payload = buildPcnLabDispatchPayload({
    request: requestFixture(),
    lot: lotFixture(),
    sampleItems: sampleItemsFixture(),
    route: routeFixture(),
    dossier: dossierFixture(),
    proposal: proposalFixture(),
    targetSystemCode: 'PERFORMANCE',
    messageId: 'msg-1',
    idempotencyKey: 'PCN:r-1:pyc-1:v1',
  });

  assert.equal(payload.request.pcnRouteId, 'r-1');
  assert.equal(payload.samples.length, 2);
  assert.equal(payload.samples[0].pcnSampleItemId, 'item-1');
  assert.equal(payload.samples[1].quantity, 1);
  assert.equal(payload.route.sequence, 1);
  assert.equal('secret' in payload, false);
  assert.equal('fileBytes' in payload.samples[0], false);
});

test('dispatch payload scopes samples to the route when a lot is split across routes', () => {
  const payload = buildPcnLabDispatchPayload({
    request: requestFixture(),
    lot: lotFixture(),
    sampleItems: sampleItemsFixture(),
    route: { ...routeFixture(), sampleItemIds: ['item-2'] },
    dossier: dossierFixture(),
    targetSystemCode: 'PERFORMANCE',
    messageId: 'msg-scoped',
    idempotencyKey: 'PCN:r-1:pyc-1:v1',
  });

  assert.deepEqual(payload.samples.map((sample) => sample.pcnSampleItemId), ['item-2']);
});

test('status event mapping carries schedule, execution milestones and outcome', () => {
  const mapped = mapPcnLabStatusEvent({
    sourceSystemCode: 'PERFORMANCE',
    externalEventId: 'evt-1',
    externalRequestId: 'ext-1',
    externalSequence: 3,
    pcnRouteId: 'r-1',
    pcnLabRequestId: 'pyc-1',
    eventType: 'RESULT_UPDATED',
    scheduledDate: '2026-09-03',
    completedAt: '2026-09-03T08:00:00.000Z',
    outcome: 'FAIL',
    externalReportNumber: 'HS-FAIL-001',
    occurredAt: '2026-09-03T08:01:00.000Z',
  });

  assert.equal(mapped.routeStatus, 'RESULT_RETURNED');
  assert.equal(mapped.execution.status, 'COMPLETED');
  assert.equal(mapped.execution.outcome, 'FAIL');
  assert.equal(mapped.execution.scheduledDate, '2026-09-03');
  assert.equal(mapped.execution.completedAt, '2026-09-03T08:00:00.000Z');
  assert.equal(mapped.execution.externalReportNumber, 'HS-FAIL-001');
});

test('event mapping keeps TEST_COMPLETED distinct from a formal returned result', () => {
  const mapped = mapPcnLabStatusEvent({
    sourceSystemCode: 'EMC',
    externalEventId: 'evt-2',
    externalRequestId: 'ext-2',
    externalSequence: 4,
    pcnRouteId: 'r-2',
    eventType: 'TEST_COMPLETED',
    completedAt: '2026-09-03T08:00:00.000Z',
    occurredAt: '2026-09-03T08:01:00.000Z',
  });

  assert.equal(mapped.routeStatus, undefined);
  assert.equal(mapped.execution.status, 'COMPLETED');
  assert.equal(mapped.execution.outcome, undefined);
  assert.equal(mapped.internalEventType, 'UPDATED');
});

test('duplicate and stale event keys are stable and distinguishable', async () => {
  assert.equal(getPcnLabIntegrationEventId('PERFORMANCE', 'evt-1'), getPcnLabIntegrationEventId('PERFORMANCE', 'evt-1'));
  assert.notEqual(getPcnLabIntegrationEventId('PERFORMANCE', 'evt-1'), getPcnLabIntegrationEventId('EMC', 'evt-1'));

  const left = await buildPcnLabIntegrationFingerprint({ b: 2, a: 1 });
  const right = await buildPcnLabIntegrationFingerprint({ a: 1, b: 2 });
  assert.equal(left, right);
  assert.match(left, /^[a-f0-9]{64}$/);
});

// --- End of pcn-lab-integration.test.ts ---
