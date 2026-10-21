# BÁO CÁO TOÀN DIỆN R2.2: RÀ SOÁT & ĐỐI CHIẾU HỢP ĐỒNG API, SERVER IMPLEMENTATION, ACTIVE PROFILES & SECURITY/RBAC

- **Dự án**: PGDCN Web App (Phòng Giám định - Chứng nhận và Phát triển thị trường / TVCI - IEMM)
- **Chuyên trách**: Explorer R2.2 (`explorer_api_contracts`)
- **Tài liệu chuẩn Single Source of Truth**: `design.md`
- **Thời điểm rà soát**: 2026-09-30
- **Trạng thái kiểm thử hệ thống**: 934/934 tests PASS (100%)

---

## 1. TỔNG QUAN KẾT QUẢ RÀ SOÁT

Quá trình điều tra và rà soát kỹ thuật chuyên sâu đối với mã nguồn backend (`server.ts`, `lib/server/*`, `utils/pcnRbac.ts`, `utils/pgdDomain.ts`, `sql/pcn-schema.sql`, `app/api/*`) đối chiếu với các mục 0, 0A, 7 và 10 của tài liệu đặc tả chuẩn `design.md` ghi nhận các kết luận then chốt sau:

1. **Active Profile & Hạ tầng Runtime**:
   - Mã nguồn tuân thủ tuyệt đối cấu hình `APP_PROFILE=pcn`, logical database `pcn_certification`, Storage bucket private `pcn-files`.
   - Cổng mạng vận hành chính xác: Native dev cổng `1357` (kết nối PostgreSQL loopback `15432`), Production Docker cổng `2357` (kết nối `supabase-db:5432` trên network `supabase_default`).
   - Ranh giới lĩnh vực được thực thi nghiêm ngặt: PCN chỉ tiếp nhận `QC4` và `QC9`; `QC20` hoàn toàn bị loại khỏi PCN catalog/workflow và được quản lý độc lập tại phân hệ PGD với profile routing `GĐ-THEP-KG`.

2. **Kiến trúc Server Kép (Dual Gateway Architecture)**:
   - `server.ts` (Express) hiện đang là **Gateway API thực tế duy nhất đang xử lý toàn bộ lưu lượng `/api/*`** với tổng cộng **174 endpoints** (85 PCN, 44 PGD, 45 endpoints dùng chung/auth/db/backup).
   - Thư mục `app/api/` (Next.js App Router) chứa 106 route files từ một đợt di chuyển (migration `fed636d`) chưa hoàn tất: chỉ mới chuyển các route PCN và workflow template, trong khi **hơn 30 routes PGD cốt lõi** (requests, assignments, field-inspections, samples, lab-requests, results, reports, certificates, approvals, drafts, package) và toàn bộ routes **Backup** chưa được chuyển sang App Router.
   - Tại dòng 18905 của `server.ts`, Express áp dụng middleware chặn toàn bộ `/api/*` để Express xử lý, ngăn không cho request lọt xuống Next.js App Router handler (`if (req.path.startsWith('/api/')) { nextMiddleware(); return; } nextHandler(req, res);`). Do đó, hệ thống đang vận hành ổn định qua Express, nhưng tồn tại sự trùng lặp code lớn giữa `server.ts` và `app/api/*`.

3. **Bảo mật & Ma trận Phân quyền (Security & RBAC Matrix)**:
   - Mô hình phân quyền đa trục được triển khai hoàn chỉnh: `systemRole` (`admin`, `staff`, `viewer`), `managementRoleCode` (Director/Deputy Director/Head/Deputy), `professionalRoleCodes[]` (Inspection/Certification/Clerk), `departmentScopes` (`['PCN']`, `['PGD']` hoặc cả hai), cùng adapter legacy (`departmentRoleCode`, `pgdRole`).
   - Phân tách ranh giới PCN vs PGD tuyệt đối ở tầng middleware: `/api/pcn/*` và `/api/db/*` bắt buộc có scope `PCN`; `/api/pgd/*` bắt buộc có scope `PGD`; `/api/activity-logs/*` yêu cầu ít nhất một scope hợp lệ.
   - Nguyên tắc Zero Cascade Deletion (mục 7.5) được đảm bảo triệt để: API xóa nhân sự `DELETE /api/pcn/users/:id` kiểm tra toàn bộ tham chiếu nghiệp vụ (`findPcnUserReferences`) và từ chối `409 Conflict` nếu còn liên kết.
   - Quyền xóa hồ sơ vĩnh viễn (hard-delete) chỉ cho phép Admin/Quản lý toàn hệ thống, bắt buộc nhập lý do và mã xác nhận khớp chính xác với mã hồ sơ; từ chối `409` đối với hồ sơ đã thực thi hoặc phê duyệt/phát hành.
   - Cách ly API Key Gemini: Khi chạy profile PCN, server bắt buộc dùng credential cá nhân mã hóa trong DB (`userPreferences`), từ chối triệt để key môi trường hệ thống.

