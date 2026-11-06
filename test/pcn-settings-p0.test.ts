import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fetchBackupList } from '../utils/backupApi.ts';
import {
  canManageSystemUser,
  canManageSystemUsers,
  canReadPcnUserDirectory,
  canSetSystemUserRole,
  canViewSystemSettings,
  isSystemSettingsAdmin,
  isSystemSettingsManager,
} from '../utils/systemSettingsPolicy.ts';

test('backup listing sends same-origin credentials and no x-user-name header', async () => {
  const originalFetch = globalThis.fetch;
  let captured: { url: string; credentials?: RequestCredentials; headers: Headers } | null = null;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    captured = {
      url: String(input),
      credentials: init?.credentials,
      headers: new Headers(init?.headers),
    };
    return new Response(JSON.stringify({ items: [], pgToolAvailable: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  try {
    await fetchBackupList();
    assert.ok(captured, 'fetch should have been called');
    assert.equal(captured.credentials, 'same-origin');
    assert.equal(captured.headers.has('x-user-name'), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('backup API errors retain HTTP status for the Settings error panel', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ error: 'Route not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;

  try {
    await assert.rejects(fetchBackupList(), (error: any) => error.status === 404);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('role-safe system settings policy: admin, manager, staff, viewer', () => {
  const adminUser = { username: 'admin', systemRole: 'admin', role: 'admin' };
  const inactiveAdmin = { username: 'inactive-admin', systemRole: 'admin', role: 'admin', active: false };
  const managerUser = { username: 'manager', systemRole: 'staff', role: 'user', managementRoleCode: 'DEPARTMENT_HEAD', departmentScopes: ['PCN', 'PGD'], active: true };
  const underScopedManager = { username: 'under-scoped-manager', systemRole: 'staff', role: 'user', managementRoleCode: 'DEPARTMENT_HEAD', departmentScopes: ['PCN'], active: true };
  const viewerLeader = { username: 'viewer-leader', systemRole: 'viewer', role: 'viewer', managementRoleCode: 'DEPARTMENT_HEAD', departmentScopes: ['PCN', 'PGD'], active: true };
  const staffUser = { username: 'staff', systemRole: 'staff', role: 'user', managementRoleCode: 'NONE' };
  const viewerUser = { username: 'viewer', systemRole: 'viewer', role: 'user', managementRoleCode: 'NONE' };

  assert.equal(isSystemSettingsAdmin(adminUser as any), true);
  assert.equal(canViewSystemSettings(adminUser as any), true);
  assert.equal(canViewSystemSettings(inactiveAdmin as any), false, 'inactive Admin sessions cannot open settings');
  assert.equal(canManageSystemUsers(inactiveAdmin as any), false, 'inactive Admin sessions cannot mutate user records');

  assert.equal(isSystemSettingsAdmin(managerUser as any), false);
  assert.equal(isSystemSettingsManager(managerUser as any), true);
  assert.equal(canViewSystemSettings(managerUser as any), true);
  assert.equal(canManageSystemUsers(managerUser as any), true);

  assert.equal(isSystemSettingsManager(underScopedManager as any), false, 'a manager without both required scopes cannot open shared settings');
  assert.equal(canViewSystemSettings(underScopedManager as any), false);
  assert.equal(canManageSystemUsers(underScopedManager as any), false);
  assert.equal(canViewSystemSettings(viewerLeader as any), false, 'viewer role cannot escalate through leadership metadata');

  assert.equal(isSystemSettingsAdmin(staffUser as any), false);
  assert.equal(isSystemSettingsManager(staffUser as any), false);
  assert.equal(canViewSystemSettings(staffUser as any), false);

  assert.equal(isSystemSettingsAdmin(viewerUser as any), false);
  assert.equal(isSystemSettingsManager(viewerUser as any), false);
  assert.equal(canViewSystemSettings(viewerUser as any), false);
});

test('scoped managers may maintain ordinary accounts but cannot assign or manage elevated roles', () => {
  const manager = { systemRole: 'staff', role: 'user', managementRoleCode: 'DEPARTMENT_HEAD', departmentScopes: ['PCN', 'PGD'], active: true };
  const ordinaryStaff = { systemRole: 'staff', role: 'user', managementRoleCode: 'NONE', departmentScopes: ['PCN'], active: true };
  const admin = { systemRole: 'admin', role: 'admin', managementRoleCode: 'NONE', departmentScopes: ['PCN', 'PGD'], active: true };
  const leader = { systemRole: 'staff', role: 'user', managementRoleCode: 'DEPARTMENT_DEPUTY', departmentScopes: ['PCN', 'PGD'], active: true };

  assert.equal(canReadPcnUserDirectory(ordinaryStaff as any), true);
  assert.equal(canReadPcnUserDirectory({ systemRole: 'staff', departmentScopes: ['PGD'] } as any), false);
  assert.equal(canReadPcnUserDirectory(null), false);
  assert.equal(canManageSystemUser(manager as any, ordinaryStaff as any), true);
  assert.equal(canManageSystemUser(manager as any, admin as any), false);
  assert.equal(canManageSystemUser(manager as any, leader as any), false);
  assert.equal(canSetSystemUserRole(manager as any, ordinaryStaff as any), true);
  assert.equal(canSetSystemUserRole(manager as any, admin as any), false);
  assert.equal(canSetSystemUserRole(manager as any, leader as any), false);
  assert.equal(canSetSystemUserRole(admin as any, admin as any), true);
});

test('PCN user-directory GET requires an active session and PCN scope before reading the directory', () => {
  const routeSource = readFileSync(new URL('../app/api/pcn/users/route.ts', import.meta.url), 'utf8');
  const guardIndex = routeSource.indexOf('requirePcnSession(request)');
  const scopeIndex = routeSource.indexOf('canReadPcnUserDirectory(actor)');
  const readIndex = routeSource.indexOf('fetchPcnUsers()');

  assert.match(routeSource, /export async function GET\(request: NextRequest\)/);
  assert.ok(guardIndex >= 0 && scopeIndex > guardIndex && readIndex > scopeIndex, 'session and PCN-scope checks must precede the user-directory read');
  assert.match(routeSource, /departmentScopes\?\.includes\('PCN'\)/, 'PCN response must not expose PGD-only users');
});

test('PCN user mutation routes enforce scoped target access and block Manager privilege promotion', () => {
  const createSource = readFileSync(new URL('../app/api/pcn/users/route.ts', import.meta.url), 'utf8');
  const updateSource = readFileSync(new URL('../app/api/pcn/users/[id]/route.ts', import.meta.url), 'utf8');
  const resetSource = readFileSync(new URL('../app/api/pcn/users/[id]/reset-password/route.ts', import.meta.url), 'utf8');

  assert.match(createSource, /canSetSystemUserRole\(actor, validation\.data\)/);
  assert.match(updateSource, /canManageSystemUser\(actor, existingUser\)/);
  assert.match(updateSource, /canSetSystemUserRole\(actor, validation\.data\)/);
  assert.match(resetSource, /canManageSystemUser\(actor, existingUser\)/);
  assert.match(updateSource, /if \(error\?\.statusCode === 403\)/);
  assert.match(resetSource, /if \(error\?\.statusCode === 403\)/);
});

test('PgdcnSystemSettingsView implements responsive accessible role-gated tabs and lazy backup mounting', () => {
  const settingsSource = readFileSync(new URL('../components/PgdcnSystemSettingsView.tsx', import.meta.url), 'utf8');

  // Must have role="tablist" accessible tabs
  assert.match(settingsSource, /role="tablist"/);
  assert.match(settingsSource, /role="tab"/);
  assert.match(settingsSource, /aria-selected=/);
  assert.match(settingsSource, /aria-controls=/);
  assert.match(settingsSource, /role=\{isAdmin \? 'tabpanel' : undefined\}/);
  assert.match(settingsSource, /aria-labelledby=\{isAdmin \? 'tab-personnel' : undefined\}/);

  // Tab labels
  assert.match(settingsSource, /Nhân sự & phân quyền|Nhân sự &amp; phân quyền/);
  assert.match(settingsSource, /Sao lưu & dữ liệu|Sao lưu &amp; dữ liệu/);

  // Admin tabs must not be mobile-only (no md:hidden on tab container)
  assert.doesNotMatch(settingsSource, /role="tablist"[\s\S]*?md:hidden/);

  // Lazy loading backup panel: unmounted until selected, retained while hidden
  assert.match(settingsSource, /backupMounted/);
  assert.doesNotMatch(settingsSource, /hidden md:block[\s\S]*?<BackupRestoreAdminPanel/);

  // Explicit denied state for unauthorized users
  assert.match(settingsSource, /Tài khoản hiện tại không có quyền xem Cài đặt hệ thống/);
});

test('BackupRestoreAdminPanel renders visible loading, empty, HTTP error, network error, and retry states', () => {
  const panelSource = readFileSync(new URL('../components/BackupRestoreAdminPanel.tsx', import.meta.url), 'utf8');

  // Must not pass username to fetchBackupList
  assert.doesNotMatch(panelSource, /fetchBackupList\(username\)/);

  // Visible loading state
  assert.match(panelSource, /Đang tải danh sách bản sao lưu/);

  // Visible empty state
  assert.match(panelSource, /Chưa có bản sao lưu/);

  // Visible error state with HTTP 401/403/404 or network and retry button
  assert.match(panelSource, /401|403|404|Lỗi kết nối|Thử lại/);
  assert.match(panelSource, /onClick=\{.*loadBackups.*\}/);
  const tableErrorRow = panelSource.match(/loadError \? \(\s*<tr>([\s\S]*?)<\/tr>/)?.[1] || '';
  assert.doesNotMatch(tableErrorRow, /<button|Thử lại/, 'the table should not duplicate the retry action already shown in the error banner');
});
