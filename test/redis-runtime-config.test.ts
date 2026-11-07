import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

function readIfPresent(path: string): string {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, 'utf8') : '';
}

const healthSource = readIfPresent('../app/api/health/route.ts');
const composeSource = readIfPresent('../docker-compose.pcn.yml');
const redisOverlay = readIfPresent('../docker-compose.redis-cache.yml');
const envExample = readIfPresent('../.env.example');
const guide = readIfPresent('../docs/redis-cache.md');

test('health reports only Redis state and basic cache counters without connection details', () => {
  assert.match(healthSource, /getRedisCacheHealth/);
  assert.match(healthSource, /redis\s*:/);
  const redisCacheSource = readIfPresent('../lib/server/redis-cache.ts');
  for (const metric of ['hits', 'misses', 'bypasses', 'errors', 'invalidations']) {
    assert.match(redisCacheSource, new RegExp(`${metric}:`));
  }
  assert.doesNotMatch(healthSource, /REDIS_URL|redisUrl|password|secret/i);
});

test('Compose forwards optional Redis environment without creating or publishing a Redis service', () => {
  assert.match(composeSource, /REDIS_ENABLED:\s*\$\{REDIS_ENABLED:-false\}/);
  assert.match(composeSource, /REDIS_URL:\s*\$\{REDIS_URL:-\}/);
  assert.doesNotMatch(composeSource, /^\s{2}redis:\s*$/m);
  assert.doesNotMatch(composeSource, /6379\s*:/);
  assert.doesNotMatch(composeSource, /NEXT_PUBLIC_REDIS/i);
});

test('environment example and guide show opt-in setup and rollback without credentials', () => {
  assert.match(envExample, /^REDIS_ENABLED=false$/m);
  assert.match(envExample, /^REDIS_URL=$/m);
  assert.match(guide, /REDIS_ENABLED=true/);
  assert.match(guide, /REDIS_URL=redis:\/\//);
  assert.match(guide, /REDIS_ENABLED=false/);
  assert.match(guide, /không tạo Redis container|không publish.*6379/i);
  assert.doesNotMatch(envExample, /redis:\/\/[^\s]*@/i);
});

test('Redis overlay lets operators disable cache while keeping the private endpoint settings separate', () => {
  assert.match(redisOverlay, /REDIS_ENABLED:\s*\$\{REDIS_ENABLED:-true\}/);
  assert.match(redisOverlay, /REDIS_URL:\s*\$\{REDIS_URL:\?Set the server-side Redis URL\}/);
  assert.match(redisOverlay, /REDIS_PASSWORD:\s*\$\{REDIS_PASSWORD:\?Set the server-side Redis password\}/);
  assert.match(redisOverlay, /name:\s*tvci_app_redis_private/);
});
