<!--
Author: Gemini
OS support: Web/Node
Description: Thiết kế loại bỏ tên hiển thị cá nhân và tách preload CSV khỏi đồng bộ PostgreSQL
-->

# User Settings and CSV Runtime Boundary Design

## Mục tiêu

- Loại bỏ thiết lập tên hiển thị trong Cài đặt cá nhân.
- Khẳng định `systemUsers` trong Thiết lập hệ thống dùng dữ liệu từ PostgreSQL.
- Chỉ preload các CSV danh mục một lần lúc app khởi tạo và không tự động ghi dữ liệu CSV vào DB trong các chu kỳ đồng bộ.

## Quyết định thiết kế

### Danh tính người dùng

`UserPreferences` không còn cung cấp giao diện hoặc luồng cập nhật `displayName`. Tên phiên đăng nhập luôn lấy từ bản ghi `systemUsers` hoặc tài khoản dự phòng `admin`. Dữ liệu `displayName` cũ có thể còn trong JSONB để tương thích khôi phục, nhưng ứng dụng không đọc, ghi hoặc dùng trường đó.

### Danh sách người dùng hệ thống

`SystemSettingsView` tiếp tục render `useStore().systemUsers`. `syncTwoWay()` đọc collection `systemUsers` từ PostgreSQL, hợp nhất với state cục bộ theo `updatedAt`, áp dụng danh sách xóa và chỉ seed `PRESET_ACCOUNTS` vào DB khi không có dữ liệu người dùng nào. CSV không tham gia vào danh sách tài khoản.

### Danh mục CSV

App gọi một hàm preload có tính idempotent đúng một lần trong startup flow trước lần fetch dữ liệu đầu tiên. Hàm này đọc `brands.csv`, `products.csv` và `customers.csv` vào state cục bộ khi danh mục tương ứng chưa có dữ liệu. `syncTwoWay()` không gọi loader CSV và chỉ merge state cục bộ hiện có với các bản ghi DB.

Để tránh đẩy dữ liệu seed CSV nguyên trạng vào DB, sync chỉ đưa vào hàng đợi ghi các bản ghi danh mục mới hoặc đã thay đổi sau preload. Các thao tác CRUD danh mục hiện hành vẫn tạo ra thay đổi được ghi vào DB; xóa vẫn dùng danh sách xóa hiện có.

## Phạm vi thay đổi

- `design.md`: cập nhật nguồn dữ liệu người dùng, vòng đời CSV và hợp đồng `UserPreferences`.
- `components/UserSettingsModal.tsx`: bỏ state, input và payload `displayName`.
- `store.ts`: bỏ mọi đọc `displayName`, tách preload CSV khỏi `syncTwoWay()`, và ngăn ghi seed CSV chưa chỉnh sửa vào DB.
- `App.tsx`: gọi preload một lần trước lần đồng bộ khởi tạo.
- Test contract: kiểm tra payload cài đặt cá nhân không có `displayName`, loader CSV chỉ chạy một lần và seed CSV không nằm trong batch ghi DB.

## Xác minh

- Chạy test mục tiêu bằng `npm test -- <test-file>`.
- Chạy `npm run lint` và `npm run build`.
- Rà soát tìm kiếm tĩnh để đảm bảo `syncTwoWay()` không còn gọi `loadCSVFallback()` và luồng đăng nhập không còn dùng `userPreferences.displayName`.

<!-- --- End of 2026-08-18-user-settings-csv-runtime-boundary-design.md --- -->
