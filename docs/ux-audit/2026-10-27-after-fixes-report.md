# Báo cáo Nghiệm thu Hoàn thiện UI/UX PGDCN Sau Sửa Lỗi (F1–F5) — 2026-10-27

## 1. Tổng quan Nghiệm thu

- **Phương pháp kiểm thử**: Chạy Chromium Playwright tự động trên server QA loopback độc lập (`127.0.0.1:2367`).
- **An toàn & Cách ly**:
  - Không động chạm hay kết nối database thật / container Docker production (`localhost:2357`).
  - Mọi request API đều được mock/route synthetic trong context của Playwright.
  - Metrics ghi nhận: **0 mutations**, **0 external leaks**, **0 page errors**.
- **Kích thước kiểm thử**: 7 viewport gồm `320×800`, `375×812`, `390×844`, `430×932`, `768×1024`, `1280×900`, `1440×1000`.
- **Tổng số ảnh chụp nghiệm thu**: 35 ảnh Playwright sau fix (lưu tại `docs/ux-audit/artifacts/after-fixes/`).
- **Kết quả Unit & Integration Test**: 962/962 pass (3 skipped theo thiết kế).
- **TypeScript**: 0 lỗi (`npm run typecheck` clean).
- **Production Build**: Thành công (`next build --webpack`), 42 static pages + dynamic routes.

---

## 2. Chi tiết Kết quả Nghiệm thu Từng Finding (F1 – F5)

