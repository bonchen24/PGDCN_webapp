# PGDCN Settings P0 Repair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Use test-driven development for every behavior change. Work only in the PGDCN settings P0 worktree and keep all backup/restore actions mocked.

**Goal:** Stabilize /settings, session expiry handling, legacy dossier navigation, the admin backup tab, and the PWA service worker without changing database state or other apps.

**Architecture:** Keep authorization in the signed HttpOnly session cookie and existing server RBAC. Use Next.js App Router redirects for the two legacy list URLs. Keep dynamic authenticated pages and APIs network-only in the service worker; cache only an explicit public asset allowlist and a generic offline document. Render backup UI only for admins and fetch its list only after the admin opens that section.

**Stack:** Next.js 16 App Router, React, TypeScript, existing node:test/tsx runner, Playwright with mocked APIs, Docker Compose service webapp.

## Task 1: Define session and legacy route regressions

**Files:** Create test/pcn-session-init.test.ts and test/pcn-legacy-workspace-routes.test.mjs; later modify utils/pcnAuthApi.ts, app/(workspace)/layout.tsx, app/(auth)/login/page.tsx, and next.config.mjs.

- [ ] Write a failing test proving concurrent session initialization shares one GET request and treats HTTP 401 as unauthenticated without retry.

    const [first, second] = await Promise.all([getPcnSession(), getPcnSession()]);
    assert.equal(fetchCalls, 1);
    assert.equal(first, null);
    assert.equal(second, null);

- [ ] Run only the new test with the repository runner and confirm it fails because requests are not deduplicated.

    node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-session-init.test.ts

- [ ] Write a failing test asserting the Next config maps /pcn/dossiers to /pcn and /pgd/dossiers to /pgd with temporary 307 redirects.

    const redirects = await nextConfig.redirects();
    assert.deepEqual(
      redirects.filter(({ source }) => source.endsWith('/dossiers')),
      expectedLegacyRedirects,
    );

- [ ] Run that test and confirm it fails because no redirects are configured.

- [ ] Implement an in-flight-only promise cache in getPcnSession, request with cache: no-store, preserve 401 as null, and clear the in-flight promise when settled.

- [ ] Update the workspace gate to redirect 401 to /login?reason=session-expired&returnTo=..., show a visible status while routing, and show a recoverable retry state for network/server errors instead of an indefinite spinner.

- [ ] Update login to show “Phiên đăng nhập hết hạn” for that reason and return only to a same-origin path after successful login; keep the existing root fallback.

- [ ] Add the two Next.js redirects entries. The Next.js 16 config guide confirms query strings pass through and permanent: false creates an uncached 307.

- [ ] Re-run both new tests and the focused existing session/navigation contracts.

## Task 2: Make settings sections explicit and backup loading lazy

**Files:** Create test/pcn-settings-p0.test.ts; modify components/PgdcnSystemSettingsView.tsx, components/BackupRestoreAdminPanel.tsx, utils/backupApi.ts, and app/(workspace)/settings/page.tsx.

- [ ] Add failing tests for role-safe rendering: admin can open both sections, an authorized organization manager sees personnel only, staff/viewer receives an explicit denied state, and unauthorized roles never mount the backup panel.

- [ ] Add a failing client contract asserting backup listing sends same-origin session credentials and no x-user-name identity header.

    await fetchBackupList();
    assert.equal(captured.credentials, 'same-origin');
    assert.equal(captured.headers.has('x-user-name'), false);

- [ ] Add a failing lazy-load test: an admin opening settings makes zero backup requests; activating “Sao lưu & dữ liệu” makes one GET; revisiting the section does not repeat the initial GET.

- [ ] Implement a responsive, keyboard-operable two-tab settings switcher for admins with “Nhân sự & phân quyền” and “Sao lưu & dữ liệu”; managers get the personnel section without an admin tab.

- [ ] Keep the backup panel unmounted until first selected, then retain it while hidden so tab changes do not refetch.

- [ ] Remove client-provided username headers and use the signed same-origin cookie. Keep server requirePcnAdmin as the authoritative boundary.

- [ ] Replace toast-only list failures with visible loading, empty, HTTP 401/403/404, network error, and manual retry states. Never call backup, restore, verify, download, or delete during QA.

- [ ] Re-run the new role/loading/API tests and existing backup/RBAC contracts.

## Task 3: Remove private responses from the service worker cache

**Files:** Create public/offline.html and test/pcn-service-worker-policy.test.mjs; modify public/sw.js, next.config.mjs, and the relevant PWA/settings sections of design.md.

- [ ] Build a Node VM harness for public/sw.js and first assert failing behavior: authenticated navigations, 401/404 responses, RSC requests, and API paths are never cached; an offline navigation returns a generic public 503 document rather than Response.error().

- [ ] Run the new service-worker test and confirm it fails against the current v5 worker.

- [ ] Use a new pgdcn-pwa-v6 cache and delete only old caches beginning pgdcn-pwa-.

- [ ] Cache only an explicit allowlist of public icons, logo, manifest, and the generic offline document. Do not cache navigation HTML, /_next, APIs, auth routes, settings, private pages, ?_rsc, non-OK responses, or responses with Set-Cookie.

- [ ] Make document and RSC navigation requests network-only. On network failure, return only the generic offline document; never return a cached application page.

- [ ] Add a no-cache response header for /sw.js using Next.js 16 headers() config so clients discover the new worker promptly.

- [ ] Update design.md to replace its obsolete “return Response.error()” rule with the public-asset-only cache policy, generic offline response, and cookie/RBAC rules. Update the settings contract with the lazy admin-only backup tab.

- [ ] Re-run the worker test and existing PWA/app-shell contract tests.

## Task 4: Mocked browser QA and release verification

**Files:** Create test/settings-p0.playwright.test.mjs; write screenshots only under .worktrees/task-c2c-settings-p0-20261106/qa-artifacts/settings-p0/.

- [ ] Use mocked session and user APIs only; create synthetic admin, organization-manager, staff, and viewer states. Never use a real account or send a backup mutation.

- [ ] At widths 320, 390, 1366, and 1440, assert no viewport horizontal overflow, visible headings/controls, keyboard focus, role-correct tabs, and zero backup GETs until the admin opens that tab.

- [ ] Assert the mocked backup tab sends one GET and no POST/DELETE. Capture synthetic role screenshots with explicit viewport and role names.

- [ ] Run npm run test:pcn, npm run typecheck, npm run build, and git diff --check. Review every changed path and run the Impeccable detector once on changed UI files.

- [ ] Before deployment, tag the current pcn_webapp-webapp image as the rollback image. Deploy only Compose project pgdcn_webapp, service webapp, with --no-deps; suppress Compose output that might include environment values. Do not run migrations, database health checks, backup tools, pg_dump, or any Supabase service/container/volume operation.

- [ ] Smoke only the app routes at http://localhost:2357 and https://pgdcn.tvci.id.vn: public pages, legacy redirects, /api/auth/pcn-session as an unauthenticated guest (401 is expected), and /api/backups unauthenticated (401/403 proves the route is registered; do not authenticate or enumerate backups).

- [ ] Confirm production /sw.js serves v6 with no-cache headers and that the settings route loads the login boundary without a false authenticated state.

## Completion review

- [ ] Record each original browser error and its post-fix status, including expected guest 401.
- [ ] Record test/build results, synthetic screenshot paths, commit hashes, push result, deployed image digest, and any external proxy/deploy limitation.
- [ ] Verify the QA-hardening worktree and root checkout still contain their original unrelated changes; stage only explicit settings P0 paths.
