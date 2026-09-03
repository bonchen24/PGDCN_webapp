# PGDCN shared department notifications

## Context

The canonical `/pgdcn/` route renders `PgdcnAppShell`, while the existing notification state and bell live only inside the non-embedded PCN workspace. PGD writes append-only activity records but does not currently create notification records. As a result, the department dashboard has no visible notification surface and a user cannot see one department-wide feed.

The user requirement is one notification room for the department: a dual-scope user should see PCN and PGD operational notifications together, while a single-scope user and the server must continue to respect the existing domain boundary.

## Goals

- Provide one durable, merged notification feed for the PGDCN shell.
- Include PCN and PGD notifications in the same `notifications` collection without merging their business entities or workflows.
- Show the feed in the shared header and as a compact card on `Tổng quan phòng`.
- Preserve audience rules for Admin/Quản lý, staff assignments and viewer read-only access.
- Deep-link each notification to the canonical PCN dossier or PGD request surface.
- Keep the existing PCN notification API compatible while the shared shell uses the PGDCN boundary.

## Non-goals

- No cross-domain dossier/request type, shared workflow or combined business card.
- No separate PGD notification collection or third audit-log collection.
- No notification for every minor field edit, import, restore or activity-log row.
- No client-side authorization based on a notification's `domain` field.

## Chosen architecture

Use one durable notification stream backed by `app_documents` collection `notifications`.

Each new record stores `domain: 'PCN' | 'PGD'`. Existing PCN records without `domain` are normalized to `PCN` at the read boundary; migration is not required solely to render legacy rows. The feed is sorted by `createdAt DESC`, then `id DESC`, deduplicated by notification ID and capped at the 50 newest authorized records.

The shared shell owns the notification state. Domain stores remain responsible for domain business snapshots and do not gain a cross-domain notification state field. The notification projection is the only shared read model in this feature.

### Event creation

PCN keeps its current activity-triggered notification behavior, with the trigger payload extended to persist `domain = 'PCN'` and the existing stable ID contract `pcn-notif-<activityId>`.

PGD's server mutation boundary extends the existing `writePgdActivity` flow with an explicit notification draft for major events. The activity ID and notification ID are created together, and the activity plus notification are inserted in the same transaction. PGD notification IDs use `pgd-notif-<activityId>` so retries cannot create duplicates.

PGD notification-worthy events are limited to request creation, lifecycle/status transitions, assignment, field/sample milestones, laboratory result availability, report/certificate milestones and approval/return decisions. Minor descriptive edits remain activity-only. `IMPORT` and `RESTORE` never emit operational notifications.

Every notification includes the existing metadata contract (`entityType`, `action`, `entityId`, `entityLabel`, actor and timestamp), plus its domain. PGD entity types must be explicit and must not reuse PCN entity types. A notification is an operational projection and never replaces the source activity audit.

### Shared API and authorization

The shared shell uses these session-protected endpoints:

- `GET /api/pgdcn/notifications`
- `POST /api/pgdcn/notifications/:notificationId/read`
- `POST /api/pgdcn/notifications/read-all`
- `DELETE /api/pgdcn/notifications/clear`

The server derives the actor and authorized `departmentScopes` from the session. It returns only notifications whose domain is in the actor's scope and whose `targetRole`/`targetUsernames` audience matches the actor. Admin/Quản lý can read all authorized-domain notifications; staff sees staff/all notifications or explicitly assigned usernames; viewer can read but cannot mutate read/clear state. The browser may display/filter the domain badge but cannot use a client-supplied domain to bypass scope checks.

The read-all and clear operations affect only authorized visible notifications. They never update or delete `activityLogs` or `pgdActivityLogs`. The existing `/api/pcn/notifications*` routes remain available for compatibility and continue to enforce the PCN-only boundary.

### Shared UI

`PgdcnAppShell` renders one bell and dropdown for every authenticated PGDCN account, including embedded PCN/PGD workspaces. The dropdown uses the shared feed, shows one unread count, labels each row `PCN` or `PGD`, and provides the existing read/read-all/clear behavior subject to server permission.

`PgdcnDashboardView` adds a compact `Thông báo phòng` card in the dashboard projection. It shows the newest authorized rows (up to five), unread styling and a link/action to open the shared dropdown. It is not a second feed: the card and header consume the same state and deduplicate by notification ID.

Clicking a row opens the canonical domain-specific surface using a typed navigation target. PCN rows route to the dossier/proposal area; PGD rows route to the request, field/sample, laboratory, report or approval area as appropriate. The shared shell changes the selected domain only after the target has passed the normal scope checks.

## Data and type changes

- Add `PGD_*` notification entity types for the PGD request, assignment, field/sample, laboratory, report/certificate and approval milestones.
- Add required `domain` to newly created `AppNotification` records; keep it optional only at the type/read-normalization boundary for legacy PCN data.
- Keep `NotificationAction`, audience fields and read semantics shared.
- Add a typed shared notification navigation target instead of inferring a PGD route from display text.

## Verification and acceptance

- Contract tests prove the shared API returns a merged, sorted, capped and deduplicated PCN+PGD feed.
- Authorization tests prove single-scope users cannot receive or mutate notifications from the other domain, and viewer cannot mark/clear.
- Event tests prove each major PGD mutation creates exactly one notification and minor edits/import/restore create none.
- Compatibility tests prove legacy PCN notification routes and rows still work.
- UI tests prove the shared header bell, unread count, dropdown, domain labels and dashboard card use one feed and preserve deep-links.
- Run the focused notification tests, the full test suite, typecheck/lint and `git diff --check` before claiming completion.
