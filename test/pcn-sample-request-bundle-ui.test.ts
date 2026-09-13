import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const modalSource = fs.readFileSync(new URL('../components/PcnSampleRequestBundleModal.tsx', import.meta.url), 'utf8');
const operationsSource = fs.readFileSync(new URL('../components/PcnLabOperationsView.tsx', import.meta.url), 'utf8');

test('PYC modal previews explicit route mapping and target applications', () => {
  assert.match(modalSource, /buildSampleRequestBundleMappingPreview/);
  assert.match(modalSource, /sampleRoutes/);
  assert.match(modalSource, /routeIdsByLab/);
  assert.match(modalSource, /LABFTEE/);
  assert.match(modalSource, /DDT/);
  assert.match(modalSource, /Kiểm tra mapping/);
  assert.match(modalSource, /Hạn trả KQTN/);
  assert.match(modalSource, /Chỉ tiêu\/tiêu chuẩn/);
});

test('PYC modal keeps send feedback visible instead of closing silently', () => {
  assert.match(modalSource, /Kết quả gửi PYC/);
  assert.match(modalSource, /Đã nhận/);
  assert.match(modalSource, /Lỗi cần xử lý/);
  assert.match(modalSource, /externalRequestCode/);
  assert.match(modalSource, /lastErrorMessage/);
});

test('PYC modal exposes the complete editable sample-line fields', () => {
  assert.match(modalSource, /Nhãn hiệu/);
  assert.match(modalSource, /Đơn vị/);
  assert.match(modalSource, /Ghi chú mẫu/);
  assert.match(modalSource, /brand: event\.target\.value/);
  assert.match(modalSource, /unit: event\.target\.value/);
  assert.match(modalSource, /notes: event\.target\.value/);
  assert.match(modalSource, /data-testid="pyc-draft-summary"/);
  assert.match(modalSource, /dòng.*mẫu/);
  assert.match(modalSource, /chưa có PTN/);
});

test('PYC modal blocks invalid or duplicate line data before mutation', () => {
  assert.match(modalSource, /Số lượng phải lớn hơn 0/);
  assert.match(modalSource, /Mã lô .* bị trùng trong PYC tổng/);
  assert.match(modalSource, /Mã mẫu .* bị trùng trong PYC tổng/);
  assert.match(modalSource, /lineDataIssues/);
  assert.doesNotMatch(modalSource, /labCodes: \['PERFORMANCE'\]/);
});

test('sample operations passes canonical routes to the PYC modal', () => {
  assert.match(operationsSource, /<PcnSampleRequestBundleModal[\s\S]*sampleRoutes=\{sampleRoutes\}/);
});

// --- End of pcn-sample-request-bundle-ui.test.ts ---
