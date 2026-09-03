# PGD Dossier Operations Design

## Mục tiêu

PGD là workspace tạo và quản lý hồ sơ giám định mới. Một chủ hồ sơ có thể theo dõi hồ sơ từ PYC đến hoàn tất, lập các biểu mẫu/biên bản từ DOCX placeholder, đóng gói bộ hồ sơ và trình lãnh đạo kiểm tra/phê duyệt.

## Ranh giới

- Runtime chỉ đọc dữ liệu PGD đã lưu trong PostgreSQL, template DOCX đã đóng gói trong repository hoặc asset private trong Storage.
- Runtime không scan, watcher, resolve, import, đồng bộ hoặc kiểm tra thư mục Desktop/UNC.
- Tài liệu upload là tài liệu được người dùng chủ động đưa vào hồ sơ hiện hành; không phải kết quả của folder discovery.
- PGD không có module báo giá/thanh toán.

## Mô hình nghiệp vụ

`PgdInspectionRequest` có `ownerUsername` và `ownerAssignedAt`. Khi tạo PYC, người tạo trở thành chủ hồ sơ nếu không truyền chủ hồ sơ; Admin/Quản lý PGD có thể gán lại. Chủ hồ sơ chịu trách nhiệm nghiệp vụ xuyên suốt; phân công đoàn, người soát xét và người duyệt là các vai trò phối hợp.

Mỗi hồ sơ có một bộ hồ sơ dẫn xuất từ nhóm sản phẩm và phương thức. Bộ hồ sơ gồm các dòng checklist cho PYC, phân công, kế hoạch, hiện trường/lấy mẫu, PTN, báo cáo, quyết định, chứng thư, bìa/mục lục và tài liệu thương mại-kỹ thuật khi phát sinh. Checklist là danh sách tài liệu trong hồ sơ, không phải kiểm tra folder.

## Biểu mẫu và tài liệu

Template PGD dùng DOCX làm nguồn bố cục, placeholder `[[key]]` làm hợp đồng dữ liệu. Metadata cell dẫn xuất form scalar/table, có required/type/options/row limits. Người dùng nhập trên app, có thể thêm dòng bảng, sinh DOCX/PDF, rồi liên kết bản sinh vào requirement tương ứng trong bộ hồ sơ. Snapshot template, cell values, tiêu chuẩn và context hash được khóa khi trình duyệt/phê duyệt.

## Đóng gói và phê duyệt

Ứng dụng cung cấp một projection “Bộ hồ sơ” trong card hồ sơ, thể hiện tài liệu hiện hành, phiên bản, trạng thái thiếu/có/miễn, bản sinh và tài liệu upload. Endpoint package dựng manifest từ các pointer PGD đã xác minh, tạo ZIP khi asset private khả dụng và không đưa byte/file path nguồn vào JSONB. Chủ hồ sơ dùng package để kiểm tra trước khi trình; lãnh đạo xem package/checklist read-only, trả lại với lý do hoặc phê duyệt theo lifecycle.

## Quyền và khóa

- Chủ hồ sơ được sửa hồ sơ và tài liệu ở các trạm được mở trước khi ký.
- Admin/Quản lý được gán lại chủ hồ sơ và điều chỉnh phân công.
- Người soát xét/lãnh đạo có quyền xem và thực hiện bước phê duyệt theo role.
- Sau ký, template snapshot, cell values, báo cáo/chứng thư và package lineage bị khóa; chỉ các mutation hậu ký đã được định nghĩa mới được phép.
- Mọi mutation PGD đều xác thực session, domain, request scope, station gate, ownership/role và audit server-side.

## Tiêu chí nghiệm thu

1. Tạo PYC tự gán chủ hồ sơ và tạo checklist bộ hồ sơ PGD.
2. Chủ hồ sơ tạo được phân công, kế hoạch, biên bản hiện trường/lấy mẫu, giao mẫu PTN, đánh giá KQTN, báo cáo, quyết định và chứng thư từ form/placeholder.
3. Bản sinh được gắn vào đúng dòng checklist và giữ snapshot lineage.
4. Có thể đóng gói bộ hồ sơ và trình lãnh đạo; quyền sửa/duyệt được tách đúng vai trò.
5. Không có code runtime PGD đọc hoặc kiểm tra Desktop/UNC; không có menu QC20 trong catalog PGD.

