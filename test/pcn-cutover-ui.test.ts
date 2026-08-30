import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const viewPath = new URL('../components/PcnCutoverVerificationView.tsx', import.meta.url);
const apiSource = fs.readFileSync(new URL('../utils/pcnCutoverApi.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN cutover review is Admin-only and keeps import behind an explicit boundary', () => {
  assert.equal(fs.existsSync(viewPath), true);
  const viewSource = fs.readFileSync(viewPath, 'utf8');
  assert.match(workspaceSource, /PcnCutoverVerificationView/);
  assert.match(workspaceSource, /'cutover'/);
  assert.match(workspaceSource, /isPcnAdmin/);
  assert.match(viewSource, /fetchPcnCutoverStatus/);
  assert.match(viewSource, /read-only|Chỉ đọc/i);
  assert.match(viewSource, /applyPcnCustomerImport/);
  assert.match(viewSource, /KHOI_TAO_DANH_MUC_PCN/);
  assert.doesNotMatch(viewSource, /restore|delete/i);
  assert.match(apiSource, /\/api\/pcn\/cutover-status/);
  assert.match(designSource, /không tự sửa dữ liệu/);
});

test('PCN cutover review can compare a selected customer source locally', () => {
  const viewSource = fs.readFileSync(viewPath, 'utf8');
  assert.match(viewSource, /parsePcnCustomerCsv/);
  assert.match(viewSource, /inspectPcnCustomerImport/);
  assert.match(viewSource, /buildPcnCustomerReconciliation/);
  assert.match(viewSource, /type="file"/);
  assert.match(viewSource, /missingKeys/);
  assert.match(viewSource, /extraKeys/);
  assert.match(viewSource, /changedFieldsByKey/);
  assert.match(viewSource, /possibleAliasMatches/);
  assert.match(viewSource, /Ứng viên alias cần xác nhận/);
  assert.match(viewSource, /fieldDifferenceCounts/);
  assert.match(viewSource, /ddtCollectionNames/);
  assert.match(viewSource, /collection DDT|collection nghiệp vụ DDT/i);
  assert.match(viewSource, /sourceCheck\.inspection\.rejected/);
  assert.match(viewSource, /sourceIndex/);
  assert.match(viewSource, /sourceCheck\.inspection\.duplicateKeys/);
  assert.doesNotMatch(viewSource, /FormData/);
});

test('PCN cutover review can export the visible read-only evidence locally', () => {
  const viewSource = fs.readFileSync(viewPath, 'utf8');
  assert.match(viewSource, /Blob/);
  assert.match(viewSource, /URL\.createObjectURL/);
  assert.match(viewSource, /download/);
  assert.match(viewSource, /pcn-cutover/);
  assert.match(designSource, /Admin có thể xuất CSV từ snapshot/);
  assert.match(designSource, /không chứa thông tin liên hệ, byte file, credential/);
});

test('PCN cutover review exposes the latest customer-import backup checkpoint', () => {
  const viewSource = fs.readFileSync(viewPath, 'utf8');
  assert.match(viewSource, /latestCustomerImportCheckpoint/);
  assert.match(viewSource, /customerImportBackupVerification/);
  assert.match(viewSource, /Archive kiểm chứng lại/);
  assert.match(viewSource, /sourceFingerprint/);
  assert.match(viewSource, /Chưa có audit import khách hàng chứa checkpoint đầy đủ/);
  assert.match(designSource, /Bằng chứng checkpoint import trên màn hình cutover/);
});

test('PCN cutover review exposes empty customer records as a separate evidence metric', () => {
  const viewSource = fs.readFileSync(viewPath, 'utf8');
  assert.match(viewSource, /emptyTargetRecordCount/);
  assert.match(viewSource, /Bản ghi khách hàng trống/);
});
