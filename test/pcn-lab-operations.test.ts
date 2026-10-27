import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import type { CertificationDossier, CertificationProposal, OutboundLabRequest, PcnSampleLabCode, PcnSampleLot, PcnSampleRoute, ReturnedTestResult } from '../types.ts';
import { buildPcnSampleFlowProjections, filterPcnSampleFlowProjections } from '../utils/pcnLabOperations.ts';
import PcnLabOperationsView from '../components/PcnLabOperationsView.tsx';

const dossier: CertificationDossier = {
  id: 'd-1', dossierCode: 'PCN-001', proposalId: 'p-1', customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' },
  fieldCodes: ['QC4'], method: 'METHOD_1', status: 'AWAITING_RESULTS', labRequestIds: ['pyc-1'], returnedResultIds: [],
};
const proposal = {
  id: 'p-1', proposalCode: 'DN-001', channel: 'DIRECT', status: 'CONVERTED', dossierId: 'd-1',
  customerSnapshot: { name: 'Công ty A' }, productName: 'Thiết bị A', model: 'M1', brand: 'B', productType: 'Điện', specifications: '220V', manufacturer: 'NSX', quantity: 1, fieldCodes: ['QC4'], receivedAt: '2026-08-01',
} as unknown as CertificationProposal;
const lot: PcnSampleLot = {
  id: 'lot-1', dossierId: 'd-1', lotCode: 'LO-01', sampleName: 'Mẫu A', quantity: 2, unit: 'bộ', fieldCodes: ['QC4'], routeIds: ['r-1', 'r-2'], status: 'AT_LAB', currentLocation: 'Phòng thử EMC',
};
const routes: PcnSampleRoute[] = [
  { id: 'r-2', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'RECEIVED', sequence: 2, execution: { status: 'IN_PROGRESS', sourceSystemCode: 'EMC', scheduledDate: '2026-09-03', startedAt: '2026-09-03T08:00:00.000Z' } },
  { id: 'r-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RESULT_RETURNED', sequence: 1, labRequestId: 'pyc-1', execution: { status: 'COMPLETED', outcome: 'PASS', sourceSystemCode: 'PERFORMANCE', completedAt: '2026-09-02T08:00:00.000Z' } },
];
const request: OutboundLabRequest = {
  id: 'pyc-1', pycNumber: 'PYC-001', dossierId: 'd-1', fieldCode: 'QC4', laboratoryName: 'Hiệu suất', sampleLotId: 'lot-1', sampleRouteId: 'r-1', status: 'RESULT_RETURNED', requestedAt: '2026-09-01',
};
const result: ReturnedTestResult = {
  id: 'result-1', dossierId: 'd-1', labRequestId: 'pyc-1', round: 1, outcome: 'PASS', receivedAt: '2026-09-02', reportNumber: 'KQ-001',
};
const operationsSource = fs.readFileSync(new URL('../components/PcnLabOperationsView.tsx', import.meta.url), 'utf8');

test('groups every room route under one sample and exposes PYC/execution/result per route', () => {
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleRoutes: routes,
    labRequests: [request], returnedResults: [result],
  });
  assert.equal(projections.length, 1);
  assert.deepEqual(projections[0].routes.map((route) => route.sequence), [1, 2]);
  assert.equal(projections[0].routes[0].hasLabRequest, true);
  assert.equal(projections[0].routes[0].resultReportNumber, 'KQ-001');
  assert.equal(projections[0].routes[0].executionOutcome, 'PASS');
  assert.equal(projections[0].routes[1].executionStatus, 'IN_PROGRESS');
  assert.equal(projections[0].routes[1].executionScheduledDate, '2026-09-03');
  assert.equal(projections[0].currentLocation, 'Phòng thử EMC');
});

test('does not attach a same-dossier PYC to the wrong sample route', () => {
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleRoutes: [routes[1]],
    labRequests: [{ ...request, sampleRouteId: 'other-route' }], returnedResults: [],
  });
  assert.equal(projections[0].routes[0].hasLabRequest, false);
  assert.equal(projections[0].unlinkedPyc[0].pycNumber, 'PYC-001');
});

