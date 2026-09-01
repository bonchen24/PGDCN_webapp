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

test('PCN exposes operational workspaces and keeps personnel management in Admin', () => {
  assert.deepEqual(PCN_WORKSPACE_NAVIGATION, [
    'dashboard',
    'proposals',
    'operations',
    'lab-operations',
    'drafting',
    'assistant',
    'customers',
  ]);
  assert.equal(PCN_MORE_NAVIGATION_GROUPS.length, 1);
  assert.deepEqual(PCN_MORE_NAVIGATION_GROUPS[0].items, ['users', 'settings']);
  assert.match(sidebarSource, /PCN_WORKSPACE_NAVIGATION\.map/);
  assert.match(sidebarSource, /Quản trị/);
  assert.match(sidebarSource, /aria-label=\{sectionLabels\[section\]\}/);
  assert.match(sidebarSource, /moreSections\.map\(renderSectionButton\)/);
  assert.doesNotMatch(sidebarSource, /group\.label/);
  assert.doesNotMatch(sidebarSource, /renderGroup/);
  assert.doesNotMatch(sidebarSource, /expandedGroup/);
});

test('PCN administration surfaces are visible only to Admin', () => {
  const adminItems = getPcnMoreNavigationGroups(true).flatMap((group) => group.items);
  const staffItems = getPcnMoreNavigationGroups(false).flatMap((group) => group.items);

  assert.deepEqual(adminItems, ['users', 'settings']);
  assert.deepEqual(staffItems, []);
});

test('the direct dossier workspace is named for the work users perform', () => {
  assert.match(workspaceSource, /proposals:\s*'Đề nghị'/);
  assert.match(workspaceSource, /<h1[^>]*>Quản lý Đề nghị<\/h1>/);
  assert.doesNotMatch(workspaceSource, /fields:\s*'/);
});

// --- End of pcn-sidebar-workspaces.test.ts ---
