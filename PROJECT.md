# Project: PGDCN V2 — Superneat Enterprise Workspace Frontend Rebuild

## Architecture
- **Framework**: Next.js 16.3.7 (App Router) + React 19.0.0 + TypeScript 5.8.2 + Tailwind CSS 4.3.3.
- **UI Architecture**: Superneat Enterprise Workspace style (inspired by `next-shadcn-dashboard-starter` and `xyflow`):
  - High information density, desktop-first (with fully responsive mobile support).
  - Semantic design tokens defined in `index.css` via Tailwind v4 CSS variables.
  - Component library: shadcn/ui primitives (`components/ui/**`).
  - Table engine: TanStack Table (`@tanstack/react-table` v8) with dense mode, faceted filters, sorting, and pagination.
  - Form engine: React Hook Form (`react-hook-form` v7) + Zod (`zod` v3) with Vietnamese error messages pointing to specific fields.
  - Workflow visual designer: React Flow (`@xyflow/react` v12) for dynamic dossier template creation.
  - Zero large cards, zero nested modal cascades, zero raw JSON/technical IDs shown to standard users.
- **Subsystem & Backend Preservation (100% Untouched)**:
  - Database: PostgreSQL polymorphic JSONB document store in `app_documents (collection_name, document_id, data, updated_at)`.
  - Binary files: `file_assets` table and private Supabase storage buckets (`pcn-files`, `pgd-files`).
  - Append-only trigger protection on `activityLogs`, `agentAuditLogs`, `pgdActivityLogs`.
  - Server runtime: Next.js App Router (`app/api/**` with 127 route handlers, 90 primary endpoints mapped).
  - Business logic: PCN (`store-pcn.ts`, `lib/server/pcn-*.ts`, QC4/QC9 rules, lab PYC-KQTN) and PGD (`store-pgd.ts`, `utils/pgdDomain.ts`, QC20 rules, 2-tier approval chain).
  - DOCX Engine: `templates/pcn/`, `templates/pgd/` and document generation handlers.

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| F01 | Core UI Dependencies & Design Tokens | Cài đặt `@tanstack/react-table`, `react-hook-form`, `zod`, `@xyflow/react`, khởi tạo `components/ui/**` và cấu hình semantic CSS variables cho Tailwind v4 | M1 | ORIGINAL_REQUEST §R1 |
| F02 | Enterprise Workspace App Shell | Xây dựng `AppSidebar` (chuyển đổi PCN/PGD, phân quyền), `AppHeader` (Breadcrumbs, Command Palette, Notification Bell, UserNav), Session Auth integration | M1 | ORIGINAL_REQUEST §R1 |
| F03 | Actionable Unified Dashboard | Màn hình Dashboard tổng quan: dải KPI metrics compact, bộ lọc My Work, danh sách việc cần xử lý gấp, lối tắt trực tiếp vào PCN và PGD | M2 | ORIGINAL_REQUEST §R1, §R2 |
| F04 | PCN High-Density Dossier Queue | Bảng quản lý hồ sơ PCN chuẩn TanStack Table: lọc theo 7 giai đoạn, trạng thái, tìm kiếm nhanh mã/khách hàng, phân trang dense, không dùng modal lồng | M2 | ORIGINAL_REQUEST §R1, §R2 |
| F05 | PGD High-Density Dossier Queue | Bảng quản lý hồ sơ PGD chuẩn TanStack Table: lọc theo 7 giai đoạn, nhóm giám định (QC20), phân trang dense, loại bỏ tràn viền | M2 | ORIGINAL_REQUEST §R1, §R2 |
| F06 | Unified Workspace Header & Stage Rail | Header chi tiết (mã hồ sơ, khách hàng, loại, trạng thái, hạn, assignee, actions) và thanh tiến trình 7 giai đoạn (click điều hướng view, không đổi business state) | M3 | ORIGINAL_REQUEST §R2 |
| F07 | Dossier Main Work Area (65%) | Vùng công việc chính: danh sách subtasks, biểu mẫu nhập liệu nghiệp vụ (React Hook Form + Zod), bảng tài liệu với upload, xem trước, versioning, waiver | M3 | ORIGINAL_REQUEST §R2 |
| F08 | Dossier Auxiliary Side Panel (35%) | Panel phụ: thông tin tham chiếu, việc kế tiếp, cảnh báo tài liệu thiếu, trợ lý AI theo ngữ cảnh (11 tiêu chí), nhật ký audit append-only | M3 | ORIGINAL_REQUEST §R2 |
| F09 | Integrated DOCX Generation & Attachment | Tích hợp sinh tài liệu DOCX/PDF từ template catalog, kiểm tra preflight placeholder, đính kèm tự động vào checklist hồ sơ | M3 | ORIGINAL_REQUEST §R2, §R4 |
| F10 | Dynamic Dossier Template Catalog & Admin | Danh mục Bộ hồ sơ mẫu: xem danh sách, tạo mới (từ rỗng hoặc clone), phân định domain (PCN/PGD) và scope, quản lý vòng đời (Draft, Publish, Revision, Retire) | M4 | ORIGINAL_REQUEST §R3 |
| F11 | React Flow Visual Workflow Designer | Trình thiết kế trực quan bằng React Flow (`@xyflow/react`): canvas kéo thả, custom nodes (giai đoạn, task, duyệt, điều kiện), nối cạnh có điều kiện, inspector panel cấu hình tài liệu và vai trò | M4 | ORIGINAL_REQUEST §R1, §R3 |
| F12 | Immutable Dossier Snapshot Engine | Cơ chế chụp cấu hình template vào `dossier.workflowSnapshot` khi tạo hồ sơ mới, bảo đảm hồ sơ cũ và đang xử lý hoàn toàn không bị ảnh hưởng khi template thay đổi | M4 | ORIGINAL_REQUEST §R3, §R4 |
| F13 | Clean Cutover & Legacy Code Elimination | Loại bỏ hoàn toàn mã nguồn UI legacy (`PgdWorkspace.tsx`, `PcnDossierDetailView.tsx`, `PcnWorkspace.tsx`, 12 modal cascades, `server.legacy.ts`, eval screenshots) | M5 | ORIGINAL_REQUEST §R1, §R5 |
| F14 | Update design.md as SSOT & File Classification Report | Cập nhật `design.md` phản ánh kiến trúc V2, bảo tồn toàn bộ domain rules, lập báo cáo phân loại danh mục file (KEEP, REBUILD, DELETE, REVIEW) | M5 | ORIGINAL_REQUEST §R5 |
| F15 | Comprehensive Test Suite & Production Build | Vượt qua 100% bộ test tự động trong repository, typecheck `npm run typecheck` 0 lỗi, production build `npm run build` thành công | M5 | Acceptance Criteria |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Foundation, Design Tokens & Enterprise Shell | F01, F02 | none | COMPLETED |
| M2 | Actionable Dashboard & Unified TanStack Queues | F03, F04, F05 | M1 | COMPLETED |
| M3 | Unified 7-Stage Dossier Workspace (65/35 Split) | F06, F07, F08, F09 | M1, M2 | COMPLETED |
| M4 | Dynamic Dossier Template Manager (React Flow & Snapshot) | F10, F11, F12 | M1, M3 | COMPLETED |
| M5 | Clean Cutover, Legacy Deprecation, Full E2E & Victory Audit | F13, F14, F15 | M1, M2, M3, M4 | IN_PROGRESS |

