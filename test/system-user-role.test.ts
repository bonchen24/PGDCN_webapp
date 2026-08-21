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

// --- End of system-user-role.test.ts ---
