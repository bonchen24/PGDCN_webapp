<!--
Author: Gemini
OS support: Web/Node
Description: Đặc tả trang Nhật ký hệ thống và audit log bất biến cho DDT Lab
-->

# Đặc tả Trang Nhật ký Hệ thống

## Trạng thái

Đã chốt theo phương án 1, chờ người dùng duyệt spec chi tiết trước khi lập implementation plan.

## Mục tiêu

Xây dựng một nhật ký audit riêng cho toàn hệ thống để Admin/Quản lý có thể tra cứu ai đã thực hiện thao tác gì, trên đối tượng nào, vào thời điểm nào và dữ liệu quan trọng đã thay đổi ra sao.

Mục tiêu giao diện là tạo một điểm theo dõi tập trung, có lọc và phân trang; mục tiêu dữ liệu là lưu lịch sử bền vững, không bị ảnh hưởng bởi thao tác đọc/xóa notification.

## Quyết định kiến trúc

- Dùng collection riêng `activityLogs` trong bảng `app_documents`; không tái sử dụng collection `notifications`.
- Bản ghi activity log là append-only đối với giao diện người dùng: không có nút sửa/xóa lịch sử.
- Mọi thao tác nghiệp vụ thành công đều ghi activity log, bao gồm cả chỉnh sửa nhỏ. Chính sách ít nhiễu chỉ áp dụng cho notification: chỉ thay đổi lớn mới phát thông báo ngay.
- Trang Nhật ký hệ thống chỉ hiển thị cho Admin và người có chức danh Quản lý/Trưởng phòng/Phó trưởng phòng/Lãnh đạo theo hàm kiểm tra quyền thống nhất của ứng dụng.
- Thêm nhánh sidebar `Nhật ký hệ thống` ngay trước `Thiết lập`.
- Trang không tải toàn bộ collection vào Zustand. Dữ liệu được đọc bằng API phân trang phía server để tránh làm nặng bộ nhớ khi lịch sử tăng.

## Phân biệt activity log và notification

| Tiêu chí | Nhật ký hệ thống | Notification |
|---|---|---|
| Mục đích | Lưu vết và tra cứu lịch sử | Nhắc việc hoặc báo thay đổi cần chú ý |
| Phạm vi sự kiện | Mọi mutation nghiệp vụ thành công | Chỉ sự kiện lớn theo chính sách ít nhiễu |
| Lưu trữ | Collection `activityLogs`, append-only | Collection `notifications`, có trạng thái đọc/xóa |
| Quyền xem | Tất cả tài khoản đã đăng nhập | Tất cả tài khoản đã đăng nhập, nội dung vẫn theo audience |
| Phân trang | Bắt buộc ở server | Giới hạn danh sách mới nhất hiện có |
| Xóa dữ liệu | Không cho xóa từ UI | Có thể xóa notification theo luồng hiện tại |

Một chỉnh sửa tên, mã hiển thị, ghi chú hoặc chữ mô tả nhỏ không tạo notification, nhưng vẫn tạo một dòng trong activity log để đáp ứng yêu cầu truy vết toàn hệ thống.

## Phạm vi sự kiện cần ghi

| Nhóm | Thao tác ghi log | Notification ngay |
|---|---|---|
| Phiếu yêu cầu | Tạo, sửa, xóa, đổi trạng thái, cập nhật phân công, di chuyển/xếp lịch liên quan phiếu | Tạo/xóa, đổi trạng thái, phân công, lịch và sửa lớn |
| Biên bản giao nhận | Tạo, sửa, xóa, thay đổi người giao/nhận hoặc danh sách mẫu | Tạo và sửa/xóa lớn |
| KQTN | Tạo, cập nhật, xóa, gửi duyệt hoặc thay đổi kết quả chính | Cập nhật/xóa và thay đổi kết quả chính |
| Lịch thử nghiệm | Xếp, gỡ, chuyển lịch, thay đổi ngày/ca/phòng/KTV | Có |
| Người dùng | Tạo, sửa, xóa tài khoản hoặc thay đổi quyền/chức danh | Không, trừ khi sau này có chính sách riêng |
| Danh mục & thiết lập | Tạo, sửa, xóa khách hàng, sản phẩm, thương hiệu, cấu hình | Không, trừ khi là thay đổi nghiệp vụ lớn đã được định nghĩa |
| Nhập/khôi phục | Một log tổng hợp cho mỗi lần import/restore thành công, kèm số lượng bản ghi | Không phát từng notification theo từng dòng |

