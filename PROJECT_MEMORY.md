<!--
Author: Gemini
OS support: Web/Node
Description: Persistent project memory and verified deployment observations for DDT Lab
-->

# DDT Lab — Project Memory & Observations

## Cập nhật 2026-08-30 — PCN webapp: bộ hồ sơ và graphic workflow

- Profile đang triển khai là `pcn`, dùng `docker-compose.pcn.yml`, database logic `pcn_certification` trên network `supabase_default`; Docker production của PCN dùng cổng `2357`.
- Dashboard PCN dùng một bề mặt công việc tại một thời điểm, mặc định là **Bản đồ quy trình** dạng graphic và card hồ sơ; hàng đợi chỉ là góc nhìn phụ, không nhân đôi dossier.
- Một hồ sơ có `ownerUsername` duy nhất xuyên suốt từ Đề nghị, tài liệu/biên bản, đánh giá, PYC/KQTN, đóng gói đến trình lãnh đạo. Card hồ sơ chưa có chủ có điểm vào **Nhận hồ sơ**; self-claim dùng cùng policy server với hàng đợi.
- Chi tiết dossier đã có checklist trực quan read-only, upload theo từng yêu cầu với phiên bản, danh sách thành phần bộ hồ sơ, liên kết PYC/KQTN/phát hành và khu vực sinh biểu mẫu Word/PDF/biên bản.
- Quyền nhận/chuyển chủ hồ sơ không được suy ra từ UI: nhân viên chỉ tự nhận hồ sơ trống của chính mình; Admin/Lãnh đạo mới được điều phối; viewer bị chặn; mutation vẫn qua server boundary và audit.
- Verification trước triển khai: `npm test` và `npm run lint` phải pass trên tree hiện tại; `npm run build` là bước bắt buộc trước khi dựng image. Không đưa `.env`, secret, attachment hoặc dữ liệu thô trong `tmp/` vào commit.
- Deploy production sau commit phải dùng `docker compose --env-file <Supabase env> -f docker-compose.pcn.yml up --build -d`; cần có `PCN_SESSION_SECRET` ổn định trong env triển khai, không dùng secret hard-code trong repository.

## Observation triển khai 2026-08-30 — PCN production Docker Desktop

- Commit code đã tạo: `cd0d0dac97f215e13204c400006402407714fbc7` (`feat(pcn): add certification workspace and workflow`).
- Docker image đã build thành công: `pcn_webapp-webapp:latest`, image digest `sha256:1449b235609f47022b7c4216960e8fc2d8d5b2ece158a87e5c890500c65a2a5d`.
- Container đang chạy: `pcn_webapp-webapp-1`, publish `0.0.0.0:2357->2357/tcp`.
- Kiểm tra runtime: `GET /api/health` trả HTTP 200 với `{"status":"ok"}`; PostgreSQL `supabase-db:5432` accepting connections và truy vấn runtime xác nhận `pcn_certification|postgres`.
- `GET /api/db/health` không kèm phiên đăng nhập trả HTTP 401 (`Phiên PCN không hợp lệ hoặc đã hết hạn.`), phù hợp với lớp bảo vệ xác thực của API.
- Build context ban đầu phình khoảng 1,8 GB do `.next`; `.dockerignore` đã bổ sung `.next`, `tmp`, `obsidian-vault` và `.codex-remote-attachments`, context lần build thành công còn khoảng 7,54 MB.
- Lần deploy này dùng `PCN_SESSION_SECRET` sinh tạm trong phiên compose vì file env Supabase hiện chưa có biến này. Cần đặt một secret ổn định trong env triển khai trước lần recreate/restart tiếp theo; không ghi secret vào repository hoặc memory.

## Lưu ý vận hành hiện tại — Môi trường chạy & Cổng dịch vụ

- **Môi trường Development cục bộ (`npm run dev`)**: Chạy Node/Express server trực tiếp tại `http://localhost:1359`.
- **Môi trường Docker Desktop (`docker-compose.supabase.yml`)**: Container web app chạy tại `http://localhost:2359`.
- Môi trường test/deploy hiện tại là Docker Desktop trên máy local, dùng `docker-compose.supabase.yml` và PostgreSQL/Supabase network hiện có.
- Không deploy project lên Synology NAS; SSH/rsync tới NAS không thuộc quy trình hiện tại.
- `deploy.sh` đã được chuyển thành script build/restart Docker Desktop local. Script không đồng bộ `.env`, service account hoặc secret ra máy từ xa.
- Sau khi deploy, kiểm tra `http://localhost:2359/api/health` và `http://localhost:2359/api/db/health`.
- Dùng `COMPOSE_ENV_FILE` để chỉ định Supabase env file khác khi cần; mặc định là `E:/CODING/TVCI_APP/supabase-docker/.env`.

## Cập nhật 2026-08-24 — Form Báo cáo: Quy chuẩn Bảng Công suất nhiễu EMC chỉ hiển thị 1 hàng (tự động lấy hàng 1)

