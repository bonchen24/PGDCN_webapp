# PCN/PGD pending document confirmation projection

## Goal

Show persisted generated DOCX/PDF outputs as awaiting confirmation in the relevant dossier checklist while keeping dossier completion based only on documents actually attached to the dossier. Preserve the current PCN and PGD domain boundaries, workflow lifecycle, server authorization, and return navigation.

## Atomic tasks

1. **PGD projection and navigation**
   - Derive pending status from persisted PGD generated documents for the same request and requirement, excluding documents already represented by an attached dossier document.
   - Render the pending label and a contextual action in the current step checklist. Read-only roles keep the existing permission boundary.
   - Add focused tests for required, optional, attached, pending, and viewer cases.

2. **PCN projection and navigation**
   - Fetch PCN draft workspaces scoped to the open dossier; identify generated outputs only through the existing one-to-one form-kind to requirement mapping.
   - Mark a missing checklist row as awaiting confirmation when a matching saved output exists; keep it unresolved for workflow gates.
   - Let the contextual action reopen that saved draft while preserving dossier, requirement, node, and return route.
   - Add focused projection, route, and UI tests.

3. **Integration review**
   - Review the diff for domain separation, RBAC, lifecycle, preview, return navigation, mobile targets, and keyboard semantics.
   - Run focused tests, typecheck, requested PCN/all suites, synthetic browser smoke, and production build. Record environment-only blockers without broadening into Archify work.

## Constraints

- No migration, database write, production deployment, lifecycle or RBAC changes, KPI gate, or Archify workflow UI.
- Do not mark pending outputs as attached or completed; the existing attach confirmation remains the sole completion event.
- Keep the root dirty checkout untouched and commit only task files from the clean integration worktree.
