# PCN Surface Prune, OCR and Settings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dọn runtime PCN về đúng các bề mặt vận hành, loại Haimy/Cutover và các trang nghiên cứu khỏi contract PCN, đồng thời bổ sung OCR và Cài đặt PCN theo mô hình card hồ sơ.

**Architecture:** Next.js route `/` tiếp tục mount `PcnAppShell` và `PcnWorkspace`. Các vùng Mẫu/PYC, KQTN, phê duyệt và phát hành vẫn được render trong `PcnDossierDetailView`; chỉ thêm OCR context-aware và một màn hình Admin `PcnSettingsView`. Server giữ boundary riêng cho PCN, thêm endpoint settings/OCR có session và RBAC, loại endpoint Haimy/Cutover; database không bị xóa dữ liệu tự động.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Zustand PCN store, Express server, PostgreSQL/Supabase self-host trên Docker Desktop, private Storage, PaddleOCR service nội bộ và Gemini tùy chọn.

**Spec:** `docs/superpowers/specs/2026-08-31-pcn-surface-prune-ocr-settings-design.md`

## Global Constraints

- App đích là Next.js App Router, route sản phẩm là `/`.
- PCN dùng database logic `pcn_certification` và private Storage bucket `pcn-files`; không dùng runtime DDT.
- Development native chạy cổng `1357`; production Docker Desktop chạy cổng `2357`.
- Đầu vào nghiệp vụ là **Đề nghị**; **PYC** chỉ phát sinh khi PCN gửi yêu cầu tới phòng thử nghiệm khác.
- Giữ Danh sách khách hàng, Nhân sự PCN và các vùng nghiệp vụ bên trong card hồ sơ.
- Không tự xóa record trong database khi dọn UI/code; collection staging chỉ được dọn bằng migration SQL riêng sau xác nhận vận hành.
- Không import `store.ts`, `SystemManagementViews.tsx`, Haimy, Cutover hoặc historical từ route Next PCN.
- OCR chỉ điền draft/gợi ý và luôn yêu cầu người dùng xác nhận trước mutation nghiệp vụ.

---

### Task 1: Chốt test contract cho surface PCN và loại bỏ capability sai logic

**Files:**
- Create: `test/pcn-surface-prune.test.ts`
- Modify: `test/pcn-future-work-scope.test.ts`
- Modify: `test/pcn-runtime-smoke.test.ts`
- Modify: `scripts/run-pcn-tests.cjs`
- Modify: `scripts/smokePcnRuntime.ts`
- Modify: `utils/pcnRbac.ts`
- Modify: `server.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: current `PcnWorkspace`, `PcnSidebar`, `PCN_DB_COLLECTIONS`, `PCN_DEDICATED_MUTATION_COLLECTIONS` and retired contract tests.
- Produces: failing contract assertions that define the final navigation allowlist, forbidden imports/routes/collections and smoke expectations.

- [ ] **Step 1: Write the failing test**

  Add tests that assert:

  ```ts
  test('PCN navigation contains only work entrypoints plus Admin settings', () => {
    const navigation = read('utils/pcnNavigation.ts');
    assert.match(navigation, /dashboard/);
    assert.match(navigation, /proposals/);
    assert.match(navigation, /customers/);
    assert.match(navigation, /settings/);
    assert.doesNotMatch(navigation, /cutover|haimy|archive|backup|historical|integrity|operations|agent/i);
  });

  test('PCN runtime and server expose no Haimy or Cutover surface', () => {
    const workspace = read('components/PcnWorkspace.tsx');
    const server = read('server.ts');
    assert.doesNotMatch(workspace, /Pcn(Haimy|Cutover|Archive|Backup|DataIntegrity|OperationsRegister|Agent|Historical)/);
    assert.doesNotMatch(server, /\/api\/pcn\/cutover-status|\/api\/pcn\/integrations\/haimy/);
  });
  ```

  Update the smoke test contract to check settings and OCR capability rather than calling `/api/pcn/cutover-status`.

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/pcn-surface-prune.test.ts`

  Expected: FAIL because `settings` navigation and the forbidden-route assertions are not yet implemented.

