import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import nextConfig from '../next.config.mjs';

function createServiceWorkerHarness(swCode) {
  const listeners = new Map();
  const cacheStorage = new Map();

  class MockCache {
    constructor(name) {
      this.name = name;
      this.items = new Map();
    }
    async addAll(urls) {
      for (const u of urls) {
        this.items.set(u, new Response(`Mock content for ${u}`, { status: 200 }));
      }
    }
    async match(req) {
      const url = typeof req === 'string' ? req : req.url;
      const parsed = new URL(url, 'http://localhost');
      return this.items.get(parsed.pathname) || null;
    }
    async put(req, res) {
      const url = typeof req === 'string' ? req : req.url;
      const parsed = new URL(url, 'http://localhost');
      this.items.set(parsed.pathname, res);
    }
    async delete(req) {
      const url = typeof req === 'string' ? req : req.url;
      const parsed = new URL(url, 'http://localhost');
      return this.items.delete(parsed.pathname);
    }
  }

  const caches = {
    async open(name) {
      if (!cacheStorage.has(name)) {
        cacheStorage.set(name, new MockCache(name));
      }
      return cacheStorage.get(name);
    },
    async keys() {
      return Array.from(cacheStorage.keys());
    },
    async delete(name) {
      return cacheStorage.delete(name);
    },
    async match(req) {
      for (const cache of cacheStorage.values()) {
        const found = await cache.match(req);
        if (found) return found;
      }
      return null;
    },
  };

  const self = {
    addEventListener(event, fn) {
      listeners.set(event, fn);
    },
    skipWaiting() {},
    clients: {
      claim: async () => {},
      matchAll: async () => [],
    },
  };

  const sandbox = {
    self,
    caches,
    fetch: (...args) => globalThis.fetch(...args),
    Response: globalThis.Response,
    Request: globalThis.Request,
    Headers: globalThis.Headers,
    URL: globalThis.URL,
    console,
  };

  vm.createContext(sandbox);
  vm.runInContext(swCode, sandbox);

  return {
    listeners,
    cacheStorage,
    caches,
    trigger: async (event, eventObj) => {
      const handler = listeners.get(event);
      if (handler) {
        let waitPromise = Promise.resolve();
        let respondPromise = Promise.resolve();
        const augmentedEvent = {
          ...eventObj,
          waitUntil: (p) => {
            waitPromise = p;
          },
          respondWith: (p) => {
            respondPromise = p;
          },
        };
        handler(augmentedEvent);
        await waitPromise;
        return respondPromise;
      }
    },
  };
}

test('service worker uses pgdcn-pwa-v6, caches only public allowlist without private root "/"', async () => {
  const swCode = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');

  // Must use v6
  assert.match(swCode, /pgdcn-pwa-v6/);
  assert.doesNotMatch(swCode, /pgdcn-pwa-v5/);

  const harness = createServiceWorkerHarness(swCode);
  await harness.trigger('install', {});

  const v6Cache = harness.cacheStorage.get('pgdcn-pwa-v6');
  assert.ok(v6Cache, 'pgdcn-pwa-v6 cache must exist after install');

  // Must contain offline document and public assets
  assert.ok(v6Cache.items.has('/offline.html'), 'Must cache /offline.html');
  assert.ok(v6Cache.items.has('/tvci_logo.jpg'), 'Must cache /tvci_logo.jpg');
  assert.ok(v6Cache.items.has('/manifest.json'), 'Must cache /manifest.json');

  // Must NOT cache "/" or any private navigation root
  assert.equal(v6Cache.items.has('/'), false, 'Service worker must NEVER cache private root "/"');
});

test('service worker activation selectively cleans up only old pgdcn-pwa-* caches', async () => {
  const swCode = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const harness = createServiceWorkerHarness(swCode);

  // Prepopulate caches
  harness.cacheStorage.set('pgdcn-pwa-v5', new Map());
  harness.cacheStorage.set('pgdcn-pwa-v4', new Map());
  harness.cacheStorage.set('other-app-cache', new Map());

  await harness.trigger('activate', {});

  const remainingKeys = await harness.caches.keys();
  assert.equal(remainingKeys.includes('pgdcn-pwa-v5'), false, 'Old pgdcn-pwa-v5 must be deleted');
  assert.equal(remainingKeys.includes('pgdcn-pwa-v4'), false, 'Old pgdcn-pwa-v4 must be deleted');
  assert.equal(remainingKeys.includes('other-app-cache'), true, 'Unrelated caches must not be deleted');
});

