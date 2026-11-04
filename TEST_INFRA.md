# TEST INFRASTRUCTURE & ARCHITECTURE SPECIFICATION
## PGDCN V2 Rebuild — Superneat Enterprise Workspace Frontend & 7-Stage Unified Workflow

---

## 1. Test Philosophy

### 1.1 Opaque-Box & Requirement-Driven
The testing strategy for the PGDCN V2 Rebuild treats the system under test through an **opaque-box, contract-driven lens**. Rather than verifying internal implementation details or brittle ephemeral state, tests validate:
1. **User-Facing Contracts & Visual Affordances**: Sidebar navigation structure, breadcrumbs, Command Palette trigger (`Ctrl+K`), drawer slide-overs, 4-stat KPI metrics strip, and actionable My Work inbox lists.
2. **Deterministic Domain Rules**: Strict separation between Certification (`PCN`) and Inspection (`PGD`), 7-stage linear rail progression, stage gate rules requiring document approval/attachment/waiver, template snapshot isolation preventing retroactive mutation of in-flight dossiers.
3. **Enterprise Density & Layout Invariants**: Superneat layout constraints (TanStack Table high density, 65/35 desktop workspace split, single-column collapsible mobile layout, elimination of legacy node graphs and Archify iframe embeddings).

### 1.2 Progressive Testability
Tests are organized to respect milestone dependencies while maintaining continuous executability:
- Features in active development are verified through their contract surfaces, structural invariants, and baseline data topology.
- As implementation progresses from M1 to M5, the test suite asserts increasingly detailed end-to-end interactions without regressing earlier milestone capabilities.

### 1.3 Adversarial Verification
To prevent superficial "happy path only" validation, test cases incorporate:
- **Encoding & Escaping Integrity**: Special characters, Vietnamese diacritics, long customer names, and formatted identifiers (e.g., `HS-2026-QC4-001/ĐN`, `PYC-2026/GĐ-THÉP#001`).
- **Boundary Conditions**: Empty queues, missing documents, zero completed steps, 100% completed items, expired deadlines, and unassigned staff.
- **Role Isolation & Non-blocking Audit**: Verification that role assignments (Người tạo, Phụ trách, Thực hiện, Kiểm tra, Phê duyệt, Admin) function properly and audit logs operate non-blockingly without KPI disruption.

### 1.4 UI/UX Quality & Design Skill Integration (`/ui-ux-pro-max`, `/ui-styling`, `/generative_ui`)
The test suite explicitly verifies compliance with modern enterprise workspace UI/UX guidelines:
1. **Touch & Interaction Targets (`/ui-ux-pro-max`)**: All interactive elements (rail steps, table actions, filter chips, pagination) assert a minimum touch target size of 44×44px via `.mobile-touch-target` with at least 8px spacing, guaranteeing mobile usability down to 320px viewport width.
2. **Layout Density & Typography (`/ui-styling`)**: Enforces `.app-compact` and `.pcn-compact` density scaling (90% type scale, compact padding `px-2.5 py-1`, dense row heights), semantic design tokens (`--color-primary`, `--color-background`, `--color-card`, `--radius`), and clear text contrast without gray-on-gray illegibility.
3. **Zero Card Clutter & Zero Modal Cascades (`/generative_ui`)**: Verifies the complete elimination of redundant decorative cards in operational queues (`PgdcnDossierCard` removed) and eliminates nested popup loops (12 legacy modal cascades replaced by high-density TanStack Tables and single-level `PgdcnQuickViewDrawer`).
4. **Instant State Feedback & Focus States**: Assertions verify immediate visual feedback (`PgdcnStatusBadge`, `PgdcnWorkflowRail`), accessible focus rings (`--pcn-focus-ring`, `:focus-visible`), and Sonner toast notifications without blocking workflow execution.

---

## 2. Feature Inventory Coverage Matrix (F01 – F15)

