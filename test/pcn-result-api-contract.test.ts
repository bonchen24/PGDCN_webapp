import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { submitPcnReturnedResult } from '../utils/pcnResultApi.ts';
import { attachPcnReturnedResultFile } from '../utils/pcnResultFileApi.ts';
import { PCN_DEDICATED_MUTATION_COLLECTIONS, PCN_STAFF_MUTABLE_COLLECTIONS } from '../utils/pcnRbac.ts';

const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
const storeSource = fs.readFileSync(new URL('../store-pcn.ts', import.meta.url), 'utf8');
const designSource = fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8');
const viewSource = fs.readFileSync(new URL('../components/PcnResultReturnView.tsx', import.meta.url), 'utf8');

test('returned-result mutations use a dedicated atomic PCN boundary', () => {
  assert.ok(PCN_DEDICATED_MUTATION_COLLECTIONS.has('returnedResults'));
  assert.equal(PCN_STAFF_MUTABLE_COLLECTIONS.has('returnedResults'), false);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/results'/);
  assert.match(serverSource, /markOfficialPcnResults/);
  assert.match(serverSource, /getPcnTimestampDenial/);
  assert.match(serverSource, /RESULT_RETURNED/);
  assert.match(serverSource, /withPgTransaction/);
  assert.match(serverSource, /FOR UPDATE/);
  assert.match(serverSource, /idempotent/);
  assert.match(serverSource, /pcnSampleFlowEvents/);
  assert.match(serverSource, /app\.post\('\/api\/pcn\/results\/:resultId\/file'/);
  assert.match(serverSource, /source_json_path\) !== 'fileAssetId'/);
  assert.match(storeSource, /submitPcnReturnedResult/);
  assert.doesNotMatch(storeSource, /saveDoc\('returnedResults'/);
  assert.match(designSource, /POST \/api\/pcn\/results/);
  assert.match(designSource, /cùng transaction/);
  assert.match(designSource, /receivedAt.*timestamp ISO-8601 UTC/);
});

test('returned-result file pointer uses a dedicated API boundary', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({ result: { id: 'result-1', fileAssetId: 'pcn-file-1' }, activityLog: null });
  }) as typeof fetch;

  try {
    await attachPcnReturnedResultFile('result-1', 'pcn-file-1', 'result.pdf');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/pcn/results/result-1/file');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    assetId: 'pcn-file-1',
    fileName: 'result.pdf',
  });
});

test('returned-result API client sends the canonical result and stable retry key', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    return Response.json({ ok: true });
  }) as typeof fetch;

  try {
    await submitPcnReturnedResult({
      id: 'result-1',
      dossierId: 'dossier-1',
      labRequestId: 'lab-1',
      round: 1,
      outcome: 'PASS',
      receivedAt: '2026-08-28T00:00:00.000Z',
    }, 'result-1');
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/api/pcn/results');
  assert.equal(calls[0].init?.method, 'POST');
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), {
    result: {
      id: 'result-1',
      dossierId: 'dossier-1',
      labRequestId: 'lab-1',
      round: 1,
      outcome: 'PASS',
      receivedAt: '2026-08-28T00:00:00.000Z',
    },
    idempotencyKey: 'result-1',
  });
});

test('returned-result UI locks create and attachment actions while a request is pending', () => {
  assert.match(viewSource, /const \[saving, setSaving\] = useState\(false\)/);
  assert.match(viewSource, /if \(saving\) return/);
  assert.match(viewSource, /finally \{\s*setSaving\(false\)/s);
  assert.match(viewSource, /disabled=\{saving\}/);
  assert.match(viewSource, /setSaving\(true\)/);
  assert.match(designSource, /mọi form mutation PCN.*khóa thao tác tương ứng/s);
});