4. **Độ lệch và Thiếu sót phát hiện**:
   - **Thiếu trong code**: Endpoint `GET /api/pcn/cutover-status` quy định tại mục 10 (dòng 1353) không tồn tại trong mã nguồn.
   - **Thiếu trong spec**: Endpoint tiếp nhận và khởi tạo hồ sơ PCN `POST /api/pcn/intake` đã được code hoàn thiện (dòng 9113 `server.ts`) phục vụ nghiệp vụ mục 0.4 nhưng chưa được bổ sung vào danh mục hợp đồng REST API mục 7.3; Endpoint tra cứu tiêu chuẩn `GET /api/tieuchuan` (dòng 16940) chưa có trong tài liệu thiết kế.
   - **Lệch HTTP Method**: Thao tác xóa thông báo PGDCN dùng `DELETE /api/pgdcn/notifications/clear` thay vì `POST` như mô tả chung ở mục 7.3 (dòng 1220).
   - **Bảo mật endpoint DDT cũ**: Các endpoint DDT legacy còn lại trong `server.ts` (`/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation`, `/api/kqtn/*`) chưa được bọc middleware kiểm tra session PGDCN chung.

---

## 2. MA TRẬN ĐỐI CHIẾU CHI TIẾT (DISCREPANCY MATRIX)

