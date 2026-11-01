import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getPgdcnVisibleNavigation,
  getActiveContextLabel,
  getPgdcnNavigationTargetForLocation,
  type PgdcnNavigationItem,
} from '../utils/pgdcnNavigation.ts';
import type { PcnUserAccount } from '../types.ts';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('all 13 authorized destinations are exposed for a dual-scope admin/manager user', () => {
  const adminUser: PcnUserAccount = {
    username: 'admin_test',
    name: 'Admin Test',
    role: 'admin',
    systemRole: 'admin',
    departmentRoleCode: 'LEADERSHIP',
    fieldCodes: ['QC4'],
    active: true,
    departmentScopes: ['PCN', 'PGD'],
    managementRoleCode: 'CENTER_DIRECTOR',
    professionalRoleCodes: ['CERTIFICATION_EXPERT'],
  };

  const nav = getPgdcnVisibleNavigation(['PCN', 'PGD'], adminUser);
  const labels = nav.map((item) => item.label);

  assert.equal(nav.length, 13, 'Expected exactly 13 authorized destinations');
  assert.deepEqual(labels, [
    // 5 shared
    'Tổng quan',
    'Khách hàng',
    'Trợ lý AI',
    'Nhật ký hệ thống',
    'Soạn thảo văn bản',
    // 3 PCN
    'Chứng nhận',
    'Sổ dữ liệu PCN',
    'Sổ quản lý mẫu PCN',
    // 3 PGD
    'Giám định',
    'Sổ dữ liệu PGD',
    'Sổ quản lý mẫu PGD',
    // 2 conditional
    'Hồ sơ mẫu',
    'Cài đặt hệ thống',
  ]);

  // Check unique IDs and keys
  const ids = nav.map((item) => item.id);
  assert.equal(new Set(ids).size, 13, 'All 13 destination IDs must be unique');
  assert.ok(ids.includes('activityLogs'), 'Shared activity key must be activityLogs');
  assert.ok(ids.includes('dossier-templates'), 'Must include dossier-templates');
  assert.ok(ids.includes('system-settings'), 'Must include system-settings');
});

test('single-scope PCN user receives 8 destinations with full domain-qualified labels and no unearned admin entries', () => {
  const pcnStaff: PcnUserAccount = {
    username: 'pcn_staff',
    name: 'PCN Staff',
    role: 'staff',
    systemRole: 'staff',
    departmentRoleCode: 'CERTIFICATION_EXPERT',
    fieldCodes: ['QC4'],
    active: true,
    departmentScopes: ['PCN'],
    managementRoleCode: undefined,
    professionalRoleCodes: ['CERTIFICATION_EXPERT'],
  };

  const nav = getPgdcnVisibleNavigation(['PCN'], pcnStaff);
  const labels = nav.map((item) => item.label);

  assert.equal(nav.length, 8, 'Expected exactly 8 destinations for single-scope PCN staff');
  assert.deepEqual(labels, [
    'Tổng quan',
    'Khách hàng',
    'Trợ lý AI',
    'Nhật ký hệ thống',
    'Soạn thảo văn bản',
    'Chứng nhận',
    'Sổ dữ liệu PCN',
    'Sổ quản lý mẫu PCN',
  ]);

  // Ensure no PGD, no dossier-templates, no system-settings
  assert.equal(labels.includes('Giám định'), false);
  assert.equal(labels.includes('Sổ dữ liệu PGD'), false);
  assert.equal(labels.includes('Hồ sơ mẫu'), false);
  assert.equal(labels.includes('Cài đặt hệ thống'), false);
});

test('single-scope PGD user receives 8 destinations with full domain-qualified labels', () => {
  const pgdStaff: PcnUserAccount = {
    username: 'pgd_staff',
    name: 'PGD Staff',
    role: 'staff',
    systemRole: 'staff',
    departmentRoleCode: 'CERTIFICATION_EXPERT',
    fieldCodes: ['QC4'],
    active: true,
    pgdRole: 'PGD_FIELD_INSPECTOR',
    departmentScopes: ['PGD'],
    managementRoleCode: undefined,
    professionalRoleCodes: ['INSPECTION_EXPERT'],
  };

  const nav = getPgdcnVisibleNavigation(['PGD'], pgdStaff);
  const labels = nav.map((item) => item.label);

  assert.equal(nav.length, 8, 'Expected exactly 8 destinations for single-scope PGD staff');
  assert.deepEqual(labels, [
    'Tổng quan',
    'Khách hàng',
    'Trợ lý AI',
    'Nhật ký hệ thống',
    'Soạn thảo văn bản',
    'Giám định',
    'Sổ dữ liệu PGD',
    'Sổ quản lý mẫu PGD',
  ]);
});

test('eligible PCN/PGD manager sees Hồ sơ mẫu without system-settings', () => {
  const pgdManager: PcnUserAccount = {
    username: 'pgd_manager',
    name: 'PGD Manager',
    role: 'staff',
    systemRole: 'staff',
    departmentRoleCode: 'CERTIFICATION_EXPERT',
    fieldCodes: ['QC4'],
    active: true,
    pgdRole: 'PGD_MANAGER',
    departmentScopes: ['PGD'],
    managementRoleCode: undefined,
    professionalRoleCodes: ['INSPECTION_EXPERT'],
  };

  const nav = getPgdcnVisibleNavigation(['PGD'], pgdManager);
  const labels = nav.map((item) => item.label);

  assert.ok(labels.includes('Hồ sơ mẫu'), 'Eligible manager must see Hồ sơ mẫu');
  assert.equal(labels.includes('Cài đặt hệ thống'), false, 'Non-admin manager should not see Cài đặt hệ thống');
});

