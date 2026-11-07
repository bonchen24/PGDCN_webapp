import assert from 'node:assert/strict';
import test from 'node:test';

import { createRedisReadCache, type RedisCacheStore } from '../lib/server/redis-cache.ts';

class FakeRedisStore implements RedisCacheStore {
  readonly values = new Map<string, { value: string; expiresAt: number }>();
  readonly ttlSeconds: number[] = [];
  now = 0;
  failGet = false;
  failSet = false;
  failIncr = false;
  hangGet = false;
  corruptNextGet = false;

  async get(key: string, signal?: AbortSignal): Promise<string | null> {
    if (this.hangGet) {
      return new Promise((_resolve, reject) => {
        signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      });
    }
    if (this.failGet) throw new Error('redis down');
    if (this.corruptNextGet && key.includes(':scope:')) {
      this.corruptNextGet = false;
      return '{not-json';
    }
    const entry = this.values.get(key);
    if (!entry || entry.expiresAt <= this.now) return null;
    return entry.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    if (this.failSet) throw new Error('redis write failed');
    this.ttlSeconds.push(ttlSeconds);
    this.values.set(key, { value, expiresAt: this.now + ttlSeconds * 1000 });
  }

  async incr(key: string): Promise<number> {
    if (this.failIncr) throw new Error('redis invalidation failed');
    const current = Number(this.values.get(key)?.value || 0) + 1;
    this.values.set(key, { value: String(current), expiresAt: Number.POSITIVE_INFINITY });
    return current;
  }
}

function createCache(store: RedisCacheStore, options: { enabled?: boolean; timeoutMs?: number; cooldownMs?: number } = {}) {
  return createRedisReadCache({
    enabled: options.enabled ?? true,
    storeProvider: async () => store,
    commandTimeoutMs: options.timeoutMs ?? 30,
    retryCooldownMs: options.cooldownMs ?? 1000,
  });
}

const read = <T>(cache: ReturnType<typeof createRedisReadCache>, app: 'pcn' | 'pgd', scope: Record<string, unknown>, loader: () => Promise<T>) =>
  cache.readThrough({ app, resource: 'workflow-templates', scope, loader });

test('read-through cache serves a miss from PostgreSQL once, then records a hit', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);
  let loads = 0;
  const loader = async () => ({ items: [{ id: `template-${++loads}` }] });

  assert.deepEqual(await read(cache, 'pcn', { username: 'anna', role: 'staff' }, loader), { items: [{ id: 'template-1' }] });
  assert.deepEqual(await read(cache, 'pcn', { username: 'anna', role: 'staff' }, loader), { items: [{ id: 'template-1' }] });
  assert.equal(loads, 1);
  assert.equal(cache.getHealth().metrics.misses, 1);
  assert.equal(cache.getHealth().metrics.hits, 1);
});

test('read-through cache expires entries after the bounded TTL', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);
  let loads = 0;
  const scope = { username: 'anna', role: 'staff' };

  await read(cache, 'pcn', scope, async () => ++loads);
  assert.deepEqual(store.ttlSeconds, [15]);
  store.now += 15_001;
  assert.equal(await read(cache, 'pcn', scope, async () => ++loads), 2);
  assert.equal(cache.getHealth().metrics.misses, 2);
});

test('requested TTL cannot exceed the 15-second safety bound', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);

  await cache.readThrough({
    app: 'pcn',
    resource: 'workflow-templates',
    scope: { username: 'anna' },
    ttlSeconds: 300,
    loader: async () => 'template list',
  });

  assert.deepEqual(store.ttlSeconds, [15]);
});

test('generation invalidation makes prior scoped values unreachable', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);
  const scope = { username: 'anna', role: 'manager' };

  assert.equal(await read(cache, 'pgd', scope, async () => 'before'), 'before');
  await cache.invalidate('pgd', 'workflow-templates');
  assert.equal(await read(cache, 'pgd', scope, async () => 'after'), 'after');
  assert.equal(cache.getHealth().metrics.invalidations, 1);
});

test('generation invalidation propagates across cache instances sharing Redis', async () => {
  const store = new FakeRedisStore();
  const reader = createCache(store);
  const writer = createCache(store);
  const scope = { username: 'anna', role: 'manager' };
  let loads = 0;

  assert.equal(await read(reader, 'pgd', scope, async () => `version-${++loads}`), 'version-1');
  await writer.invalidate('pgd', 'workflow-templates');
  assert.equal(await read(reader, 'pgd', scope, async () => `version-${++loads}`), 'version-2');
  assert.equal(loads, 2);
});

test('app and user access scope isolate template results without raw identity in Redis keys', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);

  assert.equal(await read(cache, 'pcn', { username: 'anna', role: 'staff', fieldCodes: ['QC4'] }, async () => 'pcn-private'), 'pcn-private');
  assert.equal(await read(cache, 'pgd', { username: 'anna', role: 'staff', fieldCodes: ['QC4'] }, async () => 'pgd-private'), 'pgd-private');
  assert.equal(await read(cache, 'pcn', { username: 'bo', role: 'staff', fieldCodes: ['QC4'] }, async () => 'bo-private'), 'bo-private');
  assert.equal(await read(cache, 'pcn', { username: 'anna', role: 'staff', fieldCodes: ['QC4'] }, async () => 'should-not-load'), 'pcn-private');

  assert.equal(store.values.size, 3);
  assert.ok([...store.values.keys()].every((key) => !key.includes('anna') && !key.includes('bo')));
});