| # | Mục/Dòng `design.md` | File / Endpoint / Hàm / Dòng mã nguồn | Đặc tả quy định | Hiện trạng mã nguồn | Đánh giá | Đề xuất giải pháp |
|---|----------------------|---------------------------------------|-----------------|---------------------|----------|-------------------|
| **1** | **Mục 0.3 (Dòng 171-175, 1246)** | `server.ts:354, 2869`, `utils/pcnDatabase.ts:18-33`, `scripts/native-dev-env.cjs:55` | Profile active `APP_PROFILE=pcn`, DB `pcn_certification`, Dev port `1357` (PG 15432), Prod port `2357` (PG 5432). | `DATABASE_PROFILE = 'pcn'`, PORT tính theo env/prod/dev (1357/2357), resolve đúng port PG loopback. | **Khớp (Match)** | Giữ nguyên. |
| **2** | **Mục 0.1, 0.1.1 (Dòng 69-78)** | `types.ts:10`, `sql/pcn-schema.sql:171, 474`, `server.ts:8514` | PCN chỉ có Lĩnh vực `QC4` và `QC9`. `QC20` cấm xuất hiện trong PCN catalog/workflow/dossier; thuộc PGD profile `GĐ-THEP-KG`. | `PcnCertificationFieldCode = 'QC4' \| 'QC9'`, schema seed QC4/QC9 cho PCN và `STEEL_LOT_INSPECTION` (QC20) cho PGD. | **Khớp (Match)** | Giữ nguyên. |
| **3** | **Mục 0.3 (Dòng 167), Mục 7.3** | `server.ts:18905-18911`, `app/api/*` | Ứng dụng chạy trên Next.js App Router, Express làm API gateway cho REST API. | `server.ts` chặn toàn bộ `/api/*` để Express xử lý 174 routes. Thư mục `app/api/` có 106 routes nhưng thiếu >30 routes PGD cốt lõi & backups. | **Lệch cấu trúc (Architectural Drift)** | Cập nhật `design.md` ghi nhận rõ: Trong giai đoạn hiện tại, `server.ts` (Express) là cổng API chính thức duy nhất, Next.js App Router đảm nhiệm giao diện Frontend. Kế hoạch chuyển đổi hoàn toàn sang `app/api/` cần bổ sung đầy đủ route PGD trước khi gỡ Express. |
| **4** | **Mục 0.4 (Dòng 243-245), Mục 7.3** | `server.ts:9113-9360`, `lib/server/pcn-dossiers.ts` | Tiếp nhận Đề nghị tạo đồng thời đúng 1 CertificationDossier và checklist tài liệu ban đầu trong 1 transaction. | Hiện thực qua route `POST /api/pcn/intake`. Kiểm tra đầy đủ bắt buộc, lock Đề nghị & hồ sơ, tạo transaction. | **Thiếu trong spec (Spec Omission)** | Bổ sung endpoint `POST /api/pcn/intake` vào bảng Hợp đồng REST API tại mục 7.3 của `design.md`. |
| **5** | **Mục 0.4 (Dòng 246)** | `server.ts:9362-9596` | Sửa thông tin đầu vào Đề nghị qua `POST /api/pcn/proposals/:proposalId` với whitelist trường tiếp nhận, chỉ cho sửa khi `INTAKE_REVIEW` hoặc `AWAITING_DOCUMENTS`. | Route `POST /api/pcn/proposals/:proposalId` kiểm tra whitelist 11 trường, lock dossier & proposal, check status gate, audit log. | **Khớp (Match)** | Giữ nguyên. |
| **6** | **Mục 0.4 (Dòng 247-248)** | `server.ts:9597-10031` | Cập nhật metadata/trạng thái hồ sơ qua `POST /api/pcn/dossiers/:dossierId`, kiểm tra whitelist trường, idempotencyKey, policy chuyển trạng thái. | `POST /api/pcn/dossiers/:dossierId` whitelist 11 trường (`status`, `method`, `ownerUsername`, `evaluatorUsername`, `reviewerUsername`, `targetDate`, `evaluationAt`, `effectiveAt`, `exceptionReason`, `operationalForms`, `documentWaivers`). | **Khớp (Match)** | Giữ nguyên. |
| **7** | **Mục 0.4 (Dòng 248), Mục 7.1 (Dòng 1195)** | `server.ts:10032-10111`, `utils/pcnRbac.ts:98-108` | Admin/Quản lý toàn hệ thống được xóa vĩnh viễn hồ sơ PCN qua `DELETE /api/pcn/dossiers/:dossierId` kèm lý do và mã xác nhận; chỉ mở ở `DRAFT`, `INTAKE_REVIEW`, `AWAITING_DOCUMENTS`, `REJECTED`, `CANCELLED`, `ON_HOLD`. | `DELETE /api/pcn/dossiers/:dossierId` kiểm tra `isPcnSystemManager`, `confirmationCode === dossier.dossierCode`, check status set, xóa transaction dossier + proposal + assets, ghi audit. | **Khớp (Match)** | Giữ nguyên. |
| **8** | **Mục 0.4 (Dòng 251)** | `server.ts:7052, 7120, 7222-7275` | Quản lý khách hàng PCN qua `POST /api/pcn/customers`, `POST /api/pcn/customers/:customerId`, `DELETE /api/pcn/customers/:customerId`. Xóa phải check tham chiếu `app_documents`, nếu còn tham chiếu từ chối `409`. | Các endpoint kiểm tra chuẩn hóa mã, `DELETE` đếm `data->>'customerId' = $1` trong `app_documents`, nếu count > 0 trả về HTTP `409 Conflict`. | **Khớp (Match)** | Giữ nguyên. |
| **9** | **Mục 0.4 (Dòng 256), Mục 7.1 (Dòng 1191)** | `server.ts:6542, 6766, 6797, 6831, 6876`, `utils/pcnRbac.ts:64-68` | `GET /api/pcn/users` bỏ password, trả `managementRoleCode`, `professionalRoleCodes[]`. Thêm/sửa/xóa/reset user qua `POST/PUT/DELETE /api/pcn/users` yêu cầu quyền Admin/Quản lý. | `sanitizePcnUserRow` loại bỏ password. Toàn bộ mutation kiểm tra `requirePcnPersonnelAdmin` (`isPcnPersonnelManager`). `DELETE` kiểm tra `findPcnUserReferences` chặn xóa người dùng đang được gán (HTTP 409). | **Khớp (Match)** | Giữ nguyên. |
| **10** | **Mục 0.4 (Dòng 262-264)** | `server.ts:11407, 11631` | Tạo lô mẫu qua `POST /api/pcn/samples/lots`; cập nhật tuyến qua `POST /api/pcn/samples/routes/:routeId/status`. Cấm ghi qua generic `/api/db`. | Endpoints chuyên biệt với transaction, lock lô/tuyến/hồ sơ, append `pcnSampleFlowEvents`. Dòng 16594, 16671 chặn generic DB cho `pcnSampleFlowEvents` và `pcnSampleLots`. | **Khớp (Match)** | Giữ nguyên. |
| **11** | **Mục 0.9 (Dòng 496-506), Mục 7.3** | `server.ts:10519, 10825, 10862` | PYC tổng quản lý qua `POST /api/pcn/sample-request-bundles`, gửi qua `.../send`, retry qua `.../retry/:dispatchId`. | Cả 3 endpoint được hiện thực đầy đủ, fan-out sang từng PTN, snapshot mapping versioned, lưu aggregate bundle. | **Khớp (Match)** | Giữ nguyên. |
| **12** | **Mục 0.4 (Dòng 265-267), Mục 7.3** | `server.ts:10894, 11099, 5901, 6240` | Tạo/cập nhật PYC PTN qua `POST /api/pcn/lab-requests` và `.../:requestId/status`. Dispatch qua `.../dispatch`, Reconcile qua `.../reconcile`. | Cả 4 endpoint hiện thực đầy đủ với transaction, đồng bộ route snapshot, mapping adapter theo `targetSystemCode`. | **Khớp (Match)** | Giữ nguyên. |
| **13** | **Mục 0.2.1 (Dòng 151-153), Mục 7.3** | `server.ts:2885-3258, 6062` | Webhook inbound `POST /api/pcn/integrations/lab-status-events` xác thực HMAC, sequence, replay window. Outbound dispatch tới `POST /api/integrations/v1/lab-requests`. | Webhook kiểm tra HMAC qua `x-pcn-signature`, timestamp window, sequence. Outbound gọi đúng remote path `/api/integrations/v1/lab-requests`. | **Khớp (Match)** | Giữ nguyên. |
| **14** | **Mục 0.4 (Dòng 270-272)** | `server.ts:10112, 15837` | Tiếp nhận KQTN qua `POST /api/pcn/results`, gắn file qua `POST /api/pcn/results/:resultId/file`. Khóa theo thứ tự lô → tuyến → hồ sơ → PYC. | Hiện thực đúng thứ tự lock, cập nhật `isOfficial`, gán `fileAssetId` trong `file_assets`, chặn ghi Base64 vào JSONB. | **Khớp (Match)** | Giữ nguyên. |
| **15** | **Mục 0.4 (Dòng 274-280)** | `server.ts:7635, 7916, 8085, 8165, 8232, 8359, 12621, 15737` | Vòng đời phát hành: tạo bộ (`/issuance`), duyệt (`/approval/:stepId`), thu hồi (`/withdraw`), cấp số (`/issue`), giao (`/deliver`), lưu trữ (`/archive`), gắn file (`/file`), sinh tài liệu chính thức (`/official-documents/generate`). | Đầy đủ 8 endpoints phát hành với idempotencyKey, kiểm tra điều kiện Lãnh đạo (`LEADERSHIP`), ủy quyền ký (`pcnSignerDelegations`), khóa snapshot. | **Khớp (Match)** | Giữ nguyên. |
| **16** | **Mục 0.4 (Dòng 309-310)** | `server.ts:15493, 15939, 13246` | File asset qua `POST /api/pcn/files`, `GET /api/pcn/files/:assetId`. Gói hồ sơ qua `GET /api/pcn/dossiers/:dossierId/package`. | Đầy đủ kiểm tra provenance, SHA-256, byteSize, export manifest ZIP hợp lệ. | **Khớp (Match)** | Giữ nguyên. |
| **17** | **Mục 0.8, 0.10 (Dòng 475-486, 517-525)** | `server.ts:8681-8880, 13776, 13824, 13866` | Quản trị workflow template PCN (CRUD, revision, publish, retire). Node operations: waive tài liệu, remove-current, generate-and-attach. | Toàn bộ 7 endpoint template và 3 endpoint node operation được hiện thực chặt chẽ, hỗ trợ rework cycle và STALE tracking. | **Khớp (Match)** | Giữ nguyên. |
| **18** | **Mục 0A.2, 0A.5 (Dòng 355-367, 411, 456-457)** | `server.ts:4874, 5024, 5087, 4961, 5142, 4669, 4351` | PGD API chuyên biệt: tạo yêu cầu (`POST /api/pgd/requests`), sửa (`PUT .../:requestId`), gán chủ hồ sơ (`PUT .../owner`), xóa (`DELETE .../:requestId`), transition (`POST .../transition`), gắn doc (`POST .../attach-generated`), package (`GET .../package`). | Triển khai đầy đủ với `requirePgdSession`, `requirePgdDossierManager`, kiểm tra `departmentScopes` PGD, audit log PGD riêng. | **Khớp (Match)** | Giữ nguyên. |
| **19** | **Mục 0A.2 (Dòng 368-370)** | `server.ts:5208, 5270, 5321, 5344, 5367, 5390, 5422, 5450, 5509, 5560, 5616, 5668, 5746, 5807` | Các thực thể chuyên biệt PGD: assignments, field-inspections, inspection-plans, case-events, field-activity-logs, lab-result-reviews, dossier-indexes, samples/split, samples/destroy, lab-requests, lab-results, reports, certificates, approvals. | Tất cả 14 endpoints chuyên biệt của phân hệ PGD đều có mặt trong `server.ts`, ghi vào collection PGD riêng biệt. | **Khớp (Match)** | Giữ nguyên. |
| **20** | **Mục 0A.7, 0.10 (Dòng 437-438, 517)** | `server.ts:3344, 3365, 3500-3670, 4509, 4556, 4746, 4637` | Bản soạn PGD (`/api/pgd/drafts`), Template DOCX PGD (`/api/pgd/document-templates`), Sinh tài liệu PGD (`/api/pgd/documents/generate`), Quản trị workflow PGD (`/api/pgd/workflow-templates`). | Hiện thực đầy đủ với template lineage, kiểm tra context hash, tách biệt hoàn toàn với catalog PCN. | **Khớp (Match)** | Giữ nguyên. |
| **21** | **Mục 0.4 (Dòng 284-286), Mục 7.4 (Dòng 1219-1220)** | `server.ts:15992, 16020, 16040, 16058, 16089, 16117, 16141, 16163` | Thông báo hợp nhất `/api/pgdcn/notifications`, đánh dấu đọc/xóa. Thông báo PCN legacy `/api/pcn/notifications`. | Cả hai nhóm endpoint đều tồn tại. Lưu ý: Clear PGDCN dùng `DELETE /api/pgdcn/notifications/clear`, còn PCN dùng `POST /api/pcn/notifications/clear`. | **Khớp về chức năng, Lệch Method** | Cập nhật `design.md` dòng 1220 ghi rõ `DELETE` cho PGDCN notification clear theo chuẩn RESTful. |
| **22** | **Mục 7.4.1 (Dòng 1270-1281)** | `server.ts:16197, 16266, 16365, 16394`, `utils/pgdcnActivity.ts` | Nhật ký hoạt động cấp phòng hợp nhất PCN + PGD qua `/api/activity-logs` (cursor pagination, GMT+7 periods, domain filter). | `requirePgdcnActivitySessionMiddleware` yêu cầu có ít nhất 1 scope. Projection hợp nhất 2 nguồn, sắp xếp cursor `(domain, createdAt, id)`. | **Khớp (Match)** | Giữ nguyên. |
| **23** | **Mục 7.1, 0A.2 (Dòng 356, 1186, 1478)** | `server.ts:1186-1206, 1478-1494, 3260-3261` | Middleware phân tách phân hệ: `/api/pcn/*` và `/api/db/*` bắt buộc có scope PCN; `/api/pgd/*` bắt buộc có scope PGD; tài khoản 1 miền không truy cập miền kia. | `requirePcnDepartmentSessionMiddleware` áp dụng cho `/api/db`, `/api/pcn`. `requirePgdSession` áp dụng cho `/api/pgd`. System Manager bypass hợp lệ. | **Khớp (Match)** | Giữ nguyên. |
| **24** | **Mục 7.2 (Dòng 1206), Mục 7.3 (Dòng 1239-1243)** | `server.ts:12056, 12097, 14474-14496, 16961` | Gemini AI trong PCN bắt buộc dùng API Key cá nhân lưu mã hóa trong `userPreferences`. Không fallback server key. Kiểm tra model qua `/api/gemini/models`. | `getGeminiClient` ép `personalCredentialRequired = true` khi `DATABASE_PROFILE === 'pcn'`. `GET/PUT /api/pcn/personal-settings` mã hóa ciphertext. | **Khớp (Match)** | Giữ nguyên. |
| **25** | **Mục 7.6 (Dòng 1290-1306)** | `server.ts:16854-16935`, `utils/backupManager.ts`, `server.ts:7313, 7326` | Backup thủ công qua `/api/backups/*`, chỉ Admin (`requireAdmin`), retention 3 archive/2 GiB. Customer import yêu cầu checkpoint archive trước khi apply. | Hiện thực đầy đủ các endpoint backup, verify dump/manifest, xác nhận chuỗi `KHOIPHUC`. Customer import khóa `KHOI_TAO_DANH_MUC_PCN` và yêu cầu backup valid. | **Khớp (Match)** | Giữ nguyên. |
| **26** | **Mục 10 (Dòng 1353)** | Không có trong mã nguồn | Màn hình đối soát cutover PCN: Endpoint read-only `GET /api/pcn/cutover-status`. | **Không tìm thấy** route `/api/pcn/cutover-status` trong `server.ts` lẫn `app/api`. | **Thiếu trong code (Code Missing)** | Đánh giá: Mục 0.3 dòng 169-170 nêu rõ PCN chỉ phục vụ hồ sơ mới, cấm màn hình/endpoint cutover. Cần thống nhất trong `design.md`: Gỡ bỏ dòng 1353 hoặc đánh dấu là [RETIRED] tương tự Mục 12. |
| **27** | **Không có trong `design.md`** | `server.ts:16940-16958` | Không có quy định. | Endpoint `GET /api/tieuchuan` đọc file `public/tieuchuan.xlsx` trả về danh sách chuỗi tiêu chuẩn. | **Thiếu trong spec (Spec Missing)** | Bổ sung quy định endpoint tiện ích tra cứu tiêu chuẩn `GET /api/tieuchuan` vào mục 7.3 của `design.md`. |
| **28** | **Mục 0 (Dòng 51), Mục 7.2** | `server.ts:15112-15443, 17624, 18242, 18868` | DDT là legacy reference; PCN và PGD không dùng code/session DDT. | Các endpoint DDT cũ (`/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation`, `/api/kqtn/*`) vẫn còn trong `server.ts` mà không có middleware auth bảo vệ. | **Lệch bảo mật (Security Gap)** | Bọc middleware xác thực hoặc cách ly các endpoint DDT legacy còn sót lại trong `server.ts`. |

