# PGDCN Shared Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one durable PCN+PGD notification feed to the shared PGDCN shell, with a header bell, dashboard card, audience enforcement and domain-correct deep links.

**Architecture:** Store PCN and PGD notification projections in the existing `app_documents.notifications` collection with `domain: 'PCN' | 'PGD'`. Keep domain stores and activity logs separate; emit PGD notifications explicitly from the existing transactional `writePgdActivity` path and expose a new session-protected `/api/pgdcn/notifications` boundary. The shared shell owns one notification state and passes it to both the header dropdown and the dashboard card.

**Tech Stack:** Next.js App Router, React 18, Zustand 4, Express 5, PostgreSQL JSONB, TypeScript 5.8, `lucide-react`, Node `node:test`/tsx test runner.

**Spec:** `docs/superpowers/specs/2026-09-03-pgdcn-shared-notifications-design.md` and the notification requirements in `design.md` section 7.4.

## Global Constraints

- Use one durable `app_documents` collection named `notifications`; do not create a PGD notification collection or a third audit collection.
- New notification records must store `domain: 'PCN' | 'PGD'`; legacy PCN rows missing `domain` normalize to `PCN` at the read boundary.
- The shared feed is sorted by `createdAt DESC`, then `id DESC`, deduplicated by notification ID and capped at 50 authorized records.
- The server derives actor, department scope and audience from the authenticated session; a client-supplied domain is never an authorization input.
- Admin/Quản lý can read all notifications in their authorized domains; staff receives staff/all notifications or explicitly targeted usernames; viewer is read-only.
- PGD notifies only major request, status, assignment, field/sample, laboratory, report/certificate and approval milestones; minor edits, `IMPORT` and `RESTORE` remain activity-only.
- Notification read/clear mutations never modify or delete `activityLogs` or `pgdActivityLogs`.
- Preserve the existing `/api/pcn/notifications*` compatibility boundary and its PCN-only allowlist.
- Keep the current dirty worktree intact; stage and commit only files belonging to the task if commits are requested during execution.
- Do not add dependencies or alter PCN/PGD business entity lifecycles.

---

## File map

- `types.ts` — shared notification domain and PGD entity types; legacy-compatible `AppNotification` shape.
- `utils/pgdcnNotification.ts` — pure normalization, merge, audience and navigation helpers shared by server-adjacent code and UI.
- `utils/pgdcnNotificationApi.ts` — browser client for the shared notification boundary.
- `server.ts` — shared read/mutation routes, session/scope/audience SQL predicates and PGD event persistence.
- `sql/pcn-schema.sql` — persist `domain=PCN` in the existing PCN activity notification trigger.
- `components/PgdcnNotificationDropdown.tsx` — shared bell dropdown presentation and accessible actions.
- `components/PgdcnAppShell.tsx` — one feed state, loading/mutations, header bell and deep-link dispatch.
- `components/PgdcnDashboardView.tsx` — compact `Thông báo phòng` card consuming the shell feed.
- `test/pgdcn-notification-projection.test.ts` — pure normalization/merge/navigation behavior.
- `test/pgdcn-notification-api.test.ts` — server boundary and client contract assertions.
- `test/pgdcn-notification-events.test.ts` — PGD event-to-notification coverage.
- `test/pgdcn-notification-ui.test.ts` — shared dropdown/shell/dashboard source contracts.

## Implementation tasks

### Task 1: Add shared notification types and pure projection helpers

**Files:**
- Modify: `types.ts:1084-1210`
- Create: `utils/pgdcnNotification.ts`
- Create: `test/pgdcn-notification-projection.test.ts`

**Interfaces:**
- Produces `NotificationDomain`, PGD `NotificationEntityType` members, `AppNotification.domain?: NotificationDomain` for legacy compatibility, `PgdcnNotificationNavigationTarget`, `normalizePgdcnNotification`, `mergePgdcnNotifications`, `canViewPgdcnNotification` and `getPgdcnNotificationNavigation` for Tasks 2, 5 and 6.

- [ ] **Step 1: Write the failing tests**

Add tests for these exact cases:

