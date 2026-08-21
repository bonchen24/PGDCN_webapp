// Author: Gemini
// OS support: Web/Node
// Description: Regression contracts for system settings permissions and backup flows

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const systemSettingsSource = fs.readFileSync(new URL('../components/SystemManagementViews.tsx', import.meta.url), 'utf8');
const settingsModalSource = fs.readFileSync(new URL('../components/SettingsModal.tsx', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');
const backupReminderSource = fs.readFileSync(new URL('../components/AdminBackupReminder.tsx', import.meta.url), 'utf8');

test('system settings separates admin-only actions from manager operational actions', () => {
  assert.match(systemSettingsSource, /isSystemSettingsAdmin/);
  assert.match(systemSettingsSource, /isSystemSettingsManager/);
  assert.match(systemSettingsSource, /isAdminOnlyAction/);
});

test('system settings backup uses the complete backup payload and includes activity logs', () => {
  assert.match(systemSettingsSource, /buildBackupPayload\(/);
  assert.match(systemSettingsSource, /activityLogClient\.fetchAll\(\)/);
  assert.match(systemSettingsSource, /activityLogsCount/);
  assert.match(systemSettingsSource, /notificationsCount/);
  assert.match(settingsModalSource, /buildBackupPayload\(/);
});

test('system settings accepts configuration-only backups', () => {
  assert.match(systemSettingsSource, /systemUsersCount/);
  assert.match(systemSettingsSource, /settingsCount/);
  assert.doesNotMatch(
    systemSettingsSource,
    /requestsCount === 0 && handoverDocsCount === 0 && customersCount === 0 && kqtnRecordsCount === 0/
  );
});

test('system settings refreshes local settings when cloud state changes', () => {
  assert.match(systemSettingsSource, /setLocalSettings\(settings\)/);
});

test('store limits manager updates to operational settings only', () => {
  assert.match(storeSource, /operationalSettingKeys/);
  assert.match(storeSource, /isAdminOnlySetting/);
  assert.match(storeSource, /Không có quyền thay đổi trường thiết lập/);
});

test('admin backup reminder is admin-only and uses the complete backup payload', () => {
  assert.match(backupReminderSource, /const isAdmin = currentUser\?\.role === 'admin';/);
  assert.match(backupReminderSource, /buildBackupPayload\(/);
  assert.match(backupReminderSource, /activityLogClient\.fetchAll\(\)/);
});

test('store protects account lifecycle and restore actions behind the Admin guard', () => {
  assert.match(storeSource, /const requireSystemAdmin/);
  const guardCalls = storeSource.match(/requireSystemAdmin\(get\);/g) || [];
  assert.ok(guardCalls.length >= 5);
});

// --- End of system-settings.test.ts ---
