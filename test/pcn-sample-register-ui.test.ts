import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const ledgerSource = fs.readFileSync(new URL('../components/PcnLabOperationsView.tsx', import.meta.url), 'utf8');
const modalSource = fs.readFileSync(new URL('../components/PcnSampleRequestBundleModal.tsx', import.meta.url), 'utf8');

test('sample management surface is a cell ledger with laboratory-specific columns', () => {
  assert.match(ledgerSource, /sample-register-grid/);
  assert.match(ledgerSource, /Tạo Phiếu yêu cầu thử nghiệm/);
  assert.match(ledgerSource, /lab-cell/);
  assert.match(ledgerSource, /Sổ quản lý mẫu/);
});

test('bundle modal supports same-customer source selection, editable codes and multi-lab checks', () => {
  assert.match(modalSource, /Cùng khách hàng/);
  assert.match(modalSource, /Mã lô/);
  assert.match(modalSource, /Mã mẫu/);
  assert.match(modalSource, /PCN_SAMPLE_LAB_OPTIONS/);
  assert.match(modalSource, /Lưu/);
  assert.match(modalSource, /Gửi/);
});
