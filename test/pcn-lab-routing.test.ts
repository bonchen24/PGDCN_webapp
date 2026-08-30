import assert from 'node:assert/strict';
import test from 'node:test';

import { buildPcnLabRequest, getPcnLabFieldSelection } from '../utils/pcnLabRouting.ts';

test('keeps PYC field selection explicit for dossiers with multiple fields', () => {
  assert.equal(getPcnLabFieldSelection(['QC4', 'QC9']), '');
  assert.equal(getPcnLabFieldSelection(['QC4', 'QC9'], 'QC9'), 'QC9');
  assert.equal(getPcnLabFieldSelection(['QC9'], 'QC4'), 'QC9');
  assert.equal(getPcnLabFieldSelection(['QC4'], 'QC4'), 'QC4');
});

test('builds an outbound PYC linked to a dossier and its scheme field', () => {
  assert.deepEqual(buildPcnLabRequest({
    id: 'lab-1',
    dossierId: 'dossier-1',
    fieldCode: 'QC9',
    laboratoryName: 'Phòng thử nghiệm HSNL',
    criteria: 'TCVN 7492-1:2018',
    pycNumber: 'PYC-2026-001',
  }, '2026-08-27T02:00:00.000Z'), {
    id: 'lab-1',
    pycNumber: 'PYC-2026-001',
    dossierId: 'dossier-1',
    fieldCode: 'QC9',
    laboratoryName: 'Phòng thử nghiệm HSNL',
    status: 'DRAFT',
    requestedAt: '2026-08-27T02:00:00.000Z',
    criteria: 'TCVN 7492-1:2018',
  });
});

test('rejects a PYC without a destination laboratory', () => {
  assert.throws(() => buildPcnLabRequest({
    id: 'lab-2',
    dossierId: 'dossier-2',
    fieldCode: 'QC4',
    laboratoryName: ' ',
  }), /phòng thử nghiệm/);
});

test('rejects a PYC with a missing core identity or routing field', () => {
  const base = {
    id: 'lab-invalid',
    dossierId: 'dossier-2',
    fieldCode: 'QC4',
    laboratoryName: 'Phòng thử nghiệm Hiệu suất',
  };
  assert.throws(() => buildPcnLabRequest({ ...base, id: '' }), /định danh|mã/i);
  assert.throws(() => buildPcnLabRequest({ ...base, dossierId: '' }), /hồ sơ/i);
  assert.throws(() => buildPcnLabRequest({ ...base, fieldCode: '' }), /Lĩnh vực/i);
});

test('preserves the canonical sample lot and route links on a PYC', () => {
  const request = buildPcnLabRequest({
    id: 'lab-3',
    dossierId: 'dossier-3',
    fieldCode: 'QC4',
    laboratoryName: 'Phòng thử nghiệm Hiệu suất',
    sampleLotId: 'lot-3',
    sampleRouteId: 'lot-3-performance',
  }, '2026-08-28T02:00:00.000Z');

  assert.equal(request.sampleLotId, 'lot-3');
  assert.equal(request.sampleRouteId, 'lot-3-performance');
});

test('rejects an invalid PYC result deadline before persistence', () => {
  const base = {
    id: 'lab-date-invalid',
    dossierId: 'dossier-4',
    fieldCode: 'QC4' as const,
    laboratoryName: 'Phòng thử nghiệm Hiệu suất',
  };
  assert.throws(() => buildPcnLabRequest({ ...base, targetDate: '2026-02-30' }), /ngày lịch hợp lệ|YYYY-MM-DD/i);
  assert.throws(() => buildPcnLabRequest({ ...base, targetDate: '2026-08-29T00:00:00.000Z' }), /YYYY-MM-DD/i);
});

test('rejects an invalid PYC handover timestamp before persistence', () => {
  const base = {
    id: 'lab-timestamp-invalid',
    dossierId: 'dossier-5',
    fieldCode: 'QC9' as const,
    laboratoryName: 'Phòng thử nghiệm Hiệu suất',
  };
  assert.throws(() => buildPcnLabRequest({ ...base, handoverAt: '2026-02-30T08:15:00.000Z' }), /timestamp|ISO-8601|hợp lệ/i);
  assert.throws(() => buildPcnLabRequest({ ...base, handoverAt: '2026-08-29T08:15:00' }), /timestamp|ISO-8601|UTC/i);
});

// --- End of pcn-lab-routing.test.ts ---