### F1 (P2): Đóng panel thông báo khi chuyển mục / route
- **Vấn đề ban đầu**: Mở chuông thông báo ở một màn hình, sau đó chuyển mục (hoặc route) thì popup thông báo vẫn giữ nguyên che khuất nội dung trang đích.
- **Giải pháp triển khai**:
  - Thêm xử lý tự động đóng popup thông báo khi section hoặc route thay đổi trong [PgdcnAppShell.tsx](file:///E:/CODING/PGDCN_webapp/components/PgdcnAppShell.tsx) và [PgdcnNotificationDropdown.tsx](file:///E:/CODING/PGDCN_webapp/components/PgdcnNotificationDropdown.tsx).
  - Đồng bộ `aria-expanded="false"` trên nút chuông và đảm bảo focus trả về hợp lệ.
- **Bằng chứng kiểm chứng**:
  - Playwright test: [test/pgdcn-notification-navigation.playwright.test.mjs](file:///E:/CODING/PGDCN_webapp/test/pgdcn-notification-navigation.playwright.test.mjs) PASS.
  - DOM measurement: `isDialogVisible = false`, `dialogCount = 0`, `bellExpanded = "false"`, `hasHorizontalOverflow = false`.
  - Ảnh minh chứng: `docs/ux-audit/artifacts/after-fixes/f1/390x844.png`, `docs/ux-audit/artifacts/after-fixes/f1/1440x1000.png`.

### F2 (P2): Chuẩn hóa preview nhập Excel thành Accessible Dialog
- **Vấn đề ban đầu**: Hộp thoại preview nhập khách hàng từ Excel không có ngữ nghĩa dialog (`role="dialog"`, `aria-modal`), không có focus trap, không hỗ trợ phím Escape.
- **Giải pháp triển khai**:
  - Cập nhật [PcnCustomersManagementView.tsx](file:///E:/CODING/PGDCN_webapp/components/PcnCustomersManagementView.tsx) với `role="dialog"`, `aria-modal="true"`, `aria-labelledby="pcn-customer-import-preview-title"`.
  - Bổ sung focus trap (Tab / Shift+Tab xoay vòng bên trong modal) và phím Escape đóng dialog an toàn kèm khôi phục focus về nút mở.
- **Bằng chứng kiểm chứng**:
  - Playwright test: [test/pcn-customer-import-preview.playwright.test.mjs](file:///E:/CODING/PGDCN_webapp/test/pcn-customer-import-preview.playwright.test.mjs) PASS.
  - DOM measurement: `role = "dialog"`, `ariaModal = "true"`, `focusInDialog = true`, focus trap shift+tab đảo ngược chính xác.
  - Ảnh minh chứng: `docs/ux-audit/artifacts/after-fixes/f2/390x844.png`, `docs/ux-audit/artifacts/after-fixes/f2/1440x1000.png`.

### F3 (P2): Bảo toàn hiển thị mã PYC/hồ sơ PGD trên màn hình hẹp
- **Vấn đề ban đầu**: Mã hồ sơ `PGD-DEMO-001` bị bẻ dòng từng ký tự tại các độ rộng màn hình nhỏ (320px, 375px, 390px, 430px).
- **Giải pháp triển khai**:
  - Cập nhật [PgdDossierQueueView.tsx](file:///E:/CODING/PGDCN_webapp/components/PgdDossierQueueView.tsx) với `whitespace-nowrap font-mono` và cấu trúc flex bố cục thông minh; đảm bảo nút CTA có `min-h-[44px]`.
- **Bằng chứng kiểm chứng**:
  - Playwright test: [test/pgd-dossier-queue-code.playwright.test.mjs](file:///E:/CODING/PGDCN_webapp/test/pgd-dossier-queue-code.playwright.test.mjs) PASS.
  - DOM measurement: `lineCount = 1` trên toàn bộ 320, 375, 390, 430 px; `cta.height >= 44px`; `hasHorizontalOverflow = false`.
  - Ảnh minh chứng: `docs/ux-audit/artifacts/after-fixes/f3/320x800.png`, `docs/ux-audit/artifacts/after-fixes/f3/390x844.png`.

### F4 (P2): Điều hướng Sổ dữ liệu PCN bảo toàn section & history
- **Vấn đề ban đầu**: Từ trang chi tiết hồ sơ PCN, bấm vào "Sổ dữ liệu PCN" lại nhảy về "Quản lý Đề nghị" thay vì "Sổ tổng hợp PCN".
- **Giải pháp triển khai**:
  - Cập nhật [app/pgdcn/pcn/page.tsx](file:///E:/CODING/PGDCN_webapp/app/pgdcn/pcn/page.tsx) tiếp nhận query param `section=operations`.
  - Cập nhật [PgdcnAppShell.tsx](file:///E:/CODING/PGDCN_webapp/components/PgdcnAppShell.tsx) sử dụng `router.push('/pgdcn/pcn?section=operations')` khi người dùng bấm vào Sổ dữ liệu từ chi tiết hồ sơ, đồng thời giữ nguyên browser back/forward history.
- **Bằng chứng kiểm chứng**:
  - Playwright test: [test/pcn-register-navigation-history.playwright.test.mjs](file:///E:/CODING/PGDCN_webapp/test/pcn-register-navigation-history.playwright.test.mjs) PASS.
  - DOM measurement: Đích đến chính xác là "Sổ tổng hợp PCN", `selectedSection = operations`, back/forward giữ đúng trạng thái.
  - Ảnh minh chứng: `docs/ux-audit/artifacts/after-fixes/f4/1280x900.png`, `docs/ux-audit/artifacts/after-fixes/f4/1440x1000.png`.

### F5 (P3): Tối ưu danh sách biểu mẫu DOCX PCN trên mobile
- **Vấn đề ban đầu**: Danh sách biểu mẫu DOCX hiển thị dạng bảng bị ép hẹp trên mobile, mã và tiêu đề bị wrap ngẫu nhiên khó đọc và khó quét.
- **Giải pháp triển khai**:
  - Cập nhật [PgdcnUnifiedDraftingView.tsx](file:///E:/CODING/PGDCN_webapp/components/PgdcnUnifiedDraftingView.tsx) chia tách 2 giao diện:
    - Mobile (< 1024px): Dạng danh sách thẻ (Card view) rõ ràng, đầy đủ mã, tên, phiên bản, tag trạng thái và nút hành động touch target >= 44px.
    - Desktop (>= 1024px): Dạng bảng so sánh đầy đủ, trực quan.
- **Bằng chứng kiểm chứng**:
  - Playwright test: [test/pcn-docx-template-mobile.playwright.test.mjs](file:///E:/CODING/PGDCN_webapp/test/pcn-docx-template-mobile.playwright.test.mjs) PASS.
  - DOM measurement: `hasCode=true`, `hasName=true`, `actionHeight >= 44px` trên mobile, `hasPageHorizontalOverflow = false`, `listHasHorizontalScroll = false`.
  - Ảnh minh chứng: `docs/ux-audit/artifacts/after-fixes/f5/320x800.png`, `docs/ux-audit/artifacts/after-fixes/f5/390x844.png`, `docs/ux-audit/artifacts/after-fixes/f5/1440x1000.png`.

---

## 3. Tổng kết Cổng Kiểm soát (Gate Verification)

| Hạng mục kiểm tra | Kết quả | Chi tiết |
|---|---|---|
| Số lượng finding đã fix | 5/5 (100%) | F1, F2, F3, F4, F5 hoàn thành dứt điểm |
| Số lượng finding còn tồn đọng | 0 | Không còn issue tồn đọng thuộc phạm vi |
| Playwright Regression Suites | 5/5 suites PASS | 100% pass tự động |
| Unit/Integration Suites | 962/962 PASS | 0 fail, 3 skip theo thiết kế |
| TypeScript check | CLEAN | `npm run typecheck` 0 error |
| Production Build | SUCCESS | `next build --webpack` hoàn tất |
| Docker Desktop Production | UNTOUCHED | Port 2357 không bị ảnh hưởng |
| Cập nhật thiết kế SSOT | HOÀN TẤT | `design.md` đã bổ sung section 5A.42 |
