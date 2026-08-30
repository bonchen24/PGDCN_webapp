# PCN Certification Operations App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chuyển repo DDT hiện tại thành app vận hành cho Phòng Chứng nhận (PCN), giữ nguyên ngôn ngữ UI/card/layout hiện có, bảo toàn Danh sách khách hàng, và tổ chức nghiệp vụ theo các Lĩnh vực từ `Đề nghị` đến phát hành.

**Architecture:** Dùng lại app shell, design tokens, card/modal/table patterns, Zustand, PostgreSQL REST API, file storage và audit infrastructure hiện có, nhưng chạy trên **database logic PCN riêng** trong Supabase self-host hiện đang chạy trên Docker Desktop, tách khỏi database DDT. App PCN kết nối vào service PostgreSQL hiện hữu `supabase-db` qua Docker network `supabase_default`; không dựng thêm một PostgreSQL stack/volume riêng cho PCN. Bổ sung domain PCN theo mô hình `Lĩnh vực` (khởi đầu: Quy chuẩn 4 và Quy chuẩn 9), trong đó `Đề nghị` là đầu vào của PCN, còn `PYC` chỉ là chứng từ outbound khi PCN kết nối với phòng thử nghiệm khác. Không còn mô hình lịch thử nghiệm; mỗi lĩnh vực hiển thị hàng đợi hồ sơ, trạng thái, hạn xử lý và tiến độ liên phòng. Dùng adapter để UI cũ không còn coi `sample/test` là đối tượng trung tâm; dữ liệu DDT cũ không được đọc chung hoặc tự động biến thành Đề nghị, hồ sơ PCN hay PYC.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS, Zustand, Express API gateway trong giai đoạn chuyển tiếp, PostgreSQL JSONB document contract, Supabase Storage, `docxtemplater`, `pdf-lib`, `tsx --test`.

**Spec:** `design.md` — phải được bổ sung và người dùng xác nhận phần PCN trước Task 2; tài liệu nghiệp vụ tham chiếu là `C:/Users/HungX/Desktop/Cau_Hoi_PhongVan_PCN QC4,9.docx` và `E:/CODING/TVCI_APP/Nhanh Giam dinh Chung nhan.md`.

## Global Constraints

- `design.md` là nguồn chuẩn duy nhất; không dùng Obsidian làm nguồn quyết định.
- Không thay đổi hoặc xóa `.env` nếu chưa có xác nhận rõ ràng.
- Giữ nguyên app shell, responsive behavior, design tokens, compact density, accessibility touch target và pattern card/modal hiện có.
- Giữ collection/UI Danh sách khách hàng; không xóa khách hàng khi hồ sơ hoặc tài khoản bị xóa.
- Không chỉnh danh sách nhân sự PCN trong `systemUsers`/`PRESET_ACCOUNTS` ở giai đoạn này; chỉ giữ hạ tầng role/assignment để đưa danh sách sau.
- Không tự động map các bản ghi DDT cũ trong `requests`, `handoverDocs` hoặc `kqtnRecords` thành PCN dossier.
- PCN sử dụng một database runtime riêng, không dùng chung database `ddt_lab`, bảng, collection hoặc credential runtime của DDT.
- Danh sách khách hàng được bảo toàn bằng migration/import có kiểm soát từ nguồn DDT sang database PCN; sau import, PCN sở hữu bản dữ liệu riêng, không live-sync hai chiều mặc định.
- Danh sách người dùng PCN sẽ được cung cấp và seed riêng vào database PCN sau; không dùng chung `systemUsers` của DDT.
- Trong PCN, tuyệt đối không dùng tên `Phiếu yêu cầu` cho chứng từ intake; intake phải hiển thị là `Đề nghị`.
- `PYC`/`Phiếu yêu cầu` chỉ dùng cho yêu cầu PCN gửi sang PTN/phòng thử khác và phải liên kết ngược về hồ sơ PCN.
- PCN không có lịch thử nghiệm, lịch ITD/EMC hoặc auto-schedule; ngày đến hạn chỉ là SLA/target date của hồ sơ và PYC.
- Điều hướng PCN dùng các Lĩnh vực, không dùng tab `Lịch` làm nơi tổ chức nghiệp vụ.
- Supabase là self-host trên Docker Desktop; PCN dùng service PostgreSQL hiện hữu `supabase-db` trong Docker network `supabase_default`, không dùng Supabase Cloud.
- PCN dùng database logic riêng, mặc định đề xuất `pcn_certification`; `ddt_lab` chỉ thuộc profile DDT. Không dùng chung logical database, schema ứng dụng, credential runtime hoặc `app_documents` giữa hai profile.
- Từ container, database host/port mặc định là `supabase-db:5432`; từ môi trường development chạy ngoài Docker phải dùng port host mapping hiện có của Supabase, không suy diễn một port mới trong plan.
- Không tạo thêm PostgreSQL container, volume hoặc compose stack cho PCN trừ khi có quyết định kiến trúc mới được người dùng duyệt.
- Next.js App Router là frontend/runtime đích; Vite entrypoint chỉ giữ tạm trong giai đoạn chuyển tiếp và phải được loại bỏ sau cutover.
- Các component có tương tác/browser API dùng Client Component; layout/page server chỉ làm composition và metadata.
- `server.ts` có thể giữ vai trò Express API gateway trong giai đoạn đầu để bảo toàn API contract; không đổi DB/API chỉ vì chuyển framework.
- PostgreSQL là runtime source of truth; Zustand/IndexedDB chỉ là lớp phản hồi/cache; mọi mutation phải có audit log và chính sách notification hiện hành.
- Khi backend thay đổi, kiểm thử trên cổng native Windows 1357 theo quy ước trong `design.md`.

---

## Phân rã phạm vi

Đây là master plan, cần thực hiện thành các sub-plan có thể kiểm thử độc lập:

