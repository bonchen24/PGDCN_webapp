// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for the system activity log page and sidebar routing

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const readSource = (path: string): string => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('activity log view exposes filters, details, pagination, and CSV export without delete controls', () => {
  const source = readSource('../components/ActivityLogView.tsx');
  for (const label of [
    'Nhật ký hệ thống',
    'Người thực hiện',
    'Hành động',
    'Đối tượng',
    'Kỳ thống kê',
    'Ngày',
    'Tuần',
    'Tháng',
    'Năm',
    'Tải thêm',
    'Xuất CSV',
    'Trước thay đổi',
    'Sau thay đổi',
  ]) {
    assert.ok(source.includes(label), `Missing activity view label: ${label}`);
  }
  assert.doesNotMatch(source, /Từ ngày|Đến ngày|type="date"/);
  assert.doesNotMatch(source, /deleteActivityLog|deleteDocFromPostgres\(['"]activityLogs['"]/);
});

test('App places activity log immediately before system settings and renders the view', () => {
  const source = readSource('../App.tsx');
  const activityIndex = source.indexOf("id: 'activity_log'");
  const settingsIndex = source.indexOf("id: 'system_settings'");
  assert.ok(activityIndex >= 0);
  assert.ok(settingsIndex > activityIndex);
  assert.match(source, /<ActivityLogView\s*\/>/);
});

test('authenticated app shell uses compact density and labels the activity log page', () => {
  const source = readSource('../App.tsx');
  assert.match(source, /className="[^"]*ddt-compact/);
  assert.match(source, /activeTab === 'activity_log' && 'Nhật ký hệ thống'/);
});

test('App exposes activity log in both sidebars without an admin-only role gate', () => {
  const source = readSource('../App.tsx');
  const entries = source.match(/id: ['"]activity_log['"][^\n]*/g) || [];
  assert.equal(entries.length, 2);
  assert.ok(entries.every(entry => !entry.includes("roles: ['admin']")));
});

test('activity log view exposes multi-user KPI controls and GMT+7 charts', () => {
  const source = readSource('../components/ActivityLogView.tsx');
  for (const marker of [
    'Chọn người dùng',
    'Chọn tất cả',
    'Bỏ chọn tất cả',
    'Biểu đồ KPI',
    'Tổng thao tác',
    'Phiếu tạo',
    'Mẫu xử lý',
    'Biên bản tạo',
    'GMT+7',
    'type="checkbox"',
    'fetchSummary',
  ]) {
    assert.ok(source.includes(marker), `Missing KPI UI marker: ${marker}`);
  }
  assert.match(source, /aria-label="Danh sách KPI nhân viên"/);
});

test('activity log view uses the month as the default shared activity period', () => {
  const source = readSource('../components/ActivityLogView.tsx');
  assert.match(source, /DEFAULT_ACTIVITY_PERIOD/);
  assert.match(source, /getActivityPeriodBounds/);
  assert.match(source, /period: DEFAULT_ACTIVITY_PERIOD/);
  assert.match(source, /from: periodBounds\.from/);
  assert.match(source, /to: periodBounds\.to/);
});

test('activity log view ignores stale log and KPI responses after filter changes', () => {
  const source = readSource('../components/ActivityLogView.tsx');
  assert.match(source, /useRef/);
  assert.match(source, /logRequestSequence/);
  assert.match(source, /kpiRequestSequence/);
});

test('activity log view provides a vertical scroll surface for filters and KPI content', () => {
  const source = readSource('../components/ActivityLogView.tsx');
  assert.match(source, /<section className="h-full min-h-0 flex flex-col bg-slate-50 p-3 sm:p-5 overflow-y-auto/);
  assert.match(source, /mt-3 min-h-0 flex-1 overflow-auto/);
});

test('activity KPI uses a compact responsive stacked-bar ranking for many employees', () => {
  const source = readSource('../components/ActivityLogView.tsx');
  assert.match(source, /aria-label="Danh sách KPI nhân viên"/);
  assert.match(source, /role="list"/);
  assert.match(source, /overflow-y-auto[^\n]*max-h/);
  assert.match(source, /min-w-0/);
  for (const label of ['Phiếu', 'KQTN', 'Biên bản', 'Lịch', 'Khác']) {
    assert.ok(source.includes(label), `Missing stacked KPI legend: ${label}`);
  }
  assert.doesNotMatch(source, /min-w-\[620px\]/);
});

test('activity log keeps mobile filters collapsible and content above the bottom navigation', () => {
  const source = readSource('../components/ActivityLogView.tsx');
  assert.match(source, /Bộ lọc/);
  assert.match(source, /aria-expanded=\{isFiltersOpen\}/);
  assert.match(source, /mobile-safe-bottom/);
  assert.match(source, /grid-cols-2/);
});

// --- End of activity-log-ui.test.ts ---
