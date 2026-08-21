<!--
Author: Gemini
OS support: Web/Node
Description: Implementation plan for the DDT Lab mobile UI audit
-->

# Mobile UI Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all DDT Lab views usable at 320px, 375px, 390px and 430px without changing business logic, navigation semantics or report output.

**Architecture:** Keep the existing Tailwind-first component structure. Add a small set of global mobile layout utilities for repeated safe-area, touch-target and bounded-scroll behavior, then apply targeted class changes to the shared shell, dense views and dialogs in route order. Keep full-page overflow hidden and allow horizontal scrolling only inside explicit data regions.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Vite, `tsx --test`, existing component files.

## Global Constraints

- Audit widths are exactly 320px, 375px, 390px and 430px; desktop behavior remains intact.
- Changes are UI/CSS/layout only; do not change schema, API, persistence, state transitions, permissions, navigation, or report/DOCX/PDF output.
- Preserve the global `#root` scale of `zoom: 0.9`, `width: 100%`, and `min-height: 100%`.
- Long labels and codes must wrap or truncate intentionally; they must not create page-level horizontal overflow.
- Primary mobile controls target approximately 44px touch area and icon-only controls keep accessible labels.
- Every modified JS/TS/TSX file must retain the required Gemini header and end footer from `AGENTS.md`.
- The workspace has no `.git` directory; do not fabricate commits or alter `.env`.

---

### Task 1: Add responsive contract tests before production changes

**Files:**
- Create: `test/mobile-ui-contract.test.ts`
- Read-only reference: `design.md`, `index.css`, `App.tsx`

**Interfaces:**
- Consumes: source text from `index.css` and `App.tsx`.
- Produces: repeatable tests for root sizing, mobile navigation safe-area behavior, and absence of known page-level overflow regressions.

- [ ] **Step 1: Write the failing tests**

  Add tests using Node's built-in `node:test`, `node:assert/strict`, and `node:fs` that assert:

  ```ts
  test('keeps the scaled root constrained to the viewport', () => {
    assert.match(css, /#root\s*\{[\s\S]*zoom:\s*0\.9/);
    assert.match(css, /#root\s*\{[\s\S]*width:\s*100%/);
    assert.match(css, /#root\s*\{[\s\S]*min-height:\s*100%/);
  });

  test('defines reusable mobile layout contracts', () => {
    assert.match(css, /\.mobile-safe-bottom/);
    assert.match(css, /\.mobile-scroll-x/);
    assert.match(css, /\.mobile-touch-target/);
  });

  test('keeps the mobile navigation safe-area aware', () => {
    assert.match(app, /Menu di động/);
    assert.match(app, /safe-area-inset-bottom/);
  });
  ```

  Keep the assertions focused on user-visible contracts rather than exact class ordering.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- test/mobile-ui-contract.test.ts`

  Expected: FAIL because the three reusable CSS contracts do not exist yet.

- [ ] **Step 3: Do not change production code in this task**

  The test must fail for the missing responsive contracts, not because of a syntax or import error.

---

### Task 2: Harden global CSS and the shared application shell

**Files:**
- Modify: `index.css`
- Modify: `App.tsx:1828-2087, 2424-2450`
- Test: `test/mobile-ui-contract.test.ts`

**Interfaces:**
- Consumes: existing `App` shell and `#root` scale rules.
- Produces: mobile-safe shell layout, reachable content above the fixed bottom navigation, and reusable CSS contracts from Task 1.

- [ ] **Step 1: Implement the smallest CSS contract**

  Add utilities for safe bottom padding, explicit horizontal data scrolling and touch targets. Keep them generic and non-invasive:

  ```css
  .mobile-safe-bottom {
    padding-bottom: calc(4.5rem + env(safe-area-inset-bottom));
  }

  .mobile-scroll-x {
    max-width: 100%;
    overflow-x: auto;
    overscroll-behavior-x: contain;
    -webkit-overflow-scrolling: touch;
  }

  .mobile-touch-target {
    min-width: 2.75rem;
    min-height: 2.75rem;
  }
  ```

  Preserve the required header/footer and the existing report-form typography scope.

