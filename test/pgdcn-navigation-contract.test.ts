import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getPgdcnVisibleNavigation } from '../utils/pgdcnNavigation.ts';

test('dual-scope navigation exposes shared entries and both department groups', () => {
  const labels = getPgdcnVisibleNavigation(['PCN', 'PGD']).map((item) => item.label);

  assert.deepEqual(labels.slice(0, 5), ['Tổng quan phòng', 'Khách hàng', 'Trợ lý AI', 'Nhật ký hoạt động', 'Cài đặt hệ thống']);
  assert.ok(labels.includes('CHỨNG NHẬN (PCN)'));
  assert.ok(labels.includes('GIÁM ĐỊNH (PGD)'));
});

test('single-scope navigation hides the other domain group but keeps shared tools', () => {
  const labels = getPgdcnVisibleNavigation(['PCN']).map((item) => item.label);

  assert.ok(labels.includes('Tổng quan phòng'));
  assert.ok(labels.includes('Khách hàng'));
  assert.ok(labels.includes('Trợ lý AI'));
  assert.ok(labels.includes('Nhật ký hoạt động'));
  assert.ok(labels.includes('Cài đặt hệ thống'));
  assert.ok(labels.includes('CHỨNG NHẬN (PCN)'));
  assert.equal(labels.includes('GIÁM ĐỊNH (PGD)'), false);
});

test('canonical and compatibility routes point to the shared PGDCN shell', () => {
  const page = fs.readFileSync(new URL('../app/pgdcn/page.tsx', import.meta.url), 'utf8');
  const pcnPage = fs.readFileSync(new URL('../app/pgdcn/pcn/page.tsx', import.meta.url), 'utf8');
  const pgdPage = fs.readFileSync(new URL('../app/pgdcn/pgd/page.tsx', import.meta.url), 'utf8');

  assert.match(page, /PgdcnAppShell/);
  assert.match(pcnPage, /PgdcnAppShell/);
  assert.match(pgdPage, /PgdcnAppShell/);
  assert.doesNotMatch(page, /Chọn không gian nghiệp vụ/);
});
