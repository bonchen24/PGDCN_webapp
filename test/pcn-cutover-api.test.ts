import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const servicePath = new URL('../utils/pcnCutoverService.ts', import.meta.url);
const serviceSource = fs.readFileSync(servicePath, 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN cutover status is an Admin-only read-only API', () => {
  assert.equal(fs.existsSync(servicePath), true);
  assert.match(serverSource, /app\.get\('\/api\/pcn\/cutover-status', requireAdmin/);
  assert.match(serverSource, /loadPcnCutoverSnapshot/);
  assert.match(serviceSource, /getLatestPcnCustomerImportCheckpoint/);
  assert.match(serviceSource, /latestCustomerImportCheckpoint/);
  assert.match(serverSource, /requireCustomerImportCheckpoint: true/);
  assert.doesNotMatch(serverSource, /app\.(post|put|patch|delete)\('\/api\/pcn\/cutover-status'/);
  assert.match(designSource, /Màn hình đối soát cutover PCN/);
  assert.match(designSource, /không có nút restore\/delete/);
});
