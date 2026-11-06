import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { getPcnSession } from '../utils/pcnAuthApi.ts';

test('concurrent getPcnSession calls share one in-flight request and treat 401 as unauthenticated', async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  const capturedOptions: RequestInit[] = [];

  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls++;
    capturedOptions.push(init || {});
    await new Promise((resolve) => setTimeout(resolve, 10));
    return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  try {
    const [first, second] = await Promise.all([getPcnSession(), getPcnSession()]);
    assert.equal(fetchCalls, 1, 'Concurrent calls should share a single in-flight fetch');
    assert.equal(first, null, 'HTTP 401 should resolve to null');
    assert.equal(second, null, 'HTTP 401 should resolve to null');
    assert.equal(capturedOptions[0]?.cache, 'no-store', 'Session request must specify cache: no-store');
    assert.equal(capturedOptions[0]?.credentials, 'same-origin', 'Session request must use same-origin credentials');

    // Subsequent call after settling should initiate a new fetch
    const third = await getPcnSession();
    assert.equal(fetchCalls, 2, 'Settled cache should be cleared allowing a new fetch');
    assert.equal(third, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('workspace layout redirects 401 to login with session-expired and safe returnTo, and provides retry on error', () => {
  const layoutSource = readFileSync(new URL('../app/(workspace)/layout.tsx', import.meta.url), 'utf8');

  // Must redirect to session-expired and returnTo
  assert.match(layoutSource, /reason=session-expired/);
  assert.match(layoutSource, /returnTo=/);

  // Must show visible status during routing or expired state
  assert.match(layoutSource, /Phiên đăng nhập đã hết hạn|Đang chuyển hướng/);

  // Must provide recoverable retry state for network / server error instead of permanent spinner
  assert.match(layoutSource, /Thử lại|loadSession|checkSession/);
  assert.match(layoutSource, /Lỗi kết nối|Không thể xác thực phiên/);
});

test('workspace session initialization depends on stable store actions, not the changing full stores', () => {
  const layoutSource = readFileSync(new URL('../app/(workspace)/layout.tsx', import.meta.url), 'utf8');

  assert.match(layoutSource, /const loadPcn\s*=\s*usePcnStore\(\(state\)\s*=>\s*state\.load\)/);
  assert.match(layoutSource, /const loadPgd\s*=\s*usePgdStore\(\(state\)\s*=>\s*state\.load\)/);
  assert.match(layoutSource, /\}, \[clearCurrentUser, loadPcn, loadPgd, router, setCurrentUser\]\);/);
  assert.doesNotMatch(layoutSource, /\}, \[clearCurrentUser, pcn, pgd, router, setCurrentUser\]\);/);
});

test('login page displays session expired notice and safely handles returnTo redirect', () => {
  const loginSource = readFileSync(new URL('../app/(auth)/login/page.tsx', import.meta.url), 'utf8');

  // Reason banner
  assert.match(loginSource, /Phiên đăng nhập hết hạn/);

  // Safe returnTo check
  assert.match(loginSource, /returnTo/);
  // Ensure open redirect protection (must not navigate to arbitrary protocol or external URL)
  assert.match(loginSource, /startsWith\('\/'\)/);
});