test('the same account with a changed role or department scope does not share cached templates', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);

  assert.equal(await read(cache, 'pgd', { username: 'anna', manager: false, departmentScopes: ['PGD'] }, async () => 'staff view'), 'staff view');
  assert.equal(await read(cache, 'pgd', { username: 'anna', manager: true, departmentScopes: ['PCN', 'PGD'] }, async () => 'manager view'), 'manager view');
  assert.equal(store.values.size, 2);
});

test('concurrent misses for the same scoped key coalesce to one PostgreSQL read', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);
  let loads = 0;
  let markStarted!: () => void;
  const loaderStarted = new Promise<void>((resolve) => { markStarted = resolve; });
  let release!: (value: string) => void;
  const loader = async () => {
    loads++;
    markStarted();
    return new Promise<string>((resolve) => { release = resolve; });
  };

  const first = read(cache, 'pcn', { username: 'anna', role: 'manager' }, loader);
  const second = read(cache, 'pcn', { username: 'anna', role: 'manager' }, loader);
  await loaderStarted;
  release('shared');
  assert.deepEqual(await Promise.all([first, second]), ['shared', 'shared']);
  assert.equal(loads, 1);
});

test('disabled Redis uses the loader directly without requesting a store', async () => {
  const store = new FakeRedisStore();
  let providers = 0;
  const cache = createRedisReadCache({ enabled: false, storeProvider: async () => { providers++; return store; } });

  assert.equal(await read(cache, 'pcn', { username: 'anna' }, async () => 'postgres'), 'postgres');
  assert.equal(providers, 0);
  assert.equal(cache.getHealth().metrics.bypasses, 1);
});

test('empty access scope bypasses Redis instead of creating an unscoped cache entry', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);
  let loads = 0;

  assert.equal(await read(cache, 'pcn', {}, async () => ++loads), 1);
  assert.equal(await read(cache, 'pcn', {}, async () => ++loads), 2);
  assert.equal(store.values.size, 0);
  assert.equal(cache.getHealth().metrics.bypasses, 2);
});

test('Redis errors fall through to PostgreSQL and apply a short retry cooldown', async () => {
  const store = new FakeRedisStore();
  store.failGet = true;
  let providers = 0;
  const cache = createRedisReadCache({
    enabled: true,
    storeProvider: async () => { providers++; return store; },
    retryCooldownMs: 1000,
  });

  assert.equal(await read(cache, 'pgd', { username: 'anna' }, async () => 'first db read'), 'first db read');
  assert.equal(await read(cache, 'pgd', { username: 'anna' }, async () => 'second db read'), 'second db read');
  assert.equal(providers, 1);
  assert.equal(cache.getHealth().metrics.errors, 1);
  assert.equal(cache.getHealth().metrics.bypasses, 2);
});

test('Redis resumes cache reads after the retry cooldown', async () => {
  const store = new FakeRedisStore();
  store.failGet = true;
  const cache = createCache(store, { cooldownMs: 1 });

  assert.equal(await read(cache, 'pcn', { username: 'anna' }, async () => 'first db read'), 'first db read');
  store.failGet = false;
  await new Promise((resolve) => setTimeout(resolve, 3));
  assert.equal(await read(cache, 'pcn', { username: 'anna' }, async () => 'second db read'), 'second db read');
  assert.equal(cache.getHealth().metrics.misses, 1);
});

test('failed invalidation does not escape into a mutation caller', async () => {
  const store = new FakeRedisStore();
  store.failIncr = true;
  const cache = createCache(store);

  await assert.doesNotReject(cache.invalidate('pcn', 'workflow-templates'));
  assert.equal(cache.getHealth().metrics.errors, 1);
  assert.equal(cache.getHealth().connected, false);
});

test('a stalled Redis command times out and does not block the database fallback', async () => {
  const store = new FakeRedisStore();
  store.hangGet = true;
  const cache = createCache(store, { timeoutMs: 10 });

  assert.equal(await read(cache, 'pcn', { username: 'anna' }, async () => 'postgres'), 'postgres');
  assert.equal(cache.getHealth().metrics.errors, 1);
  assert.equal(cache.getHealth().connected, false);
});

test('malformed cached JSON and Redis write failures do not change loader results', async () => {
  const store = new FakeRedisStore();
  const cache = createCache(store);
  store.corruptNextGet = true;
  assert.deepEqual(await read(cache, 'pgd', { username: 'anna' }, async () => ({ items: ['fresh'] })), { items: ['fresh'] });

  store.failSet = true;
  assert.equal(await read(cache, 'pgd', { username: 'bo' }, async () => 'database wins'), 'database wins');
  assert.equal(cache.getHealth().metrics.errors, 2);
});
