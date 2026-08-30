import assert from 'node:assert/strict';
import test from 'node:test';

import { getPcnDossierDateDenial, getPcnTimestampDenial } from '../utils/pcnDossierDate.ts';

test('dossier milestone dates accept valid calendar dates and clearing values', () => {
  assert.equal(getPcnDossierDateDenial('Ngày đánh giá', '2026-02-28'), null);
  assert.equal(getPcnDossierDateDenial('Ngày hiệu lực', '2024-02-29'), null);
  assert.equal(getPcnDossierDateDenial('Hạn xử lý', ''), null);
  assert.equal(getPcnDossierDateDenial('Hạn xử lý', '   '), null);
});

test('dossier milestone dates reject malformed and impossible calendar dates', () => {
  for (const value of ['2026-2-01', '2026-02-30', '2025-02-29', '2026-08-29T00:00:00.000Z', 'not-a-date']) {
    assert.match(getPcnDossierDateDenial('Hạn xử lý', value) || '', /YYYY-MM-DD|không tồn tại|không hợp lệ|ngày lịch hợp lệ/i);
  }
});

test('PYC event timestamps require an unambiguous valid UTC instant', () => {
  assert.equal(getPcnTimestampDenial('Thời điểm bàn giao PYC', '2026-08-29T08:15:00.000Z'), null);
  assert.equal(getPcnTimestampDenial('Thời điểm PTN nhận PYC', '2026-08-29T08:15:00Z'), null);
  assert.equal(getPcnTimestampDenial('Thời điểm PTN nhận PYC', ''), null);
  for (const value of [
    '2026-02-30T08:15:00.000Z',
    '2026-08-29T25:15:00.000Z',
    '2026-08-29T08:15:00',
    '2026-08-29',
    'not-a-timestamp',
  ]) {
    assert.match(getPcnTimestampDenial('Thời điểm PTN nhận PYC', value) || '', /ISO-8601 UTC|timestamp lịch hợp lệ/i);
  }
});

// --- End of pcn-dossier-date.test.ts ---
