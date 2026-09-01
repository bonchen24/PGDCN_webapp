import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { isActivityLogVisibleToUser } from '../utils/activityLog.ts';
import { getPcnMoreNavigationGroups } from '../utils/pcnNavigation.ts';

const activitySource = fs.readFileSync(new URL('../components/ActivityLogView.tsx', import.meta.url), 'utf8');
const sidebarSource = fs.readFileSync(new URL('../components/PcnSidebar.tsx', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('PCN ActivityLogs is available to staff and stays before settings', () => {
  assert.deepEqual(getPcnMoreNavigationGroups(true).flatMap((group) => group.items), ['users', 'activityLogs', 'settings']);
  assert.deepEqual(getPcnMoreNavigationGroups(false).flatMap((group) => group.items), ['activityLogs']);
  assert.match(sidebarSource, /activityLogs/);
  assert.match(workspaceSource, /import .*ActivityLogView/);
  assert.match(workspaceSource, /activeSection === 'activityLogs'/);
  assert.match(workspaceSource, /<ActivityLogView currentUser=\{currentUser\} systemUsers=\{pcn\.users\} \/>/);
});

test('ActivityLogs remains read-only and PCN users can view it', () => {
  assert.match(activitySource, /fetchPage/);
  assert.match(activitySource, /fetchSummary/);
  assert.doesNotMatch(activitySource, /deleteActivityLog|deleteDocFromPostgres\(['"]activityLogs['"]\)/);
  assert.equal(isActivityLogVisibleToUser({ role: 'staff', systemRole: 'staff' } as any), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'viewer', systemRole: 'viewer' } as any), true);
});

