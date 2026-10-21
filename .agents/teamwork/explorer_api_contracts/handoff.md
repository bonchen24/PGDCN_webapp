# BÁO CÁO BÀN GIAO (HANDOFF REPORT) — EXPLORER R2.2: API CONTRACTS & SECURITY/RBAC

- **Đơn vị bàn giao**: Explorer R2.2 (`explorer_api_contracts`)
- **Đơn vị tiếp nhận**: Orchestrator (`c9347652-528c-48e2-896d-0e3b02f08718`) / Teamwork
- **Nhiệm vụ bàn giao**: Hoàn tất rà soát đối chiếu toàn diện Hợp đồng API, Server Implementation, Profile Active & Security/RBAC giữa `design.md` và mã nguồn thực tế hệ thống PGDCN Web App.
- **Tài liệu chi tiết kèm theo**: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_api_contracts\report_api_contracts.md`
- **Thời gian lập**: 2026-09-30

---

## 1. Observation (Quan sát trực tiếp)

Quá trình điều tra trực tiếp trên mã nguồn hệ thống và tài liệu đặc tả thu được các chứng cứ cụ thể sau:

1. **Cấu hình Profile & Mạng Runtime**:
   - `server.ts:354`: Hằng số cố định `const DATABASE_PROFILE = 'pcn'`.
   - `utils/pcnDatabase.ts:18-33`: Hàm `resolveDatabaseConfig(process.env)` trích xuất `APP_PROFILE=pcn`, tên database mặc định `pcn_certification`, Storage bucket `pcn-files`.
   - `scripts/native-dev-env.cjs:55`: Native dev sử dụng cổng `PORT=1357`, kết nối PostgreSQL qua loopback port `15432`. Cấu hình Docker compose production gán webapp cổng `2357`, kết nối database `supabase-db:5432`.
   - `types.ts:10`: Khai báo `export type PcnCertificationFieldCode = 'QC4' | 'QC9'`.
   - `sql/pcn-schema.sql:171, 474`: Dữ liệu mẫu khởi tạo chỉ cấp phép `QC4` và `QC9` cho PCN; trong khi `QC20` được cấu hình độc lập cho PGD với mã catalog `STEEL_LOT_INSPECTION` và profile routing `GĐ-THEP-KG`.

2. **Kiến trúc Server Kép & Phân bổ Endpoints**:
   - `server.ts` hiện diện **174 endpoints** (chi tiết trong `routes_server.json`), bao gồm:
     - 85 endpoints nghiệp vụ PCN (`/api/pcn/*`).
     - 44 endpoints nghiệp vụ PGD (`/api/pgd/*`).
     - 45 endpoints hạ tầng, auth, sync và tiện ích (`/api/auth/*`, `/api/db/*`, `/api/pgdcn/*`, `/api/activity-logs/*`, `/api/backups/*`, `/api/gemini/*`).
   - Thư mục `app/api/` (Next.js App Router) có **106 route files** (kết quả commit `fed636d`). Tuy nhiên, chỉ mới port các endpoint PCN và workflow template; **thiếu hoàn toàn hơn 30 routes nghiệp vụ PGD cốt lõi** (`requests`, `assignments`, `field-inspections`, `samples`, `lab-requests`, `results`, `reports`, `certificates`, `approvals`, `drafts`, `package`) và toàn bộ nhóm route sao lưu `/api/backups/*`.
   - `server.ts:18905-18911`: Express định tuyến middleware chặn toàn bộ lưu lượng `/api/*`:
     ```typescript
     app.use((req, res, nextMiddleware) => {
       if (req.path.startsWith('/api/')) {
         nextMiddleware();
         return;
       }
       nextHandler(req, res);
     });
     ```
     Điều này xác nhận toàn bộ lưu lượng API thực tế của hệ thống hiện đang được xử lý 100% qua Express trong `server.ts`. Các file route trong `app/api/` không nhận request trực tiếp trong runtime production/dev thông thường.

3. **Cơ chế Bảo mật, Xác thực & RBAC**:
   - `utils/pcnRbac.ts:64-108`: Cấu trúc vai trò đa trục gồm `systemRole` (`admin`, `staff`, `viewer`), `managementRoleCode` (`CENTER_DIRECTOR`, `CENTER_DEPUTY_DIRECTOR`, `DEPARTMENT_HEAD`, `DEPARTMENT_DEPUTY`, `NONE`), `professionalRoleCodes[]` (`INSPECTION_OFFICER`, `CERTIFICATION_OFFICER`, `CLERK`), `departmentScopes` (`['PCN']`, `['PGD']`).
   - `server.ts:1186-1206`: Middleware `requirePcnDepartmentSessionMiddleware` chặn bất kỳ tài khoản nào không có scope `PCN` khi gọi `/api/pcn/*` hoặc `/api/db/*`.
   - `server.ts:1478-1494`: Middleware `requirePgdSession` chặn bất kỳ tài khoản nào không có scope `PGD` khi gọi `/api/pgd/*`.
   - `server.ts:6876-6950`: API `DELETE /api/pcn/users/:id` gọi hàm `findPcnUserReferences` kiểm tra toàn diện các liên kết nghiệp vụ; trả về HTTP `409 Conflict` nếu người dùng còn hồ sơ liên quan (bảo đảm triệt để nguyên tắc Zero Cascade Deletion).
   - `server.ts:10032-10111`: API `DELETE /api/pcn/dossiers/:dossierId` kiểm tra nghiêm ngặt `isPcnSystemManager`, yêu cầu `confirmationCode` phải khớp mã hồ sơ, và từ chối `409 Conflict` nếu trạng thái hồ sơ không nằm trong nhóm hủy bỏ (`DRAFT`, `INTAKE_REVIEW`, `AWAITING_DOCUMENTS`, `REJECTED`, `CANCELLED`, `ON_HOLD`).
   - `server.ts:12056`: Hàm `getGeminiClient` kiểm tra `DATABASE_PROFILE === 'pcn'` thì bắt buộc `personalCredentialRequired = true`, đọc khóa mã hóa từ `userPreferences`, không fallback key hệ thống.

4. **Kiểm thử Hệ thống (System Test Suite Execution)**:
   - Chạy lệnh kiểm thử qua node script dự án: `npm test`
   - Kết quả: **PASS 934 / FAIL 0 / CANCELLED 0** (47 test files). Toàn bộ 934 bài kiểm thử tích hợp, unit và RBAC đều đạt 100%.

5. **Sai lệch & Khoảng trống phát hiện (Discrepancies)**:
   - Thiếu trong code: Endpoint `GET /api/pcn/cutover-status` (quy định tại dòng 1353 `design.md`) hoàn toàn không tồn tại trong `server.ts` hay `app/api/`.
   - Thiếu trong spec: Endpoint `POST /api/pcn/intake` (hiện thực tại dòng 9113-9360 của `server.ts`) xử lý tiếp nhận Đề nghị tạo đồng thời Hồ sơ và checklist nguyên tử chưa được ghi vào bảng API mục 7.3 của `design.md`.
   - Thiếu trong spec: Endpoint tra cứu danh mục tiêu chuẩn `GET /api/tieuchuan` (`server.ts:16940-16958`) đọc file `public/tieuchuan.xlsx` chưa có trong `design.md`.
   - Lệch HTTP Method: Thao tác xóa toàn bộ thông báo PGDCN hiện thực bằng `DELETE /api/pgdcn/notifications/clear` (`server.ts:16058`), trong khi mô tả chung tại dòng 1220 mục 7.3 ghi là `POST`.
   - Bảo mật Legacy DDT: Các route thừa từ thời kỳ DDT (`/api/upload-nas`, `/api/generate-docx`, `/api/extract-radimation`, `/api/kqtn/*` tại các dòng 15112-15443) chưa được gắn middleware xác thực phiên.

---

## 2. Logic Chain (Chuỗi suy luận logic)

Từ các quan sát thực nghiệm nêu trên, các suy luận logic có cấu trúc được thiết lập như sau:

- **Bước 1 (Tính sẵn sàng & Ổn định của Runtime)**:
  - Từ Quan sát 1 & Quan sát 4: Cấu hình runtime thực tế (`APP_PROFILE=pcn`, DB `pcn_certification`, dev port 1357, prod port 2357, QC4/QC9) khớp tuyệt đối với đặc tả tại Mục 0.3 và Mục 0.1 của `design.md`. Toàn bộ 934 bài kiểm thử đều chạy trên nền tảng này và đạt kết quả 100% PASS. Do đó, hệ thống đang ở trạng thái vận hành ổn định và đáng tin cậy.

- **Bước 2 (Thực chất của Kiến trúc Dual Gateway)**:
  - Từ Quan sát 2: Thư mục `app/api/` chứa 106 routes nhưng thiếu toàn bộ phân hệ PGD cốt lõi (hơn 30 routes) và backup, chứng tỏ quá trình migration từ Express sang App Router đang ở trạng thái dở dang (incomplete migration).
  - Vì middleware tại `server.ts:18905` chặn mọi request bắt đầu bằng `/api/` để Express xử lý trước khi Next.js handler can thiệp, nên `server.ts` đang đóng vai trò Gateway thực tế duy nhất của toàn bộ API. Mọi giả định cho rằng hệ thống đã hoàn toàn chuyển sang App Router thuần túy là không chính xác về mặt kiến trúc.

- **Bước 3 (Tính toàn vẹn của Ma trận Phân quyền & Bảo toàn Dữ liệu)**:
  - Từ Quan sát 3: Sự tách biệt giữa scope `PCN` và `PGD` được thực thi ở cả tầng middleware Express (`requirePcnDepartmentSessionMiddleware` vs `requirePgdSession`) và kiểm tra logic trong từng route. Các hành vi rủi ro cao (hard-delete user, hard-delete hồ sơ) đều được bảo vệ bởi các rào chắn kiểm tra tham chiếu và mã xác nhận (`findPcnUserReferences`, `confirmationCode`). Điều này hoàn toàn tuân thủ chặt chẽ nguyên tắc Zero Cascade Deletion quy định tại Mục 7.5 của `design.md`.

- **Bước 4 (Cơ sở điều chỉnh các điểm sai lệch)**:
  - Từ Quan sát 5:
    - Đối với `GET /api/pcn/cutover-status`: Mục 0.3 dòng 169-170 đã quy định rõ ràng: PCN chỉ phục vụ hồ sơ mới, các công cụ/màn hình cutover lịch sử bị cấm. Do đó, sự vắng mặt của endpoint này trong code là một quyết định kiến trúc đúng đắn; lỗi nằm ở việc dòng 1353 trong `design.md` chưa được dọn dẹp đồng bộ.
    - Đối với `POST /api/pcn/intake`: Endpoint này thực thi chính xác nghiệp vụ tiếp nhận Đề nghị tạo đồng thời Hồ sơ và checklist theo Mục 0.4 dòng 243-245. Do đó, cần bổ sung endpoint này vào bảng danh mục API Mục 7.3 để đảm bảo tính đồng bộ tài liệu.
    - Đối với `DELETE /api/pgdcn/notifications/clear`: Việc dùng phương thức `DELETE` thay vì `POST` là chuẩn mực RESTful cho hành động xóa tài nguyên thông báo. `design.md` cần được cập nhật phản ánh đúng chuẩn này.
    - Đối với các route DDT legacy: Cần lên kế hoạch bọc middleware xác thực hoặc cách ly an toàn trong các đợt refactor tiếp theo.

---

## 3. Caveats (Phạm vi giới hạn & Lưu ý)

1. **Tuân thủ quy chế Read-Only Explorer**:
   - Explorer R2.2 không thực hiện bất kỳ thao tác sửa đổi nào trên mã nguồn ứng dụng (`server.ts`, `app/api/*`, `utils/*`). Mọi quan sát và đánh giá đều dựa trên việc phân tích mã nguồn hiện hữu.
2. **Môi trường Database ngoài (Live External Connections)**:
   - Các kiểm tra kết nối mạng bên ngoài (như gọi thực tế tới hệ thống PTN ngoài qua webhook, hoặc kết nối tới NAS lưu trữ vật lý) không được thực hiện trong phiên này; thay vào đó tính hợp lệ được xác minh qua các unit test mock và phân tích logic luồng mã nguồn.
3. **Mã nguồn App Router chưa kích hoạt**:
   - Các file trong `app/api/*` có thể tiềm ẩn khác biệt nhỏ so với `server.ts` do được trích xuất tại thời điểm commit `fed636d`. Vì chúng không được gọi trong luồng runtime hiện tại nên các khác biệt đó chưa ảnh hưởng đến môi trường đang chạy, nhưng cần được kiểm tra kỹ nếu có kế hoạch tái khởi động migration.

---

## 4. Conclusion (Kết luận đánh giá)

1. **Mức độ tuân thủ**:
   - Hệ thống backend hiện tại tuân thủ **rất cao (trên 95%)** đối với các hợp đồng cốt lõi của `design.md` về Profile Active (`pcn`), Quản trị Phân quyền RBAC, Ranh giới phân hệ PCN/PGD, và Cơ chế bảo toàn dữ liệu (Zero Cascade Deletion).
2. **Kiến trúc vận hành**:
   - `server.ts` (Express) là cổng API Gateway thực tế duy nhất phục vụ 174 endpoints hoạt động ổn định và vượt qua toàn bộ 934 bài kiểm thử. Việc tồn tại song song thư mục `app/api/` là di sản chuyển đổi chưa dứt điểm, cần được ghi nhận minh bạch vào tài liệu kiến trúc.
3. **Các hành động ưu tiên đề xuất (Actionable Scope)**:
   - **Tài liệu `design.md`**: Cần bổ sung `POST /api/pcn/intake`, `GET /api/tieuchuan`; chuẩn hóa method `DELETE` cho notification clear; loại bỏ tham chiếu `GET /api/pcn/cutover-status` (dòng 1353); ghi nhận vai trò Gateway của `server.ts`.
   - **Mã nguồn (giai đoạn sau)**: Bọc middleware xác thực bảo vệ các route legacy DDT còn sót lại.

---

## 5. Verification Method (Phương pháp kiểm chứng độc lập)

Để kiểm chứng độc lập toàn bộ các kết luận trong báo cáo này, bất kỳ Agent nào cũng có thể thực hiện theo các bước sau:

1. **Kiểm chứng tính toàn vẹn và mức độ vượt qua của Test Suite**:
   ```powershell
   npm test
   ```
   *Kỳ vọng*: 47 test files chạy hoàn tất, kết quả đạt chính xác `PASS 934 / FAIL 0 / CANCELLED 0`.

2. **Kiểm chứng cơ chế Gateway chặn `/api/*` của Express**:
   - Đọc file `server.ts` tại dòng 18905-18911.
   - Xác nhận sự tồn tại của middleware:
     `if (req.path.startsWith('/api/')) { nextMiddleware(); return; }`
     đảm bảo mọi request `/api/*` không bị Next.js App Router xử lý chồng chéo.

3. **Kiểm chứng Active Profile và Cơ chế Phân quyền**:
   - Kiểm tra `server.ts` dòng 354: `const DATABASE_PROFILE = 'pcn'`.
   - Kiểm tra `server.ts` dòng 1186-1206 (`requirePcnDepartmentSessionMiddleware`) và dòng 1478-1494 (`requirePgdSession`).
   - Kiểm tra API xóa người dùng `DELETE /api/pcn/users/:id` tại `server.ts:6876` gọi `findPcnUserReferences` và trả về `409 Conflict`.

4. **Kiểm chứng sự thiếu sót của `/api/pcn/cutover-status`**:
   - Sử dụng công cụ grep trong toàn bộ thư mục gốc tìm chuỗi `cutover-status`.
   - Kết quả: Không tìm thấy bất kỳ route handler nào trong cả `server.ts` lẫn `app/api/`.

5. **Đọc Báo cáo chi tiết và Ma trận Đối chiếu (28 mục)**:
   - Đường dẫn tuyệt đối: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_api_contracts\report_api_contracts.md`.
