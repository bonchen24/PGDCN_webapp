# Thiết kế Graphic Workflow Map cho PCN

## Mục tiêu

Thay cách trình bày hồ sơ theo “trạm” bằng một `Graphic Workflow Map` trực quan, gọn và bám sát state machine PCN thật. Người dùng nhìn vào một graphic có thể biết hồ sơ đang ở đâu, đã đi qua bước nào, bước kế tiếp là gì, đang bị trả về/ngoại lệ/quá hạn ở đâu, rồi mở đúng dữ liệu nghiệp vụ từ card hồ sơ.

Đây là thay đổi giao diện và projection read-only. Không tạo state machine thứ hai, không tạo collection workflow mới và không biến graphic thành một màn hình quản trị độc lập.

## Hiện trạng làm nguồn chuẩn

- `utils/pcnWorkflow.ts` là nguồn chuẩn về trạng thái và chuyển tiếp hồ sơ.
- `utils/pcnDossierPipeline.ts` đang map trạng thái thành các khóa dẫn xuất, checklist và độ hoàn thiện. Các khóa này được giữ làm adapter dữ liệu tương thích nhưng không còn hiển thị như “Trạm 1/2…” hoặc cột Kanban.
- `utils/pcnWorkQueue.ts` là nguồn chuẩn cho thứ tự deadline/quá hạn và card việc cần làm.
- `utils/pcnDossierNavigation.ts` là nguồn chuẩn để một nút workflow mở đúng vùng dữ liệu hiện có.
- `PcnDossierInspection`, `PcnDossierDocument` và `ActivityLog` cung cấp checklist, file và lịch sử thật.

## Mô hình graphic

Graphic có một luồng chính theo thứ tự:

`Đề nghị → Kiểm tra đầu vào → Phân công → Kế hoạch → Đánh giá → Lấy mẫu/PYC → KQTN → Khắc phục/thử lại → Soát xét → Phê duyệt → Phát hành → Giao/Lưu trữ`

Projection được tính từ `CertificationDossier.status` thông qua catalog hiện có. Mỗi node trả tối thiểu:

- khóa nội bộ, số thứ tự, nhãn hiển thị và các status thật được bao phủ;
- `COMPLETED`, `CURRENT`, `FUTURE` hoặc `EXCEPTION`;
- số dossier trong node khi ở chế độ tổng quan;
- action label, requirement count và missing count từ snapshot checklist;
- cờ quá hạn lấy từ `targetDate`, không suy diễn từ tên file, ghi chú hoặc animation.

Một dossier có status quay lại (`REJECTED`, `CORRECTIVE_ACTION`, hoặc status sau khi được trả về) vẫn giữ lịch sử `ActivityLog`; graphic đánh dấu node hiện tại và một nhánh “Đã quay lại/Khắc phục”, không xóa hoặc viết lại các node đã đi qua. `ON_HOLD`, `REJECTED`, `CANCELLED` hiển thị thành nhánh ngoại lệ với lý do đã lưu. Không có timer giả để mô phỏng tiến độ.

## Dashboard tổng quan

Dashboard giữ một bề mặt dữ liệu tại mỗi thời điểm:

1. Bộ lọc `Tất cả`/`Việc của tôi`/`Quá hạn` và QC4/QC9 dùng snapshot hiện tại.
2. Graphic workflow hiển thị số hồ sơ thật theo node; node đang chọn có trạng thái focus.
3. Lưới card phía dưới là danh sách hồ sơ canonical, lọc theo node đã chọn. Mỗi dossier chỉ xuất hiện một lần.
4. Card hiển thị mã hồ sơ, khách hàng, sản phẩm, bước hiện tại, chủ hồ sơ, deadline, điểm hoàn thiện, tài liệu thiếu và nút mở chi tiết.
5. `Bản đồ quy trình` là chế độ mặc định để workflow là điểm vào chính; chế độ `Việc cần làm` vẫn được giữ để người dùng xem thứ tự ưu tiên. Bản đồ thay thế chế độ Pipeline dạng cột.

