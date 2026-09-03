# PGDCN shared dashboard redesign — Operations cockpit

## Context

`PgdcnDashboardView` is the common entry surface for the Giám định (PGD) and Chứng nhận (PCN) department. It currently shows six KPI cards, two small domain cards, a notification card and an attention list, but it does not answer the operator's first questions in order: what is blocked, what is due, and where should the next action happen.

The dashboard must remain a read-only projection. PCN and PGD continue to own separate stores, lifecycle enums, canonical cards, mutation boundaries and scope checks. The redesign changes presentation and derived projection only; it does not introduce a cross-domain business record or a dashboard collection.

The approved visual direction is **Operations cockpit**: an action-first command surface with a clear PCN/PGD split, compact status signals and high information density.

## Goals

- Make the first viewport useful for daily coordination between PCN and PGD.
- Put the highest-value action queue before secondary summaries.
- Preserve the six shared KPI projections and existing scope isolation.
- Keep PCN emerald and PGD blue as the two visual domain anchors.
- Add upcoming operational milestones without creating a new calendar or workflow source.
- Keep notification rows on the same shared feed already owned by `PgdcnAppShell`.
- Remove AI and activity-log actions from the dashboard/header action area; those surfaces remain available from the shared sidebar.
- Keep mobile reading and action order usable at 320–430px.

## Non-goals

- No merge of `CertificationDossier` and `PgdInspectionRequest`.
- No new database collection, schema field, mutation endpoint or workflow transition.
- No workflow-node filter that changes either domain's dossier/request list.
- No direct mutation from the dashboard; CTAs only navigate to the canonical domain workspace.
- No replacement of the existing PCN or PGD domain dashboards.
- No new AI, activity-log or notification behavior.

## Design

### 1. Page anatomy

`PgdcnDashboardView` renders one `pcn-page-surface` with this order:

1. **Command header** — eyebrow `IEMM • TVCI · PGDCN`, title `Điều hành phòng`, a short operating description, and only scope-authorized business CTAs: `Tạo Đề nghị` for PCN and `Tiếp nhận PYC` for PGD. The header has no AI or activity-log button.
2. **KPI strip** — six equal cards with the existing labels and values: `Hồ sơ PCN`, `Hồ sơ PGD`, `PCN cần xử lý`, `PGD cần xử lý`, `Hồ sơ cần AI hỗ trợ`, `Quá hạn / cần chú ý`. Existing test id `pgdcn-dashboard-kpi-grid` remains.
3. **Action queue** — the primary desktop content area. It shows the highest-priority attention rows, with overdue rows first, then work rows, then deterministic domain/id ordering. Each row has domain badge, canonical label, Vietnamese status label, reason text, optional due date, and an action affordance that opens the canonical dossier/request surface. Existing source records remain separate.
4. **Domain pipeline** — a secondary desktop column with one PCN panel and one PGD panel. Each panel shows total, active workload, its top bottleneck, a compact status distribution bar with accessible text, and a domain CTA. Existing data-test marker `pgdcn-dashboard-domain-cards` is added to the wrapper.
5. **Upcoming milestones** — a compact list of the next dated PCN target dates and PGD inspection dates, sorted ascending and capped at five. Items without a valid future/present date are excluded. Each row opens the correct source surface. Existing source dates are displayed in `vi-VN` format.
6. **Shared notifications** — the existing `Thông báo phòng` card remains one projection of the `notifications` prop, capped at five visible rows and using the same notification selection callback. Existing test id `pgdcn-dashboard-notifications` remains.

The desktop grid uses a wide left column for the action queue and a narrower right column for the domain pipeline. Upcoming milestones and notifications share the lower row. At mobile widths, the order is command header, KPI strip, action queue, domain pipeline, milestones, notifications.

### 2. Visual system

- Canvas: `bg-slate-50/70`; cards: `bg-white`; borders: `border-slate-200`.
- Command header uses a dark slate surface with small emerald/blue accent marks, but must keep text contrast and no decorative gradients that reduce readability.
- PCN uses `emerald-600`/`emerald-50`; PGD uses `blue-600`/`blue-50`.
- Attention uses `amber` for active work and `rose` for overdue; every signal includes Vietnamese text and an icon or label.
- KPI icons remain visually subordinate to the number. All KPI cards keep equal minimum height and `min-w-0`.
- Compact density follows `design.md`: use existing `ddt-compact`, `mobile-scroll-y`, `mobile-safe-bottom` and `mobile-touch-target` contracts.

### 3. Projection contract

Extend `getPgdcnDashboardProjection` without changing its existing KPI property names:

