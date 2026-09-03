<!--
Author: Codex
OS support: Windows / Node
Description: PGDCN dashboard density and shared PCN/PGD notifications
-->

# PCN_webapp — Dashboard và notifications chung PGDCN — 2026-09-03

## Kết quả

- Dashboard PGDCN dùng bố cục responsive nhiều cột hơn, gọn hơn và có thêm các card KPI vận hành.
- Card **KPI người dùng** là một phần của Dashboard, cùng các card hồ sơ/chờ xử lý và lưu trữ.
- Card **Thông báo phòng** nằm trực tiếp trên Dashboard; header có chuông và badge unread dùng chung.
- PCN và PGD dùng một feed notifications chung, có badge `PCN`/`PGD`, không tách thành hai khu vực.

## Luồng notification

- Collection bền vững: `notifications` trong `app_documents`.
- Bản ghi mới có `domain=PCN|PGD`; dữ liệu PCN cũ thiếu domain được chuẩn hóa thành `PCN` khi đọc.
- PGD chỉ phát notification cho các mốc lớn: request, trạng thái, phân công, hiện trường, mẫu, PTN, KQTN, báo cáo, chứng thư và duyệt.
- Mở chuông/card sẽ tải lại feed; chọn một dòng điều hướng về đúng module nghiệp vụ và đánh dấu đã đọc từ Dashboard nếu cần.
- Có thao tác đọc một, đọc tất cả và xóa; server áp dụng scope/audience/target username, viewer chỉ có quyền đọc.

## Hợp đồng kỹ thuật

- `GET /api/pgdcn/notifications`
- `POST /api/pgdcn/notifications/:notificationId/read`
- `POST /api/pgdcn/notifications/read-all`
- `DELETE /api/pgdcn/notifications/clear`
- Projection/navigation: `utils/pgdcnNotification.ts`
- Client API: `utils/pgdcnNotificationApi.ts`
- Shared UI: `components/PgdcnNotificationDropdown.tsx`, `components/PgdcnAppShell.tsx`, `components/PgdcnDashboardView.tsx`

## Kiểm chứng

- `npm test`: **657/657 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass; chỉ còn cảnh báo line-ending LF/CRLF trên Windows.

Không lưu secret, credential, attachment hoặc dữ liệu hồ sơ thật trong Memory/Obsidian.
