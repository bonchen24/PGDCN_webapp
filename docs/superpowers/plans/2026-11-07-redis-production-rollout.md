# Redis Production Rollout Implementation Plan

> **For agentic workers:** Execute the checklist in this plan in the isolated release worktree. Keep every production operation scoped to the PGDCN `webapp` service.

**Goal:** Enable the authorized PGDCN workflow-template Redis read cache on the existing private Redis endpoint and deploy the verified app image.

**Architecture:** Selectively integrate the two Redis commits onto a clean branch based on local `master`, preserving later master changes and all unrelated dirty work. Keep PostgreSQL authoritative; use the existing read-through implementation and an opt-in Compose overlay that supplies Redis settings to `webapp` and attaches only that service to `tvci_app_redis_private`.

**Tech Stack:** Next.js App Router, TypeScript, PostgreSQL, node-redis v6, Node test runner, Docker Compose.

**Spec:** `design.md` Redis clauses 14–15 and `docs/superpowers/specs/2026-11-07-redis-template-read-cache-design.md`.

## Global Constraints

- PostgreSQL remains the source of truth; Redis stores only PCN/PGD workflow-template list responses after authentication and RBAC.
- Redis keys remain under `tvci:pgdcn:v1:<app>:<resource>:...`; TTL is at most 15 seconds; Redis errors and timeouts fall back to PostgreSQL.
- `REDIS_ENABLED=true`, `REDIS_URL=redis://redis:6379`, and `REDIS_PASSWORD` are runtime-only; never print or commit the password.
- The external private network is `tvci_app_redis_private`; attach only the PGDCN `webapp` service. Do not create, stop, inspect internally, or reconfigure Redis, DDT, workers, PostgreSQL/Supabase, or volumes.
- Do not change PYC, BMGN, calendar, KQTN, sync, KPI, workflow gates, database schema, or worker behavior.
- Leave pre-existing dirty changes and unrelated worktrees untouched. Do not reset, stash, clean, or push.
- Build from the final verified local commit; deploy only project `pgdcn_webapp`, service `webapp`, with `up -d --no-deps --no-build`.
- If app health fails after deployment, restore the recorded prior PGDCN app image and recreate only that app service.

---

### Task 1: Selective integration on an isolated branch

**Files:**
- Review: commits `09be50c` and `97f4630`
- Integrate: only changes introduced by those commits, preserving the current `master` tree
- Create: `docs/superpowers/plans/2026-11-07-redis-production-rollout.md`

- [ ] Confirm the worktree is clean and based on current local `master`.
- [ ] Cherry-pick `09be50c`, then `97f4630`; resolve only Redis-context conflicts and retain all unrelated current-master changes.
- [ ] Review the resulting full diff, changed-path list, secret scan, and commit ancestry before continuing.

### Task 2: Verify cache and runtime configuration

**Files:**
- Review: `lib/server/redis-cache.ts`, PCN/PGD workflow-template routes and mutation routes, `app/api/health/route.ts`
- Review: `docker-compose.yml`, `docker-compose.redis-cache.yml`, `.env.example`, `docs/redis-cache.md`
- Tests: `test/redis-cache.test.ts`, `test/pcn-redis-template-cache.test.ts`, `test/pgd-redis-template-cache.test.ts`, `test/redis-runtime-config.test.ts`, live Redis tests

- [ ] Run focused Redis/cache route tests, typecheck, lint, and production build; if code changes are needed, add a failing focused test first.
- [ ] Validate merged Compose configuration without printing interpolated environment values; confirm only `webapp` joins `redis_private` and no Redis service or port is declared.
- [ ] Correct any stale operator documentation so the password is passed via `REDIS_PASSWORD` and the URL contains no credential.
- [ ] Run `graphify update .` after meaningful source changes and keep `graphify-out/` uncommitted.
- [ ] Commit the reviewed Redis integration and rollout plan; fast-forward local `master` only if it remains clean and an ancestor of the release branch.

### Task 3: Build and deploy only PGDCN webapp

**Files:**
- Build context: this clean worktree at the final local commit
- Compose: `docker-compose.yml` plus `docker-compose.redis-cache.yml`

- [ ] Verify the existing private network and required runtime-variable presence without displaying secret values.
- [ ] Record the current PGDCN container ID/image ID for app-only rollback; do not interact with other containers.
- [ ] Build the `pgdcn_webapp` `webapp` image from the verified commit.
- [ ] Deploy only `webapp` using `docker compose -p pgdcn_webapp ... up -d --no-deps --no-build webapp`.

### Task 4: Production gates and rollback

**Files:**
- Read-only checks: PGDCN app container, `/api/health`, `/api/db/health` when present, and Redis PING over the app's configured client

- [ ] Verify the running container image ID matches the image built from the verified commit, `REDIS_ENABLED` is true, `REDIS_URL` has no credentials, `REDIS_PASSWORD` is present, and the app alone is attached to `tvci_app_redis_private`.
- [ ] Verify HTTP health, database health when available, Redis readiness, and authenticated Redis PING without emitting credentials.
- [ ] Check hit/miss counters only through an already-authorized read-only endpoint with an existing valid QA session; otherwise report `AUTHENTICATED_HIT_MISS_UNVERIFIED` without creating credentials or sessions.
- [ ] If any required health gate fails, restore the recorded image and recreate only the PGDCN `webapp`; do not touch Redis, database, workers, or volumes.
- [ ] Recheck app health after deployment or rollback and report local master integration status and that remote push was not performed.
