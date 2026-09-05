import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnSampleLabCode, PcnSampleRoute } from '../types.ts';
import {
  buildPcnSampleFlowEvent,
  buildPcnSampleLot,
  derivePcnSampleLotStatus,
  derivePcnSampleRouteReadiness,
  getPcnSampleRouteSnapshotForItem,
  getPcnSampleRouteStartDenial,
  getNextPcnSampleRouteStatuses,
  isPcnSampleRouteCompleteForNext,
  projectPcnSampleRouteFromItemSnapshots,
  sortPcnSampleRoutes,
  transitionPcnSampleRoute,
} from '../utils/pcnSampleFlow.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const dossierDetailSource = fs.readFileSync(new URL('../components/PcnDossierDetailView.tsx', import.meta.url), 'utf8');
const sampleFlowSource = fs.readFileSync(new URL('../components/PcnSampleFlowView.tsx', import.meta.url), 'utf8');

test('builds one PCN sample lot with independent routes to the three testing rooms', () => {
  const result = buildPcnSampleLot({
    id: 'sample-lot-1',
    dossierId: 'dossier-1',
    lotCode: 'PCN-QC9-001-M01',
    sampleName: 'Bếp điện',
    model: 'ABC-1',
    quantity: 3,
    fieldCodes: ['QC9'],
    labCodes: ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY'],
  }, '2026-08-28T08:00:00.000Z');

  assert.equal(result.lot.lotCode, 'PCN-QC9-001-M01');
  assert.equal(result.lot.status, 'PREPARED');
  assert.deepEqual(result.routes.map((route) => route.labCode), ['PERFORMANCE', 'EMC', 'ELECTRICAL_SAFETY']);
  assert.deepEqual(result.routes.map((route) => route.sequence), [1, 2, 3]);
  assert.equal(result.routes.every((route) => route.status === 'PENDING'), true);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].sampleLotId, 'sample-lot-1');
  assert.equal(result.items[0].model, 'ABC-1');
});

test('builds one lot with multiple sample models and preserves each quantity', () => {
  const result = buildPcnSampleLot({
    id: 'sample-lot-many',
    dossierId: 'dossier-1',
    lotCode: 'PCN-QC9-MANY',
    sampleName: 'Thiết bị điện',
    quantity: 99,
    fieldCodes: ['QC9'],
    labCodes: ['PERFORMANCE', 'EMC'],
    sampleItems: [
      { id: 'item-a', sampleCode: 'M-01', sampleType: 'Bếp điện', model: 'ABC-1', quantity: 2, unit: 'cái' },
      { id: 'item-b', sampleCode: 'M-02', sampleType: 'Quạt điện', model: 'XYZ-2', quantity: 3, unit: 'cái' },
    ],
  }, '2026-08-28T08:00:00.000Z');

  assert.deepEqual(result.lot.sampleItemIds, ['item-a', 'item-b']);
  assert.equal(result.lot.quantity, 5);
  assert.deepEqual(result.items.map((item) => [item.sampleCode, item.model, item.quantity]), [['M-01', 'ABC-1', 2], ['M-02', 'XYZ-2', 3]]);
  assert.deepEqual(result.routes[0].sampleItemIds, ['item-a', 'item-b']);
});

test('creates only the explicitly assigned testing routes for each sample model', () => {
  const result = buildPcnSampleLot({
    id: 'sample-lot-assigned',
    dossierId: 'dossier-1',
    lotCode: 'PCN-QC9-ASSIGNED',
    sampleName: 'Thiết bị điện',
    quantity: 2,
    fieldCodes: ['QC9'],
    labCodes: ['EMC', 'PERFORMANCE', 'ELECTRICAL_SAFETY'],
    sampleItems: [
      { id: 'item-emc', sampleCode: 'EMC-01', sampleType: 'Bếp điện', model: 'EMC-1', quantity: 1, testLabCodes: ['EMC'] },
      { id: 'item-parallel', sampleCode: 'ITD-01', sampleType: 'Quạt điện', model: 'ITD-1', quantity: 1, testLabCodes: ['PERFORMANCE', 'ELECTRICAL_SAFETY'] },
    ],
  }, '2026-08-28T08:00:00.000Z');

  assert.deepEqual(result.items.map((item) => item.testLabCodes), [['EMC'], ['PERFORMANCE', 'ELECTRICAL_SAFETY']]);
  assert.deepEqual(result.routes.map((route) => route.labCode), ['EMC', 'PERFORMANCE', 'ELECTRICAL_SAFETY']);
  assert.deepEqual(result.routes.map((route) => route.sampleItemIds), [['item-emc'], ['item-parallel'], ['item-parallel']]);
});