Graphic tổng quan không có thao tác kéo thả để chuyển trạng thái. Bấm node chỉ lọc card; bấm card mở dossier chuẩn.

## Chi tiết một hồ sơ

Trong `PcnDossierDetailView`, khối `DossierStationSummary` được thay bằng `PcnWorkflowMap` dạng hồ sơ:

- header giữ mã hồ sơ, khách hàng, sản phẩm, trạng thái và nhận diện hồ sơ lịch sử;
- graphic nhấn node hiện tại, nối node đã hoàn tất, node tương lai và nhánh ngoại lệ bằng token màu thống nhất;
- node có thể bấm để chọn vùng dữ liệu hiện hành qua `getPcnDossierStationTab`, không tạo route hoặc tab mới;
- dưới graphic là một summary compact gồm chủ hồ sơ, deadline, độ hoàn thiện, cảnh báo mã PCN và thiếu dữ liệu;
- bước hiện tại có điểm mở checklist/tài liệu hoặc module chuyên môn phù hợp; upload vẫn gọi boundary hiện hành theo đúng `requirementId`;
- activity timeline hiện có tiếp tục lọc theo dossier và hiển thị ngôn ngữ nghiệp vụ; không hiển thị chain-of-thought hoặc log kỹ thuật.

Các vùng `Khu vực hồ sơ`, tài liệu chi tiết, sinh biểu mẫu, KQTN, phê duyệt và đóng gói vẫn giữ callback/quyền hiện tại. Graphic chỉ là lớp điều hướng và quan sát.

## Quyền và an toàn

- Node, số liệu, checklist và timeline là read-only projection theo snapshot mà user hiện tại được phép đọc.
- Không thêm endpoint chuyển trạng thái cho graphic. Nếu có nút chuyển bước, nó gọi callback/boundary hiện hành; server tiếp tục kiểm tra session, quyền, phạm vi lĩnh vực và transition policy.
- Không cho graphic tự approve, issue, sign, delete, đổi quyền hoặc thay đổi cấu hình.
- Upload file, sinh tài liệu và các mutation khác giữ private file boundary, audit và idempotency hiện có.

## Responsive, accessibility và hiệu năng

- Desktop ưu tiên: luồng chính nằm ngang, có thể cuộn ngang trong vùng graphic; không làm tràn toàn trang.
- Mobile/tablet: graphic chuyển thành timeline dọc hoặc các node cuộn ngang có nhãn rõ; card vẫn stack một cột.
- Mỗi node là button có nhãn accessible, trạng thái chọn dùng `aria-current`/`aria-pressed`, màu không phải tín hiệu duy nhất.
- Tính projection bằng pure functions, memoize ở component theo snapshot; không tạo interval, không render full document/file bytes và không gọi API riêng cho từng node.

## Kiểm thử và tiêu chí chấp nhận

- Pure projection map đúng từng status thật vào node, gồm completed/current/future/exception.
- Deadline quá hạn và cảnh báo tài liệu lấy từ dữ liệu thật; không có animation làm thay đổi trạng thái.
- Node dashboard lọc đúng card, giữ một card cho mỗi dossier và giữ bộ lọc quyền hiện hành.
- Bấm node trong detail mở đúng vùng dữ liệu hiện có; node không làm thay đổi database.
- Hồ sơ quay lại/khắc phục vẫn có activity history và nhánh hiển thị phù hợp.
- Viewer không thấy thao tác upload/chuyển bước; mutation vẫn bị server policy kiểm tra.
- Existing dossier status, document, generation, issuance và activity tests không bị phá.
- `npm run lint`, test suite, `npm run build` và kiểm tra runtime tại cổng `1357` phải thành công.

## Ngoài phạm vi

- Không xây graph editor, BPMN editor, kéo thả cấu hình workflow.
- Không tạo trang/sidebar mới chỉ cho Workflow Map.
- Không thay đổi trạng thái, schema, collection, quyền hoặc mã hóa hồ sơ hiện có.
