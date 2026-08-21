<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch triển khai trang Nhật ký hệ thống và audit log bất biến cho DDT Lab
-->

# System Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Xây dựng audit log bất biến cho mọi mutation nghiệp vụ thành công, API phân trang/lọc, trang `Nhật ký hệ thống` cho Admin/Quản lý và sidebar branch ngay trước `Thiết lập`.

**Architecture:** Giữ `activityLogs` trong `app_documents` nhưng tách hoàn toàn khỏi `notifications`. Store tạo log sau mutation và gửi qua client API append-only; trang đọc bằng cursor pagination, không hydrate toàn bộ log vào Zustand. Notification vẫn dùng helper/policy hiện có để chỉ phát các thay đổi lớn.

**Tech Stack:** React 18, TypeScript, Zustand, Express 5, PostgreSQL JSONB, Node test runner, Tailwind utility classes, lucide-react.

**Spec:** `docs/superpowers/specs/2026-08-18-system-activity-log-design.md`

**Implementation status:** Tasks 1–7 complete; verification passed and handoff is ready.

## Global Constraints

- `design.md` là Single Source of Truth; mọi schema, API, RBAC và UI thay đổi phải khớp spec trước khi code.
- Mọi file TS/TSX mới hoặc sửa phải giữ header `Author: Gemini` / `OS support: Web/Node` / `Description: ...` và footer `// --- End of [filename] ---`.
- Activity log ghi mọi mutation nghiệp vụ thành công, kể cả chỉnh sửa nhỏ; notification chỉ phát cho thay đổi lớn.
- `activityLogs` append-only đối với UI; không có sửa/xóa log và không xóa log khi xóa notification.
- Admin và chức danh Quản lý/Trưởng phòng/Phó trưởng phòng/Lãnh đạo mới được thấy trang và nhánh sidebar.
- Trang không tải toàn bộ lịch sử vào Zustand; page size mặc định 50, tối đa 100.
- Test phải chạy với `NODE_OPTIONS=--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs` do giới hạn môi trường Windows hiện tại.
- Không thêm thư viện mới; dùng fetch/REST client và component primitives hiện có.

---

## File map

- Create `utils/activityLog.ts`: type guard, diff sanitizer, action/entity labels và builder thuần cho `ActivityLog`.
- Create `utils/activityLogApi.ts`: client cho append, cursor pagination và tải toàn bộ log khi người dùng chủ động backup.
- Create `components/ActivityLogView.tsx`: bộ lọc, bảng/card, chi tiết before/after, phân trang và CSV export theo các trang đã tải.
- Create `test/activity-log.test.ts`: test builder, diff, redaction, grouped records và quyền hiển thị thuần.
- Create `test/activity-log-api.test.ts`: test URL/query, cursor, append và fetch-all client contract.
- Create `test/activity-log-ui.test.ts`: contract test cho active tab, sidebar placement, route render và không có delete control.
- Modify `types.ts`: thêm `ActivityLogAction`, `ActivityLogEntityType`, `ActivityLog`, `ActivityLogChange`.
- Modify `server.ts`: whitelist collection và thêm GET/POST `/api/activity-logs` với filter, cursor, max limit và append-only insert.
- Modify `sql/schema.sql`: thêm partial expression index cho `activityLogs.createdAt`/`document_id`.
- Modify `store.ts`: tạo helper append, tích hợp vào mọi mutation, restore/backup sync và không đưa toàn bộ logs vào persisted Zustand state.
- Modify `utils/notificationBackup.ts`: thêm trường `activityLogs` trong backup contract và nhận log do SettingsModal tải riêng.
- Modify `components/SettingsModal.tsx`: backup tải activity logs qua pagination; restore hiển thị số lượng và đưa log backup vào cloud bằng merge.
- Modify `scripts/importBackupToPostgres.ts`: import collection `activityLogs` nếu backup CLI có trường này.
- Modify `App.tsx`: active tab, import view/icon, sidebar branch trước `system_settings`, route render và guard quyền.
- Review `design.md`: activityLogs contract, audit policy and backup requirement are already updated before implementation.