test('getActiveContextLabel aligns 100% with exact sidebar destination labels', () => {
  assert.equal(getActiveContextLabel({ domain: 'department', section: 'department-dashboard' }), 'Tổng quan');
  assert.equal(getActiveContextLabel({ domain: 'department', section: 'customers' }), 'Khách hàng');
  assert.equal(getActiveContextLabel({ domain: 'department', section: 'assistant' }), 'Trợ lý AI');
  assert.equal(getActiveContextLabel({ domain: 'department', section: 'activityLogs' }), 'Nhật ký hệ thống');
  assert.equal(getActiveContextLabel({ domain: 'department', section: 'document-drafting' }), 'Soạn thảo văn bản');
  assert.equal(getActiveContextLabel({ domain: 'department', section: 'dossier-templates' }), 'Hồ sơ mẫu');
  assert.equal(getActiveContextLabel({ domain: 'department', section: 'system-settings' }), 'Cài đặt hệ thống');

  assert.equal(getActiveContextLabel({ domain: 'PCN', section: 'proposals' }), 'Chứng nhận');
  assert.equal(getActiveContextLabel({ domain: 'PCN', section: 'operations' }), 'Sổ dữ liệu PCN');
  assert.equal(getActiveContextLabel({ domain: 'PCN', section: 'lab-operations' }), 'Sổ quản lý mẫu PCN');

  assert.equal(getActiveContextLabel({ domain: 'PGD', section: 'requests' }), 'Giám định');
  assert.equal(getActiveContextLabel({ domain: 'PGD', section: 'operations' }), 'Sổ dữ liệu PGD');
  assert.equal(getActiveContextLabel({ domain: 'PGD', section: 'sample-operations' }), 'Sổ quản lý mẫu PGD');
});

test('browser history restores only valid PGDCN menu sections and defaults invalid query values safely', () => {
  assert.deepEqual(getPgdcnNavigationTargetForLocation('/pgdcn', '?section=customers'), {
    domain: 'department', section: 'customers',
  });
  assert.deepEqual(getPgdcnNavigationTargetForLocation('/pgdcn/pcn', '?section=lab-operations'), {
    domain: 'PCN', section: 'lab-operations',
  });
  assert.deepEqual(getPgdcnNavigationTargetForLocation('/pgdcn/pgd', '?section=sample-operations'), {
    domain: 'PGD', section: 'sample-operations',
  });
  assert.deepEqual(getPgdcnNavigationTargetForLocation('/pgdcn/pgd', '?section=not-a-section'), {
    domain: 'PGD', section: 'requests',
  });
  assert.deepEqual(getPgdcnNavigationTargetForLocation('/pgdcn', '?section=not-a-section'), {
    domain: 'department', section: 'department-dashboard',
  });
  assert.equal(getPgdcnNavigationTargetForLocation('/unrelated'), undefined);
});

test('App Router page components resolve searchParams Promises and forward initialSection', () => {
  const landingPage = read('../app/pgdcn/page.tsx');
  const pcnPage = read('../app/pgdcn/pcn/page.tsx');
  const pgdPage = read('../app/pgdcn/pgd/page.tsx');
  const draftingPage = read('../app/pgdcn/drafting/page.tsx');

  assert.match(landingPage, /searchParams\?:\s*Promise/);
  assert.match(landingPage, /initialDepartmentSection/);

  assert.match(pcnPage, /searchParams\?:\s*Promise/);
  assert.match(pcnPage, /initialPcnSection/);
  assert.match(pcnPage, /operations|proposals|lab-operations/);

  assert.match(pgdPage, /searchParams\?:\s*Promise/);
  assert.match(pgdPage, /initialPgdSection/);
  assert.match(pgdPage, /requests|operations|sample-operations/);

  assert.match(draftingPage, /PgdcnAppShell/);
});

test('PgdcnAppShell uses push history from dossier routes and handles browser popstate', () => {
  const shell = read('../components/PgdcnAppShell.tsx');

  // Push history from canonical dossier routes
  assert.match(shell, /router\.push/);
  // URL state synchronization and popstate listener
  assert.match(shell, /popstate/);
  assert.match(shell, /window\.history\.pushState/);
  // Main content focus restoration
  assert.match(shell, /pgdcn-main-content/);
  assert.match(shell, /getPgdcnNavigationTargetForLocation\(window\.location\.pathname, window\.location\.search\)/);
  assert.match(shell, /navigationFocusPending/);
  // Closes notification dropdown on navigation
  assert.match(shell, /setNotificationOpen\(false\)/);
});

test('mobile sidebar navigation returns focus to main content after closing the drawer', () => {
  const sidebar = read('../components/PgdcnSidebar.tsx');
  assert.match(sidebar, /if \(mobileOpen\) returnFocusRef\.current = document\.getElementById\('pgdcn-main-content'\)/);
  assert.match(sidebar, /const handleNavigation = \(target: PgdcnNavigationTarget\)/);
});

test('PgdcnSidebar renders full domain-qualified labels unconditionally', () => {
  const sidebar = read('../components/PgdcnSidebar.tsx');

  assert.match(sidebar, /Sổ dữ liệu PCN/);
  assert.match(sidebar, /Sổ quản lý mẫu PCN/);
  assert.match(sidebar, /Sổ dữ liệu PGD/);
  assert.match(sidebar, /Sổ quản lý mẫu PGD/);
  assert.doesNotMatch(sidebar, /hasBothScopes \? 'Sổ dữ liệu PCN' : 'Sổ dữ liệu'/);
  assert.doesNotMatch(sidebar, /hasBothScopes \? 'Sổ dữ liệu PGD' : 'Sổ dữ liệu'/);
});
