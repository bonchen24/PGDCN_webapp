# PCN Dossier Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tạo hồ sơ PCN từ Đề nghị ở trạng thái chưa gán, hỗ trợ Admin/Quản lý phân công và staff tự nhận, đồng thời chặn staff thao tác hồ sơ không gắn tên mình.

**Architecture:** Tái sử dụng `CertificationDossier.ownerUsername` làm owner duy nhất, bổ sung policy helper dùng chung cho target assignment và operator access, không tạo collection/trạng thái assignment mới. Server là lớp quyết định cuối cùng; UI dùng cùng projection/policy để hiển thị danh sách nhân viên phù hợp, nút nhận và read-only state.

**Tech Stack:** TypeScript, React 18, Zustand, Express, PostgreSQL JSONB, Node test runner qua `npm test`.

**Spec:** `docs/superpowers/specs/2026-09-06-pcn-dossier-assignment-design.md`

## Global Constraints

- `design.md` là nguồn chuẩn duy nhất; PYC mới chỉ liên kết vào dossier đã tạo từ Đề nghị.
- Hồ sơ mới giữ `status = INTAKE_REVIEW` và `ownerUsername` trống; không thay đổi owner lịch sử đã lưu.
- Target assignment phải là user PCN active, không viewer, có scope `PCN` và giao với toàn bộ `dossier.fieldCodes`.
- Admin hoặc Quản lý (`isPcnSystemManager`) được assign/reassign và xử lý; staff chỉ self-claim dossier trống và chỉ xử lý dossier đã gắn username của mình.
- Mọi guard phải tồn tại ở UI và server; không dựa vào `disabled` hoặc ẩn nút để bảo mật.
- Mọi mutation thành công giữ audit/idempotency hiện hành; không dùng generic `/api/db` cho dossier mutation.

### Task 1: Shared assignment and operator policy

**Files:**
- Modify: `utils/pcnDossierAssignment.ts`
- Modify: `utils/pcnDossierStepAccess.ts`
- Test: `test/pcn-dossier-assignment.test.ts`

**Interfaces:**
- Produce `getPcnAssignableDossierUsers(dossierFieldCodes, users)` returning stable, active, non-viewer PCN users with field overlap.
- Produce `getPcnDossierOperatorDenial({ ownerUsername, actorUsername, actorIsSystemManager })` returning `null` or a Vietnamese denial string.
- Preserve `getPcnOwnerAssignmentAuthorityDenial` as the assignment mutation authority check and make its target validation use PCN scope.

- [ ] **Step 1: Write the failing unit tests**

Add tests asserting the policy before implementation:

```ts
test('filters assignment choices to active PCN users with dossier field overlap', () => {
  const users = [
    { username: 'qc4', active: true, systemRole: 'staff', departmentScopes: ['PCN'], fieldCodes: ['QC4'] },
    { username: 'qc9', active: true, systemRole: 'staff', departmentScopes: ['PCN'], fieldCodes: ['QC9'] },
    { username: 'pgd', active: true, systemRole: 'staff', departmentScopes: ['PGD'], fieldCodes: ['QC4'] },
    { username: 'viewer', active: true, systemRole: 'viewer', departmentScopes: ['PCN'], fieldCodes: ['QC4'] },
  ];
  assert.deepEqual(getPcnAssignableDossierUsers(['QC4'], users).map((user) => user.username), ['qc4']);
});

test('denies staff operation on an unassigned dossier', () => {
  assert.match(getPcnDossierOperatorDenial({ ownerUsername: '', actorUsername: 'staff', actorIsSystemManager: false }) || '', /chưa gán/i);
});

test('allows the assigned staff owner and managers to operate', () => {
  assert.equal(getPcnDossierOperatorDenial({ ownerUsername: 'staff', actorUsername: 'staff', actorIsSystemManager: false }), null);
  assert.equal(getPcnDossierOperatorDenial({ ownerUsername: 'staff', actorUsername: 'manager', actorIsSystemManager: true }), null);
});
```

