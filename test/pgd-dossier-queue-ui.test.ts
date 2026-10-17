import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (relativePath: string) => fs.readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('PGD operations defaults to a work queue and keeps the data register as a secondary view', () => {
  const workspace = read('components/PgdWorkspace.tsx');
  const queue = read('components/PgdDossierQueueView.tsx');
  for (const marker of ['PgdDossierQueueView', 'Hàng đợi hồ sơ', 'Sổ dữ liệu']) assert.match(workspace, new RegExp(marker));
  for (const marker of ['Mã PYC', 'Khách hàng', 'Bước hiện tại / tiếp theo', 'Đầu mục hồ sơ còn thiếu', 'Chủ hồ sơ', 'Mở hồ sơ', 'mobile-scroll-x', 'aria-label="Hàng đợi hồ sơ PGD"']) {
    assert.match(queue, new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(workspace, /viewMode.*QUEUE.*DATA/);
  assert.match(workspace, /PgdSummaryRegisterView/);
});
