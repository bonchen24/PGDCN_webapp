# PGDCN Organizational RBAC Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the PGDCN identity, authorization, approval/signing and personnel UI with the hierarchy Trung tâm → Phòng while allowing management and professional roles to coexist.

**Architecture:** Keep `systemRole` as the technical account layer. Add a canonical management role for Center/Department hierarchy and an array of professional roles; preserve `departmentRoleCode` and `pgdRole` as compatibility adapters for existing records. Centralize leadership/role checks so PCN and PGD use the same organization policy, while domain scope and technical capability remain explicit.

**Tech Stack:** TypeScript, Express, React, Zustand, PostgreSQL JSONB, Node test runner, tsx.

**Spec:** `design.md` (PGDCN active profile, sections 0.0, 0.3, 7.1 and 7.3)

## Global Constraints

- Trung tâm TVCI is above the phòng; `CENTER_DIRECTOR` and `CENTER_DEPUTY_DIRECTOR` are organizational roles, not `systemRole=admin`.
- `DEPARTMENT_HEAD` and `DEPARTMENT_DEPUTY` cover both `PGD` and `PCN`.
- Management and professional roles are composable; a leader may also be an inspection and/or certification expert when explicitly assigned.
- Market development remains inactive: no route, collection, or menu is added.
- Legacy role fields remain readable during migration and must not be used to infer new authority from free-text `position`.
- Server policy is authoritative; UI and Zustand mirror it but never replace it.
- Existing unrelated dirty-worktree changes must be preserved.

---

### Task 1: Add canonical organization and professional-role contracts

**Files:**
- Modify: `types.ts`
- Modify: `utils/pcnUserApi.ts`
- Modify: `utils/pcnAuth.ts`
- Modify: `utils/pcnUserRoster.ts`
- Test: `test/pcn-organizational-rbac.test.ts`

**Interfaces:**
- Produces `OrganizationManagementRoleCode`, `ProfessionalRoleCode`, normalized `managementRoleCode`, and normalized `professionalRoleCodes[]` on `PcnUserAccount`.
- Produces helpers that map legacy `departmentRoleCode`/position data to compatibility values without granting authority from arbitrary free text.

- [ ] Step 1: Write tests for center director/deputy, department head/deputy, multi-professional roles and legacy snapshots.
- [ ] Step 2: Run `node --test test/pcn-organizational-rbac.test.ts` and verify the new assertions fail for missing fields/helpers.
- [ ] Step 3: Add the canonical types, labels, normalizers and account fields; keep legacy aliases in serialized snapshots.
- [ ] Step 4: Update roster mapping and preset seed metadata without assigning an unconfirmed real person as Center Director.
- [ ] Step 5: Run the focused test and `npm run typecheck`.

### Task 2: Centralize hierarchy-aware RBAC and approval/signing policy

**Files:**
- Modify: `utils/pcnRbac.ts`
- Modify: `utils/pgdDomain.ts`
- Modify: `utils/systemSettingsPolicy.ts`
- Modify: `utils/pcnApproval.ts`
- Modify: `utils/pcnSignerAuthorization.ts`
- Modify: `utils/pcnDossierAssignment.ts`
- Modify: `utils/pgdcnNotification.ts` or the existing notification policy file when required by the focused tests
- Test: `test/pcn-organizational-rbac.test.ts`
- Test: `test/pcn-approval-issuance.test.ts`
- Test: `test/pcn-signer-authorization.test.ts`

**Interfaces:**
- Produces shared `isOrganizationLeader`, `isCenterLeader`, `isDepartmentLeader`, `hasProfessionalRole` and normalized scope helpers.
- `isPcnSystemManager`, `isPgdSystemManager`, settings access, approvals and direct signer eligibility recognize Center/Department leadership.
- Direct/delegated signer authorization does not allow an arbitrary mutation actor to impersonate a selected signer.

