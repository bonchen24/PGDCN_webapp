<!--
Author: Gemini
OS support: Web/Node
Description: Shared working memory for the DDT Lab repository and GitHub workflow
-->

# DDT Lab — Shared Working Memory

> Vault: `E:\CODING\DDT_webapp\obsidian-vault`
> Last updated: 2026-08-24 (Asia/Ho_Chi_Minh)

## Project context

- Local workspace: `E:\CODING\DDT_webapp`
- GitHub account connected: `bonchen24`
- Target repository: [`bonchen24/DDT-app-v3.0`](https://github.com/bonchen24/DDT-app-v3.0)
- Project rules: `AGENTS.md` requires `design.md` to remain the single source of truth for architecture, data, UI/UX, and coding conventions.
- Ports: Local Dev (`npm run dev`) on `1359`, Docker Desktop Production on `2359`.

## 2026-08-24 — Form Báo cáo: Quy chuẩn Bảng Công suất nhiễu EMC chỉ hiển thị 1 hàng (tự động lấy hàng 1)

- Documented in `design.md`: Power Disturbance tables (`tablePower*`) across all EMC reports strictly display and persist **1 row only**.
- When uploading Radimation file or pasting data: automatically select only Row 1 and drop excess rows.
- Updated `EmcBepDien1VungNauForm.tsx` (`RadimationUploader`, `TablePowerDisturbance`, `handlePaste`) and `server.ts` (`.slice(0, 1)` for DOCX export).
- Verification: `test/report-docx-image-integration.test.ts` (12/12 pass), `npm run lint` (0 errors), `npm run build` (pass).

## 2026-08-24 — Form Báo cáo: Bổ sung mục 6.3.2.1 EMC Máy khoan (Công suất nhiễu 2 chiều quay)

- Updated Section 4.4 in `design.md` for dual-direction disturbance power testing on Handheld Drills (`emc_may_khoan`).
- `EmcBepDien1VungNauForm.tsx`: implemented dedicated Section 6 with 6.3.1 (quay cùng chiều kim đồng hồ -> 6.3.1.1 `powerDisturbance`, `tablePower`) and 6.3.2 (quay ngược chiều kim đồng hồ -> 6.3.2.1 `powerDisturbance_2`, `tablePower_2`).
- `public/maykhoan placeholder.docx` & `dist/maykhoan placeholder.docx`: synchronized template with both 6.3.1.1 (`image_6_3_1_1`, `table_6_3_1_1`) and 6.3.2.1 (`image_6_3_2_1`, `table_6_3_2_1`) blocks.
- Verification: all tests passed, `npm run lint` (0 errors), `npm run build` (pass).

## 2026-08-24 — Form Báo cáo: Bổ sung trường Phụ trách phòng TN (managerName) & Droplist chọn nhanh

- Updated Section 4.4 in `design.md` for dual signature fields (`testerName` and `managerName`).
- Added `managerName?: string;` to `KQTNRecord` in `types.ts`.
- `ReportGeneratorView.tsx`: added `managerName` to `reportMeta`, split signature section into 2 side-by-side columns with a quick-select `<select>` droplist for `managerName` filtering strictly for leadership positions (Trưởng phòng / Phó trưởng phòng: **Vũ Việt Anh**, **Lương Xuân Hùng**).
- `server.ts` (`POST /api/generate-docx`): mapped `managerName` and alias `managerNam` to docxtemplater render payload.
- `KQTNView.tsx`: displayed **Phụ trách PTN** in detail modal.
- Verification: `test/report-docx-image-integration.test.ts` & `test/report-docx-metadata.test.ts` pass, `npm run lint` (0 errors), `npm run build` (pass).

## 2026-08-24 — Docx Template Settings Modal and Code Conventions update

- Added Mục 4.6 in `design.md` and created `lib/reportTemplatesCatalog.ts` covering 43 DOCX templates.
- Added 4 backend endpoints in `server.ts` (`GET /api/templates`, `GET /api/templates/:filename/download`, `POST /api/templates/upload`, `POST /api/templates/:filename/reset`) with `.bak` automatic backup.
- Created `DocxSettingsModal.tsx` and integrated it into `ReportGeneratorView.tsx` with instant search, category filters, download, drag-and-drop replacement, and reset.
- Removed mandatory header/footer coding conventions from `AGENTS.md` and `design.md`.
- Verification: `test/docx-template-settings.test.ts` (4/4 pass), `test/report-*.test.ts` (9/9 pass), audit scripts (2/2 pass), `npm run lint` (0 errors), `npm run build` (pass).
- Production deployment: Docker Desktop container `ddt_webapp-webapp-1` recreated on port `2359`.

## 2026-08-20 — RequestModal draft persistence and reset

- Added the draft contract to `design.md`: new-request modal only, account-scoped IndexedDB, serializable business fields only, no OCR/image/UI transient state.
- Added `utils/requestDraft.ts` for normalized per-user keys and validated read/write/delete helpers.
- `RequestModal` auto-saves changed form data with debounce and flushes the latest changed payload when the user closes the modal; successful request save deletes the draft.
- On reopen, users can restore or delete a draft. `Xóa bản nháp` deletes local data, resets the visible form to the fresh-open state, and leaves the modal open.
- Verification: focused draft/save-sync tests `6/6`, `npm run lint`, and `npm run build` pass. Full suite `214/215` pass with the existing unrelated Compose assertion for `SUPABASE_SERVICE_ROLE_KEY`.
- Docker production was rebuilt and recreated; container `ddt_webapp-webapp-1` is up on `2359`, health endpoints return HTTP 200.

## 2026-08-20 — Request save sync optimization and production deployment

- Request save performance root cause was confirmed: `RequestModal` performed repeated full syncs around one save and loaded unrelated collections.
- `design.md` now requires a request-only pre-check and exactly one post-save full sync for the RequestModal flow.
- Implemented `fetchLatestRequests()` with local fallback on API failure; `addRequests(reqs, skipSync?)` supports scoped sync suppression, and only RequestModal uses `skipSync=true`.
- Regression coverage: `15/15` focused tests pass; `npm run lint` and production build pass. Full suite is `211/212` because of the unrelated existing Compose contract mismatch for `SUPABASE_SERVICE_ROLE_KEY`.
- Production Docker Desktop deployment completed with `docker-compose.supabase.yml`: image `ddt_webapp-webapp:latest`, container `ddt_webapp-webapp-1`, port `2359`.
- Post-deploy verification: container `Up`; `/api/health` and `/api/db/health` return HTTP 200; PostgreSQL collection `requests` returns `587` records.

## Work completed

1. Confirmed the connected GitHub account and selected `bonchen24/DDT-app-v3.0`.
2. Compared the local snapshot with GitHub `main`.
3. Created remote branch `agent/sync-local-snapshot`.
4. Committed the local application snapshot on that branch:
   - Commit: [`970c8d6`](https://github.com/bonchen24/DDT-app-v3.0/commit/970c8d6aa2429d324c71539f89d40b77e414af18)
   - Parent: `4e537ab74ec02f22d130eadf253a4dbc450f552f`
   - Commit message: `chore: sync local DDT app snapshot`
5. Verified the branch exists on GitHub and ran `npm run lint` successfully (`tsc --noEmit`, exit code 0).

## 2026-08-19 — DOCX dynamic label composite fix

- User requirement clarified: all optional label photos must be combined side-by-side in their numeric order and inserted only into the DOCX placeholder `anh_1`.
- Updated `design.md` before implementation to replace the old per-slot label mapping rule.
- Implemented composite PNG generation in `lib/reportDocxImageMapping.ts` with `Resvg`; each source image keeps its aspect ratio.
- Updated `server.ts` to generate one composite before DOCX rendering and removed hard-coded `data.anh_*` overwrites.
- Updated report payload fallback and UI field ordering in `components/ReportGeneratorView.tsx` and `components/EmcBepDien1VungNauForm.tsx`.
- Regression coverage now includes numeric label ordering, composite output, DOCX embedding, and server/template contracts.
- Verification recorded: focused DOCX/audit tests `8/8` pass, `npx tsc --noEmit` pass, `npm run build` pass. Full suite `199/200` pass; the remaining Compose assertion is a pre-existing unrelated `SUPABASE_SERVICE_ROLE_KEY` contract mismatch.

## Snapshot boundaries

- `main` was not changed; the commit is on `agent/sync-local-snapshot`.
- The local folder is still not a Git checkout (`git status` reports no `.git`), so future local commit/push operations need a clone or local Git initialization.
- Excluded for safety: `.env` changes, `service-account.json`, `tvci_backup_*.json`, `scratch/**`, SSH/deploy tooling, `PROJECT_MEMORY.md`, and files rejected by GitHub's sensitive-egress guard.
- `node_modules` and `dist` were not included.
- Remote-only content, including `LapBaoCao/**`, was removed from the snapshot branch because the selected scope was the full local snapshot.
- No pull request was opened.

## Collaboration rules for future work

- Read `AGENTS.md` and `design.md` before changing code.
- If a task changes business flow, schema, or UI, get confirmation and update `design.md` before implementation.
- Preserve the required file header/footer conventions for source files.
- Before committing, inspect scope, exclude secrets/generated artifacts, run the relevant checks, and verify the resulting GitHub commit.

## Next recommended action

Decide whether to:

- keep `agent/sync-local-snapshot` as the review branch and open a pull request, or
- initialize/clone the local workspace as a Git checkout and configure `origin` for ongoing local commits.

<!-- --- End of 00-Shared-Memory.md --- -->
