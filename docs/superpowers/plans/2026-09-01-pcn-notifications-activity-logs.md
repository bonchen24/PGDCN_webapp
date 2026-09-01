# PCN Notifications and ActivityLogs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện notifications theo audience ở PCN và nối trang ActivityLogs chỉ đọc vào shell PCN.

**Architecture:** Tái sử dụng activity log append-only, trigger notification PostgreSQL, `PcnNotificationDropdown` và `ActivityLogView` hiện có. Bổ sung client/server notification boundary chuyên biệt để lọc audience và kiểm tra RBAC ở server, sau đó nối `ActivityLogView` vào navigation PCN mà không refactor các mutation nghiệp vụ.

**Tech Stack:** Next.js 14, React 18, TypeScript, Express 5, PostgreSQL JSONB trong `app_documents`, Zustand, lucide-react, Node test runner qua `tsx`.

**Spec:** `docs/superpowers/specs/2026-09-01-pcn-notifications-activity-logs-design.md`; source of truth: `design.md` mục 7.3–7.4.1.

## Global Constraints

- Chỉ triển khai trong profile PCN; không thêm lại màn hình hoặc entity DDT legacy.
- `activityLogs` là append-only; không thêm UI/API sửa hoặc xóa activity log.
- Notification PCN phải giới hạn ở các entity `PCN_PROPOSAL`, `PCN_DOSSIER`, `PCN_SAMPLE_LOT`, `PCN_LAB_REQUEST`, `PCN_RESULT`, `PCN_APPROVAL`, `PCN_ISSUANCE`.
- Activity có `source=IMPORT` hoặc `source=RESTORE` không phát notification.
- Server là lớp authorize cuối cùng; viewer chỉ đọc notification và ActivityLogs.
- Không tải toàn bộ lịch sử activity vào Zustand để phục vụ trang nhật ký; dùng API cursor/KPI hiện có.
- Hiển thị danh tính bằng họ tên; username chỉ dùng làm khóa/audience kỹ thuật.
- Worktree đang có nhiều thay đổi người dùng chưa commit; không reset, checkout, stash hoặc format các file ngoài phạm vi task.

## File map

- Create `utils/pcnNotificationApi.ts`: client same-origin cho bốn notification endpoint PCN.
- Modify `server.ts`: thêm query audience và bốn endpoint notification có session/RBAC.
- Modify `store-pcn.ts`: dùng client chuyên biệt khi load/refresh/read/read-all/clear notifications.
- Modify `utils/pcnNavigation.ts`: thêm section `activityLogs`, giữ section này cho mọi tài khoản và giữ users/settings Admin-only.
- Modify `components/PcnSidebar.tsx`: icon/label rendering cho section mới.
- Modify `components/PcnWorkspace.tsx`: render `ActivityLogView` với current PCN user directory và thêm nhãn section.
- Modify `utils/activityLog.ts`: nhận diện PCN `systemRole` khi kiểm tra quyền xem, vẫn giữ compatibility policy DDT.
- Modify `components/ActivityLogView.tsx`: copy trạng thái không có quyền trung tính cho cả profile PCN/legacy.
- Create `test/pcn-notification-api.test.ts`: contract tests cho endpoint client.
- Create `test/pcn-activity-logs-feature.test.ts`: contract tests cho server boundary, navigation và ActivityLogs wiring.
- Modify `test/pcn-sidebar-workspaces.test.ts` và `test/pcn-future-work-scope.test.ts`: cập nhật contract navigation do ActivityLogs đã trở thành capability chính thức.

## Task 1: Add the server-side PCN notification boundary

**Files:**
- Modify: `server.ts` near the existing PCN session helpers and `/api/activity-logs` routes.
- Test: `test/pcn-notification-api.test.ts` (server source assertions are added here before implementation).

**Interfaces:**
- Consumes: `getPcnSessionUser`, `requirePcnSession`, `requirePcnMutation`, `app_documents`, and `AppNotification` audience fields.
- Produces: `GET /api/pcn/notifications`, `POST /api/pcn/notifications/:notificationId/read`, `POST /api/pcn/notifications/read-all`, and `POST /api/pcn/notifications/clear`.

- [ ] **Step 1: Write the failing server contract tests**