| Feature ID | Feature Name | Target Component / Module | Scope & Core Contract | Test Tier | Verifiable Assertion Method |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **F01** | Core UI Dependencies & Design Tokens | Root directory, `package.json`, `index.css` | Cài đặt `@tanstack/react-table`, `react-hook-form`, `zod`, `@xyflow/react`, khởi tạo `components/ui/**` và cấu hình semantic CSS variables cho Tailwind v4. | Tier 1, Tier 2 | Dependency check, CSS variable token verification, font-sans fallback. |
| **F02** | Enterprise Workspace App Shell | `components/PgdcnAppShell.tsx`, `components/PgdcnSidebar.tsx` | Xây dựng `AppSidebar` (chuyển đổi PCN/PGD, phân quyền), `AppHeader` (Breadcrumbs, Command Palette, Notification Bell, UserNav), Session Auth integration (`/api/auth/pcn-session`). | Tier 1, Tier 2, Tier 3 | Sidebar navigation taxonomy, breadcrumb hierarchy, Command Palette `Ctrl+K`. |
| **F03** | Actionable Unified Dashboard | `components/PgdcnDashboardView.tsx`, `utils/pgdcnDashboard.ts` | Màn hình Dashboard tổng quan: dải KPI metrics compact (4 chỉ số), bộ lọc My Work, danh sách việc cần xử lý gấp, lối tắt trực tiếp vào PCN và PGD. | Tier 1, Tier 2, Tier 3 | 4-stat KPI calculation, 3 core question inbox projection, 1-click CTA. |
| **F04** | PCN High-Density Dossier Queue | `components/PcnDossierQueueView.tsx` | Bảng quản lý hồ sơ PCN chuẩn TanStack Table: lọc theo 7 giai đoạn, trạng thái, tìm kiếm nhanh mã/khách hàng, phân trang dense, không dùng modal lồng. | Tier 1, Tier 2, Tier 3 | 8-column header contract, Vietnamese diacritics search, row navigation. |
| **F05** | PGD High-Density Dossier Queue | `components/PgdDossierQueueView.tsx`, `utils/pgdDomain.ts` | Bảng quản lý hồ sơ PGD chuẩn TanStack Table: lọc theo 7 giai đoạn, nhóm giám định (QC20: Thép, Máy móc, Than), phân trang dense, loại bỏ tràn viền. | Tier 1, Tier 2, Tier 3 | Responsive containment, multi-category filtering, sort stability. |
| **F06** | Unified Workspace Header & Stage Rail | `components/PgdcnDossierBusinessWorkspace.tsx`, `components/PgdcnUiPrimitives.tsx` | Header chi tiết (mã hồ sơ, khách hàng, loại, trạng thái, hạn, assignee, actions) và thanh tiến trình 7 giai đoạn (click điều hướng view, không đổi business state). | Tier 1, Tier 2, Tier 3 | Header metadata assertion, 7-stage rail rendering, view-switching isolation. |
| **F07** | Dossier Main Work Area (65%) | `components/PgdcnDossierBusinessWorkspace.tsx`, `test/pcn-superneat-e2e.test.ts` | Vùng công việc chính: danh sách subtasks, biểu mẫu nhập liệu nghiệp vụ (React Hook Form + Zod), bảng tài liệu với upload, xem trước, versioning, waiver. | Tier 1, Tier 2, Tier 3 | 65% desktop width split, 8-state document checklist machine, waiver validation. |
| **F08** | Dossier Auxiliary Side Panel (35%) | `components/PgdcnDossierBusinessWorkspace.tsx`, `components/PgdcnAssistantView.tsx` | Panel phụ: thông tin tham chiếu, việc kế tiếp, cảnh báo tài liệu thiếu, trợ lý AI theo ngữ cảnh (11 tiêu chí), nhật ký audit append-only. | Tier 1, Tier 2, Tier 3 | 35% side panel layout, missing document blocker, AI audit criteria. |
| **F09** | Integrated DOCX Generation & Attachment | `app/api/generate-docx/route.ts`, `utils/pcnDossierNodeWork.ts` | Tích hợp sinh tài liệu DOCX/PDF từ template catalog, kiểm tra preflight placeholder, đính kèm tự động vào checklist hồ sơ. | Tier 1, Tier 2, Tier 3 | Preflight validation, Docxtemplater generation, auto-attachment. |
| **F10** | Dynamic Dossier Template Catalog & Admin | `components/PgdcnDossierTemplateManagementView.tsx`, `lib/server/workflow-templates.ts` | Danh mục Bộ hồ sơ mẫu: xem danh sách, tạo mới (từ rỗng hoặc clone), phân định domain (PCN/PGD) và scope, quản lý vòng đời (Draft, Publish, Revision, Retire). | Tier 1, Tier 2, Tier 3 | Template lifecycle transitions, unique code validation, node role mapping. |
| **F11** | React Flow Visual Workflow Designer | `components/PgdcnDossierTemplateCanvas.tsx`, `components/PgdcnDossierTemplateEditor.tsx` | Trình thiết kế trực quan bằng React Flow (`@xyflow/react`): canvas kéo thả, custom nodes (giai đoạn, task, duyệt, điều kiện), nối cạnh có điều kiện, inspector panel. | Tier 1, Tier 2, Tier 3 | Canvas node rendering, edge connection validation, cycle detection. |
| **F12** | Immutable Dossier Snapshot Engine | `types.ts`, `app/api/pcn/intake/route.ts`, `lib/server/workflow-tasks.ts` | Cơ chế chụp cấu hình template vào `dossier.workflowSnapshot` khi tạo hồ sơ mới, bảo đảm hồ sơ cũ và đang xử lý hoàn toàn không bị ảnh hưởng khi template thay đổi. | Tier 1, Tier 2, Tier 3 | Deep snapshot clone assertion, template revision isolation, version stability. |
| **F13** | Clean Cutover & Legacy Code Elimination | Codebase inspection, `test/pcn-superneat-e2e.test.ts` | Loại bỏ hoàn toàn mã nguồn UI legacy (`PgdWorkspace.tsx`, `PcnDossierDetailView.tsx`, `PcnWorkspace.tsx`, 12 modal cascades, `server.legacy.ts`, eval screenshots). | Tier 1, Tier 2, Tier 3 | Purged modal checks, legacy route rejection, Archify iframe exclusion. |
| **F14** | Update design.md as SSOT & File Classification Report | `design.md`, `PROJECT.md` | Cập nhật `design.md` phản ánh kiến trúc V2, bảo tồn toàn bộ domain rules (QC4, QC9, QC20, 2 cấp phê duyệt), lập báo cáo phân loại danh mục file (KEEP, REBUILD, DELETE, REVIEW). | Tier 1, Tier 2, Tier 3 | SSOT consistency check, file categorization table, schema invariants. |
| **F15** | Comprehensive Test Suite & Production Build | Repository test harness, `package.json` | Vượt qua 100% bộ test tự động trong repository, typecheck `npm run typecheck` 0 lỗi, production build `npm run build` thành công. | Tier 1, Tier 2, Tier 4 | Automated test runner execution, zero TypeScript errors, build script verification. |

