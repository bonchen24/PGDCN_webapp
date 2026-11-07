# Redis Template Read Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, fail-open Redis read-through cache to the existing PCN and PGD workflow-template list APIs while PostgreSQL remains authoritative.

**Architecture:** A server-only `redis` client backs a small injectable read-through cache with scoped, versioned keys, a 15-second TTL, generation invalidation, bounded commands, disabled reconnect/offline queue, and short cooldown after errors. Existing route authorization and SQL remain in place; cache calls happen only after authorization, and template mutations invalidate after their PostgreSQL transaction succeeds.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL (`pg`), node-redis v6, Node test runner with `tsx` and fake Redis stores.

**Spec:** `docs/superpowers/specs/2026-11-07-redis-template-read-cache-design.md`; architectural contract in `design.md` §§7.2–7.4 and §10.

## Global Constraints

- `REDIS_ENABLED` defaults to `false`; Redis is used only when it is explicitly true and `REDIS_URL` is non-empty.
- PostgreSQL remains the only authoritative runtime database.
- Redis keys use `tvci:pgdcn:v1:<app>:<resource>:scope:<sha256>:g<generation>`; cache TTL is at most 15 seconds.
- Check session and route RBAC before cache access; scope includes the account identity and access fields used by the route, never session tokens.
- Redis connect/command work is bounded, has no automatic command retry or reconnect storm, and failures fall through to the existing PostgreSQL loader.
- Do not cache credentials, hồ sơ/PYC, mẫu vật, lịch, KQTN, signatures, approvals, notifications, or file bytes.
- Do not change workflow gates, revision/CAS, IndexedDB outbox, notification persistence, or existing workers. No Pub/Sub or Redis queues.
- Compose passes `REDIS_ENABLED` and `REDIS_URL` to the server on the existing private network; this repo creates no Redis service/container and publishes no Redis port.
- Do not read/write `.env`, use production data, build a production image, deploy/recreate production Docker, or change production DB configuration.
- Keep all unrelated pre-existing work unstaged and unmodified. Commit only verified Redis-related files on the current branch; do not push or merge.

## Review Focus

- A personal draft or manager-only template must never be served to another account; exercise same-role different-user and manager/non-manager scope separation in cache tests.
- Redis connect or command stalls must not stall the API indefinitely; test command timeout and disabled reconnect/offline queue behavior.
- Failed invalidation must not fail a successful mutation; the 15-second TTL bounds residual staleness.
- A denied/unauthenticated request must not read Redis or expose cached content; test route order/contracts for PCN and PGD.
- Malformed cached JSON or a failed Redis write must fall through to PostgreSQL and preserve the original response.

---

### Task 1: Optional Redis read-through cache

**Files:**
- Create: `lib/server/redis-cache.ts`
- Modify: `package.json`, `package-lock.json`
- Test: `test/redis-cache.test.ts`

**Interfaces:**
- `RedisCacheStore`: `get(key, signal?)`, `set(key, value, ttlSeconds, signal?)`, and `incr(key, signal?)`.
- `createRedisReadCache({ enabled, storeProvider, commandTimeoutMs?, retryCooldownMs? })` returns `readThrough<T>({ app, resource, scope, loader, ttlSeconds? })`, `invalidate(app, resource)`, and `getHealth()`.
- Every cache lookup reads the app/resource generation from shared Redis before forming the scoped data key; generation is not process-local.
- Production exports `readThroughRedisCache`, `invalidateRedisCache`, and `getRedisCacheHealth` backed by a lazy node-redis v6 client.

- [ ] **Step 1: Write failing unit tests** for miss then hit, 15-second expiry/max TTL, generation invalidation across two cache instances, PCN/PGD namespace separation, different user/access scopes, empty-scope bypass, concurrent miss coalescing, Redis disabled, store down/recovery, command timeout, invalid JSON, failed invalidation/write, and safe metrics.
- [ ] **Step 2: Run** `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test ./test/redis-cache.test.ts` and confirm feature-related failures.
- [ ] **Step 3: Implement** the injectable cache factory and production node-redis v6 adapter. Use `REDIS_ENABLED` plus `REDIS_URL`, `socket.connectTimeout` 150 ms, `reconnectStrategy: false`, `disableOfflineQueue: true`, `withAbortSignal` plus 150 ms command bounds, one attempt per 1-second cooldown, an opaque SHA-256 scope hash, and a maximum 15-second TTL. Suppress Redis errors from callers and keep credentials out of health/errors.
- [ ] **Step 4: Run the focused test command** and confirm all cache unit tests pass.

