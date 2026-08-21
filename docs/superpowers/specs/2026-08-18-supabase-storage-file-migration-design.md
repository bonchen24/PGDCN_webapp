<!--
Author: Gemini
OS support: Web/Node
Description: Thiết kế migrate ảnh KQTN hiện có sang Supabase Storage và chuẩn hóa backup file
-->

# Migrate ảnh KQTN sang Supabase Storage

## Mục tiêu

Đưa các file ảnh thực sự đang được lưu trong dữ liệu `kqtnRecords` của database `ddt_lab` sang Supabase Storage self-host hiện có trong giai đoạn chuyển tiếp, đồng thời có metadata trong PostgreSQL để kiểm kê, backup và chạy lại migration an toàn.

## Thiết kế được phê duyệt

- Dùng Supabase Storage hiện có trên network `supabase_default`, service `supabase-storage:5000`, backend filesystem hiện tại.
- Dùng bucket private `ddt-files`; service role key chỉ được nạp qua file env của Supabase khi chạy Compose, không ghi vào repository.
- Tạo bảng DDT `file_assets` trong `ddt_lab` với collection, document, JSON path, object path, MIME type, byte size và SHA-256.
- Quét các data URI Base64 trong payload `kqtnRecords`, tạo object path ổn định theo document, JSON path và checksum, rồi upload theo kiểu idempotent.
- Giữ nguyên Base64 trong `app_documents` ở phase đầu để không làm hỏng các luồng hiển thị/crop/DOCX hiện tại và vẫn rollback được.
- Các file AI/OCR chỉ tồn tại trong request tạm và DOCX đã tải về máy không có bản lưu nguồn trong DB nên không thuộc phạm vi migrate tự động.
- Sau khi xác nhận phạm vi ảnh tạm, luồng runtime mới không được ghi các ảnh này vào DB hoặc Storage; job migrate chỉ còn phục vụ dữ liệu legacy đã tồn tại và cleanup có kiểm soát.

## Backup và rollback

- Backup database DDT bằng `pg_dump -Fc` của `ddt_lab`, bao gồm bảng `file_assets` và dữ liệu nghiệp vụ.
- Backup metadata Storage bằng `pg_dump -Fc -d postgres -n storage` của instance Supabase.
- Backup file bằng bản sao thư mục `volumes/storage` của Supabase self-host hoặc export object tương đương.
- Job migrate không xóa dữ liệu nguồn; có thể rollback bằng cách dừng consumer Storage mới và tiếp tục dùng Base64 cũ.

## Tiêu chí nghiệm thu

1. Compose truyền Storage URL nội bộ, bucket name và service role key từ env ngoài repository.
2. Unit test xác nhận extraction data URI, decode MIME/bytes và object path ổn định.
3. Job migrate chạy được trong container webapp trên `supabase_default`, tạo bucket nếu chưa có và có thể chạy lại.
4. Số object/metadata và tổng bytes được kiểm tra sau migrate; số dòng `app_documents` và dữ liệu Base64 nguồn không giảm.
5. README mô tả backup bắt buộc gồm cả dump PostgreSQL và thư mục Storage.

<!-- --- End of 2026-08-18-supabase-storage-file-migration-design.md --- -->
