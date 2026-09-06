# Sổ quản lý mẫu dạng cell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển bề mặt PCN “PYC & luân chuyển mẫu nội bộ” thành “Sổ quản lý mẫu” dạng bảng cell, có modal tạo lô/PYC tổng, chọn nhiều PTN trên từng mẫu cùng khách hàng, lưu nháp, gửi fan-out và đối soát phản hồi theo khóa ổn định.

**Architecture:** Giữ `PcnSampleLot`, `PcnSampleItem`, `PcnSampleRoute` làm dữ liệu chuẩn của mẫu và tuyến. Thêm aggregate `PcnSampleRequestBundle` cùng các dispatch theo PTN; mỗi dispatch tiếp tục tạo/cập nhật `OutboundLabRequest` theo route để không phá lifecycle hiện tại. Mọi mutation đi qua boundary server riêng, dựng payload canonical rồi áp dụng mapping versioned theo `targetSystemCode`.

**Tech Stack:** TypeScript, React 18, Next.js App Router, Zustand, Express, PostgreSQL `app_documents` JSONB, Node test runner.

**Spec:** `design.md` mục 0.9, 3.6.1, 4.1.1, 6 và 7.3.

## Global Constraints

- `design.md` là nguồn chuẩn duy nhất; không tạo source-of-truth thứ hai.
- Các dòng mẫu trong một PYC tổng phải cùng customer snapshot; server phải kiểm tra lại invariant.
- Mã lô/mã mẫu người dùng sửa được nhưng phải duy nhất trong miền PCN; id kỹ thuật không đổi.
- `Lưu` chỉ lưu nháp; `Gửi` lưu snapshot rồi fan-out; lỗi PTN này không rollback PTN đã ACK.
- Không map hoặc inbound-match bằng tên/model; luôn giữ `bundleId`, `routeId`, `sampleItemId`, `externalRequestId`, sequence.
- Viewer chỉ đọc; mutation phải kiểm tra session/RBAC ở client, store và server.
- Không ghi aggregate mới bằng generic `/api/db`; dùng endpoint transaction chuyên biệt và audit append-only.
- Giữ các thay đổi người dùng đang có; không sửa/xóa `docs/superpowers/specs/2026-09-06-so-tong-hop-cell-grid-design.md`.

---

### Task 1: Canonical bundle model, validation, projection and lab mapping

**Files:**
- Modify: `types.ts` — thêm `PcnSampleRequestBundle`, `PcnSampleRequestBundleDispatch`, source refs, dispatch statuses và link fields trên `OutboundLabRequest`.
- Create: `utils/pcnSampleRequestBundle.ts` — pure validation, customer grouping, code uniqueness input validation, draft builder và dispatch plan.
- Create: `utils/pcnSampleRegister.ts` — pure row projection, lab-column tokens/status labels và filter/search helpers.
- Modify: `utils/pcnLabIntegration.ts` — thêm bundle identity và canonical child-dispatch mapping contract.
- Test: `test/pcn-sample-request-bundle.test.ts`.
- Test: `test/pcn-sample-register.test.ts`.

**Interfaces:**
- `validateSampleRequestBundleDraft(draft, context): ValidationIssue[]` — trả lỗi theo `path`, không ghi DB.
- `PcnSampleRequestBundleDraft` — input gồm customer key, source refs, dòng mẫu mới/cũ, field codes, target date và criteria; mỗi dòng giữ `sampleItemId?`, `sampleLotId?`, mã lô/mã mẫu hiển thị, các trường mẫu và `labCodes`.
- `buildSampleRequestBundleDraft(input, now): PcnSampleRequestBundle` — dựng bundle DRAFT với customer snapshot, source refs, line ids và per-lab dispatch.
- `buildSampleRegisterRows(input): PcnSampleRegisterRow[]` — mỗi `PcnSampleItem` đúng một row, route/lab feedback nằm đúng cột.
- `buildPcnLabDispatchPayload(...)` tiếp tục là payload canonical; mở rộng `request.bundleId`, `request.parentPycNumber` và `request.pcnSampleItemIds` mà vẫn giữ các field cũ.

- [ ] **Step 1: Write the failing tests**

  Viết các test xác nhận: trộn hai customer bị từ chối; một mẫu được tích nhiều PTN tạo nhiều dispatch song song; mã lô/mã mẫu trùng bị từ chối; draft giữ được mã người dùng sửa; projection tạo một row cho mỗi sample item và render trạng thái từng lab; payload giữ đủ bundle/route/item identity.

- [ ] **Step 2: Run tests to verify they fail**

  Run: `node --test test/pcn-sample-request-bundle.test.ts test/pcn-sample-register.test.ts`

  Expected: FAIL vì các type/helper mới chưa tồn tại.

- [ ] **Step 3: Implement minimal pure model and helpers**

  Thêm type và helper không có side effect. Validation phải chuẩn hóa code để so sánh nhưng giữ giá trị hiển thị; dispatch plan phải nhóm theo `labCode`, giữ danh sách `routeIds`/`sampleItemIds`, không sinh request ngoài khi chưa có route hợp lệ.

