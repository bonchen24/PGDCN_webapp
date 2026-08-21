// Author: Gemini
// OS support: Web/Node
// Description: Unit tests for notification synchronization merge and durable deletion identifiers

import test from 'node:test';
import assert from 'node:assert/strict';
import { collectNotificationIds, mergeNotifications } from '../utils/notificationEvents';

test('merges local and cloud notifications without duplicate ids', () => {
  const result = mergeNotifications([
    { id: 'n-1', title: 'Local', message: 'Local', createdAt: '2026-08-17T10:00:00Z', read: false, type: 'SYSTEM' },
  ], [
    { id: 'n-1', title: 'Cloud', message: 'Cloud', createdAt: '2026-08-17T10:00:00Z', read: true, type: 'SYSTEM' },
    { id: 'n-2', title: 'New', message: 'New', createdAt: '2026-08-17T11:00:00Z', read: false, type: 'SYSTEM' },
  ], 50);

  assert.deepEqual(result.map(item => item.id), ['n-2', 'n-1']);
  assert.equal(result.find(item => item.id === 'n-1')?.read, true);
});

test('collects unique ids from local and cloud lists before deletion', () => {
  assert.deepEqual(collectNotificationIds(
    [{ id: 'n-1' }, { id: 'n-2' }],
    [{ id: 'n-2' }, { id: 'n-3' }],
  ), ['n-1', 'n-2', 'n-3']);
});

// --- End of notification-merge.test.ts ---
