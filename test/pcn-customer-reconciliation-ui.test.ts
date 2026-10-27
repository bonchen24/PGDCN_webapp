import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PcnCustomersManagementView.tsx', import.meta.url), 'utf8');
const browserUtility = fs.readFileSync(new URL('../utils/pcnCustomerReconciliation.ts', import.meta.url), 'utf8');

test('active PCN customer screen stays focused on the operational customer list', () => {
  assert.match(source, /Danh sách khách hàng/);
  assert.match(source, /Dữ liệu khách hàng PCN/);
  assert.doesNotMatch(source, /Đối soát nguồn/);
  assert.doesNotMatch(source, /inspectPcnCustomerImport|buildPcnCustomerReconciliation|pcnCustomerReconciliation/);
  assert.match(source, /type=["']file["']/);
  assert.match(source, /accept=["']\.xlsx["']/);
  assert.match(source, /Chọn tệp Excel khách hàng/);
  assert.doesNotMatch(source, /SystemManagementViews/);
  assert.doesNotMatch(browserUtility, /node:crypto/);
});

test('PCN customer rows visibly flag records without business data', () => {
  assert.match(source, /Không có dữ liệu nghiệp vụ/);
  assert.match(source, /Cần rà soát/);
  assert.match(source, /AlertCircle/);
});

// --- End of pcn-customer-reconciliation-ui.test.ts ---