- **Quy chuẩn Toàn hệ thống (`design.md`)**:
  - Bổ sung quy định chung: Bảng kết quả Công suất nhiễu (Phần 6 / `tablePower*`) trên tất cả các form báo cáo EMC chỉ hiển thị và sử dụng duy nhất **1 hàng** kết quả.
  - Khi tải file Radimation hoặc khi dán dữ liệu (paste): nếu tệp có từ 2 hàng trở lên, hệ thống tự động **chỉ lấy hàng 1** và bỏ qua các hàng phía sau.
- **Thực thi Code**:
  - `EmcBepDien1VungNauForm.tsx`:
    - `RadimationUploader`: Với các bảng `isPower` (`tablePower*`), tự động lấy hàng 1 (`targetRows[startIndex] || targetRows[0]`) và gán `[mappedObj]`.
    - `TablePowerDisturbance`: Giới hạn render bảng `data[tableName].slice(0, 1)`.
    - `handlePaste`: Khi paste vào `tablePower*`, chỉ xử lý hàng đầu tiên và giữ độ dài bảng bằng 1.
  - `server.ts`: Áp dụng `.slice(0, 1)` cho toàn bộ các trường `tablePower*`, `table_6_3_*`, `table_7_3_*` khi xuất DOCX template.
- **Kiểm thử**:
  - `test/report-docx-image-integration.test.ts` (12/12 pass), `npm run lint` (0 errors), `npm run build` (pass).

## Cập nhật 2026-08-24 — Form Báo cáo: Bổ sung mục 6.3.2.1 EMC Máy khoan (Công suất nhiễu 2 chiều quay)

- **Đồng bộ Design & Form Đánh giá**:
  - Cập nhật mục 4.4 trong `design.md` làm Single Source of Truth cho cấu hình bài đo Công suất nhiễu của **EMC Máy khoan** (`emc_may_khoan`).
  - Trong `EmcBepDien1VungNauForm.tsx`, tách riêng cấu hình Section 6 cho máy khoan gồm đầy đủ 2 chiều quay song song:
    1. **6.3.1. Thử nghiệm khi EUT quay cùng chiều kim đồng hồ**: Dòng con `6.3.1.1. Kết quả công suất nhiễu của dây dẫn nguồn` (ảnh `powerDisturbance`, bảng `tablePower`).
    2. **6.3.2. Thử nghiệm khi EUT quay ngược chiều kim đồng hồ**: Dòng con `6.3.2.1. Kết quả công suất nhiễu của dây dẫn nguồn` (ảnh `powerDisturbance_2`, bảng `tablePower_2`).
- **Template DOCX**:
  - Đồng bộ `maykhoan placeholder.docx` (trong `public/` và `dist/`) bổ sung đầy đủ khối `6.3.2` & `6.3.2.1` với `{%image_6_3_2_1}`, `{#table_6_3_2_1}...{/table_6_3_2_1}` và `Bảng 14`.
- **Kiểm thử**:
  - `test/report-*.test.ts` (11/11 pass), `npm run lint` (0 errors), `npm run build` (pass).

## Cập nhật 2026-08-24 — Form Báo cáo: Bổ sung trường Phụ trách phòng TN (managerName) & Droplist chọn nhanh

- **Đồng bộ Design & Schema**:
  - Cập nhật mục 4.4 trong `design.md` làm Single Source of Truth cho 2 trường ký duyệt báo cáo: `testerName` (`{testerName}`) và `managerName` (`{managerName}` / `{managerNam}`).
  - Thêm `managerName?: string;` vào `KQTNRecord` trong `types.ts`.
- **Giao diện ReportGeneratorView**:
  - Mở rộng state `reportMeta` với trường `managerName`.
  - Tái cấu trúc khu vực chữ ký thành 2 cột song song (responsive grid): **Người thử nghiệm** (`testerName`) và **Phụ trách phòng TN** (`managerName`).
  - Trang bị **Droplist chọn nhanh** cho `managerName` chỉ nhận diện các nhân sự giữ chức danh **Trưởng phòng hoặc Phó trưởng phòng** (mặc định gồm: **Vũ Việt Anh** và **Lương Xuân Hùng**), đồng thời giữ giá trị cũ khi tải lại KQTN.
  - Trang bị `<datalist>` danh sách nhân sự cho `testerName`.
  - Hiển thị thông tin **Phụ trách PTN** trong modal chi tiết của `KQTNView.tsx`.
- **Backend & DOCX Template Mapping**:
  - `server.ts` (`POST /api/generate-docx`): Ánh xạ `managerName` và alias `managerNam` vào template data của Docxtemplater.
- **Verification**:
  - `test/report-docx-image-integration.test.ts` & `test/report-docx-metadata.test.ts` (7/7 pass).
  - `npm run lint` (0 errors), `npm run build` (pass, bundle tạo thành công).

## Cập nhật 2026-08-24 — Docx Template Settings Modal & Code Conventions Update

- **DocxSettingsModal & Quản lý Biểu mẫu Word**:
  - Cập nhật mục 4.6 trong `design.md` làm source of truth.
  - Tạo `lib/reportTemplatesCatalog.ts` tổng hợp 43 định nghĩa template DOCX (An toàn điện 5699, EMC QCVN 9, Dây cáp điện 6610, PYC, BMGN).
  - Thêm 4 REST API routes trong `server.ts` (`GET /api/templates`, `GET /api/templates/:filename/download`, `POST /api/templates/upload`, `POST /api/templates/:filename/reset`) với cơ chế sao lưu tự động `.bak` trước khi ghi đè.
  - Tạo `components/DocxSettingsModal.tsx` và gắn nút "Cài đặt docx" vào header của `ReportGeneratorView.tsx`.
  - Hỗ trợ tìm kiếm tức thì, lọc theo nhóm tab, tải về, chọn file/kéo thả để cập nhật và khôi phục bản gốc.
