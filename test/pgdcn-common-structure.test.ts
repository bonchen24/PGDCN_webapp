import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { canManageSystemUsers } from '../utils/systemSettingsPolicy.ts';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('shared sidebar owns customer and system-settings branches without domain duplicates', () => {
  const source = read('../components/PgdcnSidebar.tsx');
  assert.match(source, /PgdcnSharedSection/);
  assert.match(source, /'customers'/);
  assert.match(source, /'system-settings'/);
  assert.match(source, /Khách hàng/);
  assert.match(source, /Cài đặt hệ thống/);
  assert.doesNotMatch(source, /Cài đặt PCN|Cài đặt PGD/);
  assert.match(source, /canViewSystemSettings/);
  const pcnItems = source.slice(source.indexOf('const PCN_ITEMS'), source.indexOf('const PGD_ITEMS'));
  const pgdItems = source.slice(source.indexOf('const PGD_ITEMS'), source.indexOf('const isTargetActive'));
  assert.doesNotMatch(pcnItems, /section: 'dashboard'|section: 'customers'|section: 'users'|section: 'settings'/);
  assert.doesNotMatch(pgdItems, /section: 'dashboard'|section: 'customers'|section: 'users'/);
});

test('shared shell routes customers and system settings before domain workspaces', () => {
  const source = read('../components/PgdcnAppShell.tsx');
  assert.match(source, /PgdcnCustomersView/);
  assert.match(source, /PgdcnSystemSettingsView/);
  assert.match(source, /section === 'customers'/);
  assert.match(source, /section === 'system-settings'/);
  assert.doesNotMatch(source, /if \(section === 'settings'\)/);
});

test('system settings puts personnel assignment and password operations in one shared surface', () => {
  const source = read('../components/PgdcnSystemSettingsView.tsx');
  for (const marker of ['Nhân sự &amp; tài khoản', 'departmentScopes', 'position', 'Reset mật khẩu', 'Admin', 'Quản lý']) {
    assert.ok(source.includes(marker), `Missing system settings marker: ${marker}`);
  }
  assert.match(source, /PcnSettingsView/);
  assert.doesNotMatch(source, /PgdTemplateSettingsWorkspace/);
  assert.doesNotMatch(source, /Danh mục phòng ban|Danh mục chức vụ/);
});

test('system-settings policy recognizes admin and managers but not ordinary staff', () => {
  const source = read('../utils/systemSettingsPolicy.ts');
  assert.match(source, /systemRole/);
  assert.match(source, /departmentRoleCode/);
  assert.match(source, /PGD_MANAGER/);
  assert.match(source, /canManageSystemUsers/);
});

test('system-settings policy allows only admin or assigned manager to maintain personnel', () => {
  assert.equal(canManageSystemUsers({ role: 'admin', systemRole: 'admin' }), true);
  assert.equal(canManageSystemUsers({ role: 'staff', systemRole: 'staff', departmentRoleCode: 'LEADERSHIP' }), true);
  assert.equal(canManageSystemUsers({ role: 'staff', systemRole: 'staff', pgdRole: 'PGD_MANAGER' }), true);
  assert.equal(canManageSystemUsers({ role: 'staff', systemRole: 'staff', position: 'Nhân viên' }), false);
});

test('PGDCN sidebar uses compact gaps while preserving mobile touch targets', () => {
  const source = read('../components/PgdcnSidebar.tsx');
  assert.match(source, /space-y-0\.5/);
  assert.match(source, /min-h-9/);
  assert.match(source, /gap-2/);
  assert.match(source, /px-2(?:\.5)?/);
  assert.match(source, /mobile-touch-target/);
});