---

### Task 1: Define the audit model and pure builder

**Files:**
- Modify: `types.ts`
- Create: `utils/activityLog.ts`
- Create: `test/activity-log.test.ts`

**Interfaces:**
- Produces `ActivityLog`, `ActivityLogAction`, `ActivityLogEntityType`, `ActivityLogChange`.
- Produces `buildActivityLog(input): ActivityLog`.
- Produces `diffActivityFields(before, after, fields?): ActivityLogChange[]`.
- Produces `sanitizeActivityValue(value): unknown` and `isActivityLogVisibleToUser(user): boolean`.

- [x] **Step 1: Write failing tests for the pure contract**

Add tests that assert:

```ts
test('builds an audit record with actor snapshot and stable id', () => {
  const log = buildActivityLog({
    id: 'activity-1',
    actor: { username: 'admin', name: 'Admin', role: 'admin', position: 'Quản lý' },
    action: 'UPDATED',
    entityType: 'REQUEST',
    entityId: 'req-1',
    entityLabel: 'PYC-01',
    summary: 'Admin đã cập nhật phiếu PYC-01',
    source: 'UI',
    changes: [{ field: 'note', before: 'cũ', after: 'mới' }],
  });

  assert.equal(log.id, 'activity-1');
  assert.equal(log.actorUsername, 'admin');
  assert.equal(log.entityType, 'REQUEST');
  assert.equal(log.changes?.[0].field, 'note');
  assert.ok(log.createdAt);
});

test('diffs only changed fields and redacts secrets', () => {
  const changes = diffActivityFields(
    { name: 'A', password: 'old', note: 'cũ' },
    { name: 'B', password: 'new', note: 'mới' },
    ['name', 'password', 'note']
  );

  assert.deepEqual(changes, [
    { field: 'name', before: 'A', after: 'B' },
    { field: 'password', before: '[REDACTED]', after: '[REDACTED]' },
    { field: 'note', before: 'cũ', after: 'mới' },
  ]);
});

test('only admin and management positions can view the activity page', () => {
  assert.equal(isActivityLogVisibleToUser({ role: 'admin', name: 'A', username: 'a' }), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'tester', position: 'Phó trưởng phòng', name: 'A', username: 'a' }), true);
  assert.equal(isActivityLogVisibleToUser({ role: 'tester', position: 'Nhân viên', name: 'A', username: 'a' }), false);
});
```

- [x] **Step 2: Run the focused test and verify the expected RED failure**

Run:

```powershell
$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npx tsx --test test/activity-log.test.ts
```

Expected: FAIL because `utils/activityLog.ts` and the new types do not exist yet.

- [x] **Step 3: Implement the minimal model and builder**

Add the exact union members from the approved spec. `buildActivityLog` must:

1. preserve a supplied `id` or create a UUID-like timestamp/random id;
2. set `createdAt` to the supplied value or `new Date().toISOString()`;
3. snapshot actor fields without storing password/API-key fields;
4. normalize `changes` through `sanitizeActivityValue`;
5. reject/omit undefined optional fields while keeping `summary` and actor name usable.

`diffActivityFields` compares JSON-safe values using `JSON.stringify`, returns only changed fields, and calls `sanitizeActivityValue` for field names matching `password`, `token`, `secret`, `apiKey`, `geminiApiKey`, or `customPassword`.

- [x] **Step 4: Run the focused test and verify GREEN**

Run the same command from Step 2. Expected: all pure builder, redaction and visibility tests pass.

- [x] **Step 5: Refactor only after GREEN**

Keep label/permission helpers pure and small; do not introduce a store dependency into `utils/activityLog.ts`.

### Task 2: Add the paginated activity API and database index

**Files:**
- Create: `utils/activityLogApi.ts`
- Modify: `server.ts`
- Modify: `sql/schema.sql`
- Create: `test/activity-log-api.test.ts`

