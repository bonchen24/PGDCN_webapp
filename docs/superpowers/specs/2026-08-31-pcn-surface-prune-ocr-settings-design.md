# PCN Surface Prune, OCR and Settings Design

## Mục tiêu

Đưa runtime PCN về đúng mô hình vận hành hồ sơ mới: ba lối vào công việc, hai bề mặt quản trị và một card hồ sơ với năm vùng nghiệp vụ; đồng thời khôi phục OCR và các thiết lập cần thiết từ repo DDT theo ngữ nghĩa PCN, không kéo lại lịch thử, dữ liệu cũ, Haimy hoặc Cutover.

## Ràng buộc đã được xác nhận

- App đích là Next.js App Router, route sản phẩm là `/`.
- PCN dùng database logic `pcn_certification` và private Storage bucket `pcn-files`; không dùng runtime DDT.
- Development native chạy cổng `1357`; production Docker Desktop chạy cổng `2357`.
- Đầu vào nghiệp vụ là **Đề nghị**. **PYC** chỉ phát sinh khi PCN gửi yêu cầu tới phòng thử nghiệm khác.
- Giữ Danh sách khách hàng và danh sách Nhân sự PCN; tài khoản PCN có system role và department role độc lập.
- QC4, QC9 và QC20 là các Lĩnh vực trong cùng một pipeline; QC20 giữ profile hóa học/lô riêng.
- Không tự xóa record trong database khi dọn UI hoặc code. Nếu cần dọn collection staging, phải có migration SQL riêng, dry-run và xác nhận vận hành.
- Source DDT cũ có thể giữ để đối chiếu, nhưng không được import từ route Next PCN và không được quyết định dữ liệu/điều hướng PCN.

## Bề mặt sản phẩm đích

### Điều hướng

Giữ ba lối vào công việc:

1. `Tổng quan`: workflow map, card hồ sơ, hàng đợi dẫn xuất và bộ lọc QC.
2. `Đề nghị`: mỗi Đề nghị là một card gắn với đúng một bộ hồ sơ.
3. `Danh sách khách hàng`: danh mục khách hàng dùng cho Đề nghị mới.

Chỉ Admin PCN có thêm:

4. `Nhân sự PCN`: quản lý system role, department role, lĩnh vực và trạng thái tài khoản.
5. `Cài đặt PCN`: một bề mặt quản trị duy nhất, mở trong nhóm Quản trị.

Thiết lập cá nhân mở từ menu người dùng bằng modal/drawer, không tạo route hay page riêng.

### Card hồ sơ

`PcnDossierDetailView` vẫn là một card/modal hồ sơ duy nhất với năm vùng:

- `Tổng quan`: Đề nghị, chủ hồ sơ, mã hóa, tiến độ và hành động tiếp theo.
- `Tài liệu hồ sơ`: checklist, phiên file, kiểm tra trực quan và sinh biểu mẫu.
- `Mẫu & PYC`: mã hóa mẫu theo lô, bảng cell tổng hợp, tuyến Hiệu suất/EMC/An toàn điện hoặc Hóa lý theo cấu hình và flow giao nhận.
- `KQTN`: kết quả từ các phòng thử nghiệm, file báo cáo và OCR KQTN có xác nhận.
- `Phê duyệt & phát hành`: soát xét, phê duyệt, cấp số, giao khách hàng và lưu hồ sơ.

`PcnSampleFlowView`, `PcnLabRequestView`, `PcnResultReturnView` và `PcnIssuanceView` là vùng nội bộ của card, không phải menu/page/collection công việc độc lập. `PcnPipelineBoard` và `PcnWorkQueueView` chỉ là hai chế độ cùng một surface Dashboard, không render hai danh sách trùng nhau.

## OCR PCN

### OCR Đề nghị

Trong form tạo/sửa Đề nghị, thêm một vùng upload compact hỗ trợ kéo thả, chọn file và camera trên thiết bị hỗ trợ. Định dạng nhận là PDF, DOCX, PNG, JPG/JPEG. Người dùng có thể chọn nhiều tài liệu trước khi chạy OCR.

OCR tạo một bản nháp extraction gồm:

- thông tin khách hàng và liên hệ;
- mã Đề nghị/mã đăng ký;
- tên sản phẩm, loại/model, nhãn hiệu, nhà sản xuất;
- mô tả/thông số, số lượng, địa chỉ/kho;
- quy chuẩn/Lĩnh vực được nhận diện;
- thông tin lô nhà sản xuất hoặc lô hàng nếu tài liệu có nêu.

Extraction phải trả về giá trị, độ tin cậy, nguồn tài liệu/trang và cảnh báo trường không chắc chắn. Kết quả chỉ điền vào form draft; người dùng phải xem và xác nhận trước khi tạo `CertificationProposal`/`CertificationDossier`. OCR không được tự tạo mã chuẩn, tự gán QC20, tự tạo lô mẫu hoặc tự chuyển trạng thái.

### OCR KQTN

Trong vùng KQTN của card, người dùng được gắn file PDF/ảnh báo cáo vào đúng `ReturnedTestResult`, sau đó yêu cầu OCR để gợi ý số báo cáo, mã mẫu/lô, ngày báo cáo và các kết quả có cấu trúc nếu nhận diện được. Mọi trường OCR phải hiển thị nguồn/độ tin cậy và có thao tác xác nhận trước khi lưu. Kết quả OCR không được ghi vào KQTN bằng generic collection mutation.

