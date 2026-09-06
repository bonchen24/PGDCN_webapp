import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const schemaSource = fs.readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');

test('bundle server boundary returns per-laboratory outcomes and preserves acknowledged dispatches', () => {
  assert.match(serverSource, /PARTIALLY_SENT/);
  assert.match(serverSource, /ACKNOWLEDGED/);
  assert.match(serverSource, /ERROR/);
  assert.match(serverSource, /dispatches/);
  assert.match(serverSource, /bundleId/);
});

test('PCN schema mentions the aggregate collection and keeps it in the PCN profile', () => {
  assert.match(schemaSource, /pcnSampleRequestBundles|sample request bundle/i);
  assert.match(serverSource, /"pcnSampleRequestBundles"/);
});
