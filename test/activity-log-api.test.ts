// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for paginated system activity log REST client

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createActivityLogClient } from '../utils/activityLogApi.ts';

test('requests a stable filtered cursor page', async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const client = createActivityLogClient(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: String(init.method || 'GET'), body: String(init.body || '') });
    return new Response(JSON.stringify({ items: [], nextCursor: null, hasMore: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  await client.fetchPage({ limit: 50, actor: 'admin', action: 'UPDATED', entityType: 'REQUEST', search: 'PYC-01' }, 'cursor-1');
  assert.match(calls[0].url, /\/api\/activity-logs\?/);
  assert.match(calls[0].url, /limit=50/);
  assert.match(calls[0].url, /actor=admin/);
  assert.match(calls[0].url, /cursor=cursor-1/);
  assert.match(calls[0].url, /search=PYC-01/);
});

test('appends without using the generic collection overwrite endpoint', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const client = createActivityLogClient(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: String(init.method || 'GET') });
    return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } });
  });

  await client.append({ id: 'activity-1', actorName: 'Admin', action: 'CREATED', entityType: 'REQUEST', summary: 'Tạo phiếu', source: 'UI', createdAt: new Date().toISOString() });
  assert.deepEqual(calls, [{ url: '/api/activity-logs', method: 'POST' }]);
});

test('appends restore batches through the append-only batch endpoint', async () => {
  const calls: Array<{ url: string; method: string; body: unknown }> = [];
  const client = createActivityLogClient(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: String(init.method || 'GET'), body: JSON.parse(String(init.body || '{}')) });
    return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } });
  });

  await client.appendBatch([{
    id: 'activity-1',
    actorName: 'Admin',
    action: 'RESTORED',
    entityType: 'SYSTEM',
    summary: 'Khôi phục',
    source: 'RESTORE',
    createdAt: new Date().toISOString(),
  }]);

  assert.equal(calls[0].url, '/api/activity-logs/batch');
  assert.equal(calls[0].method, 'POST');
  assert.equal((calls[0].body as { items: unknown[] }).items.length, 1);
});

test('fetchAll follows cursors and stops at the final page', async () => {
  const cursors: string[] = [];
  let page = 0;
  const client = createActivityLogClient(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    cursors.push(url.searchParams.get('cursor') || '');
    page += 1;
    const items = [{
      id: `activity-${page}`,
      actorName: 'Admin',
      action: 'UPDATED' as const,
      entityType: 'REQUEST' as const,
      summary: `Sửa ${page}`,
      source: 'UI' as const,
      createdAt: `2026-08-18T00:00:0${page}.000Z`,
    }];
    return new Response(JSON.stringify({ items, nextCursor: page === 1 ? 'cursor-2' : null, hasMore: page === 1 }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  const logs = await client.fetchAll({ limit: 100 });
  assert.equal(logs.length, 2);
  assert.deepEqual(cursors, ['', 'cursor-2']);
});

test('server append routes normalize payloads before persistence', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /buildActivityLog\(req\.body/);
  assert.match(serverSource, /buildActivityLog\(item/);
  assert.match(serverSource, /isValidActivityTimestamp/);
});

test('requests KPI summary with multiple actors and GMT+7 date bounds', async () => {
  const calls: string[] = [];
  const client = createActivityLogClient(async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  await client.fetchSummary({
    actor: ['admin', 'staff'],
    from: '2026-08-18',
    to: '2026-08-18',
  });

  const url = new URL(calls[0], 'http://localhost');
  assert.equal(url.pathname, '/api/activity-logs/summary');
  assert.deepEqual(url.searchParams.getAll('actor'), ['admin', 'staff']);
  assert.equal(url.searchParams.get('from'), '2026-08-18');
  assert.equal(url.searchParams.get('to'), '2026-08-18');
});

test('server exposes grouped activity summary and repeated actor filtering', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /app\.get\("\/api\/activity-logs\/summary"/);
  assert.match(serverSource, /getActivityQueryValues\(req, "actor"\)/);
  assert.match(serverSource, /COUNT\(DISTINCT CASE WHEN/);
});

test('server aggregates KPI summary to one row per actor username', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  assert.match(serverSource, /MAX\(COALESCE\(data->>'actorName', 'Hệ thống'\)\) AS "actorName"/);
  assert.match(serverSource, /GROUP BY data->>'actorUsername'/);
  assert.doesNotMatch(serverSource, /GROUP BY data->>'actorUsername', data->>'actorName'/);
});

// --- End of activity-log-api.test.ts ---
