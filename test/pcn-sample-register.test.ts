import assert from 'node:assert/strict';
import test from 'node:test';

import { buildSampleRegisterRows } from '../utils/pcnSampleRegister.ts';

test('projects one ledger row per sample item and keeps laboratory cells independent', () => {
  const rows = buildSampleRegisterRows({
    dossiers: [{ id: 'd-1', dossierCode: 'HS-001', proposalId: 'p-1', customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' }, fieldCodes: ['QC4'], method: 'METHOD_1', status: 'SENT_TO_LAB', labRequestIds: [], returnedResultIds: [] }],
    proposals: [{ id: 'p-1', proposalCode: 'DN-001', customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' }, productName: 'Tủ lạnh', model: 'M1', quantity: 2, fieldCodes: ['QC4'], receivedAt: '2026-09-01T00:00:00.000Z', channel: 'DIRECT', status: 'CONVERTED' }],
    sampleLots: [{ id: 'lot-1', dossierId: 'd-1', lotCode: 'CN 0001-26', sampleName: 'Tủ lạnh', quantity: 3, sampleItemIds: ['item-1', 'item-2'], fieldCodes: ['QC4'], routeIds: ['route-emc', 'route-performance'], status: 'PREPARED', currentLocation: 'Kho PCN' }],
    sampleItems: [
      { id: 'item-1', sampleLotId: 'lot-1', sampleCode: 'M-01', sampleType: 'Tủ lạnh', model: 'M1', quantity: 2, testLabCodes: ['EMC', 'PERFORMANCE'] },
      { id: 'item-2', sampleLotId: 'lot-1', sampleCode: 'M-02', sampleType: 'Tủ lạnh', model: 'M2', quantity: 1, testLabCodes: ['EMC'] },
    ],
    sampleRoutes: [
      { id: 'route-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'SENT', sequence: 1, sampleItemIds: ['item-1', 'item-2'], labRequestId: 'request-emc' },
      { id: 'route-performance', sampleLotId: 'lot-1', labCode: 'PERFORMANCE', labName: 'Phòng thử Hiệu suất', status: 'PENDING', sequence: 2, sampleItemIds: ['item-1'] },
    ],
    labRequests: [{ id: 'request-emc', pycNumber: 'PYC-EMC-01', dossierId: 'd-1', fieldCode: 'QC4', laboratoryName: 'Phòng thử EMC', sampleLotId: 'lot-1', sampleRouteId: 'route-emc', status: 'SENT', requestedAt: '2026-09-06T01:00:00.000Z' }],
    bundles: [],
    returnedResults: [],
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].sampleItemId, 'item-1');
  assert.equal(rows[0].labCells.EMC.routeId, 'route-emc');
  assert.equal(rows[0].labCells.PERFORMANCE.routeId, 'route-performance');
  assert.equal(rows[1].labCells.PERFORMANCE, undefined);
  assert.equal(rows[0].customerName, 'Công ty A');
});

test('projects PTN feedback and execution lifecycle from the matching item snapshot', () => {
  const rows = buildSampleRegisterRows({
    dossiers: [{ id: 'd-1', dossierCode: 'HS-001', proposalId: 'p-1', customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' }, fieldCodes: ['QC4'], method: 'METHOD_1', status: 'SENT_TO_LAB', labRequestIds: [], returnedResultIds: [] }],
    proposals: [{ id: 'p-1', proposalCode: 'DN-001', customerSnapshot: { name: 'Công ty A', address: 'Hà Nội' }, productName: 'Tủ lạnh', model: 'M1', quantity: 1, fieldCodes: ['QC4'], receivedAt: '2026-09-01T00:00:00.000Z', channel: 'DIRECT', status: 'CONVERTED' }],
    sampleLots: [{ id: 'lot-1', dossierId: 'd-1', lotCode: 'CN 0001-26', sampleName: 'Tủ lạnh', quantity: 1, sampleItemIds: ['item-1'], fieldCodes: ['QC4'], routeIds: ['route-emc'], status: 'AT_LAB', currentLocation: 'Phòng thử EMC' }],
    sampleItems: [{ id: 'item-1', sampleLotId: 'lot-1', sampleCode: 'M-01', sampleType: 'Tủ lạnh', model: 'M1', quantity: 1, testLabCodes: ['EMC'] }],
    sampleRoutes: [{
      id: 'route-emc', sampleLotId: 'lot-1', labCode: 'EMC', labName: 'Phòng thử EMC', status: 'RECEIVED', sequence: 1, sampleItemIds: ['item-1'],
      itemSnapshots: {
        'item-1': {
          status: 'RECEIVED',
          execution: { status: 'SCHEDULED', scheduledDate: '2026-09-10', sourceSystemCode: 'EMC' },
          labSampleCode: 'EMC-26-001',
          sampleConditionCode: 'INTACT',
          sampleConditionNote: 'Nguyên vẹn',
          receivedQuantity: 1,
          receivedUnit: 'mẫu',
          receivedAt: '2026-09-05T09:30:00.000Z',
          receivedBy: 'PTN EMC',
        },
      },
    }],
    labRequests: [],
    bundles: [],
    returnedResults: [],
  });

  const cell = rows[0].labCells.EMC;
  assert.equal(cell.executionStatus, 'SCHEDULED');
  assert.equal(cell.executionScheduledDate, '2026-09-10');
  assert.equal(cell.labSampleCode, 'EMC-26-001');
  assert.equal(cell.sampleConditionCode, 'INTACT');
  assert.equal(cell.sampleConditionNote, 'Nguyên vẹn');
  assert.equal(cell.receivedAt, '2026-09-05T09:30:00.000Z');
  assert.equal(cell.receivedBy, 'PTN EMC');
});
