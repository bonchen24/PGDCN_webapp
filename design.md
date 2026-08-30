<!--
Author: Gemini
OS support: Web/Node
Description: File thiết kế chi tiết kiến trúc, dữ liệu, Frontend UI/UX và chuẩn tuân thủ cho TVCI Web App; PCN active profile là nguồn chuẩn cho ứng dụng Phòng Chứng nhận, phần DDT là legacy reference.
-->

# DESIGN DOCUMENTATION - TVCI WEB APP
## (PCN active profile và DDT legacy reference)

---

## 📄 MỤC LỤC
0. [PCN ACTIVE PROFILE](#0-pcn-active-profile)
1. [TỔNG QUAN DỰ ÁN & TRIẾT LÝ THIẾT KẾ FRONTEND](#1-tổng-quan-dự-án--triết-lý-thiết-kế-frontend)
2. [HỆ THỐNG MÀU SẮC & DESIGN TOKENS](#2-hệ-thống-màu-sắc--design-tokens)
3. [CHI TIẾT THIẾT KẾ CÁC CARD THÀNH PHẦN (CARD COMPONENTS)](#3-chi-tiết-thiết-kế-các-card-thành-phần-card-components)
   - 3.1. [Card Phiếu Yêu Cầu (Request Card)](#31-card-phiếu-yêu-cầu-request-card)
   - 3.2. [Card Mẫu Thử / Kho Mẫu (Sample Inventory Card)](#32-card-mẫu-thử--kho-mẫu-sample-inventory-card)
   - 3.3. [Card Lịch Thử Nghiệm (Schedule Item Card)](#33-card-lịch-thử-nghiệm-schedule-item-card)
   - 3.4. [Card Biên Bản Giao Nhận (Handover Doc Card)](#34-card-biên-bản-giao-nhận-handover-doc-card)
   - 3.5. [Card Nhật Ký Tổng Hợp (Summary Log Card)](#35-card-nhật-ký-tổng-hợp-summary-log-card)
4. [CỬA SỔ NỔI & FORM INTERACTIVE (MODAL DESIGN)](#4-cửa-sổ-nổi--form-interactive-modal-design)
   - 4.1. [RequestModal (Tạo/Sửa Phiếu & AI OCR)](#41-requestmodal-tạosửa-phiếu--ai-ocr)
   - 4.2. [TestExecutionModal (Nhập KQTN & AI Extract)](#42-testexecutionmodal-nhập-kqtn--ai-extract)
   - 4.3. [HandoverModal & PrintFormModal](#43-handovermodal--printformmodal)
   - 4.4. [ReportGeneratorView & KQTN Management](#44-reportgeneratorview--kqtn-management-trình-tạo-báo-cáo-thử-nghiệm--quản-lý-kqtn)
   - 4.5. [Phân Hệ Sổ Kết Quả Thử Nghiệm](#45-phân-hệ-sổ-kết-quả-thử-nghiệm-kqtn-redesign--modern-data-grid-architecture)
   - 4.6. [DocxSettingsModal & Quản Lý Biểu Mẫu DOCX Template](#46-docxsettingsmodal--quản-lý-biểu-mẫu-docx-template)
5. [CẤU TRÚC LAYOUT TỔNG THỂ & BẢNG ĐIỀU HƯỚNG](#5-cấu-trúc-layout-tổng-thể--bảng-điều-hướng)
   - 5.2. [Tỷ lệ hiển thị giao diện toàn cục](#52-tỷ-lệ-hiển-thị-giao-diện-toàn-cục)
   - 5.3. [Chuẩn responsive cho mobile](#53-chuẩn-responsive-cho-mobile)
6. [MÔ HÌNH DỮ LIỆU & SCHEMA (DATA MODELS & TYPES)](#6-mô-hình-dữ-liệu--schema-data-models--types)
7. [CƠ CHẾ BẢO MẬT, PHÂN QUYỀN & LƯU TRỮ](#7-cơ-chế-bảo-mật-phân-quyền--lưu-trữ)
   - 7.1. [Phân quyền Người dùng](#71-phân-quyền-người-dùng-rbac-matrix)
   - 7.2. [Lưu trữ dữ liệu Đa tầng](#72-lưu-trữ-dữ-liệu-đa-tầng-multi-tier-persistence)
   - 7.3. [Hợp đồng REST API & triển khai Docker](#73-hợp-đồng-rest-api--triển-khai-docker)
   - 7.4. [Hệ thống Thông báo & Hoạt động Nghiệp vụ](#74-hệ-thống-thông-báo--hoạt-động-nghiệp-vụ-business-notification-system)
   - 7.5. [Bảo toàn dữ liệu khi quản trị người dùng](#75-nguyên-tắc-bảo-toàn-dữ-liệu-nghiệp-vụ-khi-quản-trị-người-dùng-data-integrity--user-lifecycle-isolation)
   - 7.6. [Sao lưu & khôi phục dữ liệu](#76-chuẩn-hóa-sao-lưu--khôi-phục-dữ-liệu-toàn-diện-backup--restore-specification)
8. [QUY CHUẨN MÃ NGUỒN VÀ TUÂN THỦ (CODE CONVENTIONS)](#8-quy-chuẩn-mã-nguồn-và-tuân-thủ-code-conventions)

---

## 0. PCN ACTIVE PROFILE

Phần này là lớp đặc tả đang có hiệu lực cho ứng dụng **Phòng Chứng nhận (PCN) thuộc Trung tâm TVCI**. Các mục mô tả DDT ở phía dưới được giữ lại làm legacy reference trong giai đoạn chuyển đổi; khi có mâu thuẫn, các quy tắc trong PCN active profile và yêu cầu người dùng hiện tại được ưu tiên.

### 0.1. Phạm vi và thuật ngữ nghiệp vụ

- PCN quản lý quy trình chứng nhận từ tiếp nhận **Đề nghị** của khách hàng/đơn vị đề nghị đến hồ sơ đánh giá, kết nối phòng thử nghiệm, soát xét, phê duyệt, phát hành và lưu trữ.
- PCN không dùng khái niệm **Phiếu yêu cầu** cho đầu vào. `CertificationProposal` là chứng từ **Đề nghị** và là điểm bắt đầu của PCN.
- **PYC/Phiếu yêu cầu** chỉ là chứng từ outbound khi PCN gửi yêu cầu tới phòng thử nghiệm khác; PYC phải liên kết ngược về hồ sơ PCN và không được dùng thay cho Đề nghị.
- Không đưa thông tin, vai trò, menu hoặc quy trình của **Phòng Giám định** vào app PCN.
- Không có lịch thử nghiệm, lịch ITD/EMC, buồng thử hoặc auto-schedule. Điều hướng và hàng đợi nghiệp vụ tổ chức theo **Lĩnh vực**; khởi đầu có `QC4` — `Quy chuẩn 4` và `QC9` — `Quy chuẩn 9`.
- Một hồ sơ có thể liên kết nhiều Lĩnh vực và nhiều phòng thử nghiệm; không giả định một `primary field`.
- Danh sách khách hàng là danh mục PCN phải được giữ lại và sở hữu bản dữ liệu riêng sau migration/import có kiểm soát. Danh sách nhân sự PCN được nạp một lần từ nguồn roster được Admin PCN chỉ định (bao gồm bảng người dùng PCN đã được đối soát), có kiểm tra khóa định danh và trùng lặp; đây là import định danh có kiểm soát, không phải liên kết runtime với database DDT và không được nhập vào `customers`. Roster có thể bổ sung `email` và `phone` cho hồ sơ nhân sự; các trường này chỉ phục vụ liên hệ/hiển thị và không thay thế `username`, `systemRole`, `departmentRoleCode` hoặc phạm vi `fieldCodes` của PCN.
- Màn hình đăng nhập PCN xác thực qua endpoint server-side và phiên HttpOnly riêng (`pcn_certification_session`); endpoint đọc `systemUsers` từ database PCN riêng để xác thực danh sách đã import/cấu hình. Không trả password về client, không sao chép credential DDT, không khởi tạo sync/session DDT. Các API dữ liệu PCN và file private chỉ cho phép truy cập khi phiên này còn hợp lệ. Màn hình này phải dùng asset nhận diện IEMM/TV-CI hiện hành (`/icons/iemm-logo-32.png`) cùng nhãn `IEMM • TVCI`, còn màn hình DDT giữ nhận diện riêng.

### 0.2. Luồng hồ sơ PCN

`Đề nghị` → kiểm tra đầu vào/mẫu → phân công chuyên gia → kế hoạch đánh giá → đánh giá tại hiện trường → mã hóa mẫu theo lô → tạo PYC outbound nếu cần → giao nhận tới PTN → nhận KQTN từ PTN → xử lý bổ sung/khắc phục/thử lại → soát xét kỹ thuật → chuỗi phê duyệt → cấp số và phát hành GCN/QĐ/chứng thư → giao khách hàng → lưu trữ.

Sau khi cấp số, hồ sơ phải đi tuần tự qua `ISSUED` → `DELIVERED` → `ARCHIVED`. Thao tác giao khách hàng phải lưu thời điểm, người/đơn vị nhận và ghi chú giao nhận; chỉ hồ sơ đã giao mới được chuyển vào kho lưu trữ. Các chuyển tiếp tạo bộ trình duyệt (`TECHNICAL_REVIEW → WAITING_APPROVAL`), quyết định phê duyệt (`WAITING_APPROVAL → APPROVED` hoặc trả về kỹ thuật), cấp số (`APPROVED → ISSUED`), giao (`ISSUED → DELIVERED`) và lưu trữ (`DELIVERED → ARCHIVED`) phải đi qua boundary chuyên biệt của bộ phát hành để cập nhật đồng thời `IssuancePackage`, hồ sơ, bước liên quan và audit; mutation metadata chung của `CertificationDossier` phải từ chối các chuyển tiếp này. Không xóa hoặc ghi đè metadata phát hành khi lưu trữ.

Các trạng thái chính của hồ sơ là `DRAFT`, `INTAKE_REVIEW`, `AWAITING_DOCUMENTS`, `ASSIGNED`, `PLAN_PENDING_APPROVAL`, `FIELD_EVALUATION`, `AWAITING_SAMPLING`, `SENT_TO_LAB`, `AWAITING_RESULTS`, `CORRECTIVE_ACTION`, `TECHNICAL_REVIEW`, `WAITING_APPROVAL`, `APPROVED`, `ISSUED`, `DELIVERED`, `ARCHIVED`, `REJECTED`, `CANCELLED`, `ON_HOLD`. Lịch sử vòng thử lại và kết quả lần 1 không bị xóa khi kết quả lần 2 trở thành kết quả chính thức theo policy của nhánh.

### 0.3. UI, runtime và database topology

- Giữ app shell, sidebar/header/mobile navigation, card/modal/table, compact density, badge tokens, responsive behavior và Danh sách khách hàng của codebase hiện tại. Nội dung PCN không được để các card DDT cũ làm trung tâm.
- Điều hướng PCN áp dụng pattern đã ổn định của `ddt_webapp`: sidebar desktop một cấp, có thể thu gọn thành rail chỉ còn icon (`w-16`) hoặc mở rộng (`w-64`), trạng thái thu gọn được lưu riêng theo profile PCN, tiêu đề menu dùng tooltip khi ở rail. Các workspace chính được hiển thị trực tiếp thành một danh sách phẳng gồm **Tổng quan**, **Đề nghị**, **Hồ sơ**, **Mẫu theo lô**, **PYC gửi PTN**, **KQTN trả về**, **Phê duyệt & Phát hành**, **Kho hồ sơ** và **AI Trợ lý**. Các mục ít dùng hoặc quản trị được gom vào một bảng **Thêm** duy nhất, mở bằng một lần bấm và không có nhóm lồng nhau; khi đang ở mục phụ, nút Thêm vẫn thể hiện trạng thái đang chọn. Không lặp lại nhánh **Lĩnh vực nhanh** trong sidebar; Lĩnh vực vẫn được mở từ Dashboard hoặc workspace Hồ sơ. Mobile chỉ hiển thị các lối tắt chính ở bottom navigation và menu trượt chứa đầy đủ mục.
- Dashboard PCN chỉ dựng **một bề mặt công việc tại một thời điểm** để tránh lặp cùng một hồ sơ: mặc định là graphic `Bản đồ quy trình`, còn hàng đợi card `Việc cần làm` được mở bằng bộ chuyển chế độ ngay trong Dashboard. Bản đồ quy trình là graphic workflow có các nút bước và số liệu dẫn xuất; khi chọn một nút, lưới card hồ sơ bên dưới được lọc theo trạng thái thật. Hai chế độ dùng chung snapshot, bộ lọc và hàm mở dossier; không render đồng thời hai danh sách chứa cùng mã hồ sơ và không tạo route mới chỉ cho việc chuyển chế độ.
- Frontend đích là **Next.js App Router**; Vite chỉ là entrypoint chuyển tiếp cho đến khi cutover.
- Supabase chạy **self-host trên Docker Desktop**, không dùng Supabase Cloud. App/container PCN tham gia Docker network `supabase_default` và kết nối service PostgreSQL hiện hữu `supabase-db:5432`.
- PCN dùng database logic riêng, mặc định `pcn_certification`; DDT tiếp tục dùng `ddt_lab`. Hai profile không dùng chung logical database, credential runtime, collection runtime hoặc `app_documents`.
- Không tạo thêm PostgreSQL container, volume hoặc Supabase stack cho PCN. Khi development chạy ngoài Docker, dùng host port mapping hiện có của Supabase qua biến môi trường; không ghi secret hoặc sửa `.env` thực tế trong source change.
- Bộ lệnh phát triển phải có entrypoint tường minh `npm run dev:pcn` để tự đặt `APP_PROFILE=pcn` trước khi khởi động server native; `npm run dev` vẫn giữ hành vi tương thích profile DDT hiện tại khi người vận hành chưa đặt biến môi trường. Không dùng chung database chỉ vì khởi động nhầm profile.
- PostgreSQL là source of truth; REST API nội bộ giữ contract document JSONB, Zustand/IndexedDB chỉ là state/cache. Mọi mutation PCN phải có audit log và backup/restore riêng theo database PCN.
- Xác thực PCN phải thực hiện ở server: credential được đối chiếu với `systemUsers` trong database PCN, phiên được ký bằng secret ngoài source và đặt trong cookie `HttpOnly; SameSite=Lax` (thêm `Secure` ở production). Không dùng danh sách user phía client để quyết định đăng nhập; không lưu password PCN vào localStorage.
- Schema PCN bootstrap phải idempotent: chỉ tạo/seed `QC4` và `QC9` khi document chưa tồn tại, không ghi đè cấu hình Lĩnh vực đang được vận hành.
- Backup archive và retention phải phân biệt theo profile/database (`pcn_certification` hoặc `ddt_lab`), không cho phép profile này liệt kê, khôi phục hoặc xóa nhầm backup của profile kia.
- Archive PCN phải kiểm tra cả `pg_dump` và `pg_restore`; trước khi ghi archive và trước khi upload lại object khi restore, hệ thống phải đối chiếu `byteSize` và SHA-256 với manifest `file_assets`. Mismatch/thiếu object phải làm thao tác thất bại và không được báo khôi phục thành công; preflight object phải hoàn tất trước khi bắt đầu `pg_restore`.

### 0.4. Hợp đồng dữ liệu PCN

- Các entity chính: `PcnCertificationField`, `CertificationProposal`, `CertificationDossier`, `PcnSampleLot`, `PcnSampleFlowEvent`, `OutboundLabRequest`, `ReturnedTestResult`, `IssuancePackage`, `PcnApprovalStep`, `PcnDocumentRequirement`, `PcnDossierDocument`, `PcnGeneratedDocument`, `PcnTemplateDefinition`, `PcnOfficialGeneratedDocument` và `CustomerRef`.
- `systemUsers` là danh mục truy cập PCN tách biệt với dữ liệu nghiệp vụ; bản ghi nhân sự có thể lưu `email` và `phone` đã được đối soát từ roster. Username được giữ ổn định theo khóa hiện hữu hoặc khóa chuẩn hóa từ họ tên khi import mới, không lấy giá trị “Gán lĩnh vực” ngoài `QC4`/`QC9` để tự cấp phạm vi.
- Xóa nhân sự PCN chỉ đi qua endpoint Admin chuyên biệt, không dùng generic collection delete: server cấm tự xóa tài khoản đang đăng nhập, kiểm tra các tham chiếu active trong hồ sơ/phê duyệt/ủy quyền/task/tài liệu chất lượng, ghi audit `PCN_USER/DELETED`, rồi chỉ xóa bản ghi `systemUsers`; toàn bộ hồ sơ, file, task lịch sử và nhật ký nghiệp vụ vẫn được bảo toàn.
- `CertificationDossier.ownerUsername` là **chủ hồ sơ** duy nhất, được gán từ tài khoản PCN đang hoạt động và là người chịu trách nhiệm xuyên suốt từ Đề nghị, đánh giá, lô mẫu/PYC, KQTN, đóng gói đến trình lãnh đạo. `ownerUsername` tách biệt với `evaluatorUsername` và `reviewerUsername`; không cho nhập username tự do, thay đổi chủ hồ sơ phải qua mutation hồ sơ có kiểm tra phạm vi Lĩnh vực và audit. Khi tạo hồ sơ từ Đề nghị, server gán actor tạo hồ sơ làm chủ hồ sơ; chuyển cho người khác chỉ qua mutation hồ sơ đã kiểm tra policy.
- Quyền điều phối `ownerUsername` phải được kiểm tra ở server theo actor trong phiên: Admin hoặc tài khoản có chức vụ `LEADERSHIP` được giao/chuyển chủ hồ sơ trong phạm vi Lĩnh vực; nhân viên chỉ được tự nhận hồ sơ đang chưa có chủ, không được chuyển một hồ sơ đã có chủ sang người khác. Giao diện phải phản ánh cùng policy (nhân viên chỉ thấy lựa chọn tài khoản của chính mình khi hồ sơ trống và thấy read-only khi hồ sơ đã có chủ), nhưng server vẫn là lớp bảo vệ quyết định cuối cùng. `evaluatorUsername` và `reviewerUsername` tiếp tục dùng policy tài khoản hoạt động, không viewer và có giao với toàn bộ `fieldCodes` của hồ sơ.
- State machine hồ sơ vẫn giữ thứ tự và các trạng thái thật, không lưu thêm trạng thái dẫn xuất: `INTAKE` (`INTAKE_REVIEW`), `DOCUMENTS` (`AWAITING_DOCUMENTS`), `ASSIGNMENT` (`ASSIGNED`/`PLAN_PENDING_APPROVAL`), `EVALUATION` (`FIELD_EVALUATION`), `SAMPLING_LAB` (`AWAITING_SAMPLING`/`SENT_TO_LAB`), `RESULTS` (`AWAITING_RESULTS`), `CORRECTION` (`CORRECTIVE_ACTION`), `TECHNICAL_REVIEW` (`TECHNICAL_REVIEW`), `APPROVAL` (`WAITING_APPROVAL`/`APPROVED`), `ISSUANCE` (`ISSUED`), `DELIVERY_ARCHIVE` (`DELIVERED`/`ARCHIVED`). `ON_HOLD`, `REJECTED` và `CANCELLED` là nhánh ngoại lệ, luôn nhìn thấy lý do/trạng thái nhưng không làm sai thứ tự luồng chính. Các khóa `PcnPipelineStationKey`/catalog hiện có chỉ là adapter nội bộ để map trạng thái và tài liệu; UI không trình bày chúng như “trạm”, cột Kanban hoặc form riêng.
- Kiểm tra mã nguồn PCN phải xét toàn bộ `fieldCodes` đã liên kết với hồ sơ; không dùng `fieldCodes[0]` làm lĩnh vực chính. Nếu một mã chứng nhận được nhận diện hợp lệ theo bất kỳ lĩnh vực QC4/QC9 đang liên kết thì hiển thị phân loại đã nhận diện; nếu không, chỉ hiện cảnh báo cần đối chiếu, không tự sửa, tự suy diễn hoặc tự cấp mã.
- Mỗi nút trong graphic workflow phải hiển thị tên bước, trạng thái tổng hợp, số hồ sơ và điểm vào thao tác phù hợp. Danh sách tài liệu theo bước lấy từ `PcnDocumentRequirement.stages` kết hợp `stationKeys` khi loại tài liệu chỉ thuộc một hoặc vài bước; nếu cấu hình cũ chưa có `stationKeys` thì mới dùng tương thích theo `stages`. Upload từng mục dùng `PcnDossierDocument`/private Storage và giữ phiên cũ. Card hồ sơ hiển thị tiến độ, deadline và mục còn thiếu; người dùng không phải mở cột hoặc một màn hình bước riêng để biết việc tiếp theo.
- Khi graphic workflow hiển thị đồng thời nhiều Lĩnh vực, số liệu và danh mục tài liệu trên cùng một nút phải gộp các yêu cầu cùng mã loại (`PcnDocumentRequirement.code`) thành một dòng hiển thị, kèm các mã Lĩnh vực áp dụng theo thứ tự mã ổn định và trạng thái bắt buộc/điều kiện tổng hợp. Việc gộp chỉ là projection giao diện; các requirement ID, checklist, phiên file và policy từng Lĩnh vực vẫn giữ nguyên.
- Trong graphic workflow của chi tiết hồ sơ, người có quyền xử lý được mở nhanh đúng vùng dữ liệu hoặc tải phiên mới ngay cạnh mục tài liệu được chọn; nút upload phải gắn đúng `requirementId`, dùng cùng boundary upload/private Storage hiện hành và chỉ thêm phiên mới, không ghi đè phiên cũ. Người quản lý hoặc tài khoản chỉ xem chỉ thấy trạng thái read-only và nút mở file hiện tại; khu vực Tài liệu hồ sơ vẫn là nơi xem đầy đủ lịch sử phiên.
- Khi mở hành động từ card hoặc nút graphic workflow, modal hồ sơ phải khởi tạo đúng vùng làm việc theo bước: `INTAKE` → Đề nghị, `DOCUMENTS` → Tài liệu hồ sơ, `SAMPLING_LAB` → PYC/Giao nhận, `RESULTS`/`CORRECTION` → KQTN, `TECHNICAL_REVIEW` → Bảng kiểm trực quan trong Tài liệu hồ sơ, `APPROVAL`/`ISSUANCE`/`DELIVERY_ARCHIVE` → Phê duyệt & Phát hành; `EXCEPTIONS` mở rà soát lịch sử nếu có, nếu không mở Tài liệu hồ sơ. Ánh xạ chỉ là điều hướng dẫn xuất, không lưu thêm trạng thái.
- Lane `ON_HOLD`/`REJECTED`/`CANCELLED` là ngoại lệ, không có checklist riêng; giao diện phải hiển thị rõ “Không áp dụng” và tập trung vào lý do/trạng thái cùng nút xử lý ngoại lệ.
- Hồ sơ ở lane ngoại lệ phải giữ `exceptionReason` là ghi chú nghiệp vụ do người thao tác xác nhận; server yêu cầu lý do không rỗng khi chuyển sang `ON_HOLD`, `REJECTED` hoặc `CANCELLED`, giới hạn độ dài hợp lý và ghi thay đổi trong audit. Khi đang ở lane ngoại lệ, graphic và chi tiết phải hiển thị lý do đã lưu (hoặc nhãn trung tính cho dữ liệu lịch sử cũ chưa có lý do); không suy diễn lý do từ tên file, trạng thái hoặc đường dẫn. Khi chuyển tiếp khỏi ngoại lệ, lý do cũ được giữ để truy vết và không được dùng làm lý do mới nếu người thao tác không xác nhận lại.
- Điểm hoàn thiện hồ sơ cho nhà quản lý là chỉ số read-only dẫn xuất từ snapshot hiện tại, gồm tối thiểu: tỷ lệ mục checklist bắt buộc đã có phiên hợp lệ, các trường đầu vào cốt lõi đã đủ, chủ hồ sơ đã được gán và điều kiện của bước hiện tại. Điểm phải hiển thị cùng tử số/mẫu số và danh sách thiếu; không được suy diễn tài liệu đã có chỉ từ tên file, trạng thái hoặc ngày cập nhật.
- Hộp thoại phê duyệt phải có một thẻ **Bằng chứng kiểm tra** read-only của đúng hồ sơ đang trình, lấy từ cùng snapshot checklist và phép tính hoàn thiện: điểm phần trăm, tử số/mẫu số bắt buộc, nhóm tài liệu còn thiếu theo bước và trạng thái dữ liệu lịch sử nếu có. Người phê duyệt phải có nút mở thẳng chi tiết hồ sơ tại vùng Tài liệu/kiểm tra trực quan để xem phiên file qua private boundary; thẻ này không tự phê duyệt, không tạo snapshot hay collection riêng.
- Trong cùng thẻ **Bằng chứng kiểm tra**, người phê duyệt phải thấy projection read-only của mã PCN từ cùng phép tính hồ sơ: mã gốc người vận hành nhập, mã chuẩn hóa, nhóm nhận diện và trạng thái **Cần đối chiếu mã nguồn** nếu chưa nhận diện. Cảnh báo này chỉ cung cấp bằng chứng để lãnh đạo kiểm tra trực quan; không tự sửa mã, không tự chặn thao tác phê duyệt tại UI và không làm mất cảnh báo khi hồ sơ chuyển bước.
- Card trong danh sách **Phê duyệt & Phát hành** cũng phải hiển thị ngắn gọn đúng projection mã PCN này (mã gốc và trạng thái/nhóm nhận diện), để người quản lý nhận ra hồ sơ cần đối chiếu trước khi mở modal; card chỉ read-only và không tạo projection riêng.
- Dashboard PCN ưu tiên **graphic workflow và card hồ sơ**; mỗi card hiển thị mã hồ sơ, khách hàng/sản phẩm, chủ hồ sơ, bước hiện tại, hạn, thanh hoàn thiện, tài liệu còn thiếu và nút mở đúng hồ sơ. Card chưa có chủ hồ sơ phải hiển thị điểm vào **Nhận hồ sơ** cho nhân viên đủ điều kiện; thao tác này dùng cùng policy self-claim của hàng đợi và vẫn qua server mutation/audit. Bộ lọc `Tất cả`/`Việc của tôi`/`Quá hạn` là bộ lọc trên snapshot card, không biến bước nhóm/phòng ban thành việc của cá nhân nếu chưa có assignee phù hợp.
- Để giảm phần trùng lặp, Dashboard chỉ có một bề mặt card hồ sơ để thao tác: Pipeline Kanban là danh sách card chuẩn, Hàng đợi cần xử lý chỉ là projection gọn để ưu tiên và dẫn tới card đó; không render thêm danh sách “hồ sơ gần đây” lặp lại mã/khách hàng/trạng thái/nút thao tác. Các module khác chỉ hiển thị dữ liệu chuyên biệt của mình và phải mở về dossier chuẩn khi cần chỉnh sửa, không tạo bản sao card hoặc mutation riêng.
- Trong modal chi tiết hồ sơ, ngay dưới header phải có **graphic workflow của hồ sơ** dẫn xuất từ cùng pipeline: bước hiện tại, hành động tiếp theo, chủ hồ sơ, điểm hoàn thiện, số mục tài liệu của bước và danh sách tài liệu còn thiếu. Graphic có nút mở checklist/tải file và mở khu vực sinh biểu mẫu phù hợp; các vùng dữ liệu cũ chỉ là chi tiết bổ sung, không được là nơi duy nhất để biết việc tiếp theo.
- Để giảm tối đa việc chuyển tab dữ liệu, modal chi tiết dùng một bộ chọn **Khu vực hồ sơ** compact thay cho việc phô toàn bộ dải tab cùng lúc. Bộ chọn phải giữ đầy đủ các vùng nghiệp vụ hiện hành, mở đúng vùng khi nhận `initialTab` từ pipeline và không làm thay đổi các callback/quyền xử lý; graphic workflow và khối tóm tắt bước là điểm vào chính cho thao tác tiếp theo.
- Khu vực **kiểm tra trực quan hồ sơ** trong chi tiết phải là read-only đối với người quản lý: gom checklist theo đúng **bước pipeline** (`stationKeys`), đồng thời giữ nhóm giai đoạn (`stages`) cho cấu hình cũ chưa có định tuyến chi tiết; hiển thị tổng số mục, bắt buộc/điều kiện, trạng thái phiên hiện tại, số phiên, tên file, thời điểm/người tải và nút mở file qua private boundary. Với phiên hiện tại có MIME PDF hoặc ảnh raster an toàn, bảng kiểm cung cấp thêm **Xem nhanh** ngay trong hộp thoại hồ sơ; định dạng DOC/DOCX và định dạng không hỗ trợ vẫn dùng nút mở file riêng tư, không chuyển file qua endpoint khác. Bảng kiểm phải chỉ ra ngay nhóm còn thiếu và nhóm đã đủ, nhưng không suy diễn trạng thái từ tên file; thao tác tải phiên mới vẫn dùng đúng quyền và endpoint upload hiện hành. Để giảm trùng lặp khi quét nhanh, chỉ bước hiện tại mở sẵn; các bước khác thu gọn nhưng vẫn có thể mở trực tiếp để kiểm tra. Danh sách lịch sử phiên và thao tác tải phiên cho toàn bộ yêu cầu phải nằm trong một vùng **Chi tiết phiên và tải tài liệu** thu gọn mặc định, mở khi người dùng cần thao tác sâu.
- **Sổ điều hành** là báo cáo dẫn xuất read-only từ cùng snapshot hồ sơ, pipeline và checklist hiện tại; mỗi dòng phải cho quản lý thấy bước hiện tại, chủ hồ sơ, điểm hoàn thiện, tử số/mẫu số tài liệu bắt buộc và số mục còn thiếu. Nút mở hồ sơ phải đi vào đúng dossier chuẩn để tiếp tục xử lý; không tạo collection hay bản sao nghiệp vụ riêng, không tính một phiên tài liệu nếu `currentVersionId` không trỏ tới version hợp lệ.
- Sổ điều hành phải có bộ lọc cục bộ, không đổi dữ liệu nguồn, cho phép quản lý xem nhanh `Tất cả`/`Còn thiếu tài liệu bắt buộc`/`Đã đủ tài liệu bắt buộc` và `Tất cả chủ hồ sơ`/`Chưa phân công`/`Đã phân công`. Hai bộ lọc phải dựa đúng vào `missingRequiredCount` và `ownerUsername` của row dẫn xuất; trạng thái hiển thị phải giữ nguyên số liệu hoàn thiện, danh sách thiếu và nút mở dossier chuẩn.
- Các bộ hồ sơ tham chiếu QC4/QC9 hoàn thiện trong Desktop cho thấy bộ tối thiểu cần hỗ trợ các nhóm `Đề nghị chứng nhận`, `Báo giá/hợp đồng` và hồ sơ thương mại/import khi có, `Biên bản lấy mẫu`, `Biên bản giao/nhận thiết bị`, `PYC`, `KQTN/báo cáo và ảnh bằng chứng`, `Giấy chứng nhận`, `Quyết định`, hồ sơ giao khách và bản lưu. Dữ liệu tham chiếu dùng để chuẩn hóa mã trường/mã chứng từ và tạo mẫu trống; không tự đưa thông tin khách hàng, ảnh hoặc byte hồ sơ thật vào seed/runtime.
- Lần khảo sát nguồn PCN đã đối chiếu các nhánh có thời điểm hoàn tất khoảng tháng 06–07/2026, trong đó có nhóm QC4 `Hồ sơ lô hàng mới/0665…` và nhóm QC9 `KQ chứng nhận QC9-26/IEMM 0105…`; các trường chuẩn hóa được rút ra gồm mã hồ sơ, sản phẩm/model, mục đích, quy chuẩn, biên bản lấy/giao mẫu, PYC, KQTN, GCN/QĐ và trạng thái giao/lưu. Chỉ dùng cấu trúc và nhãn trường làm dữ liệu mẫu trống, không copy khách hàng, ảnh, số chứng thư hoặc byte tệp thật.
- Module biểu mẫu phải có các bản sinh nội bộ liên kết cùng context gồm `PROPOSAL_FORM`, `ASSIGNMENT_FORM`, `EVALUATION_PLAN`, `FIELD_INSPECTION`, `SAMPLE_TAKING`, `SAMPLE_CODING`, `EVALUATION_REPORT`, `SAMPLE_HANDOVER`, `SAMPLE_RETURN`, `LAB_REQUEST` và bìa hồ sơ; `SAMPLE_TAKING` là biên bản lấy mẫu theo nguồn BM-QT-09-03 đã khảo sát, dùng cùng lô mẫu nhưng không thay thế biên bản ký chính thức. Người dùng chọn biểu mẫu từ card/bước hiện tại, xem preflight nguồn read-only rồi sinh Word/PDF. Tại bước `INTAKE`, nút mở khu vực sinh biểu mẫu phải chọn mặc định `PROPOSAL_SUMMARY` để đối chiếu nhanh thông tin liền mạch; `PROPOSAL_FORM` vẫn luôn có trong bộ chọn để lập bản Đề nghị đầy đủ. GCN/QĐ/chứng thư vẫn đi qua template chính thức đã được phê duyệt, không dùng bản sinh nội bộ thay thế.
- Màn hình `Biểu mẫu PCN` phải có catalog **Bộ hồ sơ mẫu trống** cho `QC4` và `QC9`, được dẫn xuất từ checklist chuẩn đã khảo sát các bộ hoàn tất tháng 06–07/2026. Catalog phải hiển thị cấu trúc theo đúng bước nghiệp vụ (`stationKeys`) và vẫn giữ nhóm giai đoạn (`stages`) để đối chiếu cấu hình cũ, cùng nhãn bắt buộc/điều kiện, tên biểu mẫu nguồn của phòng và các loại Word/PDF nội bộ có thể sinh. Mỗi profile QC4/QC9 phải liệt kê cả `PROPOSAL_SUMMARY` trong nhóm biểu mẫu sinh nội bộ để người vận hành có bản tóm tắt Đề nghị dùng chung context trước khi lập hồ sơ đầy đủ. Mỗi mã yêu cầu phải có ma trận đối chiếu read-only tới tên mẫu/thư mục nguồn đã quan sát; nếu nguồn không có mẫu độc lập thì phải ghi rõ tình trạng chưa có nguồn và rào chắn duyệt, không tự suy diễn thành biểu mẫu chính thức. Một yêu cầu xuất hiện ở nhiều bước vẫn giữ nguyên `stationKeys` để điều hướng, nhưng catalog chỉ hiển thị đầy đủ một lần ở bước đầu tiên và các bước sau dùng thẻ gọn **Dùng lại tại bước…** trỏ về mã yêu cầu ban đầu, tránh người dùng hiểu nhầm phải tạo/upload nhiều tài liệu khác nhau. Catalog không lưu collection mẫu riêng, không chứa khách hàng/ảnh/số chứng thư/byte hồ sơ thật và không thay thế luồng tạo Đề nghị. Khi kiểm chứng asset private, MIME kỳ vọng phải lấy theo `format` của catalog: `DOC` dùng `application/msword`, `DOCX` dùng `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Mỗi `CertificationProposal` được tạo đồng thời với đúng một `CertificationDossier` và checklist `PcnDossierDocument` ban đầu trong cùng transaction. Đề nghị lưu `dossierId`, hồ sơ lưu `proposalId`, trạng thái khởi tạo là `INTAKE_REVIEW`; retry cùng mã Đề nghị phải idempotent và trả lại checklist đã commit mà không tạo bản ghi/audit trùng.
- Boundary tiếp nhận phải kiểm tra cùng một bộ trường bắt buộc ở UI và server trước khi ghi: khách hàng và địa chỉ, ít nhất một thông tin liên hệ/định danh thuế, địa chỉ/kho liên quan, tên/kiểu/model/nhãn hiệu/thông số/nhà sản xuất, số lượng mẫu là số nguyên dương và ít nhất một Lĩnh vực không trùng. Lỗi phải trả theo tên trường để người vận hành sửa trước khi tạo Đề nghị; không dùng cảnh báo phía client thay cho kiểm tra server.
- Form tạo Đề nghị mới không được tự chọn sẵn `QC4` hoặc Lĩnh vực đầu tiên; trạng thái ban đầu phải để trống để người vận hành xác nhận rõ một hoặc nhiều Lĩnh vực. Khi sửa Đề nghị, phải giữ nguyên tập `fieldCodes` đã lưu và không cho thay đổi qua boundary sửa đầu vào.
- Đề nghị đã tạo có thể được **sửa thông tin đầu vào có kiểm soát** qua `POST /api/pcn/proposals/:proposalId` với whitelist các trường tiếp nhận (`channel`, khách hàng/snapshot, địa chỉ/kho, thông tin sản phẩm, nhà sản xuất và số lượng). Server phải khóa đồng thời Đề nghị và hồ sơ liên kết, chạy lại cùng policy validation, cập nhật snapshot khách hàng trên hồ sơ để tránh lệch dữ liệu khi sinh biểu mẫu, cập nhật `updatedAt` và ghi audit cho cả hai entity trong một transaction. Chỉ cho sửa khi hồ sơ đang `INTAKE_REVIEW` hoặc `AWAITING_DOCUMENTS`; hồ sơ lịch sử còn `PENDING_REVIEW` phải sửa tại tab **Rà soát nhập lịch sử**, còn hồ sơ đã sang bước vận hành sau đó phải dùng quy trình nghiệp vụ tương ứng. Mã Đề nghị, liên kết hồ sơ, Lĩnh vực, trạng thái và thời điểm tiếp nhận không sửa qua boundary này; các bản sinh tài liệu phải nhận biết `updatedAt` mới để hiện **Cần sinh lại**.
- Cập nhật metadata/trạng thái hồ sơ phải đi qua `POST /api/pcn/dossiers/:dossierId`, không dùng generic `/api/db`. Server khóa đúng hồ sơ, chỉ nhận whitelist trường nghiệp vụ (`status`, người phụ trách, hạn xử lý, `evaluationAt`, `effectiveAt`, phương thức), kiểm tra chuyển trạng thái theo policy, kiểm tra các mốc ngày theo định dạng lịch `YYYY-MM-DD` hợp lệ (hoặc giá trị rỗng để xóa), cập nhật `updatedAt` và ghi audit trong cùng transaction. Gửi lại cùng payload đã commit phải trả snapshot hiện tại mà không tạo audit trùng; payload khác sau khi đã commit phải bị từ chối khi có khóa retry.
- Trong chi tiết hồ sơ, người dùng PCN có quyền chỉnh sửa được phân công `evaluatorUsername`, `reviewerUsername` và hạn xử lý `targetDate` từ danh sách tài khoản PCN đang hoạt động, có phạm vi Lĩnh vực phù hợp; không cho nhập username tự do. Phương thức chứng nhận cũng phải được chọn bằng control giới hạn ở `METHOD_1`, `METHOD_5` hoặc `METHOD_7`, không cho nhập tự do; thay đổi phương thức phải đi chung mutation idempotent, ghi audit và làm các bộ phát hành/tài liệu chính thức nhận biết context mới. Sau khi hồ sơ đã có `IssuancePackage`, phương thức được khóa để không làm lệch mã template GCN/QĐ; nếu cần sửa phải xử lý theo quy trình phát hành tương ứng. Form phải hiển thị rõ đây là phân công/phương thức/hạn vận hành đã xác nhận, gửi chung một mutation idempotent qua endpoint hồ sơ, và hàng đợi/Sổ điều hành phải phản ánh ngay snapshot sau khi lưu. Người xem chỉ được xem, không được sửa.
- `CertificationDossier` phải lưu `customerSnapshot` tại thời điểm chuyển từ Đề nghị sang hồ sơ. Các mốc vận hành đã xác nhận như `evaluationAt` và `effectiveAt` được lưu riêng khi có dữ liệu; không suy diễn từ tên file, ghi chú hoặc ngày cập nhật. Danh mục khách hàng có thể được cập nhật về sau nhưng không được làm thay đổi tên/thông tin khách hàng đã ghi nhận trong lịch sử hồ sơ. Các module downstream (Sổ điều hành, mẫu/lô, PYC, KQTN, phát hành, kho hồ sơ và rà soát lịch sử) phải ưu tiên snapshot trên hồ sơ; chỉ dùng snapshot của Đề nghị làm fallback cho dữ liệu lịch sử chưa có `CertificationDossier.customerSnapshot`.
- Danh mục `customers` PCN phải cập nhật qua `POST /api/pcn/customers`, `POST /api/pcn/customers/:customerId` và xóa qua `DELETE /api/pcn/customers/:customerId`; server khóa khách hàng, chuẩn hóa mã/tên, xử lý đổi mã trong cùng transaction và ghi audit `PCN_CUSTOMER` cùng business write. Retry không được tạo khách hàng hoặc audit trùng; thay đổi danh mục không cập nhật ngược `customerSnapshot` đã chốt trong hồ sơ. Trước khi xóa, server phải kiểm tra toàn bộ `app_documents` có `data.customerId` trỏ tới mã khách hàng; nếu còn tham chiếu thì từ chối với `409` và không xóa/audit, chỉ cho xóa khi không còn tham chiếu trực tiếp.
- Collection PCN khởi đầu: `pcnCertificationFields`, `certificationProposals`, `certificationDossiers`, `pcnDocumentRequirements`, `pcnTemplateDefinitions`, `pcnOfficialGeneratedDocuments`, `dossierDocuments`, `dossierAttachments`, `pcnGeneratedDocuments`, `pcnSampleLots`, `pcnSampleRoutes`, `pcnSampleFlowEvents`, `labRequests`, `returnedResults`, `approvalSteps`, `issuancePackages`, `pcnSignerDelegations`, `pcnQualityDocuments`, `customers`, `systemUsers`, `pcnDepartmentRoles`, `notifications`, `activityLogs` và `systemConfig` trong database PCN.
- `systemUsers` của PCN tách hai thuộc tính: `systemRole` (`admin`, `staff`, `viewer`) để kiểm soát quyền truy cập và `departmentRoleCode` để biểu diễn chức vụ/nghiệp vụ phòng ban. `fieldCodes` là phạm vi Lĩnh vực phụ trách độc lập; không dùng `position`, tên hiển thị hoặc role DDT để authorize request.
- Import nhân sự PCN giữ username ổn định, chuyển tài khoản DDT `guest/Khách` thành `systemRole=staff`, gán Lương Xuân Hùng là `systemRole=admin`, không sao chép mật khẩu DDT và không gộp các tài khoản chỉ vì trùng họ tên. Chức vụ chưa được xác nhận dùng `UNASSIGNED` để Admin phân loại sau.
- Màn hình **Nhân sự PCN** dùng chung shell/card density hiện tại nhưng tách khỏi **Danh sách khách hàng**; Admin có thể thêm/sửa/khóa tài khoản, gán `departmentRoleCode`, gán phạm vi `fieldCodes` và reset mật khẩu. Nhân sự không phải khách hàng và không xuất hiện trong collection `customers`.
- `GET /api/pcn/users` và `GET /api/db/systemUsers` ở profile PCN chỉ trả snapshot đã loại bỏ password; `POST/PUT /api/pcn/users` và reset mật khẩu chỉ cho `systemRole=admin`, mọi thay đổi nhân sự ghi `activityLogs` với entity `PCN_USER`. Người không hoạt động không được mở phiên PCN mới.
- `OutboundLabRequest` lưu trạng thái chứng từ PYC, thời điểm giao/nhận và ghi chú giao nhận; đây là metadata nghiệp vụ của PCN, không phải lịch thử nghiệm. Policy tạo PYC phải có định danh, hồ sơ, Lĩnh vực và phòng thử nghiệm nhận; nếu nối lô/tuyến thì phải có đủ cả hai liên kết để server kiểm tra cùng transaction. `targetDate` của PYC là tùy chọn nhưng nếu có phải là ngày lịch `YYYY-MM-DD` hợp lệ; `handoverAt`/`receivedAt` nếu do request gửi lên phải là timestamp ISO-8601 UTC hợp lệ, không chấp nhận ngày giờ địa phương mơ hồ hoặc ngày bị JavaScript tự chuẩn hóa. Nếu cả hai mốc có mặt thì thời điểm PTN nhận không được sớm hơn thời điểm bàn giao.
- `PcnSampleLot` là đơn vị mã hóa mẫu theo lô của PCN; `lotCode` là định danh nghiệp vụ tương đương vai trò của `sealStamp` bên DDT nhưng không dùng tên/format tem niêm phong DDT. Một lô thuộc đúng một hồ sơ, có số lượng là số nguyên dương, thông tin mẫu và các tuyến phòng thử; dữ liệu phân số/0/âm phải bị chặn ở policy trước khi ghi. `fieldCodes` của lô phải là tập con không rỗng của các Lĩnh vực trên hồ sơ; khi chọn hồ sơ, UI chỉ hiển thị các Lĩnh vực của hồ sơ đó và server vẫn là lớp kiểm tra cuối cùng. `receivedAt` nếu được gửi khi tạo lô phải là timestamp ISO-8601 UTC hợp lệ.
- Khi nhập `lotCode`, giao diện phải chạy rà soát mã theo toàn bộ `fieldCodes` của hồ sơ và hiển thị đồng thời mã nguồn, mã chuẩn hóa, nhóm nhận diện và cảnh báo đối chiếu nếu chưa khớp mẫu quan sát. QC4/QC9 chấp nhận các mã hồ sơ 4 số hoặc mã ghép theo lô dạng `####-##`; QC9 có thể xuất hiện tiền tố `IEMM`. Đây là projection cảnh báo để người vận hành kiểm tra, không tự sửa, không tự sinh và không tự cấp mã; server vẫn lưu chuỗi đã xác nhận sau khi kiểm tra các ràng buộc liên kết/trùng lặp.
- Các tuyến mẫu khởi đầu gồm `PERFORMANCE` (Phòng thử nghiệm Hiệu suất), `EMC` (Phòng thử EMC) và `ELECTRICAL_SAFETY` (Phòng thử An toàn điện). Mỗi tuyến có trạng thái riêng `PENDING` → `SENT` → `RECEIVED` → `RESULT_RETURNED` → `RETURNED_TO_PCN`/`CLOSED`; lô có thể đi nhiều tuyến mà không tạo lịch thử.
- `PcnSampleFlowEvent` ghi append-only các lần tạo lô, bàn giao, phòng thử nhận, trả KQ, trả mẫu, lỗi mẫu và điều chỉnh; bảng cell tổng hợp hiển thị mỗi lô một dòng, mỗi phòng thử một cell trạng thái, kèm vị trí hiện tại và lần cập nhật cuối. `pcnSampleRoutes` giữ snapshot trạng thái hiện tại của từng tuyến để truy vấn nhanh.
- Tạo lô mẫu phải đi qua `POST /api/pcn/samples/lots`; server kiểm tra hồ sơ tồn tại, Lĩnh vực thuộc hồ sơ, mã lô không trùng và ghi trong một transaction: `pcnSampleLots`, các `pcnSampleRoutes`, event `LOT_CREATED`, backlink `CertificationDossier.sampleLotIds` và audit `PCN_SAMPLE_LOT`. Retry cùng `lot.id` chỉ trả snapshot đã tồn tại nếu payload nghiệp vụ giống nhau; payload khác phải bị từ chối, không ghi đè.
- Cập nhật tuyến mẫu phải đi qua `POST /api/pcn/samples/routes/:routeId/status` với `idempotencyKey` an toàn. Server khóa tuyến, lô và hồ sơ, dùng policy chuyển trạng thái chuẩn, tính lại `PcnSampleLot.status/currentLocation` từ toàn bộ tuyến, cập nhật `dossier.updatedAt`, append một `PcnSampleFlowEvent` và audit trong cùng transaction. Retry cùng khóa trả kết quả đã commit, không tạo event/audit trùng; trạng thái bị bỏ qua bước hoặc khóa đã dùng cho payload khác phải bị từ chối.
- `pcnSampleLots`, `pcnSampleRoutes` và `pcnSampleFlowEvents` không được ghi qua generic `/api/db` (kể cả Admin); chỉ endpoint mẫu chuyên biệt hoặc job import được kiểm soát mới được mutation. `pcnSampleFlowEvents` vẫn append-only và không được xóa.
- Tạo/cập nhật `OutboundLabRequest` (PYC gửi PTN) phải đi qua `POST /api/pcn/lab-requests` và `POST /api/pcn/lab-requests/:requestId/status`, không ghi trực tiếp qua generic `/api/db`. Server khóa PYC và hồ sơ, kiểm tra lĩnh vực thuộc hồ sơ, mã PYC không trùng và ghi backlink `CertificationDossier.labRequestIds`, flow trạng thái và audit trong cùng transaction; retry cùng định danh/payload không tạo bản ghi hoặc audit trùng.
- PYC có thể liên kết `sampleLotId`/`sampleRouteId` khi chứng từ phục vụ một tuyến mẫu đã mã hóa. Server chỉ chấp nhận liên kết khi tuyến thuộc đúng lô và lô thuộc đúng hồ sơ; khi PYC chuyển `SENT`/`RECEIVED`/`RESULT_RETURNED` hoặc `CANCELLED`, snapshot tuyến được đồng bộ trong cùng transaction. Khi tuyến đã liên kết chuyển trạng thái tương ứng từ màn hình mẫu, snapshot PYC cũng được cập nhật, không tạo lịch thử nghiệm và không sao chép thông tin mẫu thủ công.
- PYC có thể sinh tài liệu quản lý `LAB_REQUEST` từ chính `OutboundLabRequest` đã lưu, dùng chung context với hồ sơ/Đề nghị và lô/tuyến liên kết (nếu có). Word/PDF của PYC chỉ là chứng từ outbound nội bộ để gửi PTN, không phải GCN/QĐ, không được nhập lại thủ công các trường nguồn, và phải ghi `labRequestId`, `contextHash`, `sourceUpdatedAt` cùng pointer private. Preflight PYC phải chặn khi chưa chọn đúng PYC thuộc hồ sơ; retry cùng PYC/context/định dạng phải idempotent và không tạo bản trùng.
- `ReturnedTestResult` giữ toàn bộ vòng KQTN; `isOfficial` chỉ là cờ dẫn xuất được cập nhật theo policy của nhánh, không xóa kết quả vòng trước. `receivedAt` của KQTN phải là timestamp ISO-8601 UTC hợp lệ, không dùng ngày giờ địa phương mơ hồ hoặc giá trị bị JavaScript tự chuẩn hóa.
- Khi snapshot runtime phát hiện một KQTN thiếu khóa/liên kết bắt buộc, module **KQTN trả về** phải giữ bản ghi để truy vết nhưng hiển thị nhãn `Cần rà soát`, liệt kê nguyên nhân read-only và không cho gắn/ghi đè file trên bản ghi lỗi; cảnh báo không tự sửa, xóa hoặc tạo audit/mutation.
- Ghi nhận KQTN phải đi qua `POST /api/pcn/results`, không ghi `returnedResults` hoặc cập nhật hồ sơ/PYC trực tiếp qua generic `/api/db`. Server khóa theo thứ tự nhất quán lô → tuyến → hồ sơ → PYC, kiểm tra quan hệ và trạng thái, ghi/cập nhật toàn bộ các vòng KQTN cùng `isOfficial`, chuyển PYC và tuyến về `RESULT_RETURNED`, tính lại trạng thái lô, cập nhật backlink/trạng thái hồ sơ và ghi audit trong cùng transaction. Retry cùng `result.id` và payload chuẩn hóa trả snapshot đã commit, không tạo bản ghi/event/audit trùng; cùng ID nhưng payload khác bị từ chối.
- Việc gắn file báo cáo KQTN vẫn dùng file boundary private hiện hành sau khi metadata KQTN đã commit; upload byte và ghi pointer là hai boundary có chủ đích. Sau khi upload thành công, pointer phải được gắn qua `POST /api/pcn/results/:resultId/file` để server khóa KQTN, kiểm tra asset trỏ đúng `returnedResults/resultId/fileAssetId`, cập nhật metadata và audit trong một transaction; không gọi generic `/api/db`.
- File báo cáo KQTN trả về được lưu bằng `ReturnedTestResult.fileAssetId`; pointer này tham chiếu `file_assets`/Supabase Storage private và không chứa byte hoặc Base64 trong JSONB.
- `PcnApprovalStep` là các bước độc lập, tuần tự và append/update có kiểm soát. Người dùng thực tế, vai trò chuyên gia và người ký được map từ `systemUsers` PCN; quyền truy cập lấy từ `systemRole`, còn phân công/chức vụ lấy từ `departmentRoleCode` và `fieldCodes`. Khi quyết định một bước, server phải đọc lại actor đang đăng nhập từ `systemUsers`, từ chối tài khoản không hoạt động/viewer, kiểm tra `assigneeUsername` nếu bước đã giao đích danh, đối chiếu chức vụ phù hợp với vai trò bước và phạm vi `fieldCodes` của hồ sơ; UI phải dùng cùng policy để chỉ hiển thị nút duyệt/trả khi actor hiện tại đủ điều kiện, còn bằng chứng hồ sơ vẫn read-only.
- `IssuancePackage` là bộ metadata/pointer cho GCN và Quyết định; vòng đời phát hành gồm `DRAFT`, `PENDING_APPROVAL`, `RETURNED`, `APPROVED`, `ISSUED`, `DELIVERED`, `ARCHIVED`. Cấp số phát hành chỉ xảy ra sau khi chuỗi phê duyệt hoàn tất. Khi giao/lưu trữ, lưu `deliveryRecipient`, `deliveredAt`, `deliveryNote` và `archivedAt` nếu có; `deliveredAt` nhận ngày lịch từ giao diện hoặc timestamp UTC, nhưng phải kiểm tra ngày hợp lệ và chuẩn hóa thành timestamp ISO-8601 UTC trước khi ghi hồ sơ/audit.
- Tạo bộ phát hành và chuỗi phê duyệt phải đi qua `POST /api/pcn/issuance`, quyết định từng bước qua `POST /api/pcn/issuance/:issuanceId/approval/:stepId`, cấp số qua `POST /api/pcn/issuance/:issuanceId/issue`, giao khách qua `POST /api/pcn/issuance/:issuanceId/deliver` và lưu trữ qua `POST /api/pcn/issuance/:issuanceId/archive`. Mỗi boundary khóa các bản ghi bộ phát hành, hồ sơ và bước liên quan, cập nhật trạng thái cùng audit trong một transaction; retry cùng `idempotencyKey` và payload trả snapshot đã commit, khóa dùng cho payload khác bị từ chối.
- Quyền người ký phải được kiểm tra lại ở server khi cấp số, không tin `signerUsername` do client gửi. Người ký trực tiếp phải là tài khoản PCN đang hoạt động, không phải `viewer`, có `departmentRoleCode = LEADERSHIP`; không được nhập một username không tồn tại hoặc tự suy diễn người ký từ tên hiển thị.
- Ủy quyền người ký dùng collection PCN riêng `pcnSignerDelegations`, mỗi bản ghi phải có `grantorUsername`, `delegateUsername`, `fieldCodes`, `effectiveFrom`, `effectiveUntil`, `reason`, `approvedByUsername` và `status`. Chỉ bản ghi `ACTIVE`, còn hạn, đúng Lĩnh vực của hồ sơ, người ủy quyền đang hoạt động có quyền `LEADERSHIP`, người được ủy quyền đang hoạt động và người phê duyệt đang hoạt động mới cho phép cấp số; hết hạn hoặc thu hồi phải tự động bị từ chối. Tạo/thu hồi ủy quyền đi qua endpoint chuyên biệt, chỉ Admin PCN, và ghi audit; không cho ghi collection này qua generic DB endpoint.
- UI cấp số chỉ hiển thị danh sách người ký trực tiếp/được ủy quyền hợp lệ tại thời điểm cấp số, nêu rõ `Trực tiếp` hoặc `Ủy quyền` và thời hạn; không cho nhập tự do. Nếu không có người ký hợp lệ thì giữ thao tác ở trạng thái chưa sẵn sàng và hiển thị lý do.
- Form tạo ủy quyền phải để trống phạm vi Lĩnh vực khi mở mới; Admin phải chọn rõ một hoặc nhiều Lĩnh vực trước khi lưu, không tự lấy Lĩnh vực hoạt động đầu tiên làm phạm vi ủy quyền.
- `issuancePackages` không được ghi trạng thái `ISSUED` qua generic `PUT`/batch DB; mọi lần cấp số phải đi qua `POST /api/pcn/issuance/:issuanceId/issue` với `idempotencyKey` để tái kiểm tra người ký, ngày cấp, điều kiện hồ sơ và ghi nhận phát hành/audit. Retry cùng khóa và payload trả snapshot đã commit; payload khác dùng lại khóa bị từ chối.
- Mọi mutation PCN (Đề nghị, hồ sơ, PYC/giao nhận, KQTN, phê duyệt, phát hành và danh mục khách hàng) phải ghi một `activityLogs` record append-only trong database PCN, có entity PCN, actor snapshot, thời gian và thay đổi chính.
- UI của các form mutation phát hành (cấp số, giao khách hàng, lưu trữ) phải khóa nút xác nhận trong khi request đang chờ, giữ modal nếu server từ chối và xử lý lỗi bất đồng bộ để không gửi trùng thao tác hoặc tạo unhandled promise rejection.
- UI của mọi form mutation PCN có thể tạo bản ghi hoặc chuyển trạng thái (Đề nghị, lô/tuyến mẫu, PYC, KQTN, phát hành, tài liệu) phải khóa thao tác tương ứng trong khi request đang chờ và giữ nguyên dữ liệu form khi server từ chối; các callback bất đồng bộ phải được bắt lỗi tại boundary UI.
- Với các activity PCN có tác động lớn (`PCN_PROPOSAL`, `PCN_DOSSIER`, `PCN_SAMPLE_LOT`, `PCN_LAB_REQUEST`, `PCN_RESULT`, `PCN_APPROVAL`, `PCN_ISSUANCE`), database tạo thêm đúng một notification có ID ổn định `pcn-notif-<activityId>` trong cùng transaction sau khi activity được append. Notification chỉ là bản tin vận hành, không thay thế audit; activity nguồn `IMPORT`/`RESTORE` không tự phát notification. Việc đánh dấu đã đọc hoặc xóa notification không được sửa/xóa activity log.
- Shell PCN phải tải collection `notifications` riêng của database PCN, chỉ hiển thị các notification PCN theo `targetRole`/`targetUsernames`, giới hạn 50 bản ghi mới nhất; click notification điều hướng về đúng hồ sơ hoặc module liên quan. Trạng thái đọc/xóa dùng collection notification được phép thay đổi, không ghi audit nghiệp vụ mới.
- Cổng kiểm chứng cutover PCN phải là read-only và xuất cùng một snapshot đối soát gồm số lượng/hash của `certificationProposals`, `certificationDossiers`, `file_assets`, `notifications` và `activityLogs`; snapshot phải báo riêng orphan link hồ sơ, pointer file không hợp lệ, notification ngoài namespace `pcn-notif-` và activity entity ngoài allowlist PCN. Các sai lệch chỉ được báo để rà soát, không tự xóa collection, khôi phục bản ghi hoặc sửa dữ liệu.
- Job dọn dữ liệu PCN chỉ dùng cho remediation có kiểm soát ngoài UI: mặc định dry-run, phải chỉ rõ archive backup PCN đã kiểm chứng và chuỗi xác nhận khi apply, chạy trong transaction và ghi audit `SYSTEM`. Riêng orphan KQTN chỉ được dọn khi payload hoàn toàn rỗng, không có `dossierId`/`labRequestId`, không có file asset và không có liên kết ngược; không được dùng job này để xóa hoặc sửa KQTN nghiệp vụ còn dữ liệu.
- Shell PCN phải có nhánh `Nhật ký hệ thống` cho mọi tài khoản đã đăng nhập; nhánh này dùng chung `ActivityLogView` và các endpoint cursor/KPI `/api/activity-logs*`, nhưng danh sách người dùng để lọc phải lấy từ `systemUsers` PCN, không lấy danh mục nhân sự DDT. Trang chỉ đọc và không tải toàn bộ lịch sử vào Zustand để phục vụ màn hình nhật ký.
- Trong profile PCN, KPI nhật ký phải phân nhóm `PCN_PROPOSAL`/`PCN_DOSSIER` vào Phiếu, `PCN_RESULT` vào KQTN, `PCN_LAB_REQUEST`/`PCN_SAMPLE_LOT` vào Biên bản và các entity PCN còn lại vào Khác; không dùng các entity DDT (`REQUEST`, `KQTN_RECORD`, `HANDOVER_DOC`, `SCHEDULE`) để tính KPI PCN.
- `requests`, `handoverDocs`, `kqtnRecords` của DDT không được tự động map sang entity PCN và không được đọc/ghi từ runtime PCN. Nếu cần tra cứu legacy, phải có read-only bridge được duyệt riêng.
- File GCN/QĐ/chứng thư/phụ lục dùng metadata/pointer tới Supabase Storage; `IssuancePackage.fileAssetIds` chỉ lưu các mã asset, không nhúng byte file hoặc ảnh OCR vào JSONB.
- Sau khi upload file phát hành thành công, pointer phải được gắn qua `POST /api/pcn/issuance/:issuanceId/file`; server khóa bộ phát hành và hồ sơ, kiểm tra asset trỏ đúng `issuancePackages/issuanceId/fileAssetIds`, cập nhật danh sách pointer và audit trong một transaction. Retry cùng asset không tạo pointer/audit trùng và không được gọi generic `/api/db`.
- Mỗi hồ sơ có một checklist tài liệu hợp nhất từ các Lĩnh vực đã chọn. `PcnDocumentRequirement` là cấu hình loại tài liệu/điều kiện; `stages` giữ nhóm hồ sơ để tra cứu/kiểm tra trực quan, còn `stationKeys` định tuyến chính xác các mục theo bước pipeline. `PcnDossierDocument` là metadata liên kết hồ sơ với phiên file hiện tại và lịch sử phiên cũ. Các biểu mẫu vận hành nội bộ `ASSIGNMENT_FORM`, `EVALUATION_PLAN`, `FIELD_INSPECTION`, `SAMPLE_TAKING` và `SAMPLE_CODING` phải xuất hiện như mục checklist của đúng bước; riêng `SAMPLE_TAKING` dùng chung yêu cầu checklist lấy/giao mẫu hiện hành để không tạo mục trùng cho cùng một lô/tuyến. Bản sinh nháp không tự được coi là phiên đã hoàn tất, người dùng phải tải bản đã xác nhận qua upload boundary. Thiếu tài liệu chỉ hiển thị cảnh báo, không khóa chuyển trạng thái.
- Một Đề nghị có một bộ hồ sơ/card duy nhất. Card hiển thị mã Đề nghị, mã hồ sơ, khách hàng, sản phẩm, Lĩnh vực, trạng thái và số lượng tài liệu; mở card sẽ mở modal toàn bộ văn bản trong hồ sơ. Các thao tác là mở, sửa metadata, tải tài liệu, hủy mềm; không xóa cứng.
- Danh sách Đề nghị phải hỗ trợ lọc cục bộ theo từ khóa (mã Đề nghị/mã hồ sơ/khách hàng/sản phẩm/model), trạng thái hồ sơ và Lĩnh vực; chỉ lọc snapshot đã tải, không tạo query/mutation riêng và phải hiển thị số lượng kết quả trên tổng số hồ sơ.
- Màn hình danh sách phải có nhãn **Quản lý Đề nghị** và dùng lưới card responsive theo kiểu card-driven của DDT: mỗi `CertificationProposal` là đúng một card, card gắn với dossier liên kết và chỉ hiển thị thông tin vận hành cốt lõi cùng các nút mở/sửa. Không dùng bảng dòng dày đặc hoặc tạo card trùng cho cùng một Đề nghị; bộ lọc và form tạo/sửa nằm ngoài lưới card.
- Hồ sơ được tạo từ Haimy phải hiển thị nhãn nguồn tích hợp và các định danh ngoài đã được staging xác nhận (`externalRegistrationId`, `externalBatchId`, `externalCertificateId` nếu có) ngay trong chi tiết hồ sơ; chỉ đọc, không hiển thị raw payload/credential và không cho sửa trực tiếp metadata nguồn.
- **Sổ điều hành PCN** là báo cáo dẫn xuất read-only từ `certificationProposals`, `certificationDossiers`, `pcnSampleLots`, `pcnSampleRoutes`, `labRequests`, `returnedResults` và `issuancePackages`; không tạo collection hay bản sao nghiệp vụ riêng. Mỗi dòng tương ứng một hồ sơ/mã Đề nghị và hiển thị mã đăng ký, khách hàng snapshot, sản phẩm/model, Lĩnh vực, số lượng mẫu đã ghi nhận, nơi nhận/đang giữ mẫu hiện tại, tiêu chuẩn áp dụng, ngày nhận hồ sơ, ngày nhận mẫu gần nhất, ngày đánh giá/hiệu lực nếu có, trạng thái hồ sơ, tình trạng tuyến phòng thử/KQTN, số phát hành và ngày trả mẫu khi dữ liệu đã được ghi nhận.
- Dashboard PCN phải có **Hàng đợi cần xử lý** dẫn xuất từ lifecycle hồ sơ và các bản ghi liên kết, không tạo collection nhiệm vụ riêng. Mỗi dòng giữ `dossierId`, mã hồ sơ, bước nghiệp vụ tiếp theo, nhóm phụ trách, `targetDate`, mức ưu tiên (`OVERDUE`, `DUE_SOON`, `NORMAL`) và cờ hồ sơ được phân công cho người dùng hiện tại; thứ tự ưu tiên quá hạn → sắp đến hạn → bình thường, sau đó theo hạn và lần cập nhật. `DUE_SOON` là hồ sơ có `targetDate` hợp lệ trong 3 ngày tới. Bộ lọc tối thiểu gồm `Tất cả`, `Việc của tôi`, `Quá hạn`; ngày hạn chỉ lấy từ `CertificationDossier.targetDate`, không suy diễn từ tên file, ghi chú hoặc trạng thái. Bấm một dòng phải mở đúng hồ sơ hoặc module nghiệp vụ tương ứng; riêng `ON_HOLD`/rà soát nhập lịch sử phải dẫn tới **Kiểm kê hồ sơ lịch sử**.
- Khi Hàng đợi mở một module nghiệp vụ, callback điều hướng phải truyền cả `targetSection` và `dossierId` của row; đây là context tạm thời trên client, không phải trạng thái mới. Module đích phải lọc danh sách hoặc khởi tạo form theo đúng dossier đó và hiển thị mã hồ sơ đang được tập trung, để người dùng không phải tìm lại hồ sơ. Với `historicalDiscovery`, context mở dossier review chuẩn hoặc giữ nguồn kiểm kê read-only; không dùng context để tự chọn candidate hay tự import.
- Khi người dùng bấm một thông báo PCN, shell phải mở đúng `CertificationDossier` nếu snapshot hiện tại tìm được liên kết và chọn vùng chi tiết phù hợp với loại hoạt động: `PCN_PROPOSAL` → Đề nghị, `PCN_SAMPLE_LOT`/`PCN_LAB_REQUEST` → Mẫu/PYC, `PCN_RESULT` → KQTN, `PCN_APPROVAL`/`PCN_ISSUANCE` → Phê duyệt & Phát hành. Với thông báo chỉ xác định được hồ sơ, không ép một vùng sai; để chi tiết tự chọn vùng theo bước hiện tại. Điều hướng này chỉ là context tạm thời, không tạo mutation hay trạng thái dẫn xuất mới.
- `assigneeUsername` trong hàng đợi chỉ được lấy từ trường phân công có ý nghĩa với đúng bước: `evaluatorUsername` cho `ASSIGNED`/`FIELD_EVALUATION`/`CORRECTIVE_ACTION` và `reviewerUsername` cho `TECHNICAL_REVIEW`. Các bước thuộc nhóm/phòng ban nhưng hồ sơ chưa có trường cá nhân tương ứng phải để trống assignee và không được rơi vào bộ lọc `Việc của tôi`; không dùng người đánh giá/người soát xét làm fallback cho tiếp nhận, điều phối, phê duyệt, phát hành hoặc lưu trữ.
- Dashboard PCN phải có cảnh báo **Toàn vẹn dữ liệu** dạng read-only, dẫn xuất từ các snapshot runtime hiện có. Policy kiểm tra khóa định danh (bao gồm ID trùng trong cùng collection), liên kết bắt buộc và liên kết chéo giữa hồ sơ–Đề nghị–PYC–KQTN–phát hành–lô/tuyến; bản ghi lỗi phải được nêu rõ collection, ID và nguyên nhân để người có quyền rà soát. Cảnh báo không tự sửa, xóa, quarantine hoặc tạo mutation/audit; không suy diễn dữ liệu thiếu và không chặn lifecycle hiện hành. Báo cáo không chứa byte file, credential hay dữ liệu ngoài phạm vi PCN.
- Sidebar PCN có module **Kiểm tra dữ liệu** để xem toàn bộ báo cáo toàn vẹn hiện tại, phân nhóm theo collection và mở đúng module nghiệp vụ để rà soát. Module chỉ đọc, không có nút sửa/xóa/quarantine, không ghi activity log và không thay thế các boundary mutation chuyên biệt; dữ liệu lỗi vẫn phải được giữ nguyên để truy vết.
- Nút mở của từng cảnh báo toàn vẹn phải giữ cả `collection` và `entityId` để shell tìm đúng dossier liên quan trong snapshot. Nếu bản ghi có dossier liên kết, mở trực tiếp dossier và vùng chi tiết phù hợp (`proposal`, `lab`, `results` hoặc `issuance`); nếu là khách hàng hoặc liên kết mồ côi thì mở module tra cứu tương ứng mà không giả mạo ID thành mã Lĩnh vực. Điều hướng chỉ đọc, không tự sửa/xóa/quarantine và không tạo audit.
- Sổ điều hành phải chịu được dữ liệu lịch sử thiếu trường và nhiều dòng sản phẩm: không suy diễn ngày hoặc trạng thái từ tên file/ghi chú; các trường chưa có hiển thị `Chưa cập nhật`. Bộ lọc theo năm, Lĩnh vực, trạng thái và từ khóa tra cứu mã/khách hàng/sản phẩm; mở một dòng chỉ điều hướng tới đúng `CertificationDossier` để xem/chỉnh sửa theo quyền hiện hành.
- Sổ điều hành có thể xuất CSV từ snapshot đang lọc để phục vụ báo cáo nội bộ. `Số lượng mẫu` chỉ là tổng `PcnSampleLot.quantity` của các lô mẫu liên kết; không có lô thì để trống/chưa cập nhật và không dùng `CertificationProposal.quantity` làm giá trị thay thế. `Nơi nhận/đang giữ mẫu` chỉ lấy các giá trị `PcnSampleLot.currentLocation` hiện đang được ghi nhận, không đổi tên thành lịch sử giao nhận và không suy diễn từ ghi chú/tên file. `Tiêu chuẩn` chỉ lấy `PcnCertificationField.standardRefs` của các lĩnh vực trên hồ sơ/Đề nghị; không tự suy diễn tiêu chuẩn từ mã lĩnh vực, tên file hoặc nội dung ghi chú. Thứ tự và số lượng cột header phải khớp tuyệt đối với từng giá trị dòng, gồm riêng `Chỉ tiêu thử` trước `Tình trạng tuyến PTN`; export không chứa password, byte file, đường dẫn Desktop hoặc dữ liệu ngoài phạm vi PCN; viewer chỉ được đọc/xuất báo cáo, không có mutation riêng cho Sổ.
- Chi tiết hồ sơ có phần **Mốc vận hành** để staff/Admin nhập hoặc hiệu chỉnh `Trưởng đoàn đánh giá`, `evaluationAt` và `effectiveAt`; viewer chỉ xem. Các mốc này là dữ liệu được xác nhận, không tự suy diễn từ trạng thái, tên file hoặc ghi chú; mỗi lần sửa vẫn dùng mutation hồ sơ và audit hiện hành.
- File boundary PCN dùng endpoint riêng `POST /api/pcn/files` và `GET /api/pcn/files/:assetId`, kiểm kê `file_assets` bằng `sourceCollection`, `sourceDocumentId`, `sourceJsonPath`, checksum và object path; bucket lấy từ `PCN_STORAGE_BUCKET`/cấu hình Storage hiện hành, không hard-code quyết định bucket mới. Boundary upload từ giao diện chỉ nhận các nguồn đã tồn tại và có pointer chuyên biệt (`dossierDocuments`, `pcnQualityDocuments`, `returnedResults`, `issuancePackages`); asset của template, tài liệu quản lý và tài liệu chính thức chỉ được tạo ở server/import boundary tương ứng. Server phải kiểm tra `sourceJsonPath` cố định là `fileAssetId` cho KQTN/chất lượng/phát hành; với checklist phải khớp `requirementId` và ID checklist dẫn xuất trước khi nhận byte. Pointer KQTN dùng endpoint chuyên biệt nêu trên và không được ghi qua generic DB.
- Gói tải hồ sơ PCN dùng boundary đọc riêng `GET /api/pcn/dossiers/:dossierId/package`; server tự dựng danh sách từ các pointer thuộc đúng hồ sơ, chỉ cho phép nguồn `dossierDocuments`, `dossierAttachments`, `pcnGeneratedDocuments`, `pcnOfficialGeneratedDocuments`, `returnedResults` và `issuancePackages`. ZIP phải có `manifest.json` chứa provenance/checksum/byte size; entry của tài liệu sinh nếu có phải giữ thêm `kind`, `format`, `contextHash` và `sourceUpdatedAt` để đối chiếu lineage Word/PDF sau khi tải. Server phải kiểm tra lại byte size và SHA-256 trước khi đóng gói, loại trùng asset và từ chối pointer không khớp; không nhận danh sách asset tùy ý từ trình duyệt, không ghi audit/mutation mới và không chứa collection DDT. Chi tiết hồ sơ được phép hiển thị một bảng tóm tắt read-only các nhóm thành phần và số lượng trước khi tải; đây chỉ là projection từ snapshot client, còn boundary server vẫn là nơi quyết định danh sách cuối cùng và kiểm tra provenance/checksum.
- Thời hạn lưu trữ theo hồ sơ PCN phải là metadata cấu hình; giá trị tham chiếu ban đầu là bản cứng 1 năm và bản mềm 10 năm. Khi hồ sơ chuyển `ARCHIVED`, hệ thống ghi `retention` trên `CertificationDossier` với ngày bắt đầu từ `archivedAt`, ngày rà soát bản cứng/bản mềm và mã phiên chính sách; giao diện phải ghi rõ đây là chính sách tham chiếu, chưa tự động hủy file hay hồ sơ.
- `retention.legalHold` và `retention.legalHoldReason` cho phép giữ hồ sơ khỏi mọi quy trình hủy thủ công trong tương lai; đặt/gỡ giữ pháp lý phải giới hạn trong quyền PCN phù hợp, cập nhật hồ sơ cùng audit log `USER_REVIEW`, không sửa `file_assets`, object Storage hoặc lịch sử phát hành.
- Import danh mục khách hàng từ export DDT phải là job one-time có dry-run, khóa ổn định, count/hash và báo cáo dòng lỗi/trùng khóa; chỉ apply sau xác nhận, merge không làm mất dữ liệu liên hệ hiện hữu và ghi audit nguồn `IMPORT`. Retry cùng nguồn phải bỏ qua bản ghi không thay đổi, không cập nhật timestamp hoặc tạo audit trùng; chỉ bản ghi mới/thay đổi mới được ghi. Job không được migrate `requests`, PYC hoặc KQTN DDT. Cổng kiểm chứng cutover khi nhận file nguồn phải đối chiếu read-only theo đúng chính sách khóa ổn định của migration, báo riêng số khóa thiếu/thừa, số khóa khác dữ liệu, số trường khác theo tên trường và số dòng nguồn/đích không có khóa; không in dữ liệu liên hệ vào báo cáo mặc định, không tự merge/apply.
- Màn hình **Danh sách khách hàng PCN** phải có thao tác **Đối soát nguồn** read-only cho file CSV/JSON do người vận hành chọn. File chỉ được đọc và chuẩn hóa trong trình duyệt; giao diện hiển thị count, khóa thiếu/thừa, trường lệch và dòng lỗi/trùng, không upload, không tự merge/apply và không hiển thị giá trị liên hệ trong phần tóm tắt đối soát.
- Khi nguồn chỉ có tên hiển thị và xuất hiện một tên viết tắt có thể là alias của đúng một tên pháp lý đã có trong đích (ví dụ mã ngắn nằm như một token riêng trong tên đích), đối soát phải tách riêng **ứng viên alias cần xác nhận** khỏi khóa thiếu. Đây chỉ là gợi ý read-only để giảm trùng danh mục; không tự đổi khóa, không tự merge, không tự coi cutover đã đạt và vẫn phải giữ khóa nguồn/đích cùng báo cáo cho tới khi người có thẩm quyền xác nhận.
- Haimy hiện chưa có API, schema export, credential hoặc quy ước retry/idempotency được cung cấp trong workspace hay bộ hồ sơ PCN; vì vậy PCN chỉ triển khai **adapter nhập một lần có kiểm soát** ở trạng thái `UNCONFIGURED`, không tự kết nối, không watcher và không ghi ngược sang Haimy. Discovery phải ghi rõ capability đã biết/chưa biết, định danh liên kết dự kiến (`externalRegistrationId`, `externalBatchId`, `externalCertificateId`) và các điểm cần xác nhận trước khi bật.
- Adapter Haimy chỉ nhận một payload export do người vận hành chủ động chọn, chuẩn hóa thành bản ghi staging `PCN_HAIMY_IMPORT` với `batchId` và khóa idempotency ổn định theo `sourceSystem + externalRegistrationId` (fallback có kiểm soát theo hash payload). Payload thiếu định danh bắt buộc, trùng định danh với nội dung khác hoặc không ánh xạ được hồ sơ phải bị từ chối/đưa vào rà soát; không được tự tạo GCN/QĐ, mã hóa mẫu, lô hàng hoặc ghi dữ liệu pháp lý. Chỉ sau khi có contract upstream được xác nhận mới thiết kế boundary apply vào các entity PCN và retry theo mã phản hồi thực tế.
- Boundary staging Haimy thực tế dùng `POST /api/pcn/integrations/haimy/import` và collection PCN riêng `pcnHaimyStaging`; UI chỉ nhận file JSON/CSV/XLSX do người vận hành chọn, hiển thị kế hoạch rà soát và không gửi file/credential lên Haimy. Server phải chuẩn hóa lại payload, không lưu raw payload hoặc credential, ghi từng bản ghi theo `idempotencyKey` ổn định và trả `idempotent` khi retry cùng fingerprint. Cùng định danh nhưng fingerprint khác phải trả conflict, không ghi đè; bản ghi `NEEDS_REVIEW`/`CONFLICT` không được dùng để tự tạo hồ sơ, lô mẫu, GCN/QĐ hay bất kỳ dữ liệu pháp lý nào. Boundary này chỉ là staging/import nội bộ PCN và phải ghi activity `IMPORT`, không phát sinh notification nghiệp vụ.
- Chỉ người vận hành có quyền PCN mới được thực hiện bước duyệt tường minh từ staging `READY_FOR_REVIEW` qua `POST /api/pcn/integrations/haimy/promote`. Server phải khóa bản ghi staging, lấy lại bản ghi chuẩn hóa theo `idempotencyKey`, yêu cầu người dùng bổ sung các trường intake PCN còn thiếu, rồi trong **một transaction** tạo đúng một `CertificationProposal`, một `CertificationDossier`, checklist tài liệu và metadata truy vết Haimy; sau đó cập nhật staging thành `PROMOTED` kèm `proposalId`, `dossierId`, thời điểm/người duyệt và fingerprint của bộ thông tin đã bổ sung. Retry cùng fingerprint trả lại đúng snapshot đã tạo; khác fingerprint trả conflict; không overwrite. Bước này chỉ tạo hồ sơ nội bộ, không ghi ngược Haimy và không tự tạo khách hàng, lô mẫu, PYC, KQTN, GCN/QĐ hay notification nghiệp vụ.
- Snapshot staging Haimy đang hiển thị có thể xuất thành CSV ngay trên trình duyệt để rà soát nội bộ; export chỉ gồm các trường chuẩn hóa, trạng thái và lỗi/conflict, không chứa raw payload, credential, byte file, đường dẫn Desktop hay dữ liệu ngoài phạm vi PCN. Export phải phản ánh đúng danh sách sau bộ lọc hiện tại và không tạo mutation/audit mới.

### 0.5. Nguồn tham chiếu và ranh giới

`Cau_Hoi_PhongVan_PCN QC4,9.docx` và `Nhanh Giam dinh Chung nhan.md` chỉ là nguồn tham chiếu để trích xuất nghiệp vụ chứng nhận. Các nội dung liên quan Phòng Giám định/inspection bị loại khỏi phạm vi PCN; các thuật ngữ và quyết định người dùng nêu trong hội thoại là ràng buộc cao hơn nội dung legacy trong hai tài liệu.

### 0.6. AI Trợ lý PCN (Agent Workspace)

- AI Trợ lý là một module chính trong Sidebar, đặt sau `Kiểm kê hồ sơ lịch sử` và trước `Đề nghị`; không dùng floating chatbot làm giao diện chính. Trang là workspace cá nhân gồm công việc, deadline, hồ sơ ưu tiên, completeness, đề xuất và chat nghiệp vụ.
- Context Agent phải được dựng server-side từ phiên PCN HttpOnly và dữ liệu hiện tại của `systemUsers`, `CertificationDossier`, `CertificationProposal`, checklist tài liệu, PYC/KQTN, bước review/phê duyệt và assignment. Không nhận context quyền truy cập do client tự khai báo; không gửi password, token, raw file bytes hoặc toàn bộ database vào LLM.
- `systemRole` là quyền truy cập hệ thống; `departmentRoleCode` là loại trách nhiệm; `fieldCodes` là phạm vi QC4/QC9; assignment là quan hệ công việc. Capability của Agent phải được derive từ các lớp này và phải kiểm tra lại bằng permission policy server trước mọi action ghi.
- `fieldCodes` phải được áp dụng như boundary lọc server-side trước khi dựng work queue và mọi projection Agent; tài khoản có scope rỗng mới được xem toàn bộ Lĩnh vực, còn tài khoản có scope phải chỉ thấy hồ sơ thuộc các mã QC4/QC9 được giao.
- Capability chỉ mô tả loại hỗ trợ nghiệp vụ; từng tool và action phải có permission tương ứng được kiểm tra độc lập trên server. Không cho phép một context còn capability nhưng đã mất permission gọi tool hoặc xác nhận action.
- Workspace phải có vùng `Hoạt động nghiệp vụ` chỉ hiển thị trạng thái các bước dữ liệu đã thực hiện (dựng context, nạp work trong phạm vi, kiểm tra deadline, tính ưu tiên); không hiển thị chain-of-thought hoặc reasoning nội bộ của LLM.
- Ngày hạn của task và KPI Agent phải được so sánh theo lịch Việt Nam `Asia/Ho_Chi_Minh`, kể cả khi dữ liệu lưu dưới dạng timestamp UTC; tool và workspace không được dùng phép cắt chuỗi UTC riêng rẽ.
- Agent chỉ được lập **đề xuất phân công** từ hồ sơ chưa có chủ, workload hiện tại và người đang hoạt động trong cùng phạm vi `fieldCodes`; đề xuất mang `DRAFT/PROPOSE`, phải giữ projection bằng chứng workload của ứng viên (số hồ sơ, quá hạn, deadline gần, rủi ro) để quản lý kiểm tra, không tự ghi `ownerUsername` và không biến thành thao tác phân công nếu chưa qua boundary nghiệp vụ riêng.
- Các projection `myWork`, task cá nhân, deadline, recommendation KQTN/tài liệu mới và workload phải dùng dữ liệu thật, cùng `buildPcnWorkQueueRows`, `buildPcnDossierCompleteness` và `getPcnPipelineStation`. Metrics phải phân biệt hồ sơ đang xử lý với task đang mở/quá hạn; recommendation deterministic phải bao phủ tối thiểu hồ sơ quá hạn, task quá hạn, thiếu dữ liệu, hồ sơ chưa phân công, KQTN mới và tài liệu checklist mới cập nhật trong cửa sổ 3 ngày lịch Việt Nam, cùng workload rủi ro; nếu schema chưa xác nhận nguồn upload thì dùng nhãn trung tính, không gọi đó là khách hàng bổ sung; Priority score là rule deterministic backend; LLM chỉ diễn giải projection và không được tự bịa nghiệp vụ.
- Agent chỉ được dùng tool whitelist dạng đọc/tra cứu/analyze, gồm cả `get_my_tasks`, `get_overdue_tasks`, `get_recent_test_results` và `get_pending_test_results`; không có arbitrary SQL, arbitrary HTTP, shell, code execution hoặc dynamic tool từ prompt. Nội dung hồ sơ và message là dữ liệu không tin cậy, không được coi là system instruction.
- Action chia `READ`, `DRAFT/PROPOSE`, `EXECUTE_WITH_CONFIRMATION`. Action ghi phải qua user confirmation, server-side authentication/authorization/payload validation và audit. Agent không tự approve, issue, sign, delete, đổi permission, tạo admin, đổi cấu hình hoặc digital signature.
- Khi người dùng đề nghị tạo task có hạn tương đối (`hôm nay`, `ngày mai`) hoặc ngày cụ thể, Agent chỉ chuẩn hóa thành ngày lịch Việt Nam trong payload `DRAFT/PROPOSE`; card xác nhận phải hiển thị hạn đã chuẩn hóa và không ghi task trước khi người dùng xác nhận.
- PCN hiện không có entity task; khi cần action tạo task, dùng collection `pcnTasks` tối thiểu và không nhân bản dữ liệu dossier. Các collection `agentConversations`, `agentMessages`, `agentActions`, `agentAuditLogs`, `pcnTasks` chỉ truy cập qua endpoint Agent chuyên biệt; `agentAuditLogs` append-only, không mở generic CRUD cho client.
- LLM provider phải là abstraction server-side, cấu hình qua `AGENT_ENABLED`, `AGENT_PROVIDER`, `AGENT_MODEL` và secret ngoài source. Khi LLM không khả dụng, các câu hỏi chuẩn vẫn trả lời từ tool deterministic bằng dữ liệu thật.
- Chat “việc của tôi” phải trả cả danh sách hồ sơ và task cá nhân; chat “quá hạn/chậm” phải phân biệt hai loại và hiển thị `task_list` khi có task. Workspace hiển thị khu vực `Task của tôi` khi có task mở, không tạo dữ liệu giả khi collection task rỗng.
- Workspace được phép khôi phục cuộc hội thoại Agent gần nhất của đúng tài khoản qua endpoint đọc chuyên biệt; server phải xác thực phiên, giới hạn theo `userUsername`, sắp thứ tự bằng `createdAt` của message với tie-breaker `user` trước `assistant` và chỉ trả message/response blocks đã lưu, không mở generic CRUD hoặc trả raw tool result. Các action hiển thị lại từ lịch sử vẫn phải tái kiểm tra ownership, permission, payload và trạng thái ở boundary confirm; tải lại lịch sử không tự thực hiện mutation.
- Briefing của tài khoản quản lý phải tách “việc trực tiếp của tôi” khỏi backlog toàn phòng và nêu các hồ sơ ưu tiên của phòng; khi phân tích một hồ sơ, Agent phải trả missing labels thực tế từ checklist và có thể tạo `draft` yêu cầu khách hàng bổ sung mà không ghi dữ liệu nghiệp vụ.
- `SAMPLE_COORDINATOR` và các capability theo dõi KQTN phải có shortcut “Chờ kết quả KQTN” và truy vấn qua tool riêng, lọc theo hồ sơ được giao; không suy luận trạng thái KQTN từ tên file hoặc nội dung chat.

- Chính sách nhận diện mã PCN ban đầu được rút ra từ các bộ hồ sơ Desktop đã khảo sát: mã hồ sơ/đăng ký QC4 thường là chuỗi số 4 chữ số và có thể có nhánh `-NN` (`0665`, `0109-01`); QC9 có thể giữ mã số tương tự, mã có tiền tố `IEMM`, mã Quyết định/Giấy chứng nhận theo nhánh và số PYC dạng số. Hệ thống phải giữ số 0 ở đầu, chuẩn hóa khoảng trắng/dấu gạch khi hiển thị và gắn cảnh báo **Cần đối chiếu mã nguồn** cho giá trị chưa nhận diện; không dùng độ dài mảng, số bản ghi hoặc tên file để tự suy diễn mã pháp lý, không tự cấp số phát hành. Mã người vận hành nhập vẫn là giá trị nghiệp vụ gốc và chỉ được thay đổi qua boundary có audit. Trên graphic workflow và chi tiết hồ sơ, cùng một projection read-only phải hiển thị mã gốc, mã chuẩn hóa và nhóm nhận diện; hồ sơ chưa nhận diện phải giữ cảnh báo cho tới khi người có thẩm quyền đối chiếu, không được tự sửa hoặc làm mất cảnh báo khi chuyển bước.

---

## 1. TỔNG QUAN DỰ ÁN & TRIẾT LÝ THIẾT KẾ FRONTEND

**DDT Lab Web App Upgrade** là ứng dụng Web Single Page Application (SPA) cao cấp được xây dựng để phục vụ công tác quản lý, theo dõi kho mẫu vật lý và điều phối lịch thử nghiệm tự động tại **Phòng Điện - Điện tử (Trung tâm Thử nghiệm - Kiểm định Công nghiệp)**.

### 🎨 Triết lý thiết kế Frontend:
1. **Giao diện Phòng Thử Nghiệm Hiện Đại (Industrial Laboratory Precision)**:
   - Sử dụng nền sáng chủ đạo (`bg-slate-50` / `bg-white`) tạo cảm giác sạch sẽ, tin cậy và có độ tương phản cao.
   - Loại bỏ các hiệu ứng trang trí dư thừa, tập trung vào khả năng hiển thị thông tin kỹ thuật rõ ràng, chính xác.
2. **Cấu trúc Thẻ Thông Minh (Card-Driven Dashboard)**:
   - Mọi thực thể nghiệp vụ (Phiếu yêu cầu, Mẫu thử, Biên bản, Lịch thử nghiệm) đều được đóng gói thành các **Card** tự chứa thông tin, có phân cấp thị giác rõ ràng qua Badge, Mã màu và Typography.
3. **Phản hồi Trực quan & Cảnh báo Nổi bật**:
   - Trạng thái quá hạn, mẫu tồn kho lâu hoặc ưu tiên khẩn cấp (`URGENT`) được cảnh báo bằng hiệu ứng nhấp nháy đỏ (`animate-pulse border-red-500 bg-red-50`).
4. **Trải nghiệm Tương tác Mượt mà**:
   - Tích hợp Kéo - Thả (`@dnd-kit`) cho xếp lịch và sắp xếp thứ tự ưu tiên.
   - Tải file thả thả trực tiếp (Drag-and-Drop Zone) hỗ trợ AI bóc tách tài liệu tức thì.

---

## 2. HỆ THỐNG MÀU SẮC & DESIGN TOKENS

### 🎨 2.1. Bảng màu Nền & Khung (Base Palette)
- **Primary Canvas**: `bg-slate-50` (`#f8fafc`)
- **Card Background**: `bg-white` (`#ffffff`)
- **Border Neutral**: `border-slate-200` (`#e2e8f0`)
- **Header Accent**: `bg-slate-900` (`#0f172a`) / `text-slate-900`

### 🏷️ 2.2. Hệ thống Badge Trạng Thái Phiếu (Request Status Tokens)
| Trạng thái (`RequestStatus`) | Giá trị hiển thị | Mã Tailwind Badge |
| :--- | :--- | :--- |
| `PENDING` | Chờ duyệt | `bg-amber-100 text-amber-800 border-amber-300` |
| `APPROVED` | Đã chấp nhận | `bg-blue-100 text-blue-800 border-blue-300` |
| `SAMPLES_RECEIVED` | Đã nhận mẫu | `bg-cyan-100 text-cyan-800 border-cyan-300` |
| `SCHEDULED` | Đã xếp lịch | `bg-indigo-100 text-indigo-800 border-indigo-300` |
| `TESTING` | Đang thử nghiệm | `bg-purple-100 text-purple-800 border-purple-300 animate-pulse` |
| `RESULTS_SUBMITTED` | Chờ duyệt KQTN | `bg-orange-100 text-orange-800 border-orange-300` |
| `RESULTS_APPROVED` | Đã duyệt KQ | `bg-emerald-100 text-emerald-800 border-emerald-300` |
| `COMPLETED` | Hoàn thành | `bg-teal-100 text-teal-800 border-teal-300` |
| `CANCELLED` | Đã hủy | `bg-rose-100 text-rose-800 border-rose-300` |
| `REQ_SUPPLEMENT` | Cần bổ sung | `bg-red-100 text-red-800 border-red-300` |

### 📦 2.3. Hệ thống Badge Kho Mẫu (Sample Status Tokens)
- **Chờ nhận mẫu** (`WAITING`): `bg-amber-50 text-amber-700 border-amber-200` (Biểu tượng: `Clock`)
- **Mẫu trong kho** (`IN_LAB`): `bg-emerald-50 text-emerald-700 border-emerald-200` (Biểu tượng: `PackageCheck`)
- **Đã trả khách** (`RETURNED`): `bg-slate-100 text-slate-600 border-slate-200` (Biểu tượng: `Truck`)

### 👨‍🔬 2.4. Mã màu Kỹ thuật viên (Tester Badge Tokens)
- `Tester 1`: `bg-blue-600 text-white`
- `Tester 2`: `bg-emerald-600 text-white`
- `Tester 3`: `bg-violet-600 text-white`
- `Tester 4`: `bg-amber-600 text-white`
- `Tester 5`: `bg-rose-600 text-white`
- `Tester 6`: `bg-cyan-600 text-white`
- `Tester 7`: `bg-indigo-600 text-white`
- `Tester 8`: `bg-teal-600 text-white`

---

## 3. CHI TIẾT THIẾT KẾ CÁC CARD THÀNH PHẦN (CARD COMPONENTS)

### 3.1. Card Phiếu Yêu Cầu (Request Card)
Card Phiếu Yêu Cầu là thành phần giao diện trung tâm hiển thị thông tin tổng quan của từng hồ sơ thử nghiệm trong danh sách.

```
+----------------------------------------------------------------------------------+
| [MÃ PYC: DDT-2026-001]                  [TRẠNG THÁI: Đang thử nghiệm] [VIP ⭐]   |
| Khách hàng: Công ty TNHH Điện Lạnh Việt Nam                                      |
+----------------------------------------------------------------------------------+
| Tên Mẫu: Tủ Lạnh Inverter 450L          Hãng: Panasonic                           |
| Chủng loại: Tủ Lạnh                     Số lượng: 02 Bộ                            |
| Mã hóa ATD: ITDC-2026-001               Mã hóa EMC: EMC-2026-001                  |
| Tem niêm phong: IEMM-8891, IEMM-8892                                             |
+----------------------------------------------------------------------------------+
| 📅 Dự kiến: 22/07/2026 - 25/07/2026 | 👤 KTV: Nguyễn Văn A | 📍 Buồng: Chamber 1   |
+----------------------------------------------------------------------------------+
| [ Xem chi tiết ]  [ Sửa ]  [ Xếp lịch ]  [ In phiếu ]  [ Nhập KQ ]  [ Xóa ]       |
+----------------------------------------------------------------------------------+
```

#### Cấu trúc thành phần (Anatomy):
1. **Header Card**:
   - Góc trái: Số Phiếu Yêu Cầu (`requestCode`) in đậm (`font-bold text-slate-900 font-mono`).
   - Góc phải: Badge Trạng thái phiếu + Badge Mức ưu tiên (`PriorityLevel`: NORMAL, HIGH, VIP, URGENT).
   - Nếu `priority === URGENT`: Card hiển thị viền đỏ nhấp nháy `ring-2 ring-red-500 animate-pulse`.
2. **Body Card**:
   - Tên Khách hàng (`customerName`), Tên sản phẩm (`modelName`), Hãng sản xuất (`brand`).
   - Khối Mã Hóa (`encodeNumber`, `atdEncodeNumber`, `emcEncodeNumber`): Được tạo kiểu khung chữ nhật bo góc nhỏ, font monospace `font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs`.
   - Danh sách Tem niêm phong (`sealStamp`).
3. **Sub-Footer / Thông tin Xếp lịch**:
   - Ngày nhận mẫu & Ngày dự kiến trả kết quả.
   - Badge đại diện KTV phụ trách (`testerName`) có màu định danh riêng.
   - Buồng thử nghiệm chỉ định (`chamberId`: Chamber 1 / Chamber 2).
4. **Action Toolbar (Thanh thao tác)**:
    - Các nút biểu tượng hành động nhanh: `Xem chi tiết` (Eye), `Chỉnh sửa` (Pencil), `Xếp lịch` (Calendar), `In BMGN/PYC` (Printer), `Nhập/Duyệt kết quả` (FileCheck), `Xóa` (Trash2).
    - Icon nhận diện chính trong card dùng kích thước compact khoảng `14px`; chevron điều khiển dùng khoảng `10px`. Vùng chạm mobile có thể lớn hơn icon theo chuẩn accessibility nhưng không được làm icon thị giác phình to.
    - Trong danh sách Phiếu YC trên mobile, các action `Sửa/In/Giao nhận/Xóa` dùng ô màu hiển thị khoảng `28x28px`, được neo ở góc phải phía trên của card; lớp nút bên ngoài vẫn giữ vùng chạm khoảng `44px` và không được đổi handler, tooltip hoặc phân quyền nghiệp vụ. Từ breakpoint `md`, toolbar trở lại luồng bố cục desktop và không giữ khoảng đệm dành riêng cho toolbar mobile.

---

### 3.2. Card Mẫu Thử / Kho Mẫu (Sample Inventory Card)
Nằm ở thanh Sidebar Kho Mẫu Vật Lý (`WarehouseSidebar.tsx`), hiển thị trạng thái thực tế của mẫu vật trong phòng lab.

```
+-------------------------------------------------------------+
| 📦 [ITDC-2026-088]                     [ Mẫu trong kho ]    |
| Tủ Lạnh Toshiba GR-RS600                                    |
| Vị trí: Kệ A2 - Buồng EMC                                  |
| ⏱️ Tồn kho: 4 ngày (Nhận ngày 18/07/2026)                  |
| [ Chờ nhận ]  -->  [ Mẫu trong kho ]  -->  [ Đã trả khách ] |
+-------------------------------------------------------------+
```

#### Cấu trúc thành phần:
1. **Header**: Mã mã hóa mẫu vật (`encodeNumber` / `itdEncodeNumber` / `emcEncodeNumber`) hiển thị dạng monospace nổi bật + Badge Trạng thái kho.
2. **Body**: Tên mẫu thử, Chủng loại, Vị trí lưu kho vật lý (`sampleLocation`).
3. **Indicator Tồn Kho**:
   - Tính toán số ngày mẫu nằm trong kho từ `receivedDate`.
   - Nếu thời gian tồn kho > 10 ngày mà chưa trả khách: Cảnh báo chữ đỏ `text-rose-600 font-medium` kèm icon `AlertTriangle`.
4. **Interactive Status Switcher**:
   - Nhóm 3 nút bấm dạng Tab Pill chuyển đổi trạng thái mẫu nhanh chóng 1-Click: `Chờ nhận` -> `Mẫu trong kho` -> `Đã trả khách`.

---

### 3.3. Card Lịch Thử Nghiệm (Schedule Item Card)
Hiển thị trong giao diện Bảng Lịch An Toàn Điện (`ATDView`) và Bảng Lịch EMC (`EMCView` - Chamber 1 & Chamber 2).

```
+-----------------------------------------------------------------------+
| ⣿ [ITDC-001] Condi Air Panasonic Inverter                             |
| 🕒 Thử nghiệm: 24 Phút (3 ngày) | 📍 Chamber 1                          |
| 👤 KTV: Lê Văn B                                                       |
| [======================== Tiến độ: 60% ========================]      |
+-----------------------------------------------------------------------+
```

#### Cấu trúc thành phần:
1. **Grip Handle (Nút cầm kéo thả)**: Biểu tượng 6 chấm `GripVertical` phục vụ kéo thả sắp xếp lại thứ tự ưu tiên thử nghiệm (`@dnd-kit`).
2. **Thông tin kỹ thuật**: Mã hóa mẫu thử, Tên thiết bị, Định mức phút thử nghiệm (`testTimeATD` / `testTimeEMC`).
3. **Phân bổ KTV & Buồng**: Tag tên KTV phụ trách tô màu tương ứng, chỉ số Buồng thử (`Chamber 1` / `Chamber 2`).
4. **Thanh Tiến độ Thử nghiệm (Progress Bar)**:
   - Thể hiện tỷ lệ phần trăm thời gian thử nghiệm đã trôi qua so với tổng thời gian dự kiến.
5. **Tính năng Tìm kiếm & Định vị Mẫu khớp trên Lịch**:
   - Hỗ trợ lọc đa điều kiện ở Sidebar Lịch thử: Ô tìm kiếm từ khóa, Lọc theo Khách hàng (`selectedCustomer`) và Lọc theo Thương hiệu (`selectedBrand`).
   - Khi bấm chọn mẫu từ danh sách "Mẫu khớp trên lịch", hệ thống tự động chuyển lịch về tuần/tháng chứa mẫu đó, tự động cuộn tới vị trí mẫu (`scrollIntoView`) và bật hiệu ứng Highlight viền nổi bật (`ring-4 ring-rose-500 scale-[1.04] animate-pulse`).

---

### 3.4. Card Biên Bản Giao Nhận (Handover Doc Card)
Hiển thị trong Modal Quản lý Biên Bản Giao Nhận (`HandoverDocsModal.tsx`).

```
+-----------------------------------------------------------------------+
| 📄 [BMGN-2026/07-005]                     [ Loại: Trả mẫu ]            |
| Khách hàng: Công ty Cổ phần Cơ Điện Lạnh Á Châu                       |
| Người giao: Nguyễn Văn X | Đại diện nhận: Trần Văn Y                  |
| Phương tiện/Biển số: 29C-123.45                                       |
| 📦 Danh sách mẫu: 03 Mẫu (ITDC-001, ITDC-002, EMC-005)                |
| [ Tải file Word (.docx) ]               [ Xem chi tiết ]              |
+-----------------------------------------------------------------------+
```

#### Cấu trúc thành phần:
1. **Header**: Số BMGN (`docNumber`) + Tag phân loại (`Nhận mẫu` - Màu Xanh dương / `Trả mẫu` - Màu Cam).
2. **Body**: Đơn vị khách hàng, Đại diện hai bên, Thông tin xe / Tài xế vận chuyển.
3. **Mẫu đính kèm**: Chip danh sách các mã hóa mẫu thử được bàn giao trong đợt.
4. **Action**: Nút xuất file Word tự động điền mẫu `GiaoNhanMau.docx` bằng thư viện `docxtemplater`.

---

### 3.5. Card Nhật Ký Tổng Hợp (Summary Log Card)
Hiển thị trong Màn hình Nhật Ký Hoạt Động & Sổ Tổng Hợp (`SummaryLogView.tsx`), dạng bảng dữ liệu tổng hợp đa cột (ngày yêu cầu, mã phiếu, khách hàng, model, nhãn hiệu, số lượng, tem niêm phong, phân loại, loại sản phẩm, chỉ tiêu thử nghiệm, số lô ITD/EMC/ITDC, trạng thái, người thử nghiệm,...) và timeline nhật ký hoạt động.

```
+-----------------------------------------------------------------------+
| 🕒 14:30 - 21/07/2026 | 👤 Admin (Hùng)                              |
| ⚡ [CẬP NHẬT KẾT QUẢ]: Phiếu DDT-2026-012 -> Đã duyệt kết quả TN      |
| 📝 Chi tiết: Công suất đo: 1200W, CSPF: 4.85 (Đạt Cấp 5 Sao)          |
+-----------------------------------------------------------------------+
```

---

## 4. CỬA SỔ NỔI & FORM INTERACTIVE (MODAL DESIGN)

### 4.1. RequestModal (Tạo/Sửa Phiếu & AI OCR)
- **Vùng Upload AI Droppable**:
  - Drag & Drop zone hỗ trợ file `.pdf`, `.docx`, `.png`, `.jpg`.
  - Tự động gọi API `/api/gemini/extract-requests` để trích xuất thông tin Khách hàng, Sản phẩm, Mã tem niêm phong và điền tự động vào Form.
- **Form Chia Cụm Thông Minh**:
  - Cụm 1: Thông tin Khách hàng & Hóa đơn tài chính.
  - Cụm 2: Thông tin Mẫu thử & Tiêu chuẩn áp dụng (TCVN / IEC).
  - Cụm 3: Mã hóa mẫu tự động (ITDC, ITD, EMC) & Tem niêm phong.
- **Khởi động theo vai trò Khách**:
  - Khi tài khoản có role `guest` đăng nhập, `RequestModal` tự động mở đúng một lần trong phiên đăng nhập đó.
  - Việc đóng modal không tự động mở lại; nút `Tạo Phiếu` vẫn cho phép mở modal thủ công.
- **Nhập liệu có thể xóa trắng**:
  - Các trường input trong `RequestModal` phải giữ được giá trị rỗng tạm thời trong lúc người dùng chỉnh sửa, không tự động ghi đè bằng giá trị mặc định ngay khi ô phát sinh chuỗi rỗng.
  - Giá trị mặc định/tự động của số lượng, số bản kết quả, số lần Fail, MTT, đơn vị tính và tem niêm phong chỉ được áp dụng khi khởi tạo mẫu hoặc chuẩn hóa lúc thêm/lưu phiếu.
- **Quy tắc tem niêm phong theo bên phát hành**:
  - Chỉ tem có tiền tố `IEMM` (không phân biệt hoa/thường, sau khi bỏ khoảng trắng đầu chuỗi) mới dùng cơ chế tự sinh hậu tố `M01`, `M02`... theo thứ tự mẫu.
  - Tem của các bên khác được nhập và lưu theo free style; hệ thống không tự nối hậu tố, không chuẩn hóa cấu trúc mã và khi sửa phiếu phải giữ nguyên mã riêng của từng mẫu.

### 4.2. TestExecutionModal (Nhập KQTN & AI Extract)
- **Cụm thông số đo đạc**: Công suất làm lạnh, Công suất tiêu thụ điện, Chỉ số hiệu suất năng lượng (CSPF), Cấp sao năng lượng (1-5 sao).
- **Trình tải Báo cáo Thử nghiệm**: Cho phép tải file báo cáo thử nghiệm để AI tự bóc tách các chỉ số đo đạc thực tế.
- **Quy trình Phê duyệt 2 Bước**:
  - KTV nhấn "Gửi duyệt" -> Trạng thái: `RESULTS_SUBMITTED`.
  - Admin xem xét -> Nhấn "Phê duyệt" (`RESULTS_APPROVED`) hoặc "Cần bổ sung" (`REQ_SUPPLEMENT`).

### 4.3. HandoverModal & PrintFormModal
- **HandoverModal**: Giao diện chọn nhanh danh sách mẫu nhận/trả bằng Checkbox list, tự động lọc mẫu đang có trong kho.
- **PrintFormModal**: Canvas xem trước trang in khổ A4 và nút In trực tiếp hoặc Tải xuống file Word chuẩn biểu mẫu.

### 4.4. ReportGeneratorView & KQTN Management (Trình tạo Báo cáo Thử nghiệm & Quản lý KQTN)
- **Bộ chọn Module Chuẩn Báo cáo (Compact Report Grid)**:
  - Danh sách 17 chuẩn/mẫu báo cáo được hiển thị dưới dạng grid responsive, ưu tiên hiển thị trọn trong một viewport desktop thông dụng và giảm tối đa nhu cầu cuộn danh sách.
  - Kích thước card và icon thu gọn theo breakpoint nhưng vẫn giữ vùng tương tác tối thiểu phù hợp cho thao tác chuột và cảm ứng; tên chuẩn được phép xuống dòng để không cắt mất nội dung.
  - Các lựa chọn nghiệp vụ đặc biệt (đầy đủ/giảm thiểu chỉ tiêu, nhóm EMC có biến thể) giữ nguyên hành vi hiện tại trong `ReportGeneratorView`; không thay đổi luồng nhập liệu, lưu KQTN hoặc xuất DOCX.
- **Typography Form Nhập liệu (Compact Report Form Typography)**:
  - Ba form preview (`EmcBepDien1VungNauForm`, `DefaultStandardForm`, `DayCapDienForm`) dùng scope giao diện riêng để giảm font điều khiển nhập liệu về khoảng `12px`, tiêu đề section về khoảng `14–16px` và giữ nguyên khả năng đọc.
  - Scope typography chỉ áp dụng trong vùng form preview của trang Lập báo cáo; không thay đổi Header, Sidebar, thanh thao tác hoặc định dạng dữ liệu xuất DOCX.

- **Định danh giao diện Báo cáo & KQTN (Report/KQTN Identifier UI)**:
  - Form Thông tin Báo cáo không hiển thị trường nhập `Số (Nº)`; `Số mã hóa` là trường định danh đầu tiên sau tiêu đề form.
  - Bảng và phần chi tiết mặc định của KQTN không hiển thị `Số KQTN`; `Số mã hóa` là định danh đầu tiên sau số thứ tự.
  - Trường dữ liệu `reportNo` vẫn được giữ trong schema, payload lưu trữ, nhật ký và tương thích xuất file; khi tạo báo cáo, giá trị nội bộ này được đồng bộ theo `codingNumber` thay vì yêu cầu nhập riêng.
  - Ngày báo cáo vẫn được dùng cho validation, lưu KQTN và xuất DOCX nhưng không hiển thị thêm chuỗi diễn giải ngày đầy đủ bên dưới ô chọn ngày.
    - **Điều 22.12**:
        + Dòng chính `22.12`: Yêu cầu: *"Tay cầm, nút bấm và các bộ phận tương tự.\nThử nghiệm bằng tay và cố gắng tháo các bộ phận này bằng cách đặt lực hướng trục"*, Kết quả: *"Lực kéo hướng trục: 15N (ít khả năng bị kéo); 30N (nhiều khả năng bị kéo theo hướng trục)\nĐược cố định một cách tin cậy, không bị lỏng khi sử dụng bình thường"*.
    - **Cấu hình bảng phụ (subTables) cho TCVN 5699-2-23 (Máy sấy tóc)**:
      - Loại bỏ cấu hình `subTable: "CLAUSE_22"` và `subTable: "CLAUSE_24"` khỏi Điều 22 và Điều 24 (do các bảng đo nhiệt độ nước chỉ áp dụng cho Bình đun nước nóng TCVN 5699-2-21).
      - Bảng Điều 19 (Hoạt động không bình thường) khởi tạo chính xác các dòng đo không bị trùng lặp hàng đo sàn/vách góc thử nghiệm.
    - Form `hair_dryer` phải hiển thị và cho phép nhập kết quả cho các dòng con của Điều 22.32, Điều 24.2 và Điều 30.2 theo biểu mẫu chuẩn, giữ `displayId` rỗng cho các dòng con không có số điều riêng.
    - Bảng chi tiết Điều 30 phải có thêm nhóm **Thử nghiệm ngọn lửa hình kim** gồm 3 dòng kết quả, với giới hạn lần lượt `≤ 30`, `≤ 30` và `≤ 15` giây; dữ liệu phải được lưu cùng `testResultsData` và truyền qua luồng xuất DOCX hiện tại.
    - Cấu hình `hair_dryer` phải khớp toàn bộ các placeholder đánh giá của template `5699-2-23 placeholder.docx`, bao gồm các dòng con tại Điều 13.1, 22.2, 22.14, 22.32, 22.36, 24.2, 27.1, 27.3, 30.1 và 30.2.
    - Với các module TCVN khác có cặp template đầy đủ/rút gọn, cấu hình clause phải khớp các placeholder đánh giá `{eval_*}` của DOCX tương ứng; các dòng con trong template phải được khai báo thành trường nhập liệu riêng, giữ `displayId` rỗng khi không có số điều riêng.

- **Chuẩn hóa Định dạng & Phân tách Cột Bảng KQTN (KQTN Table Column Standardization)**:
  - Tách bạch rõ ràng 4 trường dữ liệu độc lập, chuẩn hóa tên gọi nghiệp vụ:
    1. **Số phiếu YC** (`requestCode`): Số phiếu yêu cầu thử nghiệm ban đầu (thường có định dạng `DDT-...`), hiển thị định dạng `font-medium text-slate-600` hoặc mã badge xám/lam nhạt.
    2. **Số KQTN** (`reportNo`): Số kết quả thử / Số giấy KQTN (thường mang mã `ITD...`, `EMC...`, `ITDC...`), giữ để tương thích dữ liệu nhưng không hiển thị trong giao diện mặc định.
    3. **Số mã hóa** (`sampleCode` / `codingNumber`): Mã hóa phân bổ mẫu thử phòng lab (dạng `01-ITD-26`, `01-EMC-26`, `01-ITDC-26`), hiển thị Badge Token chuẩn `font-black font-mono text-[10px] uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200/50`.
    4. **Tem niêm phong** (`sealStamp`): Mã tem niêm phong vật lý. **Quy chuẩn nhận diện toàn diện:** Mọi chuỗi ký tự có tiền tố `IEMM` dưới bất kỳ định dạng nào (như `IEMM....`, `IEMM/...`, `IEMM-...`, `IEMM.26/...`, `IEMM xxxx`) đều được hệ thống và AI nhận diện là **Số tem niêm phong (`sealStamp`)**. Hiển thị Badge Token chuẩn `font-mono bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200/50 font-bold`, hoặc `Chưa niêm phong` nếu trống.
  - Trường nhập `sealStamp` hỗ trợ danh sách chọn nhanh nhưng vẫn cho phép nhập thủ công. Danh sách gợi ý chuẩn gồm: `IEMM.00/HQA/0000.0A-SP-M00`, `IEMM.00/HQA/0000.1A-SP`, `TĐC-0000-00`, `TTP-0000-00`, `VIC/00.HQ/0000/00-00`.
  - Tự động điền chính xác khi chọn mẫu từ danh sách PYC (`SelectSampleModal`):
    - `requestCode`: gán theo số phiếu yêu cầu dạng `DDT-...` (`req.requestCode`).
    - `reportNo` (Số KQTN): gán mặc định theo số mã hóa `ITD...` / `EMC...` / `ITDC...` (hoặc `req.requestCode` nếu chưa có mã hóa).
    - `codingNumber`: gán theo số mã hóa `encodeNum`.
    - `sealStamp`: gán theo `req.sealStamp` (mọi mã có tiền tố `IEMM...`).
  - **Đầy đủ dòng nhập liệu cho mẫu TCVN 5699-2**:
    - **Quy chuẩn Điều 22.11 và 22.12 cho các mẫu đầy đủ chỉ tiêu TCVN 5699-2**:
      - **Điều 22.11**: Chia tách thành 3 dòng:
        + Dòng chính `22.11`: Yêu cầu: *"Các bộ phận không tháo rời được, dùng để bảo vệ chống chạm bộ phận mang điện"*, Kết quả: *"Được cố định chắc chắn và chịu được ứng suất cơ học xuất hiện trong sử dụng bình thường"*.
        + Dòng con `22.11_1` (`displayId: ""`): Yêu cầu: *"Thử nghiệm lực đẩy và kéo với bộ phận nhiều khả năng phải tháo ra cho dù chúng được cố định bằng vít, đinh tán hay chi tiết tương tự"*, Kết quả: *"Lực đẩy: 50N\nLực kéo: 50N (bộ phận không thể trượt ngón tay); 30N (bộ phận nhô ra <10mm)"*.
        + Dòng con `22.11_2` (`displayId: ""`): Yêu cầu: *"Thử nghiệm momen xoắn với bộ phận có thể phải chịu lực xoắn đồng thời với lực kéo và lực đẩy (nếu chỗ nhô ra của bộ phận nắm vào được <10mm thì momen giảm đi 50%)"*, Kết quả: *"2Nm (kích thước ≤ 50mm)\n4Nm (kích thước >50mm)\nCác bộ phận vẫn ở vị trí khóa và không rời ra"*.
      - **Điều 22.12**:
        + Dòng chính `22.12`: Yêu cầu: *"Tay cầm, nút bấm và các bộ phận tương tự.\nThử nghiệm bằng tay và cố gắng tháo các bộ phận này bằng cách đặt lực hướng trục"*, Kết quả: *"Lực kéo hướng trục: 15N (ít khả năng bị kéo); 30N (nhiều khả năng bị kéo theo hướng trục)\nĐược cố định một cách tin cậy, không bị lỏng khi sử dụng bình thường"*.
    - Form `hair_dryer` phải hiển thị và cho phép nhập kết quả cho các dòng con của Điều 22.32, Điều 24.2 và Điều 30.2 theo biểu mẫu chuẩn, giữ `displayId` rỗng cho các dòng con không có số điều riêng.
    - Bảng chi tiết Điều 30 phải có thêm nhóm **Thử nghiệm ngọn lửa hình kim** gồm 3 dòng kết quả, với giới hạn lần lượt `≤ 30`, `≤ 30` và `≤ 15` giây; dữ liệu phải được lưu cùng `testResultsData` và truyền qua luồng xuất DOCX hiện tại.
    - Cấu hình `hair_dryer` phải khớp toàn bộ các placeholder đánh giá của template `5699-2-23 placeholder.docx`, bao gồm các dòng con tại Điều 13.1, 22.2, 22.14, 22.32, 22.36, 24.2, 27.1, 27.3, 30.1 và 30.2.
    - Với các module TCVN khác có cặp template đầy đủ/rút gọn, cấu hình clause phải khớp các placeholder đánh giá `{eval_*}` của DOCX tương ứng; các dòng con trong template phải được khai báo thành trường nhập liệu riêng, giữ `displayId` rỗng khi không có số điều riêng.

- **Thông tin Báo cáo (Report Metadata Sidebar)**:
  - Cho phép chọn mẫu từ danh sách PYC (`SelectSampleModal`) để tự động điền các trường: Số mã hóa, Tem niêm phong (`sealStamp`), Tên mẫu, Model, Nhãn hiệu, Đơn vị gửi mẫu, Địa chỉ, Ngày nhận mẫu, Ngày thử nghiệm (`testDate` lấy từ lịch trình thử nghiệm trên DB `scheduledDate`/`endDate` hoặc `result.testDate`), Người thử nghiệm; `reportNo` nội bộ được đồng bộ theo số mã hóa.
  - **Trường Ký duyệt Báo cáo (Người thử nghiệm & Phụ trách PTN)**:
    - Bố trí 2 trường nhập liệu ký duyệt gồm: **Người thử nghiệm** (`testerName` ứng với `{testerName}`) và **Phụ trách phòng TN** (`managerName` ứng với `{managerName}`/`{managerNam}`) cạnh nhau trên cùng một hàng (grid 2 cột trên desktop/tablet).
    - Trường **Phụ trách phòng TN** chỉ nhận diện và hiển thị trong droplist các nhân sự giữ chức danh **Trưởng phòng hoặc Phó trưởng phòng** (mặc định gồm: **Vũ Việt Anh** và **Lương Xuân Hùng**).
    - Trường **Người thử nghiệm** tích hợp `<datalist>` gợi ý danh sách nhân sự từ cấu hình `testers` để KTV chọn nhanh hoặc nhập tự do.
  - **Trường Ngày thử nghiệm thống nhất (Unified Test Date Field)**:
    - Thay thế giao diện 2 ô ngày riêng biệt (bắt đầu - kết thúc) bằng **1 trường nhập liệu chung** duy nhất (`Ngày thử nghiệm`), hỗ trợ hiển thị và nhập linh hoạt cả ngày đơn (`14/08/2026`) lẫn dải ngày (`10/08/2026 – 14/08/2026`).
    - Đối với các thử nghiệm EMC (và các loại thử nghiệm khác), khi kỹ thuật viên bấm **"Chọn mẫu"**, hệ thống tự động trích xuất ngày thử nghiệm đã lưu trên DB (từ `scheduledDate`, `endDate`, hoặc `result.testDate`), chuyển đổi định dạng chuẩn `DD/MM/YYYY` (hoặc `DD/MM/YYYY – DD/MM/YYYY`) và tự động điền vào trường `Ngày thử nghiệm`.
  - Cho phép người dùng chỉnh sửa trực tiếp trường "Tem niêm phong" và "Ngày thử nghiệm" trên giao diện cột thông tin báo cáo.
  - Xuất file `.docx` báo cáo tự động truyền đầy đủ `sealStamp`, `{testDate}`, `{testerName}`, `{managerName}` (và alias `{managerNam}`) vào dữ liệu template biểu mẫu Word.
  - Trường ngày tiếng Anh trong báo cáo phải dùng tên tháng đầy đủ theo mẫu `August 18, 2026`; không được xuất ngày tháng dạng số ở phần tiếng Anh. Phần tiếng Việt tiếp tục giữ định dạng hành chính hiện tại.
  - Khi không có giá trị ngày hợp lệ, không tự suy diễn ngày; giữ dữ liệu trống để người dùng xử lý.
  - Lưu trữ và phiên bản hóa Kết quả thử nghiệm (`KQTNRecord`) bao gồm các trường `sealStamp`, `testDate`, `testerName` và `managerName`.
- **Đầy đủ dòng nhập liệu cho mẫu TCVN 5699-2-23**:
  - Form `hair_dryer` phải hiển thị và cho phép nhập kết quả cho các dòng con của Điều 22.32, Điều 24.2 và Điều 30.2 theo biểu mẫu chuẩn, giữ `displayId` rỗng cho các dòng con không có số điều riêng.
  - Bảng chi tiết Điều 30 phải có thêm nhóm **Thử nghiệm ngọn lửa hình kim** gồm 3 dòng kết quả, với giới hạn lần lượt `≤ 30`, `≤ 30` và `≤ 15` giây; dữ liệu phải được lưu cùng `testResultsData` và truyền qua luồng xuất DOCX hiện tại.
  - Cấu hình `hair_dryer` phải khớp toàn bộ các placeholder đánh giá của template `5699-2-23 placeholder.docx`, bao gồm các dòng con tại Điều 13.1, 22.2, 22.14, 22.32, 22.36, 24.2, 27.1, 27.3, 30.1 và 30.2.
  - Với các module TCVN khác có cặp template đầy đủ/rút gọn, cấu hình clause phải khớp các placeholder đánh giá `{eval_*}` của DOCX tương ứng; các dòng con trong template phải được khai báo thành trường nhập liệu riêng, giữ `displayId` rỗng khi không có số điều riêng.
  - Với các module EMC và dây cáp điện, mọi placeholder dữ liệu dạng scalar, bảng, ảnh và trường kết quả trong DOCX phải có nguồn từ form/state tương ứng và được kiểm tra hồi quy trước khi phát hành báo cáo.
  - **Quy chuẩn Bảng Công suất nhiễu EMC (Phần 6 / `TablePowerDisturbance` / `tablePower*`)**:
    - Áp dụng chung cho tất cả các mẫu báo cáo EMC (Bếp từ, Điều hòa, Máy giặt, Máy hút bụi, Máy sấy tóc, Máy khoan, v.v.):
    - Bảng kết quả công suất nhiễu chỉ hiển thị và sử dụng **duy nhất 1 hàng**.
    - Khi tải dữ liệu từ file Radimation hoặc khi dán dữ liệu (paste): nếu dữ liệu có từ 2 hàng trở lên, hệ thống **tự động chỉ lấy hàng 1** và bỏ các hàng thừa.
    - Khi xuất báo cáo Word DOCX, hệ thống luôn đảm bảo bảng công suất nhiễu chỉ render tối đa 1 hàng kết quả.
  - **Cấu hình EMC Máy khoan (`emc_may_khoan`) Phần 6 (Công suất nhiễu)**:
    - Hiển thị đầy đủ 2 bài đo công suất nhiễu cho 2 chiều quay của máy khoan:
      1. **6.3.1. Thử nghiệm khi EUT quay cùng chiều kim đồng hồ (Testing when EUT rotate clockwise)**: Dòng con `6.3.1.1. Kết quả công suất nhiễu của dây dẫn nguồn (Result of Main line disturbance power)` (ảnh `powerDisturbance` mapping `image_6_3_1_1`, bảng `tablePower` mapping `table_6_3_1_1`).
      2. **6.3.2. Thử nghiệm khi EUT quay ngược chiều kim đồng hồ (Testing when EUT rotate counterclockwise)**: Dòng con `6.3.2.1. Kết quả công suất nhiễu của dây dẫn nguồn (Result of Main line disturbance power)` (ảnh `powerDisturbance_2` mapping `image_6_3_2_1`, bảng `tablePower_2` mapping `table_6_3_2_1`).
    - Biểu mẫu Word `maykhoan placeholder.docx` đồng bộ đầy đủ cả 2 mục 6.3.1.1 và 6.3.2.1 tương ứng.

- **Cơ chế Quản lý Đa Tem Nhãn Linh Hoạt & AI OCR Tổng Hợp (Dynamic Multi-nameplate & Batch OCR)**:
  - **Quản lý Đa Tem Nhãn Động cho tất cả thiết bị**:
    - Áp dụng cho mọi chủng loại thiết bị (Tủ lạnh, Điều hòa không khí, Bếp từ, Bình đun, Quạt điện, Dây cáp điện, v.v.).
    - Giao diện danh sách tem động (`nameplatePhotos: string[]`): Mặc định hiển thị 2 ô tem cơ bản (Tem 1, Tem 2) và cho phép bấm nút **"+ Thêm ảnh tem nhãn"** để mở rộng linh hoạt (Tem 3, Tem 4...) cho các thiết bị nhiều tem nhãn (như Tủ lạnh có tem thông số + tem sơ đồ điện + tem máy nén/block + tem niêm phong; Điều hòa có dàn lạnh + dàn nóng + cụm nguồn).
    - Mỗi ô tem hỗ trợ đầy đủ công cụ: Cắt/xoay ảnh (`CropperModal`), Xóa ảnh, Kéo thả/Dán ảnh (`paste`/`drag-and-drop`), và Chạy OCR độc lập cho từng tem.
  - **AI OCR Tổng hợp Toàn diện (Multi-image Prompting & Fusion)**:
    - Nút **"OCR Tổng Hợp Tất Cả Tem Nhãn"**: Gửi đồng thời toàn bộ danh sách ảnh tem đã tải lên đến AI Gemini.
    - AI tự động trích xuất và hợp nhất: Model tổng, cụm thành phần (`indoorModel`, `outdoorModel`, `compressorModel`), nhãn hiệu (`brand`), mã số tem niêm phong (`sealStamp`), nhà sản xuất (`manufacturer`), nước sản xuất (`countryOfOrigin`/`origin`), công suất danh nghĩa (`power`), điện áp danh nghĩa (`voltage`), dòng điện danh nghĩa (`current`), tần số danh nghĩa (`frequency`), tần số xung nhịp lớn nhất (`clockFreq`), môi chất lạnh và xuất xứ.
    - Sau khi OCR, các trường kỹ thuật nêu trên và nhà sản xuất/nước sản xuất phải được điền vào form báo cáo; nếu tem không có thông tin thì giá trị hiển thị và giá trị xuất DOCX là `N/A`.
  - **Đối soát Tem Niêm Phong (`sealStamp`)**:
    - Tự động đối chiếu mã số tem niêm phong đọc từ ảnh tem với phiếu yêu cầu; hiển thị badge cảnh báo khác biệt nếu có sai lệch để KTV xác nhận.
  - **Lưu trữ & Báo cáo Word (`.docx`)**:
    - `KQTNRecord` lưu trữ đầy đủ `nameplatePhotos` (đồng thời giữ `nameplatePhoto1`, `nameplatePhoto2` để tương thích ngược).
    - Bộ tạo báo cáo Word tự động truyền toàn bộ ảnh tem vào file `.docx`.
    - Mapping dữ liệu phải dùng `sealStamp` cho nhãn Tem niêm phong. Các template cũ còn placeholder `{codingNumber}` tại vị trí nhãn Tem niêm phong được xử lý bằng alias tương thích ở lớp xuất DOCX, không được lấy số mã hóa làm giá trị tem.
    - Khi xuất DOCX, toàn bộ ảnh tem động `label`, `label2`, `label3`, ... phải được giữ đúng thứ tự, ghép cạnh nhau thành một ảnh ngang duy nhất và chỉ mapping vào placeholder `anh_1`. Ảnh mẫu và ảnh thiết lập EMC tiếp tục mapping vào các vị trí kế tiếp theo thứ tự của template; không được phân tán các ảnh tem sang `anh_2`, `anh_3`, ... .

- **Kiểm tra nhất quán hồ sơ trước khi lưu/xuất (Report Consistency Validation)**:
  - Khi người dùng chọn một PYC, hệ thống giữ dữ liệu PYC làm nguồn đối chiếu cho `requestDate`, `requestCode`, Model, nhãn hiệu, số mã hóa, tem niêm phong và thông số kỹ thuật nếu có.
  - Chuỗi thời gian bắt buộc tuân theo thứ tự: `Ngày phiếu yêu cầu <= Ngày nhận mẫu <= Ngày thử nghiệm bắt đầu <= Ngày thử nghiệm kết thúc <= Ngày báo cáo`. Ngày thử nghiệm được hỗ trợ dạng một ngày hoặc một khoảng ngày; chuỗi ngày sai định dạng hoặc sai thứ tự là lỗi chặn thao tác.
  - Model, nhãn hiệu, số mã hóa và tem niêm phong trên báo cáo phải khớp dữ liệu PYC sau khi chuẩn hóa chữ hoa/thường, dấu tiếng Việt và ký tự phân cách. Mọi sai khác là lỗi chặn thao tác.
  - Nếu có dữ liệu OCR từ tem nhãn, hệ thống đối chiếu Model, nhãn hiệu, tem niêm phong và các giá trị kỹ thuật đã đọc với dữ liệu báo cáo/PYC. Nếu PYC có trường `specifications`, các giá trị kỹ thuật OCR hoặc form EMC chỉ được chấp nhận khi xuất hiện trong chuỗi thông số của PYC; sai khác là lỗi chặn thao tác.
  - Trường bắt buộc chưa nhập hoặc chưa đủ dữ liệu để đối chiếu chỉ hiển thị cảnh báo không chặn; các sai lệch do không trùng khớp với thông tin trên PYC (Model, nhãn hiệu, số mã hóa, tem niêm phong, thông số PYC/OCR) cũng chỉ hiển thị cảnh báo và vẫn cho phép lưu/xuất DOCX.
  - Chỉ lỗi dữ liệu không hợp lệ của form, như ngày sai định dạng hoặc sai thứ tự thời gian, mới chặn thao tác. Khi bị chặn, khu vực nút thao tác phải hiển thị rõ các trường/vị trí cần xử lý; dữ liệu kết quả chi tiết (`testResultsData`, `emcData`, `dayCapDienData`) phải được lưu cùng `KQTNRecord` để phục vụ kiểm tra và phiên bản hóa.

### 4.5. Phân Hệ Sổ Kết Quả Thử Nghiệm (KQTN Redesign & Modern Data Grid Architecture)
- **Kiến trúc Bảng Lưới Chuyên Nghiệp (Professional Cell-Grid Data Table)**:
  - Header & Toolbar tinh gọn, tối ưu không gian làm việc với thanh thống kê chỉ số nhanh (Tổng bản ghi, Đã xuất BC, Phiên bản cập nhật).
  - Tìm kiếm đa năng tức thời: Lọc trên toàn bộ các trường `requestCode`, `reportNo`, `sampleCode`, `sealStamp`, `sampleName`, `model`, `brand`, `senderUnit`, `testerName`.
  - Hệ thống bộ lọc chuyên sâu: Lọc theo Tiêu chuẩn (`standardTitle`), Người thử nghiệm (`testerName`), Loại thử nghiệm (`criteriaType`: Đầy đủ / Rút gọn), Phiên bản.
  - Phân trang chuẩn quốc tế: 20 / 50 / 100 / Tất cả, kèm điều hướng nhảy trang và hiển thị số lượng bản ghi thực tế.
- **Tùy Biến Cột Cá Nhân Hóa (Column Customization & Persistence)**:
  - Bật/tắt hiển thị từng cột dữ liệu, kéo/sắp xếp thứ tự cột, thay đổi độ rộng cột (`Column Resizing`) với bộ chỉ báo ký tự cột kiểu bảng tính (A, B, C...).
  - Lưu trạng thái tùy biến cột theo tài khoản người dùng (`localStorage` + Cloud Sync).
- **Bộ Trường Dữ Liệu Chuẩn Hóa Của Bản Ghi KQTN**:
  1. `stt`: Số thứ tự dòng.
  2. `requestCode`: Số phiếu YC (dạng `DDT-...`).
  3. `reportNo`: Số KQTN / Số kết quả thử (dạng `ITD...`, `EMC...`, `ITDC...`).
  4. `sampleCode`: Số mã hóa phân bổ mẫu phòng lab (dạng `01-ITD-26`, `01-EMC-26`...).
  5. `sealStamp`: Tem niêm phong (nhận diện mọi tiền tố `IEMM...`).
  6. `version`: Phiên bản bản ghi (`v1`, `v2`...).
  7. `sampleName`: Tên mẫu thử nghiệm.
  8. `model`: Ký hiệu kiểu / Model.
  9. `brand`: Nhãn hiệu / Thương hiệu sản phẩm.
  10. `senderUnit`: Đơn vị gửi mẫu / Khách hàng.
  11. `standardTitle`: Tiêu chuẩn thử nghiệm áp dụng.
  12. `criteriaType`: Loại thử nghiệm (Đầy đủ / Rút gọn).
  13. `testDate`: Ngày thử nghiệm (hỗ trợ ngày đơn và dải ngày).
  14. `reportDate`: Ngày lập báo cáo.
  15. `testerName`: Kỹ thuật viên thử nghiệm.
  16. `updatedAt`: Thời điểm cập nhật cuối.
  17. `updatedBy`: Người thực hiện cập nhật.
- **Hệ Thống Thao Tác & Quản Lý Phiên Bản (Action Controls & Version History)**:
  - **Modal Chi tiết Đa tầng (Tabbed Detail Modal)**:
    - Tab 1: Tổng quan mẫu thử & Đối soát mã phiếu/tem niêm phong.
    - Tab 2: Thông số kỹ thuật & Tem nhãn OCR.
    - Tab 3: Dữ liệu đo đạc chi tiết (EMC, Dây cáp điện, Thiết bị gia dụng).
    - Tab 4: Lịch sử phiên bản (`Version History`) theo dõi dòng thời gian sửa đổi, người sửa và ghi chú lý do.
  - **Xuất dữ liệu Excel / CSV**: Xuất tức thời theo danh sách cột đang hiển thị và bộ lọc hiện hành.
  - **Xóa bản ghi**: Bảo vệ phân quyền Admin với hộp thoại xác nhận an toàn.

### 4.6. DocxSettingsModal & Quản Lý Biểu Mẫu DOCX Template (Docx Template Management)
- **Mục đích & Vị trí điều hướng**:
  - Nằm trên trang **Lập báo cáo** (`ReportGeneratorView.tsx`), nút **"Cài đặt biểu mẫu"** (icon `Settings`/`FileCog`) được bố trí tại Header thanh điều hướng, cho phép người dùng mở modal quản lý ở cả giao diện Dashboard danh sách chuẩn lẫn form chi tiết tiêu chuẩn.
- **Giao diện Modal Quản lý Biểu mẫu (`DocxSettingsModal.tsx`)**:
  - **Kiến trúc Header & Bộ lọc**:
    - Header modal hiện đại, hiển thị rõ số lượng template đang quản lý trong hệ thống.
    - Ô tìm kiếm tức thời theo Tên tiêu chuẩn (TCVN 5699, QCVN 9, TCVN 6610...), Chủng loại thiết bị (Nồi cơm điện, Lò nướng, Điều hòa, Bếp từ...) hoặc Tên file biểu mẫu (`.docx`).
    - Phân nhóm nhanh bằng thẻ Tab Pill: `Tất cả`, `An toàn điện (TCVN)`, `Tương thích điện từ (EMC)`, `Dây cáp điện`, `Hồ sơ chung (PYC/BMGN)`.
  - **Bảng Danh mục Biểu mẫu (Template Catalog Grid)**:
    - Hiển thị danh mục chi tiết 40+ biểu mẫu chuẩn hóa kèm icon nhận diện thiết bị.
    - Thể hiện rõ tên chuẩn, chủng loại thiết bị, biến thể (Đầy đủ / Giảm thiểu / Số vùng nấu / Có sấy...).
    - Hiển thị tên file `.docx` vật lý, trạng thái file (`Sẵn sàng` / `Chưa có file`), dung lượng (KB/MB) và ngày cập nhật gần nhất.
  - **Hệ Thống Thao Tác Biểu Mẫu**:
    - **Tải về (`Download`)**: Tải trực tiếp file `.docx` hiện tại về máy tính để kiểm tra nội dung hoặc chỉnh sửa cấu trúc placeholder.
    - **Cập nhật File mới (`Upload/Update`)**: Cho phép chọn file từ máy hoặc kéo thả file `.docx` mới để ghi đè cập nhật cho từng module cụ thể; kiểm tra định dạng MIME wordprocessingml/docx hợp lệ trước khi ghi.
    - **Khôi phục File gốc (`Reset/Restore`)**: Cho phép hoàn tác về biểu mẫu gốc mặc định khi cần thiết.
- **Hợp đồng REST API Quản trị Template**:
  - `GET /api/templates`: Danh sách metadata toàn bộ các template biểu mẫu của hệ thống.
  - `GET /api/templates/:filename/download`: Tải file template `.docx` theo tên file.
  - `POST /api/templates/upload`: Tiếp nhận file `.docx` mới qua `multipart/form-data`, lưu an toàn vào `public/` (và `dist/` nếu có) kèm cơ chế sao lưu tự động.
  - `POST /api/templates/:filename/reset`: Khôi phục file `.docx` từ bản lưu gốc.

---

## 5. CẤU TRÚC LAYOUT TỔNG THỂ & BẢNG ĐIỀU HƯỚNG

```
+----------------------------------------------------------------------------------+
| HEADER BAR: Logo TVCI | Tên App | Sync Status Indicator | User Profile | Logout   |
+---------------------+------------------------------------------------------------+
| SIDEBAR NAVIGATION  | MAIN VIEW CONTAINER                                        |
| 📋 Danh sách phiếu  | (Nội dung thay đổi theo Navigation được chọn)             |
| ⚡ Lịch ATD          |                                                            |
| 🧲 Lịch EMC         |                                                            |
| 📦 Kho mẫu vật lý   |                                                            |
| 📄 Biên bản BMGN    |                                                            |
| 📊 Báo cáo nhật ký  |                                                            |
| ⚙️ Cấu hình hệ thống |                                                            |
+---------------------+------------------------------------------------------------+
| FLOATING WIDGETS: 💬 AI ChatBot Drawer (Trợ lý ảo hỗ trợ tra cứu)               |
+----------------------------------------------------------------------------------+
```

Nhật ký đồng bộ và chẩn đoán PostgreSQL không hiển thị thành nút riêng trên Header; người dùng mở chức năng này từ phần Cấu hình hệ thống.

### 5.1. Cài đặt Web App và nhận diện trên Taskbar (PWA Install & Taskbar Identity)

- Shell PCN phải giữ nhận diện **IEMM • TVCI**: dùng asset biểu tượng IEMM hiện hành (`/icons/iemm-logo-32.png`/`192.png`) ở sidebar/header cùng nhãn IEMM; không tự tạo logo mới, không dùng logo DDT và không lấy mã tem `IEMM` làm tên người dùng hay tên collection.
- Ứng dụng phải đáp ứng chuẩn PWA để Chrome tự hiển thị biểu tượng cài đặt trên thanh địa chỉ khi đang chạy tại `localhost` hoặc HTTPS.
- Manifest phải khai báo `id`, `scope`, `start_url`, `display: standalone`, `orientation: portrait`, `theme_color`, `background_color` và các icon PNG hợp lệ ở kích thước `192x192` và `512x512`.
- Icon dùng cho shortcut/taskbar phải giữ nhận diện logo TVCI và khai báo `purpose: any maskable` để hệ điều hành không cắt sai vùng logo khi tạo biểu tượng.
- Service worker `/sw.js` phải được đăng ký khi khởi động ứng dụng; không được chủ động unregister service worker hoặc xóa cache từ `index.html`.
- Khi profile PCN chạy qua Next App Router, `app/layout.tsx` phải khai báo manifest/icon metadata và client shell phải đăng ký cùng `/sw.js`; đăng ký này là tùy chọn về hạ tầng và không được chặn thao tác nghiệp vụ nếu trình duyệt không hỗ trợ hoặc đăng ký thất bại.
- Global CSS phải được import từ entry Vite `index.tsx`, không thêm link trực tiếp tới `/index.css` trong HTML vì URL này không phải static asset production.
- Nhánh fetch tài nguyên của service worker phải bắt lỗi mạng và trả `Response.error()` để không phát sinh unhandled promise rejection khi dev server hoặc production tạm thời không truy cập được.
- Không hiển thị nút `Cài webapp` trong Header; trình duyệt vẫn được phép tự hiển thị UI cài đặt native trên thanh địa chỉ hoặc menu hệ thống.
- Luồng PWA nền (`beforeinstallprompt`, `appinstalled`) và trạng thái standalone vẫn được giữ để không ảnh hưởng khả năng cài đặt native của trình duyệt.
- Khi chạy ở chế độ standalone, ứng dụng phải yêu cầu khóa hướng màn hình dọc bằng `screen.orientation.lock('portrait')` nếu API được trình duyệt hỗ trợ; lỗi không hỗ trợ phải được bỏ qua an toàn.
- Lỗi đăng ký service worker hoặc trình duyệt không hỗ trợ PWA không được làm gián đoạn việc khởi động và sử dụng dữ liệu nghiệp vụ.

### 5.2. Tỷ lệ hiển thị giao diện toàn cục (Global UI Scale)

- Toàn bộ giao diện web của ứng dụng phải hiển thị ở tỷ lệ **100%** theo kích thước CSS mặc định, bao gồm thanh điều hướng, bảng dữ liệu, card, form và modal.
- Tỷ lệ này được áp dụng tại vùng mount React (`#root`) bằng CSS global; vùng chứa phải giữ `width: 100%` và `min-height: 100%` để không vượt viewport khi `html, body` khóa overflow.
- Nội dung cửa sổ in, biểu mẫu xuất báo cáo và các tài liệu DOCX/PDF không chịu ảnh hưởng bởi tỷ lệ UI này; các quy chuẩn kích thước in giữ nguyên theo từng module.
- Không thay đổi token dữ liệu, kích thước ảnh báo cáo hoặc logic nghiệp vụ chỉ để phục vụ việc thu/phóng giao diện.
- Đây là thay đổi **chỉ dành cho UI/CSS**; không được sửa dữ liệu, API, logic nghiệp vụ, điều hướng hoặc tích hợp hệ thống.

### 5.2.1. Mật độ giao diện compact (Compact UI Density)

- App shell sau đăng nhập dùng scope CSS `ddt-compact` để giảm gap, padding và font theo một bậc thống nhất; nhóm token `gap-3/4/6/8`, `space-y-3/4/6` và `p-3/4/6/8` được thu gọn; `#root` vẫn giữ `zoom: 1`.
- Compact áp dụng cho header, sidebar, toolbar, card, filter và vùng nội dung nghiệp vụ; mục tiêu là tăng lượng thông tin hiển thị mà không làm mất phân cấp thị giác.
- Vùng thao tác mobile vẫn giữ touch target tối thiểu khoảng 44px; không dùng `transform: scale()` hoặc `zoom` để thu nhỏ hitbox.
- `.report-form-compact`, canvas preview, nội dung in và file DOCX/PDF giữ typography/layout riêng, không bị global compact override.
- Header phải hiển thị đúng nhãn theo `activeTab`, bao gồm `Nhật ký hệ thống`; thay đổi compact không làm đổi handler nghiệp vụ, schema, API hoặc format xuất.

### 5.3. Chuẩn responsive cho mobile (Mobile Responsive Standard)

- Audit mobile được thực hiện tuần tự trên các bề rộng viewport 320px, 375px, 390px và 430px; desktop giữ nguyên hành vi và phân cấp thị giác hiện có.
- Trải nghiệm mobile/PWA chỉ hỗ trợ hướng dọc (`orientation: portrait`); nếu thiết bị cảm ứng (`pointer: coarse`) đang nằm ngang, ứng dụng phải khóa thao tác và hướng dẫn người dùng xoay lại màn hình dọc. Không áp dụng lớp khóa này cho cửa sổ desktop hoặc DevTools responsive dùng pointer chuột.
- Shell mobile dùng header gọn, bottom navigation có thể cuộn ngang khi số mục vượt chiều rộng, và vùng nội dung phải chừa khoảng an toàn cho thanh điều hướng cố định cùng `env(safe-area-inset-bottom)`.
- Mọi layout flex/grid phải cho phép phần tử co lại bằng `min-width: 0`; chuỗi nghiệp vụ dài được xuống dòng hoặc truncate có chủ đích, không tạo tràn ngang toàn trang.
- Modal và form trên mobile ưu tiên dạng bottom sheet hoặc khung toàn chiều rộng có chiều cao tối đa theo viewport; header, vùng nội dung và footer thao tác phải cuộn độc lập khi cần.
- Bảng dữ liệu và lịch không được ép chữ quá nhỏ để né tràn; dùng card/stack hoặc vùng cuộn ngang có chỉ báo rõ ràng cho dữ liệu nhiều cột.
- Lịch bật từ các trường ngày trong biểu mẫu báo cáo phải được render ngoài vùng cuộn của form và có lớp hiển thị cao hơn nội dung, để toàn bộ ngày và điều hướng tháng luôn nhìn thấy và chọn được.
- Bảng KQTN trên mobile phải nằm trong vùng flex có `min-height: 0`, cuộn dọc độc lập và giữ chiều rộng nội dung để cuộn ngang; các dòng dữ liệu phải vẫn hiển thị trong viewport nhỏ.
- Vùng thao tác cảm ứng chính giữ kích thước tối thiểu khoảng 44px; icon-only control phải có `aria-label` hoặc `title` phù hợp.
- Nút **Tùy chỉnh nhân sự** trên trang Tổng quan phải mở/đóng danh sách bằng click/tap và có trạng thái truy cập `aria-expanded`; không phụ thuộc riêng vào `hover` để hoạt động trên mobile/PWA.
- Các thay đổi thuộc đợt audit này chỉ được tác động đến CSS, class layout, breakpoint và cách trình bày; không thay đổi schema, dữ liệu, API, logic nghiệp vụ, điều hướng hoặc định dạng xuất báo cáo.

---

## 6. MÔ HÌNH DỮ LIỆU & SCHEMA (DATA MODELS & TYPES)

Toàn bộ Type định nghĩa hệ thống nằm ở file `/types.ts`.

### Các Interface Cốt lõi:
- **`TestRequest`**: Chứa toàn bộ thông tin Phiếu yêu cầu, Mã hóa, Thông số mẫu, Kết quả đo đạc và Lịch thử nghiệm.
- **`HandoverDoc`**: Thông tin Biên bản giao nhận mẫu (Số BMGN, Loại giao/nhận, Danh sách mẫu, Xe vận chuyển).
- **`CustomerRef`**: Danh mục Khách hàng (Tên, Mã số thuế, Địa chỉ, Người liên hệ, Điện thoại).
- **`ProductRef`**: Định mức sản phẩm (Tên loại máy, Định mức phút thử ATD, Định mức phút thử EMC).
- **`Tester`**: Danh sách KTV (Tên, Tên viết tắt, Mã màu Badge, Vị trí).
- **`AppSettings`**: Cấu hình hệ thống (Chế độ làm việc T7/CN, KTV mặc định và sao lưu). Trường `geminiModel` cũ chỉ được giữ để tương thích dữ liệu; không còn là trường chỉnh sửa trong Thiết lập hệ thống.
- **Phạm vi nhân sự trên Tổng quan**: Bảng công việc, KPI và danh sách **Tùy chỉnh nhân sự** chỉ hiển thị các nhân viên thực sự được giao ít nhất một phiếu vào lịch thử nghiệm. Một phân công hợp lệ là phiếu có `scheduledDate` và `testerName` khác rỗng, `Chưa giao` hoặc `Khác`; không dùng các danh sách KTV mặc định (`defaultTesters*`) để đưa nhân sự chưa được giao việc lên Dashboard. Phân công đã hoàn thành vẫn thuộc phạm vi lịch đã từng được giao; nếu không có phân công hợp lệ nào, Dashboard không hiển thị cột/KPI nhân sự.
- **`UserPreferences`**: Cấu hình riêng theo tài khoản, gồm mật khẩu tùy chỉnh, API Key Gemini, mô hình Gemini (`geminiModel`) và ảnh đại diện. Trường `displayName` từ dữ liệu cũ (nếu còn) không được đọc, ghi hoặc dùng để thay đổi danh tính người dùng.

### Quy tắc chuyển cột mã hóa ITDC → ITD
- `itdEncodeNumber` là cột đích chuẩn cho dữ liệu mã hóa An toàn điện/ITD.
- Dữ liệu cũ trong `atdEncodeNumber` được chuyển sang `itdEncodeNumber` nhưng **giữ nguyên toàn bộ chuỗi mã**, bao gồm tiền tố `ITDC`; không tự đổi `ITDC` thành `ITD`.
- Bản ghi chỉ được chuyển tự động khi cột ITD đang trống. Nếu cả hai cột đã có giá trị khác nhau, migration phải giữ nguyên dữ liệu và xuất danh sách cần rà soát, tuyệt đối không ghi đè.
- Migration phải chạy được nhiều lần an toàn, hỗ trợ chế độ dry-run và chỉ xóa giá trị nguồn sau khi bản ghi đã được chuyển thành công và có backup/đối soát.

### Quy tắc định danh người dùng trên giao diện
- `username` / `Tên đăng nhập` là khóa kỹ thuật phục vụ đăng nhập, phân quyền, lưu preference và truy vết nội bộ; không phải tên hiển thị.
- Danh tính người dùng trong giao diện nghiệp vụ phải lấy từ `Họ và Tên` (ánh xạ vào `UserAccount.name`), ưu tiên giá trị này hơn các trường tên tổng quát hoặc bí danh.
- Không hiển thị nickname, `@username` hoặc `displayName` trong sidebar, bộ lọc/chi tiết nhật ký, phân công nghiệp vụ, sổ điều hành và các thông báo nghiệp vụ. Khi không có họ tên hợp lệ, dùng nhãn trung tính `Người dùng hệ thống`; username chỉ được giữ làm value/khóa kỹ thuật ẩn.
- Màn hình đăng nhập và quản trị tài khoản vẫn được phép hiển thị trường `Tên đăng nhập` vì đây là thông tin xác thực/kỹ thuật, không phải danh tính hiển thị.

---

## 7. CƠ CHẾ BẢO MẬT, PHÂN QUYỀN & LƯU TRỮ

### 7.1. Phân quyền Người dùng (RBAC Matrix):
- PCN dùng `systemRole` riêng, không dùng lại ý nghĩa DDT của `role=guest`:
  - **`admin`**: toàn quyền nghiệp vụ PCN, quản lý người dùng, role, danh mục, backup/restore và cấu hình.
  - **`staff`**: thao tác nghiệp vụ PCN theo chức vụ/phạm vi được giao.
  - **`viewer`**: chỉ đọc dữ liệu PCN.
- `departmentRoleCode` là danh mục chức vụ độc lập, gồm tối thiểu `LEADERSHIP`, `CERTIFICATION_EXPERT`, `TECHNICAL_REVIEWER`, `SAMPLE_COORDINATOR`, `DOCUMENT_CLERK` và `UNASSIGNED`. Chức vụ dùng để phân công, lọc, hiển thị và báo cáo; không tự tạo quyền truy cập.
- `fieldCodes` trên tài khoản là phạm vi phụ trách QC4/QC9, tách khỏi cả `systemRole` và `departmentRoleCode`.
- Tài khoản DDT có role `guest/Khách` được import một lần sang PCN với `systemRole=staff`; tài khoản Lương Xuân Hùng được giữ `systemRole=admin`. Không dùng mật khẩu hoặc session DDT cho PCN.
- **Phân quyền riêng tại trang Thiết lập hệ thống**:
  - **Admin** (`role = admin`): được xem và thực hiện toàn bộ thao tác, gồm quản lý tài khoản, reset mật khẩu, backup/restore và ghi dữ liệu backup lên PostgreSQL.
  - **Nhân sự PCN có `systemRole=staff`**: chỉ được thao tác nghiệp vụ được cấp; không được quản lý tài khoản, reset mật khẩu, backup/restore hoặc thay đổi role.
  - **Các vai trò khác**: không hiển thị mục Thiết lập hệ thống và chỉ được xem dữ liệu theo RBAC hiện hành.
  - Các giới hạn trên phải được kiểm tra cả ở giao diện, Zustand store và server API; không chỉ dựa vào trạng thái disabled của nút hoặc chuỗi chức vụ.
- **Boundary mutation PCN**: mọi `PUT/POST/DELETE` qua `/api/db/:collection*` và endpoint nghiệp vụ PCN phải đánh giá lại `systemRole` từ phiên server. `viewer` chỉ được đọc; `staff` chỉ được ghi các collection nghiệp vụ trong allowlist; collection cấu hình/template/file sinh ra phải đi qua endpoint chuyên biệt; `activityLogs` và `pcnSampleFlowEvents` là append-only. Không được coi việc ẩn hoặc disable nút ở UI là một lớp bảo vệ.

### 7.2. Lưu trữ dữ liệu Đa tầng (Multi-Tier Persistence):
1. **Local State**: Zustand cho phản hồi tức thì trên UI.
2. **Primary Database**: PostgreSQL là nguồn dữ liệu runtime duy nhất của ứng dụng, được truy cập qua REST API nội bộ của Express.
3. **Document Contract**: Các collection nghiệp vụ (`requests`, `handoverDocs`, `kqtnRecords`, `customers`, `products`, `brands`, `systemUsers`, `systemConfig`, `userPreferences`, `notifications`, `activityLogs`) được lưu trong bảng `app_documents` với khóa `(collection_name, document_id)` và payload `JSONB`, bảo toàn đầy đủ trường động của mô hình TypeScript.
4. **No External Google Storage**: Ứng dụng không sử dụng Google Apps Script, Google Sheets, Google Drive, Google Tasks hoặc Google OAuth làm nguồn đọc/ghi dữ liệu nghiệp vụ. Dữ liệu chỉ được đồng bộ qua PostgreSQL REST API; IndexedDB/Zustand là lớp cache cục bộ và JSON là định dạng sao lưu/khôi phục.
5. **Tương thích dữ liệu cũ**: Payload JSON hoặc cấu hình PostgreSQL còn trường `scriptUrl`, `spreadsheetUrl`, `googleTaskId` từ phiên bản cũ không bị xóa cưỡng bức trong đợt thay đổi này; ứng dụng không đọc, ghi hoặc khôi phục các trường đó vào luồng Google nào.
6. **Cấu hình Gemini theo tài khoản**: API Key và `geminiModel` được lưu trong collection `userPreferences` theo username chuẩn hóa. Mọi luồng gọi AI ưu tiên model cá nhân; tài khoản chưa có trường `geminiModel` mới tạm dùng giá trị `AppSettings.geminiModel` legacy rồi mới fallback về model mặc định của server. Nút kiểm tra danh sách model Google nằm trong **Cài đặt cá nhân**, không nằm trong Thiết lập hệ thống dành cho Admin.
7. **Ranh giới danh mục khởi tạo**: `systemUsers` trong Thiết lập hệ thống là danh sách runtime đọc từ collection PostgreSQL `systemUsers`; dữ liệu mặc định chỉ được seed vào collection này khi DB chưa có tài khoản. Các file `brands.csv`, `products.csv` và `customers.csv` chỉ được preload một lần trong lúc khởi tạo app để tạo dữ liệu cục bộ ban đầu, không được đọc lại trong mỗi chu kỳ đồng bộ và không được tự động ghi các dòng CSV vào PostgreSQL. Các danh mục do người dùng thêm, sửa hoặc xóa vẫn được lưu theo luồng CRUD DB hiện hành.
8. **Supabase PostgreSQL production mode**: Production Docker Desktop chạy webapp trên PostgreSQL của Supabase self-host qua network `supabase_default` và service `supabase-db`. DDT dùng database riêng `ddt_lab` trong instance Supabase, không dùng chung hoặc xóa các schema/database hệ thống của Supabase. Container và volume PostgreSQL độc lập của DDT đã được xóa sau khi migration và health check hoàn tất.
9. **Supabase Storage file boundary**: Bucket private `ddt-files` lưu các file PDF KQTN nghiệp vụ và metadata tương ứng trong `file_assets`; các object ảnh legacy và metadata legacy đã được cleanup. Production webapp không tạo file asset mới cho ảnh OCR/Lập báo cáo.
10. **Supabase Storage Docker wiring**: Compose production mặc định dùng `http://supabase-storage:5000` trên network `supabase_default`; service role secret phải được nạp từ env bên ngoài qua `SUPABASE_SERVICE_ROLE_KEY` hoặc alias `SERVICE_ROLE_KEY` của Supabase self-host, không ghi secret vào source/repository.
11. **Ảnh OCR và ảnh lập báo cáo là dữ liệu tạm**: Ảnh tải lên/dán vào luồng OCR hoặc form Lập báo cáo chỉ được giữ trong state của phiên hiện tại để xử lý OCR, crop và xuất DOCX. Khi lưu `kqtnRecords`, ứng dụng phải loại bỏ `productPhoto*`, `nameplatePhoto*`, `nameplatePhotos` và `emcData.images`; không tạo file asset mới và không ghi Base64 ảnh vào PostgreSQL. Dữ liệu ảnh legacy đã được cleanup, và ảnh mới không được tiếp tục nhân bản khi chỉnh sửa/lưu báo cáo.
12. **Ranh giới đồng bộ khi lưu phiếu**: `RequestModal` chỉ đọc riêng collection `requests` trước khi lưu để kiểm tra mã phiếu trùng; không thực hiện full sync cho bước kiểm tra. Sau khi cập nhật state cục bộ, luồng tạo/sửa phiếu phải thực hiện đúng một full sync hậu lưu để ghi phiếu, notification, các thay đổi liên quan và hòa giải hai chiều. `addRequests` chỉ bỏ qua sync trong chính luồng `RequestModal`; các caller khác vẫn giữ cơ chế sync mặc định. Nhật ký hoạt động tiếp tục ghi trực tiếp qua `/api/activity-logs` và không được gộp vào full sync.
13. **Bản nháp Phiếu Yêu Cầu**: Khi tạo phiếu mới, `RequestModal` tự lưu bản nháp theo tài khoản trong IndexedDB cục bộ để người dùng có thể tiếp tục sau khi đóng modal ngoài ý muốn. Bản nháp chỉ chứa các trường nghiệp vụ có thể tuần tự hóa gồm thông tin chung, danh sách mẫu, mẫu đang nhập và tùy chọn thông tin hóa đơn; không lưu ảnh/file OCR, trạng thái quét hoặc dữ liệu UI tạm thời. Nếu phát hiện bản nháp khi mở modal tạo mới, người dùng phải chủ động chọn khôi phục hoặc xóa. Nút `Xóa bản nháp` xóa dữ liệu cục bộ, đưa form đang mở về đúng trạng thái ban đầu như vừa mở modal và giữ modal hiển thị; không áp dụng cơ chế bản nháp cho modal chỉnh sửa nhóm phiếu. Sau khi lưu phiếu thành công, bản nháp tương ứng phải được xóa.

### 7.3. Hợp đồng REST API & triển khai Docker:
- `GET /api/db/health`: Kiểm tra kết nối PostgreSQL.
- `POST/GET/DELETE /api/auth/pcn-session`: Đăng nhập, kiểm tra và hủy phiên PCN; chỉ `POST` mới đọc `systemUsers` để xác thực, các response chỉ trả user snapshot an toàn.
- `GET /api/db/:collection`: Đọc toàn bộ document của collection, trả về `id` cùng payload JSONB.
- `PUT /api/db/:collection/:id`: Upsert một document theo định danh.
- `DELETE /api/db/:collection/:id`: Xóa một document theo định danh.
- `POST /api/db/:collection/batch` và `POST /api/db/:collection/delete-batch`: Ghi/xóa theo lô tối đa 250 document mỗi lượt.
- Khi `APP_PROFILE=pcn`, toàn bộ `/api/db/*`, `/api/db-meta`, `/api/activity-logs/*` và `/api/pcn/files/*` yêu cầu phiên `pcn_certification_session`; `/api/db/health` vẫn là health probe không chứa credential.
- Không còn route proxy `/api/gas` và không có REST endpoint nào gọi sang Google để lưu/đọc dữ liệu nghiệp vụ. Endpoint `/api/gemini/*` chỉ phục vụ AI, không phải persistence.
- `GET /api/gemini/models` chỉ được gọi theo thao tác chủ động **Kiểm tra Google** trong Cài đặt cá nhân; khi chưa có key trả `503/GEMINI_API_KEY_MISSING`, khi Google/network lỗi trả `503/GEMINI_API_UPSTREAM_UNAVAILABLE`, không trả lỗi `500` chung.
- Môi trường development native trên Windows chạy trên `PORT=1357` và kết nối direct PostgreSQL Supabase qua `127.0.0.1:15432` (chỉ bind loopback); Compose PCN production kết nối `supabase-db:5432` trên network `supabase_default`. Web server production lắng nghe `PORT=2357` và Docker Desktop publish `2357:2357`.
- KQTN bulk OCR dùng chung PaddleOCR microservice `tvci_ocr_service` của TVCI_APP. Production DDT gọi qua network nội bộ `supabase_default` bằng `OCR_SERVICE_URL=http://tvci_ocr_service:8100`; development chạy trên host dùng `http://127.0.0.1:8100`, với OCR port chỉ bind loopback để không public ra Internet.
- PaddleOCR cung cấp endpoint OCR PDF cục bộ dành cho Bulk Upload; với PDF ghép, service chỉ OCR vùng footer của từng trang, không OCR phần nội dung toàn trang để phân nhóm. DDT chuẩn hóa khóa footer theo `Số mã hóa` và các họ định danh `ITD`, `EMC`, `ITDC`; ngày, số trang và text thân báo cáo không được dùng làm khóa. Bulk Upload dùng PaddleOCR và matching tên file làm nguồn nhận diện chính; Gemini không phải dependency bắt buộc và không được tự động gọi để chặn phiên khi OCR local không đủ rõ.
- Với PDF scan lớn (ví dụ khoảng 59 MB/116 trang), Bulk Upload phải upload multipart một lần vào DDT, nhận `jobId` và polling tiến độ; không encode/gửi lại từng trang từ trình duyệt. DDT giữ PDF nguồn tạm trong job có TTL, chuyển một lần tới endpoint footer-batch của PaddleOCR rồi xóa bytes nguồn khi job hoàn tất/thất bại/hết hạn.
- Footer-batch của PaddleOCR phải nhận toàn bộ PDF một lần. DDT tạo PDF tạm với MediaBox/CropBox chỉ chứa khoảng 8% cuối trang (dòng mã và phân số footer) theo hướng hiển thị, có tính rotation 90/180/270 của scan, vì pdf2image mặc định ưu tiên MediaBox; service vẫn crop thêm khi endpoint nhận `footer_ratio` nếu hỗ trợ. Service dùng thumbnail 90 DPI để chọn ứng viên và OCR ứng viên footer ở 150 DPI, giải phóng ảnh sau từng trang và tuần tự hóa lượt gọi predictor dùng chung để tránh lỗi tensor khi dev/production chạy đồng thời; job bất đồng bộ có ngân sách tối đa 15 phút và báo lỗi từng trang nếu có.
- OCR production phải pin cặp runtime CPU tương thích `paddleocr==3.7.0` và `paddlepaddle==3.2.0`; service warm-up engine khi khởi động và lưu cache model trong named volumes để tránh lỗi PIR/oneDNN và độ trễ khởi tạo ở request đầu tiên. Bulk OCR dùng cặp model mobile `PP-OCRv5_mobile_det/rec`; OCR toàn trang dùng DPI thấp `120` cho scan lớn và proxy trang đầu dùng `150 DPI` để giữ phản hồi trong giới hạn reverse proxy.

### 7.4. Hệ thống Thông báo & Hoạt động Nghiệp vụ (Business Notification System):
- **Nguyên tắc ít nhiễu**: Chỉ phát notification ngay cho thay đổi lớn có tác động tới tiến độ, phân công, trạng thái, mẫu, biên bản hoặc kết quả. Chỉnh sửa văn bản nhỏ như xóa chữ, đổi tên/đổi mã hiển thị, ghi chú và các field mô tả không phát notification.
- **Nguồn sự kiện lớn**: Tạo/xóa phiếu, thay đổi trạng thái, xếp/gỡ/chuyển lịch, giao việc, tạo/xóa biên bản, cập nhật/xóa KQTN và các cập nhật phiếu ảnh hưởng tới loại kiểm tra, số lượng, độ ưu tiên, ngày nhận mẫu, kết quả hoặc định danh kỹ thuật đều phát notification có metadata `entityType`, `action`, `entityId`, `entityLabel` và người thực hiện.
- **Phạm vi Admin/Quản lý**: Admin/Quản lý nhận toàn bộ notification nghiệp vụ, bao gồm cả thông báo phân công công việc.
- **Phạm vi nhân viên**: Nhân viên chỉ nhận phiếu yêu cầu mới, biên bản mới được tạo và công việc mới được giao cho chính tài khoản đó.
- **Kênh hiển thị**: Mọi tài khoản đã đăng nhập đều có chuông và dropdown notifications; nội dung hiển thị vẫn được lọc theo `targetRole` và `targetUsernames` để tránh gửi lan và gây loãng.
- **Định tuyến theo tài khoản**: Notification dùng `targetRole` (`admin` hoặc `staff`) và `targetUsernames` tùy chọn. Notification `staff` được Admin/Quản lý xem được; khi có `targetUsernames`, chỉ tài khoản được chỉ định nhận notification ở nhóm nhân viên.
- **Định danh người được giao**: Trường `testerName` trên phiếu được đối chiếu với `systemUsers` theo tên đăng nhập/họ tên để lưu username ổn định vào `targetUsernames`; nếu không xác định được tài khoản, notification phân công chỉ hiển thị cho Admin/Quản lý và không gửi nhầm cho nhân viên khác.
- **Phân công hồ sơ PCN**: Activity `PCN_DOSSIER` có thay đổi `ownerUsername`, `evaluatorUsername` hoặc `reviewerUsername` phải được phát hiện là thao tác phân công; notification tương ứng dùng `action=ASSIGNED`, `targetRole=staff` và chỉ gửi `targetUsernames` là các username mới khác rỗng. Trigger PostgreSQL và helper browser phải giữ cùng quy tắc, không gửi lan cho nhân viên khác và không suy diễn danh tính từ tên hiển thị.
- **Gộp sự kiện**: Một thao tác nhóm (ví dụ xóa toàn bộ phiếu theo mã hoặc tạo nhiều mẫu cùng mã phiếu) tạo một notification tổng hợp, tránh phát nhiều notification cho cùng một hành động của người dùng.
- **Điều hướng**: Click notification mở đúng khu vực nghiệp vụ: phiếu mở tab danh sách và bộ lọc mã phiếu; biên bản mở tab giao nhận và chi tiết biên bản; KQTN mở tab kết quả; lịch mở đúng tab ATD/EMC.
- **Lưu trữ & đồng bộ**: Notification được lưu trong collection `notifications` của `app_documents`, merge theo `id`, giới hạn hiển thị 50 bản ghi mới nhất. Xóa tất cả phải xóa cả bản ghi cloud để không quay lại sau đồng bộ.
- **Sao lưu & khôi phục**: Gói backup JSON phải bao gồm `notifications`; restore và upload PostgreSQL phải chuẩn hóa, xóa bản ghi cloud ngoài backup và khôi phục đúng danh sách notification.
- **Tương thích**: Notification cũ chỉ có `type`, `targetRole`, `requestCode` vẫn phải hiển thị được; các trường metadata mới là tùy chọn khi đọc dữ liệu lịch sử.

### 7.4.1. Nhật ký hệ thống (System Activity Audit Log):
- **Mục đích**: Activity log là sổ audit riêng, dùng để tra cứu lịch sử thao tác toàn hệ thống; không dùng thay cho notification và không bị ảnh hưởng bởi thao tác xóa/đánh dấu notification.
- **Phạm vi ghi**: Mọi mutation nghiệp vụ thành công đều ghi log, kể cả chỉnh sửa nhỏ. Phiếu, biên bản, KQTN, lịch, trạng thái, phân công, người dùng, danh mục và thiết lập đều phải có actor, thời gian, action, entity, summary và diff phù hợp.
- **Chính sách ít nhiễu**: Chỉ thay đổi lớn mới phát notification; thay đổi nhỏ vẫn xuất hiện trong activity log nhưng không phát notification ngay.
- **Lưu trữ**: Dùng collection `activityLogs` trong `app_documents`, append-only đối với UI, không có endpoint sửa/xóa log cho người dùng.
- **Quyền xem**: Tất cả tài khoản đã đăng nhập được thấy và đọc nhánh `Nhật ký hệ thống`; nhánh này nằm ngay trước `Thiết lập`. Activity log là dữ liệu chỉ đọc trên giao diện, không cho người dùng sửa/xóa.
- **Đọc dữ liệu**: Trang dùng API phân trang/lọc chuyên dụng theo cursor; không tải toàn bộ lịch sử vào Zustand.
- **Sao lưu**: Gói backup đầy đủ phải bao gồm `activityLogs`; restore không được làm mất log đã tồn tại và phải ghi một log tổng hợp cho thao tác restore thành công.
- **Bộ lọc & KPI**: Trang có dropdown/checkbox chọn nhiều người dùng từ `systemUsers`; bỏ chọn hết tương đương xem tất cả. Không hiển thị bộ lọc “Từ ngày/Đến ngày”; thay bằng selector kỳ `Ngày`, `Tuần`, `Tháng`, `Năm`, mặc định `Tháng`. Biên kỳ của cả nhật ký và KPI cố định theo `Asia/Ho_Chi_Minh` (GMT+7), không phụ thuộc timezone trình duyệt.
- **KPI trực quan**: API summary tổng hợp theo actor trong cùng kỳ đã chọn, không phụ thuộc page size nhật ký. UI dùng danh sách biểu đồ thanh ngang xếp chồng để so sánh nhiều nhân viên trong cùng viewport; mỗi dòng phải hiển thị tổng thao tác và các số liệu nhóm Phiếu/KQTN/Biên bản/Lịch/Khác. Phần cơ cấu chi tiết của người được chọn có thể hiển thị bổ sung trên desktop, nhưng không được làm giảm khả năng đọc danh sách KPI trên mobile; số phiếu/mẫu/biên bản phải đếm distinct entity ID.

### 7.5. Nguyên Tắc Bảo Toàn Dữ Liệu Nghiệp Vụ Khi Quản Trị Người Dùng (Data Integrity & User Lifecycle Isolation):
- **Cách ly tuyệt đối (Zero Cascade Deletion)**: Thao tác thêm mới (`addUser`), chỉnh sửa (`updateUser`), hoặc xóa tài khoản người dùng (`deleteUser`) chỉ tác động duy nhất đến danh mục tài khoản truy cập (`systemUsers`).
- **Bảo toàn 100% hồ sơ nghiệp vụ**: Tuyệt đối không xóa, không ghi đè, không làm hao hụt bất kỳ bản ghi nào thuộc danh sách Mẫu thử & Phiếu yêu cầu (`requests`), Biên bản giao nhận mẫu (`handoverDocs`), hay Biên bản kết quả thử nghiệm (`kqtnRecords`).
- **Lưu giữ lịch sử phân công**: Các trường thông tin KTV phụ trách (`testerName`), Người tạo (`createdBy`), Người nhận bàn giao (`representative`) gắn với các mẫu thử/phiếu thử nghiệm cũ vẫn được giữ nguyên dạng văn bản lịch sử, hiển thị đầy đủ trên Lịch điều phối, Nhật ký tổng hợp, và Phiếu in.
- **Đồng bộ xóa danh mục an toàn**: Áp dụng cơ chế danh sách xóa định danh (`deletedUserIds`) trong cấu hình hệ thống (`systemConfig`) để đảm bảo tài khoản đã xóa không bị khôi phục nhầm trong các chu kỳ đồng bộ hai chiều, đồng thời không gây ảnh hưởng đến dữ liệu thử nghiệm.

### 7.6. Chuẩn Hóa Sao Lưu & Khôi Phục Dữ Liệu Toàn Diện (Backup & Restore Specification):
- **Cổng nhập danh mục khách hàng PCN trong giao diện Admin**: Màn hình đối soát cho phép chọn CSV/JSON từ máy người vận hành, lập preview server-side từ cùng parser/mapping canonical, hiển thị count/hash, khóa thiếu/thừa, trường lệch, duplicate và ứng viên alias read-only. Với mỗi alias ứng viên, Admin phải chọn tường minh `Giữ khóa nguồn` hoặc `Map vào khóa đích duy nhất`; không có lựa chọn thì không được apply, và mapping không bao giờ tự suy diễn. Chỉ khi preview còn hợp lệ, quyết định alias đầy đủ và Admin nhập lại đúng chuỗi `KHOI_TAO_DANH_MUC_PCN` để apply; server phải rebuild preview, kiểm tra hash đích không đổi, kiểm tra các quyết định alias khớp candidate hiện tại, chọn và kiểm chứng archive PCN đã tồn tại trước thời điểm job, rồi mới ghi customer/audit trong một transaction. Mapping khóa phải đi qua boundary có audit; retry cùng source fingerprint + checkpoint + quyết định alias không tạo customer/audit trùng. CLI cũng phải truyền quyết định tường minh bằng `--keep-alias=<sourceKey>` hoặc `--map-alias=<sourceKey>=<targetKey>`, không có cờ bypass. Staff/viewer chỉ được xem đối soát, không được apply.
- **Cấu trúc gói sao lưu JSON**: Bao gồm đầy đủ `requests`, `handoverDocs`, `kqtnRecords`, `customers`, `products`, `brands`, `dayConfigs`, `systemUsers`, `notifications`, `activityLogs`, `settings`, `timestamp`; trường `resultPdf` chỉ chứa metadata/pointer, không nhúng byte file.
- **Sao lưu đầy đủ phía Admin**: Bản sao lưu máy chủ dạng archive phải chứa dump PostgreSQL của `ddt_lab` (bao gồm `file_assets`), manifest metadata file và toàn bộ object PDF KQTN tương ứng trong Supabase Storage. Ảnh OCR/Lập báo cáo mới là dữ liệu tạm nên không thuộc backup và không được đưa vào `file_assets`.
- **Migrate file có thể lặp lại**: Job migrate dùng checksum và object path ổn định để chạy lại an toàn, không xóa Base64 nguồn trước khi consumer đã chuyển sang Storage và đã kiểm tra restore.
- **Quy trình khôi phục an toàn (Safe Restore Flow)**:
  1. Kiểm tra cấu trúc và tính hợp lệ của tệp sao lưu JSON.
  2. Chuẩn hóa dữ liệu đầu vào và làm mới dấu thời gian `updatedAt`.
  3. Gom nhóm xóa hàng loạt (`POST /api/db/:collection/delete-batch`, tối đa 250 bản ghi/lượt) các bản ghi PostgreSQL không thuộc file sao lưu.
  4. Gom nhóm lưu hàng loạt (`POST /api/db/:collection/batch`) toàn bộ danh mục mới vào PostgreSQL.
  5. Đặt lại toàn bộ danh sách xóa định danh (`deleted*Ids`) về rỗng trên `systemConfig` để tránh xung đột xóa nhầm trong chu kỳ đồng bộ tiếp theo.
  6. Cập nhật Store Zustand và tải lại dữ liệu mới nhất từ REST API PostgreSQL trên giao diện người dùng.
- **Preflight trước restore archive máy chủ**: Trước khi chạy `pg_restore` hoặc upload lại object Storage, server phải chạy cùng cổng kiểm chứng archive read-only; chỉ archive có dump đọc được, manifest hợp lệ và toàn bộ object qua byte size/SHA-256 mới được tiếp tục. Nếu preflight thất bại, restore phải dừng trước mọi thao tác ghi đè và không ghi log restore thành công.
- **Khôi phục file nghiệp vụ**: Sau khi khôi phục dump PostgreSQL, phải khôi phục object PDF từ archive trước khi báo thành công; metadata `file_assets` và `resultPdf.objectPath` phải trỏ tới object tồn tại. File ngoài danh sách backup không được tự động đưa trở lại dữ liệu nghiệp vụ.
- **Module Sao lưu & khôi phục trong shell PCN**: Mục `Sao lưu & khôi phục` chỉ hiển thị cho tài khoản có `systemRole=admin` hoặc `role=admin`; staff/viewer không được thấy mục này và không được gọi các thao tác backup qua UI. Module dùng các endpoint `/api/backups*` hiện hành, hiển thị trạng thái khả dụng của `pg_dump`/`pg_restore`, danh sách archive PCN, dung lượng và thời điểm tạo; Admin có thể tạo mới, tải xuống hoặc xóa archive. Nút tạo archive trong ngữ cảnh đối soát phải được gọi rõ là `Tạo checkpoint trước import`; thao tác này vẫn dùng cùng archive thủ công hiện hành, tự kiểm chứng archive vừa tạo và hướng dẫn Admin dùng nó trước một lần import/cutover mới, không tạo thêm loại file hay kho lưu trữ riêng. Khôi phục phải có bước xác nhận riêng theo đúng chuỗi `KHOIPHUC`, cảnh báo ghi đè toàn bộ database/file, chỉ gọi API sau khi chuỗi khớp, rồi tải lại Store PCN sau khi thành công. UI phải yêu cầu archive đã có kết quả kiểm chứng `ok=true` trước khi mở bước xác nhận khôi phục; server vẫn phải kiểm chứng lại ngay trước restore để tránh dùng trạng thái cũ. UI không được gọi trực tiếp DDT collection hoặc làm lộ đường dẫn lưu trữ máy chủ.
- **Audit thao tác archive**: Tạo archive thủ công/tự động và xóa archive thành công phải ghi `activityLogs` append-only với entity `SYSTEM`, action tương ứng và actor; backup tự động dùng actor hệ thống. Tải archive là thao tác đọc nên không phát sinh log. Log restore phải tiếp tục tuân thủ quy tắc bảo toàn lịch sử trước khôi phục ở mục 7.4.1.
- **Cổng sẵn sàng backup trước cutover**: Kiểm chứng read-only phải chọn archive PCN mới nhất, xác nhận đúng prefix/profile, có `database.dump`, manifest Storage và đủ object theo manifest; mỗi object phải qua kiểm tra byte size/SHA-256 và dump phải được `pg_restore --list` đọc được khi công cụ khả dụng. Cổng này chỉ ghi nhận bằng chứng, không restore, không xóa archive và không sửa dữ liệu nghiệp vụ. Archive thiếu, hỏng hoặc không kiểm chứng được phải giữ trạng thái chưa sẵn sàng.
- **Cổng backup trước import danh mục PCN**: Job import khách hàng được phép `--dry-run` không cần archive, nhưng trước `--apply` phải chọn archive PCN mới nhất đã tồn tại trước thời điểm bắt đầu job, kiểm chứng lại archive ở server và yêu cầu trạng thái `VALID`, dump đọc được, manifest đầy đủ cùng toàn bộ object hợp lệ. Nếu archive mới nhất trước checkpoint bị hỏng hoặc không tồn tại, job phải dừng trước transaction và không ghi dữ liệu khách hàng/audit; báo cáo apply chỉ nêu tên archive, thời điểm và trạng thái kiểm chứng, không in byte file hay dữ liệu liên hệ. Khi apply thành công, mỗi audit `PCN_CUSTOMER` phải lưu tuple checkpoint tối thiểu `filename`, `createdAt`, `status=VALID` và fingerprint nguồn để chứng minh thứ tự backup → import mà không lưu byte archive hay thông tin liên hệ.

---

## 8. QUY CHUẨN MÃ NGUỒN VÀ TUÂN THỦ (CODE CONVENTIONS)

### ⚠️ QUY TẮC BẮT BUỘC KHI CẬP NHẬT HOẶC TẠO FILE:

1. **Bảo mật File Môi trường (`.env`)**:
   - Mọi thao tác tác động lên file `.env` đều phải được sự đồng ý rõ ràng từ người dùng.

2. **Quản lý Server & Testing**:
   - Khi thay đổi các cấu hình server hoặc backend, bắt buộc kill tiến trình cũ và khởi chạy server native mới trên cổng 1357 để kiểm thử.

3. **Một nguồn chuẩn cho danh mục khách hàng**:
   - Parser CSV, chuẩn hóa bản ghi, khóa đối soát và phép tính khác biệt của danh mục khách hàng PCN phải dùng chung utility canonical giữa UI, CLI và cutover verifier; module migration chỉ giữ policy import/merge riêng, không sao chép lại logic đối soát.

4. **Runner lệnh PCN**:
   - Các lệnh CLI bảo trì PCN phải tự đặt `APP_PROFILE=pcn` qua một runner dùng chung, kế thừa đúng mã thoát và output của tiến trình con; người vận hành không phải tự ghép biến môi trường theo shell/Windows trước khi chạy đối soát, smoke hoặc import. Runner không được thay đổi dữ liệu ngoài policy của chính lệnh được gọi.

## 9. QUY CHUẨN KÍCH THƯỚC VÀ TỶ LỆ HÌNH ẢNH TRONG BÁO CÁO (.DOCX)

- **Bảo toàn tỷ lệ khung hình (Aspect Ratio = width / height)**: Tất cả hình ảnh khi chèn hoặc thay thế vào các file Word (.docx) báo cáo phải luôn giữ nguyên tỷ lệ chiều ngang / chiều dọc gốc của ảnh, tuyệt đối không làm méo hoặc biến dạng hình.
- **Hình ảnh đồ thị thử nghiệm (EMC / Radimation Graphs)**:
  - Chiều ngang cố định chuẩn: **165mm** (tương đương 624px theo chuẩn 96 DPI của Word / OpenXML).
  - Chiều dọc được tính toán tự động theo đúng tỷ lệ thực tế của ảnh gốc: `Height = Math.round(OriginalHeight * (624 / OriginalWidth))`.
- **Hình ảnh chụp mẫu thử, tem nhãn và ảnh thiết lập (`anh_1` - `anh_6`)**:
  - Toàn bộ ảnh tem được ghép ngang vào một ảnh composite tại `anh_1`; từng ảnh thành phần phải giữ nguyên tỷ lệ khung hình.
  - Ảnh composite và các ảnh hỗ trợ được căn chỉnh theo khung giới hạn tối đa (`MAX_WIDTH` x `MAX_HEIGHT`) của từng vị trí bố cục.
  - Tỷ lệ co/phóng luôn đồng nhất theo cả 2 trục bằng hệ số `ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h)` để đảm bảo giữ nguyên tỷ lệ gốc.
- **Hình ảnh phụ lục báo cáo TCVN 5699-2 (`productImage*`, `nameplateImage*`)**:
  - Khi có đủ cả 2 ảnh cùng loại (2 ảnh mẫu hoặc 2 ảnh tem): `MAX_WIDTH = 315`, `MAX_HEIGHT = 392` (tăng ~1.4 lần so với 270x280px trước đây). Giới hạn này đảm bảo 2 ảnh đặt cạnh nhau trong bảng phụ lục (khổ ~651px) không bị rớt dòng và 4 ảnh nằm gọn trong đúng 1 trang A4, không tràn sang trang thứ 2.
  - Khi chỉ có 1 ảnh đơn lẻ: `MAX_WIDTH = 620`, `MAX_HEIGHT = hasOtherRow ? 392 : 620`.

## 10. QUY CHUẨN NHẬT KÝ ĐỒNG BỘ VÀ CHẨN ĐOÁN DỮ LIỆU (SYNC DIAGNOSTIC SYSTEM)

- **Cơ chế Chẩn đoán Hai tầng**:
  - Tầng 1: PostgreSQL Server qua REST API (`/api/db/:collection`) - đối chiếu số lượng, thời gian cập nhật và trạng thái kết nối.
  - Tầng 2: IndexedDB / Local Store - kiểm tra danh sách bản ghi cục bộ và danh sách ID đã xóa (`deletedRequestIds`).
- **So sánh Timestamp Bản ghi Mới nhất**:
  - Trích xuất bản ghi mới nhất trên Cloud vs Bản ghi mới nhất tại Local (`createdAt`, `updatedAt`, `requestDate`).
  - Đo độ lệch thời gian (`timeDifferenceSeconds`) và hiển thị 10 bản ghi mới nhất từ Cloud để người dùng kiểm chứng ngay lập tức.
- **Chẩn đoán đích danh Lô / Mã mẫu (Deep Lot Inspection)**:
  - Cho phép tra cứu trực tiếp bất kỳ mã lô (ví dụ: `1242-26`, `1142-26`) hoặc mã PYC để tìm kiếm trên 2 nguồn (PostgreSQL API, Local DB).
  - Tự động đưa ra kết luận chẩn đoán nguyên nhân (do chưa lưu, nằm trong danh sách đã xóa, hay bị ẩn bởi bộ lọc phân loại/ngày tháng) và đề xuất hướng xử lý cụ thể.
- **Chẩn đoán danh mục khách hàng PCN**: Snapshot runtime phải kiểm tra read-only các bản ghi khách hàng có dữ liệu nghiệp vụ tối thiểu, báo riêng bản ghi rỗng/không có tên hoặc mã ổn định và cho phép mở module **Danh sách khách hàng** để rà soát; bảng khách hàng phải hiển thị nhãn cảnh báo ngay trên bản ghi rỗng để tránh nhầm với khách hàng hợp lệ, đồng thời thao tác mở từ cảnh báo phải truyền khóa ổn định để tự điền bộ lọc bản ghi cần rà soát; không tự khôi phục, xóa hoặc merge dữ liệu.
- **Chẩn đoán catalog biểu mẫu PCN**: Snapshot runtime phải kiểm tra read-only từng `pcnTemplateDefinitions` có `fileAssetId` và cờ `privateAssetVerified` do server đối chiếu đầy đủ provenance/fingerprint trong `file_assets`; mẫu thiếu asset hoặc asset không được xác minh phải hiện cảnh báo riêng, gắn đúng mã template và mã nguyên nhân an toàn (`privateAssetVerificationIssue`, ví dụ sai MIME, byte size hoặc SHA-256), đồng thời hiển thị nhãn tiếng Việt dễ hiểu kèm mã kỹ thuật để nhân viên xử lý. Module **Quản lý biểu mẫu PCN** phải có lọc nhanh theo QC4/QC9, trạng thái catalog và trạng thái xác minh asset để nhà quản lý tập trung vào mẫu cần xử lý. Cảnh báo cho phép mở module để rà soát. Projection chỉ trả trạng thái/mã nguyên nhân, không trả byte file, credential hoặc đường dẫn Desktop. Kiểm tra này không sửa catalog, không upload/xóa asset và không coi cảnh báo là lý do tự động phê duyệt hoặc loại bỏ mẫu.
- **Màn hình đối soát cutover PCN**: Admin có thể mở một màn hình read-only gọi endpoint `/api/pcn/cutover-status` để xem cùng snapshot với CLI: profile/database, collection ngoài allowlist, bằng chứng riêng rằng các collection nghiệp vụ DDT bị cấm không xuất hiện trong database PCN, QC4/QC9, count/hash khách hàng, legacy mapping, backup verification, file pointer, notification và activity log. Màn hình phải nêu rõ từng lỗi cần nghiệm thu, không có nút restore/delete và không tự sửa dữ liệu hoặc snapshot; cổng nhập danh mục khách hàng là action Admin riêng theo mục 7.6, chỉ chạy sau preview/fingerprint/checkpoint/confirmation và không được coi là thao tác của snapshot read-only. Admin có thể xuất CSV từ snapshot và kết quả đối chiếu nguồn hiện đang hiển thị; file chỉ gồm số liệu, khóa/tên trường chênh lệch và lỗi/trùng, không chứa thông tin liên hệ, byte file, credential hoặc payload thô.
- **Bằng chứng checkpoint import trên màn hình cutover**: Snapshot read-only phải chọn audit `PCN_CUSTOMER` gần nhất có `source=IMPORT`, đọc tuple `backupCheckpoint.filename`, `backupCheckpoint.createdAt`, `backupCheckpoint.status=VALID` và `idempotencyFingerprint`; UI hiển thị trạng thái có/thiếu bằng chứng và chỉ metadata an toàn, không suy diễn lần import cũ là đã có checkpoint nếu audit không chứa đủ tuple. Checkpoint chỉ hợp lệ khi thời điểm tạo archive không ở sau thời điểm tạo audit import (`backupCheckpoint.createdAt <= audit.createdAt`); checkpoint tương lai hoặc sai thứ tự phải bị bỏ qua. Khi checkpoint tồn tại, snapshot còn phải kiểm chứng đúng archive được tham chiếu vẫn tồn tại và đạt `VALID`, không chỉ tin vào tuple trong audit.
- Cổng kiểm chứng cutover có đối soát file nguồn phải yêu cầu tường minh bằng chứng checkpoint (`requireCustomerImportCheckpoint`); kiểm tra archive tổng quát không được ngầm coi archive mới nhất là checkpoint của lần import cũ. Nếu thiếu tuple, sai thứ tự thời gian, fingerprint không hợp lệ hoặc archive tham chiếu không còn kiểm chứng được, kết quả phải là chưa đạt và nêu rõ nguyên nhân.
- **Smoke runtime PCN**: Lệnh `npm run smoke:pcn-runtime` là kiểm tra vận hành read-only có thể lặp lại sau khi khởi động server. Lệnh chỉ tạo phiên đăng nhập tạm thời để kiểm tra health, session, database/profile, các endpoint danh mục và nghiệp vụ cốt lõi, cổng cutover cùng archive backup mới nhất; không tạo/sửa/xóa hồ sơ và không gọi mutation nghiệp vụ có khả năng ghi. Riêng boundary nhập khách hàng được gọi preview với dữ liệu giả lập và apply guard với fingerprint/xác nhận rỗng để chứng minh server từ chối trước transaction. Lệnh không in mật khẩu, thông tin liên hệ, byte file hoặc payload thô. `cutover.ok = false` được báo như cảnh báo đối soát hiện hữu; lệnh chỉ thất bại khi hạ tầng, phiên đăng nhập, boundary profile hoặc archive kiểm chứng không đáp ứng.

---


## 11. KQTN THEO ĐẦU MẪU, FILE PDF & BULK UPLOAD

- Một đầu mẫu thử nghiệm dùng chung cho KQTN và Sổ Tổng hợp được định danh bằng `sampleCode`/số mã hóa chuẩn hóa và tham chiếu về `requestId`/phiếu yêu cầu. Sổ Tổng hợp quản lý vòng đời, thông tin hành chính, trạng thái nhận mẫu, lịch và giao trả; KQTN quản lý kết quả thử nghiệm và PDF.
- `sampleCode` là bắt buộc khi lưu KQTN. Các biến thể về khoảng trắng, dấu phân cách, chữ hoa/thường hoặc dấu tiếng Việt phải quy về cùng `sampleKey`. Mỗi `sampleKey` chỉ có một KQTN hiện hành.
- KQTN hiển thị đầu mẫu từ `requests` cùng trạng thái `Chưa có KQTN` hoặc `Đã có KQTN`; KQTN không tạo nguồn mẫu thứ hai và không thay thế luồng biên bản Giao nhận.
- Khi chưa có KQTN, Lưu tạo bản ghi mới. Khi đã có KQTN, hệ thống phải hỏi xác nhận ghi đè; hủy không thay đổi dữ liệu. Đồng ý ghi đè cập nhật cùng `id`, tăng `version`, thêm `versionHistory`, không tạo thêm dòng.
- Bảng KQTN có cột `File PDF`: chưa có file thì Upload; có file thì Xem file, Download hoặc Ghi đè. Ghi đè chỉ hoàn tất khi file mới lưu thành công và object cũ đã bị xóa.
- `KQTNRecord.resultPdf` chỉ lưu metadata/pointer private gồm `assetId`, `objectPath`, `originalName`, `mimeType`, `byteSize`, `sha256`, `uploadedAt`, `uploadedBy`; không lưu Base64 PDF trong JSONB.
- Header KQTN có `Bulk Upload`. AI đọc mã hóa/model từ tên file và nội dung PDF để đề xuất đầu mẫu; người dùng sửa mapping thủ công từng file, xem cảnh báo độ tin cậy và xác nhận riêng các trường hợp ghi đè.
- `Bulk Upload` hỗ trợ cả nhiều PDF đơn và một PDF nguồn ghép nhiều báo cáo. Với PDF ghép, các trang được chia thành các nhóm liên tục bắt đầu từ trang bìa báo cáo; trang trắng phân cách ở đầu/cuối nhóm bị loại khỏi PDF con. Hệ thống chỉ dùng khóa footer để xác định nhóm, `sampleCode`/số mã hóa và `reportNo` (`ITD`/`EMC`/`ITDC`); các giá trị được chuẩn hóa hoa thường, dấu tiếng Việt, dấu phân cách và số thứ tự `M02` tương đương `M2`. Sau khi có nhóm, hệ thống OCR Paddle tối đa 3 trang đầu của từng nhóm để lấy model và tìm mẫu đích; dừng sớm khi đã đọc được model. Luồng này không phụ thuộc Gemini.
- Việc nhận diện PDF ghép là best-effort: khi OCR không xác định được khóa footer hoặc model đọc từ các trang đầu bị thiếu/trùng nhiều đầu mẫu, nhóm chuyển sang trạng thái cần chọn thủ công. Footer không được so sánh với `candidate.model` và không được dùng để suy diễn model; model chỉ đến từ OCR giới hạn ở các trang đầu nhóm. Nếu không có match duy nhất, người dùng rà soát/chọn thủ công trước khi upload.
- PDF nguồn ghép chỉ tồn tại tạm trong phiên xử lý; hệ thống tạo PDF con rồi đi qua cùng API PDF đơn hiện tại. Giới hạn kích thước PDF kết quả vẫn áp dụng cho từng PDF con, độc lập với kích thước PDF nguồn; không lưu byte PDF nguồn vào JSONB hoặc tạo thêm bản ghi KQTN.
- Bulk upload xử lý độc lập từng nhóm, hiển thị tiến độ/thành công/thất bại và cho phép retry nhóm lỗi. Một thao tác ghép nhiều nhóm được ghi thành một activity log tổng hợp; mỗi nhóm vẫn tuân thủ duy nhất `sampleKey` và xác nhận ghi đè riêng.
- PDF kết quả là file nghiệp vụ trong bucket private `ddt-files` của Supabase Storage; metadata được kiểm kê trong `file_assets`. Quy tắc ảnh OCR/ảnh lập báo cáo chỉ lưu tạm vẫn giữ nguyên.
- API PDF: `POST /api/kqtn/:recordId/pdf`, `GET /api/kqtn/:recordId/pdf`, `GET /api/kqtn/:recordId/pdf?download=1`, `DELETE /api/kqtn/:recordId/pdf`. Admin/Tester được ghi/ghi đè; Viewer/Guest chỉ đọc/download theo quyền KQTN.
- Response của API `GET` PDF phải dùng `Content-Disposition` ASCII-safe: `filename` fallback không chứa ký tự điều khiển và `filename*` mã hóa UTF-8, để trình xem PDF nghiêm ngặt không từ chối file có tên tiếng Việt hoặc tên bị lỗi mã hóa.
- Backup JSON chỉ lưu metadata PDF, không nhúng byte PDF. Backup đầy đủ phải gồm metadata `file_assets` và object PDF; restore phải khôi phục object trước khi xác nhận pointer hoạt động.

<!-- --- End of design.md --- -->

## 12. NHẬP HỒ SƠ LỊCH SỬ TỪ BỘ PCN THAM CHIẾU

- Thư mục `PCN` trên Desktop là **nguồn đọc một lần để phân tích và nhập có kiểm soát**, không phải nguồn dữ liệu runtime. Ứng dụng PCN không watcher, không mở file theo đường dẫn Desktop, không tạo live-sync và không được phụ thuộc máy chứa thư mục này sau khi nhập.
- Đợt pilot đầu tiên gồm 10 hồ sơ: QC4 `0665`, `0670`, `0694`, `0770`, `1325`; QC9 `0105-01`, `0105-02`, `0105-03`, `0136-03`, `0171-05`. Mỗi hồ sơ phải tạo đúng một `CertificationProposal` và một `CertificationDossier`, liên kết hai chiều bằng mã ổn định.
- Hồ sơ lịch sử nhập vào có trạng thái `ON_HOLD` và metadata `historicalImport.reviewStatus = PENDING_REVIEW`; không suy diễn rằng hồ sơ đã được giao, phát hành hoặc lưu trữ chỉ từ tên thư mục. Các trường suy luận từ tên thư mục phải được đánh dấu cần rà soát.
- Dấu `Full`/`giảm` hoặc biến thể tương tự trong tên thư mục lịch sử chỉ là **chỉ dấu phạm vi thử nghiệm từ nguồn**. Giao diện được phép hiển thị `Full chỉ tiêu`/`Giảm chỉ tiêu` kèm cảnh báo **không đồng nghĩa bộ hồ sơ đủ thủ tục**, nhưng không được dùng dấu này để tăng điểm hoàn thiện, bỏ qua checklist, đổi `ON_HOLD` hoặc suy diễn hồ sơ đã đầy đủ. `historicalImport.variantHint` phải giữ chỉ dấu đã đọc được; với dữ liệu cũ chưa có trường này, UI chỉ được đọc lại `sourceFolderName` đã lưu để tạo projection read-only, không ghi ngược metadata.
- Projection quản lý ở Hàng đợi, Pipeline, chi tiết hồ sơ và Bằng chứng phê duyệt phải giữ nhãn phạm vi nguồn khi hồ sơ có `historicalImport`; nhãn và cảnh báo chỉ là read-only context, không thay thế điểm hoàn thiện, trạng thái rà soát hoặc danh sách checklist bắt buộc.
- Hồ sơ có `historicalImport.reviewStatus = PENDING_REVIEW` phải có tab **Rà soát nhập lịch sử** trong chi tiết hồ sơ. Tab cho phép hiệu chỉnh các trường chuẩn suy luận từ thư mục: khách hàng, địa chỉ, sản phẩm, model/nhãn hiệu, nhà sản xuất và phương thức chứng nhận; đường dẫn nguồn chỉ hiển thị read-only để đối chiếu. Nếu hồ sơ có metadata nhập lịch sử nhưng thiếu Đề nghị liên kết, tab phải hiển thị cảnh báo **Thiếu Đề nghị liên kết** và hướng dẫn xử lý cảnh báo toàn vẹn dữ liệu, không hiển thị như thể hồ sơ không có dữ liệu lịch sử và không tự tạo lại liên kết.
- Khi lưu rà soát, `CertificationProposal` và `CertificationDossier` phải cập nhật cùng một thời điểm; metadata nhập lịch sử chuyển thành `REVIEWED` và chỉ còn giữ các `unresolvedFields` chưa được giải quyết. Thao tác không tự động chuyển `ON_HOLD` sang trạng thái nghiệp vụ khác, không sửa byte/tệp đã nhập và phải ghi `activityLogs` với nguồn `USER_REVIEW`.
- Tài liệu quản lý đầu tiên được sinh từ hồ sơ là `DOSSIER_COVER` gồm bìa và mục lục tệp; Word và PDF phải dùng cùng một `document context` lấy từ Đề nghị, Hồ sơ, checklist và metadata tệp. Đây không phải GCN/QĐ chính thức và không được tự suy diễn nội dung cấp chứng nhận.
- Mẫu biểu quản lý tiếp theo là `PROPOSAL_SUMMARY`, phiếu tóm tắt Đề nghị dạng nháp nội bộ lấy cùng `document context`; mẫu chỉ giúp kiểm tra thông tin liền mạch giữa Đề nghị và Hồ sơ, không được coi là biểu mẫu pháp lý/GCN/QĐ nếu chưa có mẫu được phê duyệt.
- Mẫu biểu quản lý `PROPOSAL_FORM` là bản đầy đủ của Đề nghị chứng nhận được sinh từ `CertificationProposal` và `CertificationDossier`, gồm thông tin đơn vị, sản phẩm, phương thức/lĩnh vực, danh mục hồ sơ/tài liệu kèm theo, yêu cầu và vùng ký. Nội dung phải lấy từ cùng `document context`, không cho nhập lại thủ công; đây là bản nháp quản lý nội bộ để rà soát trước khi ký, không thay thế Đề nghị đã ký, GCN hoặc Quyết định và không được đưa vào luồng sinh tài liệu phát hành chính thức.
- Mẫu biểu quản lý `EVALUATION_REPORT` là báo cáo đánh giá hồ sơ nội bộ, sinh từ cùng `document context` của `CertificationProposal`, `CertificationDossier`, checklist và tệp đính kèm. Báo cáo phải hiển thị tối thiểu mã hồ sơ/Đề nghị, khách hàng, sản phẩm, lĩnh vực/phương thức, người đánh giá, người rà soát, hạn xử lý, ngày đánh giá, tình trạng checklist và các trường nguồn còn cần rà soát; không cho nhập lại thủ công. Báo cáo chỉ hỗ trợ điều phối/kiểm tra trước quyết định kỹ thuật, không phải biên bản đánh giá đã ký, GCN hoặc Quyết định và không được đưa vào luồng sinh tài liệu phát hành chính thức.
- Mẫu biểu quản lý `SAMPLE_TAKING` là biên bản lấy mẫu dạng nháp nội bộ, đối chiếu theo nguồn `BM-QT-09-03` đã khảo sát trên Desktop PCN. Người dùng phải chọn đúng một `PcnSampleRoute` thuộc `PcnSampleLot` của hồ sơ; context tự lấy mã lô, mẫu/model/nhãn hiệu, số lượng, địa điểm, ngày nhận/lấy, phòng thử nghiệm, PYC và ghi chú tuyến, không cho nhập lại thủ công. Biểu mẫu chỉ hỗ trợ kiểm tra và chuẩn bị hồ sơ, không thay thế biên bản ký chính thức, không tự chuyển trạng thái mẫu và khi xác nhận checklist sẽ dùng chung yêu cầu lấy/giao mẫu hiện hành để tránh mục trùng.
- Mẫu biểu quản lý `SAMPLE_RETURN` là biên bản trả mẫu dạng nháp nội bộ cho QC9, phải chọn đúng một `PcnSampleRoute` thuộc `PcnSampleLot` của hồ sơ trước khi sinh. Context dùng cùng dữ liệu lô/tuyến/PYC của `SAMPLE_HANDOVER`, nhưng bố cục và vùng xác nhận nêu rõ việc trả mẫu, mốc trả và nơi nhận lại; không cho nhập lại thủ công các thông tin nguồn, không tự thay thế biên bản đã ký và không tự chuyển trạng thái mẫu.
- `PcnGeneratedDocument` lưu loại tài liệu (`DOSSIER_COVER`, `PROPOSAL_SUMMARY`, `PROPOSAL_FORM`, `ASSIGNMENT_FORM`, `EVALUATION_PLAN`, `FIELD_INSPECTION`, `SAMPLE_TAKING`, `SAMPLE_CODING`, `EVALUATION_REPORT`, `SAMPLE_HANDOVER`, `SAMPLE_RETURN` hoặc `LAB_REQUEST`), format (`DOCX`/`PDF`), `contextHash`, thời điểm sinh, người sinh và pointer `fileAssetId`; bytes chỉ ở private Storage, không ở JSONB. Asset của bản sinh dùng `sourceCollection=pcnGeneratedDocuments`, `sourceDocumentId` đúng ID bản sinh và `sourceJsonPath=fileAssetId`; server phải kiểm tra lại metadata asset trước khi tái sử dụng. Tài liệu `SAMPLE_TAKING`/`SAMPLE_HANDOVER`/`SAMPLE_RETURN`/`SAMPLE_CODING` phải lưu thêm `sampleLotId`/`sampleRouteId`; `LAB_REQUEST` phải lưu thêm `labRequestId`; ID/object path ổn định theo hồ sơ, loại tài liệu, định danh lô/tuyến hoặc PYC (nếu có), format và `contextHash` để retry không tạo bản trùng.
- Mọi bản sinh quản lý nội bộ ở dạng DOCX/PDF phải giữ cùng nhận diện tài liệu `IEMM • TVCI · PHÒNG CHỨNG NHẬN PCN` ở đầu trang; PDF đồng thời ghi nhận diện này vào metadata tài liệu. Nhận diện chỉ xác định đơn vị/phòng phát hành bản nháp quản lý, không biến bản sinh nội bộ thành GCN/QĐ hay biểu mẫu chính thức.
- Bản sinh quản lý không tự động làm checklist thành **Đã có**. Với các loại có ánh xạ 1-1 rõ ràng (`PROPOSAL_FORM` → `PROPOSAL`, `ASSIGNMENT_FORM` → `ASSIGNMENT_FORM`, `EVALUATION_PLAN` → `EVALUATION_PLAN`, `FIELD_INSPECTION` → `FIELD_INSPECTION`, `SAMPLE_TAKING` → `SAMPLE_HANDOVER` dùng chung yêu cầu checklist lấy/giao mẫu hiện hành, `SAMPLE_CODING` → `SAMPLE_CODING`, `SAMPLE_HANDOVER` → `SAMPLE_HANDOVER`, `SAMPLE_RETURN` → `SAMPLE_RETURN`, `LAB_REQUEST` → `LAB_REQUEST`), người dùng được bấm **Xác nhận vào checklist** sau khi kiểm tra nội dung. Boundary xác nhận phải kiểm tra bản sinh và asset thuộc cùng hồ sơ, provenance bản sinh còn nguyên, loại tài liệu khớp mã yêu cầu đang hoạt động và Lĩnh vực của hồ sơ; thao tác phải idempotent theo bản sinh + yêu cầu. Hệ thống sao chép bytes sang object private mới có provenance `sourceCollection=dossierDocuments`, `sourceDocumentId=buildPcnDossierDocumentId(dossierId, requirementId)`, `sourceJsonPath=requirementId`, tạo một phiên checklist/attachment mới và ghi audit; không dùng chung `fileAssetId` giữa bản sinh và checklist, không tự động xác nhận khi sinh file.
- `sourceUpdatedAt` của `PcnGeneratedDocument` phải là mốc mới nhất của các nguồn liên kết tối thiểu gồm `CertificationDossier.updatedAt` và `CertificationProposal.updatedAt` (chỉ nhận timestamp ISO-8601 UTC hợp lệ, bỏ qua giá trị khác); với `SAMPLE_TAKING`/`SAMPLE_HANDOVER`/`SAMPLE_RETURN`/`SAMPLE_CODING` phải tính thêm lô mẫu, tuyến mẫu và PYC liên kết nếu có, còn `LAB_REQUEST` phải tính thêm PYC và lô/tuyến liên kết nếu có. UI phải dùng cùng một helper thuần, browser-safe, với server để so sánh với bản sinh và đánh dấu bản cũ là **Cần sinh lại**; bản cũ vẫn giữ nguyên để truy vết, không ghi đè hoặc xóa. Helper này không được kéo các dependency Node/PDF/render binary vào client bundle.
- Khi sinh cùng một loại biểu mẫu ở cả `DOCX` và `PDF`, UI phải nhóm các bản sinh theo `contextHash` và `sourceUpdatedAt` để hiển thị lineage của từng lần sinh: `Đủ Word + PDF`, `Thiếu Word`, `Thiếu PDF` hoặc `Khác context`. Chỉ hai file cùng nhóm context mới được coi là một cặp liền mạch; file khác context vẫn giữ để truy vết nhưng không được ghép ngầm. Nếu cặp có `sourceUpdatedAt` cũ hơn nguồn hiện tại, trạng thái lineage phải đồng thời hiển thị **Cần sinh lại** và hướng dẫn chạy lại preflight trước khi sinh.
- Trước khi sinh file, panel phải có thao tác **Kiểm tra dữ liệu** gọi cùng boundary server với cờ `dryRun`; preflight chỉ đọc và trả `document context`, `contextHash`, checklist và các trường cần rà soát, không upload Storage, không tạo `PcnGeneratedDocument`, không ghi audit/notification. Người vận hành xem preflight trước rồi mới chủ động bấm sinh Word/PDF; request sinh phải gửi lại `expectedContextHash` của preflight và server phải so sánh với context vừa dựng trong transaction, khác hash thì trả conflict và không upload/ghi tài liệu để buộc kiểm tra lại. Thiếu checklist chỉ là cảnh báo, còn lỗi liên kết PYC/tuyến mẫu hoặc dữ liệu nguồn không hợp lệ phải được nêu rõ và không cho gọi thao tác sinh tương ứng.
- Sau preflight, panel phải hiển thị snapshot nguồn chỉ đọc tối thiểu gồm mã Đề nghị, mã hồ sơ, khách hàng, sản phẩm, phương thức/lĩnh vực, số mục checklist và số tệp đính kèm để người vận hành đối chiếu trước khi sinh. Snapshot lấy trực tiếp từ context server trả về, không cho sửa tại chỗ và không được tạo một bản dữ liệu thứ hai.
- Panel sinh tài liệu phải chỉ hiển thị các bản sinh thuộc đúng loại biểu mẫu đang chọn (`DOSSIER_COVER`, `PROPOSAL_SUMMARY`, `PROPOSAL_FORM`, `ASSIGNMENT_FORM`, `EVALUATION_PLAN`, `FIELD_INSPECTION`, `SAMPLE_TAKING`, `SAMPLE_CODING`, `EVALUATION_REPORT`, `SAMPLE_HANDOVER`, `SAMPLE_RETURN` hoặc `LAB_REQUEST`), sắp xếp bản mới nhất trước; đổi tab không được làm lẫn các context. Các biểu mẫu `ASSIGNMENT_FORM`, `EVALUATION_PLAN`, `FIELD_INSPECTION` và `EVALUATION_REPORT` dùng snapshot chỉ đọc của hồ sơ, người phụ trách, đoàn/người đánh giá, hạn xử lý, ngày đánh giá, checklist và trường nguồn; không cho nhập lại các trường này. Với `SAMPLE_TAKING`/`SAMPLE_HANDOVER`/`SAMPLE_RETURN`/`SAMPLE_CODING`, panel phải hiển thị combobox tuyến mẫu thuộc hồ sơ, lô mẫu và PYC liên kết; với `LAB_REQUEST`, panel phải hiển thị combobox PYC thuộc hồ sơ và thông tin lô/tuyến liên kết (nếu có) để người dùng xác nhận trước khi sinh. File PDF/ảnh của bản sinh có thể **Xem nhanh** trong cùng panel qua private boundary; Word và định dạng khác vẫn có nút mở file riêng tư.
- File nghiệp vụ được sao chép vào private Storage PCN và chỉ lưu pointer/metadata trong `file_assets` cùng `dossierAttachments`. File tạm (`.DS_Store`, `Thumbs.db`, `~$*`, `.tmp`) và archive (`.rar`, `.zip`) không được tự động bung hoặc nhập; phải xuất hiện trong báo cáo skipped để người dùng biết.
- Bộ phân loại file dùng tên file, thư mục và phần mở rộng để gán nhóm `PROPOSAL`, `COMMERCIAL`, `SAMPLE_HANDOVER`, `SAMPLE_RETURN`, `TEST_REPORT`, `CORRECTIVE_ACTION`, `CERTIFICATE`, `DECISION`, `PHOTO` hoặc `OTHER`. Riêng `SAMPLE_RETURN` phải ưu tiên nhận diện cụm “biên bản trả mẫu”/“trả mẫu” trước quy tắc chung `SAMPLE_HANDOVER`, để không nối nhầm vào checklist biên bản lấy/giao mẫu. Phân loại chỉ hỗ trợ checklist/tra cứu, không thay thế xác nhận nghiệp vụ.
- Chỉ các ánh xạ có quy tắc 1-1 rõ ràng giữa nhóm file và mã `PcnDocumentRequirement` của đúng Lĩnh vực mới được tự động nối vào checklist: `PROPOSAL`, `COMMERCIAL`, `SAMPLE_HANDOVER`, `SAMPLE_RETURN`, `TEST_REPORT`, `CERTIFICATE` và `DECISION`; `CORRECTIVE_ACTION` chỉ nối vào `QC9-CORRECTIVE_ACTION_LETTER`. Không được dùng `CORRECTIVE_ACTION` của QC4 để lấp `CERTIFICATION_RESULT`, và file có tên “Loại nội dung” không được suy diễn là GCN.
- Mỗi file được nối phải giữ nguyên `dossierAttachments` làm provenance và tạo/ghép một phiên trong `dossierDocuments.versions`; nhiều file cùng mã yêu cầu phải hiện thành lịch sử phiên, không ghi đè im lặng. Asset của phiên tải trực tiếp dùng `sourceCollection=dossierDocuments`, `sourceDocumentId` đúng ID checklist dẫn xuất từ `dossierId` và `requirementId`, còn `sourceJsonPath=requirementId`; server phải kiểm tra đúng bộ ba này trước khi gắn pointer. API đọc checklist phải lọc theo `data.dossierId` chính xác, không dùng fallback tiền tố ID có thể làm lẫn hồ sơ. Đọc checklist hồ sơ và mọi mutation tài liệu đều phải có phiên PCN hợp lệ; byte file chỉ đi qua file endpoint private. Upload phiên tài liệu phải khóa hồ sơ, cập nhật `CertificationDossier.updatedAt` và ghi audit trong cùng transaction để bản sinh tài liệu nhận biết context đã thay đổi; retry cùng `assetId` không tạo phiên/log trùng. File `PHOTO`, `OTHER` hoặc nhóm/ tên chưa đủ chắc chắn chỉ là tệp đính kèm, không làm checklist chuyển sang `PRESENT`.
- Mapping tự động phải có trạng thái truy vết (`AUTO_MAPPED` hoặc `UNMAPPED`) và lý do; rà soát thủ công có thể nối lại một tệp nhưng không được thay đổi byte, hash, asset pointer hoặc đường dẫn nguồn. Reconcile/import phải idempotent theo `dossierId + requirementId + assetId` và chỉ ghi activity log khi có thay đổi metadata.
- Trong tab **Tệp đính kèm**, người dùng được chọn một `PcnDocumentRequirement` đang hoạt động cùng Lĩnh vực để nối thủ công tệp `PHOTO`/`OTHER` hoặc tệp nhận diện chưa chắc chắn. Endpoint phải kiểm tra quyền sở hữu hồ sơ và asset pointer, gồm `sourceCollection=dossierAttachments`, `sourceDocumentId=dossierId` và `sourceJsonPath=attachments.<kind>`, cập nhật attachment thành `MANUAL_MAPPED`, ghép phiên vào đúng `dossierDocuments` trong một giao dịch, trả lại các bản ghi đã đổi cho UI; lặp cùng lựa chọn phải idempotent, không tạo phiên/log trùng và không được cập nhật bảng `file_assets` hay object Storage.
- Khi mapping thủ công hoặc reconcile làm thay đổi attachment/checklist, phải cập nhật `CertificationDossier.updatedAt` trong cùng giao dịch để các `PcnGeneratedDocument` cũ nhận diện đúng context đã stale và hiện **Cần sinh lại**; nếu không có thay đổi metadata thì không cập nhật thời điểm hồ sơ.
- Khi hồ sơ đã `ARCHIVED`, Kho hồ sơ hiển thị ngày rà soát bản cứng/bản mềm và trạng thái `legal hold`; các mốc quá hạn chỉ là cảnh báo vận hành, không tự động xóa hoặc làm mất khả năng truy vết tài liệu.
- Catalog biểu mẫu phát hành PCN phải là miền riêng, không dùng `REPORT_TEMPLATES_CATALOG` hoặc các endpoint `/api/templates` của DDT. Mỗi mục catalog giữ lĩnh vực (`QC4`/`QC9`), loại tài liệu (`PROPOSAL`, `CERTIFICATE`, `DECISION`, `SAMPLE_HANDOVER`, `EVALUATION_REPORT`), phương thức/biến thể nếu có, định dạng nguồn, fingerprint nguồn và các placeholder đã xác nhận; tuyệt đối không lưu đường dẫn Desktop hoặc đường dẫn `dist` làm dependency runtime. `sourceRelativePath` của baseline phải tính từ thư mục gốc PCN do người vận hành chọn và giữ cả thư mục họ hồ sơ thực tế (`Hồ sơ chứng nhận QCVN4 2026` hoặc `Hồ sơ chứng nhận QCVN9 2026`); đường dẫn tuyệt đối chỉ dùng trong lần dry-run/apply, không được lưu vào metadata.
- Trạng thái biểu mẫu phát hành gồm `DISCOVERED` → `NEEDS_ANNOTATION` → `APPROVED` hoặc `RETIRED`. Mẫu `.doc`, DOCX không có placeholder máy đọc được, placeholder chưa đủ hoặc chưa có `fileAssetId` private chỉ được lưu/tra cứu/đối chiếu ở `NEEDS_ANNOTATION` khi nhập có cờ `--allow-annotation`, và phải bị chặn trước khi sinh GCN/QĐ/chứng thư. Không được lấy file kết quả đã điền làm mẫu tự động nếu chưa được chú thích và phê duyệt.
- Readiness của biểu mẫu phải kiểm tra đồng thời trạng thái `APPROVED`, định dạng `DOCX`, asset private và đủ khóa dữ liệu bắt buộc cho đúng loại tài liệu; lỗi readiness phải hiển thị cho người dùng và không được fallback sang mẫu DDT hay sinh tài liệu chính thức một cách im lặng. Khối **Biểu mẫu phát hành chính thức** trong panel sinh hồ sơ chỉ liệt kê `CERTIFICATE` và `DECISION`; các loại `PROPOSAL`/`SAMPLE_HANDOVER` là biểu mẫu quản lý riêng và không được đếm như mẫu phát hành. Danh sách template trả cho UI được phép có cờ runtime `privateAssetVerified` do server đối chiếu bộ ba provenance trong `file_assets`; cờ này chỉ là projection read-only, không ghi ngược vào catalog và không thay thế việc server kiểm tra lại khi cấp số/sinh file.
- Trước khi sinh GCN/QĐ chính thức, UI phải có bước **Kiểm tra dữ liệu** gọi cùng endpoint với `dryRun=true`; server trả readiness riêng cho từng loại tài liệu, template đang chọn và hash context bao gồm hồ sơ, đề nghị, số/ngày phát hành, template, mapping và tập định dạng đầu ra được yêu cầu. Bước sinh thật phải gửi lại `expectedContextHash`; nếu context hoặc tập định dạng thay đổi sau preflight thì trả conflict và không upload/ghi tài liệu. Preflight chỉ đọc, không tạo audit, notification hoặc pointer.
- **Chú thích template DOCX có kiểm soát**: Với template DOCX ở `NEEDS_ANNOTATION`, Admin được lập ánh xạ `placeholder key → nhãn nguồn` cho các ô giá trị còn trống trong mẫu. Server phải đọc XML Word, tìm đúng một ô chứa nhãn (kể cả nhãn bị tách qua nhiều `w:r`), chỉ chèn `[[key]]` vào ô giá trị kế bên đang trống; nhãn không duy nhất, ô đích đã có nội dung, key không hợp lệ hoặc mapping trùng phải bị từ chối toàn bộ. Không được đánh dấu template `APPROVED` chỉ bằng việc cập nhật metadata.
- **Provenance của bản chú thích**: Chú thích tạo một DOCX dẫn xuất và asset private mới theo SHA-256, không sửa/xóa asset gốc. Metadata template cập nhật fingerprint/asset đang hoạt động, giữ `sourceOriginalFingerprint`, danh sách mapping, actor và thời điểm chú thích; trạng thái vẫn là `NEEDS_ANNOTATION` cho tới khi Admin review/phê duyệt riêng. Required placeholder của loại tài liệu lấy từ allowlist canonical, không để danh sách rỗng làm lọt readiness. Mỗi lần chú thích ghi activity log `PCN_TEMPLATE` nguồn `UI`.
- Khi sinh hồ sơ phát hành, dữ liệu phải lấy từ cùng context của `CertificationProposal`/`CertificationDossier` và `IssuancePackage` (số phát hành, ngày cấp, người ký); placeholder được thay theo allowlist của từng template, không cho nhập free-text để ghi đè dữ liệu liên kết. QC4 chỉ được bật các mẫu có đủ mapping đã xác nhận như `loai_sp`, `ten_cong_ty`, `dia_chi_ct`, `so_dang_ky`, `ngay_cap_CN` và `ngay_qd` khi áp dụng.
- Cổng readiness phát hành phải từ chối GCN/QĐ nếu `document context` của hồ sơ lịch sử còn `reviewStatus = PENDING_REVIEW` hoặc còn `unresolvedFields`; trạng thái phát hành của hồ sơ không được tự thay thế bước rà soát dữ liệu nguồn. Cùng một chốt phải được áp dụng khi cấp số phát hành, không chỉ khi bấm sinh file chính thức; UI phải hiển thị lý do chặn và không mở thao tác cấp số như thể hồ sơ đã sẵn sàng.
- Mẫu phát hành phải được render ở server từ byte DOCX trong private Storage; bản DOCX và PDF của cùng lần sinh dùng chung `contextHash`, `templateId` và `sourceUpdatedAt`. Nếu môi trường chưa có bộ chuyển đổi PDF giữ nguyên layout, thao tác PDF phải báo **Chưa sẵn sàng** thay vì tạo một PDF nội dung khác mẫu chính thức.
- Renderer PDF chính thức là capability cấu hình ngoài, qua `PCN_DOCX_PDF_RENDERER` (đường dẫn executable như `soffice`/`libreoffice`) với bộ đối số cố định `--headless --convert-to pdf --outdir`; server phải giới hạn thời gian, xác nhận file output bắt đầu bằng `%PDF-` và dọn thư mục tạm. Với LibreOffice, mỗi lần render phải dùng user profile tạm riêng để không bị khóa bởi instance/profile đang chạy trên máy; profile và thư mục output phải được dọn sau lần render. Không nhận command string tùy ý và không fallback sang `pdf-lib`/PDF tự vẽ cho GCN/QĐ.
- Khi yêu cầu PDF, server phải render từ đúng byte DOCX đã render của cùng `templateId`/`contextHash`; chỉ sau khi PDF hợp lệ mới ghi pointer/metadata vào private Storage. Thiếu executable, timeout, output không hợp lệ hoặc layout renderer lỗi đều giữ trạng thái **Chưa sẵn sàng**, trả lỗi capability/tạm thời phù hợp (`503`) và không commit tài liệu chính thức dở dang.
- Việc nhập mẫu phát hành là thao tác có kiểm soát: dry-run phải báo format, byte size, SHA-256, placeholder và cảnh báo; chỉ `--apply`/phê duyệt mới ghi asset vào private Storage PCN. Mẫu `.doc` legacy hoặc DOCX còn cảnh báo chỉ được lưu để tra cứu ở trạng thái `NEEDS_ANNOTATION` khi người vận hành truyền cờ tường minh `--allow-annotation`; cờ này không được kết hợp với `--approve` và không làm mẫu đủ điều kiện phát hành. Việc retry cùng fingerprint không tạo asset/catalog duplicate và mọi thay đổi phê duyệt phải có audit. Object path template phải được tạo bằng quy tắc ASCII ổn định (chuyển dấu tiếng Việt trước khi sanitize) để retry không đổi path chỉ vì khác cách chuẩn hóa Unicode.
- Metadata catalog đã apply được lưu trong collection PCN `pcnTemplateDefinitions`; bản catalog code chỉ là baseline khảo sát và được merge theo `id`, không ghi đè một template đã `APPROVED` bằng lần import thiếu cờ phê duyệt. Asset template dùng `sourceCollection = pcnTemplateDefinitions`, `sourceDocumentId = templateId`, `sourceJsonPath = fileAssetId`; bytes vẫn chỉ nằm trong private Storage.
- Tài liệu chính thức sinh ra được lưu pointer-only trong collection `pcnOfficialGeneratedDocuments`, gắn với `issuanceId`, `templateId`, `documentKind`, `format`, `contextHash` và `sourceUpdatedAt`; asset phải có `sourceCollection=pcnOfficialGeneratedDocuments`, `sourceDocumentId` đúng ID bản sinh và `sourceJsonPath=fileAssetId`, đồng thời được kiểm tra lại trước khi tái sử dụng. Khi sinh lại, phiên cũ vẫn giữ để truy vết và ID ổn định theo `issuanceId + templateId + format + contextHash`. `fileAssetId` của bản sinh phải có phạm vi theo chính ID tài liệu (ngoài checksum nội dung) để hai tài liệu trùng byte không dùng chung pointer provenance; boundary sinh đồng thời phải khóa theo bộ phát hành trước khi kiểm tra/tạo asset.
- Pointer/asset của tài liệu chính thức phải được quản lý trong `pcnOfficialGeneratedDocuments`; không ghép chúng vào `issuancePackages.fileAssetIds` và không cập nhật `issuance.updatedAt` chỉ vì sinh hoặc retry tài liệu, để thao tác lưu pointer không làm bản vừa sinh bị đánh dấu **Cần sinh lại**.
- PCN có module **Quản lý biểu mẫu PCN** riêng để tra cứu catalog, fingerprint, placeholder, asset private và readiness của từng mẫu; module này không hiển thị hoặc sửa template DDT. Người dùng thường chỉ được xem; Admin PCN được thực hiện các chuyển trạng thái `APPROVE`, `REQUEST_ANNOTATION` và `RETIRE` trên metadata đã import.
- Module quản lý biểu mẫu phải có liên kết mở/tải bản mẫu từ file boundary PCN khi đã có `fileAssetId`; link chỉ đi qua endpoint private có phiên PCN, không mở đường dẫn Desktop và không nhúng byte mẫu vào catalog.
- Module quản lý biểu mẫu phải cho Admin nhập tạm thời `sourceRoot` của bộ hồ sơ PCN, chọn từng mẫu trong catalog để chạy dry-run và apply; server tự lấy `sourceRelativePath` từ catalog, chỉ trả fingerprint tương đối và không lưu `sourceRoot` tuyệt đối vào metadata/audit. Dry-run không ghi DB/Storage; apply mới được tạo asset private và merge metadata theo fingerprint.
- Để giảm thao tác lặp và tránh bỏ sót nguồn, module phải có preflight theo bộ `POST /api/pcn/templates/preflight-all`: nhận `sourceRoot` transient, duyệt toàn bộ baseline `PCN_TEMPLATE_CATALOG` theo `sourceRelativePath`, trả một dòng cho mỗi template với trạng thái `FOUND`, `MISSING`, `FINGERPRINT_MISMATCH`, `NEEDS_ANNOTATION` hoặc `READY_TO_APPLY`, cùng byte size/SHA-256/placeholder/cảnh báo và đường dẫn tương đối. Nếu template đã Apply vào kho riêng, preflight phải nhận diện cả fingerprint đang hoạt động và `sourceOriginalFingerprint` của bản nguồn; mapping bắt buộc đã lưu đủ thì nguồn được báo `FOUND`, còn trạng thái chờ Admin phê duyệt vẫn hiển thị trên card template. Preflight theo bộ là read-only, không ghi DB/Storage/audit, không echo đường dẫn tuyệt đối; nút Apply vẫn là thao tác riêng từng template và không được tự phê duyệt. Dòng kết quả phải liên kết được về card template tương ứng để Admin xử lý đúng file, đồng thời hiển thị tổng độ phủ theo QC4/QC9.
- Endpoint review template phải yêu cầu phiên PCN và quyền Admin, chỉ phê duyệt bản ghi đã tồn tại trong `pcnTemplateDefinitions` có asset private trỏ đúng `file_assets`, định dạng `DOC`/`DOCX` theo catalog, fingerprint và đủ placeholder bắt buộc; thao tác review không thay đổi byte hoặc object Storage. Bản ghi phải giữ snapshot `importedByUsername`/`importedAt` của lần apply gần nhất và khi `APPROVE` phải ghi `approvedByUsername`/`approvedAt`; username người duyệt không được trùng người nhập cùng phiên asset, để buộc tách vai trò nhập và phê duyệt. Apply không được tự phê duyệt; việc xác nhận bản mẫu/mapping phải qua boundary review riêng. Card quản trị phải tính **approval readiness** trên projection tạm `status = APPROVED` để mẫu `DISCOVERED`/`NEEDS_ANNOTATION` đã đủ placeholder và asset được hiển thị đúng khả năng review; không được dùng `status` hiện tại để khóa nhầm nút phê duyệt. Mỗi thay đổi trạng thái ghi một `activityLogs` với `entityType = PCN_TEMPLATE`, nguồn `UI`, actor và lý do/trạng thái trước-sau.
- Import phải hỗ trợ dry-run, báo cáo count/size/hash, cảnh báo thiếu mã hoặc tên không rõ, idempotent theo `batchId + dossierCode + relativePath + sha256`, và ghi một `activityLogs` append-only với `source = IMPORT` cho mỗi hồ sơ cùng batch tổng hợp. Activity batch tổng hợp phải lưu thêm `idempotencyFingerprint` dẫn xuất ổn định từ phạm vi candidate, metadata hồ sơ/checklist và tập tệp (không phụ thuộc timestamp import); khi retry phải khóa theo batch, đối chiếu fingerprint và payload đã commit, không dùng `ON CONFLICT DO NOTHING` để che khuất sai khác.
- Dữ liệu nhập lịch sử không được ghi vào `requests`, `handoverDocs`, `kqtnRecords` của DDT. Sau khi nhập, việc chỉnh sửa/tra cứu hồ sơ lịch sử dùng API và Storage PCN hiện hành như hồ sơ mới.
- Vì nguồn tham chiếu PCN có thể chứa hàng nghìn thư mục và nhiều loại tệp, trước khi chọn batch nhập phải có bước **kiểm kê nguồn read-only** với đường dẫn nguồn do người vận hành chỉ định. Báo cáo kiểm kê chỉ lưu/trả về đường dẫn tương đối, mã thư mục, số lượng tệp, tổng dung lượng, phần mở rộng, thời điểm sửa gần nhất và các trường cần rà soát; không hash/upload tệp, không ghi database/Storage và không theo dõi Desktop liên tục. Discovery được phép đi qua tối đa một cấp thư mục nhóm không có mã để nhận diện hồ sơ mã hóa bên trong; không đệ quy không giới hạn, không nhận đường dẫn candidate tùy ý và phải giữ đầy đủ provenance tương đối của thư mục lồng.
- Kiểm kê nguồn phải nhận diện riêng các thư mục hồ sơ QC4/QC9 theo cấu trúc nguồn đã khảo sát; mã QC4 chấp nhận cả dạng số thuần (`0665`) và mã ghép theo lô (`0109-01` hoặc `0109/01`), còn QC9 chấp nhận tiền tố `IEMM` với mã ghép tương ứng. Thư mục không có mã hồ sơ hoặc không khớp mẫu đặt tên phải bị bỏ qua và nêu rõ số lượng. Kết quả chỉ dùng để chọn `DEFAULT_PCN_HISTORICAL_PILOT`/batch nhập có kiểm soát; không tự chuyển candidate thành `CertificationDossier`.
- Sau khi kiểm kê candidate, discovery phải trả thêm **bản đồ độ phủ nguồn tham chiếu** read-only theo allowlist các nhánh biểu mẫu, bản scan GCN, báo cáo/KQTN, biên bản/PYC, giao nhận, đánh giá, công văn, thương mại, khắc phục, tiêu chuẩn, giấy phép/chỉ định, bằng chứng hình ảnh và hồ sơ lưu đã khảo sát trong bộ PCN. Mỗi nhánh giữ `fieldCode`, `sourceRelativePath`, vai trò nguồn, trạng thái tồn tại, số tệp, tổng dung lượng, phần mở rộng, mốc sửa gần nhất và một số tên tệp mẫu; nhánh này chỉ để người vận hành biết phạm vi đã quét và định tuyến sang module template/hồ sơ, không được đưa vào checkbox candidate, không tự import và không lưu đường dẫn tuyệt đối/byte tệp. `sourceRoot` tuyệt đối chỉ tồn tại transient trong request/server để resolve tệp, không được echo trong response HTTP, metadata hoặc audit; client giữ lại đường dẫn người vận hành vừa nhập trong state tạm để gọi bước dry-run/apply tiếp theo. Coverage card có thể điều hướng tới module PCN đích theo vai trò nguồn khi mapping đủ chắc chắn, nhưng không được mở đường dẫn Desktop hoặc tự tạo/import hồ sơ; các vai trò chưa có module đích phải hiển thị rõ là chỉ tra cứu.
- Batch nhập lịch sử ngoài pilot phải được chọn tường minh từ kết quả kiểm kê bằng khóa `FIELD:BUSINESS_CODE` (ví dụ `QC4:0665`, `QC9:0105-01`), có thể chọn nhiều candidate và phải từ chối candidate không tồn tại hoặc khóa bị trùng. Candidate được chọn phải được resolve lại từ các scan root QC4/QC9 đã allowlist, không nhận đường dẫn tùy ý; mỗi lần chạy phải có `batchId` ổn định để retry/idempotency, vẫn dry-run mặc định; dry-run có thể đọc/hash file cục bộ để lập kế hoạch và báo cáo, nhưng chỉ `--apply` mới upload hoặc ghi DB/Storage.
- Báo cáo dry-run của batch chọn phải hiển thị chính candidate, số file, dung lượng, nhóm file, trường cần rà soát và đường dẫn tương đối; nếu apply thất bại giữa chừng phải rollback metadata và dọn object đã upload. Việc chọn candidate không làm thay đổi bản kiểm kê read-only và không tự chuyển hồ sơ lịch sử khỏi `ON_HOLD`/`PENDING_REVIEW`.
- Trước khi Apply upload từng tệp lịch sử, server phải đọc lại đúng đường dẫn đã resolve, đối chiếu `byteSize` và SHA-256 với kế hoạch vừa rebuild; nếu byte hoặc hash lệch thì dừng toàn bộ transaction và không tạo pointer cho tệp đó. Nếu `file_assets` đã có cùng `assetId`, server phải khóa và xác nhận bucket/object path, nguồn pointer, byte size và SHA-256 khớp; metadata lệch phải được coi là lỗi integrity, không được bỏ qua như retry idempotent.
- Module **Kiểm kê hồ sơ lịch sử** phải gọi endpoint PCN read-only bằng đường dẫn nguồn do người vận hành chỉ định, cho lọc QC4/QC9, hiển thị root đã quét/thiếu, candidate bị bỏ qua, mã chọn `FIELD:BUSINESS_CODE`, số tệp, dung lượng, phần mở rộng và trường cần rà soát. Danh sách candidate lớn phải có lọc cục bộ theo mã/khách hàng/sản phẩm/đường dẫn và phân trang; thao tác chọn tất cả chỉ tác động các candidate đang hiển thị, không làm mất các lựa chọn ở trang khác. Người dùng có thể chọn nhiều candidate để lập báo cáo dry-run qua endpoint riêng; endpoint resolve lại candidate từ root allowlist, đọc/hash và trả số lượng, dung lượng, nhóm file, mapping/skipped, SHA-256 và đường dẫn tương đối, nhưng không hash/upload trong bước kiểm kê, không ghi DB/Storage và không tự tạo `CertificationDossier`. Giao diện chỉ xác nhận phạm vi và hiển thị báo cáo; việc nhập thật vẫn phải đi qua batch `--apply`/boundary được phê duyệt riêng.
- Danh sách **candidate bị bỏ qua** trong module kiểm kê phải cho người vận hành tra cứu read-only từng thư mục theo `fieldCode`, tên thư mục, đường dẫn tương đối và lý do (`NAME_NOT_RECOGNIZED`), có lọc cục bộ và phân trang khi số lượng lớn. Các thư mục này không có checkbox chọn/import và không được tự suy diễn thành hồ sơ; chỉ dùng để rà soát, bổ sung quy tắc nhận diện có kiểm soát ở lần phát triển sau.
- Module **Kiểm kê hồ sơ lịch sử** phải có một vùng **Batch đã nhập** dẫn xuất read-only từ `CertificationDossier.historicalImport`, `dossierAttachments` và activity log batch `IMPORT`, để sau khi tải lại vẫn thấy batchId, thời điểm, lĩnh vực, số hồ sơ/tệp, dung lượng và số hồ sơ còn `PENDING_REVIEW`; vùng này không thay thế kiểm tra idempotency của server và không tự động chọn lại candidate.
- Sau khi boundary Apply trả thành công, workspace phải re-fetch state PCN từ PostgreSQL bằng một lần tải cưỡng bức có chủ đích để vùng **Batch đã nhập** và các module liên quan phản ánh ngay snapshot server; lần tải ban đầu vẫn được bảo vệ bởi cờ `isLoaded`, không dùng polling hoặc watcher Desktop.
- Từ báo cáo dry-run, chỉ Admin PCN mới được mở boundary **Apply batch lịch sử**. UI phải yêu cầu nhập lại đúng `batchId` và xác nhận rõ việc ghi `CertificationProposal`, `CertificationDossier`, checklist, attachment pointer, `file_assets`, Storage private và audit; server phải kiểm tra lại session Admin, scan/resolve candidate và lập kế hoạch ngay trước khi apply, không nhận plan tùy ý từ client. Apply dùng lại transaction/rollback và object cleanup của CLI, trả `idempotent`/tóm tắt batch; retry cùng `batchId` và cùng candidate không tạo bản ghi/log/tệp trùng. Staff/viewer chỉ được discovery/dry-run hoặc xem báo cáo, không được apply.
- `pcnQualityDocuments` là sổ tài liệu chất lượng/chỉ định độc lập với hồ sơ chứng nhận và KQTN, khởi đầu hỗ trợ nhóm `VICAS`, `VIAS`, `ISO`, `DESIGNATION` và `PROCEDURE`. Mỗi mục giữ mã tài liệu, tên, phiên bản, Lĩnh vực liên quan nếu có, ngày ban hành/hiệu lực/hết hạn đã xác nhận, người phụ trách, trạng thái và pointer `fileAssetId` private; không lưu byte/Base64 hoặc đường dẫn Desktop.
- Admin tạo/cập nhật sổ tài liệu chất lượng qua `POST /api/pcn/quality-documents` và `POST /api/pcn/quality-documents/:documentId`; khi có file, upload byte qua file boundary rồi gắn pointer qua `POST /api/pcn/quality-documents/:documentId/file`. Cả upload asset có `sourceCollection=pcnQualityDocuments` và thao tác gắn pointer đều phải là Admin PCN. Server kiểm tra metadata bằng policy, khóa bản ghi khi cập nhật, ghi audit cùng transaction và retry không tạo bản ghi/log trùng. Ngừng sử dụng dùng cùng boundary cập nhật trạng thái, không xóa cứng.
- Sổ tài liệu chất lượng chỉ là registry quản lý tài liệu, không tự kết luận chứng nhận còn hiệu lực từ ngày hết hạn và không tự động thay thế tài liệu trong dossier. Admin được tạo/sửa/ngừng dùng và nối file qua endpoint PCN chuyên biệt hoặc policy hiện hành; staff/viewer chỉ xem. Mọi mutation ghi `activityLogs` với entity `PCN_QUALITY_DOCUMENT`, còn cảnh báo quá hạn trên UI chỉ là cảnh báo cần rà soát.

<!-- --- End of design.md --- -->
<!-- Codex bulk upload clarification -->
### 11.1. Bulk Upload session and target mapping
- Header KQTN phải tách rõ **Nhiều PDF đơn** (mỗi file là một kết quả, không cắt) và **Một PDF ghép** (một file nguồn chứa nhiều kết quả, cắt theo nhóm trang rồi gán từng nhóm vào mẫu đích).
- Với PDF ghép, nút xác nhận phải thể hiện rõ “Tách PDF con và lưu vào mẫu đích”; hệ thống tạo PDF con rồi gọi API PDF đơn hiện tại để lưu vào đúng KQTN đích đã chọn, đồng thời giữ trạng thái thành công/thất bại theo từng nhóm và cho phép retry nhóm lỗi.
- Đóng modal chỉ ẩn modal và giữ nguyên phiên xử lý trong bộ nhớ của trang. Chỉ “Xóa phiên/Bắt đầu lại” mới xóa file, mapping và trạng thái; không yêu cầu khôi phục sau reload cứng vì PDF nguồn là dữ liệu tạm của phiên.
- Candidate chưa có KQTN thực (`isPending=true`) phải hiển thị “Chưa có KQTN” nhưng vẫn được chọn làm mẫu đích; đây là cảnh báo nghiệp vụ, không phải khóa thao tác. Khi người dùng xác nhận upload vào candidate pending, Bulk Upload tạo bản ghi KQTN tối thiểu từ thông tin đầu mẫu/request rồi lưu PDF vào cùng bản ghi; không tự tạo bản ghi mới nếu đã có KQTN.
- Trường ghép PDF với Mẫu thử phải là combobox tìm kiếm/lọc, không chỉ là dropdown. Từ khóa được chuẩn hóa không phân biệt hoa thường, dấu tiếng Việt và dấu phân cách; tìm trên `sampleCode`, `reportNo`, `model`, `brand`, `sampleName` và `sealStamp`. Kết quả phải có trạng thái KQTN/PDF hiện tại, hỗ trợ bàn phím/xóa lựa chọn, và candidate pending vẫn nhìn thấy, có thể chọn nhưng phải hiển thị cảnh báo.

### 11.2. Scanned combined PDF segmentation
- PDF scan không có text layer vẫn phải được xử lý theo từng trang. Với PDF ghép lớn, lượt đầu upload nguồn một lần và tạo job OCR; DDT tạo PDF chỉ chứa footer rồi PaddleOCR dùng preflight bố cục trên chính vùng footer để chọn số trang ứng viên giới hạn, không OCR phần thân trang. Nếu PDF có text layer đầy đủ, service vẫn có thể dùng trực tiếp text theo trang, nhưng kết quả phân nhóm phải đi qua cùng bộ lọc khóa footer.
- Nhánh visual-candidate/classifier toàn trang chỉ còn là fallback tương thích cho nguồn cũ; không được gọi trong luồng Bulk Upload PDF ghép chuẩn. Luồng chuẩn không đọc tiêu đề, `PHỤ LỤC` hay thân báo cáo để quyết định mốc. Sau khi có khóa footer, hệ thống tạo nhóm rồi OCR Paddle tối đa 3 trang đầu nhóm để lấy model đã chuẩn hóa và match model với đầu mẫu; khóa footer chỉ dùng cho nhóm/mã báo cáo, không dùng như model. Combobox tìm kiếm/lọc vẫn là đường sửa mapping khi model thiếu hoặc không duy nhất.
- Các lỗi OCR phổ biến ở khóa footer (`ITD 1132 -26-M03`, `S6 (N°)`, khoảng trắng/dấu phân cách) phải được chuẩn hóa trước khi so sánh. Không tạo segment riêng từ trang phụ lục, trang nội dung, ngày tháng hoặc một dòng số không thuộc `Số mã hóa`/`ITD`/`EMC`/`ITDC`.
- Endpoint footer một trang và `footer-batch` vẫn được giữ cho fallback/manual hoặc nguồn nhỏ; nguồn lớn không được quay lại vòng lặp 116 request page-level. DDT phải polling `GET /api/kqtn/ocr/footer-jobs/:jobId`, hiển thị tiến độ `processedPages/totalPages` cùng chiến lược `footer-batch`, và chuyển manual split khi job thất bại/hết hạn/không tìm được đủ khóa footer.
- Footer là nguồn nhận diện chính để tìm mốc nhóm: khóa được lấy từ `Số mã hóa` hoặc mã bắt đầu bằng `ITD`, `EMC`, `ITDC`, sau khi chuẩn hóa khoảng trắng/dấu phân cách và lỗi OCR hiển nhiên. Bỏ qua số trang, ngày tháng, số tiêu chuẩn và text nội dung. Khóa footer ổn định được dùng để gom các trang liên tục; khóa không đọc rõ chuyển sang rà soát thủ công.
- Nếu footer OCR đọc được phân số trang dạng `current/total` (ví dụ `1/20`, `2/20`), mỗi segment phải đối chiếu `pageEnd - pageStart + 1` với `total`. Khi lệch, UI phải báo rõ số trang thực tế và số trang footer, đánh dấu cảnh báo để người dùng rà soát nhưng vẫn cho phép tách và lưu theo mốc/mapping hiện tại; cảnh báo không được chặn thao tác lưu. Nếu footer không có phân số thì không suy diễn tổng trang.
- Metadata cover (`isReportCover`, model, brand) không phải điều kiện để chia nhóm footer. Sau khi chia nhóm, mỗi nhóm được phép OCR Paddle tối đa 3 trang đầu để lấy model; nếu không đọc được model và footer cũng không map được mã mẫu thì giữ mapping thủ công, không tự động gọi Gemini.
- Mỗi marker mạnh tạo đúng một segment liên tục tới trước marker kế tiếp. Trang trắng ở biên được loại khỏi PDF con; trang trắng nằm giữa nội dung chỉ được loại khi AI xác nhận là trang phân cách. Mọi segment phải giữ `pageStart`, `pageEnd`, metadata marker và mapping về một `sampleKey` duy nhất.
- Nếu scan không đủ rõ để xác định marker hoặc có marker trùng/không map duy nhất với đầu mẫu hiện hữu, UI phải hiển thị nhóm `Cần rà soát`, cho phép sửa mốc trang/chọn mẫu, và chặn upload tự động cho nhóm đó.
- OCR job nhanh phải có ngân sách hữu hạn 5 phút, giới hạn số trang ứng viên và giải phóng ảnh sau mỗi cửa sổ render. Khi vượt thời gian hoặc service không trả đủ ứng viên, UI chuyển ngay sang tách thủ công và không phát sinh thêm retry page-level cho cùng nguồn. Structure extraction Gemini vẫn giữ ngân sách 45 giây, không retry SDK và chỉ dùng một model đã chọn cho mỗi request; khi vượt thời gian, API trả `504` với mã `KQTN_STRUCTURE_TIMEOUT`.

### 11.3. Bulk Upload confirmation gate
- Việc chọn file chỉ tạo một lựa chọn chờ xác nhận; không được gọi AI metadata/structure extraction và không được bắt đầu đọc, tách hoặc upload PDF ở bước này.
- UI phải hiển thị rõ file đã chọn và nút `Xác nhận và bắt đầu phân tích`. Chỉ sau thao tác xác nhận này hệ thống mới bắt đầu phân tích PDF tương ứng với mode `Nhiều PDF đơn` hoặc `Một PDF ghép`.
- Người dùng có thể bỏ chọn hoặc chọn lại trước khi xác nhận. Thao tác này không được làm mất phiên Bulk Upload đang có; chỉ khi xác nhận mới thay thế nguồn/đợt phân tích tương ứng.
<!-- --- End of design.md --- -->