**Interfaces:**
- Produces `ActivityLogFilters`, `ActivityLogPage`.
- Produces `createActivityLogClient(fetchImpl?)` with `fetchPage(filters): Promise<ActivityLogPage>`, `append(log): Promise<void>`, `appendBatch(logs): Promise<void>`, and `fetchAll(filters?): Promise<ActivityLog[]>`.

- [x] **Step 1: Write failing client contract tests**

Cover the following concrete requests:

```ts
test('requests a stable filtered cursor page', async () => {
  const calls: Array<{ url: string; method: string; body?: string }> = [];
  const client = createActivityLogClient(async (input, init = {}) => {
    calls.push({ url: String(input), method: String(init.method || 'GET'), body: String(init.body || '') });
    return new Response(JSON.stringify({ items: [], nextCursor: null, hasMore: false }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });

  await client.fetchPage({ limit: 50, actor: 'admin', action: 'UPDATED', entityType: 'REQUEST', search: 'PYC-01' }, 'cursor-1');
  assert.match(calls[0].url, /\/api\/activity-logs\?/);
  assert.match(calls[0].url, /limit=50/);
  assert.match(calls[0].url, /actor=admin/);
  assert.match(calls[0].url, /cursor=cursor-1/);
  assert.match(calls[0].url, /search=PYC-01/);
});

test('appends without using the generic collection overwrite endpoint', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const client = createActivityLogClient(async (input, init = {}) => {
    calls.push({ url: String(input), method: String(init.method || 'GET') });
    return new Response('{}', { status: 201, headers: { 'content-type': 'application/json' } });
  });

  await client.append({ id: 'activity-1', actorName: 'Admin', action: 'CREATED', entityType: 'REQUEST', summary: 'Tạo phiếu', source: 'UI', createdAt: new Date().toISOString() });
  assert.deepEqual(calls, [{ url: '/api/activity-logs', method: 'POST' }]);
});
```

- [x] **Step 2: Run the focused API tests and verify RED**

Run with the project preload. Expected: FAIL because the specialized client is not defined.

- [x] **Step 3: Implement the client and server route**

Client requirements:

- encode every query value with `URLSearchParams`;
- clamp `limit` to 1..100 while defaulting to 50;
- parse `{ items, nextCursor, hasMore }` and surface HTTP errors;
- implement `fetchAll` as an explicit cursor loop for backup only, with a guard that stops if `nextCursor` repeats.

Server requirements:

- Add `GET /api/activity-logs` before the generic `/api/db/:collection` route. Validate `limit`, decode the opaque base64url cursor `{ createdAt, id }`, and reject malformed cursors with HTTP 400.
- Build the parameterized PostgreSQL query against `collection_name = 'activityLogs'`. Filter `data->>'actorUsername'`, `data->>'action'`, `data->>'entityType'`, `data->>'createdAt'`, and case-insensitive `summary/entityLabel/requestCode/docNumber/reportNo` search. Order by `(data->>'createdAt') DESC, document_id DESC` and apply the cursor tuple condition.
- Return at most `limit + 1` rows, map rows through `mapDocumentRow`, and create `nextCursor` only when another row exists.
- Add `POST /api/activity-logs` that validates `id`, `createdAt`, `actorName`, `action`, `entityType`, `summary`, and `source`, strips `id` from JSON payload before storage, and inserts with `ON CONFLICT DO NOTHING`; it must never update an existing activity record.
- Add `POST /api/activity-logs/batch` for restore, accepting at most 250 validated logs and inserting with `ON CONFLICT DO NOTHING`; it must not expose PUT/DELETE semantics for this collection.
- Log route errors with `console.error` and return JSON errors consistent with existing REST routes.

Add this partial index to `sql/schema.sql`:

```sql
CREATE INDEX IF NOT EXISTS idx_app_documents_activity_created
ON app_documents ((data->>'createdAt') DESC, document_id DESC)
WHERE collection_name = 'activityLogs';
```

