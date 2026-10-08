import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const apiSource = fs.readFileSync(new URL('../utils/pcnSampleRequestBundleApi.ts', import.meta.url), 'utf8');
const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('bundle API exposes save, send and per-dispatch retry boundaries', () => {
  assert.match(apiSource, /\/api\/pcn\/sample-request-bundles/);
  assert.match(apiSource, /sample-request-bundles\/\$\{encodeURIComponent\(bundleId\)\}\/send/);
  assert.match(apiSource, /sample-request-bundles\/\$\{encodeURIComponent\(bundleId\)\}\/retry\/\$\{encodeURIComponent\(dispatchId\)\}/);
  assert.match(apiSource, /savePcnSampleRequestBundle/);
  assert.match(apiSource, /sendPcnSampleRequestBundle/);
  assert.match(apiSource, /retryPcnSampleRequestBundleDispatch/);
});

test('server keeps bundle persistence outside generic collection writes and validates customer/code invariants', () => {
  assert.match(serverSource, /pcnSampleRequestBundles/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/sample-request-bundles'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/sample-request-bundles\/:bundleId\/send'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/sample-request-bundles\/:bundleId\/retry\/:dispatchId'/);
  assert.match(serverSource, /CUSTOMER_MISMATCH|cùng một khách hàng/);
  assert.match(serverSource, /DUPLICATE_LOT_CODE|Mã lô.*đã tồn tại/);
  assert.match(serverSource, /idempotency|idempotent/i);
});
