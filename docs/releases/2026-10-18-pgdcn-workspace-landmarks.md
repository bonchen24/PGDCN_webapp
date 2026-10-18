# Biên bản phát hành PGDCN Web App — 18/10/2026

## Trạng thái

**BLOCKED trước Docker build/deploy.** Không tạo image mới, không thay container, không sửa cơ sở dữ liệu và không push Git.

## Phạm vi đã chốt

- Chuẩn hóa landmark truy cập PCN/PGD ở chế độ nhúng và độc lập; vùng soạn thảo dùng section có nhãn, vùng PGD bị ẩn không còn lồng main.
- Không đổi quy trình nghiệp vụ PCN/PGD, sinh DOCX/PDF, xem trước A4 hay các cổng xác nhận tài liệu.
- Commit mã: `eaedba15d7c3de4e394f5f66dc8eab93cddc1436` — `fix: use accessible landmarks in PCN and PGD workspaces`.
- Trạng thái Git sau commit mã: nhánh `master`, ahead remote 15 commit; không push. Phiên bản package đang khai báo `0.0.0`; không tạo tag/image phát hành.

## Bằng chứng kiểm thử

- `npm run typecheck`: đạt.
- Hai bài landmark: 5/5 đạt.
- Bộ UI/drafting/mobile tập trung: 46/46 đạt, gồm kiểm tra preview PDF A4 và đường soạn DOCX.
- `npm run test:pcn`: 917/918 đạt. Bài còn lại `test/pcn-ui-completion-task3.test.ts` yêu cầu chuỗi JSX `<main className={embedded ? ...}>`; implementation chọn `main` khi standalone và section có nhãn khi embedded. Đây là assertion phụ thuộc cú pháp hiện cần rà soát; không sửa assertion ngoài phạm vi release.
- Bộ 103 file PGD liên quan: 341/342 đạt. `test/dossier-detail-sidebar-route.test.ts` còn yêu cầu `params.requestId` đồng bộ, trong khi route hiện await Promise `params` theo Next.js 16.
- `git diff --check`: đạt. Không có xác minh build production hoặc smoke test vì Docker Engine không sẵn sàng.

## Backup và rollback

- Backup hiện có: `E:\CODING\PGDCN_webapp\backups\pgdcn-predeploy-20261017-222005.dump` (25,979,362 byte; 17/10/2026 22:20 UTC+7).
- `pg_restore --list`: exit 0, liệt kê 2,383 object.
- SHA-256: `B74452795AF00844D5AAB5AF36477154DBE3865ABD6FE4BFEC97104D3625468D`.
- Tệp rollback `backups\pgdcn-rollback-20261017-222005.yml` tham chiếu tag `pgdcn_webapp-webapp:rollback-20261017-222005`; chưa thể kiểm tra image ID hoặc container hiện tại. Chưa tạo pg_dump mới.
- Vì chưa deploy, rollback lúc này là không áp dụng: container và DB không bị thay đổi. Trước lần triển khai tiếp theo cần kiểm tra Docker engine, xác nhận image cũ bằng ID bất biến, tạo/xác minh backup mới, sau đó nếu smoke lỗi thì chạy lại riêng service webapp bằng image rollback; không chạy migration.

## Blocker triển khai

1. Docker Desktop được khởi chạy nhưng named pipe `dockerDesktopLinuxEngine` không phản hồi; không đọc được container, image hay trạng thái các dịch vụ Supabase.
2. `docker compose -p pgdcn_webapp -f docker-compose.pcn.yml config --quiet` dừng vì thiếu biến bắt buộc `SERVICE_ROLE_KEY`; file môi trường hiện có không khai báo `SERVICE_ROLE_KEY` hoặc `SUPABASE_SERVICE_ROLE_KEY`. Không in hoặc lưu giá trị bí mật.
3. Dockerfile dùng `COPY package*.json` rồi `COPY . .`; `package.json`, lockfile và một số file server/config đang có thay đổi ngoài commit release. Không dùng snapshot build mặc định khi các thay đổi đó chưa được rà soát.

Image release: **chưa tạo** (image ID N/A). Container/port 2357 và endpoint health: **chưa xác minh**. Không có tuyên bố deploy thành công.