---

## 3. PHÂN TÍCH CHUYÊN SÂU 4 TRỤ CỘT HỆ THỐNG

### Trụ cột 1: Active Profiles & Cấu hình Runtime (Mục 0 & 0A)
- **Cơ chế nhận diện Profile**:
  - `server.ts` dòng 354 cố định hằng số `const DATABASE_PROFILE = 'pcn'`.
  - Hàm `resolveDatabaseConfig(process.env)` trong `utils/pcnDatabase.ts` ưu tiên cờ `APP_PROFILE=pcn` để chọn database `pcn_certification` (hoặc biến môi trường `PCN_POSTGRES_DB`).
  - Toàn bộ scripts chạy kiểm thử, migration và runtime (`scripts/native-dev-pcn.cjs`, `scripts/run-pcn-tsx.cjs`, `scripts/run-pcn-tests.cjs`) đều tự động inject `APP_PROFILE=pcn`.
- **Ranh giới Cổng & Môi trường**:
  - Native Windows Dev: Cổng webapp `PORT=1357`, kết nối PostgreSQL cổng `15432` qua loopback.
  - Production Docker: Cổng webapp `PORT=2357`, kết nối PostgreSQL qua service `supabase-db:5432` trên mạng `supabase_default`.
- **Thực thi phân tách Lĩnh vực**:
  - Phân hệ PCN: Chỉ chấp nhận `QC4` và `QC9` (được seed trong collection `pcnCertificationFields`). Mọi cố gắng thêm `QC20` vào PCN đều bị chặn ở schema và type system (`PcnCertificationFieldCode`).
  - Phân hệ PGD: Quản lý nhóm thép không gỉ `QC20` độc lập với profile routing `GĐ-THEP-KG`, catalog item `STEEL_LOT_INSPECTION`, phương thức `TT58` / `QT-GĐ-14`, hoàn toàn không đi qua bất kỳ pipeline nào của PCN.

