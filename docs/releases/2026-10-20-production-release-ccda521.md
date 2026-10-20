# Báo cáo triển khai production — 2026-10-20

**DEPLOYED: YES — container mới đang chạy và đã qua health/smoke checks.**

- Commit: `ccda52144313a304acc0827659b2b6af1930ee6b` (`test: align PGD review copy contract`), commit con trực tiếp của `d8dbcf0ccd6f1a637562ca0fda098ff217e05cd1`.
- Snapshot kiểm thử/build: `E:\CODING\_release_task_ccda521_wt_20261020`.
- Snapshot Docker context sạch: `E:\CODING\_release_deploy_ccda521_wt_20261020`; detached tại SHA trên, Git clean, không có `.env`, `.temp`, `node_modules`, `.next` hoặc untracked files khi bắt đầu build.

## Gate trước triển khai

| Kiểm tra | Kết quả |
|---|---:|
| `npm run typecheck` | PASS |
| `npm run test:pcn` | PASS — 922/922 |
| PGD/PGDCN + PCN-PGD + các test có tên `drafting` | PASS — 413/413 trên 116 file |
| `npm run build` | PASS — Next.js 16.3.7 |

Test PGD/drafting gồm `test/role-driven-drafting-review-ui.test.ts` vừa được sửa. Một lần thử ban đầu bằng `git archive` bị Windows `tar` làm sai tên file Unicode đã commit `BM-GĐ-07.19.docx`, khiến 4 test phụ thuộc template báo thiếu file. Mình bỏ snapshot archive đó và chạy lại toàn bộ gate trên Git worktree chuẩn; kết quả cuối cùng là 413/413.

## Docker và Compose

- Engine: Docker 29.8.2, context `desktop-linux`.
- Compose: v5.6.0. Buildx: v0.37.2, BuildKit v0.33.1, trạng thái `running`.
- Compose file: `E:\CODING\PGDCN_webapp\docker-compose.pcn.yml`.
- Project/service/port: `pgdcn_webapp` / `webapp` / `2357:2357`.
- Compose dùng hai file env: `E:\CODING\PGDCN_webapp\.env` và `E:\CODING\TVCI_APP\supabase-docker\.env`. Không ghi giá trị secret vào báo cáo.
- Build context override: `E:\CODING\PGDCN_webapp\backups\releases\20261020-ccda521\deploy-context.override.yml`, trỏ tới worktree Docker context ở trên.
- Đã chạy lệnh Compose `up -d --build --no-deps webapp` cho đúng project/service. PowerShell wrapper dừng khi nhận dòng progress `Image pgdcn_webapp-webapp Building` trên stderr nên không thu được exit code của Compose. Docker Engine đã thay container; trạng thái Compose sau đó là `Up`, image/container ID mới khác baseline, và mọi health/smoke checks đều đạt. Không có lỗi BuildKit EOF; không reset Docker/WSL.

## Baseline và kết quả triển khai

| | Baseline | Sau deploy |
|---|---|---|
| Container | `325e0ed1eec678aea3348a1ffa2337c130772585c547d422103f84c04f8a5fc1` | `1924c5fd13f2cb5914bc94368e9406dc38b6ae8671e47395ff43c68fc266d774` |
| Image ID | `sha256:47d3995f3c02fb7bb942ef4c8d1f584ed2bcc4bb132108745779325caedd1e8f` | `sha256:cc74b25d723647c35548d6279193b4d45aad43e16c4e0a3b2a11d52408d9b259` |
| Compose service | `pgdcn_webapp/webapp` | `pgdcn_webapp/webapp`, running |

Rollback tag đã tạo và xác minh trỏ đúng image baseline: `pgdcn_webapp-webapp:rollback-20261020-ccda521`.

## Health và smoke

| URL | Host | Trong container |
|---|---:|---:|
| `/api/health` | 200 | 200 |
| `/api/db/health` | 200 | 200 |
| `/pgdcn/pcn` | 200 | 200 |
| `/pgdcn/pgd` | 200 | 200 |
| `/pgdcn/pcn/drafting` | 200 | 200 |
| `/pgdcn/pgd/drafting` | 200 | 200 |

## Backup database và bảo toàn Supabase

- DB đích được xác nhận chính xác là `pcn_certification` trên `supabase-db`.
- Backup custom-format chỉ đọc: `E:\CODING\PGDCN_webapp\backups\releases\20261020-ccda521\pcn_certification-predeploy.dump`.
- Kích thước: 604,393 bytes. SHA-256: `A320E7A28EDCDD62031958248D7F99B31879E56F5148B2E287DC801B1E3E648E`.
- `pg_restore --list`: exit 0, 26 mục TOC. Không restore, migrate hoặc seed.
- Đã đối chiếu 13 container Supabase trước/sau theo container ID, image ID, state, health và mounts: **13/13 không đổi**. Không chạy lệnh down/prune/rm và không sửa DB/volume Supabase.
- Baseline và trạng thái sau deploy được lưu lần lượt ở `docker-baseline.json` và `docker-after.json` trong thư mục release backup.

## Rollback

Compose override rollback đúng service, dùng tag image baseline và bỏ cấu hình build:

`E:\CODING\PGDCN_webapp\backups\releases\20261020-ccda521\rollback-image.override.yml`

Lệnh rollback (nếu cần):

`docker compose --env-file E:\CODING\PGDCN_webapp\.env --env-file E:\CODING\TVCI_APP\supabase-docker\.env -p pgdcn_webapp -f E:\CODING\PGDCN_webapp\docker-compose.pcn.yml -f E:\CODING\PGDCN_webapp\backups\releases\20261020-ccda521\rollback-image.override.yml up -d --no-deps webapp`

## Git

Workspace gốc vẫn dirty như trước task: 6 file tracked đã sửa và 10 path untracked có sẵn; báo cáo này thêm một path untracked dưới `docs/releases`. Build/deploy dùng worktree detached riêng, vẫn clean. Không commit hoặc push.
