# Kế hoạch: PGD dùng pattern hồ sơ PCN mới

## Mục tiêu

Đưa PGD về cùng pattern điều hướng mới của PCN nhưng giữ nguyên nghiệp vụ PGD: sidebar chỉ còn các trang quản lý độc lập; các trạm xử lý nằm trong workspace hồ sơ toàn màn hình với stepper ngang.

## Phạm vi triển khai

1. Cập nhật `design.md` để xác nhận sidebar PGD gồm `Hồ sơ PYC`, `Sổ điều hành PGD`, `Soạn thảo tài liệu`; các trạm PGD không còn là mục sidebar.
2. Tạo contract test trước cho sidebar và dossier focus shell.
3. Cập nhật `PgdSidebar`, `PgdcnSidebar`, mobile navigation và mapping tương thích để không render các trạm như trang độc lập.
4. Chuyển `PgdRequestDetail` từ dialog bo góc thành workspace hồ sơ toàn màn hình theo pattern `PcnDossierDetailView`, giữ nguyên store/action/RBAC PGD.
5. Giữ stepper 5 trạm PGD riêng: `Tiếp nhận & năng lực`, `Chuẩn bị & phân công`, `Hiện trường & lấy mẫu`, `PTN & xem xét kết quả`, `Báo cáo, phê duyệt & trả kết quả`. Không đổi collection hoặc trạng thái PGD.
6. Đưa sổ điều hành thành projection đọc nhanh, mở hồ sơ chuẩn; không thêm mutation hoặc collection riêng.
7. Chạy test contract, typecheck, diff check, build và smoke test local cổng `2357` bằng tài khoản được cung cấp.

## Ràng buộc

- Không sửa/xóa folder PGD nguồn trên Desktop.
- Không dùng dữ liệu, workflow, mã trạng thái hoặc collection PCN cho nghiệp vụ PGD.
- Admin PGD vẫn được xóa mềm theo policy server hiện có; staff/viewer không được xóa.
- Không thay đổi mã PYC/lô PGD đã chốt.

## Tiêu chí nghiệm thu

- Sidebar PGD không còn các nút `Chuẩn bị & Phân công`, `Hiện trường & Lấy mẫu`, `PTN & Kết quả`, `Báo cáo, Chứng thư & Lưu trữ`.
- Từ danh sách PYC hoặc sổ điều hành, mở hồ sơ bằng workspace toàn màn hình, không phải dialog.
- Workspace hiển thị stepper ngang 5 trạm PGD và giữ nguyên quyền/gate PGD.
- Soạn thảo tài liệu vẫn là trang độc lập, không nằm trong stepper.
- Existing PGD/PCN tests, typecheck và production build vẫn đạt.