Các thao tác chỉ đọc, tải lại dữ liệu, đồng bộ nền, đánh dấu notification đã đọc và mở/đóng modal không ghi log. Một thao tác nhóm do người dùng thực hiện tạo một log tổng hợp có số lượng và danh sách định danh cần thiết, không tạo hàng trăm dòng lặp lại.

## Mô hình dữ liệu

Type mới dự kiến đặt trong `types.ts`:

```ts
type ActivityLogAction =
  | 'CREATED'
  | 'UPDATED'
  | 'DELETED'
  | 'STATUS_CHANGED'
  | 'SCHEDULED'
  | 'UNSCHEDULED'
  | 'ASSIGNED'
  | 'IMPORTED'
  | 'RESTORED'
  | 'CONFIGURED';

type ActivityLogEntityType =
  | 'REQUEST'
  | 'HANDOVER_DOC'
  | 'KQTN_RECORD'
  | 'SCHEDULE'
  | 'USER'
  | 'CUSTOMER'
  | 'PRODUCT'
  | 'BRAND'
  | 'SYSTEM_SETTINGS'
  | 'SYSTEM';

interface ActivityLog {
  id: string;
  createdAt: string;
  actorUsername?: string;
  actorName: string;
  actorRole?: UserRole;
  action: ActivityLogAction;
  entityType: ActivityLogEntityType;
  entityId?: string;
  entityLabel?: string;
  requestCode?: string;
  docNumber?: string;
  reportNo?: string;
  summary: string;
  changes?: Array<{
    field: string;
    before: unknown;
    after: unknown;
  }>;
  source: 'UI' | 'IMPORT' | 'RESTORE' | 'SYSTEM';
  groupId?: string;
}
```

Quy tắc dữ liệu:

- `actorName`, `actorUsername`, `actorRole` là snapshot tại thời điểm thao tác; đổi tên tài khoản sau này không làm sai lịch sử cũ.
- `summary` là câu mô tả ngắn, đủ hiển thị trong bảng mà không cần giải mã payload.
- `changes` chỉ chứa field nghiệp vụ cần truy vết, theo cặp `before`/`after`; giá trị phải được chuẩn hóa thành JSON và không chứa mật khẩu, token, API key hoặc dữ liệu nhạy cảm không cần thiết.
- `entityLabel` và các định danh `requestCode`/`docNumber`/`reportNo` phục vụ tìm kiếm và điều hướng, không thay thế `entityId`.
- `groupId` dùng để gom các dòng phát sinh từ một thao tác nhóm hoặc liên kết một log tổng hợp với các log chi tiết nếu implementation cần.
- Không dùng trạng thái `read`, `targetRole` hay `targetUsernames` cho activity log.

## Luồng ghi log

1. Store action chụp snapshot tối thiểu của đối tượng trước khi thay đổi.
2. Store hoàn tất mutation và xác nhận thao tác thành công theo luồng persistence hiện có.
3. Helper dùng chung tạo `ActivityLog`, chuẩn hóa diff và summary từ actor hiện tại cùng metadata nghiệp vụ.
4. Log được append vào `activityLogs` bằng định danh bất biến; không gọi đường xóa/sửa của collection này từ UI.
5. Notification builder được gọi độc lập với helper activity log và tiếp tục áp dụng `isMajor...`; việc log đầy đủ không làm tăng notification nhỏ.
6. Nếu thao tác là nhóm, ưu tiên một log tổng hợp có `groupId` và số lượng; chi tiết từng dòng chỉ ghi khi cần để truy vết từng đối tượng.