test('service worker navigation fetch is network-only, never caches dynamic HTML/RSC/401/404, and returns generic offline doc when offline', async () => {
  const swCode = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  const harness = createServiceWorkerHarness(swCode);

  await harness.trigger('install', {});
  const v6Cache = harness.cacheStorage.get('pgdcn-pwa-v6');

  const originalFetch = globalThis.fetch;
  try {
    // 1. Online navigation to /settings returning authenticated HTML
    globalThis.fetch = async () =>
      new Response('<html>Settings Page</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      });

    const onlineReq = new Request('http://localhost/settings', {
      headers: { accept: 'text/html' },
    });
    const onlineRes = await harness.trigger('fetch', {
      request: onlineReq,
    });
    assert.equal(onlineRes.status, 200);
    assert.equal(v6Cache.items.has('/settings'), false, 'Must not cache dynamic /settings navigation');

    // 2. Navigation encountering 401
    globalThis.fetch = async () =>
      new Response('Unauthorized', {
        status: 401,
        headers: { 'Content-Type': 'text/html' },
      });

    const unauthReq = new Request('http://localhost/pcn', {
      headers: { accept: 'text/html' },
    });
    const unauthRes = await harness.trigger('fetch', { request: unauthReq });
    assert.equal(unauthRes.status, 401);
    assert.equal(v6Cache.items.has('/pcn'), false, 'Must not cache 401 response');

    // 2b. A missing navigation stays a real 404 and is never cached as a successful page.
    globalThis.fetch = async () => new Response('Not found', { status: 404, headers: { 'Content-Type': 'text/html' } });
    const missingReq = new Request('http://localhost/pcn/dossiers', {
      headers: { accept: 'text/html' },
    });
    const missingRes = await harness.trigger('fetch', { request: missingReq });
    assert.equal(missingRes.status, 404, 'Must preserve the real 404 response');
    assert.equal(v6Cache.items.has('/pcn/dossiers'), false, 'Must not cache a 404 navigation');

    // 3. Next.js RSC request (?_rsc=...)
    globalThis.fetch = async () =>
      new Response('RSC payload', {
        status: 200,
        headers: { 'Content-Type': 'text/x-component' },
      });

    const rscReq = new Request('http://localhost/settings?_rsc=123', {
      headers: { 'RSC': '1' },
    });
    const rscRes = await harness.trigger('fetch', { request: rscReq });
    assert.equal(rscRes.status, 200);
    assert.equal(v6Cache.items.has('/settings'), false, 'Must not cache RSC requests');

    // An allowlisted path still must not cache a response carrying a private cookie.
    v6Cache.items.delete('/tvci_logo.jpg');
    globalThis.fetch = async () =>
      new Response('private asset response', {
        status: 200,
        headers: { 'Content-Type': 'image/jpeg', 'Set-Cookie': 'session=synthetic' },
      });
    const cookieAssetReq = new Request('http://localhost/tvci_logo.jpg');
    const cookieAssetRes = await harness.trigger('fetch', { request: cookieAssetReq });
    assert.equal(cookieAssetRes.status, 200);
    assert.equal(v6Cache.items.has('/tvci_logo.jpg'), false, 'Must not cache a response carrying Set-Cookie');

    // 4. Offline navigation: network fails -> returns generic offline doc, NOT Response.error()
    globalThis.fetch = async () => {
      throw new Error('Network failure');
    };

    const offlineReq = new Request('http://localhost/settings', {
      headers: { accept: 'text/html' },
    });
    const offlineRes = await harness.trigger('fetch', { request: offlineReq });
    assert.ok(offlineRes, 'Must return a response on offline navigation');
    assert.notEqual(offlineRes.type, 'error', 'Must not return Response.error()');
    const offlineBody = await offlineRes.text();
    assert.match(offlineBody, /offline|Không có kết nối mạng/i);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('Next.js config sets no-cache header for /sw.js', async () => {
  assert.equal(typeof nextConfig.headers, 'function', 'nextConfig must define headers function');
  const headersList = await nextConfig.headers();

  const swHeaderConfig = headersList.find(({ source }) => source === '/sw.js');
  assert.ok(swHeaderConfig, 'Must configure headers for /sw.js');

  const cacheControl = swHeaderConfig.headers.find(
    (h) => h.key.toLowerCase() === 'cache-control'
  );
  assert.ok(cacheControl, 'Must set Cache-Control for /sw.js');
  assert.match(cacheControl.value, /no-cache/);
});