### Trụ cột 2: Kiến trúc Server & Hợp đồng API (Server Implementation & API Contracts)
- **Tình trạng Kiến trúc Kép (Dual Gateway Architecture)**:
  - Dự án có sự tồn tại đồng thời của `server.ts` (Express) và thư mục `app/api/` (Next.js App Router).
  - Qua phân tích chi tiết, đợt migration `fed636d` mới chỉ tạo các route handlers cho phân hệ PCN và một số endpoint workflow template, bỏ sót hoàn toàn phân hệ PGD cốt lõi (30+ endpoints) và module Backup.
  - Nhờ cơ chế gateway tại dòng 18905 của `server.ts`:
    ```typescript
    app.use((req, res, nextMiddleware) => {
      if (req.path.startsWith('/api/')) {
        nextMiddleware();
        return;
      }
      nextHandler(req, res);
    });
    ```
    Toàn bộ request `/api/*` đều được Express thụ lý và kết thúc tại các route handler của Express trong `server.ts`. Các file trong `app/api/` thực chất **không được gọi trong luồng runtime hiện tại** (`npm run dev` và `npm start`).
  - **Khuyến nghị**: Không vội vã xóa bỏ `server.ts` vì nó đang là xương sống chứa đầy đủ 174 endpoints hoạt động chuẩn mực (934 tests passing). Nếu muốn hoàn thiện chuyển đổi sang Next.js App Router thuần túy, cần bổ sung đầy đủ route PGD vào `app/api/pgd/` và route backup vào `app/api/backups/`.