1. Nền tảng Next.js App Router và migration shell.
2. PCN domain contract và workflow policy.
3. Persistence database PCN, migration và bảo toàn dữ liệu.
4. Đề nghị, customer reference và dossier dashboard theo Lĩnh vực.
5. Điều phối PTN, KQTN trả về và giao nhận.
6. Phê duyệt, GCN/QĐ/chứng thư và kho hồ sơ.
7. Tích hợp Haimy, báo cáo và cutover production.

Không triển khai toàn bộ trong một lượt; mỗi sub-plan phải có test contract và điểm nghiệm thu riêng.

### Task 0: Xác nhận phạm vi và cập nhật `design.md`

**Files:**
- Modify: `design.md` — bổ sung profile PCN, không xóa các quy tắc lưu trữ/UI dùng chung.
- Reference: `C:/Users/HungX/Desktop/Cau_Hoi_PhongVan_PCN QC4,9.docx`
- Reference: `E:/CODING/TVCI_APP/Nhanh Giam dinh Chung nhan.md`

**Decisions to record:**
- Phạm vi là PCN độc lập, chỉ xây các luồng tiếp nhận Đề nghị, chứng nhận, kết nối PTN, phê duyệt, phát hành và lưu trữ của PCN.
- Một hồ sơ có thể liên quan nhiều lĩnh vực/QCVN và nhiều PTN; không có `lĩnh vực chính` mặc định.
- Phương thức 1, 5, 7 là phạm vi phát hành đầu tiên; ISO 9001/14001 và QA/accreditation là phase sau.
- Chữ ký đầu ra hiện là chữ ký tay; hệ thống chỉ quản lý trạng thái, người ký, file và lịch sử, chưa giả định tích hợp chữ ký số.
- Danh sách người dùng sẽ được cung cấp sau; không seed/migrate nhân sự PCN lúc này.

**Acceptance:** Người dùng duyệt phần PCN addendum trong `design.md` trước khi sửa schema/UI/flow.

### Task 1: Chuyển nền tảng frontend sang Next.js App Router

**Files:**
- Create: `next.config.mjs` — Next 14 không hỗ trợ `next.config.ts`.
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `components/PcnAppShell.tsx`
- Modify: `package.json`, `tsconfig.json`
- Modify: `server.ts` để Express chuẩn bị Next và chuyển request không phải API cho Next handler trong giai đoạn chuyển tiếp.
- Preserve temporarily: `App.tsx`, `index.tsx`, `index.html`, `vite.config.ts` cho rollback; chỉ xóa sau cutover verification.
- Test: `test/next-app-shell.test.ts`

**Architecture:**
- `app/layout.tsx` chứa metadata, global stylesheet và provider tối thiểu.
- `app/page.tsx` render `PcnAppShell`; `PcnAppShell` là Client Component chứa Zustand, modal, notification và các tương tác hiện có.
- Express tiếp tục phục vụ `/api/*` trong giai đoạn đầu; Next xử lý UI trên cùng port 1357 qua custom server ở môi trường native, tránh đổi API/DB đồng thời.

**Steps:**
- [x] Viết contract test xác nhận route `/` render Next page, asset/logo/CSS được tải, và `/api/db/health` vẫn giữ nguyên contract.
- [x] Thêm dependency/script Next.js và cấu hình TypeScript/App Router mà không xóa dependency Vite.
- [x] Tách app shell client từ `App.tsx` sang `components/PcnAppShell.tsx`, giữ nguyên markup, class, handler và design token.
- [x] Cho `server.ts` prepare Next app rồi route `/api/*` vào Express handlers và route phần còn lại vào Next request handler.
- [x] Chạy `next build` và `npx tsx --test test/next-app-shell.test.ts`; chỉ sau khi pass mới chuyển tiếp các module nghiệp vụ.
- [x] Bổ sung manifest/icon và service worker cho cả entry chuyển tiếp và Next PCN; `app/layout.tsx` khai báo metadata, `PcnAppShell` đăng ký `/sw.js` không chặn nghiệp vụ, và cache fallback trả `Response.error()` khi mạng thất bại.

### Task 2: Xây hợp đồng domain PCN và policy thuần

**Files:**
- Modify: `types.ts`
- Create: `utils/pcnWorkflow.ts`
- Create: `utils/pcnMapping.ts`
- Create: `utils/pcnPolicy.ts`
- Test: `test/pcn-workflow.test.ts`
- Test: `test/pcn-policy.test.ts`

**Interfaces:**
- `PcnCertificationField` (`Lĩnh vực`), `CertificationProposal` (`Đề nghị` đầu vào), `CertificationDossier`, `OutboundLabRequest` (`PYC` gửi PTN), `ReturnedTestResult`, `IssuancePackage`, `PcnApprovalStep`.
- `PcnDossierStatus`: `DRAFT`, `INTAKE_REVIEW`, `AWAITING_DOCUMENTS`, `ASSIGNED`, `PLAN_PENDING_APPROVAL`, `FIELD_EVALUATION`, `AWAITING_SAMPLING`, `SENT_TO_LAB`, `AWAITING_RESULTS`, `CORRECTIVE_ACTION`, `TECHNICAL_REVIEW`, `WAITING_APPROVAL`, `APPROVED`, `ISSUED`, `DELIVERED`, `ARCHIVED`, `REJECTED`, `CANCELLED`, `ON_HOLD`.
- Pure functions for allowed transitions, rejection return to evaluator, method-to-template mapping, sample acceptance, retry-round official result, retention metadata, and configurable multi-lab sequence.

