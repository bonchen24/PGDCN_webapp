// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for fixed GMT+7 activity timestamps

import test from 'node:test';
import assert from 'node:assert/strict';
import { formatActivityTime } from '../utils/activityLogTime.ts';

test('formats UTC activity timestamps in Vietnam GMT+7', () => {
  const formatted = formatActivityTime('2026-08-18T03:00:00.000Z');
  assert.match(formatted, /10:00:00/);
});

// --- End of activity-log-time.test.ts ---
