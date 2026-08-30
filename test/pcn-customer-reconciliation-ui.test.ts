import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/SystemManagementViews.tsx', import.meta.url), 'utf8');
const browserUtility = fs.readFileSync(new URL('../utils/pcnCustomerReconciliation.ts', import.meta.url), 'utf8');

test('PCN customer screen exposes a read-only local source reconciliation control', () => {
  const pcnSection = source.slice(source.indexOf("source === 'pcn'"));
  assert.match(pcnSection, /Đối soát nguồn/);
  assert.match(pcnSection, /type=["']file["']/);
  assert.match(pcnSection, /\.csv/);
  assert.match(pcnSection, /inspectPcnCustomerImport/);
  assert.match(pcnSection, /buildPcnCustomerReconciliation/);
  assert.match(pcnSection, /possibleAliasMatches/);
  assert.match(pcnSection, /Ứng viên alias cần xác nhận/);
  assert.match(pcnSection, /read-only|chỉ đọc|không ghi/i);
  assert.match(source, /pcnCustomerReconciliation/);
  assert.doesNotMatch(source, /pcnCustomerMigration/);
  assert.doesNotMatch(browserUtility, /node:crypto/);
});

test('PCN customer rows visibly flag records without business data', () => {
  const pcnSection = source.slice(source.indexOf("source === 'pcn'"));
  assert.match(pcnSection, /Không có dữ liệu nghiệp vụ/);
  assert.match(pcnSection, /Cần rà soát/);
  assert.match(pcnSection, /AlertCircle/);
});

// --- End of pcn-customer-reconciliation-ui.test.ts ---