- [x] **Step 4: Run client tests and typecheck**

Run:

```powershell
$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npx tsx --test test/activity-log-api.test.ts; npm run lint
```

Expected: focused API tests pass and TypeScript reports no new errors.

### Task 3: Add backup/import contracts without loading history into Zustand

**Files:**
- Modify: `utils/notificationBackup.ts`
- Modify: `components/SettingsModal.tsx`
- Modify: `scripts/importBackupToPostgres.ts`
- Modify: `store.ts`
- Create: `test/activity-log-backup.test.ts`

**Interfaces:**
- `BackupPayload.activityLogs: ActivityLog[]`.
- `buildBackupPayload(state, timestamp, activityLogs): BackupPayload` keeps existing callers compatible with an empty default.
- `createActivityLogClient().fetchAll()` supplies logs only during explicit backup.

- [x] **Step 1: Write failing backup/import tests**

Add tests that assert:

```ts
test('backup payload carries activity logs separately from notifications', () => {
  const log = { id: 'activity-1', actorName: 'Admin', action: 'UPDATED', entityType: 'REQUEST', summary: 'Sửa phiếu', source: 'UI', createdAt: '2026-08-18T00:00:00.000Z' };
  const backup = buildBackupPayload({ requests: [], notifications: [] }, '2026-08-18T00:00:00.000Z', [log]);
  assert.deepEqual(backup.activityLogs, [log]);
  assert.deepEqual(backup.notifications, []);
});

test('CLI backup conversion imports activityLogs by id', () => {
  const documents = toPostgresDocuments({ activityLogs: [{ id: 'activity-1', summary: 'Sửa phiếu' }] });
  assert.deepEqual(documents, [{ collectionName: 'activityLogs', documentId: 'activity-1', data: { summary: 'Sửa phiếu' } }]);
});
```

- [x] **Step 2: Run focused backup tests and verify RED**

Run with the preload. Expected: FAIL because the backup contract and import mapping do not include `activityLogs`.

- [x] **Step 3: Implement explicit-backup loading and merge restore**

Implement `SettingsModal.handleBackup` as an async handler:

1. call `activityLogClient.fetchAll()`;
2. pass the result to `buildBackupPayload`;
3. download the existing JSON file format with the new `activityLogs` array;
4. keep `notifications` behavior unchanged and show an error toast if log export fails.

Extend restore preview with `activityLogsCount`. In `store.restoreFromBackup`, normalize valid activity log objects and call `activityLogClient.appendBatch(logs)` to merge by id; do not batch-delete existing activity logs. After the business restore succeeds, append one `RESTORED` summary record. `uploadToPostgres` must never delete or rewrite activity logs because it is a background synchronization operation, not a user mutation.

Extend `toPostgresDocuments` with `['activityLogs', backupData?.activityLogs]` and preserve `id` handling.

- [x] **Step 4: Run focused backup tests and verify GREEN**

Run the focused test file plus the existing notification backup test. Expected: both pass and existing backup fields remain unchanged.

### Task 4: Integrate audit writes into business mutations

**Files:**
- Modify: `store.ts`
- Create: `test/activity-log-store-contract.test.ts`

**Interfaces:**
- Store-private helper `appendActivityLog(input): void` calls the specialized API and catches errors into the existing `syncError`/console diagnostic path without rolling back a successful business mutation.
- Every call passes a concrete `entityType`, `action`, actor snapshot, summary and meaningful diff.

- [x] **Step 1: Write failing store integration contract tests**

Because the full Zustand store performs persistence and UI side effects, keep this test at the source contract boundary: assert every mutation action contains an `appendActivityLog` call with the required action/entity metadata, and assert notification helper calls remain guarded for small request/handover changes. The test must read the source with `fs.readFileSync` and fail on missing required call markers rather than mock Zustand internals.

Required source assertions include these action groups:

