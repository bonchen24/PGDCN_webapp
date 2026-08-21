// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for notification backup and restore payloads

import assert from 'node:assert/strict';
import test from 'node:test';
import { buildBackupPayload, normalizeBackupNotifications } from '../utils/notificationBackup';

test('includes notifications in the complete backup payload', () => {
  const notifications = [{
    id: 'notification-1',
    type: 'NEW_REQUEST',
    title: 'Phiếu mới',
    message: 'PYC-001',
    createdAt: '2026-08-17T08:00:00.000Z',
    read: false,
  }];
  const payload = buildBackupPayload({
    requests: [],
    handoverDocs: [],
    kqtnRecords: [],
    customers: [],
    products: [],
    brands: [],
    dayConfigs: {},
    systemUsers: [],
    settings: {},
    notifications,
  }, '2026-08-17T09:00:00.000Z');

  assert.deepEqual(payload.notifications, notifications);
  assert.equal(payload.timestamp, '2026-08-17T09:00:00.000Z');
});

test('normalizes legacy backup notifications and keeps business metadata', () => {
  const [notification] = normalizeBackupNotifications([{
    id: 'notification-2',
    type: 'BUSINESS_ACTIVITY',
    title: 'Biên bản mới',
    message: 'BBGN-001',
    entityType: 'HANDOVER_DOC',
    docNumber: 'BBGN-001',
  }], '2026-08-17T09:00:00.000Z');

  assert.equal(notification.id, 'notification-2');
  assert.equal(notification.read, false);
  assert.equal(notification.entityType, 'HANDOVER_DOC');
  assert.equal(notification.createdAt, '2026-08-17T09:00:00.000Z');
});

// --- End of notification-backup.test.ts ---
