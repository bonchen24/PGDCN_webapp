# DDT_webapp — Docx Template Settings Modal & Code Conventions Update

> Date: 2026-08-24 (Asia/Ho_Chi_Minh)
> Workspace: `E:\CODING\DDT_webapp`

## Change summary

### 1. Docx Template Settings Modal (`DocxSettingsModal`)
- Added **Mục 4.6** to `design.md` specifying UI/UX, template classification, and REST API contracts for DOCX template management.
- Created `lib/reportTemplatesCatalog.ts` centralizing metadata for all **43 DOCX templates**:
  - **An toàn điện (TCVN 5699)**: 8 standards with full and reduced variants.
  - **Tương thích điện từ (EMC - QCVN 9:2012/BKHCN)**: 23 templates across all appliance types and suboptions.
  - **Dây cáp điện (TCVN 6610-3/5)**: Full & reduced templates.
  - **Hồ sơ chung**: Phiếu yêu cầu thử nghiệm (`DDT_PYC.docx`), Biên bản giao nhận mẫu (`GiaoNhanMau.docx`).
- Implemented 4 backend REST API endpoints in `server.ts`:
  - `GET /api/templates`: List metadata (filename, standard name, device name, size, last modified, backup status).
  - `GET /api/templates/:filename/download`: Download existing `.docx` template file.
  - `POST /api/templates/upload`: Upload replacement `.docx` template file with automatic `.bak` backup creation and sync.
  - `POST /api/templates/:filename/reset`: Restore original template from backup.
- Created `components/DocxSettingsModal.tsx` and integrated it into `components/ReportGeneratorView.tsx` with a header button ("Cài đặt docx").
- Supports instant search, category filtering (`Tất cả`, `An toàn điện`, `EMC`, `Dây cáp điện`, `PYC / BMGN`), 1-click download, upload, drag-and-drop replacement, and reset.

### 2. Code Conventions Update
- Removed mandatory header (`// Author: Gemini`) and footer (`// --- End of [filename] ---`) requirement upon user request.
- Updated `AGENTS.md` and `design.md` (Section 8) accordingly.

### 3. Port & Operational Memory
- Explicitly documented:
  - **Dev Server**: Runs on port **`1359`** (`http://localhost:1359`).
  - **Production Docker Desktop**: Runs on port **`2359`** (`http://localhost:2359`).

## Verification

- `test/docx-template-settings.test.ts`: `4/4` pass.
- All report tests (`test/report-*.test.ts`): `9/9` pass.
- Field audit scripts: `2/2` pass.
- `npm run lint` (`tsc --noEmit`): **0 errors**.
- `npm run build`: pass.

## Production deployment

- Built `ddt_webapp-webapp:latest` and recreated container `ddt_webapp-webapp-1` with `docker-compose.supabase.yml`.
- Container published on `2359:2359`.
- Health endpoints: `/api/health` HTTP 200, `/api/db/health` HTTP 200.
