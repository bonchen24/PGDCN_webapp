# PCN & PGD Dossier Deck & Card Workspace Refactor Plan

> **Goal:** Refactor PCN and PGD dossier management queues into miniature workspace cards following the DDT (`RequestGroupCard` / Kiểm PYC) interaction model: scan collapsed card -> expand in place -> quick actions -> open canonical detail only when necessary.

---

## 1. Architectural Strategy

We will build unified, reusable primitives under `components/PgdcnDossierDeck.tsx`:
- `PgdcnDossierCard`: Base card wrapper with in-place expand/collapse click handler (protecting nested interactive buttons).
- `PgdcnDossierCardHeader`: Compact layout with codes, status badge, field/product chips, customer, product, owner, step, deadline, and progress bar with label.
- `PgdcnDossierQuickActions`: Compact top-right toolbar with RBAC-guarded actions: Edit, Assign, Open docs, Print/Export, Copy code, Open detail, Expand/Collapse.
- `PgdcnDossierCardExpanded`: Miniature workspace drawer with 3 sections:
  - **A. Next Action**: Primary task title, reason, assignee, primary CTA button.
  - **B. Blockers**: Missing docs, unassigned owner, missing test results, blocked steps.
  - **C. Dossier Components Breakdown**: Milestone-by-milestone status indicators (PCN: Proposal, Docs, Field audit, Samples, Lab PYC, Results, Approval, Issuance; PGD: Intake, Plan, Field & Samples, Lab handover, Evidence, Results, Report & Certificate, Archive).
- `PgdcnDossierDeck`: Toolbar with search, status counters / filter chips with counts, compact KPI pills, sort, mobile filter collapsible panel, responsive 2-column desktop / 1-column mobile grid, and empty state.

---

## 2. File Modification & Creation Scope

1. **`components/PgdcnDossierDeck.tsx`** *(NEW)*:
   - Contains `PgdcnDossierDeck`, `PgdcnDossierCard`, `PgdcnDossierCardHeader`, `PgdcnDossierQuickActions`, `PgdcnDossierCardExpanded`.
   - Domain-agnostic contracts for PCN and PGD item models.
2. **`components/PcnDossierQueueView.tsx`** *(REFACTOR)*:
   - Uses `PgdcnDossierDeck` and unified card primitives.
   - Replaces heavy 4-card KPI blocks with compact counters.
   - Computes Next Action, Blockers, and Component Breakdown for each PCN dossier.
   - Retains table view switcher and semantic table for fallback.
3. **`components/PgdDossierQueueView.tsx`** *(REFACTOR)*:
   - Uses `PgdcnDossierDeck` and unified card primitives.
   - Replaces heavy 4-card KPI blocks with compact counters.
   - Computes Next Action, Blockers, and Component Breakdown for each PGD dossier.
   - Retains table view switcher and semantic table for fallback.
4. **`components/PcnDossierGroupCard.tsx`** *(REFACTOR)*:
   - Adapts to use `PgdcnDossierCard` primitives for backward-compatibility in `PcnWorkspace.tsx`.
5. **`test/pgdcn-dossier-deck-ui.test.ts`** *(NEW)*:
   - Verifies unified shared components, collapsed scanning, in-place expand/collapse without routing, quick action RBAC, next action & blockers projection, responsive contract.
6. **Existing Regression Tests**:
   - `test/pgdcn-pgd-aligned-dossier-ui.test.ts`
   - `test/pcn-dossier-table-ui.test.ts`
   - `test/pcn-business-workspace.test.ts`
   - `test/pgd-business-workspace.test.ts`

---

## 3. Step-by-Step Execution Plan

- [ ] **Task 1: Create Shared Component `components/PgdcnDossierDeck.tsx`**
  - Implement domain-agnostic interfaces for dossier items, quick actions, next action, blockers, and component stages.
  - Implement `PgdcnDossierCard`, `PgdcnDossierCardHeader`, `PgdcnDossierQuickActions`, `PgdcnDossierCardExpanded`, and `PgdcnDossierDeck`.
  - Add unit/component tests in `test/pgdcn-dossier-deck-ui.test.ts`.

- [ ] **Task 2: Refactor `components/PcnDossierQueueView.tsx`**
  - Connect `PcnOperationsRegisterRow` to `PgdcnDossierDeck`.
  - Integrate PCN Next Action and Blockers projections from `utils/pcnBusinessWorkspace.ts`.
  - Implement PCN 8-stage component breakdown.
  - Compact KPI counters into toolbar pills.
  - Preserve table mode for backward compatibility.

- [ ] **Task 3: Refactor `components/PgdDossierQueueView.tsx`**
  - Connect `PgdDossierQueueRow` to `PgdcnDossierDeck`.
  - Integrate PGD Next Action and Blockers projections from `utils/pgdBusinessWorkspace.ts`.
  - Implement PGD 8-stage component breakdown.
  - Compact KPI counters into toolbar pills.
  - Preserve table mode for backward compatibility.

- [ ] **Task 4: Harmonize `components/PcnDossierGroupCard.tsx`**
  - Ensure `PcnWorkspace.tsx` uses the updated card layout and quick actions without regression.

- [ ] **Task 5: Verification & Testing**
  - Run full test suite: `npm test`.
  - Run typecheck: `npm run typecheck` or `npm run lint`.
  - Verify mobile/desktop CSS classes (375px, 768px, 1280px).
  - Verify git diff and ensure zero temporary files.
