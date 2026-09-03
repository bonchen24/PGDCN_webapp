# Đặc tả: PGD sở hữu nghiệp vụ giám định thép không gỉ

## Trạng thái

Đã được người dùng xác nhận ở mức định hướng; chờ rà soát đặc tả trước khi lập kế hoạch và sửa code.

## Mục tiêu

Đưa toàn bộ nghiệp vụ giám định lô thép không gỉ ra khỏi miền PCN và hoàn thiện nó trong miền PGD của **Phòng Giám định - Chứng nhận**. Trong runtime mới:

- PCN chỉ có các lĩnh vực `QC4` và `QC9`.
- PGD có một catalog item riêng `GĐ-THEP-KG` — Giám định thép không gỉ.
- `QC20` không còn là field code, catalog code, menu, bộ lọc, template hoặc workflow của PCN/PGD. Tên này chỉ được dùng khi mô tả nguồn biểu mẫu hoặc căn cứ pháp lý trong tài liệu phát triển; không dùng để định danh hồ sơ mới.
- QCVN 20:2019/BKHCN và Sửa đổi 1:2021 là `standardSnapshot` của hồ sơ PGD, không phải lĩnh vực chứng nhận PCN.

## Bằng chứng nghiệp vụ đã đọc

Nguồn tham khảo PGD được mở ở chế độ read-only. Nhóm biểu mẫu thép không gỉ trong `Mẫu biên bản/QC20` cho thấy chuỗi tài liệu sau:

1. Bìa hồ sơ.
2. Phiếu phân công.
3. Kế hoạch đánh giá/chứng nhận sản phẩm.
4. Biên bản kiểm tra hiện trường.
5. Biên bản lấy mẫu.
6. Báo cáo đánh giá.
7. Báo cáo kết quả thử nghiệm.
8. Quyết định.
9. Giấy chứng nhận.

Các trường nghiệp vụ phải được giữ trong hồ sơ mới gồm khách hàng/đơn vị nhập khẩu, địa chỉ và người liên hệ, lô hàng, mác thép, dạng sản phẩm, kích thước danh nghĩa, tiêu chuẩn sản phẩm công bố, xuất xứ, nhà sản xuất, mã HS, hóa đơn/tờ khai hải quan và các chứng từ thương mại. Biểu mẫu nguồn có căn cứ QCVN 20, Phương thức 7, kiểm tra ngoại quan/kích thước, lấy mẫu đại diện, thử nghiệm và kết luận lô.

Các nhóm biểu mẫu `TT58` và các quy trình `QT-GĐ-*` là bằng chứng vận hành PGD bổ sung. Chúng được chuẩn hóa thành metadata/asset của PGD, không nhập byte, khách hàng, chữ ký hoặc hồ sơ lịch sử vào seed/runtime.

## Ranh giới PCN

Xóa QC20 khỏi các đường chạy active sau, nhưng không xóa cứng dữ liệu cũ:

- `PCN_CERTIFICATION_FIELD_CODES`, `PcnCertificationFieldCode` và active certification field definitions.
- PCN settings, intake policy, sample flow, template catalog, dossier blank pack, source-coverage và user field-code allowlist.
- Readiness, scope-confirmation và các API/settings riêng cho QC20.
- Các lựa chọn lĩnh vực, bộ lọc, label và template generation trong UI PCN.

Khi projection gặp record cũ có field code `QC20`, record được giữ nguyên để đối soát, hiển thị trạng thái **Lĩnh vực không còn thuộc PCN**, khóa mutation và không được đưa vào lựa chọn tạo/sửa hồ sơ mới. Không backfill hoặc tự động chuyển record cũ thành PGD.

## Catalog và mô hình dữ liệu PGD

Giữ các nhóm kiểu PGD độc lập với `CertificationProposal`/`CertificationDossier`. Hạng mục thép không gỉ dùng:

```text
catalogItemCode = GĐ-THEP-KG
productGroup    = STEEL_METAL
methodCodes     = TT58, QT-GĐ-14
assessment      = METHOD_7
```

`PgdProductDetails` cần biểu diễn tối thiểu:

- `steelGrade`/mác thép và `productForm` (cuộn, thanh hoặc dạng khai báo khác).
- `dimensions`/kích thước danh nghĩa, `productStandard` và `standards`.
- `lotCode`, `steelLotSize`, đơn vị lô, khối lượng/số lượng.
- `origin`, `manufacturer`, `importer` và địa điểm kiểm tra.
- `hsCode`/mã HS và `customsDocuments`, gồm tờ khai, hợp đồng, hóa đơn, packing list, vận đơn, C/O, catalog/mô tả kỹ thuật.
- `steelSameGradeMultiProduct` và `steelManualSamplingPlanNote` khi áp dụng.

Hồ sơ phải lưu snapshot tiêu chuẩn, phương thức đánh giá, catalog item và template version tại thời điểm phát hành. Thay đổi catalog/template sau đó không làm thay đổi chứng thư đã ký.

## Luồng PGD thép không gỉ

Luồng active là:

`DRAFT → CAPABILITY_REVIEW → READY_TO_EXECUTE → PREPARING → FIELD_INSPECTION → WAITING_LAB_RESULTS → RESULTS_REVIEW → TECHNICAL_REVIEW → LEADERSHIP_APPROVAL → SIGNED → RESULT_RETURNED → ARCHIVED`.