**Steps:**
- [x] Viết test cho lifecycle và các transition không hợp lệ.
- [x] Viết test cho QC4/QC9, phương thức 1/5/7, mẫu sai và kết quả lần 2 là kết quả chính thức.
- [x] Viết test phân biệt rõ `CertificationProposal` là đầu vào PCN và `OutboundLabRequest`/PYC là yêu cầu gửi PTN; không cho phép dùng một loại thay cho loại kia.
- [x] Viết test cho branch registry: `QC4` hiển thị `Quy chuẩn 4`, `QC9` hiển thị `Quy chuẩn 9`, một hồ sơ có thể liên kết nhiều lĩnh vực, và không có transition/field nào yêu cầu lịch thử nghiệm.
- [x] Viết test chứng minh một dossier có nhiều lab request mà không cần primary field.
- [x] Implement type/policy thuần, không gọi Zustand/API.
- [x] Chạy `npx tsx --test test/pcn-workflow.test.ts test/pcn-policy.test.ts`.

### Task 3: Persistence database PCN và bảo toàn dữ liệu

**Files:**
- Modify: `store.ts`
- Modify: `server.ts`
- Modify: `utils/postgresApi.ts` nếu cần thêm endpoint contract
- Modify: `docker-compose.yml`, `docker-compose.supabase.yml`, `.env.example` để tham số hóa database PCN; không tự sửa `.env` thực tế.
- Modify/Create: `sql/schema.sql` hoặc migration bootstrap tương ứng cho database PCN.
- Modify: `utils/notificationBackup.ts` và các helper backup liên quan
- Test: `test/pcn-persistence-contract.test.ts`
- Test: `test/customer-data-integrity.test.ts`

**Steps:**
- [x] Tách cấu hình kết nối theo profile để PCN dùng database logical riêng, mặc định đề xuất `pcn_certification`, trên PostgreSQL service Supabase self-host hiện hữu `supabase-db`; profile DDT tiếp tục dùng `ddt_lab`. Không hard-code `ddt_lab` trong code dùng cho PCN.
- [x] Cập nhật deployment contract để app/container PCN tham gia `supabase_default` và resolve `supabase-db:5432`; khi chạy app ngoài Docker, dùng host port mapping hiện có của Supabase qua biến cấu hình, không thay đổi `.env` thực tế trong task này.
- [x] Không thêm service `postgres`, volume database hoặc Supabase stack thứ hai vào compose của PCN; chỉ tham chiếu hạ tầng Supabase self-host dùng chung ở tầng host/service, còn database logic và dữ liệu ứng dụng vẫn độc lập.
- [x] Khởi tạo schema/app document contract độc lập cho PCN; không query fallback sang `ddt_lab` trong runtime.
- [x] Thêm các collection PCN vào document contract: `pcnCertificationFields`, `certificationProposals`, `certificationDossiers`, `labRequests`, `returnedResults`, `issuancePackages`; chỉ thêm `qualityDossiers`/`correspondence` khi sub-plan tương ứng được duyệt.
- [x] Không cần dùng `businessDomain` để trộn hai DB; nếu vẫn lưu metadata namespace thì chỉ dùng cho audit/backup, không thay thế database isolation.
- [x] Giữ `requests`, `handoverDocs`, `kqtnRecords` của DDT nguyên trạng trong database DDT; không có migration tự động từ DDT sang PCN.
- [x] Bảo đảm sync, backup, restore, `deleted*Ids`, activity log và notification xử lý collection PCN đúng cách.
- [x] Bổ sung phiên PCN server-side ký riêng trong cookie HttpOnly; API DB, activity log và file boundary PCN từ chối request không có phiên hợp lệ, không đưa password `systemUsers` về client.
- [x] Kiểm thử load/save/reload chỉ từ database `pcn_certification`; kiểm chứng PCN resolve đúng `supabase-db` qua `supabase_default` và không bị đọc/ghi vào `ddt_lab` khi PCN chạy.

### Task 4: Giữ và làm cứng Danh sách khách hàng

**Files:**
- Preserve and adapt: `components/SystemManagementViews.tsx`
- Modify: `store.ts`
- Modify: `utils/referenceData.ts`
- Test: `test/customer-data-integrity.test.ts`
- Test: `test/customer-search.test.ts`

**Steps:**
- [x] Giữ nguyên layout bảng, tìm kiếm, thêm/sửa/xóa và quyền hiện có của `CustomersManagementView`.
- [x] Bảo toàn đầy đủ `name`, `customerCode`, `address`, `taxId`, `phone`, `email`, `contactPerson`, `createdAt`, `updatedAt` khi add/update/sync; hiện store đang có nguy cơ bỏ rơi một số field liên hệ.
- [x] Tạo job one-time import danh sách khách hàng từ export DDT sang PCN với preview, mapping khóa, đối soát count/hash và báo cáo duplicate; đã preview/apply nguồn được kiểm soát `customers.csv` với 156/156 dòng hợp lệ, không trùng khóa.
- [x] Không cascade delete khách hàng sang Đề nghị, dossier, PYC, KQTN, giao nhận hoặc issuance.
- [x] Mở rộng search/autofill cho tên, mã, địa chỉ, MST, điện thoại và người liên hệ.
- [x] Kiểm thử customer list tồn tại sau reload/restore và hồ sơ vẫn giữ snapshot lịch sử tên khách hàng; API profile PCN hậu kiểm trả 156 khách hàng và dossier mới lưu snapshot độc lập.

### Task 5: PCN tiếp nhận Đề nghị và hồ sơ chứng nhận

**Files:**
- Create: `components/PcnDossierView.tsx`
- Create: `components/PcnDossierCard.tsx`
- Create: `components/PcnCertificationFieldNav.tsx`
- Create or adapt: `components/CertificationDossierModal.tsx`
- Modify: `App.tsx` — thay menu Lịch bằng menu Lĩnh vực.
- Preserve/adapt: `components/RequestModal.tsx` only for outbound PYC/legacy DDT compatibility; không dùng component này làm form Đề nghị PCN.
- Test: `test/pcn-intake-ui.test.ts`
- Test: `test/pcn-dossier-contract.test.ts`