test('keeps two sample lots as independent parallel projections', () => {
  const secondLot = { ...lot, id: 'lot-2', lotCode: 'LO-02', routeIds: ['r-3'], currentLocation: 'Kho PCN' };
  const secondRoute: PcnSampleRoute = { id: 'r-3', sampleLotId: 'lot-2', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 1 };
  const projections = buildPcnSampleFlowProjections({ dossiers: [dossier], proposals: [proposal], sampleLots: [lot, secondLot], sampleRoutes: routes.concat(secondRoute), labRequests: [request], returnedResults: [result] });
  assert.equal(projections.length, 2);
  assert.equal(projections.find((item) => item.lotId === 'lot-2')?.routes[0].readiness, 'READY');
});

test('searches sample identity, current location, route room and external PYC code', () => {
  const projections = buildPcnSampleFlowProjections({ dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleRoutes: routes, labRequests: [request], returnedResults: [result] });
  assert.equal(filterPcnSampleFlowProjections(projections, 'LO-01').length, 1);
  assert.equal(filterPcnSampleFlowProjections(projections, 'EMC').length, 1);
  assert.equal(filterPcnSampleFlowProjections(projections, 'PYC-001').length, 1);
});

test('renders one primary projection per sample model and scopes routes to that item', () => {
  const itemA = { id: 'item-a', sampleLotId: 'lot-1', sampleCode: 'M-01', sampleType: 'Bếp điện', model: 'ABC-1', quantity: 2, unit: 'cái' };
  const itemB = { id: 'item-b', sampleLotId: 'lot-1', sampleCode: 'M-02', sampleType: 'Quạt điện', model: 'XYZ-2', quantity: 3, unit: 'cái' };
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleItems: [itemA, itemB],
    sampleRoutes: [
      { ...routes[1], sampleItemIds: ['item-a'] },
      { ...routes[0], sampleItemIds: ['item-b'] },
    ],
    labRequests: [request], returnedResults: [result],
  });

  assert.equal(projections.length, 2);
  assert.deepEqual(projections.map((projection) => projection.sampleItemId), ['item-a', 'item-b']);
  assert.equal(projections[0].model, 'ABC-1');
  assert.equal(projections[0].routes.length, 1);
  assert.equal(projections[0].routes[0].routeId, 'r-1');
  assert.equal(projections[1].routes[0].routeId, 'r-2');
});

test('keeps item-level parallel location snapshots independent inside one lot', () => {
  const itemA = { id: 'item-a', sampleLotId: 'lot-1', sampleCode: 'M-01', sampleType: 'Bếp điện', model: 'ABC-1', quantity: 1 };
  const itemB = { id: 'item-b', sampleLotId: 'lot-1', sampleCode: 'M-02', sampleType: 'Quạt điện', model: 'XYZ-2', quantity: 1 };
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleItems: [itemA, itemB],
    sampleRoutes: [{
      ...routes[0],
      status: 'SENT',
      sampleItemIds: ['item-a', 'item-b'],
      itemSnapshots: {
        'item-b': {
          status: 'RECEIVED',
          execution: { status: 'SCHEDULED', scheduledDate: '2026-09-04', sourceSystemCode: 'EMC' },
        },
      },
    }, {
      ...routes[1], status: 'PENDING', sequence: 2, sampleItemIds: ['item-a', 'item-b'],
    }],
    labRequests: [], returnedResults: [],
  });

  assert.equal(projections.length, 2);
  assert.equal(projections.find((item) => item.sampleItemId === 'item-a')?.currentLocation, 'Đang luân chuyển tới Phòng thử EMC');
  assert.equal(projections.find((item) => item.sampleItemId === 'item-b')?.currentLocation, 'Phòng thử EMC');
  assert.equal(projections.find((item) => item.sampleItemId === 'item-b')?.routes.find((route) => route.routeId === 'r-2')?.executionScheduledDate, '2026-09-04');
});