Các cổng chính:

- Tiếp nhận PYC từ trực tiếp/điện thoại/Zalo/email; kiểm tra phạm vi, năng lực, hồ sơ và catalog item.
- Phân công theo ma trận chuyên môn với phê duyệt hoặc điều chỉnh thủ công.
- Lập kế hoạch, kiểm tra lô tại hiện trường, ghi ngoại quan/kích thước/nhãn/xuất xứ và bằng chứng ảnh.
- Lấy mẫu, tách `LAB` và `RETAINED`, tạo mã mẫu/niêm phong, lập phiếu giao nhận và yêu cầu PTN.
- Tiếp nhận kết quả PTN; cảnh báo mẫu hoặc hạng mục còn thiếu, sai liên kết hoặc không khớp phương pháp.
- Lập báo cáo, quyết định và chứng thư; duyệt kỹ thuật, duyệt lãnh đạo, ký, trả kết quả và lưu trữ.

Giai đoạn này không xây module báo giá, thanh toán hoặc chặn trả kết quả theo thanh toán.

## Template và module cell

Asset repo/Storage PGD dùng tên trung tính theo nghiệp vụ, không dùng tên `QC20` làm code. Mapping ban đầu:

| Nghiệp vụ nguồn | Template PGD | Nhóm cell chính |
| --- | --- | --- |
| Bìa hồ sơ | `PGD-BM-01` | mã hồ sơ, khách hàng, tiêu chuẩn, mốc thời gian, checklist |
| Phiếu phân công | `PGD-BM-02` | người yêu cầu, người phụ trách, trưởng đoàn, phạm vi |
| Kế hoạch | `PGD-BM-03` | phương thức 7, tiêu chuẩn, lịch, nội dung kiểm tra |
| Hiện trường | `PGD-BM-04` | lô, mác, kích thước, xuất xứ, nhà sản xuất, hóa đơn, kết quả kiểm tra |
| Lấy mẫu | `PGD-BM-05` | loại sản phẩm, mác, cỡ lô, số mẫu, niêm phong, mục đích, bàn giao |
| Yêu cầu/kết quả PTN | `PGD-BM-06`/`PGD-BM-07` | mẫu gửi, phép thử, kết quả, kết luận, cảnh báo thiếu |
| Quyết định | `PGD-BM-09` | căn cứ, lô, tiêu chuẩn, trách nhiệm, hiệu lực |
| Chứng thư | `PGD-BM-08` | lô, nhập khẩu, QCVN, phương thức 7, bảng chứng từ, kết luận |

Module cell phải:

- lấy field từ placeholder metadata của template đã duyệt;
- hiển thị bảng dạng dòng/cột cho cell `TABLE`, không bắt nhập JSON;
- có kiểu dữ liệu, required, pattern, options, binding và thứ tự cột;
- hỗ trợ các cell thép: mác, dạng sản phẩm, kích thước, tiêu chuẩn, lô, xuất xứ, nhà sản xuất, nhập khẩu, mã HS, chứng từ, cỡ lô và kế hoạch lấy mẫu;
- chạy preflight trước khi sinh, lưu `templateSnapshot`, `standardSnapshot`, `values` và `contextHash`;
- không cho template mới sửa ngược tài liệu đã ký.

## API/UI/RBAC

- API PGD dùng namespace `/api/pgd/...`, collection và pointer có `domain=pgd`; không ghi PGD qua generic `/api/db`.
- API template PGD tách khỏi PCN, cho PGD Admin/Manager upload, review, approve, retire và xem fingerprint; không resolve Desktop/UNC ở runtime.
- UI catalog PGD hiển thị **GĐ-THEP-KG — Thép không gỉ** và căn cứ QCVN 20 như tiêu chuẩn; không hiển thị `QC20` như lĩnh vực.
- `departmentScopes`/`pgdRole` quyết định quyền PGD; `fieldCodes` chỉ dành cho PCN. Một tài khoản có thể có cả hai scope nhưng mutation phải kiểm tra đúng miền.
- Dashboard, Khách hàng, Nhân sự và Cài đặt hệ thống là nhánh chung; template DOCX và cấu hình cell nằm ở Cài đặt PGD.

## Kiểm thử nghiệm thu

1. PCN chỉ tạo/xử lý `QC4`/`QC9`; catalog/settings/template/sample-flow không còn lựa chọn QC20.
2. PGD tạo được PYC `GĐ-THEP-KG` với QCVN 20, Sửa đổi 1:2021, Phương thức 7, mác thép, kích thước, lô và chứng từ.
3. Luồng PGD chạy xuyên suốt tiếp nhận → hiện trường → tách mẫu → PTN → kết quả → báo cáo → quyết định/chứng thư → duyệt/ký/trả.
4. Cell table thêm/xóa dòng và bind đúng dữ liệu vào DOCX; thiếu required field bị chặn tại preflight.
5. PGD không đọc/sửa hồ sơ PCN và PCN không đọc/sửa hồ sơ PGD; template snapshot không bị thay đổi sau phát hành.
6. Không có code runtime đọc Desktop/UNC, watcher hoặc import hồ sơ lịch sử; thư mục nguồn không bị sửa/xóa.

