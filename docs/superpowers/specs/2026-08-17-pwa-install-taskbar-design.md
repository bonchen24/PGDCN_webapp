<!--
Author: Gemini
OS support: Web/Node
Description: Đặc tả cài đặt DDT Lab Web App và nhận diện icon trên taskbar
-->

# PWA Install & Taskbar Icon Design

## Mục tiêu

Cho phép Chrome nhận diện DDT Lab là một web app có thể cài đặt, hiển thị biểu tượng cài đặt trên thanh địa chỉ khi đủ điều kiện, cung cấp nút cài đặt dự phòng trong giao diện và dùng logo TVCI làm icon khi app được ghim lên taskbar.

## Phạm vi

- Chỉ thay đổi lớp PWA/nhận diện và thanh công cụ; không thay đổi schema, dữ liệu nghiệp vụ, quyền người dùng hoặc luồng đồng bộ.
- Giữ nguyên logo TVCI hiện có, chuyển sang PNG kích thước chuẩn để manifest có icon hợp lệ.
- Hỗ trợ Chrome/Edge trên desktop và luồng hướng dẫn thủ công cho trình duyệt không phát `beforeinstallprompt`.

## Kiến trúc

`public/manifest.json` là hợp đồng nhận diện ứng dụng. `public/icons/` chứa các bản PNG `192x192`, `512x512` và favicon nhỏ được tạo từ `public/tvci_logo.jpg`. `public/sw.js` tiếp tục cung cấp cache/offline fallback và được đăng ký đúng một lần từ entry HTML.

`App.tsx` quản lý trạng thái cài đặt ở lớp UI: lưu `BeforeInstallPromptEvent`, hiển thị nút cài khi app đang ở browser mode, gọi prompt theo thao tác người dùng và hiển thị hướng dẫn khi prompt không khả dụng. Các lỗi PWA chỉ được ghi nhận hoặc thông báo nhẹ, không throw làm hỏng app.

## Luồng người dùng

1. Người dùng mở app trên `localhost` hoặc HTTPS trong Chrome/Edge.
2. Browser đọc manifest, service worker và các icon hợp lệ; nếu đủ điều kiện, biểu tượng cài đặt xuất hiện trên thanh địa chỉ.
3. Khi `beforeinstallprompt` phát ra, thanh công cụ nội bộ hiển thị `Cài webapp`.
4. Người dùng chọn nút này, browser mở hộp thoại cài đặt. Khi `accepted`, nút được ẩn và trạng thái prompt được giải phóng.
5. Nếu không có prompt, nút mở thông báo hướng dẫn dùng icon cài đặt trên thanh địa chỉ hoặc menu “Thêm vào màn hình chính”.
6. Khi app chạy với `display-mode: standalone`, nút không hiển thị vì app đã được cài.

## Hợp đồng manifest và icon

Manifest dùng `id: "/"`, `scope: "/"`, `start_url: "/"`, `display: "standalone"`, `orientation: "landscape"`, tên hiển thị `PTN Điện - Điện tử` và theme xanh TVCI. Hai icon chính phải có `sizes` tương ứng, MIME `image/png`, đường dẫn tuyệt đối từ root và `purpose: "any maskable"`.

## Xử lý lỗi và tương thích

- Không unregister service worker hoặc xóa cache trong quá trình khởi động.
- `navigator.serviceWorker.register('/sw.js')` được gọi có kiểm tra feature detection và `.catch()` không chặn render React.
- Thiếu `beforeinstallprompt` không được xem là lỗi runtime; đây là trạng thái bình thường trên iOS, trình duyệt chưa đủ điều kiện hoặc app đã cài.
- Không thay đổi API server hoặc dữ liệu PostgreSQL.

## Kiểm thử và tiêu chí nghiệm thu

- Test contract xác nhận manifest parse được, có `id`, `scope`, `start_url`, `display`, icon PNG 192/512 và khai báo `maskable`.
- Test contract xác nhận entry HTML đăng ký `/sw.js` và không còn lệnh unregister/xóa cache.
- Test contract xác nhận source UI có fallback khi `deferredPrompt` không tồn tại và ẩn nút khi standalone.
- `npm test`, `npm run lint` và `npm run build` phải hoàn tất không lỗi.
- Kiểm tra thủ công trên Chrome tại localhost: biểu tượng cài đặt xuất hiện trong thanh địa chỉ; sau khi cài, shortcut/taskbar hiển thị logo TVCI và mở app ở chế độ standalone.

<!-- --- End of 2026-08-17-pwa-install-taskbar-design.md --- -->