- **Loại bỏ quy chuẩn Header/Footer khi coding**:
  - Đã cập nhật `AGENTS.md` và `design.md` (Mục 8) loại bỏ hoàn toàn yêu cầu bắt buộc header `// Author: Gemini` và footer `// --- End of [filename] ---`.
- **Quy định cổng chạy**:
  - Ghi nhớ cổng Dev server là `1359`, cổng Docker Desktop production là `2359`.
- **Verification**: `test/docx-template-settings.test.ts` (4/4 pass), `test/report-*.test.ts` (9/9 pass), audit scripts (2/2 pass), `npm run lint` (0 errors), `npm run build` (pass).
- **Production deployment**: Rebuilt image `ddt_webapp-webapp:latest` và recreate container `ddt_webapp-webapp-1` trên Docker Desktop (cổng 2359).

## Cập nhật 2026-08-22 — Bulk Upload KQTN trên Docker Desktop

- Bulk Upload Plan B đã được build/recreate trên Docker Desktop local bằng `docker-compose.supabase.yml`.
- Container `ddt_webapp-webapp-1` đang chạy trên cổng `2359`; `/api/health` và `/api/db/health` đều trả HTTP 200 sau deploy.
- Bản deploy gồm luồng PDF ghép nhiều kết quả, tách PDF con, review mapping, upload tuần tự, retry nhóm lỗi và activity log tổng hợp.

## Cập nhật 2026-08-22 — Dashboard staffing, bỏ PEAK và backup file đầy đủ

- Dashboard Tổng quan hiện chỉ đưa nhân viên lên bảng công việc, KPI và menu **Tùy chỉnh nhân sự** khi có ít nhất một phiếu có `scheduledDate` và `testerName` thực tế; loại `Chưa giao`, `Khác` và các bản ghi lịch sử `-log-`. Phân công đã hoàn thành vẫn được giữ trong tập nhân sự vì từng thuộc một lịch thử nghiệm.
- Logic lọc được tách vào `utils/dashboardStaffing.ts`; `App.tsx` không còn lấy nhân sự từ `defaultTestersAtd`, `defaultTestersChamber1` hoặc `defaultTestersChamber2` cho Dashboard.
- Đã xóa banner và toàn bộ phép tính riêng phục vụ cảnh báo `PEAK MODE` trong `App.tsx`.
- Cập nhật `design.md` để làm source of truth cho phạm vi nhân sự theo lịch thực tế và hợp đồng backup đầy đủ.
- Cảnh báo Admin có nút **Sao lưu đầy đủ** gọi server backup. `utils/backupManager.ts` tạo archive `.zip` chứa `database.dump`, `storage/manifest.json` và object PDF KQTN từ Supabase Storage; restore chạy `pg_restore` trước rồi khôi phục object. Backup JSON/CSV chỉ còn là bản portable, không được tính là backup file đầy đủ.
- Ảnh OCR và ảnh lập báo cáo vẫn là dữ liệu tạm, không đưa vào backup hoặc `file_assets`; PDF KQTN là file nghiệp vụ và được backup.
- Verification: test Dashboard/PEAK/backup `11/11`, `npm run lint` pass, `npm run build` pass, `git diff --check` pass. Full suite `220/222` pass; hai lỗi còn lại là contract Compose đang kỳ vọng không có `SUPABASE_SERVICE_ROLE_KEY` và test cũ kỳ vọng store gọi trực tiếp `fetchCollection("systemUsers", true)`, đều nằm ngoài thay đổi này.
- Workspace vẫn có các thay đổi chưa commit từ trước; lượt này không reset hoặc ghi đè các thay đổi ngoài phạm vi.

## Cập nhật 2026-08-20 — Bản nháp phiếu yêu cầu và reset form

- Đã cập nhật `design.md` quy định bản nháp chỉ áp dụng cho modal tạo phiếu mới, lưu cục bộ theo tài khoản bằng IndexedDB, không lưu ảnh/OCR hoặc trạng thái UI tạm thời.
- `utils/requestDraft.ts` cung cấp khóa bản nháp chuẩn hóa theo username, kiểm tra payload, đọc/ghi/xóa IndexedDB.
- `RequestModal` tự lưu bản nháp sau khi người dùng thay đổi, flush khi đóng modal, cho phép khôi phục khi mở lại và xóa sau khi lưu phiếu thành công.
- Nút `Xóa bản nháp` xóa dữ liệu cục bộ, reset toàn bộ form về trạng thái vừa mở modal và giữ modal đang hiển thị; modal chỉnh sửa phiếu không dùng cơ chế này.
- Verification: test draft + save-sync `6/6`, `npm run lint` pass, `npm run build` pass; full suite `214/215` pass, lỗi còn lại là contract Compose cũ liên quan `SUPABASE_SERVICE_ROLE_KEY`.
- Production Docker đã rebuild/recreate sau thay đổi; container `ddt_webapp-webapp-1` đang `Up`, `/api/health` và `/api/db/health` đều HTTP 200 trên cổng `2359`.

