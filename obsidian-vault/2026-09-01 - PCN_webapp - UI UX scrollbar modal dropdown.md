<!--
Author: Codex
OS support: Windows / Node
Description: PCN UI/UX completion note for scrollable surfaces, modal bodies and catalog dropdowns
-->

# PCN_webapp — Hoàn thiện UI/UX scrollbar, modal và dropdown — 2026-09-01

## Kết luận

Đã rà soát và hoàn thiện contract UI/UX PCN cho các trang, modal và trường chọn thông lệ. `design.md` vẫn là nguồn chuẩn duy nhất; note này chỉ là nhật ký tham chiếu, không thay thế spec.

## Thay đổi chính

- Shell `PcnWorkspace` giữ scroll dọc cấp trang tại `main`; bảng, workflow và dữ liệu rộng dùng scroll ngang riêng khi cần.
- Scrollbar PCN dùng token chung, thumb/track mảnh, đủ tương phản và `scrollbar-gutter: stable`.
- Modal dùng panel giới hạn theo `dvh`, `min-h-0`, header/footer cố định và body `mobile-scroll-y`. Đã sửa nhánh read-only của `PcnApprovalModal` và modal tạo ủy quyền của `PcnSignerDelegationPanel`.
- Khách hàng dùng `PcnCatalogCombobox` có tìm kiếm, ARIA, keyboard navigation, touch target và popup scrollable; không tạo option mới tự do.
- Phòng thử nghiệm nhận dùng native select từ `PCN_SAMPLE_LAB_OPTIONS`, có placeholder và cảnh báo giá trị legacy chưa khớp catalog.
- Không dùng `datalist` cho dropdown PCN; trường enum/catalog hữu hạn dùng native select, catalog dài dùng combobox, multi-select dùng checkbox/chip group.
- Catalog dài hỗ trợ tìm kiếm nhiều từ khóa tiếng Việt không dấu (không phân biệt hoa thường và `Đ/đ`), trong khi nhãn kết quả vẫn hiển thị nguyên bản có dấu. Logic dùng chung nằm ở `utils/pcnSearch.ts` và `PcnCatalogCombobox`.

## Verification

- UI contract: `test/pcn-ui-contract.test.ts` — **28/28 pass**.
- Search behavior: `test/pcn-search.test.ts` — **3/3 pass**.
- PCN regression: **617/617 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass; cảnh báo còn lại chỉ là line-ending trên Windows.
- Browser smoke test: `http://127.0.0.1:1357/` tại viewport desktop không có overflow toàn trang. Chưa nhập credential nên chưa thao tác modal sau đăng nhập.
- Docker production đã rebuild/recreate image `pcn_webapp-webapp:latest`; container `pcn_webapp-webapp-1` đang chạy trên cổng `2357`. `/api/health` và `/` trả HTTP 200; `/api/db/health` trả 401 đúng vì endpoint yêu cầu session.

## Files/commits tham chiếu

- Chuẩn: `design.md` §5.3.
- UI: `index.css`, `components/PcnCatalogCombobox.tsx`, `components/PcnApprovalModal.tsx`, `components/PcnSignerDelegationPanel.tsx`, `components/PcnWorkspace.tsx`, `components/PcnLabRequestView.tsx`.
- Tests: `test/pcn-ui-contract.test.ts`.
- Commits: `97a3431`, `a605f25`, `7ba92a6`, `fe3e5cd`.

Không lưu secret, credential, raw payload hoặc file hồ sơ thật vào Memory/Obsidian.
