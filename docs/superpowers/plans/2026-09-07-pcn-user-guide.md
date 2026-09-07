# Kế hoạch biên soạn hướng dẫn sử dụng PGDCN

## Mục tiêu

Tạo một tài liệu DOCX tiếng Việt, có ảnh chụp giao diện chạy thật, hướng dẫn theo tính năng và theo vai trò người dùng của phần mềm PGDCN (PCN + PGD).

## Phạm vi

1. Đối chiếu luồng điều hướng, RBAC, trạng thái và thuật ngữ với codebase/design.md.
2. Chụp các màn hình đăng nhập, dashboard, PCN, PGD, quản trị, AI, nhật ký và hồ sơ chi tiết.
3. Viết hướng dẫn từng bước cho admin, lãnh đạo, nhân viên nghiệp vụ theo chức vụ và viewer.
4. Tạo DOCX với bố cục A4, tiêu đề, bảng quyền, chú thích ảnh và mục lục.
5. Render DOCX thành PNG/PDF, kiểm tra từng trang, sửa lỗi bố cục nếu có.

## Đầu ra

- `docs/PCN_Huong_dan_su_dung_phan_mem_theo_role.docx`
- Ảnh minh họa trong `docs/user-guide-assets/` để tái sử dụng khi cập nhật tài liệu.
