<!--
Author: Codex
OS support: Windows / Node
Description: Verified PGD dossier cockpit implementation and template-cell workflow
-->

# PCN_webapp — PGD dossier cockpit — 2026-09-04

## Phạm vi đã hoàn thiện

PGD là workspace hình thành hồ sơ phát sinh mới: một PYC tương ứng một bộ hồ sơ. Người phụ trách có thể đi xuyên suốt các trạm tiếp nhận, chuẩn bị/phân công, hiện trường/lấy mẫu, PTN/KQTN, báo cáo/chứng thư, duyệt, ký, trả kết quả và lưu trữ. Các trang trạm chỉ là bề mặt làm việc của cùng một dossier.

- `Hồ sơ PYC`: danh sách PYC và modal tạo PYC.
- `Chuẩn bị & Phân công`: giám định viên, soát xét kỹ thuật, phê duyệt phân công và kế hoạch.
- `Hiện trường & Lấy mẫu`: biên bản hiện trường, đo kiểm dạng bảng, dòng lấy mẫu, LAB/mẫu lưu và checklist chứng từ.
- `PTN & Kết quả`: giao nhận mẫu, hạng mục/phương pháp thử dạng bảng, tiếp nhận kết quả và cảnh báo yêu cầu chưa có KQTN.
- `Báo cáo, Chứng thư & Lưu trữ`: review KQTN, snapshot tiêu chuẩn/template, báo cáo, chứng thư, duyệt kỹ thuật/lãnh đạo, mục lục và đóng gói.
- `Soạn thảo tài liệu`: chọn PYC, nhập cell/placeholder, sinh DOCX/PDF và theo dõi file đã sinh.

## Template và cell

`Cài đặt DOCX PGD` là modal cục bộ bên trong workspace soạn thảo, chỉ quản lý template DOCX, placeholder và cell. `Cài đặt hệ thống` không quản lý template PGD. `PgdCellManager` quản trị cell template; `PgdTableFieldEditor` nhập các bảng lặp theo cột, nhãn, giới hạn dòng và chế độ khóa.

PGD dùng catalog riêng: `GĐ-THEP-KG`, `GĐ-MAY-01`, `GĐ-THAN-01` và nhóm khác. QC20 không thuộc PGD. Không có bề mặt báo giá/thanh toán/phí thử nghiệm.

## Ranh giới nguồn và dữ liệu

Folder PGD trên Desktop được rà soát làm nguồn tham chiếu biểu mẫu; bản gốc không bị sửa/xóa. Ứng dụng không đọc Desktop/UNC, không watcher/scan folder và không import hồ sơ lịch sử lúc runtime. Hồ sơ, tài liệu và mutation PGD dùng boundary `domain=pgd`, collection/API/RBAC riêng; dùng chung khách hàng và nhân sự theo scope phòng.

## Kiểm chứng

- `npm run test:pcn`: **665/665 pass**.
- Focused PGD station/template/navigation tests: **26/26 pass**.
- `npm run lint`: pass (typecheck qua `tsc --noEmit`).
- `npm run build`: pass; routes `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` được prerender thành công.
- `git diff --check`: pass.

