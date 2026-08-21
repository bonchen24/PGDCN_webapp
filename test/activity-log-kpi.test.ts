// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for employee KPI ranking and activity chart segments

import test from 'node:test';
import assert from 'node:assert/strict';
import { getActivityKpiSegments, selectActivityKpiRows } from '../utils/activityLogKpi.ts';
import type { ActivityKpiSummary } from '../types';

const row = (overrides: Partial<ActivityKpiSummary>): ActivityKpiSummary => ({
  actorUsername: 'staff',
  actorName: 'Nhân viên',
  totalActions: 5,
  requestsCreated: 1,
  samplesProcessed: 2,
  kqtnUpdated: 1,
  handoversCreated: 1,
  workActions: 2,
  requestActions: 2,
  kqtnActions: 1,
  handoverActions: 1,
  scheduleActions: 1,
  otherActions: 0,
  lastActivityAt: '2026-08-18T03:00:00.000Z',
  ...overrides,
});

test('multi-user KPI selection keeps checked users and applies display limit', () => {
  const rows = [
    row({ actorUsername: 'top', actorName: 'Top', totalActions: 20 }),
    row({ actorUsername: 'middle', actorName: 'Middle', totalActions: 10 }),
    row({ actorUsername: 'low', actorName: 'Low', totalActions: 1 }),
  ];

  assert.deepEqual(selectActivityKpiRows(rows, [], 2).map(item => item.actorUsername), ['top', 'middle']);
  assert.deepEqual(selectActivityKpiRows(rows, ['low'], 2).map(item => item.actorUsername), ['low']);
});

test('selected employee chart segments are mutually exclusive and sum to total actions', () => {
  const segments = getActivityKpiSegments(row({
    totalActions: 12,
    requestActions: 4,
    kqtnActions: 3,
    handoverActions: 2,
    scheduleActions: 2,
    otherActions: 1,
  }));

  assert.deepEqual(segments.map(segment => segment.label), ['Phiếu', 'KQTN', 'Biên bản', 'Lịch', 'Khác']);
  assert.equal(segments.reduce((sum, segment) => sum + segment.value, 0), 12);
});

// --- End of activity-log-kpi.test.ts ---