- [ ] **Step 3: Implement the minimal contract change**

  Add `settings` as an Admin-only `PcnSection`, remove Haimy/Cutover/Agent support from the PCN runtime routes, remove Haimy/Cutover from PCN collection sets, remove the Cutover smoke check, and remove `verify:pcn-cutover` from `package.json`. Keep customer import/migration code and official document-generation utilities because those support active PCN work. Keep non-PCN DDT code outside the Next import graph.

- [ ] **Step 4: Run test to verify it passes**

  Run: `node --test test/pcn-surface-prune.test.ts`

  Expected: PASS with all navigation and forbidden-surface assertions green.

- [ ] **Step 5: Run the affected PCN contract suite**

  Run: `npm run test:pcn`

  Expected: the retired Haimy/Cutover tests have been removed from the PCN runner or rewritten as absence contracts; active dossier, sample, result and issuance tests remain runnable.

### Task 2: Dọn component/page và test dead code của PCN

**Files:**
- Delete: `components/PcnAgentWorkspaceView.tsx`
- Delete: `components/PcnArchiveView.tsx`
- Delete: `components/PcnBackupView.tsx`
- Delete: `components/PcnCutoverVerificationView.tsx`
- Delete: `components/PcnDataIntegrityView.tsx`
- Delete: `components/PcnHaimyImportView.tsx`
- Delete: `components/PcnHistoricalDiscoveryView.tsx`
- Delete: `components/PcnHistoricalReviewPanel.tsx`
- Delete: `components/PcnHistoricalScopeBadge.tsx`
- Delete: `components/PcnOperationsRegisterView.tsx`
- Delete: `components/PcnQualityDocumentsView.tsx`
- Delete: `components/PcnTemplateManagementView.tsx`
- Modify: `components/PcnSidebar.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PcnDossierDetailView.tsx`
- Delete: `test/pcn-agent-contract.test.ts`
- Delete: `test/pcn-backup-ui.test.ts`
- Delete: `test/pcn-cutover-ui.test.ts`
- Delete: `test/pcn-customer-import-ui.test.ts`
- Delete: `test/pcn-data-integrity-ui.test.ts`
- Delete: `test/pcn-haimy-import.test.ts`
- Delete: `test/pcn-haimy-promotion.test.ts`
- Delete: `test/pcn-historical-discovery-ui.test.ts`
- Delete: `test/pcn-historical-import.test.ts`
- Delete: `test/pcn-historical-review.test.ts`
- Delete: `test/pcn-operations-register.test.ts`
- Delete: `test/pcn-quality-documents.test.ts`
- Delete: `test/pcn-template-review.test.ts`
- Delete: `test/pcn-template-source-import.test.ts`

**Interfaces:**
- Consumes: Task 1 forbidden-surface contract and existing five-region dossier contract.
- Produces: a compile-safe active PCN import graph with no standalone retired surfaces; dossier regions remain reachable only from `PcnDossierDetailView`.

- [ ] **Step 1: Write the failing reachability test**

  Extend `test/pcn-surface-prune.test.ts` with a source-level reachability assertion:

  ```ts
  test('active PCN keeps only valid dossier regions', () => {
    const detail = read('components/PcnDossierDetailView.tsx');
    const workspace = read('components/PcnWorkspace.tsx');
    assert.match(detail, /PcnSampleFlowView/);
    assert.match(detail, /PcnLabRequestView/);
    assert.match(detail, /PcnResultReturnView/);
    assert.match(detail, /PcnIssuanceView/);
    assert.doesNotMatch(workspace, /Pcn(SampleFlow|LabRequest|ResultReturn|Issuance)View/);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/pcn-surface-prune.test.ts`

  Expected: FAIL while the retired files and old contracts are still present.

- [ ] **Step 3: Delete retired PCN-only files and remove stale references**

  Use `apply_patch` file deletions for the listed PCN-only views and tests, plus their dedicated Haimy/Cutover/Agent support modules when no active workflow imports them. Remove dead imports, stale `PcnSection` branches, Haimy/Cutover/Agent collection references and comments from active code. Do not delete the four dossier-region components or `PcnDocumentGenerationPanel`, `PcnApprovalModal`, `PcnSignerDelegationPanel` and file preview components.

- [ ] **Step 4: Run TypeScript validation and the focused test**

  Run: `npm run lint`; then `node --test test/pcn-surface-prune.test.ts`

  Expected: TypeScript has no missing imports and the surface test passes.