- [ ] **Step 2: Run the focused test and verify the expected failure**

Run: `node --test test/pcn-dossier-assignment.test.ts`

Expected: FAIL because the new policy exports do not exist yet, not because of a test typo.

- [ ] **Step 3: Implement the minimal shared policy**

Normalize usernames, scopes and field codes once. Require every dossier field code to be present in the candidate user; treat an empty dossier field list as no field restriction for legacy compatibility. Return users sorted by display name/username without exposing passwords.

Use this operator rule:

```ts
if (actorIsSystemManager) return null;
if (!ownerUsername) return 'Hồ sơ chưa gán người thực hiện; hãy bấm Nhận hồ sơ để tự nhận.';
if (ownerUsername !== actorUsername) return 'Bạn chỉ được thao tác hồ sơ đã gắn tên mình.';
return null;
```

Change `getPcnDossierStepAccess` so a non-manager with no owner is not editable and receives the same claim guidance. Managers retain the existing step access bypass.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `node --test test/pcn-dossier-assignment.test.ts`

Expected: PASS for all assignment filtering, self-owner and manager/operator-access cases.

- [ ] **Step 5: Commit policy changes when repository permissions allow**

Run: `git diff --check`; then commit only the task files with `git commit --only ...`. If `.git/index.lock` remains blocked, leave files uncommitted and report the environment limitation.

### Task 2: Intake and dossier metadata mutation

**Files:**
- Modify: `server.ts:7950-8790`
- Modify: `utils/pcnDossierApi.ts` only if the client contract needs a dedicated assignment method
- Test: `test/pcn-dossier-intake-assignment.test.ts`

**Interfaces:**
- Intake persists `ownerUsername` as absent/empty for a newly created dossier.
- Existing `POST /api/pcn/dossiers/:dossierId` remains the idempotent assignment boundary: manager assign/reassign; staff self-claim only when owner is empty.

- [ ] **Step 1: Write failing intake and authority tests**

Add source/contract tests that inspect the intake write payload and exercise `getPcnOwnerAssignmentAuthorityDenial` for manager assignment, staff self-claim, staff reassignment and target field/scope validation.

```ts
test('intake does not assign the session actor as dossier owner', () => {
  const server = readServer();
  assert.doesNotMatch(server, /ownerUsername:\s*String\(getPcnSessionUser\(req\)\?\.username/);
  assert.match(server, /status:\s*'INTAKE_REVIEW'/);
});

test('staff can only claim an empty dossier for their own username', () => {
  assert.equal(getPcnOwnerAssignmentAuthorityDenial({ currentUsername: '', nextUsername: 'staff', actorUsername: 'staff', actorSystemRole: 'staff' }), null);
  assert.match(getPcnOwnerAssignmentAuthorityDenial({ currentUsername: 'other', nextUsername: 'staff', actorUsername: 'staff', actorSystemRole: 'staff' }) || '', /chuyển chủ hồ sơ/i);
});
```

- [ ] **Step 2: Run the focused tests and verify they fail for the current actor-owner behavior**

Run: `node --test test/pcn-dossier-intake-assignment.test.ts`

Expected: FAIL on the current intake source and any missing scope-aware target behavior.

- [ ] **Step 3: Remove automatic owner assignment and harden the dossier endpoint**

In `/api/pcn/intake`, omit `ownerUsername` from `storedDossier`. In the dossier update transaction:

1. Keep assignment-only updates eligible for the owner authority policy.
2. Validate target users with `getPcnAssignableDossierUsers`/`getPcnDossierAssignmentDenial` using `departmentScopes` and all dossier fields.
3. Reject staff updates that combine self-claim with other owner-controlled fields in one request.
4. Use `getPcnDossierOperatorDenial` for all non-assignment writes so an empty owner is not an open write lane.
5. Preserve existing activity log labels, idempotency fingerprint, and manager behavior.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `node --test test/pcn-dossier-assignment.test.ts test/pcn-dossier-intake-assignment.test.ts` and `npm run typecheck`.