### Trụ cột 3: Bảo mật, Xác thực & Ma trận Phân quyền (Security & RBAC Matrix)
- **Xác thực phiên (Session Authentication)**:
  - Phiên làm việc được bảo vệ bởi cookie HttpOnly `pcn_certification_session`, ký bằng HMAC với secret lấy từ `PCN_SESSION_SECRET` / `SUPABASE_SERVICE_ROLE_KEY`.
  - Client không nhận và không lưu password; mật khẩu được băm an toàn ở server.
- **Ma trận vai trò (Role Matrix)**:
  - `systemRole` (`admin`, `staff`, `viewer`): Cấp quyền hệ thống cơ sở. `viewer` bị chặn toàn bộ mutation (`403 Forbidden`).
  - `managementRoleCode` (`CENTER_DIRECTOR`, `CENTER_DEPUTY_DIRECTOR`, `DEPARTMENT_HEAD`, `DEPARTMENT_DEPUTY`, `NONE`): Đại diện cấp bậc quản lý. Cho phép thực hiện các thao tác quản trị nhân sự, phê duyệt, phân công lại chủ hồ sơ và sửa/xóa hồ sơ.
  - `departmentScopes` (`PCN`, `PGD`): Cách ly không gian làm việc. User chỉ có scope PCN sẽ bị `requirePgdSession` từ chối khi truy cập `/api/pgd/*`; ngược lại user chỉ có scope PGD sẽ bị `requirePcnDepartmentSessionMiddleware` từ chối khi truy cập `/api/pcn/*`.
