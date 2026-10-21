# BRIEFING — 2026-09-30T04:36:00Z

## Mission
Rà soát và đối chiếu toàn diện Hợp đồng API, Server Implementation, Profile Active & Security/RBAC giữa design.md và mã nguồn thực tế.

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer, api_contracts, security_rbac
- Working directory: e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_api_contracts
- Original parent: c9347652-528c-48e2-896d-0e3b02f08718
- Milestone: R2.2

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- design.md là Single Source of Truth duy nhất
- Phản hồi và viết báo cáo bằng tiếng Việt
- Context routing cho design.md: chỉ đọc mục 0, 0A, 7 (và 10 nếu liên quan)
- TUYỆT ĐỐI KHÔNG sửa mã nguồn và không tạo file code trong workspace

## Current Parent
- Conversation ID: c9347652-528c-48e2-896d-0e3b02f08718
- Updated: 2026-09-30T04:36:00Z

## Investigation State
- **Explored paths**: `design.md` (mục 0, 0A, 7, 10), `server.ts`, `lib/server/*`, `utils/pcnRbac.ts`, `utils/pgdDomain.ts`, `sql/pcn-schema.sql`, `app/api/*`, `package.json`, `test/*`.
- **Key findings**:
  1. Profile Active: `server.ts` hardcodes `DATABASE_PROFILE = 'pcn'`, native dev port 1357, prod port 2357, DB `pcn_certification`, Supabase storage `pcn-files`. QC4/QC9 for PCN; QC20 for PGD (`GĐ-THEP-KG`).
  2. Kiến trúc Server kép (Dual Gateway): `server.ts` (Express) chứa toàn bộ 174 endpoints (85 PCN, 44 PGD, 45 chung/auth/db/backup). `app/api/` (Next.js App Router) có 106 route files từ migration dang dở (chỉ mới port PCN, thiếu hơn 30 routes PGD cốt lõi & backups). `server.ts` dòng 18905 chặn toàn bộ `/api/*` để Express xử lý, ngăn request rơi vào Next.js App Router.
  3. RBAC & Phân quyền: Cấu trúc vai trò đa trục (`systemRole`, `managementRoleCode`, `professionalRoleCodes[]`, `departmentScopes`, `departmentRoleCode`, `pgdRole`). Hoàn toàn tuân thủ đặc tả. Zero cascade deletion được bảo vệ bằng kiểm tra tham chiếu nghiệp vụ (`findPcnUserReferences`) trả về 409 nếu còn tham chiếu.
  4. Ranh giới PCN vs PGD: Tách biệt tuyệt đối ở middleware (`requirePcnDepartmentSessionMiddleware` vs `requirePgdSession`).
  5. Discrepancies (28 mục):
     - Thiếu trong code: `GET /api/pcn/cutover-status` (quy định tại dòng 1353 design.md nhưng không có trong code). Cần bãi bỏ dòng 1353 theo mục 0.3 dòng 169-170.
     - Thiếu trong spec: `POST /api/pcn/intake` (đã implement tại server.ts:9113 nhưng chưa liệt kê trong bảng mục 7.3); `GET /api/tieuchuan` (server.ts:16940 đọc tieuchuan.xlsx chưa được ghi nhận trong spec).
     - Lệch HTTP Method: Notification clear PGDCN dùng `DELETE /api/pgdcn/notifications/clear` trong khi PCN dùng `POST /api/pcn/notifications/clear` (spec dòng 1220 ghi POST).
     - Bảo mật endpoint legacy DDT: `/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation`, `/api/kqtn/*` còn trong `server.ts` chưa được bọc middleware auth PGDCN.
- **Unexplored areas**: Không còn; toàn bộ phạm vi M3 / R2.2 đã hoàn thành 100%, 934 tests passed.

## Key Decisions Made
- Đã hoàn thành lập bảng Ma trận Đối chiếu (Discrepancy Matrix) gồm 28 mục chi tiết.
- Đã xuất bản báo cáo chi tiết `report_api_contracts.md` và báo cáo chuyển giao `handoff.md`.
- Gửi báo cáo hoàn tất cho Orchestrator.

## Artifact Index
- `DISPATCH.md` — Chỉ thị giao việc từ Orchestrator
- `progress.md` — Nhật ký tiến độ và heartbeat
- `report_api_contracts.md` — Báo cáo đối chiếu chi tiết và bảng Discrepancy Matrix
- `handoff.md` — Báo cáo chuyển giao 5 thành phần