test('projects only routes assigned to the current sample model', () => {
  const itemA = { id: 'item-a', sampleLotId: 'lot-1', sampleCode: 'EMC-01', sampleType: 'Bếp điện', model: 'EMC-1', quantity: 1, testLabCodes: ['EMC'] as PcnSampleLabCode[] };
  const itemB = { id: 'item-b', sampleLotId: 'lot-1', sampleCode: 'ITD-01', sampleType: 'Quạt điện', model: 'ITD-1', quantity: 1, testLabCodes: ['PERFORMANCE'] as PcnSampleLabCode[] };
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleItems: [itemA, itemB],
    sampleRoutes: [
      { id: 'route-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 1, sampleItemIds: ['item-a'] },
      { id: 'route-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'PENDING', sequence: 1, sampleItemIds: ['item-b'] },
      { id: 'route-safety', sampleLotId: 'lot-1', labCode: 'ELECTRICAL_SAFETY', labName: 'An toàn điện', status: 'PENDING', sequence: 2, sampleItemIds: ['item-a', 'item-b'] },
    ],
    labRequests: [], returnedResults: [],
  });

  assert.deepEqual(projections.find((item) => item.sampleItemId === 'item-a')?.routes.map((route) => route.labCode), ['EMC']);
  assert.deepEqual(projections.find((item) => item.sampleItemId === 'item-b')?.routes.map((route) => route.labCode), ['PERFORMANCE']);
});

