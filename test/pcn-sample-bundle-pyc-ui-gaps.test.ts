import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ledgerSource = read('components/PcnLabOperationsView.tsx');
const modalSource = read('components/PcnSampleRequestBundleModal.tsx');

test('sample ledger lets users select rows and keeps the required source columns visible', () => {
  for (const label of ['Chọn', 'Mã lô', 'Mã mẫu', 'Đề nghị/biên bản', 'Vị trí hiện tại', 'Trạng thái mẫu']) {
    assert.match(ledgerSource, new RegExp(label.replace('/', '\\/')));
  }
  assert.match(ledgerSource, /selectedSampleItemIds/);
  assert.match(ledgerSource, /sample-register-selection-error/);
  assert.match(ledgerSource, /mobile-scroll-x/);
});

test('sample ledger KPIs count rows by the sample workflow states', () => {
  for (const label of ['Đang ở PTN', 'Chờ tạo PYC', 'Chờ KQTN', 'Có sự cố']) {
    assert.match(ledgerSource, new RegExp(label));
  }
});

test('bundle modal exposes the three workflow regions and independent scroll contracts', () => {
  assert.match(modalSource, /data-testid="pyc-step-source"[\s\S]*Nguồn mẫu/);
  assert.match(modalSource, /data-testid="pyc-step-routing"[\s\S]*Thông tin (?:&|&amp;) tuyến gửi/);
  assert.match(modalSource, /data-testid="pyc-step-mapping"[\s\S]*Kiểm tra mapping/);
  assert.match(modalSource, /initialSampleItemIds/);
  assert.match(modalSource, /mobile-scroll-y/);
  assert.match(modalSource, /mobile-scroll-x/);
});

test('bundle modal connects mapping issues to each line and laboratory', () => {
  assert.match(modalSource, /mapping-line-issue/);
  assert.match(modalSource, /mapping-ptn-issue/);
  assert.match(modalSource, /mappingPreview\.issues\.filter/);
  assert.match(modalSource, /aria-describedby/);
});

test('bundle modal keeps save/send controls busy and shows fan-out dispatch status', () => {
  assert.match(modalSource, /aria-busy=\{isSubmitting\}/);
  assert.match(modalSource, /Kết quả gửi PYC/);
  assert.match(modalSource, /Gửi lại PYC con/);
});

test('bundle modal makes required mapping fields and date format explicit', () => {
  assert.match(modalSource, /Số PYC tổng.*text-rose-600/);
  assert.match(modalSource, /Địa chỉ khách hàng.*text-rose-600/);
  assert.match(modalSource, /Mã lô \/ Mã mẫu.*text-rose-600/);
  assert.match(modalSource, /Loại mẫu \/ (Model|kiểu loại).*text-rose-600/);
  assert.match(modalSource, /PgdcnDateInput/);
  assert.doesNotMatch(modalSource, /placeholder=/);
});