- [ ] **Step 5: Run the active dossier tests**

  Run: `npm run test:pcn`

  Expected: active sample-flow, lab-request, result, approval, issuance, document and customer tests pass; no deleted retired test is still selected by `scripts/run-pcn-tests.cjs`.

### Task 3: Add PCN settings model, API client and Admin UI

**Files:**
- Create: `components/PcnSettingsView.tsx`
- Create: `utils/pcnSettingsApi.ts`
- Modify: `types.ts`
- Modify: `utils/pcnNavigation.ts`
- Modify: `components/PcnSidebar.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `store-pcn.ts`
- Modify: `server.ts`
- Modify: `utils/pcnRbac.ts`
- Test: `test/pcn-settings.test.ts`

**Interfaces:**
- Consumes: Admin PCN session, `pcnCertificationFields`, `pcnDocumentRequirements`, `pcnTemplateDefinitions`, current Storage config and existing specialized template review APIs.
- Produces: `PcnSettingsView`, `PcnSettings` and `fetchPcnSettings`/`updatePcnSettings` over `GET/PUT /api/pcn/settings`, restricted to Admin PCN.

- [ ] **Step 1: Write the failing settings contract test**

  Add assertions for the data shape and UI boundary:

  ```ts
  test('PCN settings is Admin-only and does not expose DDT settings', () => {
    const view = read('components/PcnSettingsView.tsx');
    const server = read('server.ts');
    assert.match(view, /Lĩnh vực|Tuyến phòng thử|Checklist|OCR|Storage/);
    assert.doesNotMatch(view, /lịch thử|KTV mặc định|Phòng Giám định|brands|products/i);
    assert.match(server, /\/api\/pcn\/settings/);
    assert.match(server, /requirePcnAdmin/);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/pcn-settings.test.ts`

  Expected: FAIL because the settings view, type and API route do not yet exist.

- [ ] **Step 3: Implement settings model and server boundary**

  Add a `PcnSettings` type with `fieldProfiles`, `labRoutes`, `documentChecklistVersion`, `codingPolicy`, `ocrProvider`, `ocrServiceStatus` and `storageBucket`. Persist one versioned JSON document in the PCN `systemConfig` collection under a fixed PCN key. `GET` returns a safe snapshot; `PUT` validates QC codes, route kinds and scalar limits, records an Admin activity log, and rejects viewer/staff writes. Do not persist secrets in the JSON document.

- [ ] **Step 4: Implement the Admin UI and navigation**

  Add `settings` to `PcnSection`, show it only through the existing Quản trị disclosure for Admin, and render `PcnSettingsView` from `PcnWorkspace`. Use inline panels rather than nested pages/tabs. Link existing personnel management from the same admin context; keep official template review as a panel/action, not a standalone template page.

- [ ] **Step 5: Run focused tests**

  Run: `node --test test/pcn-settings.test.ts`; then `npm run lint`

  Expected: PASS; non-admin navigation has no settings item and server rejects non-Admin writes.

### Task 4: Add PCN OCR service contracts and extraction policy

**Files:**
- Create: `utils/pcnOcrApi.ts`
- Create: `utils/pcnOcrPolicy.ts`
- Create: `test/pcn-ocr.test.ts`
- Modify: `types.ts`
- Modify: `server.ts`
- Modify: `utils/pcnFileApi.ts`
- Modify: `utils/pcnRbac.ts`

**Interfaces:**
- Consumes: private PCN file boundary, session user, local PaddleOCR service and optional Gemini provider configuration.
- Produces: `PcnOcrExtraction`, `PcnOcrField`, `requestPcnProposalOcr`, `requestPcnResultOcr` and server endpoints `/api/pcn/ocr/proposal` and `/api/pcn/ocr/result`.

- [ ] **Step 1: Write the failing extraction-policy tests**

  Add tests for confirmation-safe extraction:

  ```ts
  test('OCR extraction is a draft and never a confirmed proposal', () => {
    const extraction = buildPcnOcrExtraction({ customerName: 'Công ty A', fieldCode: 'QC20' }, { sourceAssetId: 'asset-1' });
    assert.equal(extraction.status, 'DRAFT');
    assert.equal(extraction.fields.customerName.value, 'Công ty A');
    assert.equal(extraction.fields.fieldCodes.confirmed, false);
  });

  test('OCR rejects unsupported file types before provider call', () => {
    assert.throws(() => assertPcnOcrFileAllowed({ mimeType: 'text/csv', byteSize: 100 }), /định dạng/i);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/pcn-ocr.test.ts`

  Expected: FAIL because the PCN OCR policy and service contract do not exist.

- [ ] **Step 3: Implement the policy and API client**

  Define supported MIME types, a bounded file size, field confidence levels, provenance and `DRAFT/CONFIRMED/REJECTED` status. Add API clients that send only same-origin requests with `credentials: 'same-origin'`; never send a Desktop path or client-stored credential.

- [ ] **Step 4: Implement server-side OCR endpoints**

  Add authenticated multipart/JSON handling for proposal and result OCR. Verify PCN ownership/context, run PaddleOCR first where available, fall back to explicit Gemini only when policy allows, normalize response into `PcnOcrExtraction`, and return provider/error status without mutating proposal/dossier/result. Store or link the source file through the existing private file boundary and record audit only for the explicit OCR request/confirmation boundary.

- [ ] **Step 5: Run focused tests**

  Run: `node --test test/pcn-ocr.test.ts`; then `npm run lint`

  Expected: PASS with unsupported formats, provider failure and draft-only rules covered.

### Task 5: Integrate OCR into Đề nghị and KQTN regions

**Files:**
- Create: `components/PcnProposalOcrPanel.tsx`
- Create: `components/PcnResultOcrPanel.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `components/PcnResultReturnView.tsx`
- Modify: `store-pcn.ts`
- Test: `test/pcn-ocr-ui.test.ts`

**Interfaces:**
- Consumes: `PcnOcrExtraction`, proposal form state, result state, private file upload and existing PCN mutation callbacks.
- Produces: confirmation-safe OCR panels with field-level provenance and retry/manual-entry paths; no new navigation item or route.

- [ ] **Step 1: Write the failing UI contract test**

  Add assertions that OCR is embedded in the correct surfaces:

  ```ts
  test('proposal OCR is embedded in the Đề nghị form', () => {
    const workspace = read('components/PcnWorkspace.tsx');
    assert.match(workspace, /PcnProposalOcrPanel/);
    assert.doesNotMatch(read('utils/pcnNavigation.ts'), /ocr/i);
  });

  test('result OCR stays inside the KQTN dossier region', () => {
    const detail = read('components/PcnDossierDetailView.tsx');
    const results = read('components/PcnResultReturnView.tsx');
    assert.match(detail, /PcnResultReturnView/);
    assert.match(results, /PcnResultOcrPanel/);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/pcn-ocr-ui.test.ts`

  Expected: FAIL because the panels do not exist or are not mounted.

- [ ] **Step 3: Implement proposal OCR panel**

  Add drag/drop, camera, multi-file selection and paste-safe handling. Display selected files, provider state, extracted values, confidence and source page. Apply values only to local proposal draft; make `Xác nhận dữ liệu OCR` explicit before the existing create/update submit. Preserve manually cleared fields and allow retry/manual entry.

- [ ] **Step 4: Implement KQTN OCR panel**

  Add upload/OCR controls next to the selected returned result. Display field-level suggestions and provenance, then pass only confirmed values to `onSaveResult`. Attach the source file through `onAttachFile`; never use the legacy `kqtnRecords` or DDT result endpoint in PCN.

- [ ] **Step 5: Run focused tests**

  Run: `node --test test/pcn-ocr-ui.test.ts`; then `npm run lint`

  Expected: PASS; OCR is visible only within the Đề nghị form and KQTN region, and all existing five-region card tests remain green.

### Task 6: Migrate settings/personal settings behavior without DDT leakage

**Files:**
- Create: `components/PcnPersonalSettingsPanel.tsx`
- Create: `utils/pcnPersonalSettingsApi.ts`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PcnSidebar.tsx`
- Modify: `utils/pcnAuthApi.ts`
- Modify: `test/pcn-settings.test.ts`

**Interfaces:**
- Consumes: PCN session, Credential Management API helper and server auth boundary.
- Produces: header user-menu drawer for personal display, password and OCR/Gemini preference configuration without `useStore` or DDT `UserSettingsModal`.

- [ ] **Step 1: Write the failing personal settings test**

  Assert that the PCN user menu has a personal settings entry and does not import the legacy store or modal:

  ```ts
  test('PCN personal settings is isolated from DDT store', () => {
    const workspace = read('components/PcnWorkspace.tsx');
    const sidebar = read('components/PcnSidebar.tsx');
    assert.match(`${workspace}\n${sidebar}`, /Cài đặt cá nhân/);
    assert.doesNotMatch(`${workspace}\n${sidebar}`, /UserSettingsModal|from ['"].*store['"]/);
  });
  ```

- [ ] **Step 2: Run test to verify it fails**

  Run: `node --test test/pcn-settings.test.ts`

  Expected: FAIL because the PCN-specific personal panel is not present.

- [ ] **Step 3: Implement the isolated panel and auth calls**

  Add server-side password update/session-safe preferences. Keep password out of browser storage, use Credential Management API only for the optional save-login behavior already defined by PCN policy, and never copy `geminiApiKey` into a generic PCN document. Render the panel from the existing header/user menu without adding a page.

- [ ] **Step 4: Run focused tests**

  Run: `node --test test/pcn-settings.test.ts`; then `npm run lint`

  Expected: PASS and no legacy settings import appears in the active Next import graph.

### Task 7: Full verification and deployment-boundary audit

**Files:**
- Modify: `README.md`
- Modify: `PROJECT_MEMORY.md`
- Modify: `scripts/smokePcnRuntime.ts`
- Modify: `test/pcn-runtime-smoke.test.ts`
- Modify: `test/pcn-port-config.test.mjs`
- Modify: `design.md` only if implementation reveals a contract mismatch

**Interfaces:**
- Consumes: all active PCN components, endpoints, settings and OCR contracts from Tasks 1–6.
- Produces: verified native/dev and Docker/production instructions with no retired surface check remaining.

- [ ] **Step 1: Add the final smoke assertions**

  Require `/api/pcn/settings` to return an authenticated Admin-safe snapshot and require unauthenticated/non-Admin access to be rejected. Replace Cutover smoke expectations with OCR/settings availability checks; do not mark technical backup as a user-facing work surface.

- [ ] **Step 2: Run all required verification commands**

  Run:

  ```text
  git diff --check
  npm run lint
  npm test
  npm run build
  npm run smoke:pcn-runtime
  ```

  Expected: every command exits 0; the smoke output reports PCN profile/database and no call to removed Haimy/Cutover endpoints.

- [ ] **Step 3: Check the working tree for accidental scope expansion**

  Run: `git status --short` and `rg -n "Haimy|Cutover|PcnHistorical|PcnArchive|PcnDataIntegrity|PcnOperationsRegister|PcnAgentWorkspace|PcnBackupView|PcnQualityDocumentsView|PcnTemplateManagementView" app components utils scripts package.json`

  Expected: remaining matches are only explicit legacy documentation or migration notes outside the active Next import graph; no active PCN route, navigation, API or allowlist match remains.

- [ ] **Step 4: Report implementation status with evidence**

  Report exact test/build/smoke counts and any remaining legacy references. Do not claim the production container was recreated unless Docker verification actually recreated it with the existing stable `PCN_SESSION_SECRET`.

## Implementation checkpoint — 2026-08-31

Tasks 1–7 are implemented in the current `master` workspace. The shipped runtime uses one context-aware `POST /api/pcn/ocr` boundary for proposal/result drafts and `GET/PUT /api/pcn/settings` for the Admin settings surface; both are session/RBAC protected. The personal settings drawer is local-display-only by design. Retired PCN pages, imports and Haimy/Cutover/Agent runtime endpoints were removed from the active Next import graph; legacy migration utilities remain outside that graph for reference/maintenance only.

Verification completed: `npm run lint`, `npm test` (471 passed), `npm run build`, and `git diff --check`. The optional runtime smoke was pointed at an already-running older process on port 1357 and reported stale `404/500` responses for `/`, `/api/pcn/settings`, and `/api/pcn/ocr`; restart the native PCN process before using `npm run smoke:pcn-runtime` as an environment check. No production Docker container was recreated by this change.