- [ ] **Step 4: Run focused tests**

  Run: `node --test test/pcn-sample-request-bundle.test.ts test/pcn-sample-register.test.ts`

  Expected: PASS.

- [ ] **Step 5: Run existing integration contract tests**

  Run: `node --test test/pcn-lab-integration.test.ts test/pcn-lab-routing.test.ts test/pcn-sample-flow.test.ts`

  Expected: PASS; payload cũ và lifecycle route không bị phá.

### Task 2: Atomic persistence and dispatch server boundaries

**Files:**
- Modify: `server.ts` — thêm allowlist collection, transaction helpers, bundle create/save/send/retry endpoints và server-side same-customer/code/RBAC checks.
- Modify: `sql/pcn-schema.sql` — thêm `pcnSampleRequestBundles` indexes/allowlist metadata nếu schema hiện hành cần khai báo collection.
- Modify: `utils/pcnSampleRequestBundleApi.ts` — client cho create/save/send/retry.
- Test: `test/pcn-sample-request-bundle-api-contract.test.ts`.
- Test: `test/pcn-sample-request-bundle-server.test.ts`.

**Interfaces:**
- `POST /api/pcn/sample-request-bundles` body `{ bundle }` → `{ bundle, lots, items, routes, dispatches, labRequests, activityLogs }`.
- `POST /api/pcn/sample-request-bundles/:bundleId/send` → per-dispatch outcome, persisted bundle and child PYC records.
- `POST /api/pcn/sample-request-bundles/:bundleId/retry/:dispatchId` → one updated dispatch and related child request links.
- API client functions: `savePcnSampleRequestBundle`, `sendPcnSampleRequestBundle`, `retryPcnSampleRequestBundleDispatch`.

- [ ] **Step 1: Write failing boundary contract tests**

  Assert endpoint paths/methods, same-customer rejection, duplicate code rejection, viewer rejection, draft persistence without adapter call, idempotent retry, and partial send where one PTN ACKs while another is ERROR.

- [ ] **Step 2: Run focused tests to verify RED**

  Run: `node --test test/pcn-sample-request-bundle-api-contract.test.ts test/pcn-sample-request-bundle-server.test.ts`

  Expected: FAIL because routes, collection and API client do not exist.

- [ ] **Step 3: Implement transaction boundary**

  Lock the selected dossiers/lots/routes and existing codes, validate customer snapshot from authoritative dossier/proposal data, create or reuse lots/items/routes idempotently, persist the bundle snapshot and activity log in one transaction, and return all updated records needed by the store.

- [ ] **Step 4: Implement send/retry fan-out**

  For each dispatch, resolve the canonical child route/request, call the existing integration boundary with the authenticated actor, persist `SENDING`/`ACKNOWLEDGED`/`ERROR` independently, and return all outcomes. Reusing the same bundle and dispatch idempotency key must not create duplicate target requests.

- [ ] **Step 5: Run focused tests**

  Run: `node --test test/pcn-sample-request-bundle-api-contract.test.ts test/pcn-sample-request-bundle-server.test.ts test/pcn-lab-request-api-contract.test.ts`

  Expected: PASS.

### Task 3: Store wiring and inbound exact feedback reconciliation

**Files:**
- Modify: `store-pcn.ts` — load `pcnSampleRequestBundles`; add save/send/retry actions and merge returned lots/items/routes/labRequests/events/activity logs.
- Modify: `types.ts` — add response/feedback fields required by store merge if not already included in Task 1.
- Modify: `server.ts` — extend webhook/reconcile link resolution to prefer `targetSystemCode + externalRequestId + pcnRouteId + pcnSampleItemId + sequence` and mark unresolved events for review.
- Modify: `utils/pcnLabRequestApi.ts` — carry bundle/item identity where the existing client contract needs it.
- Test: `test/pcn-sample-request-bundle-store.test.ts`.
- Test: `test/pcn-lab-integration.test.ts`.

- [ ] **Step 1: Write failing store/reconciliation tests**

  Assert store load contains bundles, partial outcomes merge without dropping ACKed dispatches, retry updates only one dispatch, inbound status updates only the addressed item snapshot, and an event missing stable identity is not applied by name.

- [ ] **Step 2: Run tests to verify RED**

  Run: `node --test test/pcn-sample-request-bundle-store.test.ts test/pcn-lab-integration.test.ts`

  Expected: FAIL because bundle state and exact inbound guard are missing.

- [ ] **Step 3: Implement store actions and merge logic**

  Reuse the existing PCN mutation guard, update local state only from server responses, preserve unrelated bundle dispatches and activity rows, and keep viewer reads available without exposing mutation actions.

- [ ] **Step 4: Implement exact inbound matching**

  Resolve the child request by external id and target system, verify route and sample item ownership, reject stale/ambiguous events, and record `RECONCILE_REQUIRED`/audit evidence instead of guessing a row.

- [ ] **Step 5: Run focused tests**

  Run: `node --test test/pcn-sample-request-bundle-store.test.ts test/pcn-lab-integration.test.ts test/pcn-lab-lifecycle.test.ts`

  Expected: PASS.

