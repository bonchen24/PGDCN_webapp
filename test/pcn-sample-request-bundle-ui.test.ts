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

test('sample operations passes canonical routes to the PYC modal', () => {
  assert.match(operationsSource, /<PcnSampleRequestBundleModal[\s\S]*sampleRoutes=\{sampleRoutes\}/);
});

// --- End of pcn-sample-request-bundle-ui.test.ts ---
