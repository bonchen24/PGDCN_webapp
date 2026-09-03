# Kế hoạch triển khai: chuyển giám định thép không gỉ sang PGD

## Mục tiêu

Đồng bộ code với đặc tả đã duyệt: PCN chỉ vận hành `QC4`/`QC9`; PGD vận hành hạng mục `GĐ-THEP-KG` cho giám định thép không gỉ, dùng QCVN 20:2019/BKHCN và Sửa đổi 1:2021 như căn cứ tiêu chuẩn trong hồ sơ.

## Nguyên tắc bất biến

- Không đọc, sửa, xóa, copy hoặc import file từ Desktop/UNC ở runtime.
- Không xóa dữ liệu PCN cũ có `QC20`; chỉ lọc khỏi projection active và khóa mutation.
- Không dùng `CertificationProposal`, `CertificationDossier`, `PCN_CERTIFICATION_FIELD_CODES` hoặc sample flow PCN cho PGD.
- Không thêm báo giá/thanh toán hoặc chặn trả kết quả theo thanh toán.
- Không commit artifact build, file nguồn nghiên cứu hoặc các thay đổi ngoài phạm vi.

## Các bước

### 1. Chuẩn hóa domain và catalog PGD

- Cập nhật `utils/pgdDomain.ts` để catalog thép active dùng code `GĐ-THEP-KG`, nhãn Thép không gỉ, QCVN 20 + amendment, `TT58`, `QT-GĐ-14`, `METHOD_7`.
- Mở rộng type/policy cho profile thép: mác, dạng sản phẩm, kích thước, tiêu chuẩn, xuất xứ, nhà sản xuất/nhập khẩu, HS, chứng từ hải quan, cỡ lô, cờ cùng mác nhiều dạng và kế hoạch lấy mẫu thủ công.
- Giữ compatibility read-only cho record/catalog cũ, nhưng reject code `QC20` trong catalog PGD mới.

### 2. Gỡ QC20 khỏi PCN active path

- Sửa types, workflow/settings, intake policy, sample flow, template catalog, dossier template catalog, source coverage, user roster và mọi allowlist PCN để chỉ nhận `QC4`/`QC9`.
- Xóa/disable QC20 scope governance và readiness API/UI; dữ liệu/config cũ không bị xóa.
- Sửa server projection/bootstrap/issuance để QC20 không xuất hiện trong menu, catalog, hồ sơ mới, template hoặc readiness.
- Cập nhật route/component PCN và test contract để không còn route hoặc control tạo QC20.

### 3. Hoàn thiện template và module cell PGD

- Bổ sung metadata template riêng cho `GĐ-THEP-KG`, map các nhóm biểu mẫu thép đã khảo sát vào asset repo trung tính `PGD-BM-*`.
- Bổ sung cell bindings/placeholder cho hồ sơ lô thép, chứng từ, mẫu LAB/RETAINED, kết quả PTN, quyết định và chứng thư.
- Lọc template theo `productGroup` + `methodCode`, lấy đúng template PGD khi tạo báo cáo/chứng thư.
- Kiểm tra preflight required fields, table rows/cells, standard/template snapshot và context hash; không làm thay đổi tài liệu đã khóa.

### 4. Cập nhật intake/UI PGD

- Hiển thị lựa chọn `GĐ-THEP-KG` và form chi tiết thép có điều kiện; mặc định `TT58`/Phương thức 7 khi phù hợp.
- Gửi đúng `productDetails`, customs documents, sampling metadata và method/assessment snapshot.
- Bảo đảm card PGD chạy được intake → field/sample → lab → result → report/decision/certificate → approval/sign/return.
- Bảo đảm catalog PCN và PGD không lẫn nhau; tài khoản có scope hai miền vẫn bị kiểm tra đúng boundary.

### 5. API, persistence và compatibility

- Tìm và sửa các endpoint/server helper còn hard-code QC20 ở PCN.
- Kiểm tra PGD API dùng collection/domain riêng, không generic PCN DB mutation.
- Nếu cần migration/schema seed, chỉ thêm/chuẩn hóa record active mới; không destructive migration và không import hồ sơ lịch sử.
- Bổ sung audit/event và lỗi validation có mã/field rõ ràng.

### 6. Kiểm thử và nghiệm thu

- Chạy unit/contract tests liên quan types, catalog, intake, template, cell/table, server boundary và PGD flow.
- Chạy `npm test`, `npm run typecheck`, `npm run build`, `git diff --check`.
- Quét source/runtime để xác nhận không còn active PCN QC20 và không có code đọc Desktop/UNC/import lịch sử.
- Kiểm tra production build/container sau khi code pass; chỉ commit source thay đổi thuộc task.

