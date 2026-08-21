# Compact UI & Feature Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Áp dụng compact density nhất quán cho app shell và hoàn thiện các điểm còn thiếu trong Header mà không thay đổi nghiệp vụ.

**Architecture:** Gắn scope `ddt-compact` vào root sau đăng nhập và dùng CSS token selectors trong `index.css` để thu gọn spacing/font có kiểm soát. Các ngoại lệ report/print/mobile touch giữ scope riêng; App chỉ bổ sung nhãn Header cho activity log và accessibility contract cần thiết.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Node test runner, Vite, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-08-18-compact-ui-completion-design.md`

## Global Constraints

- `design.md` là Single Source of Truth; thay đổi UI phải cập nhật đặc tả trước code.
- Giữ `#root { zoom: 1; width: 100%; min-height: 100%; }`.
- Không thay đổi schema, API, dữ liệu, quyền nghiệp vụ hoặc format xuất báo cáo.
- Không giảm touch target mobile dưới khoảng 44px.
- `.report-form-compact`, preview/in và DOCX/PDF không chịu global compact override.
- TDD: mỗi production change phải có test fail trước, rồi mới triển khai tối thiểu.

---

### Task 1: Cập nhật contract test cho compact shell và Header

**Files:**
- Modify: `test/global-ui-scale.test.ts`
- Modify: `test/activity-log-ui.test.ts`

**Interfaces:**
- Tests consume the app shell source and global stylesheet.
- Tests produce red/green contracts for `ddt-compact`, compact tokens, and the activity log Header label.

- [x] **Step 1: Write the failing tests**

  Add assertions that `index.css` contains `.ddt-compact`, compact gap/font rules, and that `App.tsx` contains `className` with `ddt-compact` plus `activeTab === 'activity_log' && 'Nhật ký hệ thống'`.

- [x] **Step 2: Run the focused tests to verify they fail**

  Run: `$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npm test -- test/global-ui-scale.test.ts test/activity-log-ui.test.ts`

  Expected: FAIL because the new compact class/tokens and activity Header label are not present.

### Task 2: Implement the scoped compact density and shell completion

**Files:**
- Modify: `design.md`
- Modify: `index.css`
- Modify: `App.tsx`

**Interfaces:**
- `App` adds `ddt-compact` only to the authenticated shell root.
- `index.css` exposes the compact scope without changing API or data behavior.

- [x] **Step 1: Update `design.md`**

  Add the compact density contract, mobile touch exception, report/print exception, and Header activity label requirement under the UI standards section.

- [x] **Step 2: Add the minimal CSS implementation**

  Define scoped selectors for common `gap`, `space-y`, padding, standard text sizes, sidebar/header sizing, while leaving `.report-form-compact` and `.mobile-touch-target` protected.

- [x] **Step 3: Apply the compact scope and Header label**

  Add `ddt-compact` to the authenticated root wrapper and add the missing `activity_log` Header title branch.

- [x] **Step 4: Run the focused tests to verify they pass**

  Run: `$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npm test -- test/global-ui-scale.test.ts test/activity-log-ui.test.ts test/report-form-typography.test.ts`

  Expected: PASS with no failures.

### Task 3: Full regression and production verification

**Files:**
- Modify: `PROJECT_MEMORY.md`

**Interfaces:**
- Existing feature tests verify notifications, activity log, requests, schedules, KQTN, reports, backup and mobile contracts.
- Docker exposes the built shell at port `2359` and health/API endpoints.

- [x] **Step 1: Run all tests**

  Run: `$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'; npm test`

  Expected: 0 failures.

- [x] **Step 2: Run lint and production build**

  Run: `npm run lint` and `npm run build`

  Expected: both exit 0; a Vite chunk-size warning is acceptable if no build error occurs.

- [x] **Step 3: Rebuild Docker and smoke test**

  Run: `docker compose up -d --build`, then check `http://localhost:2359/api/health` and `http://localhost:2359/api/activity-logs`.

  Expected: webapp running on `2359`, PostgreSQL healthy, both endpoints HTTP 200.

- [x] **Step 4: Update project memory**

  Record compact scope, Header completion, test/build count and Docker smoke result in `PROJECT_MEMORY.md`.

<!-- --- End of 2026-08-18-compact-ui-completion.md --- -->