## Interface Contracts
### Global Shell ↔ Subsystem Modules
- `AppSidebar`: Điều hướng các mục: Dashboard (`/`), PCN (`/pcn`), PGD (`/pgd`), Bộ mẫu (`/templates`), Soạn thảo (`/drafting`), Khách hàng (`/customers`), Nhật ký (`/activity-logs`), Cấu hình (`/settings`).
- `AppHeader`: Nhận đường dẫn hiện tại và context hồ sơ để sinh Breadcrumbs phân cấp; kích hoạt Command Palette (`Ctrl+K`); hiển thị số thông báo chưa đọc từ `/api/pgdcn/notifications`.
- `AuthSession`: Phiên làm việc được quản lý qua cookie `pcn_certification_session`. Lấy thông tin user từ `GET /api/auth/pcn-session`.

### TanStack Table ↔ Workspace Navigation
- Table Row Props: `code`, `customerName`, `typeLabel`, `currentStageIndex (1-7)`, `stageName`, `documentProgress: { completed: number, total: number }`, `assignee: { username: string, name: string }`, `status: SemanticStatus`, `onOpenDossier: (id: string) => void`.
- Điều hướng: Bấm hàng hoặc mã hồ sơ sẽ mở trực tiếp trang Workspace tương ứng: `/pcn/dossiers/[dossierId]` hoặc `/pgd/dossiers/[requestId]`.

