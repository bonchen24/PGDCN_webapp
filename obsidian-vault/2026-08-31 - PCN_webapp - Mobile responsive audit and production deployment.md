<!--
Author: Codex
OS support: Windows / Node / Docker Desktop
Description: Current PCN responsive audit, verification and deployment observation
-->

# PCN_webapp — Audit responsive mobile và deploy production — 2026-08-31

## Kết luận

Đợt audit mobile đã hoàn tất trong phạm vi CSS/class layout/breakpoint. Không thay đổi schema, API, dữ liệu hồ sơ, logic nghiệp vụ hoặc định dạng DOCX/PDF.

## Nguyên tắc UI đã ghi nhận

- App PCN dùng một scroll dọc cấp trang tại `PcnWorkspace` `main`; page root không tự tạo `h-full overflow-y-auto`.
- Mọi page root PCN dùng `pcn-page-surface min-w-0 min-h-full` theo contract mới trong `design.md` §5.3.
- `html/body` không cho tràn ngang toàn trang. `mobile-scroll-y` khóa tràn ngang dự phòng; workflow map, bảng cell mẫu và bảng dữ liệu rộng giữ `mobile-scroll-x` riêng.
- Bottom navigation có safe-area, có thể cuộn ngang ở viewport hẹp và mỗi mục giữ touch target khoảng 44px.
- Modal dùng khung tối đa theo `dvh`; header/footer `shrink-0`; vùng nội dung độc lập dùng `mobile-scroll-y`. Form nghiệp vụ giữ footer thao tác ngoài vùng cuộn.

## Khu vực đã chỉnh

- `index.css`: base width/overflow, `pcn-page-surface`, `pcn-mobile-nav`, contract `mobile-scroll-y`.
- `components/PcnWorkspace.tsx`: dashboard/Đề nghị không còn page scroll lồng; shell `main` là scroll owner; mobile nav có scroll ngang.
- Các workspace PCN: Pipeline, Work Queue, Sổ điều hành, PYC & luân chuyển mẫu, Soạn thảo, Cài đặt, Nhân sự, Khách hàng, Trợ lý, Phát hành, KQTN và bảng cell mẫu.
- Các modal: chi tiết Đề nghị, PYC, KQTN, giao nhận mẫu, sinh DOCX/PDF, template và form nghiệp vụ.
- `test/pcn-mobile-scroll.test.ts`: bổ sung contract cho base root, page surface, shell, bottom nav, page root và modal.

## Kiểm thử

- Responsive contract: **5/5 pass**.
- PCN suite: **540/540 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: exit 0; các cảnh báo còn lại là cảnh báo line-ending trên working tree Windows.
- Browser kiểm tra các viewport 320/375/390/430px trên native `http://localhost:1357` và production `http://localhost:2357`; `document/body scrollWidth` bằng đúng viewport width, không có tràn ngang. Chỉ kiểm tra shell màn hình đăng nhập, không nhập mật khẩu.

## Production observation

- Docker Desktop đã build image mới và recreate `pcn_webapp-webapp-1` thành công.
- Production vẫn publish cổng `2357`; native development vẫn theo cổng `1357`.
- `GET /api/health` production trả HTTP 200, body `{"status":"ok"}`.
- Rebuild dùng các biến môi trường đang chạy trong container hiện hữu; không ghi secret vào repo, không thay đổi `.env` và không tạo secret mới.

## Ghi chú tiếp theo

- Khi cần kiểm tra sâu các card hồ sơ/modal sau đăng nhập, mở app bằng tài khoản PCN hợp lệ và kiểm tra lại bốn viewport trên thiết bị thật hoặc emulation.
- Không đưa thư mục Desktop nghiên cứu, file hồ sơ thật, credential hoặc secret vào runtime/memory/Obsidian.
- Workspace vẫn có các thay đổi PCN lớn từ các lượt trước; không commit, không tạo branch mới và không reset các thay đổi đó trong đợt audit này.
