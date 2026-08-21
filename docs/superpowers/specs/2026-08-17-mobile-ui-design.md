<!--
Author: Gemini
OS support: Web/Node
Description: Responsive mobile UI audit specification for the DDT Lab web app
-->

# Mobile UI Audit Design

## Goal

Make every user-facing screen usable on 320px, 375px, 390px and 430px mobile viewports while preserving the existing desktop layout, business behavior, data contracts and report output.

## Scope

The audit covers the shared application shell and all reachable views:

1. Shell: global viewport, header, sync controls, notifications, account controls and mobile bottom navigation.
2. Dashboard and request list: filters, grouped request cards, actions and pagination.
3. Handover and warehouse: filters, handover cards and warehouse sidebar.
4. ITD and EMC schedules: mobile day selector, filter sidebar, schedule cards, chamber columns and drag/drop affordances.
5. Summary log and KQTN: search/filter toolbars, data grids, detail views and actions.
6. Report generator: standard selector, metadata form, image slots, form preview and action footer.
7. Master data and settings: brands, customers, products and system settings.
8. Shared dialogs: request, handover, print, settings, sync diagnostic, delete confirmation, cropper and AI chat.

## Non-goals

- No changes to API calls, persistence, state transitions, data models, permissions or navigation semantics.
- No changes to DOCX/PDF/print dimensions or report image aspect-ratio rules.
- No broad component rewrite unless a local layout boundary cannot be made responsive with existing structure.

## Design

### 1. Responsive foundation

Use the existing Tailwind breakpoint conventions and introduce only narrowly scoped global CSS helpers where repeated behavior cannot be expressed safely in class strings. The root remains `width: 100%`, `min-height: 100%` and `zoom: 0.9` as required by the global UI scale rule.

Every horizontal flex/grid boundary that contains user text or controls must be reviewed for `min-width: 0`, wrapping, truncation or an intentional scroll container. Full-page overflow remains hidden; only data regions that genuinely need more width may scroll horizontally.

### 2. Shared shell

At mobile widths, the header prioritizes logo/title, notification and the most important refresh/action affordance. Secondary controls must collapse, hide behind an existing action path, or wrap without pushing the viewport wider. The bottom navigation remains fixed, uses safe-area padding, keeps each item touchable, and scrolls horizontally when needed. Main content gets enough bottom padding to remain reachable above the navigation.

### 3. Screen-by-screen treatment

- Request and handover views use stacked filter controls, full-width search fields, wrapped action groups and cards that keep long codes readable without widening the page.
- Schedule views keep the mobile day selector and convert dense desktop columns into one selected day/chamber flow; schedule cards may scroll within their data area but the page itself must not acquire horizontal overflow.
- Summary/KQTN views use a deliberate mobile representation for dense tables: stacked row cards or a clearly bounded horizontal table region with visible context and reachable row actions.
- Report generator keeps the standard picker, input form and preview as separate mobile sections with a visible tab/segmented switch; action buttons wrap into full-width controls.
- Master data and settings use single-column forms, stacked list rows and scrollable internal lists where necessary.
- Dialogs use `max-height: calc(100dvh - safe margins)` and independent content scrolling; action footers remain reachable and do not sit below the viewport.

### 4. Interaction and accessibility

Primary controls target approximately 44px touch area. Icon-only controls retain accessible labels. Focus states, status badges and destructive-action contrast remain unchanged or improve. Long Vietnamese labels may wrap; no text is removed merely to fit mobile.

## Verification

Verification is performed in this order:

1. Static scan for full-page overflow risks, fixed widths, non-wrapping control groups and modal heights.
2. Typecheck/build after each implementation batch.
3. Browser checks at 320px, 375px, 390px and 430px for the shell, each main view and representative dialogs.
4. Confirm desktop smoke behavior at a representative width after mobile changes.
5. Run the existing automated test suite and the responsive-specific checks added for layout contracts.

## Acceptance criteria

- No unintended horizontal page scroll at the four target mobile widths.
- No modal or fixed action area is clipped vertically; dialog content remains scrollable.
- Header and bottom navigation remain usable with all visible controls reachable.
- Primary controls are touch-friendly and long labels/codes remain understandable.
- Dense tables, calendars and report forms have an explicit mobile viewing strategy.
- Existing business logic, API behavior, navigation targets and print/export output remain unchanged.

<!-- --- End of 2026-08-17-mobile-ui-design.md --- -->
