<!--
Author: Codex
OS support: Windows / Node
Description: Verified root-login overview navigation and dossier action visibility
-->

# PCN_webapp — Root login và nhóm thao tác hồ sơ — 2026-09-05

## Kết quả

- Entry gốc `/` khởi tạo shared PGDCN shell ở `department-dashboard`, nên sau đăng nhập người dùng vào **Tổng quan phòng**.
- `/pgdcn/pcn` và `/pgdcn/pgd` vẫn là các entry tương thích theo miền, không bị đổi hành vi.
- Header chi tiết PCN có nhóm thao tác dành cho Admin/Quản lý toàn hệ thống: hiệu chỉnh hồ sơ và xóa hồ sơ theo status gate; modal hiệu chỉnh giữ mã hồ sơ, Đề nghị và Lĩnh vực không đổi.
- Header chi tiết PGD có nhóm thao tác rõ ràng cho Admin/Quản lý hệ thống và `PGD_ADMIN`/`PGD_MANAGER`; quyền sửa/xóa vẫn tách biệt và do guard mutation quyết định.
- `design.md` và test action-control được cập nhật đồng bộ. Không ghi secret, credential, dữ liệu hồ sơ thật hoặc đường dẫn nguồn Desktop/UNC vào note.

## Kiểm chứng

- `npm test`: **689/689 pass**.
- Test navigation/login: **4/4 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass.

## Commit scope

Đợt chốt gồm thay đổi điều hướng entry root, nhóm thao tác hồ sơ PCN/PGD, contract trong `design.md`, test và ghi chú Memory/Obsidian. Các file build/runtime tạm thời không thuộc commit.
