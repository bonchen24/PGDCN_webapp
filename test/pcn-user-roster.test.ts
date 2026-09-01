import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { mapPcnRosterRow, normalizePcnRosterUsername } from '../utils/pcnUserRoster.ts';

const schemaSource = fs.readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');

test('PCN roster usernames are stable Vietnamese-name keys', () => {
  assert.equal(normalizePcnRosterUsername('Trần thị phượng'), 'tranthiphuong');
  assert.equal(normalizePcnRosterUsername(' Phạm Quý Phương '), 'phamquyphuong');
});

test('PCN roster mapping keeps contact data and accepts only active PCN scopes', () => {
  const mapped = mapPcnRosterRow({
    rowNumber: 2,
    name: 'Lương Xuân Hùng',
    phone: '0983565139',
    email: 'luongxuanhung2402@gmail.com',
    accountType: 'admin',
    position: 'Khách',
    fieldAssignment: 'Cưỡi ngựa xem hoa',
  });

  assert.deepEqual(mapped, {
    username: 'luongxuanhung',
    name: 'Lương Xuân Hùng',
    systemRole: 'admin',
    departmentRoleCode: 'UNASSIGNED',
    fieldCodes: [],
    active: true,
    phone: '0983565139',
    email: 'luongxuanhung2402@gmail.com',
    position: 'Khách',
  });
});

test('PCN roster mapping recognizes explicit PCN field codes without treating free text as scope', () => {
  const mapped = mapPcnRosterRow({
    rowNumber: 9,
    name: 'Nguyễn Tiến Thành',
    email: 'nguyen.tien.thanh.dt9k51@gmail.com',
    accountType: 'staff',
    position: 'Chuyên viên chứng nhận',
    fieldAssignment: 'QC4, QC9, QC20',
  });

  assert.deepEqual(mapped.fieldCodes, ['QC4', 'QC9', 'QC20']);
  assert.equal(mapped.departmentRoleCode, 'CERTIFICATION_EXPERT');
});

test('PCN schema bootstraps the current staff roster without mixing staff into customers', () => {
  for (const username of ['luongxuanhung', 'tranhoangphuong', 'vuthitham', 'dongocminh', 'lethanhvinh', 'nguyenhainam', 'nguyentienthanh', 'phamquyphuong', 'tranthiphuong']) {
    assert.match(schemaSource, new RegExp(`'systemUsers', '${username}'`));
  }
  assert.match(schemaSource, /'systemUsers', 'luongxuanhung',[\s\S]{0,240}"systemRole":"admin"/);
  assert.doesNotMatch(schemaSource, /'customers',[\s\S]{0,160}(tranhoangphuong|vuthitham|luongxuanhung)/);
});
