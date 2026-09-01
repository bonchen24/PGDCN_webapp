import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { PRESET_ACCOUNTS } from '../types.ts';
import {
  createPcnSessionToken,
  toPcnUserAccount,
  verifyPcnSessionToken,
} from '../utils/pcnAuth.ts';
import * as pcnAuth from '../utils/pcnAuth.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const workspaceSource = fs.readFileSync(new URL('../components/PcnWorkspace.tsx', import.meta.url), 'utf8');

test('PCN user snapshot keeps system role, department role and field scope separately', () => {
  const user = toPcnUserAccount({
    documentId: 'tranhoangphuong',
    data: {
      username: 'tranhoangphuong',
      'Họ và Tên': 'Trần Hoàng Phương',
      phone: '0944550789',
      email: 'hoangphuongtvci@gmail.com',
      systemRole: 'staff',
      departmentRoleCode: 'CERTIFICATION_EXPERT',
      fieldCodes: ['QC9'],
      password: 'should-not-leak',
    },
  }) as unknown as Record<string, unknown>;

  assert.equal(user.systemRole, 'staff');
  assert.equal(user.departmentRoleCode, 'CERTIFICATION_EXPERT');
  assert.deepEqual(user.fieldCodes, ['QC9']);
  assert.equal(user.phone, '0944550789');
  assert.equal(user.email, 'hoangphuongtvci@gmail.com');
  assert.equal(user.role, 'staff');
  assert.equal(user.password, undefined);
});

test('DDT guest accounts are mapped to PCN staff without changing the DDT preset list', () => {
  const guest = PRESET_ACCOUNTS.find((account) => account.username === 'tranhoangphuong');
  assert.ok(guest);
  assert.equal(guest.role, 'guest');

  const mapper = (pcnAuth as typeof pcnAuth & {
    mapDdtAccountToPcnUser?: (account: typeof guest) => Record<string, unknown>;
  }).mapDdtAccountToPcnUser;
  assert.equal(typeof mapper, 'function');
  const mapped = mapper!(guest);

  assert.equal(mapped.username, 'tranhoangphuong');
  assert.equal(mapped.systemRole, 'staff');
  assert.equal(mapped.role, 'staff');
  assert.equal(mapped.departmentRoleCode, 'UNASSIGNED');
  assert.equal(mapped.source, 'PCN_INITIAL_IMPORT');
});

test('initial PCN import keeps Luong Xuan Hung as admin and maps all DDT guests to staff', () => {
  const seed = (pcnAuth as typeof pcnAuth & {
    buildInitialPcnUserSeeds?: (accounts: typeof PRESET_ACCOUNTS) => Array<Record<string, unknown>>;
  }).buildInitialPcnUserSeeds;
  assert.equal(typeof seed, 'function');

  const users = seed!(PRESET_ACCOUNTS);
  const hung = users.find((user) => user.username === 'luongxuanhung');
  assert.equal(hung?.systemRole, 'admin');
  assert.equal(hung?.role, 'admin');

  const guestUsernames = PRESET_ACCOUNTS
    .filter((account) => account.role === 'guest' && account.username !== 'nguyenthivananh')
    .map((account) => account.username);
  for (const username of guestUsernames) {
    const imported = users.find((user) => user.username === username);
    assert.equal(imported?.systemRole, 'staff', username);
    assert.notEqual(imported?.departmentRoleCode, 'Khách', username);
  }
  assert.equal(users.some((user) => user.username === 'nguyenthivananh'), false);
});

test('PCN session preserves role separation without exposing password', () => {
  const user = toPcnUserAccount({
    documentId: 'vuthitham',
    data: {
      username: 'vuthitham',
      name: 'Vũ Thị Thắm',
      systemRole: 'staff',
      departmentRoleCode: 'SAMPLE_COORDINATOR',
      fieldCodes: ['QC9'],
    },
  });
  const token = createPcnSessionToken(user, 'pcn-role-secret', 1_000, 60);
  const restored = verifyPcnSessionToken(token, 'pcn-role-secret', 1_500) as unknown as Record<string, unknown>;

  assert.equal(restored.systemRole, 'staff');
  assert.equal(restored.departmentRoleCode, 'SAMPLE_COORDINATOR');
  assert.deepEqual(restored.fieldCodes, ['QC9']);
  assert.equal(restored.password, undefined);
});

test('PCN exposes a separate personnel management surface and never treats users as customers', () => {
  assert.match(serverSource, /pcnDepartmentRoles/);
  assert.match(serverSource, /api\/pcn\/users/);
  assert.match(serverSource, /reset-password/);
  assert.match(serverSource, /sanitizePcnUserRow/);
  assert.match(serverSource, /systemRole/);
  assert.match(serverSource, /departmentRoleCode/);
  assert.match(workspaceSource, /Nhân sự PCN|Người dùng PCN/);
  const customerBranch = workspaceSource.match(/activeSection === ['"]customers['"]\s*\?([\s\S]*?)(?:: activeSection|:activeSection)/)?.[1] || '';
  assert.match(customerBranch, /PcnCustomersManagementView/);
  assert.doesNotMatch(customerBranch, /SystemManagementViews/);
  assert.doesNotMatch(customerBranch, /systemUsers/);
});

// --- End of pcn-user-role.test.ts ---
