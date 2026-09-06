# PCN — Dynamic dossier workflow

Ngày: 2026-09-06
Branch: `codex/pcn-dynamic-dossier-workflow`
Commit: `3e94d6a` — `feat: add dynamic PCN dossier workflows`
Visibility/backfill fix: `86caa2b` — `fix: surface dynamic workflow nodes in dossier queues`

## Tích hợp literal Archify — PCN và PGD

- Upstream Archify được vendor nguyên repo tại `vendor/archify/archify`, revision `ed7f4d4b48d4424d36edfed8043de3de8dea6b45`; license MIT giữ trong vendor và nguồn được ghi ở `vendor/archify/SOURCE_REVISION.md`.
- `PcnArchifyWorkflowEmbed` dùng chung cho cả hai phòng/miền. PCN adapter chiếu snapshot, task, tài liệu, kết quả và phê duyệt; PGD adapter chiếu lifecycle, checklist, hiện trường, mẫu, PTN, báo cáo và phê duyệt. Mỗi hồ sơ vẫn có graph riêng, nhiều node, song song, rẽ nhánh và return.
- Server dùng compiler và reader chính thức của Archify (`workflow-compiler.mjs`, `applyTemplate`, `assets/template.html`) qua endpoint session-only `/api/pcn/dossiers/:dossierId/archify` và `/api/pgd/requests/:requestId/archify`. Trang chi tiết hồ sơ riêng giữ nguyên; sơ đồ Archify là vùng chính, không còn bản đồ dọc 5 trạm.
- Reader upstream sở hữu Finder, Passport, reach, route probe, lens, radar, guided views/story, presentation, theme/preset, keyboard và export. Host React chỉ nhận stable node/edge message cùng record id để nối action PCN hiện hành; topology không nhận từ browser, private bytes/token không nhúng vào HTML.
- Deep-link node được truyền thành `#focus=<nodeId>`; route viewer fail closed qua auth/compiler. Verification: full suite `760/760`, focused Archify `5/5`, lint/build/diff-check pass; Docker `pcn_webapp-webapp` Up cổng `2357`, health 200, unauthenticated PCN/PGD Archify route 401. Browser local dừng ở login boundary vì không tự động nhập credential.

## Sửa mobile scroll và khung đen reader

- Standalone dossier khôi phục flex-height chain `h-full`/`min-h-0` tới `.pcn-dossier-focus-scroll`, để nội dung hồ sơ cuộn dọc đúng trên mobile.
- Host và server renderer Archify dùng theme sáng mặc định; iframe co giãn theo viewport và root HTML được chuẩn hóa `data-theme="light"`, tránh first paint đen.
- Regression contracts đã bao phủ mobile height/scroll và server root theme.
- Verification cuối: full suite **763/763**, focused renderer **2/2**, lint/build/diff-check pass; Docker image `sha256:f616a8a251a63397bde768d92eb4347424a851149ca85af7b4a6c855e25695e9` running, `/api/health` HTTP 200.

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