- [ ] **Step 2: Apply shell classes without changing behavior**

  In `App.tsx`:

  - Keep the desktop sidebar unchanged.
  - Add `min-w-0` to header/content flex boundaries that contain text.
  - Make the refresh control icon-first on narrow widths while preserving its title and click handler.
  - Add `mobile-safe-bottom` to scrollable mobile sections whose content is behind the bottom nav.
  - Add `mobile-touch-target` to the bottom-nav buttons and keep the existing horizontal overflow behavior.
  - Keep notification and account popovers bounded to the viewport.

- [ ] **Step 3: Run the focused test and verify GREEN**

  Run: `npm test -- test/mobile-ui-contract.test.ts`

  Expected: PASS with all responsive contract assertions green.

- [ ] **Step 4: Run typecheck**

  Run: `npm run lint`

  Expected: exit code 0.

---

### Task 3: Make request, handover and warehouse views mobile-safe

**Files:**
- Modify: `App.tsx:289-735, 2090-2393`
- Modify: `components/WarehouseSidebar.tsx`
- Modify: `components/HandoverDocsModal.tsx`
- Test: `test/mobile-ui-contract.test.ts`

**Interfaces:**
- Consumes: existing request grouping, handover filtering and warehouse card behavior.
- Produces: stacked filters, wrapping cards and bounded data regions with unchanged handlers and data.

- [ ] **Step 1: Add a failing contract for request/handover mobile boundaries**

  Assert that the source contains mobile-safe classes on the main request and handover content regions and that the handover table has an explicit bounded scroll container.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- test/mobile-ui-contract.test.ts`

  Expected: FAIL for the new request/handover assertions.

- [ ] **Step 3: Implement the layout changes**

  - Let filter groups stack at mobile widths and keep search inputs `w-full min-w-0`.
  - Change request card action toolbars to wrap; preserve labels/tooltips and avoid shrinking icons below touch size.
  - Add `min-w-0` to card header/body flex children and allow long customer/model/code text to wrap.
  - Keep handover cards single-column on mobile and move warehouse below them with a clear full-width boundary.
  - Give `HandoverDocsModal` a mobile sheet/viewport-safe shell and an explicit internal table scroll area.

- [ ] **Step 4: Run focused test and typecheck**

  Run: `npm test -- test/mobile-ui-contract.test.ts` and `npm run lint`

  Expected: both commands pass.

---

### Task 4: Make ITD and EMC schedules usable on narrow screens

**Files:**
- Modify: `components/ATDScheduleView.tsx`
- Modify: `components/ScheduleView.tsx`
- Test: `test/mobile-ui-contract.test.ts`

**Interfaces:**
- Consumes: existing mobile detection, day selector, chamber rendering and drag/drop handlers.
- Produces: one-day mobile schedule flow with readable cards and no page-level horizontal overflow.

- [ ] **Step 1: Add failing schedule contracts**

  Assert that both schedule views keep the mobile day selector and use an explicit bounded schedule scroll region; assert that dense card controls include `min-w-0`/wrapping boundaries.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- test/mobile-ui-contract.test.ts`

  Expected: FAIL for at least one schedule boundary assertion.

- [ ] **Step 3: Implement the mobile layout changes**

  - Keep the existing selected-day filtering and drag/drop semantics.
  - Stack filter controls and make the sidebar full-width on mobile with an internal scroll region.
  - Keep EMC chambers stacked for the selected day; do not render two narrow columns side by side below the mobile breakpoint.
  - Add wrapping and `min-w-0` around request codes, model/brand labels, tester controls and time badges.
  - Preserve explicit horizontal scrolling only for content that cannot be represented as a stack.
  - Ensure fixed/absolute schedule controls do not cover the bottom navigation.

- [ ] **Step 4: Run focused test and typecheck**

  Run: `npm test -- test/mobile-ui-contract.test.ts` and `npm run lint`

  Expected: both commands pass.

---

### Task 5: Make summary, KQTN, report generator and management views responsive

**Files:**
- Modify: `components/SummaryLogView.tsx`
- Modify: `components/KQTNView.tsx`
- Modify: `components/ReportGeneratorView.tsx`
- Modify: `components/SystemManagementViews.tsx`
- Test: `test/mobile-ui-contract.test.ts`

**Interfaces:**
- Consumes: existing table, filter, form and report-preview behavior.
- Produces: explicit mobile representations for dense data and forms without changing record actions.

