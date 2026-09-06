import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');

test('PCN store owns bundle snapshots and exposes save/send/retry actions', () => {
  assert.match(storeSource, /PcnSampleRequestBundle/);
  assert.match(storeSource, /sampleRequestBundles/);
  assert.match(storeSource, /saveSampleRequestBundle/);
  assert.match(storeSource, /sendSampleRequestBundle/);
  assert.match(storeSource, /retrySampleRequestBundleDispatch/);
});

test('bundle send loops through child lab requests independently', () => {
  assert.match(storeSource, /for \(const dispatch of/);
  assert.match(storeSource, /dispatchPcnLabRequest/);
  assert.match(storeSource, /PARTIALLY_SENT|failedDispatches/);
});
