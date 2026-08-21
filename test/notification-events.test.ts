// Author: Gemini
// OS support: Web/Node
// Description: Unit tests for business notification metadata, audience filtering and assignee resolution

import test from 'node:test';
import assert from 'node:assert/strict';
import { UserAccount } from '../types';
import {
  buildNotification,
  canViewNotification,
  resolveTargetUsername,
} from '../utils/notificationEvents';

test('builds a staff notification with business metadata', () => {
  const notification = buildNotification({
    id: 'notification-1',
    type: 'BUSINESS_ACTIVITY',
    entityType: 'REQUEST',
    action: 'CREATED',
    entityId: 'request-1',
    entityLabel: 'PYC-DDT-001',
    title: 'Phiếu yêu cầu mới',
    message: 'Có phiếu yêu cầu mới: PYC-DDT-001',
    targetRole: 'staff',
    createdBy: 'Nguyễn Văn A',
  }, '2026-08-17T10:00:00.000Z');

  assert.equal(notification.id, 'notification-1');
  assert.equal(notification.createdAt, '2026-08-17T10:00:00.000Z');
  assert.equal(notification.read, false);
  assert.equal(notification.entityType, 'REQUEST');
  assert.equal(notification.action, 'CREATED');
});

test('shows staff notification to admin and hides admin-only notification from staff', () => {
  const admin: UserAccount = { username: 'admin', name: 'Admin', role: 'admin' };
  const staff: UserAccount = { username: 'tester.a', name: 'Tester A', role: 'tester' };
  const staffNotification = buildNotification({
    id: 'staff-1', type: 'BUSINESS_ACTIVITY', title: 'Phiếu mới', message: 'Phiếu mới',
    targetRole: 'staff', createdBy: 'Admin', entityType: 'REQUEST', action: 'CREATED',
  }, '2026-08-17T10:00:00.000Z');
  const adminNotification = { ...staffNotification, id: 'admin-1', targetRole: 'admin' as const };

  assert.equal(canViewNotification(staffNotification, admin), true);
  assert.equal(canViewNotification(staffNotification, staff), true);
  assert.equal(canViewNotification(adminNotification, staff), false);
});

test('keeps the notification bell useful for every authenticated role through audience filtering', () => {
  const notification = buildNotification({
    id: 'staff-visible-to-authenticated-users', type: 'BUSINESS_ACTIVITY', title: 'Biên bản mới', message: 'Biên bản mới',
    targetRole: 'staff', createdBy: 'Admin', entityType: 'HANDOVER_DOC', action: 'CREATED',
  }, '2026-08-17T10:00:00.000Z');
  const authenticatedUsers: UserAccount[] = [
    { username: 'tester.a', name: 'Tester A', role: 'tester' },
    { username: 'viewer.a', name: 'Viewer A', role: 'viewer' },
    { username: 'guest.a', name: 'Guest A', role: 'guest' },
  ];

  assert.deepEqual(authenticatedUsers.map(user => canViewNotification(notification, user)), [true, true, true]);
  assert.equal(canViewNotification({ ...notification, targetRole: 'admin' }, authenticatedUsers[0]), false);
});

test('restricts assignment notification to the target username', () => {
  const staff: UserAccount = { username: 'tester.a', name: 'Tester A', role: 'tester' };
  const otherStaff: UserAccount = { username: 'tester.b', name: 'Tester B', role: 'tester' };
  const notification = buildNotification({
    id: 'assignment-1', type: 'BUSINESS_ACTIVITY', title: 'Công việc mới được giao',
    message: 'Bạn được giao công việc PYC-DDT-001', targetRole: 'staff',
    targetUsernames: ['tester.a'], createdBy: 'Admin', entityType: 'SCHEDULE', action: 'ASSIGNED',
  }, '2026-08-17T10:00:00.000Z');

  assert.equal(canViewNotification(notification, staff), true);
  assert.equal(canViewNotification(notification, otherStaff), false);
});

test('resolves assigned tester by username or display name', () => {
  const users = [{ id: 'tester.a', username: 'tester.a', name: 'Tester A', 'Họ và Tên': 'Tester A' }];

  assert.equal(resolveTargetUsername(users, 'Tester A'), 'tester.a');
  assert.equal(resolveTargetUsername(users, 'Unknown'), null);
});

// --- End of notification-events.test.ts ---
