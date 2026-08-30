# TVCI – Phòng Chứng nhận

Ứng dụng vận hành cho Phòng Chứng nhận (PCN) thuộc Trung tâm TVCI. Frontend chạy bằng Next.js App Router; Express được giữ làm API gateway trong giai đoạn chuyển tiếp để bảo toàn các API nội bộ cần thiết.

## Phạm vi nghiệp vụ

- Đầu vào của PCN là **Đề nghị** từ khách hàng.
- **PYC** chỉ là chứng từ outbound khi PCN gửi yêu cầu đến một phòng thử nghiệm khác.
- Điều hướng và hàng đợi tổ chức theo **Lĩnh vực**, khởi đầu gồm Quy chuẩn 4 (`QC4`) và Quy chuẩn 9 (`QC9`); không có lịch thử nghiệm/ITD/EMC.
- **Danh sách khách hàng** được giữ lại và chạy trong database PCN riêng.
- Danh sách người dùng PCN sẽ được seed ở phase riêng sau khi có dữ liệu được cung cấp.

## Chạy với Supabase self-host trên Docker Desktop

PCN dùng PostgreSQL service hiện hữu `supabase-db` trên Docker network `supabase_default`, nhưng dùng database logic riêng mặc định là `pcn_certification`. Compose PCN không tạo thêm PostgreSQL container hoặc volume.

1. Bảo đảm stack Supabase self-host đang chạy và network `supabase_default` tồn tại.
2. Tạo database logic một lần nếu chưa có, bằng PostgreSQL administrator của container Supabase:

   ```powershell
   docker exec supabase-db psql -U postgres -d postgres -c "CREATE DATABASE pcn_certification;"
   ```

   Nếu database đã tồn tại, bỏ qua bước này. Không xóa hoặc khởi tạo lại database hệ thống Supabase.

3. Build và chạy app PCN bằng env file của stack Supabase:

   ```powershell
   docker compose --env-file E:\CODING\TVCI_APP\supabase-docker\.env -f docker-compose.pcn.yml up --build -d
   ```

4. Mở `http://localhost:2357`. Kiểm tra `http://localhost:2357/api/health` và `http://localhost:2357/api/db/health`.

Compose truyền `APP_PROFILE=pcn`, `POSTGRES_HOST=supabase-db`, `POSTGRES_PORT=5432` và `PCN_POSTGRES_DB=pcn_certification`. Có thể thay tên database bằng `PCN_POSTGRES_DB`; chỉ dùng `PCN_DATABASE_URL` khi muốn chỉ rõ connection string cho database PCN.

Production bắt buộc truyền `PCN_SESSION_SECRET` là chuỗi ngẫu nhiên dài qua env file; secret này dùng để ký cookie phiên PCN HttpOnly và không được ghi vào repository. Khi chưa có danh sách user PCN, môi trường development còn hỗ trợ tài khoản dự phòng `admin/admin`; tài khoản này không được phép dùng ở production.

File GCN/QĐ/chứng thư được tải qua `/api/pcn/files` vào bucket Storage private. Đặt `PCN_STORAGE_BUCKET` nếu muốn dùng bucket riêng; giới hạn mặc định là 25 MiB qua `PCN_FILE_MAX_BYTES`. Không lưu byte file trong `app_documents`.

## Template phát hành PCN và tài liệu liên kết

Template phát hành QC4/QC9 được quản lý tách khỏi template DDT. Discovery luôn là dry-run, đọc SHA-256 và placeholder từ file nguồn nhưng không theo dõi hoặc đọc Desktop ở runtime:

```powershell
$env:APP_PROFILE = 'pcn'
npm run discover:pcn-template -- --source="E:\exports\GCN.docx" --relative="Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/GCN.docx"
```

Sau khi đối soát đúng bản mẫu, có thể nhập asset vào private Storage ở trạng thái chưa duyệt. Cần cấu hình `SUPABASE_STORAGE_URL` và `SUPABASE_SERVICE_ROLE_KEY` trong env của stack trước khi dùng `--apply`:

```powershell
npm run import:pcn-template -- --template=pcn-qc4-certificate-tool --source="E:\exports\GCN.docx" --relative="Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/GCN.docx" --apply
```

Chỉ dùng thêm `--approve` sau khi người có thẩm quyền xác nhận mapping; template chưa `APPROVED`, `.doc`, hoặc thiếu placeholder sẽ bị chặn trước khi sinh GCN/QĐ. Tài liệu phát hành chính thức được sinh từ cùng context của hồ sơ/Đề nghị/bộ cấp số; DOCX dùng route phát hành trong giao diện. Để bật PDF chính thức, cấu hình `PCN_DOCX_PDF_RENDERER=soffice` (hoặc đường dẫn executable LibreOffice) trong môi trường chạy app. Server chỉ truyền bộ đối số cố định, kiểm tra chữ ký `%PDF-` và trả **Chưa sẵn sàng** nếu renderer thiếu/lỗi; không tạo PDF thay thế một cách im lặng.

## Kiểm kê và nhập hồ sơ lịch sử PCN

Thư mục Desktop `PCN` chỉ được đọc một lần để kiểm kê/chọn batch; ứng dụng không watcher và không dùng đường dẫn Desktop khi chạy runtime. Kiểm kê trước bằng lệnh read-only:

```powershell
$env:APP_PROFILE = 'pcn'
npm run discover:pcn-history -- --source="C:\Users\HungX\Desktop\PCN"
```

Sau khi đối chiếu báo cáo, có thể chọn một hoặc nhiều candidate theo khóa `FIELD:BUSINESS_CODE`. Dry-run là mặc định; `--apply` mới ghi database PCN và private Storage. `batchId` nên được đặt ổn định để retry không tạo hồ sơ trùng:

```powershell
npm run import:pcn-history -- --source="C:\Users\HungX\Desktop\PCN" --candidate=QC4:0665,QC9:0105-01 --batch=pcn-history-2026-08-28-01 --dry-run
npm run import:pcn-history -- --source="C:\Users\HungX\Desktop\PCN" --candidate=QC4:0665,QC9:0105-01 --batch=pcn-history-2026-08-28-01 --apply
```

Candidate chưa được rà soát vẫn tạo hồ sơ `ON_HOLD`/`PENDING_REVIEW`; không được xem dry-run là thao tác nhập và không được dùng tên thư mục để suy diễn trạng thái phát hành.

## Chạy development ngoài Docker

Sao chép `.env.example` thành `.env`, đặt `PCN_POSTGRES_DB=pcn_certification` và host/port mapping PostgreSQL của Supabase self-host trên máy. Không dùng `DATABASE_URL` của profile DDT cho PCN. Để tránh khởi động nhầm profile, dùng lệnh PCN tường minh `npm run dev:pcn`; lệnh `npm run dev` vẫn giữ profile DDT khi chưa đặt `APP_PROFILE`.

```powershell
npm install
npm run dev:pcn
```

Mặc định server development native trên Windows chạy ở `http://localhost:1357`. Nếu chạy production bằng Next custom server:

```powershell
npm run build
npm start
```

## Kiểm tra

```powershell
npm run lint
npm run build
node --experimental-strip-types --test test/pcn-*.test.ts test/next-*.test.ts test/customer-data-integrity.test.ts
```

Kiểm chứng database PCN sau khi import hoặc trước cutover:

```powershell
$env:APP_PROFILE = 'pcn'
npm run verify:pcn-cutover -- --input=customers.csv
```

Lệnh này chỉ đọc database, đối soát profile/database, allowlist collection, QC4/QC9, count/hash khách hàng, trigger audit và bảng `file_assets`.

Trước khi nghiệm thu runtime, có thể chạy smoke read-only trên server native. Lệnh này kiểm tra health, ranh giới session, database PCN, các danh mục chính, cutover và archive mới nhất; không tạo hồ sơ, không sửa danh mục và không in credential/payload:

```powershell
$env:APP_PROFILE = 'pcn'
npm run smoke:pcn-runtime
```

`cutover.ok=false` được báo như cảnh báo để tiếp tục rà soát, còn lỗi đăng nhập, database hoặc archive sẽ làm smoke thất bại.

Một số test legacy của codebase cũ có thể phụ thuộc các file DDT đã bị loại khỏi working tree; chúng không phải contract của runtime PCN.

## Ranh giới dữ liệu

Runtime PCN chỉ cho phép các collection PCN (`certificationProposals`, `certificationDossiers`, `labRequests`, `returnedResults`, `issuancePackages`, `pcnCertificationFields`, `customers` và các collection vận hành liên quan). Dữ liệu `requests`, `handoverDocs`, `kqtnRecords` của DDT không được tự động chuyển thành hồ sơ PCN và không được đọc chung từ database `ddt_lab`.

`design.md` là nguồn chuẩn duy nhất cho kiến trúc, UI/UX, schema và quy chuẩn mã nguồn của dự án.

## Import danh mục khách hàng sang PCN

Nguồn import có thể là CSV hoặc JSON (`[ ... ]` hoặc `{ "customers": [ ... ] }`). Chạy preview trước trong profile PCN:

```powershell
$env:APP_PROFILE = 'pcn'
npm run migrate:pcn-customers -- --input=E:\exports\customers.csv
```

Preview báo count, khóa trùng, dòng lỗi và SHA-256 trước/sau. Chỉ chạy apply sau khi đã đối soát và xử lý hết lỗi/trùng khóa:

```powershell
npm run migrate:pcn-customers -- --input=E:\exports\customers.csv --apply --confirm=KHOI_TAO_DANH_MUC_PCN
```

`--dry-run` mặc định không cần archive. Với `--apply`, job bắt buộc phải tìm archive PCN dạng ZIP được tạo trước lúc job bắt đầu, sau đó kiểm chứng lại trên server: dump phải đọc được, manifest phải đầy đủ và toàn bộ object phải hợp lệ. Nếu không đạt, job dừng trước transaction và không ghi khách hàng/audit. Vì vậy quy trình an toàn là:

```powershell
$env:APP_PROFILE = 'pcn'
npm run smoke:pcn-runtime
# Tạo/kiểm tra archive PCN trong giao diện Quản trị dữ liệu → Sao lưu & khôi phục
npm run migrate:pcn-customers -- --input=E:\exports\customers.csv
npm run migrate:pcn-customers -- --input=E:\exports\customers.csv --apply --confirm=KHOI_TAO_DANH_MUC_PCN
```

Admin cũng có thể thực hiện cùng quy trình trên màn hình **Quản trị dữ liệu → Đối soát cutover**: chọn CSV/JSON, rà soát cục bộ, bấm **Lập preview import**, kiểm tra hash/duplicate/alias và chỉ bấm **Apply danh mục khách hàng** sau khi đã tạo checkpoint bằng nút **Tạo checkpoint trước import** trong module Sao lưu. Màn hình này không tự merge alias; server kiểm tra lại fingerprint nguồn, fingerprint đích, checkpoint và quyền Admin trong transaction. CLI dùng `--keep-alias=<sourceKey>` hoặc `--map-alias=<sourceKey>=<targetKey>` lặp lại cho từng alias; thiếu quyết định thì job bị chặn.

Job chỉ ghi vào database PCN, merge ô trống để không làm mất dữ liệu liên hệ hiện có, và tạo activity log nguồn `IMPORT`. Không dùng job này để migrate hồ sơ/PYC/KQTN DDT.
