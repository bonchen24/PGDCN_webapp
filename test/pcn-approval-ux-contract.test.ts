import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const approvalModal = fs.readFileSync(new URL('../components/PcnApprovalModal.tsx', import.meta.url), 'utf8');
const issuanceView = fs.readFileSync(new URL('../components/PcnIssuanceView.tsx', import.meta.url), 'utf8');

test('approval modal makes read-only package evidence and actor authority explicit', () => {
  assert.match(approvalModal, /role="dialog"/);
  assert.match(approvalModal, /aria-modal="true"/);
  assert.match(approvalModal, /Bằng chứng gói hồ sơ/);
  assert.match(approvalModal, /manifest/i);
  assert.match(approvalModal, /nguồn gốc|provenance/i);
  assert.match(approvalModal, /checksum/i);
  assert.match(approvalModal, /Hành động tiếp theo/);
  assert.match(approvalModal, /Vai trò yêu cầu/);
  assert.match(approvalModal, /Quyền quyết định/);
  assert.match(approvalModal, /Ủy quyền/);
  assert.match(approvalModal, /Bắt buộc khi trả hồ sơ/);
  assert.match(approvalModal, /aria-describedby="pcn-approval-comment-hint"/);
  assert.match(approvalModal, /mobile-touch-target|min-h-11/);
});

test('issuance view exposes a sequential lifecycle rail and actionable readiness warnings', () => {
  assert.match(issuanceView, /APPROVED.*ISSUED.*DELIVERED.*ARCHIVED/s);
  assert.match(issuanceView, /Chuỗi phê duyệt/);
  assert.match(issuanceView, /Người ký/);
  assert.match(issuanceView, /Ủy quyền/);
  assert.match(issuanceView, /Trực tiếp/);
  assert.match(issuanceView, /Bản kê hệ thống|Manifest.*server|manifest.*server/i);
  assert.match(issuanceView, /nguồn gốc|provenance/i);
  assert.match(issuanceView, /checksum/i);
  assert.match(issuanceView, /Hành động tiếp theo/);
  assert.match(issuanceView, /Bổ sung tài liệu|duyệt mẫu|kiểm tra nguồn gốc|duyệt template|kiểm tra provenance/i);
  assert.match(issuanceView, /Xem bằng chứng bước 5/);
  assert.match(issuanceView, /selectedApproval && <PcnApprovalModal/);
  assert.match(issuanceView, /mobile-touch-target|min-h-11/);
});
