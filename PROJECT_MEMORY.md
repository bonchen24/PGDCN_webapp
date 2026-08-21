<!--
Author: Gemini
OS support: Web/Node
Description: Persistent project memory and verified deployment observations for DDT Lab
-->

# DDT Lab — Project Memory & Observations

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

- Workspace `E:\CODING\DDT_webapp` hiện không có `.git` local nên không thể tạo commit bằng local Git.
- GitHub connector đã được thử lại ngày 17/08/2026 nhưng `github_get_profile` và `github_list_repositories` đều trả lỗi MCP internal error; chưa xác định được repository đích để commit an toàn.

<!-- --- End of PROJECT_MEMORY.md --- -->
