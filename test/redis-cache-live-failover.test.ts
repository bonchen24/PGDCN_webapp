import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  getRedisCacheHealth,
  readThroughRedisCache,
} from '../lib/server/redis-cache.ts';

test('live redis cache fails over to postgres when redis is unreachable', async () => {
  const enabled = process.env.REDIS_ENABLED;
  const redisUrl = process.env.REDIS_URL;
  const redisPassword = process.env.REDIS_PASSWORD;

  assert.equal(enabled, 'true', 'REDIS_ENABLED must be set to "true"');
  assert.ok(redisUrl, 'REDIS_URL is required for live failover test');
  assert.ok(redisPassword, 'REDIS_PASSWORD is required for live failover test');

  const scopeId = crypto.randomUUID();
  const scope = { username: `failover-user-${scopeId}`, role: 'staff' };
  let loads = 0;
  const loader = async () => ({
    source: 'postgres',
    call: ++loads,
  });

  const result = await readThroughRedisCache({
    app: 'pcn',
    resource: 'workflow-templates',
    scope,
    loader,
  });

  assert.deepEqual(result, { source: 'postgres', call: 1 });
  assert.equal(loads, 1);

  const health = getRedisCacheHealth();
  assert.equal(health.enabled, true);
  assert.equal(health.connected, false);
  assert.equal(health.metrics.errors, 1);
  assert.equal(health.metrics.bypasses, 1);
});
