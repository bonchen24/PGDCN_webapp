import assert from 'node:assert/strict';
import test from 'node:test';
import { GET } from '../app/api/health/route.ts';

const metadataKeys = ['BUILD_REVISION', 'BUILD_CREATED_AT', 'REDIS_ENABLED', 'REDIS_URL', 'REDIS_PASSWORD'] as const;

function setEnv(values: Partial<Record<(typeof metadataKeys)[number], string>>) {
  const previous = new Map(metadataKeys.map((key) => [key, process.env[key]]));
  for (const key of metadataKeys) {
    const value = values[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return () => {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  };
}

test('health exposes build revision and creation time without returning Redis credentials', async (t) => {
  const restore = setEnv({
    BUILD_REVISION: 'a1b2c3d4e5f6789012345678901234567890abcd',
    BUILD_CREATED_AT: '2026-11-10T08:00:00Z',
    REDIS_ENABLED: 'false',
    REDIS_URL: 'redis://qa-user:qa-only-password@redis.test:6379',
    REDIS_PASSWORD: 'qa-only-password',
  });
  t.after(restore);

  const response = await GET();
  const payload = await response.json();

  assert.equal(payload.build.revision, 'a1b2c3d4e5f6789012345678901234567890abcd');
  assert.equal(payload.build.createdAt, '2026-11-10T08:00:00Z');
  assert.equal(payload.redis.enabled, false);
  assert.doesNotMatch(JSON.stringify(payload), /qa-only-password|redis:\/\/qa-user/i);
});

test('health omits malformed build metadata instead of echoing arbitrary input', async (t) => {
  const restore = setEnv({
    BUILD_REVISION: 'qa-only-password',
    BUILD_CREATED_AT: 'redis-password-is-not-a-timestamp',
    REDIS_ENABLED: 'false',
  });
  t.after(restore);

  const response = await GET();
  const payload = await response.json();

  assert.deepEqual(payload.build, { revision: null, createdAt: null });
  assert.doesNotMatch(JSON.stringify(payload), /qa-only-password|redis-password/i);
});
