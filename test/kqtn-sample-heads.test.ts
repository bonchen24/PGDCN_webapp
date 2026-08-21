// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for one KQTN row per sample head.

import assert from 'node:assert/strict';
import test from 'node:test';

import { mergeKqtnSampleHeads } from '../utils/kqtnRows';

const request = {
  id: 'request-1',
  requestCode: 'PYC-001',
  status: 'received',
  sampleStatus: 'received',
  customerName: 'Customer',
  modelName: 'Model Alpha',
  type: 'Device',
  quantity: 1,
  atdEncodeNumber: 'ATD-001',
  standard: 'TCVN',
  priority: 'normal',
  requestDate: '2026-08-19',
  scheduledDate: null,
  duration: 1,
} as any;

test('uses a request-backed sample head even before a KQTN result exists', () => {
  const rows = mergeKqtnSampleHeads([request], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].sampleCode, 'ATD-001');
  assert.equal(rows[0].isPending, true);
  assert.equal(rows[0].requestId, 'request-1');
});

test('merges an existing result into its request-backed sample head', () => {
  const result = { id: 'kqtn-1', sampleCode: 'ATD 001', sampleKey: 'ATD001', reportNo: 'ATD 001', model: 'Model Alpha', version: 1 } as any;
  const rows = mergeKqtnSampleHeads([request], [result]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'kqtn-1');
  assert.equal(rows[0].isPending, false);
});

test('collapses duplicate legacy records by canonical sample key', () => {
  const first = { id: 'kqtn-1', sampleCode: 'ATD-001', reportNo: 'ATD-001', model: 'Model Alpha', version: 1, updatedAt: '2026-08-18' } as any;
  const second = { id: 'kqtn-2', sampleCode: 'ATD 001', reportNo: 'ATD 001', model: 'Model Alpha', version: 2, updatedAt: '2026-08-19' } as any;
  const rows = mergeKqtnSampleHeads([], [first, second]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, 'kqtn-2');
});

// --- End of kqtn-sample-heads.test.ts ---
