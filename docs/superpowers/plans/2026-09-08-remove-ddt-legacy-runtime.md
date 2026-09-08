# Remove DDT Legacy Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `PCN_webapp` a single Next.js PGDCN runtime by removing unreachable DDT/Vite client code while preserving the PCN/PGD backend and PCN-to-DDT integration contract.

**Architecture:** The active product remains the Next App Router under `/pgdcn/**`, backed by `server.ts`, `store-pcn`, `store-pgd`, and the PCN/PGD API boundaries. The legacy Vite `App.tsx`/`store.ts` tree and its DDT-only UI/tooling are removed; DDT remains only as an external laboratory target represented by `utils/pcnLabIntegration.ts` and deployment environment variables.

**Tech Stack:** Next.js 14 App Router, React 18, Express custom server, TypeScript, Tailwind CSS/PostCSS, Node test runner, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-09-08-remove-ddt-legacy-runtime-design.md`

## Global Constraints

- `design.md` remains the single source of truth and must be updated before runtime/config changes.
- Preserve `utils/pcnLabIntegration.ts`, `PCN_LAB_DDT_SECRET`, `PCN_LAB_INTEGRATIONS_JSON`, and DDT outbound/inbound payload mapping.
- Do not delete database, storage, backup, or container data outside this repository.
- Do not remove `templates/pcn` or `templates/pgd`; those are active runtime assets.
- Keep Vietnamese source files UTF-8 and do not introduce mojibake while editing.
- Use `apply_patch` for tracked source edits; run verification before claiming completion.

---

### Task 1: Add a legacy-runtime guard test

**Files:**
- Create: `test/no-ddt-legacy-runtime.test.ts`
- Test: `test/no-ddt-legacy-runtime.test.ts`

**Interfaces:**
- Consumes: repository source files and `package.json`.
- Produces: an executable contract that fails while the Vite/DDT entrypoint still exists, while asserting the external DDT integration remains.

- [ ] **Step 1: Write the failing test**

  Assert that the legacy root files (`App.tsx`, `index.tsx`, `index.html`, `vite.config.ts`, `store.ts`), the explicit DDT dev script, and the old `ddt-compact` CSS marker are absent. Assert that `app/page.tsx` still imports `PcnAppShell`, `utils/pcnLabIntegration.ts` still exposes DDT target handling, and `docker-compose.pcn.yml` still accepts `PCN_LAB_DDT_SECRET`.

- [ ] **Step 2: Run the test to verify it fails**

  Run: `npm run test:all -- test/no-ddt-legacy-runtime.test.ts`

  Expected: FAIL because the legacy files/script/class markers still exist.

- [ ] **Step 3: Keep the test independent of deleted modules**

  Read files as text and use `fs.existsSync`/`assert.doesNotMatch`; do not import the legacy runtime. This keeps the guard runnable after deletion.

### Task 2: Remove the unreachable Vite/DDT client tree

**Files:**
- Delete: `App.tsx`, `index.tsx`, `index.html`, `vite.config.ts`, `store.ts`
- Delete: legacy-only components including `ActivityLogView.tsx`, `AdminBackupReminder.tsx`, `AIChatBot.tsx`, `ATDScheduleView.tsx`, `ConfirmDeleteHandoverModal.tsx`, `CropperModal.tsx`, `CustomDatePicker.tsx`, `DayCapDienForm.tsx`, `DefaultStandardForm.tsx`, `DeviceCombobox.tsx`, `DocxSettingsModal.tsx`, `EmcBepDien1VungNauForm.tsx`, `HandoverDocsModal.tsx`, `HandoverModal.tsx`, `KqtnBulkPdfUploadModal.tsx`, `KqtnCandidateCombobox.tsx`, `KQTNView.tsx`, `LoginScreen.tsx`, `MultiSelectCombobox.tsx`, `NotificationDropdown.tsx`, `PrintFormModal.tsx`, `ReportGeneratorView.tsx`, `RequestModal.tsx`, `ScheduleView.tsx`, `SearchableSelect.tsx`, `SelectSampleModal.tsx`, `SettingsModal.tsx`, `SimpleCombobox.tsx`, `SummaryLogView.tsx`, `SyncDiagnosticModal.tsx`, `SystemManagementViews.tsx`, `TestExecutionModal.tsx`, `UserSettingsModal.tsx`, `WarehouseSidebar.tsx`
- Delete: tests that exclusively specify the removed DDT UI/runtime, including `test/docx-template-settings.test.ts`, `test/guest-request-modal.test.ts`, `test/request-modal-draft.test.ts`, `test/request-modal-input-editing.test.ts`, `test/request-save-sync-contract.test.ts`, `test/schedule-assignee-regression.test.ts`, and `test/kqtn-ui-contract.test.ts`/`test/kqtn-mobile-view.test.ts` when their only subject is the removed `KQTNView`.

**Interfaces:**
- Consumes: active Next routes and the shared `types.ts`/utility modules that remain.
- Produces: no importable Vite/DDT UI entrypoint; PCN/PGD routes continue to use their existing shells.

- [ ] **Step 1: Remove only files confirmed to be outside the active import graph**

  Verify each deletion target has no import from `app`, `Pcn*`, `Pgd*`, `Pgdcn*`, `server.ts`, active scripts, or retained tests. Preserve any shared utility discovered in the graph.

- [ ] **Step 2: Run typecheck immediately after the deletion**

  Run: `npm run typecheck`

  Expected: PASS; if a retained PCN/PGD module still imports a deleted file, restore the file or migrate that import before continuing.

- [ ] **Step 3: Run the guard test**

  Run: `npm run test:all -- test/no-ddt-legacy-runtime.test.ts`

  Expected: PASS for the removed entrypoint and retained integration assertions.

### Task 3: Remove DDT-only scripts, config, and generated artifacts

**Files:**
- Modify: `package.json`, `package-lock.json`, `bun.lock`
- Delete: `scripts/native-dev.cjs`, `update_firebase.sh`, `firebase-applet-config.json`, `firebase-blueprint.json`, `sql/schema.sql`
- Delete: root DDT seed fixtures `atd.csv`, `emc.csv`, `brands.csv`, `customers.csv`, `products.csv` and the broken `seed` script if no retained command consumes them
- Delete: local ignored legacy build/QA outputs `dist/` and `revised_templates/` after verifying their paths are exactly under `E:\CODING\PCN_webapp`

**Interfaces:**
- Consumes: `npm run dev:pcn`, active Next build, `templates/pcn`, `templates/pgd`.
- Produces: one explicit local dev entrypoint (`dev`/`dev:pcn`) and no Vite or Firebase/legacy DDT build dependency.

- [ ] **Step 1: Remove legacy package scripts and dependencies**

  Delete `dev:ddt`, remove unused Vite-specific packages (`vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`) only after `npm run typecheck`/`next build` prove no active import needs them, then regenerate lockfiles with `npm install --package-lock-only` and the repository’s lockfile workflow.

- [ ] **Step 2: Remove legacy script/config/data files**

  Delete only the exact files listed above; do not touch `templates/pcn`, `templates/pgd`, `public/icons`, or PCN/PGD migration input contracts.

- [ ] **Step 3: Remove ignored artifacts safely**

  Confirm `Get-Item -LiteralPath 'E:\CODING\PCN_webapp\dist'` and `Get-Item -LiteralPath 'E:\CODING\PCN_webapp\revised_templates'` resolve inside the workspace, then remove those exact directories with `Remove-Item -LiteralPath ... -Recurse`.

### Task 4: Remove DDT-only server template compatibility without touching PCN/PGD APIs

**Files:**
- Modify: `server.ts`
- Delete: `lib/reportTemplatesCatalog.ts`
- Delete: tests that assert `/api/templates` or `REPORT_TEMPLATES_CATALOG`, especially `test/docx-template-settings.test.ts` if still present
- Modify: `design.md`, `README.md`, `components/PcnAssistantView.tsx`, `components/PgdcnAssistantView.tsx`, `components/PgdcnDashboardView.tsx`, `components/PgdcnAppShell.tsx`, `components/PcnSidebar.tsx`, `components/PgdcnSidebar.tsx`, `components/PcnWorkspace.tsx`, and `index.css`

**Interfaces:**
- Consumes: active `/api/pcn/**`, `/api/pgd/**`, `/api/pgdcn/**` routes and active PCN/PGD template packs.
- Produces: no generic DDT `/api/templates` route or DDT-only catalog; active DOCX management continues through the PCN/PGD-specific APIs.

- [ ] **Step 1: Add/update source guard assertions**

  Assert that `server.ts` has no `/api/templates` compatibility routes or `REPORT_TEMPLATES_CATALOG` import, while retaining `/api/pcn/templates`, `/api/pgd/document-templates`, and `pcnLabIntegration` references.

- [ ] **Step 2: Remove only the DDT template route block**

  Delete the import and route handlers for `GET /api/templates`, `GET /api/templates/:filename/download`, `POST /api/templates/upload`, and `POST /api/templates/:filename/reset`; leave all PCN/PGD document-generation routes unchanged.

- [ ] **Step 3: Rename active CSS markers away from DDT naming**

  Rename active `ddt-compact`, `ddt-compact-sidebar`, and `ddt-compact-header` class uses/selectors to neutral `app-compact`, `app-compact-sidebar`, and `app-compact-header`. Preserve the same visual rules and responsive behavior.

- [ ] **Step 4: Update design/source documentation**

  Replace wording that calls Vite or `dev:ddt` a runnable product entrypoint with the Next PGDCN runtime contract. Document DDT only as an external lab integration target.

### Task 5: Verify the cleaned PCN/PGD runtime and Docker image

**Files:**
- Test: `test/no-ddt-legacy-runtime.test.ts` and the existing PCN/PGD test suite
- Verify: `Dockerfile`, `docker-compose.pcn.yml`

**Interfaces:**
- Consumes: cleaned source tree and self-host Supabase environment.
- Produces: a verified production image `pcn_webapp-webapp:latest` and running container `pcn_webapp-webapp` on port `2357`.

- [ ] **Step 1: Run focused tests**

  Run: `npm run test:all -- test/no-ddt-legacy-runtime.test.ts test/pgd-pcn-navigation.test.ts test/pgd-dossier-operations-ui.test.ts test/pcn-lab-operations.test.ts test/pcn-sample-register-ui.test.ts test/summary-register-grid.test.ts test/pcn-ui-contract.test.ts`

  Expected: all tests PASS.

- [ ] **Step 2: Run repository verification**

  Run: `npm run typecheck`, `git diff --check`, and `npm run build`.

  Expected: all commands exit successfully.

- [ ] **Step 3: Rebuild Docker Desktop**

  Run: `docker compose --env-file .env --env-file "E:\CODING\TVCI_APP\supabase-docker\.env" -f docker-compose.pcn.yml up -d --build`

  Expected: image builds and `pcn_webapp-webapp` is recreated without changing Supabase data.

- [ ] **Step 4: Smoke-test production routes**

  Request `/api/health`, `/pgdcn`, `/pgdcn/pcn`, and `/pgdcn/pgd` on `http://localhost:2357`; expect HTTP 200. Confirm `PCN_LAB_DDT_SECRET` remains present in the compose contract and no legacy frontend bundle is served.
