<!--
Author: Gemini
OS support: Web/Node
Description: Thiết kế chuyển runtime production DDT sang PostgreSQL của Supabase self-host
-->

# Chuyển production DDT sang Supabase PostgreSQL

## Mục tiêu

Cho phép DDT chạy production trên PostgreSQL đã có trong Supabase self-host trên Docker Desktop, không khởi tạo thêm PostgreSQL riêng cho mode production và không ảnh hưởng các dịch vụ Supabase hiện hữu.

## Thiết kế được phê duyệt

- Giữ `docker-compose.yml` hiện tại làm mode standalone/fallback với `ddt_webapp-postgres_db`.
- Tạo `docker-compose.supabase.yml` độc lập cho production Supabase, chỉ chạy `webapp`.
- Webapp tham gia network external `supabase_default` và kết nối tới `supabase-db:5432`.
- DDT dùng database riêng `ddt_lab` trong Supabase PostgreSQL; không dùng `--clean` trên database `postgres` của Supabase.
- Credential Supabase được nạp từ file env của instance Supabase qua lệnh Compose, không sao chép secret vào repository.
- Migration dùng `pg_dump`/`pg_restore` từ database standalone hiện tại; giữ database cũ cho rollback.

## Phạm vi không bao gồm

- Chưa chuyển file binary sang Supabase Storage trong thay đổi này.
- Chưa thay đổi REST API `/api/db`; Express vẫn là lớp truy cập PostgreSQL duy nhất của app.
- Không xóa container hoặc volume PostgreSQL standalone.

## Tiêu chí nghiệm thu

1. Compose Supabase hợp lệ và không còn phụ thuộc service `postgres_db`.
2. Database `ddt_lab` tồn tại trong `supabase-db` và schema DDT khởi tạo thành công.
3. Image production build thành công.
4. Container `webapp` chạy trên `supabase_default`.
5. `/api/health` và `/api/db/health` trả HTTP 200.
6. Có thể đọc/ghi một document qua REST API và dữ liệu nằm trong database Supabase.

<!-- --- End of 2026-08-18-supabase-postgres-runtime-design.md --- -->
