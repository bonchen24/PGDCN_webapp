import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import type { OutboundLabRequest } from '../types.ts';
import { createPcnLabRequest, updatePcnLabRequest } from '../utils/pcnLabRequestApi.ts';
import { PCN_DEDICATED_MUTATION_COLLECTIONS, PCN_STAFF_MUTABLE_COLLECTIONS } from '../utils/pcnRbac.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const viewSource = fs.readFileSync(new URL('../components/PcnLabRequestView.tsx', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');

test('PYC mutations use dedicated transaction endpoints and remain outside generic staff writes', () => {
  assert.equal(PCN_DEDICATED_MUTATION_COLLECTIONS.has('labRequests'), true);
  assert.equal(PCN_STAFF_MUTABLE_COLLECTIONS.has('labRequests'), false);
  assert.match(serverSource, /app\.post\(['"]\/api\/pcn\/lab-requests['"]/) ;
  assert.match(serverSource, /app\.post\(['"]\/api\/pcn\/lab-requests\/:requestId\/status['"]/) ;
  assert.match(serverSource, /sampleRouteId/);
  assert.match(serverSource, /linkedRoute\.sampleItemIds\?\.length/);
  assert.match(serverSource, /withPgTransaction/);
  assert.match(serverSource, /getPcnTimestampDenial/);
  assert.match(serverSource, /Thời điểm PTN nhận PYC không được sớm hơn/);
  assert.match(storeSource, /createPcnLabRequestApi/);
  assert.match(storeSource, /updatePcnLabRequestApi/);
  assert.doesNotMatch(storeSource, /saveDoc\(['"]labRequests['"]/);
  assert.match(designSource, /POST \/api\/pcn\/lab-requests/);
  assert.match(designSource, /sampleLotId.*sampleRouteId/);
  assert.match(viewSource, /availableFields/);
  assert.match(viewSource, /isPcnInternalSampleRequest/);
  assert.match(viewSource, /disabled=\{!form\.dossierId\}/);
});

test('PYC dispatch binds the authenticated PCN actor instead of trusting the request body', () => {
  const dispatchRoute = serverSource.slice(
    serverSource.indexOf("app.post('/api/pcn/lab-requests/:requestId/dispatch'"),
    serverSource.indexOf("app.post('/api/pcn/lab-requests/:requestId/reconcile'"),
  );

  assert.match(dispatchRoute, /const sessionActor = getPcnSessionUser\(req\)/);
  assert.match(dispatchRoute, /initiatedBy:\s*\{/);
  assert.match(dispatchRoute, /username:\s*sessionActor\.username/);
  assert.match(dispatchRoute, /sourceSystem:\s*'PCN'/);
  assert.doesNotMatch(dispatchRoute, /req\.body.*initiatedBy/);
});

test('PYC API client sends the complete request and an idempotent status transition', async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = (async (input, init) => {
    calls.push({ input, init });
    return new Response(JSON.stringify({ request: {}, dossier: {}, activityLogs: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
  try {
    const request = {
      id: 'lab-1',
      pycNumber: 'PYC-2026-001',
      dossierId: 'dossier-1',
      fieldCode: 'QC9',
      laboratoryName: 'Phòng thử nghiệm HSNL',
      status: 'DRAFT',
      requestedAt: '2026-08-28T01:00:00.000Z',
      sampleLotId: 'lot-1',
      sampleRouteId: 'lot-1-performance',
    } satisfies OutboundLabRequest;
    await createPcnLabRequest(request);
    await updatePcnLabRequest('lab-1', 'SENT', { handoverNote: 'Đã bàn giao đủ mẫu' }, 'pyc-request-1');

    assert.equal(calls[0].input, '/api/pcn/lab-requests');
    assert.equal(calls[0].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { request });
    assert.equal(calls[1].input, '/api/pcn/lab-requests/lab-1/status');
    assert.equal(calls[1].init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(calls[1].init?.body)), {
      status: 'SENT',
      updates: { handoverNote: 'Đã bàn giao đủ mẫu' },
      idempotencyKey: 'pyc-request-1',
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('PYC UI locks create and status actions while a request is pending', () => {
  assert.match(viewSource, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(viewSource, /const \[busyRequestId, setBusyRequestId\]/);
  assert.match(viewSource, /if \(saving\) return/);
  assert.match(viewSource, /disabled=\{saving\}/);
  assert.match(viewSource, /busyRequestId ===/);
  assert.match(viewSource, /finally \{\s*setBusyRequestId\(undefined\)/s);
  assert.match(designSource, /mọi form mutation PCN.*khóa thao tác tương ứng/s);
});

// --- End of pcn-lab-request-api-contract.test.ts ---
