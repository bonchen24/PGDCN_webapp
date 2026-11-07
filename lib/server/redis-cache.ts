import crypto from 'node:crypto';
import { createClient } from 'redis';

export type RedisCacheApp = 'pcn' | 'pgd';
export type RedisCacheResource = 'workflow-templates';

export type RedisCacheStore = {
  get(key: string, signal?: AbortSignal): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number, signal?: AbortSignal): Promise<void>;
  incr(key: string, signal?: AbortSignal): Promise<number>;
};

export type RedisCacheMetrics = {
  hits: number;
  misses: number;
  bypasses: number;
  errors: number;
  invalidations: number;
};

export type RedisCacheHealth = {
  enabled: boolean;
  connected: boolean;
  metrics: RedisCacheMetrics;
};

export type CreateRedisReadCacheOptions = {
  enabled: boolean;
  storeProvider: () => Promise<RedisCacheStore>;
  commandTimeoutMs?: number;
  retryCooldownMs?: number;
};

export type ReadThroughOptions<T> = {
  app: RedisCacheApp;
  resource: RedisCacheResource;
  scope: Record<string, unknown>;
  loader: () => Promise<T>;
  ttlSeconds?: number;
};

const DEFAULT_TTL_SECONDS = 15;
const MAX_TTL_SECONDS = 15;

function canonicalize(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(canonicalize);
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const k of keys) {
    sortedObj[k] = canonicalize((obj as Record<string, unknown>)[k]);
  }
  return sortedObj;
}

function hashScope(scope: Record<string, unknown>): string {
  const canonicalJson = JSON.stringify(canonicalize(scope));
  return crypto.createHash('sha256').update(canonicalJson).digest('hex');
}

export function createRedisReadCache(options: CreateRedisReadCacheOptions) {
  const {
    enabled,
    storeProvider,
    commandTimeoutMs = 150,
    retryCooldownMs = 1000,
  } = options;

  const metrics: RedisCacheMetrics = {
    hits: 0,
    misses: 0,
    bypasses: 0,
    errors: 0,
    invalidations: 0,
  };

  let connected = false;
  let cooldownUntil = 0;
  const inFlightLoads = new Map<string, Promise<any>>();

  function enterCooldown() {
    connected = false;
    cooldownUntil = Date.now() + retryCooldownMs;
  }

  async function executeCommand<R>(op: (store: RedisCacheStore, signal: AbortSignal) => Promise<R>): Promise<R> {
    const store = await storeProvider();
    const ac = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        const error = new Error('Redis command timed out');
        ac.abort(error);
        reject(error);
      }, commandTimeoutMs);
    });
    try {
      const result = await Promise.race([op(store, ac.signal), timeout]);
      connected = true;
      return result;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function invalidate(app: RedisCacheApp, resource: RedisCacheResource): Promise<void> {
    if (!enabled) return;
    const genKey = `tvci:pgdcn:v1:${app}:${resource}:generation`;
    try {
      await executeCommand((store, signal) => store.incr(genKey, signal));
      metrics.invalidations++;
    } catch {
      metrics.errors++;
      enterCooldown();
    }
  }

  async function getGeneration(app: RedisCacheApp, resource: RedisCacheResource): Promise<number> {
    const genKey = `tvci:pgdcn:v1:${app}:${resource}:generation`;
    const raw = await executeCommand((store, signal) => store.get(genKey, signal));
    if (raw === null) return 0;
    const generation = Number(raw);
    if (!Number.isSafeInteger(generation) || generation < 0) {
      throw new Error('Invalid Redis cache generation');
    }
    return generation;
  }

  async function readThrough<T>(opts: ReadThroughOptions<T>): Promise<T> {
    const { app, resource, scope, loader } = opts;
    const requestedTtl = opts.ttlSeconds ?? DEFAULT_TTL_SECONDS;
    const ttlSeconds = Math.max(1, Math.min(Number.isFinite(requestedTtl) ? Math.floor(requestedTtl) : DEFAULT_TTL_SECONDS, MAX_TTL_SECONDS));

    if (!enabled || Object.keys(scope || {}).length === 0 || Date.now() < cooldownUntil) {
      metrics.bypasses++;
      return loader();
    }

    const scopeHash = hashScope(scope);
    let generation: number;
    try {
      generation = await getGeneration(app, resource);
    } catch {
      metrics.errors++;
      enterCooldown();
      metrics.bypasses++;
      return loader();
    }
    const dataKey = `tvci:pgdcn:v1:${app}:${resource}:scope:${scopeHash}:g${generation}`;
    let cachedVal: string | null = null;

    try {
      cachedVal = await executeCommand((store, signal) => store.get(dataKey, signal));
    } catch {
      metrics.errors++;
      enterCooldown();
      metrics.bypasses++;
      return loader();
    }

    if (cachedVal !== null) {
      try {
        const parsed = JSON.parse(cachedVal) as T;
        metrics.hits++;
        return parsed;
      } catch {
        // Malformed cached JSON: record error, treat as cache miss/fallback without marking transport unavailable
        metrics.errors++;
      }
    }

    metrics.misses++;

    // Coalesce concurrent loader calls for identical app/resource/scope/generation
    const coalesceKey = `${app}:${resource}:${scopeHash}:${generation}`;
    let loadPromise = inFlightLoads.get(coalesceKey);

    if (!loadPromise) {
      loadPromise = (async () => {
        try {
          const loaded = await loader();
          if (dataKey) {
            try {
              await executeCommand((store, signal) =>
                store.set(dataKey!, JSON.stringify(loaded), ttlSeconds, signal)
              );
            } catch {
              metrics.errors++;
              enterCooldown();
            }
          }
          return loaded;
        } finally {
          inFlightLoads.delete(coalesceKey);
        }
      })();
      inFlightLoads.set(coalesceKey, loadPromise);
    }

    return loadPromise;
  }

  function getHealth(): RedisCacheHealth {
    return {
      enabled,
      connected,
      metrics: { ...metrics },
    };
  }

  return {
    readThrough,
    invalidate,
    getHealth,
  };
}

