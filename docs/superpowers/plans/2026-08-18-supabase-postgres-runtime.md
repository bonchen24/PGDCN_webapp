# Supabase PostgreSQL Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển production Docker Desktop của DDT sang database riêng `ddt_lab` trên Supabase self-host, có migration và rollback an toàn.

**Architecture:** Giữ Compose standalone hiện tại làm fallback; tạo Compose Supabase độc lập cho `webapp`, kết nối qua network external `supabase_default` tới `supabase-db`. Dữ liệu được migrate bằng logical dump, không xóa volume hoặc database hệ thống Supabase.

**Tech Stack:** Docker Compose, Supabase self-host PostgreSQL 15, Node/Express `pg`, PostgreSQL `pg_dump`/`pg_restore`, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-18-supabase-postgres-runtime-design.md`

## Global Constraints

- Không chỉnh sửa `.env` của DDT hoặc Supabase; chỉ dùng file env Supabase hiện có khi chạy Compose.
- Không chạy `docker compose down -v` và không xóa `ddt_webapp_pgdata` hoặc volume Supabase.
- DDT dùng database riêng `ddt_lab`; không restore destructive vào database `postgres` của Supabase.
- Giữ header/footer bắt buộc của AGENTS.md cho file Markdown/TS/TSX mới hoặc chỉnh sửa.
- Chạy test contract trước, build/lint sau, rồi mới migrate và deploy production.

### Task 1: Add the Supabase Compose contract test

**Files:**
- Create: `test/supabase-postgres-compose.test.mjs`

**Interfaces:**
- Consumes: `docker-compose.supabase.yml` after implementation.
- Produces: Contract assertions proving the production file uses `supabase_default`, `supabase-db`, `ddt_lab`, and no standalone `postgres_db` service.

- [x] **Step 1: Write the failing test**

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const composePath = new URL('../docker-compose.supabase.yml', import.meta.url);

test('Supabase production Compose uses the existing Supabase network and DDT database', () => {
  assert.equal(fs.existsSync(composePath), true);
  const source = fs.readFileSync(composePath, 'utf8');
  assert.match(source, /supabase-db/);
  assert.match(source, /supabase_default/);
  assert.match(source, /POSTGRES_DB:\s*ddt_lab/);
  assert.doesNotMatch(source, /^\\s+postgres_db:/m);
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `node --test test/supabase-postgres-compose.test.mjs`

Expected: FAIL because `docker-compose.supabase.yml` does not exist yet.

### Task 2: Add Supabase production Compose and usage documentation

**Files:**
- Create: `docker-compose.supabase.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: Supabase env file supplied with `--env-file` and external Docker network `supabase_default`.
- Produces: A production stack with only `webapp`, using `supabase-db:5432` and database `ddt_lab`.

- [x] **Step 1: Implement the minimal Compose file**

```yaml
services:
  webapp:
    build: .
    environment:
      NODE_ENV: production
      PORT: 2359
      POSTGRES_HOST: supabase-db
      POSTGRES_PORT: 5432
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Load the Supabase env file with --env-file}
      POSTGRES_DB: ddt_lab
      GEMINI_API_KEY: ${GEMINI_API_KEY:-}
    ports:
      - "2359:2359"
    networks:
      - supabase_default
    restart: unless-stopped

networks:
  supabase_default:
    external: true
```

- [x] **Step 2: Document the command without writing secrets**

Document that the database must be created first, then run:

```powershell
docker compose --env-file E:\CODING\TVCI_APP\supabase-docker\.env -f docker-compose.supabase.yml up --build -d
```

- [x] **Step 3: Run the contract test to verify it passes**

Run: `node --test test/supabase-postgres-compose.test.mjs`

Expected: PASS.

### Task 3: Migrate the existing DDT database into Supabase

**Files:**
- No repository files; Docker database state only.

**Interfaces:**
- Consumes: Existing `ddt_webapp-postgres_db` database `ddt_lab` and healthy `supabase-db`.
- Produces: Database `ddt_lab` in `supabase-db` containing the DDT schema/data.

- [x] **Step 1: Create the target database idempotently**

Run a local `psql` command through `supabase-db` as its existing local postgres administrator. The command must create `ddt_lab` only when it does not exist and must not drop any Supabase database.

- [x] **Step 2: Create a custom-format dump from the standalone DDT database**

Run `pg_dump -Fc` inside `ddt_webapp-postgres_db` and copy the dump to `backups/` on the host.

- [x] **Step 3: Restore the dump into `supabase-db`**

Run `pg_restore --no-owner --no-privileges` against database `ddt_lab`; do not use `--clean` against Supabase's `postgres` database.

- [x] **Step 4: Verify migrated row counts**

Compare counts for `app_documents` and the DDT collections in both databases before switching the app.

### Task 4: Build and deploy the Supabase production stack

**Files:**
- No repository files beyond Task 2.

**Interfaces:**
- Consumes: `docker-compose.supabase.yml`, target `ddt_lab`, and Supabase network.
- Produces: `ddt_webapp` production webapp connected to Supabase PostgreSQL.

- [x] **Step 1: Build and start webapp with Supabase Compose**

Run the documented Compose command with the existing Supabase env file.

- [x] **Step 2: Verify network and container state**

Run `docker compose -f docker-compose.supabase.yml ps` and inspect that `webapp` is attached to `supabase_default`.

- [x] **Step 3: Verify application health and database health**

Request `http://localhost:2359/api/health` and `http://localhost:2359/api/db/health`; both must return HTTP 200.

- [x] **Step 4: Verify rollback remains available**

Confirm `ddt_webapp-postgres_db` and its volume are still present and running; do not remove them in this task.

### Task 5: Final verification

- [x] **Step 1: Run `npm run lint`**
- [x] **Step 2: Run `npm run build`**
- [x] **Step 3: Run the full test suite with the repository preload used by this project**
- [x] **Step 4: Run `git diff --check` if Git metadata is available; otherwise report that the workspace is not a Git worktree**

<!-- --- End of 2026-08-18-supabase-postgres-runtime.md --- -->
