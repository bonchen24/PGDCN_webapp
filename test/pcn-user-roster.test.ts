import assert from 'node:assert/strict';
import test from 'node:test';

import { mapPcnRosterRow, normalizePcnRosterUsername } from '../utils/pcnUserRoster.ts';

test('PCN roster usernames are stable Vietnamese-name keys', () => {
  assert.equal(normalizePcnRosterUsername('Trần thị phượng'), 'tranthiphuong');
  assert.equal(normalizePcnRosterUsername(' Phạm Quý Phương '), 'phamquyphuong');
});

test('PCN roster mapping keeps contact data and accepts only QC4/QC9 scopes', () => {
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
    fieldAssignment: 'QC4, QC9',
  });

  assert.deepEqual(mapped.fieldCodes, ['QC4', 'QC9']);
  assert.equal(mapped.departmentRoleCode, 'CERTIFICATION_EXPERT');
});