test('projects serial readiness for one sample and parallel readiness for multiple samples of the same model', () => {
  const itemSingle = { id: 'item-single', sampleLotId: 'lot-1', sampleCode: 'ITD-01', sampleType: 'Bếp điện', model: 'ITD-1', quantity: 1, testLabCodes: ['EMC', 'PERFORMANCE'] as PcnSampleLabCode[] };
  const itemMany = { id: 'item-many', sampleLotId: 'lot-1', sampleCode: 'ITD-02', sampleType: 'Bếp điện', model: 'ITD-2', quantity: 2, testLabCodes: ['EMC', 'PERFORMANCE'] as PcnSampleLabCode[] };
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleItems: [itemSingle, itemMany],
    sampleRoutes: [
      { id: 'single-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 1, sampleItemIds: ['item-single'] },
      { id: 'single-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'PENDING', sequence: 2, sampleItemIds: ['item-single'] },
      { id: 'many-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 1, sampleItemIds: ['item-many'] },
      { id: 'many-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'PENDING', sequence: 2, sampleItemIds: ['item-many'] },
    ],
    labRequests: [], returnedResults: [],
  });

  assert.deepEqual(projections.find((item) => item.sampleItemId === 'item-single')?.routes.map((route) => route.readiness), ['READY', 'BLOCKED']);
  assert.deepEqual(projections.find((item) => item.sampleItemId === 'item-many')?.routes.map((route) => route.readiness), ['READY', 'READY']);
});

test('does not project PYC records outside the internal sample-lot and route scope', () => {
  const externalRequest: OutboundLabRequest = {
    id: 'external-pyc', pycNumber: 'PYC-OUTSIDE-01', dossierId: 'd-1', fieldCode: 'QC4',
    laboratoryName: 'Đơn vị thử nghiệm bên ngoài', status: 'SENT', requestedAt: '2026-09-01',
  };
  const projections = buildPcnSampleFlowProjections({
    dossiers: [dossier], proposals: [proposal], sampleLots: [lot], sampleRoutes: routes,
    labRequests: [request, externalRequest], returnedResults: [result],
  });

  assert.equal(projections.length, 1);
  assert.equal(projections[0].unlinkedPyc.some((pyc) => pyc.pycNumber === 'PYC-OUTSIDE-01'), false);
  assert.equal(filterPcnSampleFlowProjections(projections, 'PYC-OUTSIDE-01').length, 0);
});

test('sample register uses one row per sample and renders remote execution facts', () => {
  assert.match(operationsSource, /buildSampleRegisterRows/);
  assert.match(operationsSource, /Sổ quản lý mẫu/);
  assert.match(operationsSource, /Tạo Phiếu yêu cầu thử nghiệm/);
  assert.match(operationsSource, /sample-register-grid/);
  assert.match(operationsSource, /overflow-x-auto/);
  assert.match(operationsSource, /currentLocation/);
  assert.match(operationsSource, /syncStatus/);
  assert.match(operationsSource, /sampleCode/);
  assert.match(operationsSource, /sampleType/);
  assert.match(operationsSource, /onRetryBundleDispatch/);
  assert.match(operationsSource, /PcnSampleRequestBundleModal/);
  assert.match(operationsSource, /bg-sky-100/);
  assert.match(operationsSource, /bg-violet-100/);
  assert.match(operationsSource, /bg-amber-100/);
  assert.match(operationsSource, /bg-emerald-100/);
  assert.doesNotMatch(operationsSource, /fetch\(/);
});

test('sample register exposes searchable lab filters and a separate bundle modal', () => {
  assert.match(operationsSource, /sampleRequestBundles/);
  assert.match(operationsSource, /aria-label="Tìm trong Sổ quản lý mẫu"/);
  assert.match(operationsSource, /aria-label="Lọc theo phòng thử nghiệm"/);
  assert.match(operationsSource, /onSaveBundle/);
  assert.match(operationsSource, /onSendBundle/);
});

test('renders compact PTN statuses and keeps full request codes keyboard-readable', () => {
  const pycNumber = 'PYC-2026-0123456789-ABCDEF';
  const externalRequestCode = 'LAB-REQ-PTN-2026-ABCDEFGHIJKLMN';
  const markup = renderToStaticMarkup(createElement(PcnLabOperationsView, {
    dossiers: [dossier],
    proposals: [proposal],
    sampleLots: [lot],
    sampleItems: [{ id: 'item-1', sampleLotId: lot.id, sampleCode: 'M-01', sampleType: 'Thiết bị', model: 'M1', quantity: 1 }],
    sampleRoutes: [
      { id: 'route-performance', sampleLotId: lot.id, labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RESULT_RETURNED', sequence: 1, sampleItemIds: ['item-1'] },
      { id: 'route-emc', sampleLotId: lot.id, labCode: 'EMC', labName: 'Phòng thử EMC', status: 'RECEIVED', sequence: 2, sampleItemIds: ['item-1'] },
    ],
    labRequests: [{ ...request, pycNumber, sampleRouteId: 'route-performance', integration: { targetSystemCode: 'LAB', syncStatus: 'ACKNOWLEDGED', externalRequestCode } }],
    sampleRequestBundles: [],
    returnedResults: [],
    canEdit: false,
    onSaveBundle: async () => { throw new Error('not called'); },
    onSendBundle: async () => { throw new Error('not called'); },
    onRetryBundleDispatch: async () => { throw new Error('not called'); },
    onOpenDossier: () => { throw new Error('not called'); },
  } as never));

  assert.match(markup, /Trả KQ/);
  assert.match(markup, /Đã nhận/);
  assert.match(markup, /aria-label="Trạng thái PTN: Đã trả KQ"/);
  assert.match(markup, /aria-label="Trạng thái PTN: PTN đã nhận"/);
  assert.match(markup, /<svg[^>]*aria-hidden="true"/);
  assert.match(markup, new RegExp(`title="${pycNumber}"[^>]*tabindex="0"`));
  assert.match(markup, new RegExp(`aria-label="Mã PYC: ${pycNumber}"`));
  assert.match(markup, new RegExp(`title="${externalRequestCode}"[^>]*tabindex="0"`));
  assert.match(markup, new RegExp(`aria-label="Mã phiếu PTN: ${externalRequestCode}"`));
  assert.match(markup, /max-w-\[10rem\][^\"]*break-all[^\"]*sm:truncate/);
  assert.match(markup, /max-w-\[7rem\][^\"]*break-all[^\"]*sm:truncate/);
  assert.match(markup, /focus-visible:ring-2/);
  assert.match(markup, /sm:truncate/);
});

// --- End of pcn-lab-operations.test.ts ---