### Unified Workspace 65/35 Contract
- `DossierWorkspaceHeader`: Hiển thị mã hồ sơ, khách hàng, loại, trạng thái, SLA, danh sách hành động (Nhận việc, Phân công lại, Chuyển bước, Trả sửa, Tải gói ZIP).
- `DossierStageRail`: Nhận danh sách 7 giai đoạn và giai đoạn hiện tại. Tương tác click chỉ chuyển đổi tab xem công việc (view switching), không tự động gọi API đổi trạng thái nghiệp vụ.
- `DossierWorkPanel` (65%): Hiển thị danh sách task của giai đoạn, form nhập liệu nghiệp vụ (React Hook Form + Zod), bảng tài liệu với các nút Sinh DOCX, Tải lên, Xem nhanh, Lịch sử, Miễn trừ (Waiver).
- `DossierSecondaryRail` (35%): Hiển thị thông tin liên quan, việc kế tiếp, cảnh báo tài liệu thiếu, trợ lý AI theo ngữ cảnh (11 tiêu chí) và nhật ký hoạt động.

### Dynamic Template Manager ↔ Dossier Initialization Contract
- Template Schema: Chứa `code`, `name`, `domain: 'PCN' | 'PGD'`, `scope`, `version`, `status: 'DRAFT' | 'PUBLISHED' | 'RETIRED'`, `nodes: WorkflowNode[]`, `transitions: WorkflowTransition[]`.
- Snapshot Engine: Khi tạo mới hồ sơ PCN (`POST /api/pcn/intake`) hoặc PGD (`POST /api/pgd/requests`), server sao chép nguyên vẹn `workflowSnapshot` từ template `PUBLISHED` tương ứng. Hồ sơ chạy độc lập trên snapshot này.

## Code Layout
- `app/(auth)/login/page.tsx`: Màn hình đăng nhập sạch sẽ.
- `app/(workspace)/layout.tsx`: Layout chung cho Enterprise Workspace.
- `app/(workspace)/page.tsx`: Unified Dashboard.
- `app/(workspace)/pcn/page.tsx`: Hàng đợi hồ sơ PCN (TanStack Table).
- `app/(workspace)/pcn/dossiers/[dossierId]/page.tsx`: Workspace 7 giai đoạn PCN.
- `app/(workspace)/pgd/page.tsx`: Hàng đợi hồ sơ PGD (TanStack Table).
- `app/(workspace)/pgd/dossiers/[requestId]/page.tsx`: Workspace 7 giai đoạn PGD.
- `app/(workspace)/templates/page.tsx`: Quản lý bộ hồ sơ mẫu.
- `app/(workspace)/templates/[templateId]/page.tsx`: Trình thiết kế visual React Flow.
- `app/(workspace)/drafting/page.tsx`: Studio soạn thảo DOCX tập trung.
- `components/ui/**`: Bộ component shadcn/ui.
- `components/layout/**`: AppSidebar, AppHeader, CommandPalette, UserNav.
- `components/tables/**`: Reusable TanStack Table components.
- `components/workspace/**`: Reusable Workspace components (Header, 7-stage Rail, WorkPanel, SecondaryRail, DocumentTable).
- `components/template-editor/**`: React Flow editor components (Canvas, Custom Nodes, Inspector Panel).
- `hooks/**`: Custom hooks (use-breadcrumbs, use-table-state, use-sidebar).
- `lib/validations/**`: Zod schemas cho các biểu mẫu nghiệp vụ.
- `lib/server/**`: [KEEP] Toàn bộ backend server services.
- `app/api/**`: [KEEP] Toàn bộ 127 route handlers backend.
- `sql/**`: [KEEP] Database schemas & triggers.
- `templates/**`: [KEEP] DOCX source templates.
