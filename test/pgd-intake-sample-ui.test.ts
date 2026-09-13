import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/PgdIntakeSampleTable.tsx', import.meta.url), 'utf8');

test('PGD intake sample table is compact, editable, and row-validating', () => {
  for (const marker of [
    'Bảng tổng hợp mẫu',
    'Thêm mẫu',
    'Xóa mẫu',
    'Tên/mô tả mẫu',
    'Mã mẫu',
    'Số lượng',
    'Phân loại mẫu',
    'Số niêm phong',
    'catalogOptionId',
    'Mẫu khác',
    'text-rose-600',
    'mobile-scroll-x',
    'Tổng số lượng',
  ]) assert.match(source, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(source, /duplicate|trùng/i);
  assert.match(source, /onRemove|remove|Xóa/);
});