Expected: all focused tests pass and TypeScript reports exit code 0.

### Task 3: Apply owner-or-manager guards to downstream dossier mutations

**Files:**
- Modify: `server.ts` at the existing dossier owner checks around lines `7007`, `9001`, `9397`, `9762`, `9993`, `10243`, `10512`, `12359`, `12600`, and `14341`.
- Test: `test/pcn-dossier-operation-guards.test.ts`

**Interfaces:**
- Every dossier mutation path calls one shared server helper that returns HTTP 403 for a non-manager staff actor when owner is empty or belongs to another user.
- Admin/Quản lý bypasses the owner check but remains subject to status, field, linkage and workflow gates.

- [ ] **Step 1: Write failing guard coverage**

Add a source contract test counting the shared guard use and checking that the old conditional pattern no longer allows empty-owner writes:

```ts
test('downstream dossier mutations use the shared operator guard', () => {
  const server = readServer();
  assert.ok((server.match(/assertPcnDossierOperator\(/g) || []).length >= 9);
  assert.doesNotMatch(server, /if \(dossier\.ownerUsername && dossier\.ownerUsername\.trim\(\)\.toLowerCase\(\) !== actor\.username/);
});
```

- [ ] **Step 2: Run the guard test and verify it fails**

Run: `node --test test/pcn-dossier-operation-guards.test.ts`

Expected: FAIL because the server still uses repeated owner-present-only checks.

- [ ] **Step 3: Add and apply the server helper**

Define a server-local wrapper around the shared policy:

```ts
function assertPcnDossierOperator(dossier: Pick<CertificationDossier, 'ownerUsername'>, actor: PcnUserAccount): void {
  const denial = getPcnDossierOperatorDenial({
    ownerUsername: dossier.ownerUsername,
    actorUsername: actor.username,
    actorIsSystemManager: isPcnSystemManager(actor),
  });
  if (denial) throw Object.assign(new Error(denial), { statusCode: 403 });
}
```

Replace each repeated owner-present-only block in document upload/confirmation, sample/lab request, results, generated-file and related dossier mutation boundaries. Keep specialized error messages only where an endpoint’s existing client contract requires them; otherwise use the shared Vietnamese denial.

- [ ] **Step 4: Run guard tests and the existing related tests**

Run: `node --test test/pcn-dossier-operation-guards.test.ts test/pcn-pipeline.test.ts test/pcn-work-queue.test.ts`; expected PASS with zero failures.

### Task 4: Card and detail assignment UI

**Files:**
- Create: `components/PcnDossierAssignmentControl.tsx`
- Modify: `components/PcnPipelineBoard.tsx`
- Modify: `components/PcnWorkQueueView.tsx`
- Modify: `components/PcnDossierDetailView.tsx`
- Modify: `components/PcnWorkspace.tsx`
- Test: `test/pcn-dossier-assignment-ui.test.ts`

**Interfaces:**
- `PcnDossierAssignmentControl` accepts `dossier`, `users`, `currentUser`, `onAssign`, and renders the owner badge plus manager combobox or staff claim button.
- `onAssign(dossierId, ownerUsername)` calls the existing dossier update API with only `ownerUsername` and lets the store refresh the snapshot.

- [ ] **Step 1: Write failing UI contract tests**

Assert the card/detail source exposes the required labels and callback wiring:

```ts
test('assignment UI exposes unassigned state, manager choices and staff claim action', () => {
  assert.match(read('components/PcnDossierAssignmentControl.tsx'), /Chưa gán người thực hiện/);
  assert.match(read('components/PcnDossierAssignmentControl.tsx'), /Nhận hồ sơ/);
  assert.match(read('components/PcnPipelineBoard.tsx'), /PcnDossierAssignmentControl/);
  assert.match(read('components/PcnDossierDetailView.tsx'), /PcnDossierAssignmentControl/);
  assert.match(read('components/PcnWorkspace.tsx'), /onAssignDossier/);
});
```

