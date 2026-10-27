# PGDCN Density Coverage Implementation Plan

> **For agentic workers:** Execute inline in this session. Keep each product fix atomic and test-first.

**Goal:** Close the documented browser-capture gaps and identify only evidence-backed P1/P2 density issues after commit `94e0d1b`.

**Architecture:** Add an opt-in Playwright Chromium audit runner that routes every API request to synthetic fixtures, blocks writes and external requests, captures screenshots plus DOM metrics, and checks role/menu/workflow projections. Keep application behavior unchanged unless the captured evidence proves a P1/P2 issue; any such fix gets its own regression test and AGY dispatch.

**Tech Stack:** Next.js 16.4.3 QA preview on loopback `127.0.0.1:2367`, Node.js test runner, Playwright Chromium, synthetic API fixtures, Markdown coverage report.

**Spec:** User task in this conversation; design contract `design.md` §§0.3, 5A.42–5A.43; findings/backlog `docs/ux-audit/2026-10-27-density-ux-backlog.md` and `docs/ux-audit/2026-10-27-density-after.md`.

## Global Constraints

- Preserve `94e0d1b` as baseline and keep all pre-existing dirty paths untouched.
- Use synthetic fixtures and intercepted APIs only; no production DB/auth, credentials, writes, Docker rebuild, deployment, or push.
- Do not reopen D01–D12 or F1–F5 without new reproducible evidence.
- Capture required role/state views at 390px and 1440px; use 320/430px when clipping or narrow-layout risk appears.
- Do not alter business validation, required fields, workflow state, routes, or RBAC for a presentation-only finding.
- AGY is the default coding engine; each product fix changes at most two source files and is committed selectively.

---

### Task 1: Browser evidence for missing roles, terminal states, and stress views

**Files:**
- Create: `test/pgdcn-density-coverage.playwright.test.mjs`
- Create evidence under: `docs/ux-audit/artifacts/density/coverage-2026-10-28/`

**Coverage:** Staff PCN register, PCN sample register, PCN drafting, and customers; Viewer PCN register and dossier detail; PCN `ISSUED` and `CANCELLED` dossier views; PGD `ARCHIVED` and `CANCELLED` dossier views according to `PgdInspectionStatus`; empty customer and PCN/PGD sample registers. Also capture long-data, empty, loading, and error states where the selected PGD register, sample ledger, drafting, AI assistant, and notification views expose those states. Record when a state cannot be produced through the documented mock contract.

- [x] Use the Playwright route-interception harness: answer synthetic session/API requests, abort every mutation and non-loopback request, and record browser errors.
- [x] Navigate role-sensitive views through shell menus; verify Viewer PCN-only access and detail read-only controls against `design.md`.
- [x] Save mobile/desktop screenshots and JSON DOM evidence for next actions, focus, overflow, truncation, sticky elements, labels, role, state, API traffic, and errors.
- [x] Run the browser capture against loopback preview and classify evidence; only D13 met the P1/P2 bar.

### Task 2: PGD intake modal field and interaction inventory

**Files:**
- Included in: `test/pgdcn-density-coverage.playwright.test.mjs`
- Evidence: `docs/ux-audit/artifacts/density/coverage-2026-10-28/pgd-intake-modal/`

- [x] Measure business fields separately from upload/search/filter controls and buttons.
- [x] Record required/optional/conditional fields, groups, modal/form height, CTA/footer bounds, scroll container, focus trap, and invalid-submit focus.
- [x] Capture 390px and 1440px; submit only the invalid synthetic form state and intercept any mutation.
- [x] No P1/P2 modal obstruction was found; keep all required fields and validation unchanged.

### Task 3: Evidence-backed atomic fixes

**Files:**
- One regression test plus at most one product source file per dispatch (maximum two changed source files).

- [x] Add and run a focused failing Playwright regression for D13 before the product change.
- [x] Dispatch the harness implementation to AGY using the required helper and temporary prompt; remove the prompt after the helper exits.
- [x] Inspect AGY's no-op result and follow the fallback contract without retrying a non-transient response.
- [x] Run focused and full browser coverage to green; capture D13 after evidence at 320, 375, 390, 430, 768, 1280, and 1440px, including keyboard retry and Admin/Staff states.
- [x] Keep validation, routes, data contracts, workflow transitions, and RBAC unchanged.

**D13 (confirmed during coverage):** PGD queue showed “Chưa có hồ sơ PGD trong hàng đợi” while `/api/pgd/bootstrap` was pending and after a synthetic 503. Severity P2: the empty message could be mistaken for a confirmed empty workload. The source fix is limited to `components/PgdcnAppShell.tsx`: show loading, show an error with keyboard-operable retry, and withhold the PGD workspace until bootstrap succeeds. Focused regression was RED before and GREEN after at 390px/1440px; the Admin/Staff seven-width check also passed. No route, permissions, workflow data, or API mutations changed.

**Coding-engine checkpoint:** The required AGY helper invocation already ran for the harness task but returned only a summary and requested another user confirmation, with no code/test changes. The git diff showed no AGY partial edits. Per the user’s C2C fallback contract, do not retry AGY for this non-transient no-op; Codex is implementing the evidence-backed fix under `Coding Engine: Codex (Fallback due to: AGY returned summary only without implementing harness)`.

### Task 4: Reports, verification, and selective commit

**Files:**
- Update: `docs/ux-audit/2026-10-27-density-ux-backlog.md`
- Create: `docs/ux-audit/2026-10-28-density-coverage.md`
- Update `design.md` only if a durable UI decision was implemented.

- [x] Replace all prior `NEEDS NEW CAPTURE` entries with screenshot and metrics evidence; state the Viewer mock's PCN-only scope.
- [x] Report screen/role/state counts, before/after measures, image paths, remaining P1/P2 findings, test results, and isolation boundaries; include the commit SHA in the task completion response.
- [x] Run focused/full Playwright coverage, `npm test`, `npm run typecheck`, `npm run build`, and `git diff --check` after the source change.
- [x] Stage and commit only task-owned source, tests, report, and evidence files on local `master`; leave all pre-existing dirty paths unchanged and do not push.
- [x] Stop the QA preview and verify final `git status`, selective commit contents, and commit SHA.

## Self-review

- All four capture gaps in the backlog map to explicit Task 1 scenarios; the form, role, terminal-state, empty/loading/error, privacy, and viewport requirements map to Tasks 1–3.
- D01–D12 and F1–F5 remain baseline invariants; no UI redesign is authorized without reproducible P1/P2 evidence.
- The only task-owned shared outputs are the Playwright audit harness and its generated artifact folder; the product fix is isolated to one source file.
