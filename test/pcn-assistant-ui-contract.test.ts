import assert from 'node:assert/strict';
import test from 'node:test';

import { classifyPcnAssistantError } from '../utils/pcnAssistantUi.ts';

test('classifies missing private storage as an administrator action', () => {
  assert.deepEqual(classifyPcnAssistantError({
    code: 'PCN_APPROVAL_ASSISTANT_FAILED',
    message: 'PCN file storage is not configured. Set SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY.',
  }), {
    kind: 'STORAGE_CONFIG',
    title: 'Chưa sẵn sàng đọc file private',
    action: 'Quản trị viên cần kiểm tra cấu hình Storage Supabase.',
  });
});

test('classifies empty DOCX text and keeps the file name', () => {
  const result = classifyPcnAssistantError({
    code: 'PADDLE_OCR_EMPTY',
    message: 'Dừng phiên AI: Tài liệu Dấu mềm.docx không có nội dung để kiểm tra.',
  });
  assert.equal(result.kind, 'EMPTY_DOCUMENT');
  assert.match(result.detail || '', /Dấu mềm\.docx/);
  assert.equal(result.action, 'Mở file bằng chứng để kiểm tra nội dung.');
});

test('uses a safe retry message for unknown assistant failures', () => {
  const result = classifyPcnAssistantError({ message: 'unexpected upstream error' });
  assert.equal(result.kind, 'UNKNOWN');
  assert.equal(result.action, 'Thử lại phiên hỗ trợ.');
});
