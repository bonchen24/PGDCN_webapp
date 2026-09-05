<!--
Author: Codex
OS support: Windows / Node
Description: PGD product-group forms, DOCX template pack and production verification
-->

# PCN_webapp — PGD nhóm sản phẩm và bộ template — 2026-09-04

## Kết quả

PGD được hoàn thiện theo mô hình một PYC = một bộ hồ sơ phát sinh mới. Nhân viên có thể tiếp nhận, nhập dữ liệu, theo dõi các trạm nghiệp vụ, tạo biên bản/báo cáo/quyết định/chứng thư và đóng gói trình duyệt. Ứng dụng không kiểm tra folder hồ sơ và không đọc folder PGD/NAS/Desktop lúc runtime.

- Catalog: `GĐ-THEP-KG` (thép/kim loại), `GĐ-MAY-01` (máy móc/dây chuyền), `GĐ-THAN-01` (than) và nhóm khác.
- QC20 không thuộc PGD; QC20 chỉ nằm trong boundary PCN.
- Form nhóm thép có thông tin mác/cỡ lô/kế hoạch lấy mẫu; nhóm máy có model/serial/thông số/tình trạng/đồng bộ/lắp đặt; nhóm than có nguồn/cỡ hạt/tiêu chuẩn/căn cứ và chỉ tiêu chất lượng.
- Cell được scope theo nhóm sản phẩm, typed validation ở domain/server, snapshot cùng template và hồ sơ khi phát hành.

## Bộ tài liệu DOCX

`templates/pgd` có manifest version `1.3` và 15 mẫu `PGD-BM-01` đến `PGD-BM-15`, gồm intake, phân công, kế hoạch, hiện trường, lấy mẫu, giao nhận/yêu cầu PTN, báo cáo, chứng thư, quyết định, bìa hồ sơ, timeline, nhật ký hiện trường, review KQTN, biên bản vụ giám định và biên bản giao mẫu PTN. `PgdDocumentGenerationPanel` tạo form từ placeholder/cell, hỗ trợ bảng dòng/cột và dùng snapshot khi sinh tài liệu.

BM-14 và BM-15 phản ánh riêng biên bản vụ giám định và biên bản giao mẫu PTN; BM-01 đến BM-13 tiếp tục hỗ trợ hồ sơ, kế hoạch, hiện trường, lấy mẫu, PTN, báo cáo, quyết định và lưu trữ.

## Ranh giới an toàn

- Không sửa, xóa, copy hoặc import file/hồ sơ từ nguồn PGD.
- Không lưu đường dẫn UNC/Desktop, secret, credential hoặc dữ liệu hồ sơ thật trong note.
- Không đưa báo giá/thanh toán vào nghiệp vụ PGD.
- Không trộn collection/API/RBAC/lifecycle của PGD với PCN; dùng chung shell, khách hàng và cài đặt hệ thống theo scope.

## Kiểm chứng

- `npm test`: **665/665 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- Focused source/layout/template tests: **7/7 pass**.
- Toàn bộ 15 DOCX đã render thành công, tổng 23 trang; các mẫu đại diện đã được kiểm tra trực quan.

## Ghi chú triển khai

- Production đã build/recreate bằng `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d`.
- Image `pcn_webapp-webapp:latest`: digest `sha256:9f7042e0a07c16707f518ccad7dd171a0dd08a287a27a5f751ff80173c0d874b`.
- Container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`; `/api/health`, `/pgdcn/`, `/pgdcn/pcn/`, `/pgdcn/pgd/` đều HTTP 200.
- Log startup xác nhận PostgreSQL connected/schema initialized. Automatic backup vẫn cảnh báo vì Supabase Storage chưa được cấu hình; không sửa `.env`.
- Thay đổi mở rộng PGD/template hiện còn ở workspace chưa commit; không ghi secret, credential hoặc dữ liệu hồ sơ thật vào Git/Obsidian.