**UI contract:**
- Giữ sidebar/header/mobile bottom navigation, nền `slate`, card trắng, badge màu, compact density, filter/search/pagination, modal và action toolbar.
- Sidebar hiển thị nhóm Lĩnh vực; khởi đầu có `Quy chuẩn 4` và `Quy chuẩn 9`, dùng cùng component list/detail, filter và card. Danh sách lĩnh vực phải mở rộng được từ `PcnCertificationField`.
- Card hiển thị `Mã hồ sơ`, khách hàng, lĩnh vực QCVN, phương thức, chuyên gia phụ trách, hạn xử lý, tiến độ PYC/KQTN và trạng thái phát hành; không lấy ITD/EMC/sample/lịch làm thông tin trung tâm.
- Chi tiết hồ sơ dùng các tab: `Tổng quan`, `Đề nghị & đầu vào`, `PYC/Giao nhận`, `KQTN trả về`, `Phê duyệt & Phát hành`, `Tệp đính kèm`, `Lịch sử`.

**Business rules:**
- Tạo `CertificationProposal` từ các kênh trực tiếp, email, online/Zalo; sau khi tiếp nhận hợp lệ mới mở/liên kết `CertificationDossier`.
- `Đề nghị` là chứng từ PCN nhận từ khách hàng/đơn vị đề nghị; không gọi là PYC và không đi qua flow gửi PTN.
- Required fields: thông tin khách hàng, kho/địa chỉ liên quan, người liên hệ/MST, tên/kiểu/model/nhãn hiệu/thông số/nhà sản xuất/số lượng mẫu.
- Scheme/lĩnh vực lấy theo QCVN; QC4/QC9 là cấu hình khởi đầu; không hard-code danh sách nhân sự.
- SLA hiển thị theo phụ thuộc PTN; không đưa ra một SLA giả định cho toàn bộ hồ sơ.

### Task 6: Điều phối nhiều PTN, giao nhận và KQTN trả về

**Files:**
- Create: `components/PcnLabRequestView.tsx`
- Create: `utils/pcnLabRouting.ts`
- Adapt/reuse: `components/HandoverModal.tsx`, `components/HandoverDocsModal.tsx`, `components/SelectSampleModal.tsx`
- Adapt/reuse: `components/KQTNView.tsx`
- Modify: `App.tsx`, `store.ts`
- Test: `test/pcn-lab-routing.test.ts`
- Test: `test/pcn-result-return.test.ts`

**Steps:**
- [x] Tạo `OutboundLabRequest` và hiển thị nhãn `PYC gửi PTN`; ghi nhận sampling/handover event, ngày giao, PTN nhận, chỉ tiêu/tiêu chuẩn, dependency và trạng thái trả KQ.
- [x] Đưa các PYC vào hàng đợi của Lĩnh vực tương ứng; dùng trạng thái và hạn xử lý để theo dõi, không tạo calendar view hoặc auto-schedule.
- [x] Hỗ trợ một hồ sơ gửi nhiều PTN; thứ tự/điều kiện tháo mẫu là cấu hình theo scheme, không suy diễn thành luật chung.
- [x] Tạo lô và cập nhật tuyến mẫu đi qua endpoint transaction chuyên biệt; server khóa hồ sơ/lô/tuyến, kiểm tra retry idempotent, đồng bộ snapshot, flow event và audit trong cùng transaction.
- [x] Tạo/cập nhật PYC đi qua endpoint transaction chuyên biệt; PYC có thể gắn đúng lô/tuyến mẫu, đồng bộ trạng thái PYC ↔ tuyến và backlink hồ sơ, không còn ghi `labRequests` qua CRUD chung.
- [x] QC9/QC4: ghi nhận mẫu sai, lý do, người chịu trách nhiệm, yêu cầu bổ sung/đổi mẫu và vòng test lại.
- [x] Link KQTN của PTN vào dossier; `returnedResult` là input cho PCN review, không biến thành output cuối.
- [x] Kết quả không đạt tạo thông báo văn bản/issue; round 2 được đánh dấu official theo policy, không xóa lịch sử round 1.

### Task 7: Soát xét, phê duyệt và phát hành

**Files:**
- Create: `components/PcnIssuanceView.tsx`
- Create: `components/PcnApprovalModal.tsx`
- Create: `utils/pcnIssuance.ts`
- Modify: `server.ts` cho file/document endpoint PCN, giữ nguyên KQTN PDF endpoint
- Modify: `components/ReportGeneratorView.tsx` chỉ khi reuse được renderer mà không làm đổi flow báo cáo lab
- Test: `test/pcn-issuance.test.ts`
- Test: `test/pcn-approval.test.ts`

**Steps:**
- [x] Hỗ trợ template BM-QT-03-02a/b/c cho GCN và BM-QĐ-03-01a/b/c cho Quyết định tương ứng phương thức 1/5/7.
- [x] Quản lý chain: lãnh đạo/điều phối → chuyên gia đánh giá/kỹ thuật → chuyên gia thẩm xét → người có thẩm quyền cuối; actual user mapping để sau.
- [x] Cho phép trả hồ sơ về đúng chuyên gia đánh giá khi bị yêu cầu sửa; lưu lý do và diff trong activity log.
- [x] Quản lý số phát hành, ngày phát hành, người ký, trạng thái ký tay/đóng dấu, gửi khách và file GCN/QĐ/chứng thư/phụ lục.
- [x] Tách file boundary PCN qua `POST/GET /api/pcn/files`, lưu object private trên Supabase Storage và chỉ lưu pointer/metadata trong `file_assets`.
- [x] Cho phép gắn file báo cáo KQTN trả về qua cùng file boundary, liên kết bằng `ReturnedTestResult.fileAssetId`.
- [x] Hỗ trợ ủy quyền khi người ký vắng mặt nhưng không tự ý chọn người ngoài danh mục quyền hạn; Admin tạo/thu hồi ủy quyền qua endpoint riêng, UI chỉ chọn người trong danh mục và server tái kiểm tra khi cấp số.
- [x] Backup/restore theo profile, gồm metadata file và pointer; PCN dùng prefix/list/restore riêng và không nhúng byte file vào JSONB.

