# PCN — Memory note: lưu trình hồ sơ động

> Ngày: 2026-09-06
> Branch: `codex/pcn-dynamic-dossier-workflow`
> Commit code: `3e94d6a` — `feat: add dynamic PCN dossier workflows`
> Commit visibility/backfill: `86caa2b` — `fix: surface dynamic workflow nodes in dossier queues`
> Đây là nhật ký tra cứu nhanh; `design.md` vẫn là nguồn chuẩn duy nhất.

## Cập nhật 2026-09-06 — Reader Archify literal cho cả PCN và PGD

- Tích hợp nguyên upstream Archify tại `vendor/archify/archify`, revision `ed7f4d4b48d4424d36edfed8043de3de8dea6b45`; không chỉ mô phỏng UI. Compiler/schema/template của upstream được gọi server-side và license MIT được giữ nguyên.
- PCN dùng `utils/pcnArchifyWorkflow.ts`; PGD dùng `utils/pgdArchifyWorkflow.ts`; cả hai vào reader chung `components/PcnArchifyWorkflowEmbed.tsx`. Mỗi hồ sơ có graph riêng theo snapshot/lifecycle thật, hỗ trợ nhiều node, tài liệu, nhánh, song song, join và return, không khóa ở 5 trạm.
- Endpoint được bảo vệ bằng session và tự lấy dữ liệu server: `/api/pcn/dossiers/:dossierId/archify`, `/api/pgd/requests/:requestId/archify`. Reader HTML chỉ chứa graph metadata cần thiết, không chứa file private bytes, token hoặc topology do client gửi.
- Archify reader cung cấp các capability upstream; host chỉ nối focus node/edge với action task PCN hiện hành. Deep-link node dùng hash `#focus=<nodeId>`.
- Verification: `npm test` 760/760, focused Archify 5/5, lint/build/diff-check pass; Docker Desktop `pcn_webapp-webapp` Up cổng 2357, health 200, route chưa đăng nhập 401. Public deployment `pcn.tvci.id.vn` không tự đổi bởi Docker local.

## Cập nhật 2026-09-06 — Sửa scroll mobile và first paint của reader

- Standalone dossier đã nối lại flex-height chain `h-full`/`min-h-0` từ workspace tới `pcn-dossier-focus-scroll`, nên phần workflow, checklist và lịch sử có thể cuộn dọc trên mobile.
- Host Archify chuyển sang surface sáng responsive; iframe có `theme=light`, còn renderer server đổi root HTML sang `data-theme="light"` để không xuất hiện khung đen trước khi script theme chạy.
- Đã thêm regression tests cho mobile height/scroll contract và server root theme.
- Verification: full suite **763/763**, focused renderer **2/2**, lint/build/diff-check pass; Docker image `sha256:f616a8a251a63397bde768d92eb4347424a851149ca85af7b4a6c855e25695e9` đang chạy và `/api/health` trả HTTP 200.

## Cập nhật PGD surface light

- Các trạng thái xác thực và thiếu scope của PGD dùng surface sáng thay vì `bg-slate-950`, tránh hiển thị toàn màn hình đen quanh reader khi session/scope chưa sẵn sàng.
- Verification: full suite **764/764**, lint/build/diff-check pass; Docker image `sha256:3cd609c95656a5b9883565d8e4705e52b89caa637fd020fb9cb63aaacbd1e1b4` running, `/api/health` HTTP 200.

## Quy tắc nghiệp vụ đã chốt

- Mỗi hồ sơ có thể chọn một workflow template khác nhau theo lĩnh vực, phương thức và loại hồ sơ.
- Khi tiếp nhận, hồ sơ lưu `workflowSnapshot` và version riêng; publish revision mới không làm thay đổi hồ sơ đang chạy.
- Workflow không giới hạn 5 trạm: graph hỗ trợ nhiều node, task tài liệu, phê duyệt, decision, parallel split/join và end.
- Nhánh điều kiện chỉ dùng allowlist đã định nghĩa; ngữ cảnh được suy ra từ hồ sơ, tài liệu, kết quả, phê duyệt, field và method.
- Hồ sơ bị trả lại tạo cycle rework; các node phụ thuộc phía sau bị stale, node đích được mở lại và yêu cầu lý do trả.
- Mở hồ sơ đi đến route riêng `/pgdcn/pcn/dossiers/:dossierId`; detail panel hiển thị thông tin hồ sơ, tài liệu cần xử lý, trạng thái task, nhánh và lịch sử return theo dạng compact có thể đóng/mở.
- Chỉ admin hoặc quản lý PCN được tạo revision, publish và retire workflow template. Hồ sơ đang chạy vẫn giữ snapshot bất biến.

## Phạm vi đã triển khai

- Template validation, versioning, specificity selection và legacy adapter.
- Runtime projection cho dependency lock/ready, document gate, branch condition, parallel join `ALL`/`ANY`/`QUORUM` và rework cycle.
- API và PostgreSQL seed mặc định `pcn-qc-standard-v1`.
- Store actions cho template/task; server transaction, row lock, audit và RBAC manager/admin.
- Trang quản lý template trong System Settings và dossier detail page riêng.
- Test contract/runtime/store/UI/route/RBAC cho workflow động.
- Dashboard và work queue hiển thị node đang xử lý của từng workflow snapshot; không còn dùng nhãn trạm cố định khi hồ sơ đã có workflow động.
- Đã backfill dữ liệu local hiện có: `15/15` hồ sơ có `workflowSnapshot`, tổng `150` workflow tasks.

## Kiểm chứng và production

- `npm test`: 756/756 đạt.
- `npm run lint`: đạt.
- `npm run build`: đạt; route động `/pgdcn/pcn/dossiers/[dossierId]` được build.
- `git diff --check`: đạt trước commit.
- Docker Desktop: image `pcn_webapp-webapp:latest` build thành công từ `Dockerfile`.
- Container `pcn_webapp-webapp`: đang `Up`, map `0.0.0.0:2357->2357`.
- `GET http://localhost:2357/api/health`: HTTP 200, `{"status":"ok"}`.
- `GET http://localhost:2357/pgdcn/pcn`: HTTP 200.
- Compose production: `docker-compose.pcn.yml`; env được nạp từ các file cục bộ, không ghi giá trị secret vào note.
- Lưu ý: `https://pcn.tvci.id.vn/` là deployment public riêng, không tự thay đổi khi build Docker local; bản đã cập nhật được kiểm tra tại `http://localhost:2357/pgdcn/pcn`.

## Tệp chính

- `design.md`: đặc tả chuẩn, mục 0.8.
- `types.ts`: model template, snapshot, node, transition và task.
- `utils/pcnWorkflowTemplate.ts`: validation/selection/snapshot.
- `utils/pcnWorkflowRuntime.ts`: projection/condition/return runtime.
- `server.ts`: API template, intake, task và RBAC.
- `store-pcn.ts`: state/actions phía client.
- `components/PcnDossierWorkflowPanel.tsx`: UI workflow compact, collapsible.
- `components/PcnWorkflowTemplateManagementView.tsx`: quản lý revision/publish/retire.
- `app/pgdcn/pcn/dossiers/[dossierId]/page.tsx`: route hồ sơ riêng.

## Ghi chú vận hành

- Khi sửa lưu trình, tạo revision và publish; không sửa trực tiếp snapshot của hồ sơ đã tiếp nhận.
- Khi deploy lại production, dùng `docker compose --env-file .env --env-file ..\\TVCI_APP\\.env.local -f docker-compose.pcn.yml up -d --build` với secret cục bộ tương ứng.
