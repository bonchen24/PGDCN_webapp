// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for routing notification clicks to business screens

import assert from 'node:assert/strict';
import test from 'node:test';
import { AppNotification, TestCategory } from '../types';
import { getNotificationDestination } from '../utils/notificationNavigation';

const baseNotification = (overrides: Partial<AppNotification>): AppNotification => ({
  id: 'notification-1',
  type: 'BUSINESS_ACTIVITY',
  title: 'Thông báo',
  message: 'Nội dung',
  createdAt: '2026-08-17T08:00:00.000Z',
  read: false,
  ...overrides,
});

test('routes request and assignment notifications to the request list', () => {
  assert.deepEqual(
    getNotificationDestination(baseNotification({ entityType: 'REQUEST', requestCode: 'PYC-001' })),
    { kind: 'requests', requestCode: 'PYC-001' },
  );
});

test('routes handover and KQTN notifications to their business screens', () => {
  assert.deepEqual(
    getNotificationDestination(baseNotification({ entityType: 'HANDOVER_DOC', entityId: 'handover-1' })),
    { kind: 'handover', entityId: 'handover-1' },
  );
  assert.deepEqual(
    getNotificationDestination(baseNotification({ entityType: 'KQTN_RECORD', entityId: 'kqtn-1' })),
    { kind: 'kqtn', entityId: 'kqtn-1' },
  );
});

test('routes schedule notifications to the correct schedule tab', () => {
  assert.deepEqual(
    getNotificationDestination(baseNotification({ entityType: 'SCHEDULE', requestCode: 'PYC-ATD', testCategory: TestCategory.ATD })),
    { kind: 'schedule_itd', requestCode: 'PYC-ATD' },
  );
});

// --- End of notification-navigation.test.ts ---
