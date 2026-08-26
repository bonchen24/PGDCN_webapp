import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrateItdcToItdRecord,
  planItdcToItdMigration,
} from '../utils/itdcToItdMigration.ts';

test('plans copying a legacy ITDC value into the ITD column without changing the code', () => {
  const plan = planItdcToItdMigration({
    id: 'req-1',
    atdEncodeNumber: 'ITDC 001-26-M01',
  });

  assert.deepEqual(plan, {
    id: 'req-1',
    status: 'migrate',
    sourceValue: 'ITDC 001-26-M01',
    targetValue: 'ITDC 001-26-M01',
    update: {
      itdEncodeNumber: 'ITDC 001-26-M01',
      atdEncodeNumber: undefined,
    },
  });
});

test('does not overwrite an existing ITD value with a different legacy ITDC value', () => {
  const plan = planItdcToItdMigration({
    id: 'req-2',
    atdEncodeNumber: 'ITDC 001-26-M01',
    itdEncodeNumber: 'ITD 001-26-M01',
  });

  assert.deepEqual(plan, {
    id: 'req-2',
    status: 'conflict',
    sourceValue: 'ITDC 001-26-M01',
    targetValue: 'ITD 001-26-M01',
    update: undefined,
  });
});

test('treats a matching source and target as already migrated', () => {
  const plan = planItdcToItdMigration({
    id: 'req-3',
    atdEncodeNumber: 'ITDC 001-26-M01',
    itdEncodeNumber: 'ITDC 001-26-M01',
  });

  assert.deepEqual(plan, {
    id: 'req-3',
    status: 'already_migrated',
    sourceValue: 'ITDC 001-26-M01',
    targetValue: 'ITDC 001-26-M01',
    update: undefined,
  });
});

test('ignores records without a legacy ITDC value', () => {
  const plan = planItdcToItdMigration({
    id: 'req-4',
    itdEncodeNumber: 'ITD 001-26-M01',
  });

  assert.deepEqual(plan, {
    id: 'req-4',
    status: 'unchanged',
    sourceValue: undefined,
    targetValue: 'ITD 001-26-M01',
    update: undefined,
  });
});

test('moves the source field out of a safely migrated document', () => {
  const result = migrateItdcToItdRecord({
    id: 'req-5',
    modelName: 'Tủ lạnh',
    atdEncodeNumber: 'ITDC 001-26-M01',
  });

  assert.deepEqual(result, {
    status: 'migrate',
    record: {
      id: 'req-5',
      modelName: 'Tủ lạnh',
      itdEncodeNumber: 'ITDC 001-26-M01',
    },
  });
});

test('keeps a conflicting document unchanged for manual review', () => {
  const result = migrateItdcToItdRecord({
    id: 'req-6',
    atdEncodeNumber: 'ITDC 001-26-M01',
    itdEncodeNumber: 'ITD 001-26-M01',
  });

  assert.deepEqual(result, {
    status: 'conflict',
    record: {
      id: 'req-6',
      atdEncodeNumber: 'ITDC 001-26-M01',
      itdEncodeNumber: 'ITD 001-26-M01',
    },
  });
});

// --- End of itdc-to-itd-migration.test.ts ---