```ts
type PgdcnDashboardDomain = 'PCN' | 'PGD';
type DashboardAttentionReason = 'WORK' | 'OVERDUE';

interface PgdcnDashboardAttentionItem {
  domain: PgdcnDashboardDomain;
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  reason: DashboardAttentionReason;
  dueDate?: string;
  dueLabel?: string;
}

interface PgdcnDashboardPipelineSegment {
  key: string;
  label: string;
  count: number;
  tone: 'neutral' | 'info' | 'warning' | 'success' | 'critical';
}

interface PgdcnDashboardDomainSummary {
  domain: PgdcnDashboardDomain;
  total: number;
  work: number;
  attention: number;
  bottleneckLabel: string;
  bottleneckCount: number;
  segments: PgdcnDashboardPipelineSegment[];
}

interface PgdcnDashboardUpcomingItem {
  domain: PgdcnDashboardDomain;
  id: string;
  label: string;
  date: string;
  dateLabel: string;
  milestoneLabel: string;
}
```

The projection must:

- Filter each source array by the requested `departmentScopes` before all counts and lists.
- Use the existing PCN and PGD work/closed status sets for counts.
- Count pipeline segments only from known status sets and use an explicit `Khác` segment for other non-closed statuses when needed; never silently drop a loaded record from `total`.
- Pick bottlenecks by fixed domain-specific priority order, then count records at that status. PCN priority is `AWAITING_DOCUMENTS`, `AWAITING_RESULTS`, `CORRECTIVE_ACTION`, `WAITING_APPROVAL`, `TECHNICAL_REVIEW`; PGD priority is `CAPABILITY_REVIEW`, `FIELD_INSPECTION`, `WAITING_LAB_RESULTS`, `RESULTS_REVIEW`, `TECHNICAL_REVIEW`, `LEADERSHIP_APPROVAL`.
- Mark an item `OVERDUE` only when its valid target/inspection date is before the injected `now`; date-only deadlines use end-of-day semantics already used by the helper.
- Sort attention as overdue first, then higher bottleneck/status priority, then `domain`, then `id`.
- Build upcoming milestones from `targetDate`/`inspectionScheduledAt`; exclude invalid dates and cap at five after ascending date sort.
- Provide display labels in the projection/UI layer, preserving raw status for navigation and tests.

The input types may gain optional display fields needed by the projection (`fieldCodes`, `productName`, `customerName`, `updatedAt`) only when they already exist in the domain objects; no new persistence field is added.

### 4. Navigation and scope

Add two shell-owned navigation callbacks:

```ts
onOpenPcnWorkspace: () => void;
onOpenPgdWorkspace: () => void;
```

They set the selected target to PCN `proposals` and PGD `intake` respectively. The callbacks are navigation-only and are rendered only when the current user has the matching department scope. Existing dossier/request callbacks remain for queue, pipeline and milestone rows. `onOpenAssistant` and `onOpenActivity` are removed from the dashboard component because those destinations are already present in the shared sidebar; their routes remain unchanged.

### 5. Responsive/accessibility behavior

- Desktop (`lg` and above): action queue/pipeline are two columns; milestones/notifications are two columns.
- Tablet: KPI strip uses four columns; content blocks stack where necessary.
- Mobile: KPI strip uses two columns; all cards stack in the defined action-first order.
- Keep `min-w-0` on every grid/flex child. Long labels truncate intentionally; detail text may wrap within the row.
- Queue, pipeline segments and milestone rows are buttons with visible focus, `aria-label`, `aria-current` only for navigation state where applicable, and 44px-class hit area.
- Status must not depend on color alone: render `statusLabel` and reason copy.
- No hover-only disclosure or interaction.
- No new page-level scroll container; the shared shell `main` owns vertical scrolling.

## Files and responsibilities

- `components/PgdcnDashboardView.tsx`: render the new cockpit anatomy, domain cards, queue, milestones and notification projection; keep domain callbacks and accessibility markers.
- `components/PgdcnAppShell.tsx`: expose the two navigation-only workspace callbacks and remove dashboard-only AI/activity callbacks.
- `utils/pgdcnDashboard.ts`: derive typed domain summaries, attention queue and upcoming milestones from scope-filtered source snapshots.
- `design.md`: record the shared dashboard layout contract under section 5.2.1.
- `test/pgdcn-dashboard.test.ts`: cover projection counts, scope isolation, attention ordering, status labels, bottleneck selection and milestone sorting.

## Verification and acceptance

- Dual-scope dashboard shows PCN and PGD counts and both business CTAs; single-scope dashboard shows only the authorized domain's CTA/data.
- Header/dashboard action area contains no AI or activity-log CTA; sidebar routes remain available.
- Queue places overdue items before ordinary work and opens the source domain callback with the correct id.
- Pipeline counts reconcile to each domain's loaded source total and show an explicit empty state when a domain has no records.
- Upcoming milestones are deterministic, date-sorted, capped at five and scope-correct.
- Notification card continues to render the same shared `notifications` collection and deep-link callback.
- Existing six KPI labels and `data-testid` markers remain compatible.
- Run the focused dashboard test, `npm run lint`, `npm run build`, `git diff --check` and the existing PCN test suite before completion.
