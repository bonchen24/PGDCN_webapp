<!--
Author: Gemini
OS support: Web/Node
Description: Đặc tả compact density toàn hệ thống và hoàn thiện các điểm còn thiếu trong app shell
-->

# Compact UI & Feature Completion Design

## Mục tiêu

Thu gọn giao diện DDT Lab trên toàn bộ app shell và các màn hình nghiệp vụ chính để tăng lượng thông tin hiển thị, giảm gap/padding/font dư thừa nhưng vẫn giữ khả năng đọc và thao tác trên desktop/mobile. Đợt này cũng hoàn thiện các điểm còn thiếu trong shell, trước mắt là tiêu đề Header cho trang Nhật ký hệ thống và các hợp đồng hồi quy liên quan.

## Phạm vi

- Áp dụng một scope CSS `ddt-compact` cho app sau đăng nhập.
- Thu gọn header, sidebar, toolbar, card, filter và vùng nội dung của Dashboard, Phiếu YC, Giao nhận, Lịch, KQTN, Báo cáo, Nhật ký và Thiết lập.
- Giữ vùng thao tác cảm ứng mobile tối thiểu khoảng 44px.
- Giữ nguyên font/layout riêng của `.report-form-compact`, canvas xem trước, nội dung in và file DOCX/PDF.
- Bổ sung nhãn Header cho `activity_log` và giữ aria/title của các control icon-only.
- Không thay đổi schema, API, dữ liệu, quyền nghiệp vụ, điều hướng nghiệp vụ hoặc format xuất báo cáo.

## Thiết kế density

`#root` vẫn giữ `zoom: 1`. App shell sau đăng nhập nhận class `ddt-compact`; LoginScreen không nằm trong scope này.

CSS compact dùng selector theo token utility để giảm dần các nhóm sau:

| Nhóm | Quy tắc compact |
|---|---|
| Nền app | Giữ canvas `bg-slate-50`, giảm padding trang desktop từ 24px về khoảng 16px |
| Khoảng cách | `gap-3/4/6/8`, `space-y-3/4/6` và padding `p-3/4/6/8` giảm một bậc |
| Typography | `text-xs/sm/base/lg/xl` giảm nhẹ về khoảng 11/12/13/15/17px |
| Header/sidebar | Header 52px, sidebar padding/nav spacing gọn hơn |
| Control | Chiều cao thị giác khoảng 30–32px trên desktop; mobile giữ touch target |
| Ngoại lệ | `.report-form-compact`, vùng in/preview và lớp mobile touch không bị ép nhỏ thêm |

Không dùng `transform: scale()` hoặc `zoom` để tránh làm sai hitbox, layout viewport và popup date picker.

## Hoàn thiện tính năng trong đợt này

1. Header hiển thị đúng tiêu đề `Nhật ký hệ thống` khi `activeTab === 'activity_log'`.
2. Chuông notifications tiếp tục hiển thị cho mọi tài khoản đăng nhập; audience filtering và target username giữ nguyên.
3. Nhật ký tiếp tục có filter người dùng, KPI, GMT+7, phân trang, chi tiết và export CSV; compact chỉ thay đổi trình bày.
4. Các màn hình nghiệp vụ hiện có tiếp tục dùng đúng handler tạo/sửa/xóa, xếp lịch, cập nhật KQTN, giao việc và đổi trạng thái; không mở rộng scope sang nghiệp vụ mới chưa có đặc tả.

## Kiểm thử nghiệm thu

- Test CSS xác nhận `ddt-compact` và các token density tồn tại, đồng thời không có global zoom khác 1.
- Test App xác nhận root sau đăng nhập có class compact và Header có nhãn Nhật ký.
- Test report typography xác nhận scope form compact vẫn tồn tại sau khi thêm global density.
- Chạy toàn bộ `npm test`, `npm run lint`, `npm run build`; nếu Docker đang chạy thì rebuild và smoke test health/API.

<!-- --- End of 2026-08-18-compact-ui-completion-design.md --- -->
