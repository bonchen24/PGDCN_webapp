# Thiết kế Notifications và ActivityLogs cho PCN

## Phạm vi

Bổ sung hoàn chỉnh hai bề mặt đã được `design.md` quy định cho profile PCN:

1. Notifications theo tài khoản trong chuông ở PCN shell.
2. Trang `Nhật ký hệ thống` (ActivityLogs) chỉ đọc cho mọi tài khoản PCN đã đăng nhập.

Không mở rộng sang DDT legacy, không tạo route UI độc lập ngoài PCN shell và không thay đổi các workspace nghiệp vụ hiện có.

## Trạng thái hiện tại và nguyên tắc tái sử dụng

Repo đã có:

- `notifications` và `activityLogs` trong document contract PCN.
- Trigger PostgreSQL tạo notification từ activity lớn với ID ổn định `pcn-notif-<activityId>`.
- `PcnNotificationDropdown`, deep-link notification và store PCN.
- `ActivityLogView`, client cursor/KPI và các helper format/filter.

Thiết kế này hoàn thiện wiring và boundary còn thiếu, không viết lại các luồng nghiệp vụ đã phát sinh activity.

## Kiến trúc và dữ liệu

### Activity log

- `activityLogs` là append-only; mutation nghiệp vụ thành công tiếp tục ghi activity trong transaction hiện hành.
- Trang đọc qua `/api/activity-logs` và `/api/activity-logs/summary`, không dùng toàn bộ lịch sử trong Zustand để hiển thị trang.
- API danh sách hỗ trợ cursor, actor, action, entity, search và khoảng kỳ; các boundary ngày/kỳ giữ chuẩn `Asia/Ho_Chi_Minh`.
- Activity PCN dùng các entity `PCN_*`; KPI PCN nhóm theo Đề nghị/hồ sơ, KQTN, Mẫu/PYC và Khác.

### Notification

- Notification được lưu trong `app_documents.notifications` và được trigger tạo từ activity có entity lớn.
- Activity `IMPORT`/`RESTORE` không phát notification.
- Admin/Quản lý nhận toàn bộ notification PCN; staff nhận notification staff hoặc notification gắn `targetUsernames`; viewer chỉ đọc.
- Server lọc audience trước khi trả notification. Các mutation read/read-all/clear đều kiểm tra audience và role ở server.
- `read` vẫn giữ theo document notification như contract hiện tại; thao tác read/xóa không sửa hoặc xóa activity log.
- Giới hạn hiển thị là 50 notification mới nhất; các notification PCN giữ deep-link theo entity và khu vực hồ sơ.

## API và luồng dữ liệu

### Notifications

Tạo `utils/pcnNotificationApi.ts` làm client chuyên biệt:

- `fetchPcnNotifications()` gọi `GET /api/pcn/notifications`.
- `markPcnNotificationRead(id)` gọi `POST /api/pcn/notifications/:id/read`.
- `markAllPcnNotificationsRead()` gọi `POST /api/pcn/notifications/read-all`.
- `clearPcnNotifications()` gọi `POST /api/pcn/notifications/clear`.

Server dùng session PCN hiện tại để dựng audience, chỉ trả/xử lý các notification user được phép thấy. Các endpoint từ chối viewer khi mutation và trả lỗi HTTP phù hợp để UI hiển thị toast, không làm mất dữ liệu local nếu request lỗi.

### ActivityLogs

Giữ `utils/activityLogApi.ts` và `ActivityLogView` hiện tại; chỉ nối vào PCN workspace với `currentUser` và danh sách `pcn.users`. Trang gồm:

- lọc tìm kiếm, actor nhiều lựa chọn, action, entity và kỳ Ngày/Tuần/Tháng/Năm;
- KPI summary độc lập page size, stacked bar responsive và chi tiết actor;
- cursor pagination, modal chi tiết diff, refresh và CSV export;
- không có thao tác sửa/xóa activity.

## UI và điều hướng

- Thêm `activityLogs` vào `PcnSection`, icon Activity và nhãn `Nhật ký hệ thống`.
- Nhánh này hiển thị cho mọi tài khoản PCN, nằm trong nhóm điều hướng trước `Thiết lập`; phần `Nhân sự PCN` vẫn Admin-only.
- `PcnWorkspace` render `<ActivityLogView currentUser={currentUser} systemUsers={pcn.users} />` cho section này.
- Chuông notification vẫn nằm trong header; dropdown dùng client API chuyên biệt và giữ deep-link hiện có.
- Viewer nhìn thấy dropdown và nội dung notification nhưng không thấy nút read-all/clear và không tạo mutation.

## Error handling và consistency

- Các thao tác read/read-all/clear trong dropdown khóa trong lúc chờ, bắt lỗi async và hiển thị toast.
- Activity list và KPI bỏ qua response cũ sau khi filter thay đổi.
- Nếu server từ chối notification mutation, UI giữ nguyên danh sách hiện tại.
- Không tải DDT users, không map entity DDT vào KPI PCN và không tạo audit mới cho thao tác đọc/xóa notification.

## Kiểm thử

Bổ sung/cập nhật contract tests cho:

- navigation và RBAC của ActivityLogs;
- ActivityLogView nhận danh sách PCN users, cursor/KPI và không có delete mutation;
- notification client gọi đúng endpoint chuyên biệt;
- server audience filter, viewer mutation denial và clear chỉ tác động notification được phép thấy;
- notification stable ID/deep-link và trigger không phát sinh từ `IMPORT`/`RESTORE`.

## Không nằm trong phạm vi

- WebSocket/SSE hoặc push notification real-time.
- Notification center độc lập ngoài PCN shell.
- Thay đổi semantics `read` thành bảng trạng thái riêng theo từng recipient.
- Refactor các mutation nghiệp vụ đang ghi activity.