### Task 8: Dashboard, archive và QA/accreditation

**Files:**
- Modify: `App.tsx`
- Create: `components/PcnDashboardView.tsx`
- Create: `components/PcnArchiveView.tsx`
- Create: `utils/pcnReporting.ts`
- Modify: `components/SummaryLogView.tsx`/`components/ActivityLogView.tsx` chỉ để thêm destination/filter PCN, không phá contract hiện tại
- Test: `test/pcn-dashboard.test.ts`
- Test: `test/pcn-archive.test.ts`

**Steps:**
- [x] Dashboard dùng các card/KPI hiện có để hiển thị tổng hồ sơ, chờ tài liệu, chờ PTN, chờ KQ, corrective action, chờ ký, đã phát hành, quá hạn.
- [x] Dashboard có bộ lọc/chuyển nhanh theo Lĩnh vực (`QC4`, `QC9`); không có KPI lịch thử hoặc phân bổ lịch.
- [x] Timeline hồ sơ liên kết intake → assignment → lab → review → approval → issuance → archive.
- [x] Archive/search theo hồ sơ, khách hàng, QCVN, số phát hành, năm và loại tài liệu.
- [x] Gắn retention policy tham chiếu: bản cứng 1 năm, bản mềm 10 năm tính từ ngày `ARCHIVED`, hiển thị mốc rà soát và hỗ trợ `legal hold`; không tự động xóa dữ liệu, chưa coi đây là quyết định pháp lý cuối cùng.
- [x] QA/accreditation (`VICAS`, `VIAS`, `ISO`, hồ sơ xin chỉ định) là module sổ tài liệu riêng, không trộn vào KQTN; Admin quản lý metadata/file private, staff/viewer chỉ đọc và cảnh báo hạn chỉ mang tính rà soát.
- [x] Gói tải hồ sơ PCN đọc toàn bộ pointer thuộc đúng dossier, kiểm tra provenance/checksum và xuất ZIP có `manifest.json`; không nhận asset tùy ý, không ghi audit và không đưa dữ liệu DDT vào gói.

### Task 9: Tích hợp Haimy và tự động hóa tạo biểu mẫu

**Files:**
- Create: `utils/pcnIntegration.ts`
- Create: `utils/pcnDocumentGeneration.ts`
- Create: `utils/pcnTemplateCatalog.ts`, `utils/pcnTemplateDiscovery.ts`, `utils/pcnTemplateImport.ts`, `utils/pcnTemplateReview.ts`, `utils/pcnOfficialTemplateGeneration.ts`, `utils/pcnOfficialDocumentPolicy.ts`, `utils/pcnPdfRenderer.ts`, `utils/pcnTemplateApi.ts`, `scripts/discoverPcnTemplate.ts`, `scripts/importPcnTemplate.ts`
- Create: `components/PcnTemplateManagementView.tsx`, `utils/pcnOfficialDocumentApi.ts`, `test/pcn-template-catalog.test.ts`, `test/pcn-template-discovery.test.ts`, `test/pcn-template-import.test.ts`, `test/pcn-template-review.test.ts`, `test/pcn-pdf-renderer.test.ts`, `test/pcn-official-template-generation.test.ts`, `test/pcn-official-document-policy.test.ts`
- Create: `utils/pcnHaimyPromotion.ts`, `test/pcn-haimy-promotion.test.ts`
- Modify: `server.ts` chỉ sau khi có API/schema/credential contract
- Create: `test/pcn-integration-contract.test.ts`

