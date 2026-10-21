# Scope: Rà soát & Đối chiếu Toàn diện design.md vs Mã nguồn Thực tế

## Architecture & Context
- **Single Source of Truth**: `design.md` là tài liệu chuẩn duy nhất quy định toàn bộ kiến trúc, dữ liệu, UI/UX và quy chuẩn mã nguồn của hệ thống PGDCN Web App.
- **Mục tiêu**: Rà soát, đối chiếu chi tiết giữa tài liệu đặc tả `design.md` và mã nguồn triển khai thực tế (PCN & PGD), phát hiện mọi độ lệch (drift), đánh giá nguyên nhân, và đề xuất bản vá chuẩn hóa cho `design.md` cùng danh sách hành động sửa đổi mã nguồn nếu cần.
- **Nguyên tắc**: Tuyệt đối tuân thủ `AGENTS.md` (giao tiếp tiếng Việt, không tự ý sửa code khi chưa có xác nhận từ người dùng).

## Feature Inventory & Audit Scope
| # | Hạng mục rà soát | Phạm vi đặc tả (design.md) | File mã nguồn đối chiếu | Phân công |
|---|------------------|---------------------------|-------------------------|-----------|
| 1 | R1: UI/UX & Card Components (PCN & PGD) | Mục 3 (Card Components), 3.1.1 (Card Hồ Sơ & Đề Nghị TVCI Lab), Mục 2 (Badge Tokens, Color, Typography), Mục 5 (Layout & View modes) | `components/PcnDossierGroupCard.tsx`, `components/PcnWorkspace.tsx`, `components/PgdWorkspace.tsx` (`RequestCard`), toolbar lọc pill, badge token, icon action, X/Y XONG, 2-col grid, card/table view | Explorer R1 (`explorer_ui_cards`) |
| 2 | R2.1: Data Models, Schema, Lifecycle & Business Rules | Mục 0 (PGDCN Active Profile), Mục 0A (PGD Active Profile), Mục 6 (Data Models & Schema) | `types.ts`, `utils/pgdDomain.ts`, `utils/pgdDossier.ts`, `utils/pcnWorkflowTopology.ts`, `utils/pcnDossierPolicy.ts`; QC4, QC9 (PCN), QC20, STEEL_METAL, MACHINERY_LINE, COAL (PGD), ranh giới PCN vs PGD | Explorer R2.1 (`explorer_data_lifecycle`) |
| 3 | R2.2: API Contracts, Server Endpoints & Security/RBAC | Mục 0, 0A, Mục 7 (Bảo mật, phân quyền, API contracts, lưu trữ/sync) | `server.ts`, các route API PCN & PGD, middleware xác thực, RBAC, endpoint payloads | Explorer R2.2 (`explorer_api_contracts`) |
| 4 | R3: Bảng tổng hợp Discrepancy, Đề xuất Patch & Kế hoạch | Tổng hợp từ R1, R2.1, R2.2 | Lập bảng Discrepancy Matrix, đề xuất patch cho `design.md` và danh sách hành động | Orchestrator 2 (`orchestrator_2`) |

## Milestones & Status
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | UI/UX & Card Components Audit | R1: Card components, toolbar pill, badge tokens, X/Y XONG, 2-col grid, view modes | none | IN_PROGRESS |
| M2 | Data Models, Lifecycle & Business Rules Audit | R2.1: Schema, types, QC rules, state transitions, separation | none | IN_PROGRESS |
| M3 | API Contracts, Server & Security Audit | R2.2: Server routes, API contracts, RBAC, sync | none | IN_PROGRESS |
| M4 | Drift Synthesis, Patch Proposal & Action Plan | R3: Discrepancy matrix, patch recommendations for design.md, action plan | M1, M2, M3 | PLANNED |
