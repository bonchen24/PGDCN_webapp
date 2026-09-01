---
title: PCN_webapp — Graphic workflow upload và kiểm chứng hiện tại
date: 2026-08-30
tags:
  - PCN
  - workflow
  - upload
  - verification
---

# PCN_webapp — Graphic workflow upload và kiểm chứng hiện tại

> Đây là nhật ký quan sát triển khai. `design.md` vẫn là nguồn chuẩn duy nhất cho kiến trúc, schema và UI/UX.

## Phạm vi lượt này

- Sửa điểm vào upload tài liệu theo từng bước của hồ sơ.
- Giữ giao diện graphic workflow, không quay lại mô hình các cột/trạm riêng.
- Không thêm migration, bảng hoặc collection mới.

## Quyết định kỹ thuật

- `getPcnPipelineStationByKey()` resolve node được chọn trên graphic workflow.
- `buildPcnDossierStationChecklist()` nhận thêm `stationKey` tùy chọn; khi không truyền vẫn giữ behavior tương thích theo `dossier.status`.
- `PcnDossierDetailView` tạo `selectedStationChecklist` từ node đang chọn và dùng projection này cho phần **Tài liệu tại bước**.
- Mỗi card tài liệu hiển thị nút **Tải phiên mới**. Handler vẫn gọi upload boundary hiện hành, lưu pointer/metadata và giữ lịch sử phiên cũ.
- Bảng **Kiểm tra trực quan hồ sơ** vẫn là vùng read-only; vùng checklist theo node đang chọn mới là nơi upload.

## Hành vi người dùng cần kiểm tra

1. Mở một hồ sơ từ card hoặc graphic workflow.
2. Bấm node cần xử lý, ví dụ `SAMPLING_LAB`.
3. Xem panel **Tài liệu tại bước** ngay dưới bản đồ quy trình.
4. Bấm **Tải phiên mới** trên đúng mục tài liệu và chọn file.
5. Xác nhận phiên mới xuất hiện, phiên cũ vẫn còn trong **Chi tiết phiên và tải tài liệu**.
6. Với viewer, chỉ thấy trạng thái và nút mở file; không thấy input upload.

## Kiểm chứng ngày 2026-08-30

- Focused pipeline: `23/23` pass.
- Toàn bộ test: `955/955` pass.
- TypeScript: `npm run lint` pass (`tsc --noEmit`).
- Production bundle: `npm run build` pass.
- `git diff --check`: exit 0; chỉ còn cảnh báo line ending của Git trên các file Windows.
- `http://127.0.0.1:2357/`: trả HTTP 200 `text/html`.
- Docker Desktop CLI/API hiện trả `permission denied`; vì vậy chưa có bằng chứng đủ mạnh để khẳng định container đang chạy đã được recreate từ build mới nhất.

## File liên quan

- `design.md`
- `components/PcnDossierDetailView.tsx`
- `utils/pcnDossierPipeline.ts`
- `test/pcn-pipeline.test.ts`
- `PROJECT_MEMORY.md`

## Việc còn lại

- Khôi phục quyền truy cập Docker Engine, đặt `PCN_SESSION_SECRET` ổn định trong env triển khai rồi recreate `docker-compose.pcn.yml` nếu cần phát hành build mới.
- Đăng nhập bằng tài khoản PCN hợp lệ để kiểm tra trực quan một dossier thật, sau đó thử upload một file kiểm thử trong đúng phạm vi dữ liệu được phép.
- Khi tiếp tục phát triển, không reset/dọn các thay đổi đang có trong workspace nếu chưa xác định đó là thay đổi của lượt hiện tại.