## Cập nhật 2026-08-20 — Tối ưu lưu phiếu và deploy production Docker Desktop

- Đã xác định nguyên nhân lưu phiếu chậm là `RequestModal` thực hiện full sync lặp trong bước pre-check, trong `addRequests()` và sau khi lưu.
- Đã cập nhật `design.md` quy định pre-check chỉ đọc collection `requests`; sau mutation chỉ thực hiện một full sync hậu lưu. Các caller khác của `addRequests()` vẫn giữ sync mặc định.
- Đã thêm `fetchLatestRequests()` với fallback về local khi API lỗi; `RequestModal` truyền `skipSync=true` cho `addRequests()` rồi thực hiện một full sync cuối để bảo toàn merge, notification và persistence.
- Regression tests cho luồng này đạt `15/15`; `npm run lint` pass; `npm run build` pass. Full suite đạt `211/212`; test còn lại là contract Compose Supabase không liên quan, do `SUPABASE_SERVICE_ROLE_KEY` vẫn hiện diện trong Compose.
- Đã build production Docker image `ddt_webapp-webapp:latest` và recreate container `ddt_webapp-webapp-1` bằng `docker-compose.supabase.yml`.
- Verification sau deploy: container `Up`, publish `2359:2359`, server kết nối PostgreSQL thành công, `/api/health` HTTP 200, `/api/db/health` HTTP 200, collection `requests` trả `587` bản ghi.
- Build vẫn có cảnh báo bundle JavaScript lớn hơn 500 kB; không chặn deployment và chưa nằm trong phạm vi tối ưu lần này.

## Cập nhật 2026-08-18 — Hoàn tất chuyển runtime sang Supabase PostgreSQL

- Webapp production trên cổng `2359` hiện kết nối `supabase-db:5432`, database `ddt_lab`, qua network `supabase_default`.
- Đã đối chiếu toàn bộ dữ liệu giữa runtime cũ và Supabase: 1.079 document cũ đều đã có ở Supabase; Supabase giữ thêm `activityLogs`, `kqtnRecords`, `products` và `userPreferences`.
- Đã đồng bộ 7 `systemConfig` có timestamp mới hơn từ runtime cũ và bổ sung `chamberId` còn thiếu cho một phiếu; notification payload đầy đủ trên Supabase được giữ nguyên.
- Đã tạo backup trước migration: `backups/ddt-legacy-postgres-20260818-211058.dump` và `backups/ddt-supabase-postgres-20260818-211058.dump`.
- Đã xóa container `ddt_webapp-postgres_db-1`, volume `ddt_webapp_pgdata` và volume orphan `ddt_webapp_postgres_data`; không còn PostgreSQL DDT standalone.

## Cập nhật 2026-08-18 — UI mobile/PWA và xuất DOCX

- Global UI đã trả về mức `100%`; layout desktop không còn bị co dưới.
- Portrait guard của PWA chỉ áp dụng cho thiết bị cảm ứng (`pointer: coarse`); desktop/DevTools dùng pointer chuột không bị khóa xoay hoặc hiện cảnh báo ngang.
- Đã bỏ nút `Cài đặt webapp` khỏi header.
- Đã thu gọn icon trong card Phiếu yêu cầu, sửa nút `Tùy chỉnh nhân sự` trên Tổng quan để hoạt động bằng click/tap và giữ bảng KQTN mobile trong vùng cuộn hiển thị được mẫu.
- Validation DOCX: mismatch với thông tin PYC, OCR hoặc thông số PYC chỉ là cảnh báo và vẫn cho phép lưu/xuất DOCX. Chỉ ngày sai định dạng hoặc sai thứ tự thời gian mới chặn.
- Khi có lỗi chặn, khu vực ngay trên nhóm nút báo `Xuất DOCX đang bị chặn` và liệt kê trường/vị trí cần xử lý. Khi chỉ có mismatch, UI báo `Có cảnh báo đối soát` và xác nhận vẫn có thể xuất DOCX.
- Kiểm tra cuối: 38/38 test hồi quy liên quan pass, `npm run lint` pass, `npm run build` pass; Docker production đã rebuild trên `2359`, PostgreSQL healthy trên `15432`, `/api/db/health` trả HTTP 200.

## Cập nhật 2026-08-19 — Ghép ảnh tem động vào một placeholder DOCX

