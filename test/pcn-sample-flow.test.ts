import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { PcnSampleLabCode, PcnSampleRoute } from '../types.ts';
import {
  buildPcnSampleFlowEvent,
  buildPcnSampleLot,
  derivePcnSampleLotStatus,
  getNextPcnSampleRouteStatuses,
  transitionPcnSampleRoute,
} from '../utils/pcnSampleFlow.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
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
  assert.equal(result.routes.every((route) => route.status === 'PENDING'), true);
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

test('PCN sample flow has its own collections and workspace surface', () => {
  assert.match(serverSource, /pcnSampleLots/);
  assert.match(serverSource, /pcnSampleFlowEvents/);
  assert.match(workspaceSource, /PcnSample|Mẫu theo lô|Luân chuyển mẫu/);
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

test('sample lot input exposes the PCN code review projection without rewriting the source value', () => {
  assert.match(sampleFlowSource, /reviewPcnCodes/);
  assert.match(sampleFlowSource, /Mã chuẩn hóa/);
  assert.match(sampleFlowSource, /Cần đối chiếu mã nguồn PCN/);
  assert.match(sampleFlowSource, /codeReview\.normalized/);
  assert.match(sampleFlowSource, /codeReview\.source/);
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
  assert.match(sampleFlowSource, /disabled=\{(?:busyRouteId === route\.id|isBusy)\}/);
  assert.match(sampleFlowSource, /finally \{\s*setBusyRouteId\(undefined\)/s);
});