```ts
test('normalizes legacy PCN rows and keeps explicit PGD domain', () => {
  assert.equal(normalizePgdcnNotification({ id: 'legacy', type: 'SYSTEM', title: 'cũ', message: 'm', createdAt: '2026-09-03T01:00:00.000Z', read: false }).domain, 'PCN');
  assert.equal(normalizePgdcnNotification({ id: 'pgd-1', domain: 'PGD', type: 'BUSINESS_ACTIVITY', title: 'PGD', message: 'm', createdAt: '2026-09-03T02:00:00.000Z', read: false }).domain, 'PGD');
});

test('merges by id, preserves read state, sorts deterministically and caps at 50', () => {
  const items = mergePgdcnNotifications([
    [{ id: 'same', domain: 'PCN', type: 'SYSTEM', title: 'old', message: 'm', createdAt: '2026-09-03T01:00:00.000Z', read: false }],
    [{ id: 'same', domain: 'PCN', type: 'SYSTEM', title: 'new', message: 'm', createdAt: '2026-09-03T02:00:00.000Z', read: true }],
  ]);
  assert.equal(items.length, 1);
  assert.equal(items[0].read, true);
  assert.equal(items[0].title, 'new');
});

test('maps PCN and PGD entities to typed domain navigation targets', () => {
  assert.deepEqual(getPgdcnNotificationNavigation({ id: 'p', domain: 'PCN', type: 'BUSINESS_ACTIVITY', title: '', message: '', entityType: 'PCN_DOSSIER', entityId: 'd-1', createdAt: '', read: false }), { domain: 'PCN', section: 'proposals', recordId: 'd-1' });
  assert.deepEqual(getPgdcnNotificationNavigation({ id: 'g', domain: 'PGD', type: 'BUSINESS_ACTIVITY', title: '', message: '', entityType: 'PGD_LAB_RESULT', entityId: 'r-1', createdAt: '', read: false }), { domain: 'PGD', section: 'results', recordId: 'r-1' });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-projection.test.ts`

Expected: FAIL because the shared domain types and helper module do not exist.

- [ ] **Step 3: Implement the minimal pure contracts**

In `types.ts`, add:

```ts
export type NotificationDomain = DepartmentScope;
```

Extend `NotificationEntityType` with `PGD_REQUEST`, `PGD_ASSIGNMENT`, `PGD_FIELD_INSPECTION`, `PGD_SAMPLE`, `PGD_LAB_REQUEST`, `PGD_LAB_RESULT`, `PGD_REPORT`, `PGD_CERTIFICATE` and `PGD_APPROVAL`; add `domain?: NotificationDomain` to `AppNotification`. Keep it optional only so old rows type-check before normalization.

In `utils/pgdcnNotification.ts`, implement:

```ts
export type PgdcnNotificationNavigationTarget =
  | { domain: 'PCN'; section: 'proposals' | 'operations' | 'lab-operations' | 'drafting'; recordId: string }
  | { domain: 'PGD'; section: 'requests' | 'field' | 'labs' | 'results'; recordId: string };

export function normalizePgdcnNotification(input: AppNotification): AppNotification & { domain: NotificationDomain };
export function mergePgdcnNotifications(lists: readonly AppNotification[][], limit?: number): Array<AppNotification & { domain: NotificationDomain }>;
export function canViewPgdcnNotification(notification: AppNotification, user: UserAccount | null | undefined): boolean;
export function getPgdcnNotificationNavigation(notification: AppNotification): PgdcnNotificationNavigationTarget | null;
```

The merge helper must normalize missing PCN domains, merge duplicate IDs with the newest metadata and `read = existing.read || incoming.read`, sort by timestamp then ID, and slice to the requested limit (default 50). Navigation must use the explicit `domain` plus entity type; it must never parse display text. Return `null` for a missing entity ID or unknown entity type.

- [ ] **Step 4: Run the focused test to verify it passes**

Run the same command. Expected: PASS.

- [ ] **Step 5: Review the type diff**

Run: `git diff --check -- types.ts utils/pgdcnNotification.ts test/pgdcn-notification-projection.test.ts`

Confirm no existing PCN entity names or legacy notification fields were removed.