- [ ] **Step 1: Add failing dense-view contracts**

  Assert that Summary/KQTN table wrappers have bounded horizontal scrolling, report generator action controls can wrap/full-width on mobile, and management form boundaries use `min-w-0`/single-column behavior.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- test/mobile-ui-contract.test.ts`

  Expected: FAIL for the new dense-view assertions.

- [ ] **Step 3: Implement the layout changes**

  - Keep summary and KQTN headers/toolbars wrapping; make search/filter inputs full width where needed.
  - Bound dense tables to an internal scroll area with sticky context preserved; never let the page itself widen.
  - Keep row actions reachable and avoid relying on hover-only affordances at mobile widths.
  - Keep report standard cards readable on 4-column mobile grid; permit names to wrap and make expanded cards fit the viewport.
  - Stack report metadata/form/preview sections on mobile and make the action footer wrap into full-width buttons.
  - Convert management forms and list rows to single-column mobile layout while preserving existing field order and actions.

- [ ] **Step 4: Run focused test and typecheck**

  Run: `npm test -- test/mobile-ui-contract.test.ts` and `npm run lint`

  Expected: both commands pass.

---

### Task 6: Make shared dialogs and overlays viewport-safe

**Files:**
- Modify: `components/RequestModal.tsx`
- Modify: `components/HandoverModal.tsx`
- Modify: `components/PrintFormModal.tsx`
- Modify: `components/SettingsModal.tsx`
- Modify: `components/SyncDiagnosticModal.tsx`
- Modify: `components/CropperModal.tsx`
- Modify: `components/SelectSampleModal.tsx`
- Modify: `components/ConfirmDeleteHandoverModal.tsx`
- Modify: `components/AIChatBot.tsx`
- Test: `test/mobile-ui-contract.test.ts`

**Interfaces:**
- Consumes: existing dialog open/close handlers and form submission behavior.
- Produces: mobile bottom sheets or viewport-safe dialogs with independent content scrolling and reachable action footers.

- [ ] **Step 1: Add failing modal contracts**

  Assert that representative large dialogs use `max-h`/`dvh`-safe sizing, internal overflow, and mobile-safe width/padding classes; assert that AI chat width is capped by the viewport.

- [ ] **Step 2: Run the focused test and verify RED**

  Run: `npm test -- test/mobile-ui-contract.test.ts`

  Expected: FAIL for at least one dialog contract.

- [ ] **Step 3: Implement the minimal dialog layout changes**

  - Use `max-h-[calc(100dvh-...)]`-style constraints and `min-h-0` on flex content regions.
  - Keep mobile headers and action footers fixed within the dialog while the body scrolls.
  - Preserve the existing bottom-sheet treatment for the request modal and extend the same safe-height pattern only where needed.
  - Make print preview and tables scroll inside their own region instead of widening the overlay.
  - Keep cropper image controls usable at 320px and keep AI chat inside safe horizontal/vertical bounds above bottom navigation.

- [ ] **Step 4: Run focused test and typecheck**

  Run: `npm test -- test/mobile-ui-contract.test.ts` and `npm run lint`

  Expected: both commands pass.

---

### Task 7: Run full verification and visual mobile smoke checks

**Files:**
- Modify: `test/mobile-ui-contract.test.ts` only if a verified layout contract needs adjustment.

**Interfaces:**
- Consumes: all responsive changes from Tasks 1–6.
- Produces: evidence that mobile and desktop contracts hold together.

- [ ] **Step 1: Run the full automated suite**

  Run: `npm test`

  Expected: all existing tests plus `mobile-ui-contract.test.ts` pass with zero failures.

- [ ] **Step 2: Run production build**

  Run: `npm run build`

  Expected: Vite build exits 0 without TypeScript or CSS compilation errors.

- [ ] **Step 3: Run browser smoke checks at 320/375/390/430px**

  Start the app with `npm run dev`, inspect the shell, request, handover, both schedules, KQTN, report generator and one representative dialog at each target width. Confirm `document.documentElement.scrollWidth <= document.documentElement.clientWidth` except inside intentional data scroll regions, and confirm modal bodies remain scrollable.

- [ ] **Step 4: Run desktop smoke check**

  At a representative desktop width, confirm sidebar, desktop header, request cards, schedules and report generator retain their existing two-column/desktop arrangements.

- [ ] **Step 5: Report evidence and remaining gaps**

  Record exact commands and results. If a browser-only issue remains, identify the view and viewport rather than claiming completion.

<!-- --- End of 2026-08-17-mobile-ui-audit.md --- -->
