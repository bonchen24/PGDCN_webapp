import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('shared assistant exposes PCN and PGD domain workbenches', () => {
  const source = fs.readFileSync(new URL('../components/PgdcnAssistantView.tsx', import.meta.url), 'utf8');
  for (const marker of ['Chứng nhận (PCN)', 'Giám định (PGD)', 'thép/kim loại', 'máy móc/dây chuyền', 'than', 'giám định ngoài', 'hàng hóa khác', 'Tiếp nhận & năng lực', 'Chuẩn bị & phân công', 'Hiện trường & lấy mẫu', 'PTN & xem xét kết quả', 'Báo cáo, phê duyệt & trả kết quả', 'NOT_EVALUABLE']) {
    assert.ok(source.includes(marker), `Missing assistant marker: ${marker}`);
  }
  assert.match(source, /read-only|readOnly|chỉ đọc/i);
});
