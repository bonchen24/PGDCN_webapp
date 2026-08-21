// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for fixed GMT+7 activity period boundaries

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_ACTIVITY_PERIOD,
  getActivityPeriodBounds,
  type ActivityPeriod,
} from '../utils/activityLogTime.ts';

const reference = new Date('2026-08-18T03:15:00.000Z');

test('activity period defaults to the current Vietnam month', () => {
  assert.equal(DEFAULT_ACTIVITY_PERIOD, 'MONTH');
  assert.deepEqual(getActivityPeriodBounds(undefined, reference), {
    from: '2026-07-31T17:00:00.000Z',
    to: '2026-08-31T16:59:59.999Z',
  });
});

test('activity period boundaries cover day, Monday week, month, and year in GMT+7', () => {
  const expected: Record<ActivityPeriod, { from: string; to: string }> = {
    DAY: { from: '2026-08-17T17:00:00.000Z', to: '2026-08-18T16:59:59.999Z' },
    WEEK: { from: '2026-08-16T17:00:00.000Z', to: '2026-08-23T16:59:59.999Z' },
    MONTH: { from: '2026-07-31T17:00:00.000Z', to: '2026-08-31T16:59:59.999Z' },
    YEAR: { from: '2025-12-31T17:00:00.000Z', to: '2026-12-31T16:59:59.999Z' },
  };

  for (const period of Object.keys(expected) as ActivityPeriod[]) {
    assert.deepEqual(getActivityPeriodBounds(period, reference), expected[period], period);
  }
});

// --- End of activity-log-period.test.ts ---