Add tests that read `server.ts` and assert the PCN routes contain the required security/data clauses:

```ts
test('PCN notification routes filter by the session audience and PCN entity allowlist', () => {
  assert.match(serverSource, /app\.get\(["']\/api\/pcn\/notifications["']/);
  assert.match(serverSource, /PCN_NOTIFICATION_ENTITY_TYPES/);
  assert.match(serverSource, /targetUsernames/);
  assert.match(serverSource, /targetRole/);
  assert.match(serverSource, /LIMIT 50/);
});

test('PCN notification mutations deny viewers and never write activity logs', () => {
  const routeStart = serverSource.indexOf('app.get("/api/pcn/notifications"');
  const activityRouteStart = serverSource.indexOf('app.get("/api/activity-logs"');
  const notificationRoutes = serverSource.slice(routeStart, activityRouteStart);
  assert.match(serverSource, /\/api\/pcn\/notifications\/:notificationId\/read/);
  assert.match(serverSource, /\/api\/pcn\/notifications\/read-all/);
  assert.match(serverSource, /\/api\/pcn\/notifications\/clear/);
  assert.match(serverSource, /requirePcnMutation\(req, res\)/);
  assert.match(serverSource, /jsonb_set\(data, '\{read\}'/);
  assert.doesNotMatch(notificationRoutes, /activityLogs/);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-notification-api.test.ts`

Expected: FAIL because the dedicated `/api/pcn/notifications*` routes and `PCN_NOTIFICATION_ENTITY_TYPES` do not exist yet.

- [ ] **Step 3: Implement the minimal server boundary**

In `server.ts`:

1. Define one allowlist constant for the seven PCN notification entities.
2. Add a helper that appends the allowlist and, for non-admin session actors, the normalized session username to parameterized query parameters. The resulting predicate must require `collection_name = 'notifications'`, an allowlisted PCN `entityType`, and either `targetRole IN ('staff','all')` or a matching lowercase `targetUsernames` JSON array entry. Admin sessions may see all allowlisted PCN notifications.
3. Register `GET /api/pcn/notifications` after the PCN session middleware. Query `data`, order by `data->>'createdAt' DESC, document_id DESC`, and `LIMIT 50`; return `{ items }` via `mapDocumentRow`.
4. Register read mutation routes. All call `requirePcnSession`/`requirePcnMutation`, use the same audience predicate, and update only the notification document with `jsonb_set(data, '{read}', 'true'::jsonb, true)` and `updated_at = CURRENT_TIMESTAMP`.
5. `read-all` updates all unread visible rows and returns `{ updated }`; `clear` deletes only visible PCN notifications and returns `{ deleted }`. Do not insert activity rows in any of these handlers.
6. Return `400` for an empty notification ID, `401` for missing session, `403` for viewer mutation, `404` when a specific read target is not visible/existing, and `500` for database failures.

Use parameterized SQL throughout; never interpolate the session username or notification ID into SQL.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-notification-api.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the server boundary**

Run: `git add server.ts test/pcn-notification-api.test.ts` then `git commit -m "feat: add PCN notification audience boundary"`.

## Task 2: Add the typed notification client and migrate the PCN store

**Files:**
- Create: `utils/pcnNotificationApi.ts`.
- Modify: `store-pcn.ts` in the notification state/load methods.
- Test: `test/pcn-notification-api.test.ts`.

**Interfaces:**
- Consumes: Task 1 endpoints and `AppNotification`.
- Produces: `fetchPcnNotifications(): Promise<AppNotification[]>`, `markPcnNotificationRead(id: string): Promise<void>`, `markAllPcnNotificationsRead(): Promise<void>`, and `clearPcnNotifications(): Promise<void>`.

- [ ] **Step 1: Extend the client contract tests first**

Add a mocked-fetch test for exact requests:

```ts
test('PCN notification client uses the dedicated session boundary', async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const fetchImpl = async (input: RequestInfo | URL, init: RequestInit = {}) => {
    calls.push({ url: String(input), method: init.method || 'GET' });
    return new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  const client = createPcnNotificationClient(fetchImpl);
  await client.fetch();
  await client.markRead('n-1');
  await client.markAllRead();
  await client.clear();
  assert.deepEqual(calls, [
    { url: '/api/pcn/notifications', method: 'GET' },
    { url: '/api/pcn/notifications/n-1/read', method: 'POST' },
    { url: '/api/pcn/notifications/read-all', method: 'POST' },
    { url: '/api/pcn/notifications/clear', method: 'POST' },
  ]);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-notification-api.test.ts`