```ts
for (const marker of [
  "entityType: 'REQUEST'",
  "entityType: 'HANDOVER_DOC'",
  "entityType: 'KQTN_RECORD'",
  "entityType: 'SCHEDULE'",
  "entityType: 'USER'",
  "entityType: 'CUSTOMER'",
  "entityType: 'PRODUCT'",
  "entityType: 'BRAND'",
  "entityType: 'SYSTEM_SETTINGS'",
  "appendActivityLog"
]) {
  assert.match(storeSource, new RegExp(marker.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')));
}
```

Also add a pure behavior test that `isMajorRequestUpdate` still returns false for `note`, display name and display code-only edits while `diffActivityFields` returns those edits.

- [x] **Step 2: Run the contract test and verify RED**

Run with the preload. Expected: FAIL because store has no activity helper/integration.

- [x] **Step 3: Add the append helper and integrate each mutation**

Import `ActivityLog`, `buildActivityLog`, `diffActivityFields`, and the activity API client in `store.ts`. Add one private helper that:

- snapshots the current actor from `get().currentUser`;
- creates the log after the local mutation has been accepted;
- calls `activityLogClient.append(log)` without blocking the existing `syncWithCloud` path;
- records a visible `syncError`/console diagnostic if append fails.

Add calls to the successful branches of:

- `addRequest`/`addRequests`: `CREATED` `REQUEST`, grouped for bulk actions;
- `deleteRequest`/`deleteRequestGroup`: `DELETED` `REQUEST`, with affected count/group id;
- `updateRequestStatus`: `STATUS_CHANGED` with old/new status;
- `updateTestResult`, `addKqtnRecord`, `updateKqtnRecord`, `deleteKqtnRecord`: `UPDATED`/`CREATED`/`DELETED` `KQTN_RECORD` with result diff;
- `moveRequest`, `runAutoSchedule`, `updateTester`, and schedule-related `updateRequest`: `SCHEDULED`, `UNSCHEDULED`, or `ASSIGNED` `SCHEDULE` with date/chamber/tester diff;
- `addHandoverDoc`/update branch and `deleteHandoverDoc`: `CREATED`/`UPDATED`/`DELETED` `HANDOVER_DOC`, including sample ids/type/status diff;
- `updateEcn`, `updateRequestCode`, `updateRequestNote`, and generic `updateRequest`: `UPDATED` `REQUEST` with meaningful diff, while leaving notification calls governed by existing major-change predicates;
- `updateDayConfig`/`updateSettings`: `CONFIGURED` `SYSTEM_SETTINGS` with changed fields;
- customer, brand, product and user add/update/delete: corresponding entity type and `CREATED`/`UPDATED`/`DELETED` action;
- restore/import success paths: one grouped `RESTORED` or `IMPORTED` `SYSTEM` record.

Do not add an activity log to `markNotificationAsRead`, `clearNotifications`, background fetch/sync, or modal-only actions. For failed validation/no-op branches, do not append a log.

- [x] **Step 4: Run the contract test and the full existing notification suite**

Run the new contract test plus `test/notification-*.test.ts`. Expected: all pass, including the low-noise notification policy.

- [x] **Step 5: Refactor duplicate summaries/diffs after GREEN**

Use small local helpers for request/entity labels and grouped counts; do not move unrelated store logic or change existing notification audience behavior.

### Task 5: Build the ActivityLogView UI and CSV export

**Files:**
- Create: `components/ActivityLogView.tsx`
- Create: `test/activity-log-ui.test.ts`

**Interfaces:**
- `ActivityLogView` accepts no business props and reads `currentUser` only for the visibility guard; it calls `createActivityLogClient().fetchPage` and owns page/filter/detail state locally.

- [x] **Step 1: Write failing UI contract tests**

Assert the new component source contains the required visible labels and controls: `Nhật ký hệ thống`, `Người thực hiện`, `Hành động`, `Đối tượng`, `Từ ngày`, `Đến ngày`, `Tải thêm`, `Xuất CSV`, before/after detail labels, and no `deleteActivityLog`/`deleteDocFromPostgres('activityLogs'` call.

