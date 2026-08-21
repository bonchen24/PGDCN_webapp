<!--
Author: Gemini
OS support: Web/Node
Description: Đặc tả hệ thống thông báo hoạt động nghiệp vụ, định tuyến theo vai trò và tài khoản được giao việc
-->

# Đặc tả Thông báo Hoạt động Nghiệp vụ

## Mục tiêu

Hoàn thiện notification của DDT Lab để Admin/Quản lý theo dõi toàn bộ thay đổi nghiệp vụ, đồng thời nhân viên chỉ nhận các thông báo phù hợp với công việc: phiếu mới, biên bản mới và công việc được giao cho chính họ. Mọi tài khoản đã đăng nhập đều có chuông và dropdown notifications; audience của từng thông báo vẫn được giữ nguyên để tránh gây loãng.

## Phạm vi sự kiện

| Nghiệp vụ | Sự kiện | Admin/Quản lý | Nhân viên |
|---|---|---:|---:|
| Phiếu yêu cầu | Tạo | Có | Có |
| Phiếu yêu cầu | Sửa lớn/Xóa | Có | Không |
| Phiếu yêu cầu | Đổi trạng thái | Có | Không |
| Biên bản giao nhận | Tạo | Có | Có |
| Biên bản giao nhận | Sửa lớn/Xóa | Có | Không |
| KQTN | Tạo/Cập nhật/Xóa | Có | Không |
| Lịch thử nghiệm | Xếp/Gỡ/Chuyển lịch | Có | Không |
| Phân công | Giao công việc mới | Có | Chỉ người được giao |

Các thao tác chỉ đọc dữ liệu, đồng bộ nền, đánh dấu notification đã đọc và thao tác hệ thống không tạo notification nghiệp vụ.

Chỉnh sửa nhỏ như xóa chữ, đổi tên khách hàng/model, đổi mã hiển thị, sửa ghi chú hoặc thay đổi field mô tả không phát notification ngay. Các field ảnh hưởng tiến độ, phân công, trạng thái, mẫu, lịch, định danh kỹ thuật hoặc kết quả được xem là thay đổi lớn.

## Hợp đồng dữ liệu

`AppNotification` giữ các trường cũ để tương thích dữ liệu lịch sử và bổ sung metadata:

- `type`: `NEW_REQUEST`, `STATUS_CHANGE`, `BUSINESS_ACTIVITY` hoặc `SYSTEM`.
- `entityType`: `REQUEST`, `HANDOVER_DOC`, `KQTN_RECORD` hoặc `SCHEDULE`.
- `action`: `CREATED`, `UPDATED`, `DELETED`, `STATUS_CHANGED`, `SCHEDULED`, `UNSCHEDULED` hoặc `ASSIGNED`.
- `entityId`, `entityLabel`: định danh và nhãn hiển thị của đối tượng.
- `requestCode`, `docNumber`, `reportNo`, `testCategory`: thông tin định vị tùy loại đối tượng.
- `targetRole`: `admin` hoặc `staff`; dữ liệu cũ có thể tiếp tục dùng `all`.
- `targetUsernames`: danh sách username nhận riêng, dùng cho công việc được giao.
- `createdBy`, `createdAt`, `read`: người tạo sự kiện, thời điểm và trạng thái đọc.

Mọi tài khoản đã đăng nhập đều có thể mở chuông/dropdown. Notification `staff` được Admin/Quản lý xem được; nhân viên chỉ thấy notification `staff`; nếu notification có `targetUsernames`, username hiện tại phải nằm trong danh sách đó. Việc phân công đối chiếu `testerName` với `systemUsers` theo username và họ tên; nếu không khớp tài khoản, chỉ Admin/Quản lý thấy notification phân công.

## Luồng dữ liệu

1. Store action hoàn thành kiểm tra và cập nhật state nghiệp vụ.
2. Bộ dựng notification dùng chung tạo message, metadata và phạm vi người nhận.
3. Notification được thêm vào Zustand, phát Windows notification nếu môi trường đã cấp quyền và đánh dấu cần đồng bộ.
4. `syncTwoWay` merge notification local/cloud theo `id`, giữ `read = true` nếu một phía đã đọc và chỉ lưu các thay đổi ra PostgreSQL.
5. Dropdown lọc theo vai trò/tài khoản trước khi tính badge unread và hiển thị danh sách.
6. Click notification gọi callback điều hướng theo `entityType` và metadata định vị.

## Quy tắc message

- Tạo phiếu: `Có phiếu yêu cầu mới: {requestCode} — {customerName} / {modelName}`.
- Tạo biên bản: `Có biên bản mới: {docNumber} — {type} / {customerName}`.
- Sửa/xóa nghiệp vụ lớn: `{actor} đã {action} {entityLabel}`.
- Đổi trạng thái: `{actor} đã đổi trạng thái {requestCode}: {oldStatus} → {newStatus}`.
- Xếp lịch: `Bạn được giao công việc: {requestCode} vào {scheduledDate}` khi người nhận là nhân viên.
- Thao tác nhóm tạo một message tổng hợp cho một hành động, không lặp theo từng mẫu nếu người dùng chỉ thực hiện một thao tác.

## Hoàn thiện tính bền vững

- `clearNotifications` phải xóa notification trên PostgreSQL, không chỉ xóa local state.
- Backup JSON phải có `notifications`; restore/upload phải bao phủ collection này.
- Dữ liệu notification cũ thiếu metadata vẫn hiển thị bằng title/message/requestCode hiện có.
- Admin/Quản lý dùng một hàm kiểm tra quyền thống nhất ở badge và dropdown; nhân viên không được nhìn thấy notification nội bộ của Admin.

## Kiểm thử và tiêu chí nghiệm thu

- Bộ dựng notification tạo đúng metadata, message và audience cho từng sự kiện.
- Phiếu mới và biên bản mới hiển thị cho Admin và nhân viên.
- Thay đổi lớn/xóa phiếu, biên bản, KQTN, trạng thái và lịch chỉ hiển thị cho Admin/Quản lý.
- Notification phân công chỉ hiển thị cho username được giao và Admin/Quản lý.
- Không phát notification trùng khi một thao tác cập nhật nhiều bản ghi phụ.
- Click notification điều hướng đúng tab/chi tiết.
- Xóa notification không bị khôi phục sau đồng bộ.
- Backup/restore/upload giữ nguyên collection `notifications`.
- Mọi vai trò tài khoản đã đăng nhập đều thấy chuông/dropdown; nội dung vẫn chỉ hiện theo audience được định tuyến.

---
<!-- --- End of 2026-08-17-business-notifications-design.md --- -->
