# TVCI – Phòng Chứng nhận

Ứng dụng vận hành cho Phòng Chứng nhận (PCN) thuộc Trung tâm TVCI. Frontend chạy bằng Next.js App Router; Express được giữ làm API gateway trong giai đoạn chuyển tiếp để bảo toàn các API nội bộ cần thiết.

## Phạm vi nghiệp vụ

- Đầu vào của PCN là **Đề nghị** từ khách hàng.
- **PYC** chỉ là chứng từ outbound khi PCN gửi yêu cầu đến một phòng thử nghiệm khác.
- Điều hướng và hàng đợi tổ chức theo **Lĩnh vực**, khởi đầu gồm Quy chuẩn 4 (`QC4`), Quy chuẩn 9 (`QC9`) và Quy chuẩn 20 (`QC20`); không có khái niệm lịch thử nghiệm hoặc lịch ITD/EMC. PCN vẫn gửi PYC và theo dõi luân chuyển mẫu qua các phòng thử Hiệu suất, EMC và An toàn điện; QC20 mặc định tạo tuyến phân tích thành phần hóa học và yêu cầu xác nhận phạm vi mác thép, mã HS, tiêu chuẩn áp dụng, kích thước và loại lô.
- **Danh sách khách hàng** được giữ lại và chạy trong database PCN riêng.
- Danh sách người dùng PCN được seed từ roster đã đối soát; ví dụ Lương Xuân Hùng là Admin PCN, Trần Hoàng Phương và Vũ Thị Thắm là nhân viên PCN. `systemRole` và `departmentRoleCode` luôn được quản lý tách biệt.

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
   $env:SUPABASE_ENV_FILE = 'C:\path\to\supabase\.env'
   docker compose --env-file $env:SUPABASE_ENV_FILE -f docker-compose.pcn.yml up --build -d
   ```

4. Mở `http://localhost:2357`. Kiểm tra `http://localhost:2357/api/health` và `http://localhost:2357/api/db/health`.

Compose truyền `APP_PROFILE=pcn`, `POSTGRES_HOST=supabase-db`, `POSTGRES_PORT=5432` và `PCN_POSTGRES_DB=pcn_certification`. Có thể thay tên database bằng `PCN_POSTGRES_DB`; chỉ dùng `PCN_DATABASE_URL` khi muốn chỉ rõ connection string cho database PCN.

Production bắt buộc truyền `PCN_SESSION_SECRET` là chuỗi ngẫu nhiên dài qua env file; secret này dùng để ký cookie phiên PCN HttpOnly và không được ghi vào repository. Môi trường development còn hỗ trợ tài khoản dự phòng `admin/admin` khi chưa có tài khoản cấu hình; tài khoản này không được phép dùng ở production.

File hồ sơ, biên bản và GCN/QĐ/chứng thư được tải qua `/api/pcn/files` vào bucket Storage private `pcn-files` mặc định. Có thể đặt `PCN_STORAGE_BUCKET` nếu triển khai đã tạo bucket PCN khác; giới hạn mặc định là 25 MiB qua `PCN_FILE_MAX_BYTES`. Metadata, phiên bản và checksum nằm trong database PCN; byte file không nằm trong `app_documents`.

## Tài liệu và biểu mẫu PCN

Ngoài các biểu mẫu nằm trong card hồ sơ, mục **Soạn thảo tài liệu PCN** cho phép lập tài liệu tùy chọn độc lập: chọn nguồn theo số Đề nghị hoặc số Hồ sơ, hoặc nhập tay; với hồ sơ đã chọn, các thông tin lô mẫu, tuyến PTN, PYC, giao nhận và KQTN đã tiếp nhận được tự điền để người dùng kiểm tra; lưu bản nháp chưa hoàn chỉnh; sau khi đủ trường bắt buộc thì sinh DOCX/PDF vào private Storage. Bìa/mục lục hồ sơ, kết quả chứng nhận/phụ lục, hợp đồng và bộ gửi khách hàng có thể tạo từ workspace này. KQTN vẫn chỉ tiếp nhận bản scan/OCR do PTN cấp; GCN và Quyết định vẫn chịu cổng phê duyệt trong card hồ sơ.

