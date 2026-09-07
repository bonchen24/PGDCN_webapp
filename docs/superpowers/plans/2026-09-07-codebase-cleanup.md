# PCN Codebase Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean the current PCN/PGD working tree, retain the intended source and documentation outputs, verify the repository, and fast-forward `master` to the resulting commit.

**Architecture:** Keep the existing feature history intact. Remove only generated guide-render QA directories identified in the approved scope, ignore future copies of those outputs, then commit the current source, tests, guide assets, DOCX, and design changes together before fast-forwarding `master`.

**Tech Stack:** Git, Next.js, TypeScript, Node.js test runner, DOCX/PDF guide assets.

**Spec:** `design.md` (sections 0A, 4.6, 8, and 9)

## Global Constraints

- `design.md` remains the single source of truth for architecture, data, UI/UX, and source conventions.
- Keep the PGD drafting workspace aligned with the compact PCN workspace anatomy documented in `design.md`.
- Do not alter schema, lifecycle, persistence, or RBAC behavior as part of cleanup.
- Do not commit generated guide-render QA directories; keep the DOCX and reusable screenshot assets.
- Do not rewrite or discard the existing 42 commits on the feature branch.

---

### Task 1: Establish a clean-up baseline

**Files:**
- Read only: `package.json`, `design.md`, current Git status and history.

- [ ] **Step 1: Record current branch and divergence**

Run:

```powershell
git status --short --branch
git rev-list --left-right --count master...HEAD
```

Expected: current feature branch is 42 commits ahead of `master`; existing worktree changes are preserved.

- [ ] **Step 2: Run baseline checks**

Run:

```powershell
npm run typecheck
npm test
```

Expected: record any failures before cleanup; do not attribute pre-existing failures to artefact cleanup.

### Task 2: Remove generated guide-render noise

**Files:**
- Delete: `docs/user-guide-render/`
- Delete: `docs/user-guide-render-final/`
- Delete: `docs/user-guide-render-final2/`
- Delete: `docs/user-guide-render-final3/`
- Modify: `.gitignore`

- [ ] **Step 1: Verify exact cleanup targets**

Run:

```powershell
Get-ChildItem -LiteralPath docs/user-guide-render,docs/user-guide-render-final,docs/user-guide-render-final2,docs/user-guide-render-final3 -Force
```

Expected: only generated PDF/PNG render outputs are listed.

- [ ] **Step 2: Remove the verified targets**

Run:

```powershell
Remove-Item -LiteralPath docs/user-guide-render,docs/user-guide-render-final,docs/user-guide-render-final2,docs/user-guide-render-final3 -Recurse -Force
```

Expected: the four verified QA directories are removed; `docs/user-guide-assets/` and the DOCX remain.

- [ ] **Step 3: Ignore future render outputs**

Add this rule to `.gitignore`:

```gitignore
docs/user-guide-render*/
```

Expected: future guide render directories do not reappear in Git status.

### Task 3: Verify source and documentation changes

**Files:**
- Verify: current modified components, tests, `design.md`, DOCX, screenshots, and guide script.

- [ ] **Step 1: Check whitespace and intended file set**

Run:

```powershell
git diff --check
git status --short -uall
```

Expected: no whitespace errors and no removed source/test files.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm run typecheck
npm test
npm run build
```

Expected: all commands exit with code 0.

### Task 4: Commit and apply to `master`

**Files:**
- Commit: all approved source, tests, design, guide outputs, script, and `.gitignore` changes.

- [ ] **Step 1: Commit the verified working tree**

Run:

```powershell
git add -A
git commit -m "chore: clean up PCN codebase outputs"
```

Expected: one new commit contains all approved changes and the feature branch is clean.

- [ ] **Step 2: Fast-forward `master`**

Run:

```powershell
git switch master
git merge --ff-only codex/pcn-dynamic-dossier-workflow
```

Expected: `master` points at the new verified commit without a merge commit or history rewrite.

- [ ] **Step 3: Verify final state**

Run:

```powershell
git status --short --branch
git log -1 --oneline --decorate
git rev-parse master
git rev-parse codex/pcn-dynamic-dossier-workflow
```

Expected: `master` and the feature branch resolve to the same clean commit.