- Đã xác nhận yêu cầu nghiệp vụ: mọi ảnh tem động `label`, `label2`, `label3`, ... phải giữ đúng thứ tự, ghép cạnh nhau thành một ảnh ngang duy nhất và chỉ mapping vào `anh_1`; không phân tán sang `anh_2`, `anh_3`, ... .
- Đã cập nhật `design.md` để quy tắc composite ảnh tem trở thành source of truth.
- `lib/reportDocxImageMapping.ts` có mapper numeric-order, loại slot tem rỗng, tạo composite PNG ngang bằng `Resvg` và giữ tỷ lệ từng ảnh thành phần.
- `server.ts` tạo composite trước khi render DOCX, loại bỏ các assignment cứng `data.anh_*` có thể ghi đè mapping; ảnh mẫu/thiết lập EMC bắt đầu từ slot sau `anh_1`.
- `ReportGeneratorView.tsx` truyền fallback `nameplatePhotos`; `EmcBepDien1VungNauForm.tsx` sắp xếp các ô tem theo số thứ tự.
- Đã thêm regression tests cho numeric order, composite PNG, DOCX render và contract server/template audit.
- Verification: `npx tsc --noEmit` pass, `npm run build` pass, focused DOCX/audit tests `8/8` pass. Full suite `199/200` pass; test còn lại là lỗi contract Compose có sẵn liên quan `SUPABASE_SERVICE_ROLE_KEY`, không liên quan DOCX.

## Trạng thái kiến trúc

- PostgreSQL là database runtime chính; ứng dụng không còn dùng Firestore cho luồng lưu trữ runtime.
- Dữ liệu nghiệp vụ được lưu trong bảng PostgreSQL `app_documents` với khóa `(collection_name, document_id)` và payload `JSONB`.
- REST API nội bộ cho database nằm dưới `/api/db/*`; batch tối đa 250 document mỗi lượt.
- Bản backup JSON đã được import: **1.291 document**.
- Danh sách người dùng hiện có trong PostgreSQL: **16 document** thuộc collection `systemUsers`.
- Hệ thống notification nghiệp vụ dùng collection `notifications` trong `app_documents`, merge theo `id` và giữ tối đa 50 bản ghi mới nhất.
- Chính sách notification là low-noise: chỉ báo ngay các thay đổi lớn ảnh hưởng tiến độ, phân công, trạng thái, mẫu, biên bản hoặc KQTN; không báo các chỉnh sửa chữ, ghi chú, đổi tên/đổi mã hiển thị.
- Admin/Quản lý xem toàn bộ notification nghiệp vụ; nhân viên chỉ xem phiếu mới, biên bản mới và công việc được giao đúng username.
- Mọi tài khoản đã đăng nhập đều có chuông/dropdown notifications; nội dung vẫn được lọc theo audience và `targetUsernames` để tránh gây loãng.
- Notification metadata gồm entity/action, request/doc/report reference, trạng thái trước/sau, lịch thử và target username để phục vụ lọc quyền và điều hướng click.
- Nhật ký hệ thống dùng collection riêng `activityLogs` trong `app_documents`, append-only đối với UI và không dùng chung trạng thái đọc/xóa của notifications.
- Mọi mutation nghiệp vụ thành công đều ghi activity log, kể cả sửa nhỏ; notification vẫn giữ chính sách low-noise chỉ báo thay đổi lớn.
- Activity log được append qua `POST /api/activity-logs` hoặc `POST /api/activity-logs/batch`; trang đọc qua `GET /api/activity-logs` với cursor/filter, không hydrate toàn bộ lịch sử vào Zustand.
- Trang `Nhật ký hệ thống` dành cho mọi tài khoản đã đăng nhập, nằm ngay trước `Thiết lập` trên sidebar; dữ liệu chỉ đọc, chi tiết có diff before/after đã redaction và export CSV theo các dòng đã tải.
- App shell sau đăng nhập dùng scope `ddt-compact`: giảm gap/padding/font theo một bậc cho header, sidebar, toolbar, card và filter; giữ touch target mobile và scope riêng của report/print.
- API append/batch dựng lại payload qua `buildActivityLog` trước khi lưu để loại trường ngoài contract và redaction dữ liệu nhạy cảm; cập nhật KQTN được phân loại là `KQTN_RECORD`.

## Cổng và triển khai

- Dev server: `http://localhost:1359`.
- Dev PostgreSQL Docker: `localhost:15432` ánh xạ vào cổng container `5432`.
- Docker production app: `http://localhost:2359`.
- Docker Compose production chỉ gồm `webapp`, kết nối database `ddt_lab` trên Supabase network `supabase_default`; không còn volume PostgreSQL local.
- Domain public đã kiểm tra: `https://ddtdev.tvci.id.vn`.
- Vite dev HMR đã gắn vào HTTP server chính; WebSocket public dùng cùng origin, không còn cổng ngẫu nhiên `24678`.
- `ddtdev.tvci.id.vn` đã nằm trong `server.allowedHosts`.

## UI/UX đã chốt

- Đã bỏ nút riêng **“Nhật ký đồng bộ”** khỏi Header.
- Chức năng chẩn đoán đồng bộ PostgreSQL vẫn mở từ **Cấu hình hệ thống**.
- PWA dùng nhãn **“Cài webapp”**, không dùng “Download”. Chrome/Edge tự cung cấp biểu tượng cài đặt trên thanh địa chỉ khi app chạy tại `localhost` hoặc HTTPS đủ điều kiện.
- Manifest PWA dùng tên `PTN Điện - Điện tử | TVCI Lab`, `display: standalone`, `scope: /`, icon PNG TVCI tại `public/icons/tvci-icon-32.png`, `public/icons/tvci-icon-192.png` và `public/icons/tvci-icon-512.png`.
- `index.html` đăng ký `/sw.js`; không được thêm lại logic unregister service worker hoặc xóa toàn bộ cache khi khởi động.
- Service worker hiện dùng cache `ddt-lab-pwa-v3` và pre-cache manifest/icon PWA.
- Dropdown notification đã điều hướng được tới danh sách phiếu, màn hình giao nhận mẫu, KQTN và lịch thử nghiệm.