**Steps:**
- [x] Thực hiện discovery spike trước: xác định Haimy có API/import/export nào, định danh chung nào, cơ chế retry/idempotency nào. Workspace và bộ hồ sơ PCN chưa cung cấp contract/API/credential Haimy; capability report ghi nhận trạng thái `UNCONFIGURED` và không có kết nối upstream.
- [x] Thiết kế adapter một lần nhập cho đơn đăng ký → mã hóa/lô hàng → GCN/QĐ/biểu mẫu; chỉ tạo staging import có khóa idempotency, phát hiện duplicate/conflict và không ghi trực tiếp vào hệ thống bên ngoài khi chưa có contract.
- [x] Tách template PCN khỏi template DDT; catalog riêng đã khảo sát mẫu QC4/QC9, fingerprint bằng SHA-256 và không giữ đường dẫn Desktop/`dist` làm dependency runtime.
- [x] Có lệnh discovery dry-run cho mẫu DOCX/DOC: đọc placeholder kể cả khi bị tách qua Word XML runs, cảnh báo `.doc`/mẫu không có placeholder và không tự ghi file.
- [x] Có import template PCN theo fingerprint, private Storage pointer, dry-run mặc định và cờ `--apply --approve` tách biệt; mẫu DOC/DOCX chưa đủ placeholder chỉ được lưu tham chiếu bằng `--allow-annotation`; merge cùng SHA không làm thay đổi lần duyệt trước.
- [x] Có module catalog/readiness riêng trong sidebar; Admin PCN review `APPROVE`/`REQUEST_ANNOTATION`/`RETIRE` qua API có kiểm tra asset private và audit, người dùng thường chỉ xem.
- [x] Có route/UI sinh DOCX chính thức theo `issuanceId`, template đã duyệt và `contextHash` ổn định; PDF đi qua capability renderer cấu hình được, kiểm tra output và vẫn báo Chưa sẵn sàng nếu môi trường thiếu renderer.
- [x] Boundary render chính thức kiểm tra lại bucket/MIME và fingerprint byte DOCX của template, đối chiếu byte size/SHA-256 object khi retry idempotent và ghi audit đúng tập định dạng DOCX/PDF đã yêu cầu; catalog và panel sinh hồ sơ dùng cùng readiness gate yêu cầu asset private đã được xác minh.
- [x] Bổ sung tài liệu quản lý `LAB_REQUEST`: chọn PYC đã lưu thuộc đúng hồ sơ, lấy liền mạch dữ liệu lô/tuyến liên kết, preflight read-only, sinh Word/PDF nội bộ cùng `contextHash`/`sourceUpdatedAt` và giữ lineage riêng theo `labRequestId`; không trộn với GCN/QĐ chính thức.
- [x] Đã nhập 4 asset QC4 và 5 asset QC9 từ bộ PCN tham chiếu vào private Storage/catalog ở `DISCOVERED` hoặc `NEEDS_ANNOTATION`; một asset BM-02-32 TĐC có fingerprint cũ khác nguồn hiện tại nên được giữ nguyên để rà soát integrity, chưa tự phê duyệt asset pháp lý.
- [x] Có boundary UI/API import staging Haimy: đọc JSON/CSV/XLSX do người vận hành chọn, lưu `pcnHaimyStaging` theo fingerprint/idempotency, giữ conflict/thiếu trường để rà soát và không ghi ngược upstream hay tạo dữ liệu pháp lý.
- [x] Có thể xuất snapshot staging Haimy sau bộ lọc thành CSV an toàn ngay trên trình duyệt; chỉ gồm trường chuẩn hóa, trạng thái, lỗi/conflict và fingerprint, không có raw payload/credential/đường dẫn máy.
- [x] Có bước duyệt tường minh một staging `READY_FOR_REVIEW` thành đúng một Đề nghị + hồ sơ PCN + checklist trong transaction, yêu cầu bổ sung đủ intake, ghi metadata truy vết Haimy, retry cùng fingerprint idempotent và không tạo lô/PYC/KQTN/GCN/QĐ.
- [x] Chi tiết hồ sơ hiển thị read-only nhãn nguồn Haimy và các định danh ngoài để đối chiếu trước khi xử lý tiếp.
- [ ] Phê duyệt các asset template chính thức sau khi người có thẩm quyền xác nhận bản mẫu và mapping.
- [x] Kiểm thử retry/duplicate trong phạm vi staging, thiếu field và chặn upstream; lỗi upstream thực tế chưa áp dụng vì chưa có contract.

### Task 10: Migration và cutover an toàn

**Files:**
- Create: `scripts/migratePcnCatalog.ts` nếu cần migration thực tế
- Create: `scripts/verifyPcnCutover.ts`
- Test: `test/pcn-migration.test.ts`

**Steps:**
- [ ] Backup database `ddt_lab` và Storage trước khi cutover; khởi tạo backup/restore riêng cho database `pcn_certification` trên Supabase self-host trước khi import dữ liệu. Hiện đã có archive DDT `ddt_lab_auto_20260828-191659.zip` và archive PCN mới nhất được kiểm chứng `VALID`, nhưng các mốc này chưa đủ bằng chứng rằng checkpoint backup PCN đã xảy ra trước lần import customer.
- [x] Có script chỉ migrate/normalize `customers` theo contract; không xóa khách hàng, không đổi khóa khách hàng nếu chưa có mapping.
- [x] Cổng `--apply` của job customer yêu cầu archive PCN ZIP đầy đủ, đã tồn tại trước checkpoint và kiểm chứng lại `VALID` trước transaction; dry-run không bị biến thành mutation.
- [x] Chạy import customer một lần từ nguồn được kiểm soát `customers.csv` sang `pcn_certification`; PCN đọc/ghi customer từ database riêng, không tạo live query/cross-database dependency về DDT. Phần cutover production và đối soát export cuối vẫn chờ nghiệm thu.
- [x] Không đưa DDT records vào database PCN; snapshot cutover kiểm tra riêng danh sách collection DDT bị cấm và runtime hiện trả `ddtCollectionNames=[]`; PCN không có runtime dependency/cross-database bridge tới DDT.
- [x] Có lệnh kiểm chứng chỉ đọc `npm run verify:pcn-cutover`: đối soát profile/database, allowlist collection, QC4/QC9, số lượng/hash khách hàng (khi truyền `--input`), trigger activity log append-only và bảng `file_assets`.
- [x] Có script `npm run reconcile:pcn-legacy` dry-run mặc định để nhận diện collection legacy trùng canonical; chỉ `--apply` sau khi đối chiếu byte dữ liệu và ghi audit mới được dọn.
- [x] Có lệnh kiểm kê nguồn hồ sơ lịch sử read-only theo các scan root QC4/QC9 allowlist, không hash/upload/ghi DB và không watcher Desktop.
- [x] Import hồ sơ lịch sử hỗ trợ chọn một hoặc nhiều candidate theo `FIELD:BUSINESS_CODE`, từ chối candidate thiếu/trùng, nhận `batchId` ổn định và giữ dry-run mặc định; đã kiểm thử thực tế với QC4 `0665` và QC9 `0105-01`.
- [ ] Hoàn tất nghiệm thu đối soát count/hash khách hàng, hồ sơ PCN, file pointer, notification và activity log. Lần kiểm chứng read-only mới nhất trên DB thật ghi nhận 155 khách hàng, 10 Đề nghị/10 hồ sơ, 637 file pointer, 0 notification, 206 activity log, không có link/pointer/namespace lỗi; `pcnSchemeBranches` không còn xuất hiện trong allowlist runtime. Nguồn `customers.csv` có 156 dòng hợp lệ, đối soát khóa còn thiếu duy nhất `ttp`, không có khóa đích thừa và không có khác biệt trường trên khóa giao nhau; chưa tự sửa dữ liệu.
- [ ] Chỉ bật profile PCN sau khi smoke test login, customer search, tạo dossier, gửi PTN, nhận KQ, issuance, backup/restore thành công.

