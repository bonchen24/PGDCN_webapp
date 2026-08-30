import assert from 'node:assert/strict';
import test from 'node:test';

import { idbStorage } from '../utils/browserStorage.ts';

test('browser persistence is a no-op when the store is evaluated by Next server rendering', async () => {
  assert.equal(await idbStorage.getItem('pcn-server-test'), null);
  await idbStorage.setItem('pcn-server-test', '{"safe":true}');
  await idbStorage.removeItem('pcn-server-test');
});

// --- End of next-storage-boundary.test.ts ---