## Xác minh gần nhất

- `npm test`: **142/142 pass** ngày 18/08/2026 khi dùng preload test có sẵn `scripts/test-node-userinfo-preload.cjs` để tránh lỗi môi trường Node/Windows `uv_os_get_passwd ENOMEM`; không thêm shim tạm vào source notification.
- `npm run lint`: pass sau khi thêm activity log model/API/store/UI.
- `npm run build`: pass ngày 18/08/2026; còn cảnh báo chunk JavaScript lớn hơn 500 kB, không phải lỗi build.
- Đã backfill **38 activity logs** từ các notification phát sinh trong buổi sáng 18/08/2026, giữ lại actor/action/entity; các phiếu chỉ có `updatedAt` nhưng không có actor không được gán người thực hiện. Sau đó có thêm 1 log người dùng mới, nên production hiện có 39 bản ghi.
- Production Docker Desktop đã build/recreate thành công ngày 18/08/2026: `ddt_webapp-webapp` chạy port `2359`, `ddt_webapp-postgres_db-1` healthy với port host `15432`; `/api/health` trả 200 và `/api/activity-logs` đọc được dữ liệu.
- Production Docker đã rebuild sau KPI extension; bundle mới có summary API, checkbox người dùng, biểu đồ KPI và GMT+7. Summary ngày 18/08/2026 xác minh 6 nhân viên, HungX 15 hoạt động và Vũ Nam Thái 4 mẫu KQTN.
- Production Docker đã rebuild lại sau khi mở Nhật ký cho mọi tài khoản đăng nhập và xác nhận notifications dùng chung chuông/dropdown với audience filtering; `/api/health` và `/api/activity-logs` trả HTTP 200.
- Production Docker đã rebuild lại sau compact density và hoàn thiện Header Nhật ký; container chạy port `2359`, PostgreSQL healthy, `/api/health` và `/api/activity-logs` tiếp tục trả HTTP 200.
- Compact density vòng 2 đã thu gọn thêm các modal lớn dùng `p-8`, `gap-6/8` và `space-y-6`; vẫn giữ ngoại lệ report form và touch target mobile. Docker đã rebuild/smoke test lại ngày 18/08/2026.
- KPI tạo hàng loạt đã được chuẩn hóa thành một audit log cho từng phiếu để đếm đúng distinct entity; bộ lọc có sequence guard chống phản hồi cũ ghi đè; server chỉ nhận `createdAt` dạng ISO hợp lệ.
- Đã sửa lỗi PWA: bỏ link trực tiếp `/index.css` khỏi HTML, giao CSS cho Vite entry, và bắt lỗi fetch tài nguyên trong `public/sw.js`; Docker production rebuild/smoke check pass, HTML không còn gọi CSS sai.
- Trang Nhật ký hệ thống có scrollbar dọc riêng cho vùng bộ lọc/KPI và bảng dữ liệu; không mở scrollbar toàn app để giữ layout viewport/mobile ổn định.
- Gemini model discovery không còn tự gọi khi mở Thiết lập; endpoint chỉ chạy khi bấm kiểm tra, thiếu key trả `503/GEMINI_API_KEY_MISSING`, lỗi kết nối Google trả `503/GEMINI_API_UPSTREAM_UNAVAILABLE`.
- Notification contract/helper tests bao phủ audience, assignment username, event metadata, merge/xóa, navigation và backup/restore.
- Activity log tests bao phủ builder/redaction/quyền, cursor API/append batch, backup/import append-only, store entity coverage, bulk request audit, timestamp validation, chống stale response, sidebar placement, UI controls và vùng cuộn dọc.
- Activity KPI tests bao phủ summary API, chọn nhiều nhân viên, giới hạn hiển thị, chart segments và format thời gian GMT+7.
- Trang Nhật ký đã chuyển KPI sang ranking thanh ngang xếp chồng responsive: mỗi nhân viên có tổng thao tác, thanh phân bổ Phiếu/KQTN/Biên bản/Lịch/Khác và các số P/M/KQ/BB/L/Kh; danh sách có giới hạn cuộn nội bộ để xem nhiều người trên mobile. Bộ lọc mobile có thể thu gọn và trang đã chừa safe-area cho bottom navigation.
- Xác minh vòng thay đổi KPI compact: nhóm test Activity/KPI/mobile/global UI đạt 21/21, `npm run lint` và `npm run build` đạt. Lệnh `npm test` trong lần chạy này bị Node/Windows chặn trước khi nạp test bởi `uv_os_get_passwd ENOMEM`; đây là giới hạn môi trường, không phải assertion của thay đổi.
- Compact UI tests bao phủ scope `ddt-compact`, ngoại lệ report form spacing/typography, touch-target contract và nhãn Header của trang Nhật ký.
- Gemini credential tests bao phủ phân biệt thiếu key/upstream network và không tự gọi model khi mount trang Thiết lập.
- Production build đã phát hành đủ `dist/manifest.json`, `dist/sw.js` và `dist/icons/*` cho PWA.
- Docker Desktop production: `docker compose up -d --build` pass ngày 17/08/2026; image `ddt_webapp-webapp:latest` đã được build và container `ddt_webapp-webapp-1` chạy trên `2359:2359`.
- PostgreSQL container `ddt_webapp-postgres_db-1` healthy trên `15432:5432`.
- Production smoke check pass: `/api/health` trả HTTP 200 `{"status":"ok"}`, `/api/db/health` trả HTTP 200 với `database: postgresql`.
- PWA asset smoke check pass: `/manifest.json`, `/sw.js`, `/icons/tvci-icon-192.png` và `/icons/tvci-icon-512.png` đều trả HTTP 200 trong container production.
- `/api/health` và `/api/db/health` trả HTTP 200 ở dev, Docker và domain public.
- Batch write/delete đã kiểm tra thành công cho `handoverDocs`, `products`, `systemUsers`, `brands`, `systemConfig` và `requests`.