### Task 4: Sổ quản lý mẫu cell grid and bundle modal

**Files:**
- Modify: `components/PcnLabOperationsView.tsx` — replace card/accordion primary surface with the sample ledger table, lab-colored columns, filters, selection and CTA.
- Create: `components/PcnSampleRequestBundleModal.tsx` — source picker, same-customer sample list, create-lot rows, editable codes, per-row multi-lab checkboxes, Save/Send states and partial-result panel.
- Modify: `utils/pcnSampleRegister.ts` — add modal source projection and cell status view helpers if the UI needs them.
- Test: `test/pcn-lab-operations.test.ts` — update contract assertions for ledger title/table/cell/modal boundaries.
- Test: `test/pcn-sample-request-bundle-ui.test.ts`.

**Interfaces:**
- `PcnLabOperationsView` receives `sampleRequestBundles`, `onSaveBundle`, `onSendBundle`, `onRetryBundleDispatch`, and existing read-only source collections.
- `PcnSampleRequestBundleModal` receives proposals, dossiers, lots, items, routes, lab requests, bundles, current user and mutation callbacks; it emits one `PcnSampleRequestBundleDraft`.

- [ ] **Step 1: Write failing UI contract tests**

  Assert the page title `Sổ quản lý mẫu`, CTA `Tạo Phiếu yêu cầu thử nghiệm`, one row per sample item, independent PTN-colored columns, same-customer guard, editable mã lô/mã mẫu, multi-checkbox selection, `Lưu`, `Gửi`, per-PTN error and retry labels, and no direct `fetch()` from the projection component.

- [ ] **Step 2: Run tests to verify RED**

  Run: `node --test test/pcn-lab-operations.test.ts test/pcn-sample-request-bundle-ui.test.ts`

  Expected: FAIL because the existing page is card/flow based and has no bundle modal.

- [ ] **Step 3: Implement the read/write surface**

  Build the ledger from pure projections, keep row identity and cell labels accessible, give each lab a stable background token, keep horizontal scroll inside the table, and open the modal for all mutations. The modal must filter sources to one customer, create new lot/item rows locally, validate codes before submit, and show independent PTN dispatch outcomes after Send.

- [ ] **Step 4: Run focused UI tests**

  Run: `node --test test/pcn-lab-operations.test.ts test/pcn-sample-request-bundle-ui.test.ts test/pcn-mobile-scroll.test.ts`

  Expected: PASS.

### Task 5: Workspace/navigation integration and audit/notification copy

**Files:**
- Modify: `components/PcnWorkspace.tsx` — pass bundle state/actions to the page and load the new modal callbacks.
- Modify: `utils/pcnNavigation.ts` — keep the section key stable but label it `Sổ quản lý mẫu`.
- Modify: `components/PcnSidebar.tsx` and `components/PgdcnAppShell.tsx` — update visible section labels/header context while preserving route compatibility.
- Modify: `utils/activityLog.ts` and notification event helpers — add `PCN_SAMPLE_REQUEST_BUNDLE` labels/actions without changing legacy PYC labels.
- Test: `test/pcn-sidebar-workspaces.test.ts`.
- Test: `test/pcn-notification-contract.test.ts`.

- [ ] **Step 1: Write failing navigation/audit tests**

  Assert sidebar/header text is `Sổ quản lý mẫu`, stable section key remains `lab-operations`, bundle create/send/retry activity uses PCN entity labels, and legacy PYC activity remains readable.

- [ ] **Step 2: Run tests to verify RED**

  Run: `node --test test/pcn-sidebar-workspaces.test.ts test/pcn-notification-contract.test.ts`

  Expected: FAIL on the old label/entity mapping.

- [ ] **Step 3: Implement wiring and copy**

  Add the new store selectors/actions to `PcnWorkspace`, preserve viewer read-only behavior and existing dossier deep links, update labels only where the PCN section is displayed, and keep `PcnLabOperationsView` as the compatibility component name to avoid an unnecessary route migration.

- [ ] **Step 4: Run focused tests**

  Run: `node --test test/pcn-sidebar-workspaces.test.ts test/pcn-notification-contract.test.ts test/pcn-ui-rbac.test.ts`

  Expected: PASS.

### Task 6: Full verification and regression hardening

**Files:**
- Modify: relevant files from Tasks 1–5 only; no unrelated refactor.
- Test: all focused tests from Tasks 1–5.

- [ ] **Step 1: Run formatter-independent static checks**

  Run: `git diff --check`

  Expected: no whitespace errors.

- [ ] **Step 2: Run TypeScript validation**

  Run: `npm run lint`

  Expected: exit code 0.

- [ ] **Step 3: Run the complete PCN suite**

  Run: `npm test`

  Expected: all existing and new tests pass with zero failures.

- [ ] **Step 4: Run production build**

  Run: `npm run build`

  Expected: Next production build completes successfully.

- [ ] **Step 5: Review final diff**

  Run: `git status --short` and `git diff --check`.

  Confirm the untracked user file remains untouched, no `.env` files changed, the Sổ page has no direct external calls, and all mutations use the dedicated server boundaries.
