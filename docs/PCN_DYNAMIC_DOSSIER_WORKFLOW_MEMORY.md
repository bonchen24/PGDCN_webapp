# PCN — Memory note: lưu trình hồ sơ động

> Ngày: 2026-09-06
> Branch: `codex/pcn-dynamic-dossier-workflow`
> Commit code: `3e94d6a` — `feat: add dynamic PCN dossier workflows`
> Commit visibility/backfill: `86caa2b` — `fix: surface dynamic workflow nodes in dossier queues`
> Đây là nhật ký tra cứu nhanh; `design.md` vẫn là nguồn chuẩn duy nhất.

## Cập nhật 2026-09-06 — Khắc phục Archify dossier 401/422

- Lỗi `422` xuất phát từ adapter coi mọi transition có `returnPolicy: REWORK` là cạnh trả về. Quy tắc đúng: cạnh đi tiến theo topology (`to.sortOrder > from.sortOrder`) vẫn là `main/default`; chỉ cạnh đi lùi mới dùng corridor return. Vì vậy workflow snapshot cũ vẫn tương thích, còn seed forward `t-join-approval` không gắn `returnPolicy` mặc định.
- Lỗi `401` trong Docker production chạy HTTP xuất phát từ cookie session luôn có cờ `Secure`. `shouldUseSecurePcnSessionCookie` chỉ bật `Secure` khi production thực sự chạy HTTPS hoặc request có `x-forwarded-proto: https`; HTTPS production vẫn được bảo vệ.
- Regression tests kiểm tra forward rework edge và chính sách cookie. Commit: `2318b0d` — `fix: restore dossier Archify rendering and PCN session`.
- Verification: focused tests **44/44**, full `npm test` **821/821**, `npm run lint` pass, `npm run build` pass, `git diff --check` pass. Docker smoke: login `200`, session `200`, Archify `200`, `/api/health` `200`; container `pcn_webapp-webapp` chạy cổng `2357`.
- Domain public `https://pcn.tvci.id.vn` là deployment riêng; Docker local không tự deploy commit này lên domain. Sau khi deploy public cần hard refresh và đăng nhập lại để kiểm tra.

## Cập nhật 2026-09-06 — Đóng tích hợp full-reader Archify và baseline triển khai

- PCN và PGD đã có đủ năm view Archify (`workflow`, `lifecycle`, `dataflow`, `sequence`, `architecture`) với boundary dữ liệu tách biệt theo domain; runtime upstream pin và chạy server-only, reader theo từng dossier, graph hỗ trợ nhánh/parallel/join/return. Các view read-only không đủ dữ kiện trả unavailable rõ ràng.
- Auth + `private, no-store`, error/unavailable bounded; mobile/reader surface sáng và `data-theme="light"`; renderer allowlist input/output, không truyền `ARCHIFY_REPO_ROOT` hoặc user executable path. Host giữ iframe/focus/action bridge cần thiết, không duplicate upstream toolbar/control hay tạo station-arrow graph; fixture/source payload không chứa private bytes, password, token hoặc absolute source path.
- Verification: focused Archify/page/navigation **69/69**, full `npm test` **812/812**, lint (`tsc --noEmit`) pass, build pass với route `/pgdcn/pcn/dossiers/[dossierId]`, `git diff --check` pass. Upstream revision `ed7f4d4b48d4424d36edfed8043de3de8dea6b45`.
- Docker: `pcn_webapp-webapp` `Up`, port `0.0.0.0:2357->2357/tcp`, image `sha256:855a3a133ee562650b18736ab511891e33f8860200b57c4955745a9a3f65cfa8`; health `HTTP 200` với `{"status":"ok"}`; logs xác nhận PostgreSQL connected, schema initialized, server port 2357.
- Code integration baseline `9b18e4c`; docs commit SHA `409a1e3b850eddee6b9ea48884cbbb58aab292b5`. `design.md` vẫn là nguồn chuẩn duy nhất, không ghi secret/dữ liệu hồ sơ thật và không tuyên bố public deployment đã đổi.

## Cập nhật 2026-09-06 — Sửa lỗi SQL khi mở Archify dossier

- `app_documents` không có cột SQL `created_at`; timestamp activity nằm trong JSON `data.createdAt`. Hai route Archify đã đổi thứ tự đọc activity sang `data->>'createdAt' ASC, document_id` để tránh lỗi PostgreSQL và giữ thứ tự ổn định.
- Regression contract kiểm tra đồng thời route PGD và PCN không còn `ORDER BY created_at`.
- Verification: focused route **3/3 pass**, full suite **765/765 pass**, lint/build/diff-check pass; Docker image `sha256:42fdb167a2c2400283f1f6c728bc31f2e49cbef230f3fa4dadd28252314cd30d` đang chạy và `/api/health` trả HTTP 200.

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