### Task 2: Add the shared browser notification client

**Files:**
- Create: `utils/pgdcnNotificationApi.ts`
- Create: `test/pgdcn-notification-api.test.ts`

**Interfaces:**
- Consumes `AppNotification` and `normalizePgdcnNotification` from Task 1.
- Produces `createPgdcnNotificationClient(fetchImpl)`, `fetchPgdcnNotifications`, `markPgdcnNotificationRead`, `markAllPgdcnNotificationsRead` and `clearPgdcnNotifications` for Task 6.

- [ ] **Step 1: Write the failing client contract test**

Use a fake `fetchImpl` and assert the client calls:

```ts
assert.deepEqual(calls, [
  { url: '/api/pgdcn/notifications', method: 'GET' },
  { url: '/api/pgdcn/notifications/n-1/read', method: 'POST' },
  { url: '/api/pgdcn/notifications/read-all', method: 'POST' },
  { url: '/api/pgdcn/notifications/clear', method: 'DELETE' },
]);
```

Also assert that a response item without `domain` is returned with `domain === 'PCN'`.

- [ ] **Step 2: Run the focused client test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-api.test.ts`

Expected: FAIL because the shared client module does not exist.

- [ ] **Step 3: Implement the client**

Use `credentials: 'same-origin'`, `Accept: 'application/json'`, JSON error parsing and the four exact methods above. `fetch()` must map `payload.items` through `normalizePgdcnNotification` and return an empty array for malformed/missing `items`. Use `encodeURIComponent` for notification IDs.

- [ ] **Step 4: Run the focused client test to verify it passes**

Run the same command. Expected: PASS.

### Task 3: Implement the session-protected shared server boundary

**Files:**
- Modify: `server.ts:644-680, 1117-1155, 11890-12020`
- Modify: `sql/pcn-schema.sql:34-112`
- Modify: `test/pgdcn-notification-api.test.ts`

**Interfaces:**
- Consumes `NotificationDomain`, the PGD entity allowlist and existing `getPcnSessionUser`/database profile helpers.
- Produces `buildPgdcnNotificationVisibilityConditions(actor, params)` and the routes `/api/pgdcn/notifications`, `/api/pgdcn/notifications/read-all`, `/api/pgdcn/notifications/clear` and `/api/pgdcn/notifications/:notificationId/read` for the shared client.

- [ ] **Step 1: Add failing server contract assertions**

Assert that `server.ts` contains the shared routes, `departmentScopes`, a PGD notification allowlist, `COALESCE` legacy-PCN normalization, `targetUsernames`, `targetRole`, `LIMIT 50`, viewer mutation denial and JSONB read updates. Assert that the shared route slice does not update or delete either activity-log collection. Preserve the existing PCN route assertions unchanged.

- [ ] **Step 2: Run the focused server contract test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-api.test.ts`

Expected: FAIL because the shared routes and predicates are absent.

- [ ] **Step 3: Implement the shared read predicate and routes**

Add a PGD entity allowlist and a helper with this contract:

```ts
function buildPgdcnNotificationVisibilityConditions(
  actor: PcnNotificationAudienceUser,
  params: any[],
): string[];
```

The predicate must require `collection_name = 'notifications'`, allow PCN legacy rows with `COALESCE(data->>'domain', 'PCN') = 'PCN'`, allow PGD only for `data->>'domain' = 'PGD'`, constrain domain values to the actor's normalized `departmentScopes`, constrain `entityType` to the PCN+PGD allowlists, and apply audience rules. Treat `systemRole=admin`, `departmentRoleCode=LEADERSHIP` or `pgdRole=PGD_MANAGER` as manager-level visibility; otherwise apply targeted-username precedence and `targetRole IN ('staff', 'all')` for staff. Reject sessions without a scope.

Implement GET with deterministic `ORDER BY data->>'createdAt' DESC, document_id DESC LIMIT 50` and map legacy rows with `domain: 'PCN'`. Implement read-all/clear/read-one with the same predicate; read-one must bind the URL ID as a parameter. Use a shared mutation guard that returns 401 for a missing session and 403 for viewer. Keep generic `/api/db` notification writes blocked and leave `/api/pcn/notifications*` behavior intact.

