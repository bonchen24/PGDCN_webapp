<!--
Author: Gemini
OS support: Web/Node
Description: Implementation plan for migrating runtime persistence to PostgreSQL and packaging the app for Docker Desktop on port 2359
-->

# PostgreSQL and Docker Desktop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Run DDT Lab with PostgreSQL as the runtime database and serve the built app from Docker Desktop on host port `2359`.

**Architecture:** Express remains the single backend entrypoint and owns all PostgreSQL access through `pg`. The browser uses a REST adapter with the existing collection-shaped interface, so the Zustand business logic keeps its current document model while PostgreSQL stores each document as JSONB in a transactional `app_documents` table. Docker Compose starts the web container and a PostgreSQL 15 container on an internal network; only the web service is published on `2359`.

**Tech Stack:** React 18, Vite 6, Express 5, TypeScript, `pg`, PostgreSQL 15 Alpine, Docker Compose.

## Global Constraints

- `design.md` remains the single source of truth and must describe PostgreSQL as the primary runtime store before code changes.
- Runtime browser persistence must not call Firebase Firestore or any external Google data source; PostgreSQL REST is the only cloud source.
- Preserve all current collection names and arbitrary document fields through JSONB so existing backup/restore and business workflows remain compatible.
- Local development defaults to `PORT=1359`; Docker production sets `PORT=2359` and maps `2359:2359`.
- Do not edit `.env`; use Compose environment defaults and `.env.example` for documented configuration.
- Modified and new source/document files must keep the required Gemini header and filename footer.

---

### Task 1: Update the source-of-truth design and runtime data contract

**Files:**
- Modify: `design.md`
- Create: `docs/superpowers/plans/2026-08-17-postgres-docker.md`

**Interfaces:**
- Produces: documented PostgreSQL primary-storage policy, JSONB document contract, internal REST routes, and Docker port contract for implementation tasks.

- [ ] **Step 1: Add the persistence decision to `design.md`**

Document PostgreSQL as the primary runtime database, name the `app_documents` JSONB table, state that Firestore is no longer used by the browser at runtime, and describe `/api/db/:collection` plus `/api/db/:collection/:id`.

- [ ] **Step 2: Replace obsolete operational wording**

Change backup/diagnostic wording that calls Firestore or GAS a cloud source to PostgreSQL/API wording.

- [ ] **Step 3: Verify documentation markers**

Run `Get-Content design.md -First 8` and `Get-Content design.md -Last 3`; confirm the required header and footer remain present.

### Task 2: Add a tested PostgreSQL API boundary

**Files:**
- Modify: `package.json`
- Modify: `utils/db.ts`
- Modify: `sql/schema.sql`
- Modify: `server.ts`
- Create: `utils/postgresApi.ts`
- Test: `test/postgres-api.test.ts`

**Interfaces:**
- `utils/db.ts` exports `pool`, `initDbSchema()`, and `query(text, params)`.
- `utils/postgresApi.ts` exports collection CRUD helpers used by the browser: `fetchCollectionWithMeta`, `fetchCollection`, `saveDoc`, `deleteDoc`, `batchSave`, `batchDelete`, and `triggerSyncSignal`.
- Express exposes `GET /api/db/health`, `GET /api/db/:collection`, `PUT /api/db/:collection/:id`, `DELETE /api/db/:collection/:id`, `POST /api/db/:collection/batch`, and `POST /api/db/:collection/delete-batch`.

- [ ] **Step 1: Write the failing API contract test**

Add a test that asserts a document can be written to `app_documents`, read back with its original `id` and nested JSON fields, and deleted without affecting another collection. The test must fail before the API/adapter exists.

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run `npm test -- test/postgres-api.test.ts` and confirm the failure is caused by the missing PostgreSQL API contract, not by a test syntax error.

- [ ] **Step 3: Add the JSONB document table and indexes**

Create `app_documents(collection_name, document_id, data JSONB, updated_at TIMESTAMPTZ)` with a composite primary key and indexes for collection/update time. Keep the existing normalized tables for migration compatibility.

- [ ] **Step 4: Implement validated server routes**

