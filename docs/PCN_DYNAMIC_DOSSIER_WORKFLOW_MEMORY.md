# PCN — Memory note: lưu trình hồ sơ động

> Ngày: 2026-09-06
> Branch: `codex/pcn-dynamic-dossier-workflow`
> Commit code: `3e94d6a` — `feat: add dynamic PCN dossier workflows`
> Đây là nhật ký tra cứu nhanh; `design.md` vẫn là nguồn chuẩn duy nhất.

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

## Kiểm chứng và production

- `npm test`: 752/752 đạt.
- `npm run lint`: đạt.
- `npm run build`: đạt; route động `/pgdcn/pcn/dossiers/[dossierId]` được build.
- `git diff --check`: đạt trước commit.
- Docker Desktop: image `pcn_webapp-webapp:latest` build thành công từ `Dockerfile`.
- Container `pcn_webapp-webapp`: đang `Up`, map `0.0.0.0:2357->2357`.
- `GET http://localhost:2357/api/health`: HTTP 200, `{"status":"ok"}`.
- `GET http://localhost:2357/pgdcn/pcn`: HTTP 200.
- Compose production: `docker-compose.pcn.yml`; env được nạp từ các file cục bộ, không ghi giá trị secret vào note.

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
