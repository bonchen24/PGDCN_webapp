import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const workspaceSource = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const productGroupFieldsSource = fs.readFileSync(new URL('../components/PgdProductGroupFields.tsx', import.meta.url), 'utf8');

test('PGD intake and register projection expose source-derived registry references', () => {
  assert.match(workspaceSource, /Sổ đăng ký PGD/);
  assert.match(workspaceSource, /Số đăng ký/);
  assert.match(workspaceSource, /Ngày tiếp nhận/);
  assert.match(workspaceSource, /Hợp đồng/);
  assert.match(workspaceSource, /Packing list/);
  assert.match(workspaceSource, /Vận đơn/);
  assert.match(workspaceSource, /Tờ khai hải quan/);
  assert.match(workspaceSource, /C\/O/);
  assert.match(workspaceSource, /Hồ sơ kỹ thuật/);
  assert.match(workspaceSource, /Thiếu hồ sơ/);
  assert.match(workspaceSource, /Hoàn trả/);
  assert.match(workspaceSource, /Chuyển phát/);
  assert.doesNotMatch(workspaceSource, /Báo giá/);
  assert.doesNotMatch(workspaceSource, /Thanh toán/);
  assert.match(workspaceSource, /QT-GĐ-14/);
  assert.match(workspaceSource, /Phương thức ĐGSPH/);
    assert.match(workspaceSource, /Cỡ lô \(bó\/kiện\/cuộn\)/);
    assert.match(workspaceSource, /Kế hoạch lấy mẫu/);
  assert.match(workspaceSource, /Kế hoạch thủ công \/ căn cứ/);
  assert.match(workspaceSource, /PgdProductGroupFields/);
  assert.match(productGroupFieldsSource, /Thông tin máy móc \/ dây chuyền/);
  assert.match(productGroupFieldsSource, /machineType/);
  assert.match(productGroupFieldsSource, /synchronization/);
  assert.match(productGroupFieldsSource, /Thông tin lô than/);
  assert.match(productGroupFieldsSource, /coalType/);
  assert.match(productGroupFieldsSource, /qualityStandard/);
  assert.match(workspaceSource, /aria-label="Sổ đăng ký PGD"/);
});

// --- End of pgd-register-ui.test.ts ---
