import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createPgdcnNotificationClient } from '../utils/pgdcnNotificationApi.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');
const schemaSource = fs.readFileSync(new URL('../sql/pcn-schema.sql', import.meta.url), 'utf8');

test('shared notification client uses one PGDCN session boundary', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: init.method || 'GET' });
    const items = String(input).endsWith('/notifications')
      ? [{ id: 'legacy', type: 'SYSTEM', title: 'cũ', message: 'm', createdAt: '2026-09-03T01:00:00.000Z', read: false }]
      : [];
    return new Response(JSON.stringify({ items }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createPgdcnNotificationClient(fetchImpl);

  const items = await client.fetch();
  await client.markRead('n-1');
  await client.markAllRead();
  await client.clear();

  assert.equal(items[0].domain, 'PCN');
  assert.deepEqual(calls, [
    { url: '/api/pgdcn/notifications', method: 'GET' },
    { url: '/api/pgdcn/notifications/n-1/read', method: 'POST' },
    { url: '/api/pgdcn/notifications/read-all', method: 'POST' },
    { url: '/api/pgdcn/notifications/clear', method: 'DELETE' },
  ]);
});

test('shared notification routes enforce scope, audience and the 50-item cap', () => {
  assert.match(serverSource, /app\.get\(["']\/api\/pgdcn\/notifications["']/);
  assert.match(serverSource, /app\.post\(["']\/api\/pgdcn\/notifications\/read-all["']/);
  assert.match(serverSource, /app\.delete\(["']\/api\/pgdcn\/notifications\/clear["']/);
  assert.match(serverSource, /app\.post\(["']\/api\/pgdcn\/notifications\/:notificationId\/read["']/);
  assert.match(serverSource, /PGD_NOTIFICATION_ENTITY_TYPES/);
  assert.match(serverSource, /departmentScopes/);
  assert.match(serverSource, /COALESCE\(data->>'domain', 'PCN'\)/);
  assert.match(serverSource, /targetUsernames/);
  assert.match(serverSource, /targetRole/);
  assert.match(serverSource, /LIMIT 50/);
  assert.match(serverSource, /requirePgdcnNotificationMutation/);
});

test('shared notification mutations never touch either audit collection', () => {
  const routeStart = serverSource.indexOf('app.get("/api/pgdcn/notifications"');
  const legacyRouteStart = serverSource.indexOf('app.get("/api/pcn/notifications"', routeStart);
  assert.ok(routeStart >= 0);
  const routeSlice = serverSource.slice(routeStart, legacyRouteStart > routeStart ? legacyRouteStart : routeStart + 10000);
  assert.doesNotMatch(routeSlice, /(?:UPDATE|DELETE FROM)[\s\S]*(?:activityLogs|pgdActivityLogs)/);
});

test('PCN activity notification trigger persists the shared domain marker', () => {
  const triggerStart = schemaSource.indexOf('CREATE OR REPLACE FUNCTION create_pcn_activity_notification');
  const triggerEnd = schemaSource.indexOf('CREATE OR REPLACE FUNCTION', triggerStart + 1);
  const trigger = schemaSource.slice(triggerStart, triggerEnd > triggerStart ? triggerEnd : triggerStart + 7000);
  assert.match(trigger, /'domain'\s*,\s*'PCN'/);
});
