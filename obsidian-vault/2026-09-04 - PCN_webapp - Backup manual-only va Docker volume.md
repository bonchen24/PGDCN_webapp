<!--
Author: Codex
OS support: Windows / Docker
Description: Verified manual-only PCN backup policy and persistent Docker deployment
-->

# PCN_webapp — Backup thủ công-only và Docker volume — 2026-09-04

## Chính sách đã chốt

- PCN chỉ backup thủ công qua thao tác Admin; server không còn scheduler/timer và không tạo archive tự động.
- Retention chạy sau mỗi backup thủ công: tối đa 3 archive mới nhất và tổng dung lượng tối đa 2 GiB.
- Retention chỉ dọn archive kỹ thuật cũ, không xóa hồ sơ nghiệp vụ.

## Lưu trữ bền vững

- Docker named volume: `pcn_webapp_backups`.
- Mount trong container: `/app/backups`.
- Archive kiểm chứng: `pcn_certification_manual_20260904-083718.zip`, khoảng 586,4 MB.
- Archive vẫn tồn tại sau restart/recreate container.

## Production verification

- Image: `pcn_webapp-webapp:latest` — `sha256:4b2e5b8ad3e9b6bfe914c8e1ce8464df09b015977c53ddcca0b4b938c814946f`.
- Container: `pcn_webapp-webapp` — running, port `2357`.
- HTTP `/`: `200`.
- PostgreSQL: connected; schema initialized.
- Runtime flags: `BACKUP_ENABLED=false`, `BACKUP_RETENTION_COUNT=3`, `BACKUP_MAX_TOTAL_BYTES=2147483648`.
- `SUPABASE_SERVICE_ROLE_KEY` chỉ được kiểm tra ở trạng thái runtime `SET`, không ghi giá trị vào note.

## Code và kiểm thử

- Commit: `f6a5da9` — `fix: make backups manual and bounded`.
- `npm test`: 667/667 pass.
- `npm run lint`: pass.
- Docker production build: pass.
- Không sửa/xóa nguồn PGD/Desktop/UNC và không import hồ sơ lịch sử.