### Task 2: PCN workflow-template list and mutation invalidation

**Files:**
- Modify: `app/api/pcn/workflow-templates/route.ts`
- Modify: `app/api/pcn/workflow-templates/[templateId]/route.ts`
- Modify: `app/api/pcn/workflow-templates/[templateId]/publish/route.ts`
- Modify: `app/api/pcn/workflow-templates/[templateId]/retire/route.ts`
- Modify: `app/api/pcn/workflow-templates/[templateId]/revisions/route.ts`
- Test: `test/pcn-redis-template-cache.test.ts`

- [ ] **Step 1: Write failing route-contract tests** asserting authentication and existing PCN access checks precede `readThroughRedisCache`, scope includes username/role/field and department scope, the existing SQL loader is retained, and every successful mutation route invalidates `('pcn', 'workflow-templates')` after persistence.
- [ ] **Step 2: Run** the focused PCN route-contract test and confirm it fails before route wiring.
- [ ] **Step 3: Wire GET through the cache** after current authorization, with a 15-second TTL and the existing SQL response unchanged. Add best-effort generation invalidation after each successful mutation transaction; never make the mutation outcome depend on Redis.
- [ ] **Step 4: Run** `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test ./test/pcn-redis-template-cache.test.ts ./test/pcn-workflow-template.test.ts ./test/pcn-workflow-template-revision.test.ts`.

### Task 3: PGD workflow-template list and mutation invalidation

**Files:**
- Modify: `app/api/pgd/workflow-templates/route.ts`
- Modify: `app/api/pgd/workflow-templates/[templateId]/route.ts`
- Modify: `app/api/pgd/workflow-templates/[templateId]/publish/route.ts`
- Modify: `app/api/pgd/workflow-templates/[templateId]/retire/route.ts`
- Modify: `app/api/pgd/workflow-templates/[templateId]/revisions/route.ts`
- Test: `test/pgd-redis-template-cache.test.ts`

- [ ] **Step 1: Write failing route-contract tests** asserting the current PGD session/manager/proposer checks precede cache access, cache scope is per account and role, PostgreSQL query/filter remains, and each successful mutation invalidates `('pgd', 'workflow-templates')` after persistence.
- [ ] **Step 2: Run** the focused PGD route-contract test and confirm it fails before route wiring.
- [ ] **Step 3: Wire GET and mutations** with the same 15-second, fail-open cache contract as PCN, preserving current PGD policy and response shape.
- [ ] **Step 4: Run** `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test ./test/pgd-redis-template-cache.test.ts ./test/pgd-workflow-template.test.ts ./test/pgd-workflow-template-api-contract.test.ts`.

### Task 4: Runtime health, private-network configuration, and rollback guide

**Files:**
- Modify: `app/api/health/route.ts`
- Modify: `docker-compose.pcn.yml`
- Modify: `.env.example`
- Create: `docs/redis-cache.md`
- Test: `test/redis-runtime-config.test.ts`

- [ ] **Step 1: Add config and health contract tests** confirming opt-in defaults, no Redis service/port publication, and a health payload that omits connection secrets.
- [ ] **Step 2: Run** the focused contract test and confirm it fails before the configuration changes.
- [ ] **Step 3: Implement** sanitized Redis connection state and hit/miss/bypass/error/invalidation counters in `/api/health`, Compose env forwarding only, example env values, and concise setup/rollback instructions. Document that the shared Redis endpoint is managed outside this repo and AI/document queue work is deferred.
- [ ] **Step 4: Run** the focused contract test and the cache suite.

### Task 5: Review, verification, and scoped commit

**Files:**
- Review only the Redis-related files above plus `design.md`, the spec, and this plan.

- [ ] **Step 1: Run** PCN cache/workflow tests, PGD cache/workflow tests, the Redis cache unit suite, and `npm run typecheck`.
- [ ] **Step 2: Inspect** `git diff --check`, exact diff, tracked/untracked file list, current branch, and staged path list. Confirm `AGENTS.md`, `scripts/c2c-invoke-agy.ps1`, QA artifacts, `.env`, service credentials, and other pre-existing work are excluded.
- [ ] **Step 3: Run** `graphify update .` after implementation; keep `graphify-out/` out of the commit.
- [ ] **Step 4: Commit** only verified Redis-related implementation, tests, config, guide, design contract, spec, and plan files on the existing branch. Do not push or merge.