- [x] **Step 2: Run UI contract test and verify RED**

Run with the preload. Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement the minimum complete UI**

Implement:

- local filters `{ search, actor, action, entityType, from, to }`, reset cursor whenever any filter changes;
- first page load on mount and reload on filter submit/debounce;
- 50-row page size and `Tải thêm` using `nextCursor`;
- desktop table and mobile card/overflow layout with time, actor, action, entity, summary;
- details panel showing all identifiers and sanitized `changes` as before/after pairs;
- loading, empty, error and retry states;
- `Xuất CSV` for the currently loaded filtered rows with UTF-8 BOM, escaped quotes/commas/newlines, and a descriptive filename;
- row click navigation callback using existing `getNotificationDestination` semantics where possible, with a safe no-op message for deleted/missing entities;
- no edit/delete controls.

- [x] **Step 4: Run UI contract test and typecheck**

Expected: labels/control contract passes and `npm run lint` reports no new errors.

### Task 6: Wire routing and sidebar placement

**Files:**
- Modify: `App.tsx`
- Modify: `test/activity-log-ui.test.ts`

- [x] **Step 1: Extend the failing UI contract**

Assert source order has `activity_log` before `system_settings`, the tab array has label `Nhật ký hệ thống`, and the render tree contains `<ActivityLogView />` guarded by the activity tab.

- [x] **Step 2: Run the test and verify RED**

Expected: FAIL because the tab and sidebar item do not exist.

- [x] **Step 3: Implement the route and sidebar branch**

Import `History` from `lucide-react` and `ActivityLogView`. Add `activity_log` to `ActiveTab`; insert `{ id: 'activity_log', label: 'Nhật ký hệ thống', icon: History, roles: ['admin'] }` immediately before the existing `system_settings` item. Keep the existing `if (tab.id === 'system_settings') return isAdmin` behavior and add the same `isAdmin` guard for `activity_log`; render `<ActivityLogView />` before `SystemSettingsView`.

Add an effect that redirects a user away from `activity_log` if `isAdmin` becomes false, using `requests` as the safe fallback tab. Do not expose the branch in mobile navigation if it is not part of the desktop sidebar contract.

- [x] **Step 4: Run UI contract test and full typecheck**

Expected: placement, label, route and permission assertions pass; `npm run lint` exits 0.

### Task 7: Run end-to-end verification and update project memory

**Files:**
- Modify: `PROJECT_MEMORY.md`
- Review: `design.md` for conformance with the approved activity-log contract; keep the current activity-log section unchanged.
- Test: all existing `test/*.test.ts` plus new activity log tests

- [x] **Step 1: Run the focused test set**

Run:

```powershell
$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npx tsx --test test/activity-log.test.ts test/activity-log-api.test.ts test/activity-log-backup.test.ts test/activity-log-store-contract.test.ts test/activity-log-ui.test.ts
```

Expected: all new tests pass with no unhandled rejection.

- [x] **Step 2: Run the complete project verification**

Run each command freshly and record exit code/output:

```powershell
$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npm test
$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npm run lint
npm run build
git diff --check
```

Expected: tests pass, typecheck exits 0, build exits 0 with only pre-existing bundle-size warnings if present, and diff check has no whitespace errors.

- [x] **Step 3: Inspect the requirements checklist against the spec**

Verify manually from source and tests:

- separate `activityLogs` persistence and no notification reuse;
- every required mutation has an audit call;
- small changes log without notification;
- Admin/Quản lý-only branch immediately before `Thiết lập`;
- server cursor filtering and max page size;
- before/after redaction;
- no UI deletion and notification clear isolation;
- backup/restore and CLI import support.

- [x] **Step 4: Update memory and report repository status**

Append the final architecture, file paths, test counts, build status, and any remaining Git limitation to `PROJECT_MEMORY.md`. Inspect `git status --short`; if this workspace still has no `.git`, report that commit cannot be created here rather than touching another repository.

<!-- --- End of 2026-08-18-system-activity-log.md --- -->
