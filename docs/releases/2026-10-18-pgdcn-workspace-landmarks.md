# Biên bản phát hành PGDCN Web App — 18/10/2026

## Kết quả tiếp tục

**BLOCKED — chưa deploy Docker Desktop production.**

Compose xác thực cấu hình thành công, nhưng build từ snapshot đã commit dừng giữa bước npm ci --include=dev: Docker BuildKit trả lỗi RPC Unavailable / EOF khi đọc trạng thái. Lệnh docker compose up -d --build --no-deps webapp thoát mã 1. Lượt docker info bounded ngay sau đó timeout ở 15 giây. Không restart Docker/WSL, không xóa image/container/volume, không khởi động lại DB. Không có image ID mới được xác nhận; không có kết quả health/smoke sau deploy. Do Docker Engine mất phản hồi, trạng thái container sau lỗi không thể kiểm tra lại.

## Commit và working tree

- Landmark PCN/PGD: eaedba15d7c3de4e394f5f66dc8eab93cddc1436.
- Assertion params Next 16 cho PGD: 8ea6fee1fcefcd038a6e1051cd919c5f7584eb03.
- Assertion overflow PGD cũ được chuyển sang kiểm tra main ở shell dùng chung: e1a0e054d4c782bb5f90ac404ae2e4d5ee2a77cb.
- Báo cáo preflight trước đó: 0d5761485c4aaea053b1f79da44f83107576a010.
- Snapshot build dùng đúng HEAD e1a0e054d4c782bb5f90ac404ae2e4d5ee2a77cb, tạo bằng git archive: 1.897 file, không chứa .env; blob của 8 file trọng yếu khớp commit.
- Trước commit biên bản này, master ahead origin/master 18 commit. Không push. Có 16 mục tracked dirty và 9 mục untracked hiện hữu; không đụng vào các mục đó.

## Kiểm thử

Các kiểm thử chạy trong working tree tại commit nội dung e1a0e05 (giữ nguyên các thay đổi runtime dirty có từ trước):

- npm run typecheck: đạt.
- npm run test:pcn: 918/918 đạt.
- PGD suite theo tên file, gồm route detail: 105 file, 370/370 đạt.
- Hai landmark tests PCN/PGD: 5/5 đạt.
- Test tập trung pcn-ui-completion-task3.test.ts: 8/8 đạt.

Các kết quả này không thay thế cho Docker production build; build image chưa hoàn tất.

## Docker và health

- Trước build, Docker context desktop-linux, Engine 29.8.2, Compose v5.6.0; docker info trả lời.
- Đã xác nhận project pgdcn_webapp, service webapp, container pcn_webapp-webapp, port 2357, external network supabase_default; lúc preflight có 13 container Supabase ở trạng thái Up.
- Compose config --quiet exit 0 khi nạp đồng thời E:\CODING\PGDCN_webapp\.env và E:\CODING\TVCI_APP\supabase-docker\.env; không in giá trị bí mật.
- Trước build, container là 325e0ed1eec678aea3348a1ffa2337c130772585c547d422103f84c04f8a5fc1, dùng image sha256:47d3995f3c02fb7bb942ef4c8d1f584ed2bcc4bb132108745779325caedd1e8f (pgdcn_webapp-webapp:latest).
- Baseline gọi từ host tới http://localhost:2357/api/health và /api/db/health trả kết nối rỗng, HTTP 000. Gọi từ trong container, /api/health và /api/db/health đều trả 200; DB health xác nhận pcn_certification. Chưa smoke route PCN/PGD/drafting sau deploy vì không có deploy.
- Build dùng context cô lập ở %TEMP%\pgdcn-release-e1a0e05\source, không dùng các file dirty/untracked trong workspace. Lỗi xảy ra ở npm ci, trước khi Dockerfile chạy npm run build.
- Image phát hành mới: không có ID được xác nhận. Không khẳng định deploy thành công.

## Backup và rollback

- Đã tạo dump chỉ đọc cho đúng database app pcn_certification: E:\CODING\PGDCN_webapp\backups\pgdcn-predeploy-20261018-122149.dump.
- pg_restore --list: exit 0, database pcn_certification, 26 mục TOC; có TABLE DATA cho app_documents và file_assets. Kích thước 604.393 byte; SHA-256 5B931A498CB2C7A839D935A7C428200A551F03885AE3378B447174FF0487F794.
- Trước dump, DB health và pg_isready đạt; truy vấn đếm trả 7.898 app_documents và 912 file_assets. Không chạy migration, seed, restore hay lệnh ghi DB.
- Backup pgdcn-predeploy-20261017-222005.dump đã kiểm tra lại, SHA-256 B74452795AF00844D5AAB5AF36477154DBE3865ABD6FE4BFEC97104D3625468D, nhưng header cho biết database là postgres, không phải pcn_certification; không dùng nó thay cho dump mới của DB app.
- Image đang chạy ngay trước build được xác minh dưới tag latest với ID sha256:47d3995f3c02fb7bb942ef4c8d1f584ed2bcc4bb132108745779325caedd1e8f. Tag rollback cũ pgdcn_webapp-webapp:rollback-20261017-222005 có ID sha256:f643b3d82c4a0dba3684f38f1849cce0a2f8bdd3e63b3c1f27781fb956b3bc0b và file backups\pgdcn-rollback-20261017-222005.yml trỏ tới tag đó; đây là image cũ hơn, không phải image đang chạy trước lượt build. Chưa tạo tag/compose rollback mới vì build dừng trước thay container. Docker Engine offline nên các ID này chưa được kiểm tra lại sau lỗi.

## Điều kiện tiếp tục

Chờ Docker Engine tự sẵn sàng hoặc được khôi phục ngoài lượt này; không factory reset hoặc xóa dữ liệu. Trước lần deploy tiếp theo, xác minh lại container/image đang chạy, tạo tag rollback từ đúng image hiện tại và compose rollback tương ứng, xác minh backup pcn_certification, rồi mới build lại từ commit đã duyệt. Sau đó kiểm tra health từ host và smoke route PCN/PGD/drafting; nếu health lỗi thì rollback webapp, không restore DB tự động.
