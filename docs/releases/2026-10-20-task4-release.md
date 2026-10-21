# PGDCN Web App — TASK 4 RELEASE

**Ngày:** 2026-10-20  
**Trạng thái:** **BLOCKED — không triển khai, không rollback**  
**Commit kiểm tra:** `d8dbcf0ccd6f1a637562ca0fda098ff217e05cd1`  
**Branch:** `master`, ahead `origin/master` 25 commit

## Commit đã xác minh

Snapshot release dùng detached worktree tại `E:\CODING\_release_task4_d8dbcf0`, tạo từ commit trên. Trước khi cài dependency và chạy kiểm tra, Git status sạch; không có `.env`, `.temp`, hoặc thư mục `secrets/credentials`. Có file mẫu tracked `.env.example`.

Đã đối chiếu ba commit sau mốc bị BLOCKED `4ec0a18f28474b181a5a8cc446143418a0283765`:

- `ec9f66a96f1ffd2f58d70e028d6749dc5f2f65c5` — căn chỉnh test scroll và quick action PCN.
- `0e28380bb6a08b35d9208f923f7d811f2d417639` — thêm PUT settings PCN với kiểm tra admin, transaction và audit.
- `d8dbcf0ccd6f1a637562ca0fda098ff217e05cd1` — thêm trạng thái processing cho thao tác bước PGD.

`git diff --check 4ec0a18..HEAD`: PASS.

## Kiểm tra trên snapshot commit

| Kiểm tra | Kết quả |
|---|---|
| `npm run typecheck` | PASS, exit 0 |
| `npm run test:pcn` | PASS, 922/922, 0 lỗi |
| PGD/drafting trực tiếp (8 file liên quan step panel, workflow và drafting) | PASS, 19/19, 0 lỗi |
| Bộ rộng PGD/drafting (100 file) | **FAIL**, 332/333; 1 lỗi |
| `npm run build` | PASS, exit 0; Next.js 16.3.7, 41 trang tĩnh được tạo |

Test lỗi: `test/role-driven-drafting-review-ui.test.ts:21`, `active dossier panels expose role-aware review copy`. Assertion yêu cầu chuỗi `Soát xét hồ sơ` trong `components/PgdDossierStepWorkPanel.tsx`; chuỗi này không có trong component hiện tại. Đây là test thuộc phạm vi PGD. Theo điều kiện release đã giao, một test thất bại làm release BLOCKED.

Build sinh `.temp/` và cập nhật `next-env.d.ts` trong detached worktree sau khi kiểm tra sạch ban đầu. Các phát sinh này nằm ngoài repo làm việc chính. Không dùng worktree này làm Docker context.

## Docker, DB và health

Docker gate chưa được chạy vì test gate thất bại:

- Không kiểm tra Docker Engine/BuildKit, Compose config, 13 container Supabase hoặc network.
- Không build/tag image; không tạo rollback tag hoặc rollback compose.
- Không tạo backup DB; không chạy `pg_restore --list`, không ghi nhận SHA mới.
- Không gọi health endpoint hoặc smoke PCN/PGD/drafting trong container/host.
- Không chạy compose up/down, migration, seed, restore hoặc thao tác DB/volume.

Giá trị dưới đây chỉ là baseline lịch sử từ report trước đó, chưa xác minh lại lần này: container `pcn_webapp-webapp`, container ID `325e0ed1eec678aea3348a1ffa2337c130772585c547d422103f84c04f8a5fc1`; image ref `pgdcn_webapp-webapp`, image ID `sha256:47d3995f3c02fb7bb942ef4c8d1f584ed2bcc4bb132108745779325caedd1e8f`. Report trước ghi host và container trả HTTP 200 cho `/api/health` và `/api/db/health`, 13 dịch vụ Supabase Up (11 healthy, 2 không khai báo healthcheck). Các mã HTTP này không phải kết quả của lần kiểm tra hiện tại.

Backup mới: **không có**. SHA/pg_restore list: **chưa chạy**. Rollback tag/compose: **không tạo**. Image mới: **không có**. HTTP codes lần này: **chưa kiểm tra**. DB/volume không bị tác động trong lượt này.

## Dirty tree repo chính

Tại thời điểm trước khi tạo report: 6 tracked files modified, 0 staged; 195 untracked files.

Tracked modified:

- `.agents/teamwork/BRIEFING.md`
- `.agents/teamwork/ORIGINAL_REQUEST.md`
- `.agents/teamwork/handoff.md`
- `AGENTS.md`
- `package.json`
- `package-lock.json`

Untracked theo nhóm:

- `.agents/skills/archify`: 157
- `.agents/teamwork/explorer_api_contracts`: 12
- `.agents/teamwork/explorer_data_lifecycle`: 5
- `.agents/teamwork/explorer_ui_cards`: 5
- `.agents/teamwork/orchestrator_2`: 6
- `.agents/teamwork/victory_auditor_2`: 4
- `.temp`: 4
- `components/PcnLoginScreen.tsx.orig`: 1
- `skills-lock.json`: 1

Report này tạo thêm một untracked file tại `docs/releases/2026-10-20-task4-release.md`. Không commit hoặc push. Dirty files ban đầu không bị sửa bởi lượt release này.

