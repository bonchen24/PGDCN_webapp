import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('PGD workspace exposes source-derived form panels and no payment surface', () => {
  const source = readFileSync('components/PgdWorkspace.tsx', 'utf8') + readFileSync('components/PgdSourceFormsPanel.tsx', 'utf8');
  for (const label of ['Kế hoạch & phân công', 'Diễn biến vụ giám định', 'Ghi chép hiện trường', 'Đánh giá KQTN', 'Bìa hồ sơ']) assert.match(source, new RegExp(label));
  assert.doesNotMatch(source, /Báo giá|Thanh toán|Phí thử nghiệm/);
  assert.doesNotMatch(source, /JSON\.stringify|textarea[^>]+json/i);
});