- [ ] Step 1: Add failing tests proving both Center leaders and both Department leaders can act on PCN and PGD when scope is present.
- [ ] Step 2: Add failing tests proving a leader with professional roles can still be recognized as leadership and a non-leader cannot gain authority through `position` text.
- [ ] Step 3: Add a failing issuance boundary assertion that the authenticated actor must equal the direct signer, or be the authorized delegate for delegated signing.
- [ ] Step 4: Run the focused tests and confirm expected failures.
- [ ] Step 5: Implement centralized helpers and replace direct `departmentRoleCode === 'LEADERSHIP'` checks in the touched policies.
- [ ] Step 6: Implement the issuance actor/signer check at the server boundary while preserving the existing signer field-scope and delegation validation.
- [ ] Step 7: Run focused approval/signer/RBAC tests and typecheck.

### Task 3: Persist and expose canonical roles through the server API

**Files:**
- Modify: `server.ts`
- Modify: `utils/pcnUserApi.ts`
- Modify: `sql/pcn-schema.sql`
- Test: `test/pcn-user-role.test.ts`
- Test: `test/pcn-user-roster.test.ts`
- Test: `test/pcn-organizational-rbac.test.ts`

**Interfaces:**
- `GET /api/pcn/users` returns normalized `managementRoleCode` and `professionalRoleCodes[]` without password.
- `POST/PUT /api/pcn/users` validates canonical roles, requires both scopes for Department leaders, and persists legacy aliases for compatibility.
- Personnel management recognizes Center and Department leaders while preserving Admin-only system configuration boundaries.

- [ ] Step 1: Write failing API/source-contract tests for validation, serialization and dual-scope enforcement.
- [ ] Step 2: Run those tests to verify they fail.
- [ ] Step 3: Extend `validatePcnUserInput` and `sanitizePcnUserRow` with canonical role normalization and validation.
- [ ] Step 4: Replace server-side leadership comparisons used by personnel, PCN approval and PGD boundaries with the centralized policy.
- [ ] Step 5: Update initial SQL seed payloads only for canonical fields that are already known; keep historical values intact.
- [ ] Step 6: Run focused user/API tests and typecheck.

### Task 4: Update personnel management and identity surfaces

**Files:**
- Modify: `components/PcnUserManagementView.tsx`
- Modify: `components/PgdcnSidebar.tsx`
- Modify: `components/PgdcnAppShell.tsx`
- Modify: `components/PcnPersonalSettingsPanel.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Modify: `components/PcnSignerDelegationPanel.tsx`
- Test: `test/pcn-ui-contract.test.ts`
- Test: `test/pcn-pgd-ui-contract.test.ts`

**Interfaces:**
- Personnel form has separate controls for management position and multi-select professional roles.
- User rows and sidebar identity show the organizational title and professional roles, not only the technical system role.
- The UI does not add a Market Development workspace and keeps PCN/PGD scope controls explicit.

- [ ] Step 1: Add failing UI contract tests for Center/Department title options, multi-role selection, dual-scope helper text and displayed identity labels.
- [ ] Step 2: Run the focused UI tests and verify failure.
- [ ] Step 3: Implement controlled form state and payload fields for canonical roles while retaining legacy role values in API payloads.
- [ ] Step 4: Update leader-only UI gates to use centralized policy helpers and show combined role labels.
- [ ] Step 5: Run focused UI tests and typecheck.

### Task 5: Regression verification and handoff

**Files:**
- Modify: `design.md` only if implementation reveals a contract discrepancy
- Test: all active PCN tests through `npm run test:pcn`

- [ ] Step 1: Run `git diff --check` and inspect the diff for accidental edits to the pre-existing dirty files.
- [ ] Step 2: Run `npm run typecheck`.
- [ ] Step 3: Run `npm run test:pcn` and record the exact pass/fail count.
- [ ] Step 4: Review changed files against every Global Constraint and report any intentionally deferred audit findings, especially password hashing and session revalidation.
