import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const userViewSource = fs.readFileSync(
  new URL('../components/PcnUserManagementView.tsx', import.meta.url),
  'utf8',
);
const deleteDialogStart = userViewSource.indexOf('/* Modal Xác nhận Xóa Nhân sự */');
const resetDialogStart = userViewSource.indexOf('/* Modal Reset Mật khẩu */', deleteDialogStart);
const deleteDialogSource = userViewSource.slice(deleteDialogStart, resetDialogStart);
const deleteHandlerStart = userViewSource.indexOf('const executeDeleteUser = async');
const resetHandlerStart = userViewSource.indexOf('const executeResetPassword = async', deleteHandlerStart);
const deleteHandlerSource = userViewSource.slice(deleteHandlerStart, resetHandlerStart);

test('PCN user deletion requires exact confirmation and keeps cancellation safe', () => {
  assert.notEqual(deleteDialogStart, -1, 'the user deletion dialog must exist');
  assert.notEqual(resetDialogStart, -1, 'the password reset dialog must follow the deletion dialog');

  assert.match(deleteDialogSource, /danh mục đăng nhập/);
  assert.match(deleteDialogSource, /không xóa hồ sơ nghiệp vụ, tệp, nhiệm vụ hoặc nhật ký lịch sử/);
  assert.match(deleteDialogSource, /tham chiếu đang hoạt động/);
  assert.match(deleteDialogSource, /value=\{deleteConfirmationText\}/);
  assert.match(deleteDialogSource, /placeholder="XAC NHAN"/);
  assert.match(deleteDialogSource, /disabled=\{deletingUsername === deleteConfirmUser\.username \|\| deleteConfirmationText !== 'XAC NHAN'\}/);
  assert.match(deleteHandlerSource, /deleteConfirmationText !== 'XAC NHAN'/);

  assert.match(deleteDialogSource, /Hủy bỏ/);
  assert.match(deleteDialogSource, /aria-label="Đóng hộp thoại"/);
  assert.match(deleteDialogSource, /e\.key === 'Escape' && deletingUsername !== deleteConfirmUser\.username/);
  assert.match(deleteDialogSource, /disabled=\{deletingUsername === deleteConfirmUser\.username\}/);
  assert.match(deleteDialogSource, /'Đang xóa…'/);
});