Việc ghi activity log không được làm rollback một mutation nghiệp vụ đã thành công trong kiến trúc hiện tại. Nếu ghi log thất bại, store phải giữ chẩn đoán đồng bộ/lỗi để Admin biết lịch sử có thể thiếu; không âm thầm coi log lỗi là thao tác thành công hoàn chỉnh.

## API và phân trang

Thêm API chuyên dụng, không dùng `GET /api/db/activityLogs` để tải toàn bộ lịch sử:

- `GET /api/activity-logs?cursor=&limit=&actor=&action=&entityType=&from=&to=&search=`: trả `{ items, nextCursor, hasMore }`.
- `GET /api/activity-logs/summary?actor=&from=&to=`: trả KPI đã nhóm theo actor, gồm tổng thao tác, phiếu tạo, mẫu/KQTN xử lý, biên bản tạo, công việc và hoạt động gần nhất; các đối tượng được đếm distinct theo `entityId`.
- `POST /api/activity-logs`: append một log đã chuẩn hóa sau mutation thành công.
- `limit` mặc định 50, giới hạn tối đa 100.
- `cursor` dựa trên cặp sắp xếp ổn định `createdAt DESC, id DESC`, tránh trùng/mất dòng khi có nhiều bản ghi cùng thời điểm.
- `from`/`to` lọc theo thời gian; `actor`, `action`, `entityType` lọc chính xác; `search` tìm trong summary và các định danh hiển thị.
- Kết quả luôn sắp xếp mới nhất trước; API không cung cấp endpoint xóa/sửa activity log cho UI.
- Truy vấn dùng collection `activityLogs` trong `app_documents`, tận dụng index collection/thời gian hiện có và bổ sung index phù hợp nếu kiểm thử dữ liệu lớn cho thấy cần thiết.

Trong phiên bản hiện tại, quyền điều hướng và hiển thị được chặn tại app shell theo trạng thái đã đăng nhập. Activity log là trang chỉ đọc cho mọi tài khoản; API không cung cấp endpoint sửa/xóa log cho người dùng. Khi có lớp xác thực server-side đầy đủ, route phải yêu cầu phiên đăng nhập hợp lệ và vẫn giữ hợp đồng append-only.

## Thiết kế giao diện

### Điều hướng

- Sidebar thêm mục `Nhật ký hệ thống`, icon lịch sử phù hợp, đặt ngay trước `Thiết lập`.
- `activeTab` mới là `activity_log`.
- Mọi tài khoản đã đăng nhập đều thấy mục và có thể truy cập tab; người chưa đăng nhập không được render app shell và phải đi qua luồng đăng nhập.

### Nội dung trang

- Header: `Nhật ký hệ thống`, mô tả ngắn về lịch sử thao tác toàn hệ thống.
- Thanh lọc gồm tìm kiếm, kỳ thống kê `Ngày/Tuần/Tháng/Năm` mặc định `Tháng`, người thực hiện, loại đối tượng và hành động; có nút xóa bộ lọc. Client quy đổi kỳ đã chọn thành biên `from/to` GMT+7 khi gọi API.
- Chọn người dùng dùng checkbox/dropdown đa lựa chọn từ `systemUsers`, có tìm kiếm, chọn tất cả và bỏ chọn tất cả; chỉ người được chọn mới xuất hiện trên KPI chart.
- Mọi thời gian trên trang và điều kiện ngày dùng `Asia/Ho_Chi_Minh` (GMT+7) cố định.
- KPI trực quan dùng biểu đồ thanh ngang so sánh nhân viên và biểu đồ tròn hiển thị cơ cấu hoạt động của nhân viên đang chọn; biểu đồ có vùng cuộn khi chọn nhiều người.
- Bảng desktop gồm: thời gian, người thực hiện, hành động, đối tượng, mô tả.
- Mobile chuyển thành card hoặc bảng cuộn ngang, không ép chữ nhỏ gây tràn layout.
- Click một dòng mở panel/row detail hiển thị định danh, nguồn thao tác và danh sách before/after.
- Có trạng thái loading, empty, lỗi tải và nút tải thêm/phân trang rõ ràng.
- Có nút xuất CSV theo đúng bộ lọc hiện tại; export dùng dữ liệu các trang đã truy vấn hoặc endpoint export riêng nếu cần dữ liệu đầy đủ, không âm thầm tải toàn bộ collection vào Zustand.
- Không có nút sửa/xóa lịch sử.

