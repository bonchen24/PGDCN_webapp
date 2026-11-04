import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('shared shell owns department dashboard, assistant and activity surfaces', () => {
  const source = read('../components/PgdcnAppShell.tsx');
  for (const marker of ['PgdcnSidebar', 'PgdcnDashboardView', 'PgdcnAssistantView', 'ActivityLogView', 'initialDomain', 'department-dashboard', 'activityLogs']) {
    assert.ok(source.includes(marker), `Missing shared shell marker: ${marker}`);
  }
});

test('shared sidebar renders both domain groups from department scopes', () => {
  const source = read('../components/PgdcnSidebar.tsx');
  for (const marker of ['Tổng quan', 'Trợ lý AI', 'Nhật ký hệ thống', "section: 'activityLogs'", 'aria-label="Chứng nhận PCN"', 'aria-label="Giám định PGD"', 'departmentScopes', 'aria-current', 'mobile-touch-target']) {
    assert.ok(source.includes(marker), `Missing shared sidebar marker: ${marker}`);
  }
  assert.doesNotMatch(source, /Cài đặt PCN|Cài đặt PGD/);
});

test('shared system settings remains available without a PGD settings route', () => {
  const source = read('../components/PgdcnAppShell.tsx');
  assert.match(source, /domain: 'department', section: 'system-settings'/);
  assert.doesNotMatch(source, /if \(section === 'settings'\)/);
});

test('department dashboard exposes four KPI stats strip, domain cards and a shared activity entrypoint', () => {
  const source = read('../components/PgdcnDashboardView.tsx');
  for (const marker of ['data-testid="pgdcn-dashboard-kpi-grid"', 'Việc cần làm', 'Hồ sơ đang xử lý', 'Chờ phê duyệt', 'Hồ sơ quá hạn', 'Việc cần chú ý']) {
    assert.ok(source.includes(marker), `Missing dashboard marker: ${marker}`);
  }
  assert.doesNotMatch(source, /Nhật ký hoạt động/);
  assert.match(source, /min-w-0/);
  assert.match(source, /grid-cols-2/);
  assert.match(source, /mobile-scroll-y|mobile-scroll-x/);
  assert.match(source, /Mở workspace|Mở danh sách|Tạo Đề nghị|Tạo PYC/);
});

test('shared shell exposes a readable active context for the current target', () => {
  const source = read('../components/PgdcnAppShell.tsx');
  assert.match(source, /activeTarget\.section/);
  assert.match(source, /getActiveContextLabel\(activeTarget\)/);
  assert.match(source, /aria-label/);
});

test('domain workspaces support embedded mode and shared-shell section control', () => {
  const pcn = read('../components/PcnWorkspace.tsx');
  const pgd = read('../components/PgdWorkspace.tsx');
  for (const source of [pcn, pgd]) {
    assert.match(source, /embedded/);
    assert.match(source, /initialSection/);
    assert.match(source, /onActiveSectionChange/);
  }
});

test('shared shell provides mobile navigation, sync status and explicit domain context', () => {
  const shell = read('../components/PgdcnAppShell.tsx');
  const sidebar = read('../components/PgdcnSidebar.tsx');
  const dashboard = read('../components/PgdcnDashboardView.tsx');
  const pcnWorkspace = read('../components/PcnWorkspace.tsx');
  const pgdWorkspace = read('../components/PgdWorkspace.tsx');
  assert.match(shell, /pgdcn-mobile-nav/);
  assert.match(shell, /aria-label=.*PCN.*PGD/);
  assert.match(shell, /id="pgdcn-main-content" tabIndex=\{-1\}/);
  assert.match(shell, /<span className="sr-only" aria-live="polite" aria-atomic="true">\{getActiveContextLabel\(activeTarget\)\}<\/span>/);
  assert.match(dashboard, /mobile-safe-bottom/);
  assert.match(pcnWorkspace, /mobile-safe-bottom/);
  assert.match(pgdWorkspace, /data-testid="pgd-dossier-mobile-footer" className="mobile-safe-bottom/);
  assert.ok(sidebar.includes('border-slate-200'));
  assert.ok(sidebar.includes('aria-label='));
});