Allow only known application collection names, parameterize every SQL value, preserve `id` in API responses, upsert documents in a transaction, and return clear 4xx/5xx JSON errors. Initialize the schema before listening.

- [ ] **Step 5: Implement the browser REST adapter**

Replace Firestore SDK operations behind the existing collection-shaped functions with `fetch('/api/db/...')`, include timeout handling, return `{items, fromCache:false,error,count}`, and keep batch writes chunked at 250 documents.

- [ ] **Step 6: Run the focused test and verify it passes**

Run `npm test -- test/postgres-api.test.ts`; expected result is one passing contract test against the configured PostgreSQL service.

### Task 3: Remove Firestore from the runtime store path

**Files:**
- Modify: `store.ts`
- Modify: `utils/firebase.ts`
- Modify: `types.ts` only if the diagnostic source type needs the new `postgres` discriminator

**Interfaces:**
- `store.ts` continues to call collection-shaped persistence helpers, but those helpers resolve to PostgreSQL REST endpoints.
- `setupRealtimeSync()` uses a polling/debounced refresh mechanism instead of `firebase/firestore` listeners.

- [ ] **Step 1: Write the failing runtime dependency check**

Add a test or static check that the browser persistence adapter has no imports from `firebase/firestore` and that its base URL is the same-origin `/api/db` endpoint.

- [ ] **Step 2: Verify the check fails against the current implementation**

Run the focused check and confirm it finds the current Firestore imports.

- [ ] **Step 3: Switch the adapter and realtime refresh**

Remove runtime Firestore/GAS imports from the store path, preserve local Zustand/IndexedDB state, and map diagnostic labels to PostgreSQL/local sources.

- [ ] **Step 4: Verify the runtime check and typecheck**

Run `npm test -- test/postgres-api.test.ts` and `npm run lint`; expected result is a passing adapter check and zero TypeScript errors.

### Task 4: Make Docker Desktop build and run the complete stack

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `package.json`
- Modify: `vite.config.ts`
- Modify: `README.md`

**Interfaces:**
- `npm run build` creates `dist` before the server starts.
- `npm start` runs the TypeScript Express server with `PORT` from the environment.
- Compose starts `postgres_db` with a healthcheck and starts `webapp` on `2359` only after PostgreSQL is healthy.

- [ ] **Step 1: Add the build/start configuration**

Use `npm ci`, run `npm run build` in the image, start the server with `tsx server.ts`, configure `PORT=2359`, and expose `2359`.

- [ ] **Step 2: Configure Compose defaults without editing `.env`**

Use `${POSTGRES_USER:-ddt_admin}`, `${POSTGRES_PASSWORD:-ddt_dev_password}`, `${POSTGRES_DB:-ddt_lab}`, and `${PORT:-2359}`. Add a PostgreSQL healthcheck and keep database traffic on the Compose network.

- [ ] **Step 3: Document the Docker workflow**

Document `docker compose up --build -d`, the browser URL `http://localhost:2359`, the health URL `http://localhost:2359/api/health`, and `docker compose logs -f webapp`.

- [ ] **Step 4: Verify the image build**

Run `docker compose build` and confirm exit code 0.

### Task 5: Full verification and handoff

**Files:**
- No additional files unless verification exposes a defect.

- [ ] **Step 1: Run the full static checks**

Run `npm run lint` and `npm run build`; both must exit 0.

- [ ] **Step 2: Start the stack and verify health**

Run `docker compose up --build -d`, then `Invoke-WebRequest http://localhost:2359/api/health` and `Invoke-WebRequest http://localhost:2359/api/db/health`; both must return HTTP 200 and report PostgreSQL readiness.

- [ ] **Step 3: Verify persistence through the API**

Write one temporary document with `Invoke-RestMethod`, read it back, delete it, and confirm the delete response. Use a collection/id that is not part of user data and remove only that temporary document.

- [ ] **Step 4: Inspect final state**

Run `docker compose ps`, `docker compose logs --tail 100 webapp`, and `docker compose logs --tail 100 postgres_db`; confirm the web server is listening on `2359`, schema initialization completed, and there are no startup errors.

<!-- --- End of 2026-08-17-postgres-docker.md --- -->
