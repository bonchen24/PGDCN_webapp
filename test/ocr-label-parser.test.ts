import assert from 'node:assert/strict';
import test from 'node:test';
import { readOcrLabelValue } from '../utils/ocrLabelParser.ts';

test('shared OCR label parser supports PCN and PGD two-line labels', () => {
  const text = `
Khách hàng
: CÔNG TY TNHH TAJIMA STEEL VIỆT NAM
Hạng mục chứng nhận: QCVN 20:2019/BKHCN
Địa điểm
: KCN Thạch Thất - Quốc Oai
`;

  assert.equal(readOcrLabelValue(text, ['khách hàng', 'tên đơn vị']), 'CÔNG TY TNHH TAJIMA STEEL VIỆT NAM');
  assert.equal(readOcrLabelValue(text, ['hạng mục chứng nhận', 'hạng mục']), 'QCVN 20:2019/BKHCN');
  assert.equal(readOcrLabelValue(text, ['địa điểm', 'nơi lấy mẫu']), 'KCN Thạch Thất - Quốc Oai');
});

test('shared OCR label parser keeps a location value split before and after a label', () => {
  assert.equal(
    readOcrLabelValue(`Thời gian thực hiện\n:15/5/2026\n:Lo CN6-1, KCN Thạch Thất- Quốc Oai-\nĐịa dièm\nxã Tây Phương, TP Hà Nội,`, ['địa điểm', 'dia diěm']),
    'Lo CN6-1, KCN Thạch Thất- Quốc Oai- xã Tây Phương, TP Hà Nội,',
  );
});
