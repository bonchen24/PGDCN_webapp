// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for preserving an unassigned tester when manually scheduling samples

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const storeSource = fs.readFileSync(new URL('../store.ts', import.meta.url), 'utf8');

test('manual drag scheduling does not assign a default tester', () => {
  const start = storeSource.indexOf('  moveRequest: (requestId, targetDate');
  const end = storeSource.indexOf('  addHandoverDoc:', start);
  assert.ok(start >= 0 && end > start, 'moveRequest implementation must remain discoverable');

  const implementation = storeSource.slice(start, end);
  assert.doesNotMatch(implementation, /defaultTester|DEFAULT_TESTER/);
  assert.match(implementation, /movedReq\.scheduledDate = targetDate/);
  assert.match(implementation, /movedReq\.status = RequestStatus\.SCHEDULED/);
});

test('schedule tester selectors preserve the unassigned state', () => {
  for (const fileName of ['ScheduleView.tsx', 'ATDScheduleView.tsx']) {
    const source = fs.readFileSync(new URL(`../components/${fileName}`, import.meta.url), 'utf8');
    assert.match(source, /value=\{request\.testerName \|\| ''\}/, `${fileName} must not fall back to a named tester`);
    assert.match(source, /<option value="">Chưa giao<\/option>/, `${fileName} must expose an unassigned option`);
  }
});

// --- End of schedule-assignee-regression.test.ts ---