### Task 11: Verification gate trước khi nghiệm thu

**Files:**
- Existing test suite under `test/`
- `package.json`
- `design.md`

**Commands:**
- [x] `npm test -- "test/pcn-*.test.ts" --test-reporter=dot` — 515/515 test pass với preload native, gồm auth/RBAC, hồ sơ, mẫu/PYC/KQTN, phát hành, DOCX/PDF, archive, backup, PWA, cutover, Haimy staging/promotion, runtime smoke và gói tải hồ sơ có manifest.
- [x] `npm test` — 875/875 test pass. Các audit/test DDT legacy dùng fallback có kiểm soát sang asset đã build trong `dist/` khi bản tham chiếu không còn ở `public/`; không đưa asset DDT trở lại runtime PCN.
- [x] `npm run lint`
- [x] `npm run build`
- [x] `git diff --check`
- [x] Nếu backend đã đổi: khởi động server native trên cổng 1357 và kiểm thử smoke login, file private, API backup Admin-only và route chú thích DOCX từ chối mapping không tồn tại an toàn.
- [x] Bổ sung và chạy `npm run smoke:pcn-runtime`: kiểm tra health, session boundary, profile/database PCN, danh mục chính, dossier thật, preflight tài liệu read-only và archive PCN mới nhất; runner tự khóa `APP_PROFILE=pcn`, chỉ cảnh báo `cutover.ok=false` hiện hữu, không gọi mutation nghiệp vụ và không in credential/payload.
- [ ] Chạy `npm run verify:pcn-cutover -- --input=customers.csv` đạt hoàn toàn trên DB PCN thật: lần chạy hiện tại còn thiếu khóa nguồn `ttp` và hash khách hàng chưa trùng nguồn; các collection ngoài allowlist, khóa đích thừa, khác biệt trường và pointer lỗi đều đã về 0. Chưa tự xóa collection hoặc ghi đè danh mục.
- [x] Kiểm thử thủ công màn hình login PCN ở desktop và các viewport 320/375/390/430px; DOM đo được `document/body scrollWidth` đúng bằng viewport, không tràn ngang và không còn tùy chọn lưu mật khẩu PCN.
- [x] Kiểm tra working tree trước khi bàn giao để không ghi đè các thay đổi hiện có của người dùng; worktree đang có nhiều thay đổi PCN/DDT sẵn có và đã được giữ nguyên, không reset/clean.

**Latest cutover read-only status:** Cổng kiểm chứng ngày 2026-08-30 đã đối chiếu được khóa khách hàng theo đúng policy migration: DB có 155 dòng, nguồn có 156 dòng hợp lệ; thiếu duy nhất `ttp`, không có khóa đích thừa, không khác trường trên khóa giao nhau và không có collection ngoài allowlist. Backup PCN mới nhất `pcn_certification_auto_20260830-034442.zip` đạt `VALID` với 637/637 object; hồ sơ, pointer, notification và activity log không có liên kết lỗi. Chưa tự khôi phục/xóa dữ liệu; bước nghiệm thu còn lại là quyết định bổ sung/đối soát dòng `ttp` và xác nhận thứ tự checkpoint trước import.

**Latest implementation increment:** Hàng đợi công việc đánh giá `targetDate` theo ngày lịch Việt Nam GMT+7 và chỉ gán `assigneeUsername` từ trường phân công phù hợp với bước hiện tại; các bước chỉ có nhóm/phòng ban sẽ hiển thị chưa phân công cá nhân, không rơi nhầm vào `Việc của tôi`. Catalog và panel sinh hồ sơ chính thức dùng cùng readiness gate, yêu cầu asset private đã được server xác minh trước khi hiển thị template là sẵn sàng. Luồng sinh tài liệu quản lý `LAB_REQUEST` hiện chọn PYC thuộc hồ sơ, khóa context với lô/tuyến, tạo đồng thời DOCX/PDF và lọc lineage theo PYC. Catalog QC9 bổ sung candidate DOCX `BM-02-32 Mẫu yêu cầu CNSP PT1` đúng loại Đề nghị chứng nhận, giữ `NEEDS_ANNOTATION` và không nhầm với PYC outbound. Danh sách PYC nay hiển thị lineage Word/PDF theo đúng hồ sơ/PYC và có shortcut mở hồ sơ để sinh lại, không tạo mutation riêng. Panel hồ sơ bổ sung `PROPOSAL_FORM`, sinh bản Đề nghị chứng nhận đầy đủ Word/PDF từ cùng context gồm đơn vị, sản phẩm, checklist, tệp provenance, yêu cầu và vùng ký; loại này chỉ là bản nháp nội bộ và không đi vào luồng GCN/QĐ. Preflight nay hiển thị thêm snapshot nguồn chỉ đọc của mã Đề nghị, mã hồ sơ, khách hàng, sản phẩm, phương thức/lĩnh vực, checklist và số tệp đính kèm để kiểm tra trước khi sinh. Panel hồ sơ nay bổ sung `EVALUATION_REPORT`, sinh báo cáo đánh giá nội bộ Word/PDF từ cùng context với phân công người đánh giá/người rà soát, hạn xử lý, ngày đánh giá, checklist, tệp provenance và cảnh báo rà soát; loại này không đi vào luồng GCN/QĐ. Discovery lịch sử nay trả thêm bản đồ độ phủ read-only của 32 nhánh vận hành biểu mẫu, bản scan GCN, đánh giá, công văn, tiêu chuẩn, giấy phép/chỉ định, bằng chứng hình ảnh, báo cáo/KQTN, PYC, giao nhận, thương mại, khắc phục và hồ sơ lưu theo đúng cấu trúc Desktop PCN; lần chạy nguồn thật ghi nhận 1.780 candidate, 226 thư mục cần rà soát và 32/32 nhánh tham chiếu tồn tại. `sourceRoot` tuyệt đối chỉ được dùng transient trong server/client state và không echo qua discovery/dry-run HTTP, metadata hoặc audit. Gói tải hồ sơ nay giữ thêm lineage `kind`/`format`/`contextHash`/`sourceUpdatedAt` cho tài liệu sinh nội bộ và tài liệu chính thức trong `manifest.json`, giúp đối chiếu bản Word/PDF với đúng snapshot nguồn khi lưu trữ hoặc bàn giao. Lớp migration danh mục khách hàng nay tái sử dụng parser, chuẩn hóa và đối soát canonical của UI/cutover; chỉ giữ policy import/merge riêng để tránh lệch khóa và trường giữa các bề mặt. Các lệnh bảo trì PCN dùng runner chung tự khóa profile `pcn`, kế thừa mã thoát và loại bỏ nhu cầu ghép biến môi trường thủ công trên Windows. Hàng đợi nay được thu gọn thành projection ưu tiên, bỏ phần lặp chi tiết của card Kanban nhưng vẫn giữ mã hồ sơ, việc tiếp theo, hạn, mức hoàn thiện, thiếu tài liệu và đường dẫn mở hồ sơ/module. Dashboard nay dùng cùng hàm mở hồ sơ theo trạm với Kanban, Hàng đợi và các shortcut nghiệp vụ; tab mở mặc định vẫn suy ra từ trạng thái và hồ sơ lịch sử, nhưng shortcut có chỉ định vùng đích vẫn được ưu tiên mà không tạo logic ánh xạ lặp. Đối soát danh mục khách hàng nay tách các ứng viên alias viết tắt duy nhất (như `ttp`) thành cảnh báo read-only, hiển thị ở cả Danh sách khách hàng và màn hình cutover/CLI mà không tự merge hoặc làm mất tín hiệu khóa thiếu. Verifier cutover nay có cờ `requireCustomerImportCheckpoint` riêng: màn hình cutover và CLI có `--input` sẽ báo chưa đạt khi thiếu tuple checkpoint trước import, đồng thời kiểm tra thứ tự thời gian và fingerprint mà không ảnh hưởng kiểm tra backup tổng quát.

