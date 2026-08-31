import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createPcnSampleLot, updatePcnSampleRoute } from '../utils/pcnSampleApi.ts';
import { PCN_DEDICATED_MUTATION_COLLECTIONS, PCN_STAFF_MUTABLE_COLLECTIONS } from '../utils/pcnRbac.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('sample mutations use dedicated server transactions instead of generic collection writes', () => {
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('pcnSampleLots'));
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('pcnSampleItems'));
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('pcnSampleRoutes'));
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('pcnSampleFlowEvents'));
  assert.equal(PCN_STAFF_MUTABLE_COLLECTIONS.has('pcnSampleLots'), false);
  assert.equal(PCN_STAFF_MUTABLE_COLLECTIONS.has('pcnSampleRoutes'), false);
  assert.equal(PCN_STAFF_MUTABLE_COLLECTIONS.has('pcnSampleFlowEvents'), false);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/samples\/lots'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/samples\/routes\/:routeId\/status'/);
  assert.match(serverSource, /transitionPcnSampleRoute/);
  assert.match(serverSource, /derivePcnSampleLotStatus/);
  assert.match(serverSource, /buildPcnSampleFlowEvent/);
  assert.match(serverSource, /idempotencyKey/);
  assert.match(serverSource, /FOR UPDATE/);
  assert.match(serverSource, /withPgTransaction/);
  assert.match(serverSource, /normalizePcnSampleLabCodes/);
  assert.match(serverSource, /ISSUE_RECORDED/);
  assert.match(storeSource, /createPcnSampleLot/);
  assert.match(storeSource, /updatePcnSampleRouteApi/);
  assert.match(designSource, /POST \/api\/pcn\/samples\/lots/);
  assert.match(designSource, /idempotencyKey/);
  assert.match(designSource, /không được ghi qua generic `\/api\/db`/);
});

test('sample API client sends the draft and route transition to their dedicated boundaries', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({ ok: true });
  }) as typeof fetch;

  try {
    await createPcnSampleLot({
      id: 'sample-lot-1',
      dossierId: 'dossier-1',
      lotCode: 'PCN-QC4-001-M01',
      sampleName: 'Bếp điện',
      quantity: 2,
      fieldCodes: ['QC4'],
      labCodes: ['EMC'],
    });
    await updatePcnSampleRoute('route-1', 'RECEIVED', { note: 'Đã nhận đủ mẫu' }, 'request-1');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, '/api/pcn/samples/lots');
  assert.equal(calls[1].url, '/api/pcn/samples/routes/route-1/status');
  assert.equal(calls[0].init?.method, 'POST');
  assert.equal(calls[1].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    draft: {
      id: 'sample-lot-1',
      dossierId: 'dossier-1',
      lotCode: 'PCN-QC4-001-M01',
      sampleName: 'Bếp điện',
      quantity: 2,
      fieldCodes: ['QC4'],
      labCodes: ['EMC'],
    },
  });
  assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
    status: 'RECEIVED',
    update: { note: 'Đã nhận đủ mẫu' },
    idempotencyKey: 'request-1',
  });
});

test('PCN lab integration exposes signed dispatch and webhook boundaries with idempotent inbox handling', () => {
  assert.match(serverSource, /app\.post\('\/api\/pcn\/lab-requests\/:requestId\/dispatch'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/lab-requests\/:requestId\/reconcile'/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/integrations\/lab-status-events'/);
  assert.match(serverSource, /PCN_LAB_INTEGRATIONS_JSON/);
  assert.match(serverSource, /createHmac\(['"]sha256['"]|createHmac\(['"]sha256/);
  assert.match(serverSource, /timingSafeEqual/);
  assert.match(serverSource, /pg_advisory_xact_lock/);
  assert.match(serverSource, /externalSequence/);
  assert.match(serverSource, /pcnSampleItemIds/);
  assert.match(serverSource, /sampleItems/);
  assert.match(serverSource, /pcnSampleFlowEvents/);
  assert.match(serverSource, /canonicalizePcnLabIntegrationPayload/);
  assert.match(serverSource, /AbortController/);
  assert.match(serverSource, /getPcnLabIntegrationEventId/);
  assert.match(serverSource, /getDocumentPayload\(event\)/);
  assert.match(serverSource, /secretEnv/);
  assert.doesNotMatch(serverSource, /JSON\.stringify\(\{[^}]*secretEnv/);
});

// --- End of pcn-sample-api-contract.test.ts ---
