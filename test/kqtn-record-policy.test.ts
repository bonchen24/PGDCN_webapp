// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for KQTN duplicate and overwrite policy.

import assert from 'node:assert/strict';
import test from 'node:test';

import { findKqtnRecordBySampleKey, shouldOverwriteKqtnRecord } from '../utils/kqtnRecordPolicy';

const records = [
  { id: 'kqtn-1', sampleCode: 'ATD-001', sampleKey: 'ATD001' },
  { id: 'kqtn-2', sampleCode: 'ATD-002', sampleKey: 'ATD002' },
];

test('finds the single existing result by canonical sample key', () => {
  assert.equal(findKqtnRecordBySampleKey(records, 'atd 001')?.id, 'kqtn-1');
  assert.equal(findKqtnRecordBySampleKey(records, 'ATD-999'), undefined);
});

test('does not allow a second result unless overwrite is explicitly confirmed', () => {
  assert.equal(shouldOverwriteKqtnRecord(false), false);
  assert.equal(shouldOverwriteKqtnRecord(true), true);
});

// --- End of kqtn-record-policy.test.ts ---
