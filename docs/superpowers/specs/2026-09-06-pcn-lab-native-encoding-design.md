# PCN Lab-Native Encoding Design

## Mục tiêu

Khi PCN gửi PYC tới phòng thử nghiệm, app đích phải tạo phiếu bằng đúng bộ mã của chính phòng thử nghiệm. PCN giữ mã chuẩn PCN để truy vết và lưu crosswalk với mã bản địa; không dùng mã PCN làm mã hiển thị nội bộ của PTN.

## Ranh giới phòng/app

- `PERFORMANCE` đi tới LABFTEE_APP.
- `EMC` và `ELECTRICAL_SAFETY`/ITD cùng đi tới một app DDT của Phòng thử nghiệm Điện - Điện tử.
- `labCode` là nhánh thử nghiệm, `targetSystem` là app đích. Không biến EMC và ITD thành hai phòng/app độc lập.

## Quy tắc mã bản địa

- DDT: số PYC `DDT-YYMMDD-TT`; số lô dùng dãy theo năm của DDT; mã mẫu dùng `EMC {lot}-{YY}-Mnn` cho nhánh EMC và `ITD {lot}-{YY}-Mnn` cho nhánh An toàn điện.
- LABFTEE: số PYC `HS-YYMMDD-TT`; số lô dùng dãy theo năm của LABFTEE; mã mẫu dùng `ECN {lot}-{YY}-Mnn`.
- Các dãy phải được cấp trong transaction ingest của app đích, có advisory lock theo ngày/năm để retry hoặc request song song không trùng.
- Mã PCN (`pcnNumber`, `lotCode`, `sampleCode`) vẫn nằm trong payload và crosswalk; không bị thay thế bởi mã PTN.

## Contract và persistence

Payload outbound giữ `targetSystem`, `route.labCode`, `pcnLabRequestId`, `pcnRouteId`, `pcnSampleItemId` và mã PCN. App đích tạo mã bản địa, lưu request/lot/sample bằng mã đó, đồng thời lưu source identity trong metadata. ACK trả `externalRequestCode` và `externalLotCode`; callback trả `externalRequestCode` và `sampleFeedback.labSampleCode`, nhưng mọi đối soát vẫn dùng khóa PCN ổn định.

DDT phải dùng một target system `DDT` cho cả `EMC` và `ELECTRICAL_SAFETY`; validation của DDT không được coi `EMC` là tên app. LABFTEE lưu mã bản địa trong `Request` và snapshot tích hợp.

## Luồng lỗi và retry

- Kiểm tra envelope/idempotency trước khi cấp số. Retry cùng fingerprint trả lại crosswalk cũ.
- Hai request khác nhau khóa dãy mã theo ngày/năm trước khi đọc MAX và cấp số.
- Nếu không cấp được mã hoặc không map được nhánh, reject toàn bộ ingest; PCN giữ dispatch ở trạng thái lỗi và không nhận ACK giả.
- Callback/RECONCILE dùng mã bản địa để hiển thị nhưng bắt buộc có `pcnSampleItemId`; không ghép theo tên/model.

## Kiểm thử

- PCN: `EMC` và `ELECTRICAL_SAFETY` đều resolve tới `DDT`, `PERFORMANCE` resolve tới `PERFORMANCE`/LABFTEE; payload giữ `labCode` riêng.
- DDT: cấp đúng dãy PYC/lô/mẫu cho EMC và ITD; hai nhánh không trộn tiền tố; retry giữ nguyên mã.
- LABFTEE: cấp đúng dãy HS/ECN và callback dùng mã bản địa.
- Integration/E2E: một request EMC và một request ITD vào cùng DDT tạo hai crosswalk đúng nhánh; request PERFORMANCE vào LABFTEE tạo mã HS/ECN; PCN nhận ACK/callback đúng mã.