### Provider và an toàn dữ liệu

- Ưu tiên PaddleOCR service nội bộ qua endpoint PCN server-side; không gọi service từ trình duyệt bằng URL hạ tầng.
- Gemini là provider tùy chọn, chỉ chạy khi người dùng có cấu hình hợp lệ trong Thiết lập cá nhân hoặc Admin cho phép. Không yêu cầu Gemini để tạo hồ sơ.
- File được lưu qua PCN private file boundary trước hoặc cùng transaction nghiệp vụ; OCR metadata lưu trong context PCN với provenance và không chứa credential.
- OCR thất bại phải giữ file và form draft, cho phép người dùng nhập tay; không làm mất hồ sơ hoặc phiên file hiện có.
- PDF/DOCX không được đọc từ Desktop path hoặc thư mục nguồn nghiên cứu khi runtime.

## Cài đặt PCN

### Admin-only `Cài đặt PCN`

Một `PcnSettingsView` duy nhất, chia thành các panel inline:

- **Lĩnh vực & phạm vi**: QC4/QC9/QC20, tiêu chuẩn tham chiếu, tình trạng cần xác nhận.
- **Tuyến phòng thử**: tuyến mặc định theo Lĩnh vực; QC20 mặc định Hóa lý/Phân tích thành phần hóa học; không tự tạo ba tuyến điện cho QC20.
- **Checklist & biểu mẫu chính thức**: requirement, bước áp dụng, bắt buộc/điều kiện, template readiness và review chính thức; không có trang Template độc lập.
- **Quy tắc mã hóa**: format mã Đề nghị, hồ sơ, lô mẫu, cell mẫu và quy tắc cảnh báo; cấu hình không tự sửa mã đã nhập.
- **OCR & Storage**: provider, trạng thái service, giới hạn file, bucket đang dùng và nút kiểm tra kết nối read-only.
- **Hạ tầng dữ liệu**: profile/database hiện tại và trạng thái kết nối read-only. Backup/restore kỹ thuật không trở thành module công việc; nếu cần thao tác vận hành, chỉ hiển thị trong vùng Admin kỹ thuật có xác nhận rõ.

Settings phải dùng collection/config PCN riêng và endpoint server-side Admin; không đọc/ghi `settings`, `dayConfigs`, `testers`, `brands`, `products` hoặc credential DDT.

### Thiết lập cá nhân

Modal/drawer từ header chỉ quản lý thông tin hiển thị, đổi mật khẩu qua endpoint auth riêng, tùy chọn thông báo/mật độ UI và cấu hình OCR/Gemini cá nhân. Không lưu password hoặc API key dạng plaintext vào localStorage/IndexedDB; API key nếu có phải được xử lý theo policy server hiện hành.

## Phạm vi loại bỏ

### Loại bỏ khỏi runtime và contract PCN

- `PcnAgentWorkspaceView`.
- `PcnArchiveView`, `PcnBackupView`, `PcnDataIntegrityView`, `PcnOperationsRegisterView`.
- `PcnCutoverVerificationView` và `/api/pcn/cutover-status`.
- `PcnHaimyImportView`, `/api/pcn/integrations/haimy/import`, `/api/pcn/integrations/haimy/promote` và collection `pcnHaimyStaging` khỏi allowlist/runtime contract.
- `PcnHistoricalDiscoveryView`, `PcnHistoricalReviewPanel`, `PcnHistoricalScopeBadge` và các endpoint/import contract historical.
- `PcnQualityDocumentsView` độc lập và `PcnTemplateManagementView` độc lập; functionality cần thiết chuyển vào card/Settings PCN.

Các script kiểm chứng Cutover, test contract của Haimy/Cutover và các route chỉ phục vụ hai capability này phải được loại khỏi bộ test PCN. Không để smoke test gọi endpoint đã loại bỏ.

### Không loại bỏ

- OCR dùng cho Đề nghị/KQTN.
- Mẫu theo lô, bảng cell, flow tuyến PTN, PYC, KQTN, approval, issuance, private file và sinh biểu mẫu bên trong card.
- Danh sách khách hàng, Nhân sự PCN, QC4/QC9/QC20.
- DDT source độc lập ngoài route Next PCN để đối chiếu trong giai đoạn chuyển tiếp.

## Tiêu chí nghiệm thu

1. `PCN_WORKSPACE_NAVIGATION` chỉ có Dashboard, Đề nghị và Khách hàng; Admin navigation chỉ có Nhân sự PCN và Cài đặt PCN.
2. Không có import từ route Next PCN tới `store.ts`, `SystemManagementViews.tsx`, Haimy, Cutover, historical, archive, data-integrity, operations-register, agent hoặc backup page.
3. Không còn API PCN cho Haimy/Cutover và không còn Haimy/Cutover trong PCN collection allowlist.
4. Các vùng Mẫu & PYC, KQTN, Phê duyệt & phát hành vẫn mở được từ đúng một card hồ sơ.
5. OCR Đề nghị điền draft có provenance/confidence và yêu cầu xác nhận; OCR KQTN gắn đúng result và yêu cầu xác nhận.
6. Cài đặt PCN là Admin-only, không chứa khái niệm lịch thử/Phòng Giám định/brand/product DDT.
7. `npm run lint`, `npm test`, `npm run build` và smoke runtime PCN không còn phụ thuộc endpoint/surface đã loại bỏ.