Expected: FAIL because `utils/pcnNotificationApi.ts` and `createPcnNotificationClient` do not exist.

- [ ] **Step 3: Implement the client and store migration**

Implement `createPcnNotificationClient(fetchImpl = fetch)` with JSON response parsing and clear errors for non-2xx responses. Export the default client methods listed above. `fetch()` must normalize a missing/non-array `items` field to `[]`.

In `store-pcn.ts`, replace only the PCN notification calls:

- `load()` and `refreshPcnNotifications()` call `fetchPcnNotifications()` instead of generic `fetchCollection('notifications')`.
- `markPcnNotificationAsRead()` calls `assertPcnStoreMutationAllowed()`, awaits `markPcnNotificationRead(id)`, then updates the matching local item to `read: true`.
- `markAllPcnNotificationsAsRead()` awaits the dedicated mutation and marks current local items read only after success.
- `clearPcnNotifications()` awaits the dedicated clear mutation and clears local state only after success.

Keep existing merge/limit behavior and preserve errors for the dropdown to catch. Do not change DDT `store.ts` or `NotificationDropdown.tsx`.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-notification-api.test.ts test/pcn-store-rbac.test.ts test/pcn-ui-rbac.test.ts test/pcn-ui-mutation-guards.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the client/store change**

Run: `git add utils/pcnNotificationApi.ts store-pcn.ts test/pcn-notification-api.test.ts` then `git commit -m "feat: use scoped PCN notification client"`.

## Task 3: Expose ActivityLogs in the PCN shell

**Files:**
- Modify: `utils/pcnNavigation.ts`.
- Modify: `components/PcnSidebar.tsx`.
- Modify: `components/PcnWorkspace.tsx`.
- Modify: `utils/activityLog.ts`.
- Modify: `components/ActivityLogView.tsx`.
- Create: `test/pcn-activity-logs-feature.test.ts`.
- Modify: `test/pcn-sidebar-workspaces.test.ts`.
- Modify: `test/pcn-future-work-scope.test.ts`.

**Interfaces:**
- Consumes: existing `ActivityLogView`, `activityLogClient`, PCN users from `usePcnStore`, and `PcnSection`.
- Produces: a sidebar section named `activityLogs` available to all PCN sessions, rendered as `<ActivityLogView currentUser={currentUser} systemUsers={pcn.users} />`.

- [ ] **Step 1: Write failing navigation/UI contract tests**

Create assertions for the new capability:

```ts
test('PCN ActivityLogs is available to staff and stays before settings', () => {
  assert.deepEqual(getPcnMoreNavigationGroups(true).flatMap((group) => group.items), ['users', 'activityLogs', 'settings']);
  assert.deepEqual(getPcnMoreNavigationGroups(false).flatMap((group) => group.items), ['activityLogs']);
  assert.match(sidebarSource, /activityLogs/);
  assert.match(workspaceSource, /import \{ ActivityLogView \}/);
  assert.match(workspaceSource, /activeSection === 'activityLogs'/);
  assert.match(workspaceSource, /<ActivityLogView currentUser=\{currentUser\} systemUsers=\{pcn\.users\} \/>/);
});

test('ActivityLogs remains read-only and PCN users can view it', () => {
  assert.match(activitySource, /fetchPage/);
  assert.match(activitySource, /fetchSummary/);
  assert.doesNotMatch(activitySource, /deleteActivityLog|deleteDocFromPostgres\(['"]activityLogs['"]\)/);
  assert.equal(isActivityLogVisibleToUser({ role: 'staff', systemRole: 'staff' }), true);
});
```

