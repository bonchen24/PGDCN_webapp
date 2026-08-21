// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for durable system-user restoration and deleted markers

import test from 'node:test';
import assert from 'node:assert/strict';
import { getDeletedUserIdsFromConfig, removeDeletedUserMarker } from '../utils/systemUserPersistence.ts';

test('removes a stale cloud deleted marker when an admin re-adds that user', () => {
  assert.deepEqual(
    removeDeletedUserMarker(['vutienlinh'], ['vutienlinh', 'old-user'], 'vutienlinh'),
    ['old-user']
  );
});

test('reads a scalar JSON deleted-user marker from system configuration', () => {
  assert.deepEqual(
    getDeletedUserIdsFromConfig([{ id: 'deletedUserIds', configValue: '"vutienlinh"' }]),
    ['vutienlinh']
  );
});

// --- End of system-user-persistence.test.ts ---
