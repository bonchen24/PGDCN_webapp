import test from 'node:test';
import assert from 'node:assert/strict';

import type { CertificationDossier, OutboundLabRequest, PcnSampleItem, PcnSampleLot, PcnSampleRoute, ReturnedTestResult } from '../types.ts';
import { buildPcnBusinessBlockers, buildPcnSampleEvidence, getPcnBusinessSectionForRequirement, resolvePcnEvidenceNextAction } from '../utils/pcnBusinessWorkspace.ts';

const dossier = {
  id: 'dossier-1',
  dossierCode: 'PCN-001',
  proposalId: 'proposal-1',
  fieldCodes: ['QC4'],
  method: 'METHOD_7',
  status: 'AWAITING_RESULTS',
  ownerUsername: 'operator',
  labRequestIds: [],
  returnedResultIds: [],
} as unknown as CertificationDossier;

const lot: PcnSampleLot = {
  id: 'lot-1',
  dossierId: dossier.id,
  lotCode: 'L-01',
  sampleName: 'Thiết bị',
  quantity: 9,
  fieldCodes: ['QC4'],
  routeIds: [],
  status: 'AT_LAB',
  currentLocation: 'PTN',
};

const items: PcnSampleItem[] = Array.from({ length: 9 }, (_, index) => ({
  id: 'item-' + (index + 1),
  sampleLotId: lot.id,
  sampleCode: 'M' + String(index + 1).padStart(2, '0'),
  sampleType: 'Mẫu thiết bị',
  model: 'MODEL-' + (index + 1),
  quantity: 1,
  testLabCodes: ['PERFORMANCE'],
}));

const routes: PcnSampleRoute[] = items.map((item, index) => ({
  id: 'route-' + (index + 1),
  sampleLotId: lot.id,
  sampleItemIds: [item.id],
  labCode: 'PERFORMANCE',
  labName: 'PTN hiệu suất',
  status: 'RESULT_RETURNED',
  labRequestId: 'pyc-' + (index + 1),
}));

const labRequests: OutboundLabRequest[] = items.map((item, index) => ({
  id: 'pyc-' + (index + 1),
  pycNumber: 'PYC-' + String(index + 1).padStart(2, '0'),
  dossierId: dossier.id,
  fieldCode: 'QC4',
  laboratoryName: 'PTN hiệu suất',
  sampleLotId: lot.id,
  sampleRouteId: routes[index].id,
  sampleItemIds: [item.id],
  status: 'RESULT_RETURNED',
  requestedAt: '2026-09-01T08:00:00.000Z',
}));

const results: ReturnedTestResult[] = labRequests.filter((_, index) => index !== 6).map((request, index) => ({
  id: 'result-' + (index + 1),
  dossierId: dossier.id,
  labRequestId: request.id,
  round: 1,
  outcome: 'PASS',
  receivedAt: '2026-09-10T08:00:00.000Z',
}));

const facts = {
  dossier,
  requirements: [],
  documents: [],
  sampleLots: [lot],
  sampleItems: items,
  sampleRoutes: routes,
  labRequests,
  results,
  approvalSteps: [],
};

test('PCN sample evidence reports 9 sample items, 8 results and missing M07', () => {
  const summary = buildPcnSampleEvidence(facts);
  assert.equal(summary.expectedSampleCount, 9);
  assert.equal(summary.sampledSampleCount, 9);
  assert.equal(summary.resultCount, 8);
  assert.equal(summary.pendingResultCount, 1);
  assert.equal(summary.rows.find((row) => row.sampleCode === 'M07')?.state, 'Còn thiếu KQTN');
  assert.equal(resolvePcnEvidenceNextAction(facts).label, 'Tiếp nhận KQTN M07');
});

test('PCN resolves full results to review before report drafting', () => {
  const completeResults = [...results, {
    id: 'result-9',
    dossierId: dossier.id,
    labRequestId: 'pyc-7',
    round: 1,
    outcome: 'PASS' as const,
    receivedAt: '2026-09-10T08:00:00.000Z',
  }];
  const next = resolvePcnEvidenceNextAction({ ...facts, results: completeResults });
  assert.equal(next.label, 'Đánh giá kết quả thử nghiệm');
});

test('PCN requirement taxonomy uses semantic section before stage fallback', () => {
  assert.equal(getPcnBusinessSectionForRequirement({ code: 'SAMPLE_HANDOVER', name: 'Biên bản giao mẫu', stages: ['LAB_ROUTING'], stationKeys: ['SAMPLING_LAB'] }), 'LAB');
  const blockers = buildPcnBusinessBlockers(facts);
  assert.equal(blockers.length, 1);
  assert.equal(blockers[0]?.title, 'Thiếu KQTN M07');
});