Update the two existing navigation contracts so their expected arrays no longer treat `activityLogs` as future/retired work.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-activity-logs-feature.test.ts test/pcn-sidebar-workspaces.test.ts test/pcn-future-work-scope.test.ts`

Expected: FAIL because `activityLogs` is not in the current PCN section/navigation and the workspace has no ActivityLogView branch.

- [ ] **Step 3: Implement the shell integration**

1. Add `'activityLogs'` to `PcnSection` and `PCN_MORE_NAVIGATION_GROUPS` in the order `['users', 'activityLogs', 'settings']`.
2. Make `getPcnMoreNavigationGroups(false)` retain only `activityLogs`; Admin retains all three. Keep the existing flat rendering in `PcnSidebar` so no unrelated group UI changes are introduced.
3. Add the `Activity` icon to `PCN_SECTION_ICONS` and `activityLogs: 'Nhật ký hệ thống'` to `sectionLabels`.
4. Import `ActivityLogView` and add the `activeSection === 'activityLogs'` content branch with `currentUser` and `pcn.users` props.
5. Extend `isActivityLogVisibleToUser` to accept optional `systemRole`; a valid PCN `systemRole` (`admin`, `staff`, or `viewer`) is allowed, while the existing legacy behavior continues to deny only DDT `office_clerk` records without a PCN system role. Change the access-denied copy in `ActivityLogView` to a profile-neutral message.
6. Do not put ActivityLogs into the mobile bottom navigation; it remains available through the sidebar/menu, preserving the current compact mobile surface.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-activity-logs-feature.test.ts test/pcn-sidebar-workspaces.test.ts test/pcn-future-work-scope.test.ts test/activity-log.test.ts test/activity-log-ui.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the ActivityLogs shell change**

Run: `git add utils/pcnNavigation.ts components/PcnSidebar.tsx components/PcnWorkspace.tsx utils/activityLog.ts components/ActivityLogView.tsx test/pcn-activity-logs-feature.test.ts test/pcn-sidebar-workspaces.test.ts test/pcn-future-work-scope.test.ts` then `git commit -m "feat: expose PCN activity logs"`.

## Task 4: Verify the integrated feature and regression surface

**Files:**
- Modify: no production files unless verification exposes a defect.
- Test: `test/pcn-notification-contract.test.ts`, `test/pcn-audit.test.ts`, `test/pcn-dossier-detail.test.ts`, and the full active PCN suite.

**Interfaces:**
- Consumes: Tasks 1–3 production interfaces.
- Produces: evidence that PCN notifications are scoped and ActivityLogs is wired/read-only.

- [ ] **Step 1: Run all focused notification/activity tests**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-notification-contract.test.ts test/pcn-notification-api.test.ts test/pcn-activity-logs-feature.test.ts test/activity-log-api.test.ts test/activity-log.test.ts test/activity-log-ui.test.ts test/notification-merge.test.ts`

Expected: PASS.

- [ ] **Step 2: Run the active PCN contract suite**

Run: `npm test`

Expected: PASS for all active PCN tests. If the existing future-work contract still asserts that `activityLogs` is forbidden, only update that assertion to the new approved capability; do not weaken unrelated tests.

- [ ] **Step 3: Run typecheck and whitespace checks**

Run: `npm run lint` and `git diff --check`

Expected: TypeScript exits successfully and `git diff --check` reports no whitespace errors.

- [ ] **Step 4: Review the final diff for scope**

Run: `git status --short` and `git diff --stat`

Expected: The planned file paths contain only the feature diff; pre-existing user changes remain untouched and are called out separately in the handoff.

- [ ] **Step 5: Commit verification fixes if any**

If verification required a production/test correction, run `git add` with only the corrected paths and commit with `fix: harden PCN notifications and activity logs`; otherwise leave the worktree unchanged after the feature commits.

## Plan self-review

- Spec coverage: server audience filtering/RBAC is Task 1; typed client and local consistency are Task 2; ActivityLogs navigation/wiring/read-only PCN access is Task 3; stable notification/deep-link behavior remains covered by existing contract tests and is re-run in Task 4.
- No new real-time transport, recipient-state schema, DDT surface, or mutation refactor is planned, matching the spec exclusions.
- No placeholders remain in task steps; every task names exact files, interfaces, failing-test shape, commands, expected outcome, implementation details, and commit boundary.
- Type consistency: `createPcnNotificationClient` exposes `fetch`, `markRead`, `markAllRead`, and `clear`; store methods retain their existing public names and delegate to those methods. `ActivityLogView` receives `UserAccount` props and `PcnSection` includes `activityLogs` consistently across navigation/sidebar/workspace.