- [ ] **Step 4: Update the PCN trigger metadata**

In `create_pcn_activity_notification`, add `'domain', 'PCN'` to `notification_data`. Keep the stable `pcn-notif-` ID and PCN entity allowlist. Do not add a trigger for `pgdActivityLogs`.

- [ ] **Step 5: Run focused API tests**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-api.test.ts test/pcn-notification-api.test.ts`

Expected: PASS for the new shared boundary and existing PCN compatibility contracts.

### Task 4: Emit durable PGD notifications from major mutations

**Files:**
- Modify: `server.ts:1542-1575, 2831-3315`
- Modify: `types.ts:1084-1210` if the event draft needs a server-facing type adjustment
- Create: `test/pgdcn-notification-events.test.ts`

**Interfaces:**
- Consumes `writePgdActivity(client, actor, input)` and the PGD request/assignment/field/sample/lab/report/certificate/approval shapes in `utils/pgdDomain.ts`.
- Produces `PgdNotificationDraftInput`, `buildPgdNotificationDraft(input)` and one optional `notify` draft on `PgdActivityInput`; when present, `writePgdActivity` inserts exactly one `pgd-notif-<activityId>` row with `domain: 'PGD'` in the same transaction as the activity.

- [ ] **Step 1: Write failing event contract tests**

Assert the source has a single notification insert inside `writePgdActivity`, uses `pgd-notif-`, persists `domain: 'PGD'`, and passes explicit notification drafts for all major PGD route families. Assert that document-template generation and descriptive-only paths do not pass a notification draft. Assert that `IMPORT` and `RESTORE` are excluded.

Use a pure builder test for the event mapping. Define this exact builder contract in the implementation:

```ts
export type PgdNotificationDraftInput = {
  entityType: Extract<NotificationEntityType, `PGD_${string}`>;
  action: NotificationAction;
  entityId: string;
  entityLabel: string;
  actorName: string;
  requestCode?: string;
  previousStatus?: string;
  nextStatus?: string;
  targetUsernames?: string[];
};

export function buildPgdNotificationDraft(input: PgdNotificationDraftInput): Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'domain'>;

assert.equal(buildPgdNotificationDraft({ entityType: 'PGD_REQUEST', action: 'CREATED', entityId: 'r-1', entityLabel: 'PGD-001', actorName: 'A' }).targetRole, 'staff');
assert.equal(buildPgdNotificationDraft({ entityType: 'PGD_APPROVAL', action: 'STATUS_CHANGED', entityId: 'a-1', entityLabel: 'PGD-001', actorName: 'A' }).targetRole, 'admin');
```

- [ ] **Step 2: Run the focused event test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-events.test.ts`

Expected: FAIL because `writePgdActivity` accepts no notification draft and PGD routes do not emit notifications.

- [ ] **Step 3: Add explicit PGD notification drafts**

Extend `PgdActivityInput` with `notify?: Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'domain'>`. Add drafts at these exact route families:

| Route family | Entity/action | Audience |
| --- | --- | --- |
| `POST /api/pgd/requests` | `PGD_REQUEST/CREATED` | `staff` |
| `POST /api/pgd/requests/:requestId/transition` | `PGD_REQUEST/STATUS_CHANGED` | `admin` |
| `POST /api/pgd/assignments` | `PGD_ASSIGNMENT/ASSIGNED` | targeted inspector/reviewer usernames when resolvable, otherwise `admin` |
| `POST /api/pgd/field-inspections` | `PGD_FIELD_INSPECTION/CREATED` or `UPDATED` | `admin` |
| `POST /api/pgd/samples/split` | `PGD_SAMPLE/CREATED` | `admin` |
| `POST /api/pgd/lab-requests` | `PGD_LAB_REQUEST/CREATED` or `UPDATED` | `admin` |
| `POST /api/pgd/lab-results` | `PGD_LAB_RESULT/CREATED` | `admin` |
| `POST /api/pgd/reports` | `PGD_REPORT/CREATED` or `UPDATED` | `admin` |
| `POST /api/pgd/certificates` | `PGD_CERTIFICATE/CREATED` or `UPDATED` | `admin` |
| `POST /api/pgd/approvals` | `PGD_APPROVAL/STATUS_CHANGED` | `admin` |

