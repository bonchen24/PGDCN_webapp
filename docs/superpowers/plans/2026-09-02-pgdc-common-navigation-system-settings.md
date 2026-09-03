# Kế hoạch triển khai điều hướng dùng chung PGDCN và Cài đặt hệ thống

## Mục tiêu

Tổ chức lại shell `/pgdcn/` để Dashboard phòng, Khách hàng và Cài đặt hệ thống là nhánh dùng chung; giữ PCN và PGD là hai miền nghiệp vụ tách biệt; đưa quản trị nhân sự/tài khoản vào Cài đặt hệ thống; giảm gap/spacing sidebar. Admin hoặc Quản lý được gán trực tiếp phòng ban/phạm vi và chức vụ cho từng tài khoản. Không tạo danh mục phòng ban/chức vụ riêng, không import dữ liệu lịch sử và không đọc thư mục PGD/NAS/Desktop lúc runtime.

## Thiết kế đã được duyệt

- Nhánh dùng chung: Tổng quan phòng, Khách hàng, Trợ lý AI, Nhật ký hoạt động, Cài đặt hệ thống.
- Nhánh PCN: Đề nghị, Sổ điều hành, PYC & luân chuyển mẫu, Soạn thảo tài liệu.
- Nhánh PGD: Tiếp nhận PYC, Hồ sơ đang xử lý, Hiện trường & Lấy mẫu, PTN & Bàn giao mẫu, Báo cáo & Chứng thư, Template & Cell PGD.
- QC20 giữ mã PCN và không xuất hiện trong catalog/điều hướng PGD.
- Cài đặt hệ thống có bề mặt Nhân sự & tài khoản dùng chung. `departmentScopes`, `departmentRoleCode`, `pgdRole`, `fieldCodes`, `position`, trạng thái và reset mật khẩu được thao tác trên từng tài khoản; không có CRUD danh mục phòng ban/chức vụ.
- Quyền quản trị nhân sự: `systemRole=admin`, `departmentRoleCode=LEADERSHIP` hoặc `pgdRole=PGD_MANAGER`. Kiểm tra đồng thời ở UI, Zustand và server; password không trả về client.
- Shared customer view đọc projection hợp nhất từ các store đã được cấp scope; thao tác sửa/xóa chỉ xuất hiện khi actor có quyền mutation tương ứng.
- Sidebar desktop dùng nhịp compact `space-y-0.5`, item khoảng `min-h-9`, `gap-2`, `px-2`/`px-2.5`; mobile vẫn giữ touch target tối thiểu khoảng 44px.

## Trình tự thực hiện

- [ ] Xác nhận hiện trạng navigation, shell, store/API khách hàng và user management; không đụng thư mục nguồn tham chiếu.
- [ ] Cập nhật `design.md` như SSoT cho nhánh chung, quyền Admin/Quản lý, không có catalog phòng ban/chức vụ và compact sidebar.
- [ ] Viết/cập nhật contract tests cho thứ tự shared navigation, loại bỏ duplicate domain menu, system settings personnel fields/permission và spacing; chạy RED trước implementation.
- [ ] Mở rộng `utils/pgdcnNavigation.ts` và `components/PgdcnSidebar.tsx` với shared `customers`/`system-settings`; giữ domain type tương thích nhưng không render dashboard/customers/users/settings trong domain menu.
- [ ] Tạo view dùng chung cho Khách hàng, cho phép PCN mutation theo policy và PGD-only projection read-only khi không có PCN scope; không để QC20 lọt vào PGD.
- [ ] Tạo `PgdcnSystemSettingsView` làm shell quản trị chung; đưa `PcnUserManagementView` vào tab Nhân sự & tài khoản, đổi nhãn/contract sang PGDCN và truyền system users hợp nhất.
- [ ] Cho phép Admin/Quản lý sửa phân công phòng ban/chức vụ và reset password ở UI/store/server; không hiển thị password hoặc danh mục phòng ban/chức vụ riêng.
- [ ] Đưa cấu hình PCN hiện có vào vùng cấu hình phù hợp bên trong system settings mà vẫn giữ boundary PCN; Template & Cell PGD tiếp tục ở nhánh PGD.
- [ ] Điều chỉnh `PgdcnAppShell` routing và compatibility fallback; không trộn collection/lifecycle PCN với PGD.
- [ ] Chạy targeted tests, toàn bộ test, typecheck, lint, build; kiểm tra route `/pgdcn/`, `/pgdcn/pcn`, `/pgdcn/pgd` và Docker production.
- [ ] Cập nhật memory/Obsidian về kiến trúc điều hướng và quyền nhân sự sau khi có bằng chứng build/test.

## Kiểm chứng nghiệm thu

- Shared navigation có đủ 5 entry và không có duplicate customers/dashboard/users/settings trong menu domain.
- User form có phòng ban/phạm vi và chức vụ trực tiếp; Admin/Quản lý thao tác được, staff thường bị chặn; server không nhận password trong response.
- PGD không thấy QC20 trong catalog; PCN vẫn giữ route QC20.
- Không có code đọc `TVCI_NAS`, Desktop hoặc import hồ sơ lịch sử lúc runtime.
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build` và Docker health/route smoke pass.
