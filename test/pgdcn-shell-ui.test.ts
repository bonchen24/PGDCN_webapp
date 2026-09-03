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
  for (const marker of ['Tổng quan phòng', 'Trợ lý AI', 'Nhật ký hoạt động', 'CHỨNG NHẬN (PCN)', 'GIÁM ĐỊNH (PGD)', 'departmentScopes', 'aria-current', 'mobile-touch-target']) {
    assert.ok(source.includes(marker), `Missing shared sidebar marker: ${marker}`);
  }
  assert.doesNotMatch(source, /Cài đặt PCN|Cài đặt PGD/);
});

test('domain settings navigation resolves to the shared system settings surface', () => {
  const source = read('../components/PgdcnAppShell.tsx');
  assert.match(source, /section === 'settings'/);
  assert.match(source, /domain: 'department', section: 'system-settings'/);
});

test('department dashboard exposes six KPIs, domain cards and a shared activity entrypoint', () => {
  const source = read('../components/PgdcnDashboardView.tsx');
  for (const marker of ['data-testid="pgdcn-dashboard-kpi-grid"', 'Hồ sơ PCN', 'Hồ sơ PGD', 'PCN cần xử lý', 'PGD cần xử lý', 'Hồ sơ cần AI hỗ trợ', 'Quá hạn / cần chú ý', 'Việc cần chú ý']) {
    assert.ok(source.includes(marker), `Missing dashboard marker: ${marker}`);
  }
  assert.doesNotMatch(source, /Nhật ký hoạt động/);
  assert.match(source, /min-w-0/);
  assert.match(source, /grid-cols-2/);
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