test('opens assigned testing routes in parallel only when the model has multiple samples', () => {
  const readiness = derivePcnSampleRouteReadiness([
    { id: 'route-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 1, sampleItemIds: ['item-1'] },
    { id: 'route-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'PENDING', sequence: 2, sampleItemIds: ['item-1'] },
  ], { id: 'item-1', quantity: 2 });

  assert.deepEqual(readiness, { 'route-emc': 'READY', 'route-performance': 'READY' });
});

test('keeps assigned testing routes sequential when the model has one sample', () => {
  const readiness = derivePcnSampleRouteReadiness([
    { id: 'route-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'PENDING', sequence: 1, sampleItemIds: ['item-1'] },
    { id: 'route-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'PENDING', sequence: 2, sampleItemIds: ['item-1'] },
  ], { id: 'item-1', quantity: 1 });

  assert.deepEqual(readiness, { 'route-emc': 'READY', 'route-performance': 'BLOCKED' });
});

test('rejects a sample model without an assigned internal testing route', () => {
  assert.throws(() => buildPcnSampleLot({
    id: 'sample-lot-unassigned',
    dossierId: 'dossier-1',
    lotCode: 'PCN-QC9-UNASSIGNED',
    sampleName: 'Thiết bị điện',
    quantity: 1,
    fieldCodes: ['QC9'],
    labCodes: [],
    sampleItems: [{ id: 'item-unassigned', sampleCode: 'ECN-01', sampleType: 'Bếp điện', model: 'ECN-1', quantity: 1, testLabCodes: [] }],
  }), /gán ít nhất một phép thử|phòng thử nghiệm/i);
});

test('sample route readiness follows sequence and a failed execution does not block the next route', () => {
  const routes: PcnSampleRoute[] = [
    {
      id: 'route-2', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'EMC', status: 'PENDING', sequence: 2,
    },
    {
      id: 'route-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RESULT_RETURNED', sequence: 1,
      execution: { status: 'COMPLETED', outcome: 'FAIL', sourceSystemCode: 'PERFORMANCE' },
    },
    {
      id: 'route-3', sampleLotId: 'lot-1', labCode: 'ELECTRICAL_SAFETY', labName: 'An toàn điện', status: 'PENDING', sequence: 3,
    },
  ];

  assert.deepEqual(sortPcnSampleRoutes(routes).map((route) => route.id), ['route-1', 'route-2', 'route-3']);
  assert.deepEqual(derivePcnSampleRouteReadiness(routes, { id: 'item-1', quantity: 1 }), {
    'route-1': 'COMPLETED',
    'route-2': 'READY',
    'route-3': 'BLOCKED',
  });
  assert.equal(isPcnSampleRouteCompleteForNext(routes[1]), true);
});

test('a passed execution makes exactly the next pending route ready', () => {
  const routes: PcnSampleRoute[] = [
    {
      id: 'route-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RESULT_RETURNED', sequence: 1,
      execution: { status: 'COMPLETED', outcome: 'PASS', sourceSystemCode: 'PERFORMANCE' },
    },
    {
      id: 'route-2', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'EMC', status: 'PENDING', sequence: 2,
    },
    {
      id: 'route-3', sampleLotId: 'lot-1', labCode: 'ELECTRICAL_SAFETY', labName: 'An toàn điện', status: 'PENDING', sequence: 3,
    },
  ];
  assert.deepEqual(derivePcnSampleRouteReadiness(routes, { id: 'item-1', quantity: 1 }), {
    'route-1': 'COMPLETED',
    'route-2': 'READY',
    'route-3': 'BLOCKED',
  });
});

test('a completed execution opens the next sequential route before formal KQTN return', () => {
  const routes: PcnSampleRoute[] = [
    {
      id: 'route-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RECEIVED', sequence: 1,
      execution: { status: 'COMPLETED', outcome: 'FAIL', sourceSystemCode: 'PERFORMANCE' },
    },
    { id: 'route-2', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'EMC', status: 'PENDING', sequence: 2 },
  ];
  assert.deepEqual(derivePcnSampleRouteReadiness(routes, { id: 'item-1', quantity: 1 }), {
    'route-1': 'COMPLETED',
    'route-2': 'READY',
  });
  assert.equal(isPcnSampleRouteCompleteForNext(routes[0]), true);
});

test('route dispatch checks each assigned model snapshot instead of a shared route aggregate', () => {
  const previous: PcnSampleRoute = {
    id: 'route-1', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'RECEIVED', sequence: 1,
    sampleItemIds: ['item-a', 'item-b'],
    itemSnapshots: {
      'item-a': { status: 'RECEIVED', execution: { status: 'COMPLETED', outcome: 'PASS', sourceSystemCode: 'PERFORMANCE' } },
      'item-b': { status: 'RECEIVED', execution: { status: 'IN_PROGRESS', sourceSystemCode: 'PERFORMANCE' } },
    },
  };
  const next: PcnSampleRoute = { id: 'route-2', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'EMC', status: 'PENDING', sequence: 2, sampleItemIds: ['item-a', 'item-b'] };
  const items = [
    { id: 'item-a', sampleLotId: 'lot-1', sampleCode: 'A', sampleType: 'Thiết bị', model: 'A', quantity: 1 },
    { id: 'item-b', sampleLotId: 'lot-1', sampleCode: 'B', sampleType: 'Thiết bị', model: 'B', quantity: 1 },
  ];
  assert.match(getPcnSampleRouteStartDenial(next, [previous, next], items), /chặng trước/);
});

test('sample route flow does not allow skipping the receiving step', () => {
  assert.deepEqual(getNextPcnSampleRouteStatuses('PENDING'), ['SENT', 'CANCELLED']);
  const route: PcnSampleRoute = {
    id: 'route-1',
    sampleLotId: 'sample-lot-1',
    labCode: 'EMC',
    labName: 'Phòng thử EMC',
    status: 'PENDING',
  };
  assert.throws(() => transitionPcnSampleRoute(route, 'RESULT_RETURNED', { note: 'skip' }, '2026-08-28T08:00:00.000Z'));
  const sent = transitionPcnSampleRoute(route, 'SENT', {}, '2026-08-28T08:00:00.000Z');
  const received = transitionPcnSampleRoute(sent, 'RECEIVED', {}, '2026-08-28T09:00:00.000Z');
  assert.equal(sent.sentAt, '2026-08-28T08:00:00.000Z');
  assert.equal(received.receivedAt, '2026-08-28T09:00:00.000Z');
});

test('sample lot quantity must be a positive integer', () => {
  for (const quantity of [0, -1, 0.5, '2.5']) {
    assert.throws(() => buildPcnSampleLot({
      id: 'sample-lot-invalid',
      dossierId: 'dossier-1',
      lotCode: 'PCN-QC9-INVALID',
      sampleName: 'Bếp điện',
      quantity: quantity as number,
      fieldCodes: ['QC9'],
      labCodes: ['EMC'],
    }), /số nguyên dương|lớn hơn 0/i);
  }
});

test('sample lot must record at least one dossier field', () => {
  for (const fieldCodes of [[], ['', '  ']]) {
    assert.throws(() => buildPcnSampleLot({
      id: 'sample-lot-without-field',
      dossierId: 'dossier-1',
      lotCode: 'PCN-QC9-NO-FIELD',
      sampleName: 'Bếp điện',
      quantity: 1,
      fieldCodes,
      labCodes: ['EMC'],
    }), /ít nhất một Lĩnh vực/i);
  }
});

test('sample lot intake rejects an ambiguous or impossible receipt timestamp', () => {
  const base = {
    id: 'sample-lot-date',
    dossierId: 'dossier-1',
    lotCode: 'PCN-QC9-DATE',
    sampleName: 'Bếp điện',
    quantity: 1,
    fieldCodes: ['QC9'],
    labCodes: ['EMC'] as PcnSampleLabCode[],
  };
  assert.throws(() => buildPcnSampleLot({ ...base, receivedAt: '2026-02-30T08:00:00.000Z' }), /timestamp|ISO-8601|hợp lệ/i);
  assert.throws(() => buildPcnSampleLot({ ...base, receivedAt: '2026-08-29T08:00:00' }), /timestamp|ISO-8601|UTC/i);
});

test('aggregate lot status reflects multiple room routes', () => {
  const pending: PcnSampleRoute = { id: 'r1', sampleLotId: 'lot', labCode: 'PERFORMANCE', labName: 'Hiệu suất', status: 'SENT' };
  const atEmc: PcnSampleRoute = { id: 'r2', sampleLotId: 'lot', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'RECEIVED' };
  assert.equal(derivePcnSampleLotStatus([pending, atEmc]).status, 'AT_LAB');
  assert.equal(derivePcnSampleLotStatus([pending, atEmc]).currentLocation, 'Phòng thử EMC');
});

test('projects item-scoped execution snapshots without changing another model', () => {
  const route: PcnSampleRoute = {
    id: 'route-emc', sampleLotId: 'lot', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'SENT', sequence: 1,
    sampleItemIds: ['item-a', 'item-b'],
    itemSnapshots: {
      'item-a': {
        status: 'RECEIVED',
        execution: {
          status: 'COMPLETED', outcome: 'FAIL', scheduledDate: '2026-09-03',
          startedAt: '2026-09-03T07:00:00.000Z', completedAt: '2026-09-03T08:00:00.000Z',
          sourceSystemCode: 'EMC', lastExternalSequence: 4,
        },
      },
      'item-b': { status: 'SENT', execution: { status: 'SCHEDULED', scheduledDate: '2026-09-04', sourceSystemCode: 'EMC', lastExternalSequence: 3 } },
    },
  };
  const itemA = getPcnSampleRouteSnapshotForItem(route, 'item-a');
  const itemB = getPcnSampleRouteSnapshotForItem(route, 'item-b');
  assert.equal(itemA.status, 'RECEIVED');
  assert.equal(itemA.execution?.outcome, 'FAIL');
  assert.equal(itemA.execution?.completedAt, '2026-09-03T08:00:00.000Z');
  assert.equal(itemB.status, 'SENT');
  assert.equal(itemB.execution?.status, 'SCHEDULED');
  const aggregate = projectPcnSampleRouteFromItemSnapshots(route);
  assert.equal(aggregate.status, 'RECEIVED');
  assert.equal(aggregate.execution?.outcome, 'FAIL');
  assert.equal(aggregate.execution?.scheduledDate, '2026-09-03');
});

test('item-scoped lot projection shows the testing room while one model is being tested', () => {
  const route: PcnSampleRoute = {
    id: 'route-emc', sampleLotId: 'lot', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'SENT', sequence: 1,
    sampleItemIds: ['item-a'],
    itemSnapshots: {
      'item-a': { status: 'RECEIVED', execution: { status: 'COMPLETED', outcome: 'PASS', sourceSystemCode: 'EMC' } },
    },
  };
  assert.deepEqual(
    derivePcnSampleLotStatus([route], [{ id: 'item-a', sampleLotId: 'lot', sampleCode: 'EMC-01', sampleType: 'Thiết bị', model: 'M-01', quantity: 1, testLabCodes: ['EMC'] }]),
    { status: 'AT_LAB', currentLocation: 'Phòng thử EMC' },
  );
});

test('PCN sample flow has its own collections inside the dossier card', () => {
  assert.match(serverSource, /pcnSampleLots/);
  assert.match(serverSource, /pcnSampleFlowEvents/);
  assert.match(dossierDetailSource, /PcnSampleFlowView/);
  assert.match(dossierDetailSource, /Mẫu|PYC/);
  assert.match(workspaceSource, /PcnDossierDetailView/);
  assert.doesNotMatch(workspaceSource, /PcnSampleFlowView/);
  assert.doesNotMatch(workspaceSource, /schedule_itd|schedule_emc/);
});

test('sample lot field choices are limited to the selected dossier fields in the UI', () => {
  assert.match(sampleFlowSource, /const selectedDossier = dossiers\.find\(\(item\) => item\.id === form\.dossierId\)/);
  assert.match(sampleFlowSource, /const availableFields = selectedDossier/);
  assert.match(sampleFlowSource, /const availableFields = selectedDossier \? fields\.filter\(\(field\) => selectedDossier\.fieldCodes\.includes\(field\.code\)\) : \[\]/);
  assert.match(sampleFlowSource, /availableFields\.map\(\(field\) =>/);
  assert.match(sampleFlowSource, /fieldCodes: dossier\?\.fieldCodes \|\| previous\.fieldCodes/);
  assert.match(sampleFlowSource, /form\.fieldCodes\.length === 0/);
});

test('sample lot input displays server-owned yearly lot-code allocation', () => {
  assert.match(sampleFlowSource, /Server tự cấp/);
  assert.match(sampleFlowSource, /CN TTTT-YY/);
  assert.doesNotMatch(sampleFlowSource, /value=\{form\.lotCode\}/);
  assert.doesNotMatch(sampleFlowSource, /reviewPcnCodes/);
});

test('sample flow events carry a traceable route transition', () => {
  const event = buildPcnSampleFlowEvent({
    id: 'flow-1',
    sampleLotId: 'lot-1',
    routeId: 'route-1',
    type: 'LAB_RECEIVED',
    location: 'Phòng thử EMC',
    fromStatus: 'SENT',
    toStatus: 'RECEIVED',
    actorUsername: 'vuthitham',
  }, '2026-08-28T09:00:00.000Z');
  assert.equal(event.type, 'LAB_RECEIVED');
  assert.equal(event.fromStatus, 'SENT');
  assert.equal(event.toStatus, 'RECEIVED');
  assert.equal(event.actorUsername, 'vuthitham');
});

test('sample route UI locks the transition button while the server request is pending', () => {
  assert.match(sampleFlowSource, /const \[busyRouteId, setBusyRouteId\]/);
  assert.match(sampleFlowSource, /if \(busyRouteId === route\.id\) return/);
  assert.match(sampleFlowSource, /disabled=\{(?:busyRouteId === route\.id|isBusy)(?: \|\| blockedBySequence)?\}/);
  assert.match(sampleFlowSource, /finally \{\s*setBusyRouteId\(undefined\)/s);
});

test('sample route transitions enforce the quantity-based execution mode at UI and server boundaries', () => {
  assert.match(sampleFlowSource, /getPcnSampleRouteStartDenial/);
  assert.match(sampleFlowSource, /quantity > 1/);
  assert.match(serverSource, /getPcnSampleRouteStartDenial/);
});

test('sample flow keeps each lot collapsed until the user opens its assigned routes', () => {
  assert.match(sampleFlowSource, /expandedLotIds/);
  assert.match(sampleFlowSource, /Mở tất cả/);
  assert.match(sampleFlowSource, /Thu gọn tất cả/);
  assert.match(sampleFlowSource, /aria-expanded=\{isExpanded\}/);
  assert.match(sampleFlowSource, /aria-controls=\{`lot-flow-\$\{lot\.id\}`\}/);
  assert.match(sampleFlowSource, /id=\{`lot-flow-\$\{lot\.id\}`\}/);
  assert.match(sampleFlowSource, /getPcnSampleRouteSnapshotForItem/);
  assert.match(sampleFlowSource, /itemSnapshots/);
});
