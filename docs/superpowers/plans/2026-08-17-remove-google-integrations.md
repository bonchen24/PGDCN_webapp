# Remove Google Integrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove every Google-based business-data storage and synchronization path while keeping PostgreSQL, local cache, JSON backup, and Gemini AI working.

**Architecture:** PostgreSQL REST remains the only runtime business-data source. Zustand/IndexedDB provide local responsiveness and tombstones; JSON backup/restore remains the offline interchange format. Google OAuth, GAS, Sheets, Drive, and Tasks are removed from runtime, UI, server routes, scripts, and dependencies.

**Tech Stack:** React, TypeScript, Zustand, Express, PostgreSQL REST adapter, Node `node:test`, Vite, npm.

## Global Constraints

- `design.md` is the single source of truth and has been updated before implementation.
- Do not modify `.env`.
- Preserve existing PostgreSQL/local/backup data; do not run destructive database drops.
- Keep Gemini AI endpoints and `@google/genai`; remove only Google persistence/auth/task integrations.
- Every modified JS/TS/TSX/Markdown file must retain the required Gemini header and filename footer.
- Run the repository's Node preload with tests when required: `$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'`.

---

### Task 1: Add failing removal contracts

**Files:**
- Create: `test/google-integration-removal.test.ts`
- Test: `test/google-integration-removal.test.ts`

**Interfaces:**
- Consumes: source files under `server.ts`, `store.ts`, `types.ts`, `App.tsx`, `components/`, `utils/`, `gas/`, and `scripts/`.
- Produces: executable contracts proving that the removed integration cannot re-enter the runtime.

- [x] **Step 1: Write the failing test**

Add Node `node:test` checks using `readFileSync`, `existsSync`, and `assert`:

```ts
test('server has no GAS proxy route', () => {
  const source = readFileSync(path.join(ROOT, 'server.ts'), 'utf8');
  assert.doesNotMatch(source, /\/api\/gas|Google Apps Script|GAS Proxy/);
});

test('store has no Google persistence or OAuth runtime', () => {
  const source = readFileSync(path.join(ROOT, 'store.ts'), 'utf8');
  assert.doesNotMatch(source, /googleAuth|migrateGASDataToPostgres|\/api\/gas|googleToken|googleUser|saveAllToGoogleSheet|googleTaskId/);
});

