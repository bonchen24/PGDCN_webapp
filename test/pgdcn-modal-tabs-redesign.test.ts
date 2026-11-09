import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const pcnWorkspace = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');
const pgdWorkspace = fs.readFileSync(new URL('../components/PgdWorkspace.tsx', import.meta.url), 'utf8');
const attachmentSection = fs.readFileSync(new URL('../components/PgdcnB1AttachmentSection.tsx', import.meta.url), 'utf8');

test('PGD intake modal features a dedicated 2-Tab layout separating form fields from attachments', () => {
  // Verifies tablist and tabs in PgdIntakeForm
  assert.match(pgdWorkspace, /role="tablist"/);
  assert.match(pgdWorkspace, /Thông tin Phiếu yêu cầu/);
  assert.match(pgdWorkspace, /Tệp đính kèm \(tùy chọn\)/);
  assert.match(pgdWorkspace, /activeTab\s*===\s*'info'/);
  assert.match(pgdWorkspace, /activeTab\s*===\s*'attachments'/);

  // Verifies PgdcnB1AttachmentSection is inside Tab 2, not interleaved in Tab 1
  assert.match(pgdWorkspace, /<div className=\{activeTab === 'attachments' \? 'space-y-4' : 'hidden'\}>\s*<PgdcnB1AttachmentSection/);
});

test('PCN proposal modal features a dedicated 2-Tab layout separating form fields from attachments', () => {
  // Verifies tablist and tabs in PcnProposalView
  assert.match(pcnWorkspace, /role="tablist"/);
  assert.match(pcnWorkspace, /Thông tin Đề nghị/);
  assert.match(pcnWorkspace, /Tệp đính kèm \(tùy chọn\)/);
  assert.match(pcnWorkspace, /proposalTab\s*===\s*'info'/);
  assert.match(pcnWorkspace, /proposalTab\s*===\s*'attachments'/);

  // Verifies PgdcnB1AttachmentSection is inside Tab 2
  assert.match(pcnWorkspace, /<div className=\{proposalTab === 'attachments' \? 'space-y-3' : 'hidden'\}>\s*\{!editingProposal\s*&&\s*<PgdcnB1AttachmentSection/);

  // Verifies validation errors return focus / switch to Tab 1
  assert.match(pcnWorkspace, /setProposalTab\('info'\)/);
});

test('PgdcnB1AttachmentSection supports direct per-item uploads alongside common screening checklist', () => {
  // Verifies common screening items for intake review
  assert.match(attachmentSection, /Giấy chứng nhận Đăng ký kinh doanh/);
  assert.match(attachmentSection, /Văn bản ủy quyền/);
  assert.match(attachmentSection, /Hợp đồng dịch vụ hoặc Xác nhận báo giá/);
  assert.match(attachmentSection, /Hồ sơ kỹ thuật/);

  // Verifies per-item direct upload inputs and labels
  assert.match(attachmentSection, /singleFileInputId/);
  assert.match(attachmentSection, /Tải tệp lên/);
  assert.match(attachmentSection, /Thay thế/);
  assert.match(attachmentSection, /Thêm tệp/);

  // Verifies each checklist item displays its own file list and count
  assert.match(attachmentSection, /itemFiles/);
  assert.match(attachmentSection, /formatPgdcnFileSize\(fileAtt\.file\.size\)/);
  assert.match(attachmentSection, /removeFile\(fileAtt\.id\)/);

  // Verifies batch dropzone and global attachments list for compatibility
  assert.match(attachmentSection, /onDrop/);
  assert.match(attachmentSection, /Chọn nhiều tệp/);
  assert.match(attachmentSection, /aria-label="Danh sách tệp B1 đã chọn"/);
});
