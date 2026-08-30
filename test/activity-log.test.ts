// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for system activity log builders, redaction, and visibility

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildActivityLog,
  diffActivityFields,
  isValidActivityTimestamp,
  isActivityLogVisibleToUser,
} from '../utils/activityLog.ts';

test('builds an audit record with actor snapshot and stable id', () => {
  const log = buildActivityLog({
    id: 'activity-1',
    actor: { username: 'admin', name: 'Admin', role: 'admin', position: 'Quản lý' },
    action: 'UPDATED',
    entityType: 'REQUEST',
    entityId: 'req-1',
    entityLabel: 'PYC-01',
    summary: 'Admin đã cập nhật phiếu PYC-01',
    source: 'UI',
    changes: [{ field: 'note', before: 'cũ', after: 'mới' }],
  });

  assert.equal(log.id, 'activity-1');
  assert.equal(log.actorUsername, 'admin');
  assert.equal(log.entityType, 'REQUEST');
  assert.equal(log.changes?.[0].field, 'note');
  assert.ok(log.createdAt);
});

test('diffs only changed fields and redacts secrets', () => {
  const changes = diffActivityFields(
    { name: 'A', password: 'old', note: 'cũ' },
    { name: 'B', password: 'new', note: 'mới' },
    ['name', 'password', 'note']
  );

  assert.deepEqual(changes, [
    { field: 'name', before: 'A', after: 'B' },
    { field: 'password', before: '[REDACTED]', after: '[REDACTED]' },
    { field: 'note', before: 'cũ', after: 'mới' },
  ]);
});

test('all authenticated users can view the read-only activity page', () => {
  assert.equal(isActivityLogVisibleToUser({ role: 'admin' }), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'tester', position: 'Phó trưởng phòng' }), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'tester', position: 'Nhân viên' }), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'viewer', position: 'Quan sát' }), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'guest', position: 'Khách' }), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'office_clerk', position: 'Văn thư chuyên trách' }), false);
  assert.equal(isActivityLogVisibleToUser(null), false);
});

test('accepts only ISO timestamps for persisted activity logs', () => {
  assert.equal(isValidActivityTimestamp('2026-08-18T03:00:00.000Z'), true);
  assert.equal(isValidActivityTimestamp('08/18/2026 04:00:11'), false);
  assert.equal(isValidActivityTimestamp('not-a-date'), false);
});

// --- End of activity-log.test.ts ---
