<!--
Author: Codex
OS support: Windows / Node
Description: Verified root-login overview navigation and dossier action visibility
-->

## Bổ sung 2026-09-05 — Trợ lý AI PGD và production Docker Desktop

- Trợ lý AI đã chạy được cho PGD: chọn một PYC đang hoạt động, bấm **Bắt đầu soát xét hồ sơ**, nhận kết quả streaming theo 5 trạm nghiệp vụ; phiên chỉ đọc và không thay đổi lifecycle/phê duyệt.
- Phiên đọc server-owned kiểm tra request, phân công, hiện trường, mẫu, PTN, kết quả, báo cáo, chứng thư, chain phê duyệt PGD, pointer tài liệu và bằng chứng hiện trường; provenance `domain=pgd`, bucket và checksum được xác nhận trước khi đọc.
- PaddleOCR là OCR duy nhất cho file PGD; Gemini cá nhân chỉ phân tích ngữ nghĩa tùy chọn. File `.doc` cũ hiển thị `NOT_EVALUABLE` để người phụ trách mở hồ sơ chuẩn đối chiếu thủ công.
- UI có tiến độ, thử lại, nhãn `Luật + AI ngữ nghĩa`, **Mở hồ sơ chuẩn** và **Mở bằng chứng** tới đúng endpoint file private.
- Verification: `npm test` **691/691**, `npm run lint`, test PGD assistant **8/8**, `git diff --check` và Docker production build pass.

## Production Docker Desktop — cập nhật

- Đã chạy `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d`.
- Image `pcn_webapp-webapp:latest`: `sha256:88ac729e038f66e6ec08edf9963c828dc6c980f39fc1391bbb3b767fa52079c8`.
- Container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`; PostgreSQL connected/schema initialized; `/api/health` và `/pgdcn/` HTTP 200.
- Không ghi credential, raw OCR, dữ liệu hồ sơ thật hoặc đường dẫn Desktop/UNC vào note.

# PCN_webapp — Root login và nhóm thao tác hồ sơ — 2026-09-05

## Kết quả

- Entry gốc `/` khởi tạo shared PGDCN shell ở `department-dashboard`, nên sau đăng nhập người dùng vào **Tổng quan phòng**.
- `/pgdcn/pcn` và `/pgdcn/pgd` vẫn là các entry tương thích theo miền, không bị đổi hành vi.
- Header chi tiết PCN có nhóm thao tác dành cho Admin/Quản lý toàn hệ thống: hiệu chỉnh hồ sơ và xóa hồ sơ theo status gate; modal hiệu chỉnh giữ mã hồ sơ, Đề nghị và Lĩnh vực không đổi.
- Header chi tiết PGD có nhóm thao tác rõ ràng cho Admin/Quản lý hệ thống và `PGD_ADMIN`/`PGD_MANAGER`; quyền sửa/xóa vẫn tách biệt và do guard mutation quyết định.
- `design.md` và test action-control được cập nhật đồng bộ. Không ghi secret, credential, dữ liệu hồ sơ thật hoặc đường dẫn nguồn Desktop/UNC vào note.

## Production Docker Desktop

- Đã build và up bằng `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d`.
- Image `pcn_webapp-webapp:latest`: `sha256:56fd8a0248d47d55144c0cd09212f9663f4d1b99b595195dd49ca6031b18e61d`.
- Container `pcn_webapp-webapp` đang `running`, publish `0.0.0.0:2357->2357/tcp`; network `supabase_default` và volume `pcn_webapp_backups` hoạt động.
- Log xác nhận PostgreSQL connected, schema initialized, server chạy tại port `2357`.
- Smoke `/api/health`, `/pgdcn/`, `/pgdcn/pcn/`, `/pgdcn/pgd/`: HTTP 200 sau redirect. `/api/db/health` gọi ẩn danh trả 401 theo auth boundary.

## Kiểm chứng

- `npm test`: **689/689 pass**.
- Test navigation/login: **4/4 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass.

## Commit scope

Đợt chốt gồm thay đổi điều hướng entry root, nhóm thao tác hồ sơ PCN/PGD, contract trong `design.md`, test và ghi chú Memory/Obsidian. Các file build/runtime tạm thời không thuộc commit.