---

## 3. Four-Tier Test Architecture

```
+-----------------------------------------------------------------------------------------+
|  Tier 4: Real-World Scenarios & End-to-End Operational Lifecycles (>=8 tests)          |
|  - S01: PCN QC4 (Thép cốt bê tông) 7-Stage Full Lifecycle Walkthrough                   |
|  - S02: PCN QC9 (Khăn giấy & Giấy vệ sinh) Full Lifecycle Flow                          |
|  - S03: PGD QC20 Giám định Thép nhập khẩu tại Cảng Hải Phòng                             |
|  - S04: PGD Giám định Máy móc thiết bị đã qua sử dụng (QĐ 18/2019/QĐ-TTg)                |
|  - S05: PGD Giám định Than xuất nhập khẩu (Mớn nước & Nhiệt trị)                        |
|  - S06: Adversarial Exception: KQTN Không đạt (Failed) & Thử lại mẫu lưu an toàn         |
|  - S07: Multi-Role Handover Chain with Non-Blocking Audit Integrity                     |
|  - S08: Emergency Dossier with Partial Document Waiver & Fast-Track Governance           |
+-----------------------------------------------------------------------------------------+
                                             ^
+-----------------------------------------------------------------------------------------+
|  Tier 3: Cross-Feature Combinations & Invariants (>=15 tests)                           |
|  - Dynamic Template Snapshot -> Dossier Creation (PCN & PGD)                            |
|  - 7-Stage Progression Rail -> Stage Gate Document Validation (PCN & PGD)               |
|  - Form Input -> DOCX Generation -> Automatic Attachment                                |
|  - Subtask Completion -> Role Guard & 2-Tier Leadership Approval Chain                  |
|  - Side Panel AI Assistant -> Document Waiver Validation                                |
|  - Dashboard KPI Aggregation -> High-Density Queue Filtering                            |
|  - Template Revision -> In-Flight Dossier Snapshot Immutability                          |
|  - PCN Subsystem vs PGD Subsystem Boundary Isolation                                    |
|  - DOCX Preflight Error -> Form Correction -> Successful Re-generation                  |
|  - 2-Tier Approval -> Certificate Issuance -> Customer Delivery Gate                    |
|  - Visual Workflow Editor -> Publish -> Snapshot Creation -> Execution                  |
|  - Full Cutover Invariant: Clean Shell -> Unified 7-Stage Workspace -> Verified Build   |
+-----------------------------------------------------------------------------------------+
                                             ^
+-----------------------------------------------------------------------------------------+
|  Tier 2: Boundary Conditions & Adversarial Edge Cases (>=5 tests/feat = 75 tests)       |
|  - Extreme string lengths & Vietnamese diacritics preservation in table cells           |
|  - Empty queues, 10,000+ high-volume dashboard projection (<50ms execution)             |
|  - SLA overdue boundary at exact UTC midnight transition                                |
|  - 100% missing vs 100% waived documents stage gate evaluation                          |
|  - Permission denials for unauthorized roles on stage transitions and approvals          |
|  - Deep snapshot cloning: original template mutation does not alter in-flight dossier    |
|  - Flow graph validation: self-loop rejection, orphan node detection, cycle detection    |
+-----------------------------------------------------------------------------------------+
                                             ^
+-----------------------------------------------------------------------------------------+
|  Tier 1: Feature Coverage & Contract Verification (>=5 tests/feat = 75 tests)           |
|  - F01: Core UI Dependencies & Design Tokens (Tailwind v4 tokens, font-sans, clean root)|
|  - F02: Enterprise Workspace App Shell (Sidebar 4 groups, breadcrumbs, Ctrl+K trigger)  |
|  - F03: Actionable Unified Dashboard (4-stat KPI metrics, 3 core question inbox, CTA)   |
|  - F04: PCN High-Density Queue (TanStack Table 8 columns, 7-stage filters, row open)     |
|  - F05: PGD High-Density Queue (TanStack Table, QC20 category facets, responsive wrap)  |
|  - F06: Unified Workspace Header & Stage Rail (7 stages, view-switching isolation)     |
|  - F07: Dossier Main Work Area (65% desktop width, 8-state document checklist, waiver)  |
|  - F08: Dossier Auxiliary Side Panel (35% desktop width, blockers, AI audit criteria)   |
|  - F09: Integrated DOCX Generation & Attachment (Preflight, Docxtemplater, auto-attach) |
|  - F10: Dynamic Dossier Template Catalog & Admin (PCN/PGD domains, lifecycle states)     |
|  - F11: React Flow Visual Workflow Designer (Nodes, edges, conditions, inspector)       |
|  - F12: Immutable Dossier Snapshot Engine (Intake capture, version immutability)        |
|  - F13: Clean Cutover & Legacy Code Elimination (Purged legacy UI, modals, and iframes) |
|  - F14: Update design.md as SSOT & File Classification Report (KEEP/REBUILD/DELETE)      |
|  - F15: Comprehensive Test Suite & Production Build (npm test, typecheck, build)        |
+-----------------------------------------------------------------------------------------+
```

