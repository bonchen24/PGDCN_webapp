import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { getNextPcnLabRequestStatuses, transitionPcnLabRequest } from '../utils/pcnLabRouting.ts';

const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');

test('PYC follows a controlled outbound and handover lifecycle', () => {
  assert.deepEqual(getNextPcnLabRequestStatuses('DRAFT'), ['SENT', 'CANCELLED']);
  assert.deepEqual(getNextPcnLabRequestStatuses('SENT'), ['RECEIVED', 'CANCELLED']);
  assert.deepEqual(getNextPcnLabRequestStatuses('RECEIVED'), ['RESULT_RETURNED']);
  assert.equal(transitionPcnLabRequest('DRAFT', 'SENT').status, 'SENT');
  assert.throws(() => transitionPcnLabRequest('DRAFT', 'RESULT_RETURNED'), /PYC|trạng thái|chuyển/i);
});

test('PCN store persists handover state and never routes PYC through schedule concepts', () => {
  assert.match(storeSource, /updateLabRequest/);
  assert.match(storeSource, /handoverAt/);
  assert.match(storeSource, /labRequests/);
  assert.doesNotMatch(storeSource, /schedule|Lịch ITD|Lịch EMC/i);
});

// --- End of pcn-lab-lifecycle.test.ts ---
