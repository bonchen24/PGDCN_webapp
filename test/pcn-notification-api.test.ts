import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { createPcnNotificationClient } from '../utils/pcnNotificationApi.ts';

const serverSource = fs.readFileSync(new URL('../server.legacy.ts', import.meta.url), 'utf8');

test('PCN notification routes filter by the session audience and PCN entity allowlist', () => {
  assert.match(serverSource, /app\.get\(["']\/api\/pcn\/notifications["']/);
  assert.match(serverSource, /PCN_NOTIFICATION_ENTITY_TYPES/);
  assert.match(serverSource, /targetUsernames/);
  assert.match(serverSource, /targetRole/);
  assert.match(serverSource, /LIMIT 50/);
});

test('PCN notification mutations deny viewers and never write activity logs', () => {
  const routeStart = serverSource.indexOf('app.get("/api/pcn/notifications"');
  const activityRouteStart = serverSource.indexOf('app.get("/api/activity-logs/summary"');
  const notificationRoutes = serverSource.slice(routeStart, activityRouteStart);

  assert.match(serverSource, /\/api\/pcn\/notifications\/:notificationId\/read/);
  assert.match(serverSource, /\/api\/pcn\/notifications\/read-all/);
  assert.match(serverSource, /\/api\/pcn\/notifications\/clear/);
  assert.match(serverSource, /requirePcnMutation\(req, res\)/);
  assert.match(serverSource, /jsonb_set\(data, '\{read\}'/);
  assert.doesNotMatch(notificationRoutes, /activityLogs/);
});

test('PCN notification client uses the dedicated session boundary', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: init.method || 'GET' });
    return new Response(JSON.stringify({ items: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  };
  const client = createPcnNotificationClient(fetchImpl);

  await client.fetch();
  await client.markRead('n-1');
  await client.markAllRead();
  await client.clear();

  assert.deepEqual(calls, [
    { url: '/api/pcn/notifications', method: 'GET' },
    { url: '/api/pcn/notifications/n-1/read', method: 'POST' },
    { url: '/api/pcn/notifications/read-all', method: 'POST' },
    { url: '/api/pcn/notifications/clear', method: 'POST' },
  ]);
});

test('generic PCN notification collection cannot bypass the dedicated boundary', () => {
  const genericReadStart = serverSource.indexOf('app.get("/api/db/:collection"');
  const genericPutStart = serverSource.indexOf('app.put("/api/db/:collection/:id"');
  const genericDeleteStart = serverSource.indexOf('app.delete("/api/db/:collection/:id"');
  const genericBatchStart = serverSource.indexOf('app.post("/api/db/:collection/batch"');
  const genericDeleteBatchStart = serverSource.indexOf('app.post("/api/db/:collection/delete-batch"');

  assert.match(serverSource.slice(genericReadStart, genericPutStart), /collectionName === 'notifications'/);
  assert.match(serverSource.slice(genericReadStart, genericPutStart), /buildPcnNotificationVisibilityConditions/);
  assert.match(serverSource.slice(genericReadStart, genericPutStart), /LIMIT 50/);
  assert.match(serverSource.slice(genericPutStart, genericDeleteStart), /collectionName === 'notifications'/);
  assert.match(serverSource.slice(genericPutStart, genericDeleteStart), /status\(405\)/);
  assert.match(serverSource.slice(genericDeleteStart, genericBatchStart), /collectionName === 'notifications'/);
  assert.match(serverSource.slice(genericDeleteStart, genericBatchStart), /status\(405\)/);
  assert.match(serverSource.slice(genericBatchStart, genericDeleteBatchStart), /collectionName === 'notifications'/);
  assert.match(serverSource.slice(genericBatchStart, genericDeleteBatchStart), /status\(405\)/);
  assert.match(serverSource.slice(genericDeleteBatchStart), /collectionName === 'notifications'/);
  assert.match(serverSource.slice(genericDeleteBatchStart), /status\(405\)/);
});

test('PCN notification audience gives targeted usernames precedence over a broad role', () => {
  const helperStart = serverSource.indexOf('function buildPcnNotificationVisibilityConditions');
  const helperEnd = serverSource.indexOf('function requirePcnMutationMiddleware', helperStart);
  const audienceHelper = serverSource.slice(helperStart, helperEnd);

  assert.match(audienceHelper, /jsonb_array_length/);
  assert.match(audienceHelper, /jsonb_array_elements_text/);
  assert.match(audienceHelper, /targetUsernames/);
  assert.match(audienceHelper, /targetRole/);
});