---

## 4. Test Execution & Verification

### 4.1 Test Runner Commands

#### 1. Run Complete Master E2E Suite (Direct Isolated Runner)
```powershell
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/e2e/pgdcn-v2-e2e.test.ts
```
*(Executes all 4 tiers: 75 Tier 1 + 75 Tier 2 + 15 Tier 3 + 8 Tier 4 = 173 tests + baseline checks in ~500ms).*

#### 2. Run Individual Tiers
```powershell
# Tier 1 only (Feature Coverage)
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/e2e/tier1-features.test.ts

# Tier 2 only (Boundary & Adversarial)
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/e2e/tier2-boundary.test.ts

# Tier 3 only (Cross-Feature Combinations)
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/e2e/tier3-combinations.test.ts

# Tier 4 only (Real-World Scenarios)
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/e2e/tier4-scenarios.test.ts
```

#### 3. Full Repository Test Runner (`npm test`)
```powershell
npm test
```
*(Executes full repository test harness including the active PCN contracts and the new V2 E2E suite via `test/pcn-v2-e2e.test.ts`).*

#### 4. TypeScript Typecheck Gate
```powershell
npm run typecheck
```
*(Asserts `tsc --noEmit` exits with code 0).*

---

## 5. Automated Quality Gates

1. **Pass Rate Threshold**: 100% of test cases in `test/e2e/` must pass (0 failures, 0 errors).
2. **Zero Regressions**: Active repository test suite must maintain zero failures.
3. **Execution Time Bound**: Isolated E2E master suite execution must complete in under 5 seconds.
4. **TypeScript Safety**: `npm run typecheck` (`tsc --noEmit`) must report 0 errors.
5. **Clean Workspace Integrity**: Zero scratch files, temporary patches, or uncommitted debug files outside `.agents/teamwork/`.