Biểu mẫu QC4/QC9/QC20 được dùng cho các hồ sơ phát sinh mới và được gọi từ vùng **Tài liệu hồ sơ** của card. Riêng QC20 khởi tạo ở trạng thái cấu hình chờ PCN xác nhận phạm vi sản phẩm, chỉ tiêu và bộ biểu mẫu chính thức. Tài liệu phát hành chính thức được sinh từ context của hồ sơ/Đề nghị/bộ cấp số; không đọc hoặc theo dõi thư mục nghiên cứu khi app chạy. Để bật PDF chính thức, cấu hình `PCN_DOCX_PDF_RENDERER=soffice` (hoặc đường dẫn executable LibreOffice) trong môi trường chạy app.

### Nạp template DOCX PCN

Template DOCX nguồn được nạp bằng lệnh bảo trì có kiểm soát, không upload vào `public/`/`dist/` và không để runtime theo dõi thư mục Desktop. Luôn chạy dry-run trước:

```powershell
$env:APP_PROFILE = 'pcn'
npm run import:pcn-template -- --template=<pcn-template-id> --source="E:\PCN\mau.docx" --relative="Hồ sơ chứng nhận QCVN4 2026/Tool QC4/Nhap data/GCN.docx" --allow-annotation
```

Sau khi kiểm tra fingerprint, placeholder và cảnh báo, thêm `--apply` để ghi asset vào Storage private `pcn-files` và metadata vào database PCN. Admin tiếp tục mở **Cài đặt PCN → Mở cài đặt template** để chú thích, duyệt hoặc ngừng dùng; template chưa được duyệt không được dùng để phát hành GCN/QĐ.

## Ranh giới dữ liệu sản phẩm

PCN là ứng dụng vận hành cho các Đề nghị và bộ hồ sơ mới. Không có chức năng kiểm kê, nhập, mapping, nhận xét hoặc đánh giá các bộ hồ sơ cũ. Các tài liệu/phỏng vấn dùng để thiết kế quy trình chỉ là nguồn nghiên cứu read-only bên ngoài runtime và không được lưu đường dẫn vào database, Storage hoặc cấu hình triển khai.

## Chạy development ngoài Docker

Sao chép `.env.example` thành `.env`, đặt `PCN_POSTGRES_DB=pcn_certification` và host/port mapping PostgreSQL của Supabase self-host trên máy. Không dùng `DATABASE_URL` của profile DDT cho PCN. `npm run dev` và `npm run dev:pcn` đều khởi động Next/PCN native trên cổng `1357`; repository không còn lối chạy frontend DDT legacy. Production Docker luôn ép `APP_PROFILE=pcn` và chạy cổng `2357`.

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
npm test
npm run smoke:pcn-runtime
```

Runtime PCN không có màn hình kiểm kê/cutover hoặc sửa hồ sơ cũ. Các utility legacy còn lại trong repository không được gọi từ `PcnAppShell`. `npm run test:all` chỉ dùng khi cần bảo trì các contract legacy/reference đã bị loại khỏi điều hướng sản phẩm.

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
npm test
npm run smoke:pcn-runtime
# Kiểm tra runtime nếu cần trước khi chạy job cấu hình danh mục
npm run migrate:pcn-customers -- --input=E:\exports\customers.csv
npm run migrate:pcn-customers -- --input=E:\exports\customers.csv --apply --confirm=KHOI_TAO_DANH_MUC_PCN
```

Việc nạp danh mục khách hàng là tác vụ thiết lập one-time ngoài màn hình vận hành; không nạp hồ sơ, PYC, KQTN hoặc dữ liệu DDT. CLI dùng `--keep-alias=<sourceKey>` hoặc `--map-alias=<sourceKey>=<targetKey>` khi cần xử lý một alias cụ thể.

Job chỉ ghi vào database PCN, merge ô trống để không làm mất dữ liệu liên hệ hiện có, và tạo activity log nguồn `IMPORT`. Không dùng job này để migrate hồ sơ/PYC/KQTN DDT.