- [ ] **Step 2: Run UI contract tests and verify they fail**

Run: `node --test test/pcn-dossier-assignment-ui.test.ts`

Expected: FAIL because the reusable control and manager assignment callback do not exist.

- [ ] **Step 3: Implement the reusable control**

Use `PcnCatalogCombobox` for manager selection. Filter choices through `getPcnAssignableDossierUsers`. For staff, render `Nhận hồ sơ` only when owner is empty and policy permits. For non-owner staff, render the owner label and a read-only state. Show names from `getPcnUserDisplayName`; usernames remain values/search keys only.

- [ ] **Step 4: Wire card, queue, detail and workspace**

Add `onAssignDossier` to `PcnPipelineBoard` and `PcnWorkQueueView`, call it from `PcnWorkspace` with `pcn.updateDossier(dossierId, { ownerUsername })`, and retain the existing claim callback as the same owner-only update. Replace the detail owner panel’s broad user list with the filtered control and add `Nhận hồ sơ` there. Keep manager reassignment visible, and preserve existing read-only behavior for viewers.

- [ ] **Step 5: Lock step controls for unassigned/non-owner staff**

Use the updated `getPcnDossierStepAccess` in the detail view so the workflow, document upload, sample/PYC, KQTN and operational forms are visually read-only until a staff user claims the dossier. Admin/Quản lý continue to see the manager controls.

- [ ] **Step 6: Run UI tests and typecheck**

Run: `node --test test/pcn-dossier-assignment-ui.test.ts test/pcn-pipeline.test.ts test/pcn-work-queue.test.ts` and `npm run typecheck`.

Expected: PASS with no TypeScript errors.

### Task 5: Registration projection and regression coverage

**Files:**
- Modify: `components/PcnOperationsRegisterView.tsx` if row edit affordances need owner-aware gating.
- Modify: `components/PgdcnDossierSummaryGrid.tsx` if a per-row `canEdit` predicate is required.
- Modify: `utils/pcnOperationsRegister.ts` only if display projection needs a neutral unassigned label.
- Test: `test/pcn-dossier-assignment-register.test.ts`

- [ ] **Step 1: Write the failing projection test**

Assert the register exposes the unassigned owner label and does not offer staff a mutation path for rows they cannot operate.

- [ ] **Step 2: Run it and verify it fails**

Run: `node --test test/pcn-dossier-assignment-register.test.ts`

Expected: FAIL on the current global `canEdit` behavior for register cells.

- [ ] **Step 3: Add row-aware editability**

Keep read-only derived cells unchanged. Permit metadata cell edits only for managers or the dossier owner; render `Chưa gán người thực hiện` for an empty owner and keep owner assignment routed through the dedicated control/boundary.

- [ ] **Step 4: Run focused register and existing summary tests**

Run: `node --test test/pcn-dossier-assignment-register.test.ts test/summary-register-grid.test.ts`; expected PASS.

### Task 6: Full verification and handoff

**Files:**
- Modify: none unless verification finds a regression.

- [ ] **Step 1: Run the complete PCN test suite**

Run: `npm test`.

Expected: exit code 0 and zero failed tests.

- [ ] **Step 2: Run typecheck and build**

Run: `npm run typecheck` and `npm run build`.

Expected: both commands exit code 0.

- [ ] **Step 3: Inspect the final diff**

Run: `git diff --check` and `git status --short`; verify only intended assignment files plus the approved `design.md`/spec/plan changes are attributable to this task, and do not stage or revert pre-existing user changes.

- [ ] **Step 4: Final report**

Report the changed files, test/typecheck/build evidence, and any inability to commit caused by the existing `.git/index.lock` permission error.
