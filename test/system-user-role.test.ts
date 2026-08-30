// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for canonical system-user role persistence and resolution

import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSystemUserRole, withSystemUserRoleAliases } from '../utils/systemUserRole.ts';

test('prefers the canonical role when a legacy role alias is stale', () => {
  assert.equal(
    normalizeSystemUserRole({ role: 'admin', 'Loại tài khoản': 'tester' }),
    'admin'
  );
});

test('persists the selected role to the canonical and legacy role fields', () => {
  assert.deepEqual(
    withSystemUserRoleAliases({ id: 'tongdangquy', name: 'Tống Đăng Quý' }, 'admin'),
    {
      id: 'tongdangquy',
      name: 'Tống Đăng Quý',
      role: 'admin',
      'Loại tài khoản': 'admin',
      'Phân quyền': 'admin',
      'Vai trò': 'admin'
    }
  );
});

test('normalizes the dedicated office clerk role from Vietnamese labels', () => {
  assert.equal(normalizeSystemUserRole({ role: 'Văn thư chuyên trách' }), 'office_clerk');
  assert.equal(normalizeSystemUserRole({ 'Loại tài khoản': 'Văn thư' }), 'office_clerk');
});

test('assigns the canonical office clerk account even when legacy role data is stale', () => {
  assert.equal(
    normalizeSystemUserRole({ username: 'nguyenanhthu', role: 'viewer' }),
    'office_clerk'
  );
});

test('persists the office clerk role to all compatible role fields', () => {
  assert.deepEqual(
    withSystemUserRoleAliases({ username: 'nguyenanhthu' }, 'office_clerk'),
    {
      username: 'nguyenanhthu',
      role: 'office_clerk',
      'Loại tài khoản': 'office_clerk',
      'Phân quyền': 'office_clerk',
      'Vai trò': 'office_clerk'
    }
  );
});

// --- End of system-user-role.test.ts ---
