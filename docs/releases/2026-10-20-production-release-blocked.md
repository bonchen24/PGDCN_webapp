# PGDCN production release handoff — 2026-10-20

**BLOCKED — không triển khai, không rollback.** Finalizer yêu cầu `READY_TO_RELEASE` cho đúng SHA và không còn lỗ hổng high/critical có đường chạy runtime liên quan. Finalizer hiện ghi `BLOCKED` vì vẫn có lỗ hổng high trên các đường xử lý tài liệu production; SHA được kiểm tra cũng không phải HEAD hiện tại.

## Cổng phát hành

| Mục | Kết quả |
|---|---|
| HEAD/commit đích | `e1b95cff71f6cb5511eebfdc096ad22722335399` trên `master` |
| SHA finalizer kiểm tra | `affe8d7391c52038dec29851b3c6adb1cfd2401c` |
| Quan hệ commit | HEAD là commit tài liệu audit, con trực tiếp của SHA finalizer kiểm tra; không phải cùng SHA |
| Trạng thái finalizer | **BLOCKED** |
| DEPLOYED / ROLLED_BACK | **NO / NO** |

Đã đọc kết quả của hai tác vụ lập trình upstream trong báo cáo finalizer: thay đổi quyền chỉ đọc PGD (`256f922`) và gắn form nháp PCN với requirement (`13963e0`) đã có trong chuỗi commit. Regression test cô lập `23c8a4e` được nhập/chỉnh tương đương qua `a389a8a`, sau đó test được căn chỉnh trong `affe8d7`. Những kết quả này không gỡ được blocker bảo mật hoặc làm finalizer thành `READY_TO_RELEASE`.

## Kiểm tra trên SHA finalizer

Các kết quả dưới đây chỉ áp dụng cho snapshot sạch `affe8d7391c52038dec29851b3c6adb1cfd2401c` trong worktree finalizer, không phải xác nhận build/test cho HEAD `e1b95...`:

| Lệnh/phạm vi | Kết quả đã ghi nhận |
|---|---:|
| `npm run typecheck` | PASS |
| `npm run test:pcn` | PASS — 925/925 |
| PGD/PGDCN/drafting — 116 file | PASS — 416/416 |
| `npm run build` | PASS — exit 0 |

Không chạy lại các lệnh trên HEAD khác SHA sau khi cổng finalizer thất bại. Không tạo Docker context hoặc image từ workspace dirty.

## Security triage và lý do BLOCKED

Finalizer ghi nhận `npm audit` và `npm audit --omit=dev` cùng báo 17 package: 5 moderate, 10 high, 2 critical. Có bốn finding high được đánh giá có đường chạy production xử lý đầu vào/tài liệu:

- `xlsx@0.18.5`: parser spreadsheet được gọi khi đọc tài liệu hồ sơ trong `lib/server/pgd-assistant.ts`.
- `@xmldom/xmldom@0.8.13`: qua Mammoth/docxtemplater; API production trích xuất DOCX trong route Gemini/OCR.
- `adm-zip@0.6.0`: mở ZIP từ multipart upload trong route extract-radimation.
- `image-size@2.0.2`: đọc buffer ảnh trong route extract-radimation và generate-docx.

Đây là các blocker runtime chưa được remediation và kiểm chứng lại trên SHA đích. Audit cũng ghi `next@16.3.7` high và đề nghị nâng tối thiểu `16.4.1`; điều kiện ảnh hưởng của một số advisory được triage là không khớp cấu hình hiện tại, nhưng chưa có bản sửa trên SHA đích. Hai critical còn lại (`xmldom@0.1.31` trên nhánh PPTX chưa thấy đầu vào không tin cậy; `proxy-addr@2.0.7` chỉ thuộc Express legacy không chạy trong `npm start` hiện tại) được finalizer phân loại là chưa thấy đường gọi runtime hiện tại. Điều đó không thay đổi blocker từ bốn finding high ở trên.

Quyết định finalizer: **BLOCKED**. Chưa có remediation bảo mật được audit lại, chưa có báo cáo `READY_TO_RELEASE`; vì vậy không được build/deploy production.

