import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createClient } from 'redis';

import {
  getRedisCacheHealth,
  invalidateRedisCache,
  readThroughRedisCache,
} from '../lib/server/redis-cache.ts';

test('live redis cache operates end-to-end with authentication, invalidation, and timeout fallback', async () => {
  const enabled = process.env.REDIS_ENABLED;
  const redisUrl = process.env.REDIS_URL;
  const redisPassword = process.env.REDIS_PASSWORD;

  assert.equal(enabled, 'true', 'REDIS_ENABLED must be set to "true"');
  assert.ok(redisUrl, 'REDIS_URL is required for live integration test');
  assert.ok(redisPassword, 'REDIS_PASSWORD is required for live integration test');

  let blocker: ReturnType<typeof createClient> | null = null;

  try {
    const scopeId = crypto.randomUUID();
    const scope = { username: `live-user-${scopeId}`, role: 'staff' };
    let loads = 0;
    const loader = async () => ({
      items: [{ id: `template-${++loads}` }],
    });

    const firstResult = await readThroughRedisCache({
      app: 'pcn',
      resource: 'workflow-templates',
      scope,
      loader,
    });
    assert.deepEqual(firstResult, { items: [{ id: 'template-1' }] });
    assert.equal(loads, 1);

    const secondResult = await readThroughRedisCache({
      app: 'pcn',
      resource: 'workflow-templates',
      scope,
      loader,
    });
    assert.deepEqual(secondResult, { items: [{ id: 'template-1' }] });
    assert.equal(loads, 1);

    const health1 = getRedisCacheHealth();
    assert.equal(health1.enabled, true);
    assert.equal(health1.connected, true);
    assert.equal(health1.metrics.misses, 1);
    assert.equal(health1.metrics.hits, 1);
    const healthJson = JSON.stringify(health1);
    assert.equal(healthJson.includes(redisUrl), false);
    assert.equal(healthJson.includes(redisPassword), false);

    const pgdScope = { ...scope, departmentScopes: ['PGD'] };
    let pgdLoads = 0;
    const pgdLoader = async () => ({ items: [{ id: `pgd-template-${++pgdLoads}` }] });
    const firstPgdResult = await readThroughRedisCache({
      app: 'pgd',
      resource: 'workflow-templates',
      scope: pgdScope,
      loader: pgdLoader,
    });
    assert.deepEqual(firstPgdResult, { items: [{ id: 'pgd-template-1' }] });
    assert.deepEqual(await readThroughRedisCache({
      app: 'pgd',
      resource: 'workflow-templates',
      scope: pgdScope,
      loader: pgdLoader,
    }), { items: [{ id: 'pgd-template-1' }] });
    assert.equal(pgdLoads, 1);

    await invalidateRedisCache('pcn', 'workflow-templates');

    const thirdResult = await readThroughRedisCache({
      app: 'pcn',
      resource: 'workflow-templates',
      scope,
      loader,
    });
    assert.deepEqual(thirdResult, { items: [{ id: 'template-2' }] });
    assert.equal(loads, 2);
    assert.deepEqual(await readThroughRedisCache({
      app: 'pgd',
      resource: 'workflow-templates',
      scope: pgdScope,
      loader: pgdLoader,
    }), { items: [{ id: 'pgd-template-1' }] });
    assert.equal(pgdLoads, 1, 'PCN generation invalidation must not invalidate PGD templates');

    await invalidateRedisCache('pgd', 'workflow-templates');
    assert.deepEqual(await readThroughRedisCache({
      app: 'pgd',
      resource: 'workflow-templates',
      scope: pgdScope,
      loader: pgdLoader,
    }), { items: [{ id: 'pgd-template-2' }] });
    assert.equal(pgdLoads, 2);

    const health2 = getRedisCacheHealth();
    assert.equal(health2.metrics.invalidations, 2);

    blocker = createClient({
      url: redisUrl,
      password: redisPassword,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: false,
      },
    });
    await blocker.connect();

    const sleepPromise = blocker.sendCommand(['DEBUG', 'SLEEP', '0.4']);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const timeoutScope = { username: `timeout-user-${scopeId}`, role: 'staff' };
    const start = Date.now();
    const fallbackResult = await readThroughRedisCache({
      app: 'pcn',
      resource: 'workflow-templates',
      scope: timeoutScope,
      loader: async () => ({ items: [{ id: 'fallback-result' }] }),
    });
    const elapsedMs = Date.now() - start;

    assert.deepEqual(fallbackResult, { items: [{ id: 'fallback-result' }] });
    assert.ok(elapsedMs < 1000, `Expected command to timeout and fallback quickly, took ${elapsedMs}ms`);

    const health3 = getRedisCacheHealth();
    assert.ok(health3.metrics.errors >= 1, 'Expected at least 1 error recorded during Redis stall');

    await sleepPromise.catch(() => {});
  } finally {
    if (blocker) {
      try {
        blocker.destroy();
      } catch {
        // Ignore blocker client cleanup error
      }
    }
  }
});