### Điều hướng ngược về nghiệp vụ

Nếu dòng log có `entityType` và định danh đủ tin cậy, chi tiết có thể mở đúng module tương ứng: Phiếu YC, Giao nhận, KQTN hoặc Lịch. Nếu đối tượng đã bị xóa, vẫn hiển thị log và thông báo rằng bản ghi gốc không còn tồn tại.

## Sao lưu, khôi phục và lưu giữ

- `activityLogs` là collection dữ liệu chính và phải được đưa vào gói backup đầy đủ để không mất lịch sử khi restore.
- Restore không được xóa hoặc ghi đè activity log hiện có theo cách làm mất lịch sử; implementation cần dùng chiến lược merge theo `id` hoặc ghi một log `RESTORED` tổng hợp cho chính thao tác restore.
- Không xóa lịch sử khi người dùng bấm xóa toàn bộ notification.
- Không đặt giới hạn 50 bản ghi cho activity log; 50 là page size mặc định của giao diện.
- Giai đoạn đầu giữ toàn bộ lịch sử trong PostgreSQL. Chính sách archive/retention tự động chỉ được bổ sung sau khi có quyết định nghiệp vụ riêng, vì xóa audit log là hành động có tác động tuân thủ.

## Tiêu chí nghiệm thu

- Admin/Quản lý nhìn thấy mục `Nhật ký hệ thống` ngay trước `Thiết lập`; tester/viewer/guest không nhìn thấy.
- Tạo/sửa/xóa phiếu, biên bản; cập nhật KQTN; xếp/gỡ/chuyển lịch; đổi trạng thái; phân công; quản trị người dùng và danh mục đều tạo activity log sau thao tác thành công.
- Thay đổi nhỏ vẫn có activity log nhưng không tạo notification mới nếu không thuộc nhóm thay đổi lớn.
- Log hiển thị đúng actor snapshot, thời gian, hành động, loại đối tượng, định danh và summary; diff before/after không làm lộ bí mật.
- Bộ lọc người thực hiện, hành động, loại đối tượng, kỳ thống kê và từ khóa hoạt động độc lập và kết hợp được.
- Có thể chọn nhiều người dùng; biểu đồ thanh chỉ so sánh người đã chọn, biểu đồ tròn đổi theo nhân viên đang xem và KPI không đếm trùng cùng một entity.
- Thời gian hiển thị nhất quán GMT+7 trên các máy có timezone khác nhau.
- Phân trang ổn định, không tải toàn bộ lịch sử vào Zustand, không lặp/mất dòng khi chuyển trang.
- Refresh trang vẫn đọc được lịch sử từ PostgreSQL; xóa notification không ảnh hưởng activity log.
- Không có thao tác UI để sửa/xóa log; log cũ vẫn tồn tại sau khi đối tượng nghiệp vụ bị xóa.
- Backup/restore giữ collection `activityLogs` và không làm mất lịch sử hiện có.
- Test bao phủ helper tạo log, policy phân quyền, diff chuẩn hóa, filter/pagination contract, navigation và backup/restore.

## Rủi ro và quyết định để theo dõi

- Vì ứng dụng hiện đang kiểm tra đăng nhập/chức danh ở client shell, kiểm soát truy cập API chưa phải mô hình server-side hoàn chỉnh. Implementation phải giữ cùng policy UI hiện có và ghi rõ đây là giới hạn kiến trúc; không tự tạo hệ thống auth mới trong phạm vi trang này.
- JSONB trong `app_documents` phù hợp giai đoạn đầu và giữ đúng kiến trúc Option 1. Nếu lưu lượng log lớn hoặc cần compliance chặt, có thể chuyển sang bảng audit riêng ở một phase sau mà không thay đổi hợp đồng `ActivityLog` và UI.

<!-- --- End of 2026-08-18-system-activity-log-design.md --- -->
