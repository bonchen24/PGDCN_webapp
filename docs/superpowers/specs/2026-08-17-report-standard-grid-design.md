<!--
Author: Gemini
OS support: Web/Node
Description: Đặc tả thiết kế cho grid compact chọn chuẩn trong trang Lập báo cáo
-->

# Đặc tả thiết kế: Grid compact trang Lập báo cáo

## Mục tiêu

Thu gọn khu vực chọn chuẩn báo cáo để 17 module nằm gọn trong một viewport desktop thông dụng mà không thay đổi nghiệp vụ tạo báo cáo.

## Phạm vi

- Có trong phạm vi:
  - Giữ nguyên block grid trong `ReportGeneratorView.tsx`.
  - Giữ nguyên nguồn dữ liệu `STANDARDS` từ `lib/standards.ts`.
  - Giữ nguyên các lựa chọn đặc biệt theo từng module và callback chọn chuẩn.
  - Thu gọn kích thước card, icon, khoảng đệm và số cột theo breakpoint.
  - Bổ sung regression test cho các class layout compact.
- Không nằm trong phạm vi:
  - Tách sâu phần form nhập liệu, OCR, lưu báo cáo hoặc xuất DOCX.
  - Thay đổi schema, state nghiệp vụ, API hoặc nội dung của các chuẩn.
  - Thay đổi layout phần form sau khi người dùng đã chọn chuẩn.

## Kiến trúc và hành vi giữ nguyên

Grid tiếp tục được render trực tiếp trong `ReportGeneratorView.tsx`, sử dụng `STANDARDS.map`, state `expandedStandardId` và các callback hiện có. Chỉ thay đổi utility classes của vùng dashboard, card, icon và label.

Các nhóm lựa chọn phải giữ đúng hành vi hiện tại:

- Module mở trực tiếp: `emc_dung_cu_dien_dun_nuoc_nong`, `emc_tu_lanh`, `emc_may_say_toc`, `emc_may_khoan` chọn `full` ngay khi bấm card.
- `emc_bep_dien` và `emc_dieu_hoa` hiển thị danh sách biến thể hiện có.
- `emc_may_giat` hiển thị “Có sấy”/“Không sấy”.
- `emc_may_hut_bui` và `emc_may_xay` hiển thị “Dùng tay giả”/“Không dùng tay giả”.
- Các module còn lại hiển thị “Đầy đủ”/“Giảm thiểu”.

## Thiết kế responsive

- Grid dùng số cột tăng dần theo breakpoint, hướng tới 7–8 cột trên desktop rộng.
- Card dùng chiều cao tối thiểu compact khoảng `88–112px`, icon khoảng `24–28px`, typography tên chuẩn khoảng `9–10px` tùy breakpoint.
- Giảm padding ngoài và bỏ khoảng đệm đáy dư thừa của dashboard; vẫn giữ khoảng cách đủ lớn để card không dính nhau.
- Trên màn hình hẹp vẫn giữ vùng bấm đủ dùng và cho phép grid cuộn nếu chiều cao thiết bị không đủ; mục tiêu “một trang” ưu tiên desktop nơi người dùng lập báo cáo.
- Overlay lựa chọn biến thể vẫn nằm trong card, có nút đóng và vùng cuộn nội bộ khi danh sách biến thể dài.

## Luồng dữ liệu

```text
STANDARDS.map
  -> inline report standard card
     -> onClick / option button
        -> ReportGeneratorView.handleSelectStandard
           -> render form báo cáo hiện có
```

`ReportGeneratorView` tiếp tục là nơi duy nhất khởi tạo kết quả clause, cập nhật `selectedStandard`, `criteriaType` và `subOptionTitle`.

## Kiểm thử và xác minh

- Regression test kiểm tra source giữ các class compact của grid, card, icon và label.
- Chạy toàn bộ test hiện có, `npm run lint` và `npm run build`.
- Kiểm tra diff để bảo đảm chỉ thay đổi phần grid/module và tài liệu liên quan.

## Ràng buộc tuân thủ

- Component mới phải có header/footer theo `AGENTS.md`.
- Không thay đổi `.env`.
- Không thay đổi schema hoặc API.
- Không thêm dependency mới.

<!-- --- End of 2026-08-17-report-standard-grid-design.md --- -->