Include `requestCode`, entity label, status transition metadata and actor in each draft. Do not derive audience from browser text. Use the assignment's stored usernames; if there are no valid usernames, omit `targetUsernames` and use `admin`.

- [ ] **Step 4: Persist the activity and notification together**

Generate one `activity.id`, insert the activity, then conditionally insert:

```ts
if (input.notify) {
  const notification = { ...input.notify, id: `pgd-notif-${activity.id}`, domain: 'PGD', createdAt: activity.createdAt, read: false };
  await client.query(
    `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
     VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
     ON CONFLICT (collection_name, document_id) DO NOTHING`,
    ['notifications', notification.id, JSON.stringify(notification)],
  );
}
```

Keep the `ON CONFLICT DO NOTHING` idempotency behavior on both rows and ensure every PGD route passes the same transaction client to `writePgdActivity`.

- [ ] **Step 5: Run focused event and PGD regression tests**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-events.test.ts test/pcn-pgd-api-contract.test.ts test/pgd-workflow.test.ts`

Expected: PASS, with no change to PGD entity status or activity-log contracts.

### Task 5: Build the shared notification dropdown

**Files:**
- Create: `components/PgdcnNotificationDropdown.tsx`
- Create: `test/pgdcn-notification-ui.test.ts`

**Interfaces:**
- Consumes `AppNotification`, `UserAccount`, `canViewPgdcnNotification` and the callbacks from Task 6.
- Produces an accessible dropdown with one unread count, PCN/PGD badges, read/read-all/clear controls and `onSelect(notification)`.

- [ ] **Step 1: Write failing UI contract tests**

Assert the new component contains `Bell`, `aria-label`, `PCN`, `PGD`, `Đánh dấu đã đọc`, `Đọc tất cả`, `Xóa thông báo`, `targetUsernames`/audience filtering and a bounded list. Assert the component calls `onSelect` with the whole notification and does not create a second API client or local feed.

- [ ] **Step 2: Run the focused UI test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-ui.test.ts`

Expected: FAIL because the shared component does not exist.

- [ ] **Step 3: Implement the shared dropdown**

Adapt the interaction pattern from `components/PcnNotificationDropdown.tsx` without copying its PCN-only entity assumptions. Filter defensively with `canViewPgdcnNotification`, cap visible rows at 50, show newest first, style unread rows, display the domain badge, use Vietnamese empty/error copy, and preserve 44px-class touch targets. Hide mutation controls for viewer users while retaining read navigation.

- [ ] **Step 4: Run focused UI tests**

Run the same command. Expected: PASS.

### Task 6: Integrate one feed into `PgdcnAppShell`

**Files:**
- Modify: `components/PgdcnAppShell.tsx:1-160`
- Modify: `test/pgdcn-notification-ui.test.ts`

**Interfaces:**
- Consumes the shared API client from Task 2, normalization/navigation helpers from Task 1 and `PgdcnNotificationDropdown` from Task 5.
- Produces one `notifications` state and handlers passed to `PgdcnDashboardView`, plus shared-shell deep links to PCN/PGD sections.

- [ ] **Step 1: Add failing shell assertions**

Assert that `PgdcnAppShell.tsx` imports `fetchPgdcnNotifications`, renders `PgdcnNotificationDropdown`, owns `notifications` and `notificationOpen` state, loads after a valid session, passes notifications to `PgdcnDashboardView`, and handles both `domain === 'PCN'` and `domain === 'PGD'` notification targets.

