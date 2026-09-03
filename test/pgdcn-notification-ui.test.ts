import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('shared notification dropdown exposes one accessible PCN and PGD feed', () => {
  const source = read('../components/PgdcnNotificationDropdown.tsx');
  for (const marker of ['Bell', 'aria-label', 'PCN', 'PGD', 'Đánh dấu đã đọc', 'Đọc tất cả', 'Xóa thông báo', 'targetUsernames', 'slice(0, 50)']) {
    assert.ok(source.includes(marker), `Missing shared notification marker: ${marker}`);
  }
  assert.match(source, /onSelect\(notification\)/);
  assert.doesNotMatch(source, /createPgdcnNotificationClient|fetchPgdcnNotifications/);
});

test('shared shell owns one notification feed and dispatches both domain targets', () => {
  const source = read('../components/PgdcnAppShell.tsx');
  for (const marker of ['fetchPgdcnNotifications', 'PgdcnNotificationDropdown', 'notifications', 'notificationOpen', 'onOpenNotifications', 'domain === \'PCN\'', 'domain === \'PGD\'']) {
    assert.ok(source.includes(marker), `Missing shell notification marker: ${marker}`);
  }
  assert.match(source, /notifications=\{notifications\}/);
});

test('shared shell refreshes notifications when the common feed is opened', () => {
  const source = read('../components/PgdcnAppShell.tsx');
  for (const marker of ['refreshPgdcnNotifications', 'handleOpenNotifications', 'handleToggleNotifications', 'onOpenNotifications=\{handleOpenNotifications\}', 'onToggle=\{handleToggleNotifications\}']) {
    assert.ok(source.includes(marker), `Missing notification refresh marker: ${marker}`);
  }
});

test('department dashboard renders one shared notification card', () => {
  const source = read('../components/PgdcnDashboardView.tsx');
  for (const marker of ['Thông báo phòng', 'data-testid="pgdcn-dashboard-notifications"', 'PCN', 'PGD', 'onOpenNotifications', 'onSelectNotification', 'Chưa có thông báo phòng']) {
    assert.ok(source.includes(marker), `Missing dashboard notification marker: ${marker}`);
  }
  assert.match(source, /notifications\.slice\(0, 5\)/);
  assert.match(source, /notification\.read/);
});
