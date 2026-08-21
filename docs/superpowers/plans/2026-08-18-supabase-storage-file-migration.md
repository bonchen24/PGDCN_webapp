<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch migrate ảnh KQTN sang Supabase Storage và kiểm tra backup hai phần
-->

# Supabase Storage File Migration Implementation Plan

**Goal:** Copy các ảnh Base64 đang lưu trong `kqtnRecords` sang bucket private `ddt-files` của Supabase Storage, ghi metadata vào `file_assets`, giữ nguồn DB để rollback và kiểm tra backup DB + file.

**Architecture:** Job Node chạy trong container webapp trên network `supabase_default`, đọc `ddt_lab` qua `supabase-db:5432`, upload qua Storage API nội bộ `supabase-storage:5000`, dùng checksum/object path ổn định và không xóa payload nguồn.

**Spec:** `docs/superpowers/specs/2026-08-18-supabase-storage-file-migration-design.md`

## Global Constraints

- Không sửa file `.env` hoặc ghi secret vào repository.
- Không xóa Base64 trong `app_documents` ở phase này.
- Không xóa database/volume Supabase hoặc database standalone rollback.
- File code/Markdown mới hoặc chỉnh sửa phải giữ header/footer theo `AGENTS.md`.
- Viết test trước helper extraction/path, chạy red, rồi mới implement.

## Task 1: Define the migration contract with tests

- [x] Viết test extraction nested data URI, reject input không hợp lệ và path ổn định.
- [x] Chạy test targeted để xác nhận fail trước implementation.

## Task 2: Add Storage metadata and migration utilities

- [x] Thêm bảng `file_assets` vào `sql/schema.sql`.
- [x] Implement helper decode/extract/hash/object path.
- [x] Implement Supabase Storage REST client idempotent cho bucket và upload.
- [x] Implement script `scripts/migrateKqtnImagesToSupabaseStorage.ts`.
- [x] Thêm npm script `migrate:storage`.

## Task 3: Wire production Compose and documentation

- [x] Truyền `SUPABASE_STORAGE_URL`, `SUPABASE_STORAGE_BUCKET` và service role key từ env ngoài repository.
- [x] Cập nhật `design.md` và README về Storage boundary, migration và backup ba phần.
- [x] Thêm contract test cho Compose Storage configuration.

## Task 4: Execute migration and verify data

- [x] Tạo dump pre-storage migration.
- [x] Build/deploy image production mới.
- [x] Chạy job migrate trong network Supabase.
- [x] Kiểm tra bucket, metadata, object count/bytes, nguồn Base64 và health API.

## Task 5: Final verification

- [x] Chạy targeted test, full test suite, lint và build.
- [x] Kiểm tra diff whitespace nếu workspace có Git metadata.
- [x] Báo rõ phạm vi file đã migrate và các file tạm không thể migrate.

<!-- --- End of 2026-08-18-supabase-storage-file-migration.md --- -->