- [ ] **Step 2: Run the focused shell test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-ui.test.ts test/pgdcn-shell-ui.test.ts`

Expected: FAIL because the shell has no shared notification state or bell.

- [ ] **Step 3: Implement shared state and loading**

Add:

```ts
const [notifications, setNotifications] = useState<AppNotification[]>([]);
const [notificationOpen, setNotificationOpen] = useState(false);
```

After `sessionChecked && currentUser`, call `fetchPgdcnNotifications()` once per session/scope change and replace state with normalized results. On logout/reset, clear the local notification state. Mark-read/read-all/clear must call the shared client first, then update local state; surface failures through the existing `sonner` pattern without unhandled rejections.

- [ ] **Step 4: Render the shared header bell**

Place `PgdcnNotificationDropdown` in the shared header so it remains visible while the selected content is a PCN or PGD embedded workspace. Use one unread count computed from the shared feed, a visible `aria-label="Thông báo phòng"`, and close the dropdown after selection.

- [ ] **Step 5: Implement typed deep-link dispatch**

Use `getPgdcnNotificationNavigation` to map each row. PCN targets select `{ domain: 'PCN', section: 'proposals' }` or the mapped PCN work surface; PGD targets select `{ domain: 'PGD', section: 'requests' | 'field' | 'labs' | 'results' | 'settings' }` using the PGD entity type. Never infer a target from `title` or `message`; missing/unknown targets remain readable but do not navigate. Pass `onSelectNotification` and `onOpenNotifications` into the dashboard.

- [ ] **Step 6: Run focused shell/UI tests**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-ui.test.ts test/pgdcn-shell-ui.test.ts`

Expected: PASS, including the existing shared-shell markers.

### Task 7: Add the single shared dashboard notification card

**Files:**
- Modify: `components/PgdcnDashboardView.tsx:1-120`
- Modify: `test/pgdcn-notification-ui.test.ts`

**Interfaces:**
- Consumes `notifications: readonly AppNotification[]`, `onOpenNotifications: () => void` and `onSelectNotification: (notification: AppNotification) => void` from Task 6.
- Produces one compact `Thông báo phòng` card using the same notification objects as the header; no dashboard projection or collection is added.

- [ ] **Step 1: Write failing dashboard assertions**

Assert the component has `Thông báo phòng`, `data-testid="pgdcn-dashboard-notifications"`, the `PCN`/`PGD` labels, unread styling, a maximum-five slice, a no-notification state and a button that calls the shared open/select callbacks. Assert `getPgdcnDashboardProjection` remains unchanged and no notification collection is introduced there.

- [ ] **Step 2: Run the focused dashboard test to verify it fails**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-ui.test.ts test/pgdcn-dashboard.test.ts`

Expected: FAIL because `PgdcnDashboardView` does not accept or render notifications.

- [ ] **Step 3: Implement the card and wire props**

Add `notifications`, `onOpenNotifications` and `onSelectNotification` to the props. Render the newest five normalized items with a domain badge, title/message, relative timestamp, unread indicator and 44px touch target. Clicking a row calls `onSelectNotification`; `Xem tất cả` calls `onOpenNotifications` and opens the same shell dropdown. Keep the card read-only and keep the existing KPI/domain/attention projection unchanged.

- [ ] **Step 4: Run focused dashboard/UI tests**

Run the same command. Expected: PASS.

### Task 8: Full verification and compatibility review

**Files:**
- Modify: only files identified by failing regression tests, with no unrelated cleanup.

- [ ] **Step 1: Run all notification and existing PCN/PGDCN tests**

Run: `node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgdcn-notification-projection.test.ts test/pgdcn-notification-api.test.ts test/pgdcn-notification-events.test.ts test/pgdcn-notification-ui.test.ts test/pcn-notification-api.test.ts test/pcn-notification-contract.test.ts test/pgdcn-shell-ui.test.ts test/pgdcn-dashboard.test.ts`

Expected: PASS with no PCN compatibility regression.

- [ ] **Step 2: Run the complete project test suite**

Run: `npm test`

Expected: all existing and new PCN-profile tests pass.

- [ ] **Step 3: Run typecheck, build and whitespace verification**

Run: `npm run lint`; `npm run build`; `git diff --check`

Expected: typecheck succeeds, Next.js build completes, and `git diff --check` reports no new whitespace errors.

- [ ] **Step 4: Review the final diff against the spec**

Confirm one shared feed powers both UI surfaces, PGD events are explicit and idempotent, legacy PCN notifications normalize correctly, server scope/audience checks are authoritative, activity logs remain append-only and separate, and no unrelated dirty-worktree changes were staged.
