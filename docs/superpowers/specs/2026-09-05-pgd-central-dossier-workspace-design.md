# Đặc tả UI/UX PGD — Workspace bộ hồ sơ trung tâm

Ngày: 2026-09-05  
Phạm vi: miền PGD trong shell PGDCN chung  
Trạng thái: đề xuất để review — đã điều chỉnh theo feedback về trang Soạn thảo tài liệu

> `design.md` là nguồn chuẩn duy nhất của nghiệp vụ, schema, lifecycle, RBAC và design token. Tài liệu này chỉ chuyển các hợp đồng đó thành phạm vi UX/component để triển khai; nếu có khác biệt, `design.md` được ưu tiên.

## 1. Mục tiêu

PGD cần một workspace hồ sơ trung tâm cho mỗi `PgdInspectionRequest`. Một nhân viên được giao làm chủ hồ sơ và có thể theo dõi, nhập, tạo, bổ sung, kiểm tra và đóng gói toàn bộ hồ sơ từ PYC đến trình lãnh đạo. Song song, trang Soạn thảo tài liệu PGD vẫn là entry độc lập để người dùng tự chọn PYC/hồ sơ và tạo đúng tài liệu cần thiết. Các trạm nghiệp vụ vẫn giữ đúng lifecycle PGD hiện tại nhưng không được làm người dùng rời khỏi ngữ cảnh hồ sơ hoặc chọn lại PYC trong workspace trung tâm.

Phạm vi đợt này:

- Tái cấu trúc trải nghiệm quanh `requestId`, `ownerUsername` và `dossierChecklist`.
- Làm sâu 5 trạm PGD hiện có, không tạo thêm bước nghiệp vụ hoặc collection song song.
- Đưa biên bản, tài liệu liên quan, mẫu `LAB`/`RETAINED`, KQTN, báo cáo và package vào một bộ hồ sơ có trạng thái rõ ràng.
- Đồng nhất responsive behavior với PCN nhưng giữ màu, nhãn, field, method, status và gate riêng của PGD.

Không thuộc phạm vi:

- Không thêm lịch thử, module kế toán/báo giá/thanh toán hoặc folder checker.
- Không đọc Desktop/UNC, không import hồ sơ cũ và không lưu byte file vào JSONB.
- Không thay đổi state machine PGD, quyền server hoặc nguồn dữ liệu phòng thử nếu không bắt buộc để bảo vệ flow.

## 2. Mô hình workspace

### 2.1. Entry và context

`PgdWorkspace`/shell PGDCN hiển thị danh sách PYC/hồ sơ với bộ lọc theo owner, nhóm sản phẩm, trạng thái, hạn xử lý và mức thiếu hồ sơ. Một row/card chỉ có một CTA mở workspace trung tâm. `PgdDossierOperationsPanel`, sổ điều hành và dashboard chỉ là projection; tất cả CTA của chúng gọi cùng `onOpenFullDossier(requestId, station?)`.

Workspace trung tâm dùng `requestId` làm context bất biến trong phiên mở:

1. Header nhận diện: mã PYC, khách hàng, đối tượng/lô, profile, status, owner và hạn.
2. Thanh việc tiếp theo: một hành động chính hợp lệ theo gate hiện tại và số lượng thiếu.
3. Stepper 5 trạm PGD: trạm hiện tại mở; trạm trước được rà soát theo RBAC; trạm sau khóa.
4. Vùng tác vụ: form và evidence của trạm đang chọn.
5. Vùng bộ hồ sơ: checklist, phiên file, tài liệu sinh, biên bản liên quan và package summary.
6. Hoạt động/audit: hiển thị read-only, ưu tiên sự kiện của hồ sơ và version file.

### 2.2. Desktop và mobile

Desktop rộng dùng grid ba vùng với cột điều hướng có độ rộng ổn định, cột tác vụ co giãn `minmax(0, 1fr)` và cột checklist/package có độ rộng đọc được. Khi màn hình hẹp hơn, checklist/package được chuyển xuống dưới vùng tác vụ thay vì ép toàn trang scroll ngang.

Mobile dùng một cột, header và footer luôn nằm trong viewport của workspace, body có scroll dọc độc lập. Stepper có thể cuộn ngang cục bộ; các nhóm form dùng accordion; nút chính giữ touch target tối thiểu theo token mobile. Mã hồ sơ, tên khách hàng, tên file và lỗi dài phải wrap; không dùng `truncate` cho dữ liệu cần đọc để quyết định.

### 2.3. Trang Soạn thảo tài liệu PGD