- **Bảo toàn dữ liệu khi quản trị người dùng (Zero Cascade Deletion)**:
  - `DELETE /api/pcn/users/:id` gọi hàm `findPcnUserReferences(client, documentId)` kiểm tra tất cả các bảng/collection nghiệp vụ (`certificationDossiers`, `labRequests`, `handoverDocs`, `pgdInspectionRequests`, ...). Nếu phát hiện người dùng đang được phân công hoặc ký duyệt, trả về ngay HTTP `409 Conflict`, ngăn chặn triệt để tình trạng mồ côi hoặc mất mát lịch sử nghiệp vụ.

### Trụ cột 4: Cơ chế Lưu trữ, Đồng bộ & Sao lưu (Persistence, Multi-Tier Sync & Backup)
- **Lưu trữ PostgreSQL `app_documents`**:
  - Dữ liệu nghiệp vụ được lưu dưới dạng Document JSONB với khóa chính `(collection_name, document_id)`.
  - Database Trigger bảo vệ:
    - `trg_pcn_activity_logs_append_only`: Cấm UPDATE và DELETE trên các collection `activityLogs`, `agentAuditLogs`, `pgdActivityLogs`.
    - `trg_pcn_activity_notifications`: Tự động trích xuất các hoạt động lớn từ `activityLogs` để tạo notification trong collection `notifications` với tiền tố ID ổn định `pcn-notif-`.
