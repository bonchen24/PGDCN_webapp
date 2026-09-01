import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnSampleHandoverDetails } from '../utils/pcnHandoverPolicy.ts';

const root = new URL('../', import.meta.url);
const read = (path: string) => fs.readFileSync(new URL(path, root), 'utf8');

test('handover details normalize the parties, location, vehicle and sample identity', () => {
  const details = buildPcnSampleHandoverDetails({
    senderName: '  Trần Hoàng Phương ',
    senderUnit: ' PCN ',
    receiverName: ' Vũ Thị Thắm ',
    receiverUnit: 'Phòng thử EMC',
    handoverAt: '2026-08-30T08:00:00.000Z',
    receivedAt: '2026-08-30T09:00:00.000Z',
    location: ' Kho PCN ',
    vehicle: ' 29A-123.45 ',
    driver: ' Nguyễn Văn A ',
    quantity: 2,
    sampleCodes: ['PCN-QC9-001-M01', ' PCN-QC9-001-M02 '],
    note: ' Niêm phong nguyên vẹn ',
  });

  assert.deepEqual(details, {
    senderName: 'Trần Hoàng Phương',
    senderUnit: 'PCN',
    receiverName: 'Vũ Thị Thắm',
    receiverUnit: 'Phòng thử EMC',
    handoverAt: '2026-08-30T08:00:00.000Z',
    receivedAt: '2026-08-30T09:00:00.000Z',
    location: 'Kho PCN',
    vehicle: '29A-123.45',
    driver: 'Nguyễn Văn A',
    quantity: 2,
    sampleCodes: ['PCN-QC9-001-M01', 'PCN-QC9-001-M02'],
    note: 'Niêm phong nguyên vẹn',
  });
});

test('handover details reject incomplete records and impossible receipt order', () => {
  const base = {
    senderName: 'Trần Hoàng Phương',
    receiverName: 'Vũ Thị Thắm',
    handoverAt: '2026-08-30T08:00:00.000Z',
    location: 'Kho PCN',
    quantity: 1,
    sampleCodes: ['PCN-QC9-001-M01'],
  };
  assert.throws(() => buildPcnSampleHandoverDetails({ ...base, senderName: '' }), /người giao/i);
  assert.throws(() => buildPcnSampleHandoverDetails({ ...base, quantity: 0 }), /số lượng/i);
  assert.throws(() => buildPcnSampleHandoverDetails({ ...base, receivedAt: '2026-08-30T07:00:00.000Z' }), /sau thời điểm bàn giao/i);
});

test('handover modal saves the canonical record through the PCN PYC API boundary', () => {
  const modal = read('components/PcnSampleHandoverModal.tsx');
  const api = read('utils/pcnLabRequestApi.ts');
  const server = read('server.ts');
  assert.match(modal, /Người giao mẫu/);
  assert.match(modal, /Người nhận mẫu/);
  assert.match(modal, /Phương tiện/);
  assert.match(modal, /Lưu biên bản/);
  assert.match(api, /handoverDetails/);
  assert.match(server, /handoverDetails/);
});