Trang này vẫn tồn tại như một workspace độc lập để người dùng chủ động chọn hồ sơ muốn tạo biên bản/tài liệu, tương tự `PcnDraftingWorkspaceView`. Nó không thay thế workspace hồ sơ trung tâm và không tự đổi lifecycle.

Desktop dùng cùng nhịp ba vùng của PCN:

1. `Bản đã lưu`: danh sách bản soạn theo hồ sơ, loại tài liệu và trạng thái file.
2. `Form chính`: một bộ chọn nguồn PYC/hồ sơ, một bộ chọn loại tài liệu, sau đó là các field/table còn cần nhập.
3. `Kết quả sinh file`: các DOCX/PDF đã sinh, tải lại và trạng thái lưu.

Mobile xếp ba vùng thành một cột theo thứ tự `chọn hồ sơ → chọn tài liệu → nhập form → tạo file → kết quả`. Nguồn hồ sơ không lặp lại ở `PgdDocumentGenerationPanel`; loại tài liệu không lặp catalog tile với select. Template, placeholder, mapping, cell, source inspection và version kỹ thuật được resolve/kiểm tra ngầm hoặc xem trong modal Cài đặt DOCX dành cho Admin/Quản lý, không xuất hiện trong form thường.

## 3. Năm trạm PGD

| Trạm | Vùng nhập/chứng cứ chính | Kết quả để mở trạm sau |
| --- | --- | --- |
| Tiếp nhận & năng lực | PYC, khách hàng snapshot, profile, phạm vi, tiêu chuẩn, method, chứng từ thương mại/kỹ thuật | PYC hợp lệ, scope/năng lực và tài liệu đầu vào đủ hoặc có xử lý bổ sung |
| Chuẩn bị & phân công | Chủ hồ sơ, đoàn/người soát xét, kế hoạch, thiết bị, phương thức, thời hạn | Có phân công và kế hoạch hợp lệ |
| Hiện trường & lấy mẫu | Biên bản hiện trường, nhật ký, ảnh/evidence, dòng sản phẩm/lô, mẫu LAB/RETAINED, niêm phong, giao nhận | Có bằng chứng hiện trường và mẫu/giao nhận đúng khi phạm vi yêu cầu |
| PTN & xem xét KQTN | Yêu cầu PTN, kết quả, số/ngày phiếu, đủ chỉ tiêu, phù hợp, thiếu/không phù hợp, kiến nghị/thử lại | KQTN liên kết đúng mẫu và phiếu xem xét hoàn tất |
| Báo cáo, phê duyệt & trả kết quả | Báo cáo, quyết định, chứng thư, package index, approval chain hai cấp, ký và trả kết quả | Manifest đủ, hai approval step hợp lệ; sau ký khóa snapshot |

Mỗi trạm sử dụng các component form hiện có theo hướng tái tổ chức, không tạo bản sao dữ liệu. Field được lọc theo `productGroup`, `methodCode` và template mapping. Bảng dòng sản phẩm, mẫu, kết quả và chứng từ chiếm toàn hàng; field scalar ngắn xếp nhiều cột trên desktop và 1–2 cột trên mobile.

## 4. Chủ hồ sơ và quyền

- Khi tạo PYC, server gán actor tạo làm `ownerUsername` nếu chưa có owner; owner hiển thị ở header, danh sách và package.
- Owner có quyền lưu form, tạo/tải biên bản và tài liệu trong phạm vi trạm đang mở; không được tự vượt gate, duyệt hồ sơ hoặc reassign chính mình sang người khác.
- `PGD_FIELD_INSPECTOR`, `PGD_TECHNICAL`, `PGD_DOCUMENT_CLERK` chỉ thấy mutation thuộc scope được cấp; `PGD_VIEWER` read-only.
- Admin/Quản lý được reassign trước khi khóa snapshot. Mọi gán lại, hoàn tất trạm, trình duyệt, trả lại, ký và đóng gói phải qua server boundary và audit.
- Khi vào `TECHNICAL_REVIEW` hoặc `LEADERSHIP_APPROVAL`, package trình duyệt là read-only; trả lại bắt buộc có lý do và mở lại đúng trạm/requirement bị ảnh hưởng.

## 5. Bộ hồ sơ và tạo biên bản

Checklist được dựng từ `getPgdDossierRequirements(productGroup)` và snapshot trên request. Mỗi item có requirement code, nhóm, trạng thái, tài liệu hiện hành, version, provenance, người cập nhật và hành động.

Các hành động chuẩn:

- `Tạo biên bản`: mở form/template đúng requirement và prefill từ snapshot request, lô, mẫu, field evidence và KQTN liên kết.
- `Bổ sung file`/`Thay phiên bản`: upload vào private Storage, giữ version cũ và hiển thị file hiện hành.
- `Xem lịch sử`: mở version list, không làm thay đổi file hiện hành.
- `Xác nhận vào bộ hồ sơ`: chỉ dành cho tài liệu sinh hợp lệ, ghi origin pointer, checksum, template snapshot và context hash.
- `Đóng gói`: dựng lại manifest từ database; chỉ tài liệu hiện hành và tài liệu sinh đã xác nhận mới được đưa vào ZIP.

Package summary phải hiển thị số dòng đủ/thiếu/đã bỏ qua, owner, mã hồ sơ, version package và cảnh báo provenance. Nếu chưa `complete=true`, nút trình lãnh đạo bị khóa và hiển thị lý do nghiệp vụ ngay tại checklist.

## 6. Component boundaries dự kiến

- `PgdDossierWorkspace`: shell full-screen, context, header, footer, station selection.
- `PgdDossierHeader`/`PgdDossierNextAction`: owner, status, deadline, next action.
- `PgdDossierStationStepper`: 5 trạm và trạng thái khóa/đang làm/hoàn tất.
- `PgdDossierOverviewPanel`: intake, product-group fields, assignment và metadata snapshot.
- `PgdDossierEvidencePanel`: field activity, samples, lab links và result review.
- `PgdDossierChecklistPanel`: checklist, version, upload/generate/confirm/history.
- `PgdDossierPackagePanel`: manifest summary, preflight, download và submit gate.

Các panel trạm hiện tại (`PgdPreparationStationPanel`, `PgdFieldStationPanel`, `PgdLabStationPanel`, `PgdResultsStationPanel` và intake trong `PgdWorkspace`) được đưa vào vùng tác vụ của workspace. Không để mỗi panel trạm tự dựng một selector PYC độc lập; riêng `PgdTemplateWorkspace` được phép có đúng một selector nguồn hồ sơ theo pattern Soạn thảo PCN.

## 7. Acceptance criteria

- Từ danh sách PGD, mở một PYC một lần và chuyển qua cả 5 trạm mà không mất `requestId` hoặc phải chọn lại PYC.
- Từ trang Soạn thảo tài liệu PGD, người dùng vẫn tự chọn được PYC/hồ sơ và tạo tài liệu mà chỉ phải chọn nguồn một lần.
- Trang Soạn thảo không lặp catalog loại tài liệu với select template, không lặp tóm tắt hồ sơ và không hiển thị mapping/placeholder kỹ thuật trong form thường.
- Header luôn thể hiện owner; danh sách, package và activity dùng cùng owner snapshot.
- Owner có thể đi từ intake đến package; trạm sau bị khóa khi thiếu evidence, không dựa vào cờ hoàn tất từ browser.
- Có thể tạo/đính kèm các biên bản và tài liệu liên quan theo requirement; file sinh chưa xác nhận không được tính đủ.
- Package hiển thị manifest/cảnh báo, chỉ cho trình lãnh đạo khi đủ; approval chain hai cấp và trạng thái hậu ký giữ nguyên.
- Desktop không có vùng tác vụ bị vỡ ở chiều rộng phổ biến; mobile 320/375/390/430px không tràn ngang toàn trang, input/action đọc và chạm được.
- UI không hiển thị placeholder hướng dẫn dư thừa khi label và mapping code/template đã đủ ngữ cảnh.
- Regression test kiểm tra context xuyên trạm, owner-first action, checklist/package gate và responsive class contract; full test/build vẫn pass.

## 8. Thứ tự triển khai sau khi spec được duyệt

1. Cập nhật shell/context và mở workspace trung tâm từ danh sách/sổ/notification.
2. Gom stepper/header/next action/checklist/package vào workspace, giữ callback/server boundary hiện có.
3. Đưa form 5 trạm vào vùng tác vụ, bắt đầu từ intake + preparation rồi field/sample, lab/result và report/approval.
4. Tái cấu trúc `PgdTemplateWorkspace` theo pattern Soạn thảo PCN: một nguồn hồ sơ, một loại tài liệu, form nghiệp vụ và vùng kết quả file; bỏ catalog/control trùng lặp và ẩn chi tiết kỹ thuật khỏi runtime.
5. Chuẩn hóa grid desktop/mobile và các state loading/error/locked/empty.
6. Bổ sung test contract và smoke test các viewport; chạy full test, lint, build và Docker smoke.