let productionClient: { isReady: boolean; destroy(): void } | null = null;
let productionStorePromise: Promise<RedisCacheStore> | null = null;

function getProductionStoreProvider(): () => Promise<RedisCacheStore> {
  return async () => {
    if (productionStorePromise) return productionStorePromise;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) throw new Error('REDIS_URL is not configured');

    const redisPassword = process.env.REDIS_PASSWORD;
    const client = createClient({
      url: redisUrl,
      password: redisPassword || undefined,
      socket: {
        connectTimeout: 150,
        reconnectStrategy: false,
      },
      disableOfflineQueue: true,
    });
    productionClient = client;
    client.on('error', () => {
      if (productionClient === client) {
        productionClient = null;
        productionStorePromise = null;
        try { client.destroy(); } catch { /* The next request may create a fresh connection. */ }
      }
    });

    const store: RedisCacheStore = {
      async get(key: string, signal?: AbortSignal) {
        const commandClient = signal ? client.withAbortSignal(signal) : client;
        return ((await commandClient.get(key)) as string | null) ?? null;
      },
      async set(key: string, value: string, ttlSeconds: number, signal?: AbortSignal) {
        const commandClient = signal ? client.withAbortSignal(signal) : client;
        await commandClient.set(key, value, { EX: ttlSeconds });
      },
      async incr(key: string, signal?: AbortSignal) {
        const commandClient = signal ? client.withAbortSignal(signal) : client;
        return await commandClient.incr(key);
      },
    };

    const connecting = client.connect().then(() => store).catch((error) => {
      if (productionClient === client) {
        productionClient = null;
        productionStorePromise = null;
      }
      try { client.destroy(); } catch { /* Preserve the original connection error for the cache fallback. */ }
      throw error;
    });
    productionStorePromise = connecting;
    return connecting;
  };
}

function isRedisEnabled(): boolean {
  const isEnabled = String(process.env.REDIS_ENABLED || '').toLowerCase() === 'true';
  const hasUrl = Boolean(process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '');
  return isEnabled && hasUrl;
}

let defaultCacheInstance: ReturnType<typeof createRedisReadCache> | null = null;

function getDefaultCache() {
  if (!defaultCacheInstance) {
    defaultCacheInstance = createRedisReadCache({
      enabled: isRedisEnabled(),
      storeProvider: getProductionStoreProvider(),
      commandTimeoutMs: 150,
      retryCooldownMs: 1000,
    });
  }
  return defaultCacheInstance;
}

export async function readThroughRedisCache<T>(opts: ReadThroughOptions<T>): Promise<T> {
  return getDefaultCache().readThrough(opts);
}

export async function invalidateRedisCache(app: RedisCacheApp, resource: RedisCacheResource): Promise<void> {
  return getDefaultCache().invalidate(app, resource);
}

export function getRedisCacheHealth(): RedisCacheHealth {
  const health = getDefaultCache().getHealth();
  return {
    ...health,
    connected: health.connected && Boolean(productionClient?.isReady),
  };
}