## Observations và lưu ý vận hành

- Không sửa file `.env`; cấu hình mẫu nằm ở `.env.example`.
- Dev/Docker runtime dùng PostgreSQL trên Supabase; chạy Compose với env file Supabase trước khi mở app.
- Docker production nhận `POSTGRES_HOST=supabase-db` và `POSTGRES_PORT=5432` trên network `supabase_default`.
- Nếu chưa cấu hình `GEMINI_API_KEY` hoặc Gemini key cá nhân, `/api/gemini/models` trả `503` với mã `GEMINI_API_KEY_MISSING`; đây là trạng thái cấu hình có chủ ý, không phải lỗi PostgreSQL.
- Khi truy cập domain qua reverse proxy, proxy phải hỗ trợ HTTP Upgrade/WebSocket để HMR hoạt động.
- `clearNotifications` phải xóa cả local state và các document tương ứng trên cloud; không dùng backfill request cũ vì sẽ làm notification đã xóa xuất hiện lại.
- Backup JSON, restore và `uploadToPostgres` phải bao gồm collection `notifications`, chuẩn hóa legacy records và xóa cloud records không còn trong backup.
- Backup JSON có thêm `activityLogs`; backup chủ động tải toàn bộ log qua cursor, restore chỉ merge theo id và không xóa lịch sử hiện có; CLI importer dùng `DO NOTHING` cho id activity log trùng.
- Không thêm `activityLogs` vào generic `/api/db/:collection` whitelist để tránh mở PUT/DELETE; chỉ route activity chuyên dụng được phép append/query.
- Không dùng lại port `5432` trên host cho project vì có dịch vụ khác; port public của database project là `15432`.
- Docker Desktop phải đang chạy và Docker Engine phải cho phép CLI truy cập trước khi dùng `docker compose`.

## Cập nhật 2026-08-26 — Chuyển mã hóa ITDC cũ sang cột ITD

- Đã cập nhật `design.md`: `itdEncodeNumber` là cột đích; dữ liệu từ `atdEncodeNumber` được copy nguyên chuỗi, giữ nguyên tiền tố `ITDC`, không đổi thành `ITD`; không ghi đè khi ITD đã có giá trị khác; hỗ trợ dry-run/idempotent và chỉ xóa nguồn sau khi đối soát.
- Đã thêm `utils/itdcToItdMigration.ts` để lập kế hoạch/chuyển từng record, giữ nguyên record khi có conflict.
- Đã thêm script `scripts/migrateItdcToItd.ts` và npm command `npm run migrate:itdc-to-itd`; mặc định dry-run, `--apply` chạy transaction và có kiểm tra giá trị nguồn chống cập nhật đồng thời.
- Đã tích hợp chuẩn hóa tại biên `addRequest`/`addRequests` trong `store.ts` để dữ liệu tạo mới không tiếp tục ghi riêng mã legacy.
- Migration production đã chạy thành công: **108** bản ghi chuyển, **0** conflict; hậu kiểm `requests`: `itdItdc=108`, `legacyAtd=0`. Dry-run lần sau trả `scanned=0`.
- Regression test mới: `test/itdc-to-itd-migration.test.ts` (**6/6 pass**). Verification cuối: `npm test` **351/351 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` pass. Build chỉ còn cảnh báo chunk lớn hiện hữu.

## Cập nhật 2026-08-25 — Hoàn tất Bulk Upload KQTN, Storage PDF và cảnh báo footer

- Bulk Upload PDF ghép đã chuyển sang luồng PaddleOCR footer-first dùng chung `tvci_ocr_service`: upload nguồn một lần, tạo footer job bất đồng bộ, polling tiến độ và chỉ OCR trang ứng viên/trang đầu nhóm cần nhận diện. Bulk mapping không phụ thuộc Gemini; nếu PaddleOCR không đủ metadata hoặc lỗi thì giữ trạng thái rà soát/chọn mẫu thủ công, không gọi Gemini tự động.
- Với file scan 116 trang đã xác nhận mapping đúng 6 nhóm: `1132-26-M02` trang 1–20, `M03` 21–39, `M04` 40–59, `M05` 60–78, `M06` 79–96 và `M07` 97–116. Các trang kết quả/phụ lục lặp không còn bị nâng thành nhóm thừa.
- Mapping mẫu đích dùng combobox tìm kiếm/lọc; candidate chưa có KQTN vẫn chọn được và hiển thị cảnh báo. Khi upload, hệ thống tạo bản ghi KQTN tối thiểu nếu cần; mẫu đã có PDF sẽ hỏi xác nhận ghi đè. Ô trang bắt đầu/kết thúc giữ được giá trị rỗng tạm thời khi người dùng đang edit.
- Footer OCR có `current/total` được đối chiếu với số trang thực tế. Nếu lệch, UI báo cảnh báo nhưng vẫn cho phép tách và lưu theo mốc/mapping người dùng đã rà soát; chỉ khoảng trang không hợp lệ mới chặn.
- Sửa lỗi lưu PDF production: Compose mặc định dùng `http://supabase-storage:5000` và map cả `SUPABASE_SERVICE_ROLE_KEY` lẫn alias `SERVICE_ROLE_KEY` từ env Supabase bên ngoài; không ghi secret vào repository. Giới hạn hiện tại là 25 MiB cho PDF đơn/PDF con, 100 MiB cho PDF nguồn ghép và chưa có giới hạn cứng số trang.
- Production Docker `ddt_webapp-webapp-1` đã rebuild/recreate trên cổng `2359`. Health app/DB trả HTTP 200; storage smoke upload/delete trả HTTP 200; bucket duplicate trả `statusCode=409` đúng contract.
- Verification cuối: `npm test` **311/311 pass**, `npm run lint` pass, `npm run build` pass (chỉ còn cảnh báo chunk >500 kB), `git diff --check` exit 0.
- Attachment ảnh người dùng và mọi secret/env thật không đưa vào commit.