**Increment backup checkpoint:** Module Sao lưu PCN nay gọi archive thủ công là `Tạo checkpoint trước import`, tự kiểm chứng archive vừa tạo và chỉ dùng cùng endpoint/kho backup hiện hành; checkpoint này không được suy diễn thành bằng chứng của lần import cũ cho tới khi audit import ghi tuple tham chiếu.

**Increment cutover report safety:** Báo cáo CLI cutover nay dùng projection read-only loại `sizeBytes` khỏi các phần kiểm chứng archive, trong khi snapshot đầy đủ vẫn giữ nguyên ở server/UI để phục vụ kiểm tra trạng thái.

**Increment customer import Admin UI:** Màn hình Đối soát cutover nay có luồng chọn CSV/JSON → rà soát cục bộ → preview server-side → xem count/hash/duplicate/alias → xác nhận đúng `KHOI_TAO_DANH_MUC_PCN` để apply. API kiểm tra lại quyền Admin, fingerprint nguồn/đích, checkpoint archive PCN trước import và transaction; retry không tạo audit/customer trùng, alias không tự merge. CLI và API dùng chung `pcnCustomerImportService`, preview dùng cùng policy merge bảo toàn ô liên hệ không trống, và smoke runtime có kiểm tra preview read-only. Chưa chạy apply dữ liệu thật trong increment này. Alias UI nay yêu cầu chọn rõ `Giữ khóa nguồn` hoặc `Map vào khóa đích`; service/API/CLI cùng validate candidate và trả xung đột khi preview stale hoặc thiếu quyết định. CLI hỗ trợ `--keep-alias=<sourceKey>` và `--map-alias=<sourceKey>=<targetKey>`; chưa chạy apply thật. Preview không lặp lại nội dung alias; khu vực quyết định là projection duy nhất.

## Điểm nghiệm thu theo giai đoạn

- **MVP-1:** PCN Đề nghị + Lĩnh vực 4/9 + customer list + dossier list/detail + lifecycle/audit.
- **MVP-2:** PYC nhiều PTN + giao nhận + KQTN trả về + corrective action.
- **MVP-3:** Soát xét/phê duyệt + GCN/QĐ phương thức 1/5/7 + file/retention.
- **MVP-4:** Archive/QA + báo cáo + Haimy adapter + cutover.

## Quyết định cần xác nhận trước khi bắt đầu code

1. Dữ liệu DDT cũ trong app PCN sẽ được ẩn hoàn toàn, hay có mục `Dữ liệu cũ / chỉ đọc`.
2. Danh mục Lĩnh vực ban đầu ngoài `QC4` và `QC9`, tên hiển thị, mã lĩnh vực và tiêu chuẩn áp dụng.
3. Tên mã hồ sơ/số phát hành PCN và quy tắc sinh mã chính thức.
4. Có dùng lại bucket `ddt-files` cho tài liệu PCN hay mở namespace/bucket riêng.
5. Template gốc của GCN/QĐ phương thức 1/5/7 và danh sách field chính thức.
6. API hoặc quy trình trao đổi dữ liệu với Haimy.
7. Xác nhận tên database logic PCN (mặc định `pcn_certification`) và credential/runtime profile trên Supabase self-host Docker Desktop; service PostgreSQL mặc định là `supabase-db` trong `supabase_default`.
8. Danh sách người dùng, vai trò, chuyên gia đánh giá, chuyên gia thẩm xét và người ký sẽ được cung cấp ở phase nào.
