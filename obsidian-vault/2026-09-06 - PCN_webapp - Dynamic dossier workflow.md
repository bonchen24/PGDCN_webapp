# PCN — Dynamic dossier workflow

Ngày: 2026-09-06
Branch: `codex/pcn-dynamic-dossier-workflow`
Commit: `3e94d6a` — `feat: add dynamic PCN dossier workflows`
Visibility/backfill fix: `86caa2b` — `fix: surface dynamic workflow nodes in dossier queues`

## Kết quả

- Hồ sơ chọn workflow riêng theo lĩnh vực/phương thức/loại hồ sơ.
- Hồ sơ lưu snapshot workflow bất biến theo version.
- Hỗ trợ graph nhiều node, xử lý tài liệu, phê duyệt, decision, nhánh điều kiện và song song `ALL`/`ANY`/`QUORUM`.
- Trả hồ sơ tạo cycle rework, đánh stale phần phụ thuộc và mở lại node đích.
- Mở hồ sơ ở trang riêng `/pgdcn/pcn/dossiers/:dossierId`; panel gọn, đóng/mở được và hiện tài liệu cần xử lý.
- Chỉ admin/quản lý PCN được thay đổi danh sách template, publish hoặc retire.
- Dashboard và work queue hiển thị node hiện tại theo từng workflow snapshot; dữ liệu local đã backfill `15/15` hồ sơ và `150` tasks.

## Kiểm chứng production

- Test: 756/756 pass.
- Lint và Next production build: pass.
- Docker Desktop container `pcn_webapp-webapp`: Up, cổng `2357`.
- Health: `http://localhost:2357/api/health` trả HTTP 200 và `status=ok`.
- `https://pcn.tvci.id.vn/` là deployment public riêng; Docker local được kiểm tra tại `http://localhost:2357/pgdcn/pcn`.

## Nguồn chuẩn

- Đặc tả: `../design.md` mục 0.8.
- Memory đầy đủ: `../docs/PCN_DYNAMIC_DOSSIER_WORKFLOW_MEMORY.md`.
- Kế hoạch: `../docs/superpowers/plans/2026-09-06-pcn-dynamic-dossier-workflow.md`.