## Cập nhật 2026-08-25 — Bulk mapping không chặn bởi Gemini

- Docker logs xác nhận footer job PaddleOCR hoàn tất `116/116` trang, nhưng mapping production cũ vẫn gọi Gemini và nhận `400 API key not valid`; đây là lỗi cấu hình Gemini, không phải lỗi Storage/PaddleOCR.
- `components/KqtnBulkPdfUploadModal.tsx` đã bỏ fallback Gemini khỏi cả PDF đơn và PDF ghép. Matching dùng PaddleOCR trang đầu + tên file; khi không có metadata, UI xóa đề xuất không chắc chắn và yêu cầu người dùng chọn qua combobox tìm kiếm.
- `design.md` đã cập nhật quy tắc Bulk Upload: Gemini là tùy chọn cho luồng khác, không phải dependency của bulk; lỗi/thiếu key không được chặn tách hoặc mapping thủ công.
- Verification sau thay đổi: `npm test` **312/312 pass**, `npm run lint` (tsc) pass, `npm run build` pass, `git diff --check` pass. Build chỉ còn cảnh báo chunk lớn hiện hữu.
- Image production cần rebuild sau commit mới; không đưa `dist` sinh tự động, `.env` hoặc attachment vào commit.

## Files quan trọng

- `server.ts`: Express API, PostgreSQL routes, HMR integration và Gemini endpoints.
- `utils/db.ts`: PostgreSQL pool/schema initialization.
- `utils/postgresApi.ts`: browser REST adapter cho PostgreSQL.
- `utils/firebase.ts`: compatibility layer cũ, hiện chuyển qua PostgreSQL REST.
- `utils/gemini.ts`: browser helpers cho AI extraction.
- `utils/geminiCredentials.ts`: resolve API key và thông báo thiếu key.
- `docker-compose.yml`: PostgreSQL và webapp ports/healthcheck.
- `vite.config.ts`: dev port `1359`, allowlist hostname và Vite plugins.
- `design.md`: source of truth về kiến trúc/UI/schema.
- `utils/notificationEvents.ts`: audience filtering, event builders, identity resolution và merge helpers.
- `utils/notificationNavigation.ts`: mapping notification metadata tới màn hình nghiệp vụ.
- `utils/notificationBackup.ts`: backup payload và legacy notification normalization.
- `utils/activityLog.ts`: ActivityLog builder, diff/redaction, action/entity labels và access policy.
- `utils/activityLogApi.ts`: REST client append, batch restore, cursor pagination và explicit backup export.
- `components/ActivityLogView.tsx`: trang lọc/phân trang/chi tiết/CSV cho Nhật ký hệ thống.
- `utils/activityLogKpi.ts` và `utils/activityLogTime.ts`: chọn KPI/chart segments và format thời gian cố định GMT+7.
- `docs/superpowers/specs/2026-08-18-system-activity-log-design.md`: đặc tả audit log đã duyệt.
- `docs/superpowers/plans/2026-08-18-system-activity-log.md`: implementation plan và checkpoint TDD.
- `docs/superpowers/specs/2026-08-17-business-notifications-design.md`: đặc tả notification nghiệp vụ.
- `docs/superpowers/plans/2026-08-17-business-notifications-plan.md`: kế hoạch triển khai và verification.

## Trạng thái Git và tích hợp

- Workspace `E:\CODING\DDT_webapp` hiện là Git checkout trên nhánh `master`; có thể tạo commit local. Remote/push chưa được yêu cầu trong lượt này.

<!-- --- End of PROJECT_MEMORY.md --- -->
