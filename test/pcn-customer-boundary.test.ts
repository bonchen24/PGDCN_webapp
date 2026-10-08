import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createPcnCustomer, deletePcnCustomer, updatePcnCustomer } from '../utils/pcnCustomerApi.ts';
import { PCN_DEDICATED_MUTATION_COLLECTIONS } from '../utils/pcnRbac.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PCN customer mutations use dedicated transactions and preserve dossier snapshots', () => {
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('customers'));
  assert.match(serverSource, /app\.post\('\/api\/pcn\/customers'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/customers\/:customerId'/);
  assert.match(serverSource, /app\.delete\('\/api\/pcn\/customers\/:customerId'/);
  assert.match(serverSource, /samePcnCustomerBusiness/);
  assert.match(serverSource, /PCN_CUSTOMER/);
  assert.match(designSource, /customerSnapshot/);
  assert.match(designSource, /POST \/api\/pcn\/customers/);
  for (const method of ['addCustomer', 'updateCustomer', 'deleteCustomer']) {
    const start = storeSource.indexOf(`${method}: async`);
    const end = storeSource.indexOf('\n  },', start);
    assert.doesNotMatch(storeSource.slice(start, end), /saveDoc\('customers'/);
    assert.doesNotMatch(storeSource.slice(start, end), /deleteDoc\('customers'/);
  }
  assert.match(storeSource, /createPcnCustomer|updatePcnCustomer|deletePcnCustomer/);
});

test('PCN customer API clients keep create, update and delete paths explicit', async () => {
  const calls: Array<{ url: string; method?: string; body?: string }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), method: init?.method, body: init?.body as string | undefined });
    return Response.json({ id: 'KH-001', customer: { customerCode: 'KH-001', name: 'Công ty A' }, deleted: true });
  }) as typeof fetch;
  try {
    await createPcnCustomer({ customerCode: 'KH-001', name: 'Công ty A' });
    await updatePcnCustomer('KH-001', { customerCode: 'KH-002', name: 'Công ty A' });
    await deletePcnCustomer('KH-002');
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(calls.map((call) => [call.url, call.method, call.body ? JSON.parse(call.body) : undefined]), [
    ['/api/pcn/customers', 'POST', { customer: { customerCode: 'KH-001', name: 'Công ty A' } }],
    ['/api/pcn/customers/KH-001', 'POST', { customer: { customerCode: 'KH-002', name: 'Công ty A' } }],
    ['/api/pcn/customers/KH-002', 'DELETE', undefined],
  ]);
});

test('PCN refuses customer deletion while a direct business reference exists', () => {
  const routeStart = serverSource.indexOf("app.delete('/api/pcn/customers/:customerId'");
  const routeEnd = serverSource.indexOf("\n  });", routeStart);
  const routeSource = serverSource.slice(routeStart, routeEnd);
  const referenceQueryIndex = routeSource.indexOf("data ->> 'customerId'");
  const rejectionIndex = routeSource.indexOf('statusCode: 409', referenceQueryIndex);
  const deleteIndex = routeSource.indexOf("DELETE FROM app_documents WHERE collection_name = 'customers'");

  assert.ok(referenceQueryIndex >= 0, 'customer delete must count direct business references');
  assert.match(routeSource, /COUNT\(\*\)::int AS count/);
  assert.match(routeSource, /Không thể xóa khách hàng PCN vì còn/);
  assert.ok(rejectionIndex > referenceQueryIndex, 'referenced customer must be rejected');
  assert.ok(deleteIndex > rejectionIndex, 'customer delete must happen after the reference guard');
});
