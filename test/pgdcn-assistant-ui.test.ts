import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('shared assistant exposes PCN and PGD domain workbenches', () => {
  const source = fs.readFileSync(new URL('../components/PgdcnAssistantView.tsx', import.meta.url), 'utf8');
  for (const marker of ['Chứng nhận (PCN)', 'Giám định (PGD)', 'thép/kim loại', 'máy móc/dây chuyền', 'than', 'giám định ngoài', 'hàng hóa khác', 'PGD_ASSISTANT_CRITERION_DEFINITIONS', 'PGD_ASSISTANT_CRITERION_ORDER', 'NOT_EVALUABLE']) {
    assert.ok(source.includes(marker), `Missing assistant marker: ${marker}`);
  }
  assert.match(source, /read-only|readOnly|chỉ đọc/i);
  for (const marker of ['mobile-touch-target', 'aria-live', 'Mở hồ sơ PGD', 'Không có PYC PGD', 'Bắt đầu soát xét hồ sơ', '/api/pgd/assistant/review', 'run_completed', 'Mở bằng chứng', 'Luật + AI ngữ nghĩa', 'Đang tải danh sách hồ sơ PGD', 'Hồ sơ đang chọn', 'Đang soát xét tiêu chí', 'Tiêu chí đã hoàn tất', '11 tiêu chí', 'classifyPcnAssistantError', 'Mở tệp', 'Dẫn chứng', 'Điểm cần sửa / đối chiếu', 'Thao tác nhanh · chỉ đọc', 'không tạo nội dung chính thức', 'getPgdStatusLabel(candidate.status)', 'getPgdStatusLabel(selectedRequest.status)', 'setQuickAnswer(\'\')', 'selectRequest(initialRequestId)', 'initialRequestContextRef.current !== initialRequestId', 'initialRequestAppliedRef.current === initialRequestId', 'reviewRunRef.current === runId']) {
    assert.ok(source.includes(marker), `Missing shared assistant UX marker: ${marker}`);
  }
  assert.doesNotMatch(source, /Quick actions|Mở vùng soạn báo cáo|\{candidate\.status\}|text-\[9px\]/);
});
