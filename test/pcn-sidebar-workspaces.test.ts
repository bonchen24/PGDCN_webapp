import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  getPcnMoreNavigationGroups,
  PCN_MORE_NAVIGATION_GROUPS,
  PCN_WORKSPACE_NAVIGATION,
} from '../utils/pcnNavigation.ts';

const sidebarSource = fs.readFileSync(new URL('../components/PcnSidebar.tsx', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('PCN exposes the core workspaces directly and keeps secondary modules under one More menu', () => {
  assert.deepEqual(PCN_WORKSPACE_NAVIGATION, [
    'dashboard',
    'proposals',
    'fields',
    'samples',
    'labRequests',
    'results',
    'issuance',
    'archive',
    'agent',
  ]);
  assert.equal(PCN_MORE_NAVIGATION_GROUPS.length, 2);
  assert.match(sidebarSource, /PCN_WORKSPACE_NAVIGATION\.map/);
  assert.match(sidebarSource, /Thêm/);
  assert.match(sidebarSource, /aria-label=\{sectionLabels\[section\]\}/);
  assert.doesNotMatch(sidebarSource, /renderGroup/);
  assert.doesNotMatch(sidebarSource, /expandedGroup/);
});

test('PCN More menu hides only admin-only sections for non-admin users', () => {
  const adminItems = getPcnMoreNavigationGroups(true).flatMap((group) => group.items);
  const staffItems = getPcnMoreNavigationGroups(false).flatMap((group) => group.items);

  assert.ok(adminItems.includes('backup'));
  assert.ok(adminItems.includes('cutover'));
  assert.equal(staffItems.includes('backup'), false);
  assert.equal(staffItems.includes('cutover'), false);
  assert.ok(staffItems.includes('customers'));
  assert.ok(staffItems.includes('activityLogs'));
});

test('the direct dossier workspace is named for the work users perform', () => {
  assert.match(workspaceSource, /fields:\s*'Hồ sơ'/);
  assert.match(workspaceSource, /<h1[^>]*>Hồ sơ chứng nhận<\/h1>/);
  assert.doesNotMatch(workspaceSource, /fields:\s*'Lĩnh vực'/);
});

// --- End of pcn-sidebar-workspaces.test.ts ---