## Docker, production baseline và health

Không chạy preflight Docker Desktop/BuildKit/Compose, không kiểm tra Compose config/env, không truy vấn container/health và không thay đổi Docker trong lần handoff này vì release gate đã dừng trước triển khai.

Các thông tin dưới đây là lịch sử từ `2026-10-20-production-release-ccda521.md`, **không phải kiểm tra trực tiếp trong lần này**:

| Mục | Baseline lịch sử | Lần này |
|---|---|---|
| Production commit | `ccda52144313a304acc0827659b2b6af1930ee6b` | Không thay đổi |
| Container | `pcn_webapp-webapp`, ID `1924c5fd13f2cb5914bc94368e9406dc38b6ae8671e47395ff43c68fc266d774` | ID hiện tại chưa kiểm tra; không tạo container mới |
| Image | `sha256:cc74b25d723647c35548d6279193b4d45aad43e16c4e0a3b2a11d52408d9b259` | Không build/tag image mới |
| Compose project/service/port | `pgdcn_webapp` / `webapp` / `2357:2357` | Chưa preflight lần này |
| `/api/health`, `/api/db/health` host và container | HTTP 200 ở báo cáo lịch sử | Chưa gọi lần này |
| PCN/PGD/drafting smoke host và container | HTTP 200 ở báo cáo lịch sử | Chưa gọi lần này |
| 13 Supabase containers: IDs, health, mounts | 13/13 không đổi sau lần deploy lịch sử | Chưa kiểm tra lần này |

Không chạy `docker compose up`, down, rm hoặc prune; không restart Supabase/DB; không chạy migration, seed, restore hoặc thao tác volume. Không thay đổi database.

## Backup và rollback

Không tạo backup mới trong lần này do release gate BLOCKED. Backup dưới đây là artifact lịch sử trước lần deploy `ccda521`, không thay thế backup mới theo yêu cầu của một lần triển khai:

- DB lịch sử: `pcn_certification` trên `supabase-db`.
- Dump: `E:\CODING\PGDCN_webapp\backups\releases\20261020-ccda521\pcn_certification-predeploy.dump`.
- Kích thước/SHA-256: `604393` bytes / `A320E7A28EDCDD62031958248D7F99B31879E56F5148B2E287DC801B1E3E648E`.
- `pg_restore --list`: exit 0, 26 mục TOC theo báo cáo lịch sử; không chạy trong lần này.

Rollback image tag và compose override lịch sử, chưa kiểm tra lại trong lần này:

- Tag: `pgdcn_webapp-webapp:rollback-20261020-ccda521` (đã được báo cáo trỏ đúng baseline trước đó).
- Override: `E:\CODING\PGDCN_webapp\backups\releases\20261020-ccda521\rollback-image.override.yml`.
- Compose file: `E:\CODING\PGDCN_webapp\docker-compose.pcn.yml`.
- Env files đã dùng theo báo cáo lịch sử: `E:\CODING\PGDCN_webapp\.env` và `E:\CODING\TVCI_APP\supabase-docker\.env`; không đọc/in giá trị secrets lần này.
- Lệnh rollback nếu một lần phát hành được phép sau này:
  `docker compose --env-file E:\CODING\PGDCN_webapp\.env --env-file E:\CODING\TVCI_APP\supabase-docker\.env -p pgdcn_webapp -f E:\CODING\PGDCN_webapp\docker-compose.pcn.yml -f E:\CODING\PGDCN_webapp\backups\releases\20261020-ccda521\rollback-image.override.yml up -d --no-deps webapp`

Không rollback trong lần này; không cần khôi phục DB vì không có thao tác DB.

## Trạng thái workspace

Tại HEAD `e1b95cff71f6cb5511eebfdc096ad22722335399`, trước khi tạo handoff: 6 tracked files modified và 10 untracked paths. Handoff này được thêm dưới `docs/releases`, nên sau khi lưu: 6 tracked files modified và 11 untracked paths. Build/deploy không dùng workspace này. Handoff được commit riêng sau khi ghi nhận trạng thái trên; không push và không đưa các thay đổi dirty có sẵn vào commit.