test('diagnostic types and UI have only PostgreSQL/local sources', () => {
  const types = readFileSync(path.join(ROOT, 'types.ts'), 'utf8');
  const modal = readFileSync(path.join(ROOT, 'components', 'SyncDiagnosticModal.tsx'), 'utf8');
  assert.doesNotMatch(types, /foundInGas|gas:\s*\{/);
  assert.doesNotMatch(modal, /tab-gas|Google Apps Script|report\.gas|foundInGas/);
});

test('removed integration files are absent', () => {
  for (const file of ['utils/googleAuth.ts', 'components/GoogleTasksView.tsx', 'gas/backend.gs', 'scripts/migrateFromGAS.ts']) {
    assert.equal(existsSync(path.join(ROOT, file)), false, file);
  }
});
```

Add the required Gemini Markdown/TypeScript header and footer to the test file.

- [x] **Step 2: Run test to verify it fails**

Run: `$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; node --test test/google-integration-removal.test.ts`

Expected: FAIL because the current server, store, types, diagnostic UI, and integration files still contain the old Google paths.

### Task 2: Remove server/store/type integration paths

**Files:**
- Modify: `server.ts`
- Modify: `store.ts`
- Modify: `types.ts`
- Modify: `utils/firebase.ts`
- Modify: `sql/schema.sql`
- Test: `test/google-integration-removal.test.ts`

**Interfaces:**
- Consumes: existing PostgreSQL adapter functions and the deletion tombstone flow.
- Produces: a store whose sync, CRUD, diagnostics, and backup operations use only PostgreSQL/local state.

- [x] **Step 1: Remove the server GAS proxy**

Delete only the `app.all('/api/gas', ...)` handler in `server.ts`; leave `/api/db/*` and `/api/gemini/*` unchanged.

- [x] **Step 2: Remove GAS migration and Google fields from the store contract**

Remove the `migrateGASDataToPostgres` import, Google imports, `googleUser/googleToken/setGoogleUser`, `migrateFromGAS`, `fetchExternalRequests`, `deleteGoogleTaskIfExists`, Google Task cleanup branches, Google Sheet autosync, GAS fallback/bootstrap, GAS diagnostic fetch/report construction, hardcoded script URL normalization, and the `fetchExternalRequests` implementation. Keep the existing PostgreSQL sync and deletion-marker handling intact.

- [x] **Step 3: Remove obsolete type fields**

Remove `scriptUrl` and `spreadsheetUrl` from `AppSettings`, `googleTaskId`/Google task metadata from `TestRequest`, `foundInGas` and the `'gas'` matched-record source, and the `gas` member of `SyncDiagnosticReport`. Update all remaining report consumers to the resulting types.

- [x] **Step 4: Keep `utils/firebase.ts` as the PostgreSQL compatibility adapter**

Delete only `migrateGASDataToPostgres`; preserve `fetchCollection`, `fetchCollectionWithMeta`, delete/batch/save aliases, pagination, and `postgresClient`.

- [x] **Step 5: Remove GAS columns from fresh schema definitions without touching live data**

Delete only `gas_script_url` and `gas_script_url_2` declarations from `sql/schema.sql`. Do not add a destructive migration or alter an existing database.

- [x] **Step 6: Run the focused contract test**

Run: `$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; node --test test/google-integration-removal.test.ts`

Expected: still FAIL on UI/files until Task 3 and Task 4 are complete, but no server/store/type failure should remain.

### Task 3: Remove Google UI and external Sheet import flows

**Files:**
- Modify: `App.tsx`
- Modify: `components/SystemManagementViews.tsx`
- Modify: `components/SyncDiagnosticModal.tsx`
- Modify: `components/RequestModal.tsx`
- Modify: `components/HandoverModal.tsx`
- Modify: `components/SettingsModal.tsx`
- Delete: `components/GoogleTasksView.tsx`
- Test: `test/google-integration-removal.test.ts`

**Interfaces:**
- Consumes: PostgreSQL-only store contract from Task 2.
- Produces: UI with no Google Sheets/GAS/OAuth/Tasks controls, while Gemini model settings and normal backup/restore remain available.

- [x] **Step 1: Remove OAuth initialization from `App.tsx`**

Delete the `googleAuth` import, Google fields from the store destructuring, localStorage token restoration effect, `initGoogleAuth` subscription effect, Google Sheets loading text, and Google Tasks title branch. Keep normal `fetchData`, realtime setup, and PostgreSQL loading behavior.

- [x] **Step 2: Remove Google Sheets controls from system management**

Delete the Google auth/Sheets imports, state, handlers, and settings card in `SystemManagementViews.tsx`. Keep the Gemini model status/check controls, PostgreSQL diagnostic button, user management, and JSON backup/restore.

- [x] **Step 3: Reduce diagnostics to PostgreSQL/local**

In `SyncDiagnosticModal.tsx`, remove the `gas` active-tab union member, GAS summary badge, GAS tab, GAS result card, GAS source card, `settings` dependency if unused, and any GAS icon import. Keep diagnosis, timestamp comparison, collection counts, and local/delete-marker explanations.

- [x] **Step 4: Remove external Google Sheet import from request creation**

In `RequestModal.tsx`, remove `fetchExternalRequests`, spreadsheet defaults, `IMPORT` state/controls, Sheet URL state, external grouping/import handlers, and related rendering. Keep the normal create/edit flow and local PostgreSQL-backed customer/product/brand suggestions.

- [x] **Step 5: Remove unused spreadsheet configuration**

In `HandoverModal.tsx`, remove the unused settings/spreadsheet declaration. In `SettingsModal.tsx`, remove the script URL default and any Google-only icon/imports while preserving settings, diagnostic, and backup/restore behavior.

- [x] **Step 6: Run focused typecheck**

Run: `npm run lint`

Expected: `tsc --noEmit` exits 0 after all removed store/type fields and UI callers are aligned.

### Task 4: Delete integration assets, scripts, and dependency

**Files:**
- Delete: `utils/googleAuth.ts`
- Delete: `gas/backend.gs`
- Delete: `scripts/migrateFromGAS.ts`
- Delete: `test_gas.ts`
- Delete: `test_gas_all.ts`
- Delete: `test_gas.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `bun.lock`
- Modify: `PROJECT_MEMORY.md`
- Modify: `docs/superpowers/plans/2026-08-17-postgres-docker.md`
- Test: `test/google-integration-removal.test.ts`

**Interfaces:**
- Consumes: source cleanup from Tasks 2–3.
- Produces: repository with no shipped Google storage/auth/task implementation or GAS test/migration entry points.

- [x] **Step 1: Delete obsolete integration files**

Remove the files listed above only after all imports are gone. Do not delete `utils/firebase.ts`, `@google/genai`, or Gemini endpoints.

- [x] **Step 2: Remove the unused Firebase OAuth dependency**

Remove the direct `firebase` dependency from `package.json`; update `package-lock.json` and `bun.lock` with the repository package manager without modifying `.env`. Keep dependencies still required by the PostgreSQL adapter and Gemini.

- [x] **Step 3: Update project documentation**

Replace stale statements that describe GAS as an optional import source in `PROJECT_MEMORY.md` and `docs/superpowers/plans/2026-08-17-postgres-docker.md`. Do not edit backup JSON blobs or historical records merely to remove legacy fields.

- [x] **Step 4: Run the focused contract test**

Run: `$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; node --test test/google-integration-removal.test.ts`

Expected: PASS with all removal contracts green.

### Task 5: Full verification and requirement audit

**Files:**
- Test: `test/google-integration-removal.test.ts`
- Verify: all modified files and source tree

**Interfaces:**
- Consumes: completed runtime, UI, file, dependency, and documentation cleanup.
- Produces: evidence that the user-requested Google integrations are removed without breaking the PostgreSQL app.

- [x] **Step 1: Search active source for forbidden runtime references**

Run: `rg -n --hidden -S "GAS|Google Apps Script|Google Sheets|Google Tasks|googleAuth|googleToken|googleUser|migrateGAS|/api/gas|spreadsheetUrl|scriptUrl|googleTaskId" --glob '!node_modules/**' --glob '!dist/**' --glob '!tvci_backup*' --glob '!*.patch'`

Expected: no active application/runtime references. Remaining matches must be explicitly historical documentation or test assertions and should be removed or justified.

- [x] **Step 2: Run all tests**

Run: `$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; npm test`

Expected: exit 0 with 0 failing tests.

- [x] **Step 3: Run lint/typecheck**

Run: `$env:NODE_OPTIONS='--require=./scripts/test-node-userinfo-preload.cjs'; npm run lint`

Expected: `tsc --noEmit` exits 0.

- [x] **Step 4: Build the application**

Run: `npm run build`

Expected: Vite build exits 0. Existing non-fatal chunk-size warnings may remain; no new Google-related or TypeScript errors are acceptable.

- [x] **Step 5: Check patch hygiene**

Run: `git diff --check`

Expected: no whitespace errors. The repository currently has no local Git metadata, so if the command is unavailable, report that limitation rather than deleting or resetting files.

<!-- --- End of 2026-08-17-remove-google-integrations.md --- -->
