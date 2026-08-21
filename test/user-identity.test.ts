// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for canonical user preference lookup

import test from 'node:test';
import assert from 'node:assert/strict';
import { getCanonicalUserKey, findUserPreference, getUserFullName } from '../utils/userIdentity.ts';

test('uses the system user id as the canonical preference key', () => {
  assert.equal(
    getCanonicalUserKey('@LuongXuanHung@example.com', { id: 'luongxuanhung', username: 'luongxuanhung' }),
    'luongxuanhung'
  );
});

test('finds a saved preference when login input is an alias of the canonical key', () => {
  const preferences = {
    luongxuanhung: { customPassword: 'secret' }
  };

  assert.equal(
    findUserPreference(preferences, ['@LUONGXUANHUNG@example.com'])?.customPassword,
    'secret'
  );
});

test('uses the full name before generic name or nickname fields', () => {
  assert.equal(
    getUserFullName({
      username: 'HungX',
      name: 'HungX',
      displayName: 'HungX',
      'Họ và Tên': 'Lương Xuân Hùng',
    }),
    'Lương Xuân Hùng'
  );
});

test('does not fall back to a username or display name for visible identity', () => {
  assert.equal(
    getUserFullName({ username: 'HungX', displayName: 'HungX' }),
    'Người dùng hệ thống'
  );
});

// --- End of user-identity.test.ts ---