- **Cơ chế Sao lưu & Khôi phục**:
  - Module Backup tại `/api/backups/*` chỉ cho phép quyền Admin (`systemRole=admin`).
  - Chính sách chỉ sao lưu thủ công (manual only, không chạy cron ngầm).
  - Tự động thực thi retention: Tối đa 3 bản sao lưu gần nhất, dung lượng tối đa 2 GiB.
  - Khôi phục an toàn: Bắt buộc preflight kiểm tra dump postgres (`pg_restore --list`), kiểm tra tính toàn vẹn file manifest và hash SHA-256 của các object trong Storage trước khi ghi đè, yêu cầu nhập chính xác chuỗi xác nhận `KHOIPHUC`.

---

## 4. ĐỀ XUẤT HÀNH ĐỘNG DÀNH CHO ORCHESTRATOR & ĐỘI NGŨ PHÁT TRIỂN

Dựa trên kết quả rà soát, đề xuất Orchestrator tổng hợp các hành động sau vào kế hoạch M4:

### Nhóm 1: Cập nhật tài liệu chuẩn `design.md` (Document Patching)
1. **Bổ sung endpoint `POST /api/pcn/intake`**: Cập nhật bảng hợp đồng REST API tại mục 7.3 để ghi nhận chính thức endpoint tiếp nhận Đề nghị và tạo hồ sơ nguyên tử (đã có trong code tại `server.ts:9113`).
2. **Bổ sung endpoint `GET /api/tieuchuan`**: Ghi nhận endpoint tra cứu danh mục tiêu chuẩn từ file Excel vào mục 7.3.
3. **Chuẩn hóa phương thức Clear Notification**: Cập nhật dòng 1220 mục 7.3 ghi rõ: Notification PCN dùng `POST /api/pcn/notifications/clear`, Notification PGDCN dùng `DELETE /api/pgdcn/notifications/clear`.
4. **Xử lý dòng 1353 (`/api/pcn/cutover-status`)**: Đánh dấu trạng thái [RETIRED] hoặc loại bỏ endpoint này khỏi mục 10 vì hệ thống đã chuyển sang vận hành chính thức cho hồ sơ mới, các công cụ cutover lịch sử đã bị bãi bỏ theo đúng quy định tại mục 0.3 dòng 169-170.
5. **Làm rõ kiến trúc Server Gateway**: Bổ sung ghi chú kiến trúc tại mục 7.3 và mục 8 xác nhận `server.ts` (Express) là cổng API Gateway đang hoạt động chính thức của hệ thống; việc chuyển đổi sang Next.js App Router là lộ trình dài hạn và phải giữ nguyên tính toàn vẹn của các API PGD hiện hữu.

### Nhóm 2: Đề xuất hoàn thiện mã nguồn (Future Implementation Plan)
*(Lưu ý: Không thực hiện sửa code trong phiên này theo quy tắc Read-Only)*
1. **Bảo vệ các route DDT legacy**: Bổ sung middleware xác thực phiên cho các route `/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation` trong `server.ts` để tránh truy cập trái phép.
2. **Kế hoạch di chuyển toàn diện sang Next.js App Router (nếu cần)**: Khi đội ngũ quyết định loại bỏ Express, cần tạo các route handler tương ứng trong `app/api/pgd/*` cho hơn 30 endpoints PGD hiện còn thiếu trong App Router trước khi chuyển giao gateway.
