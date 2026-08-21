<!--
Author: Gemini
OS support: Web/Node
Description: Spec loại bỏ nút Cài webapp khỏi Header nhưng giữ nguyên PWA native
-->

# Spec: Remove Header Install Button

## Mục tiêu

Loại bỏ nút `Cài webapp` khỏi Header để giao diện gọn hơn. Thay đổi chỉ tác động phần UI hiển thị; không thay đổi đăng ký service worker hoặc luồng cài đặt native do trình duyệt cung cấp.

## Thiết kế

- Xóa JSX button cài webapp khỏi vùng Header trong `App.tsx`.
- Xóa import icon `Download` chỉ được dùng bởi button đó.
- Giữ nguyên các listener và handler PWA nền (`beforeinstallprompt`, `appinstalled`, trạng thái standalone) để không thay đổi tích hợp PWA.
- Không sửa dữ liệu, API, logic nghiệp vụ, điều hướng, modal, nội dung in hoặc xuất báo cáo.

## Kiểm thử

- Test PWA phải tiếp tục xác nhận các listener/biến PWA nền tồn tại.
- Test PWA phải xác nhận Header không còn title hoặc nhãn `Cài webapp` của button.
- Chạy `node --test test/pwa-installability.test.ts`, `npm run lint` và `npm run build`.

<!-- --- End of 2026-08-17-remove-header-install-button-design.md --- -->
