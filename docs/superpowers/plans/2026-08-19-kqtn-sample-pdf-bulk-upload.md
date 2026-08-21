<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch triển khai quản lý đầu mẫu KQTN, PDF và Bulk Upload
-->

# KQTN Sample PDF and Bulk Upload Implementation Plan

> **For agentic workers:** Execute this plan inline in the current workspace with TDD checkpoints.

**Goal:** Make KQTN operate on one shared sample head per encoded product, prevent duplicate results, support confirmed result overwrite, store result PDFs, and provide AI-assisted/manual bulk PDF mapping.

**Architecture:** Keep `requests` as the sample-head source of truth and join it with `kqtnRecords` by stable `requestId` and normalized `sampleKey`. Keep result overwrite/versioning in the Zustand store and expose PDF binary operations through Express backed by private Supabase Storage plus `file_assets` metadata. Bulk Upload reuses the single-PDF upload path after an explicit mapping/overwrite review.

**Tech Stack:** React/TypeScript, Zustand, Express, multer memory uploads, PostgreSQL JSONB/`file_assets`, private Supabase Storage REST client, Node test runner.

**Spec:** `docs/superpowers/specs/2026-08-19-kqtn-sample-pdf-design.md`

## Global Constraints

- `design.md` is the source of truth and already includes the approved KQTN design.
- `sampleCode` is required for saved KQTN results; one normalized `sampleKey` maps to one current result.
- Overwrite keeps the same record id, increments `version`, appends `versionHistory`, and never creates a duplicate row.
- PDF content is never stored as Base64 in JSONB; only private Storage plus `file_assets` metadata is persisted.
- Admin/Tester may mutate KQTN/PDF; Viewer/Guest are read-only.
- Every changed TS/TSX file keeps the required Gemini header/footer.
- Use TDD: each production helper/route contract starts with a failing test.

---

### Task 1: Add stable KQTN identity and PDF metadata types

**Files:**
- Create: `utils/kqtnIdentity.ts`
- Modify: `types.ts`
- Test: `test/kqtn-identity.test.ts`

**Interfaces:**
- `normalizeKqtnSampleKey(value: string): string`
- `getKqtnSampleCode(requestOrRecord): string`
- `KqtnPdfMetadata`

- [ ] Write tests for uppercase/diacritic/separator normalization, empty-code rejection, and request fallback selection order.
- [ ] Run `node --test test/kqtn-identity.test.ts`; confirm it fails because the helper/types do not exist.
- [ ] Implement the pure helper without importing React/store code.
- [ ] Add `requestId?`, required persisted `sampleKey` with legacy-compatible normalization at read boundaries, and optional `resultPdf?` to `KQTNRecord`.
- [ ] Run the focused test and typecheck.

### Task 2: Add deterministic bulk candidate matching

**Files:**
- Create: `utils/kqtnBulkMatching.ts`
- Test: `test/kqtn-bulk-matching.test.ts`

**Interfaces:**
- `KqtnBulkFileInspection`
- `KqtnBulkCandidate`
- `matchKqtnBulkFile(input): KqtnBulkMatch`

- [ ] Write tests for exact encoded-code match, model fallback, ambiguous matches, no match, and manual override preservation.
- [ ] Run the focused test and verify the expected RED failure.
- [ ] Implement normalized matching with exact code priority, model scoring second, and explicit `needsManualSelection` for ties/low confidence.
- [ ] Run the focused test and typecheck.

### Task 3: Enforce one result per sample and confirmed overwrite in the store

**Files:**
- Modify: `store.ts`
- Modify: `components/ReportGeneratorView.tsx`
- Modify: `components/KQTNView.tsx`
- Modify: `test/store-kqtn.test.ts` or create it if absent
- Test: `test/store-kqtn.test.ts`

**Interfaces:**
- Add `saveKqtnRecord(record, options?: { overwrite?: boolean; changeNote?: string }): Promise<{ record: KQTNRecord; overwritten: boolean }>` to `AppState`.
- Preserve existing `addKqtnRecord` as a compatibility wrapper that rejects duplicate `sampleKey` instead of silently adding another row.

- [ ] Write tests proving first save creates one record, duplicate save rejects without overwrite, overwrite keeps id/increments version, and the normalized key is used.
- [ ] Run the focused test and confirm RED.
- [ ] Implement shared save logic in the store; use `stripTransientKqtnImages`, activity logs and notifications consistently.
- [ ] Update ReportGenerator save to require non-empty code, locate the existing result, show a confirmation dialog before passing `overwrite: true`, and pass `requestId/sampleKey`.
- [ ] Update KQTN display derivation so request-backed sample heads appear once with `Chưa có KQTN`/existing-result status and legacy records remain visible.
- [ ] Run focused tests and typecheck.

### Task 4: Add private Supabase Storage runtime operations and PDF API

**Files:**
- Modify: `utils/supabaseStorage.ts`
- Modify: `server.ts`
- Modify: `sql/schema.sql`
- Modify: `docker-compose.yml`
- Modify: `docker-compose.supabase.yml`
- Create: `test/kqtn-pdf-api-contract.test.ts`

**Interfaces:**
- Extend the Storage client with `downloadObject`.
- Add `KQTN_PDF_MAX_BYTES = 25 * 1024 * 1024`.
- Add server routes:
  - `POST /api/kqtn/:recordId/pdf`
  - `GET /api/kqtn/:recordId/pdf`
  - `GET /api/kqtn/:recordId/pdf/download`
  - `DELETE /api/kqtn/:recordId/pdf`

- [ ] Write route/helper contract tests for PDF signature, MIME/size rejection, safe download names, and preserving the old pointer when replacement upload fails.
- [ ] Run the contract test and confirm RED.
- [ ] Implement runtime Storage configuration from `SUPABASE_STORAGE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_STORAGE_BUCKET`; do not hard-code secrets.
- [ ] Add/retain `file_assets` metadata fields/indexes needed for one active PDF per KQTN record.
- [ ] Implement upload transaction: validate memory buffer, upload new object, persist metadata/pointer, then delete old object; on failure retain old pointer.
- [ ] Implement inline/download streaming and delete cleanup; enforce Admin/Tester mutation and read access consistently with current auth conventions.
- [ ] Run the focused contract test, typecheck, and server build.

### Task 5: Add single-row PDF controls and Bulk Upload modal

**Files:**
- Create: `components/KqtnBulkPdfUploadModal.tsx`
- Create: `utils/kqtnPdfClient.ts`
- Modify: `components/KQTNView.tsx`
- Test: `test/kqtn-ui-contract.test.ts`

**Interfaces:**
- `uploadKqtnPdf(recordId, file, options): Promise<KqtnPdfMetadata>`
- `getKqtnPdfUrl(recordId, download?: boolean): string`
- `KqtnBulkPdfUploadModal` props: `isOpen`, `onClose`, `samples`, `onUploaded`.

- [ ] Write a contract test asserting the File PDF column, Upload/View/Overwrite/Download labels, and Bulk Upload header control.
- [ ] Run it and confirm RED.
- [ ] Implement single-row upload state, hidden PDF input, view/download links, and overwrite confirmation. Refresh the local KQTN record only after the API succeeds.
- [ ] Implement the modal file list with client validation, AI inspection using existing Gemini result extraction, deterministic candidate matching, manual sample selection, and per-file overwrite confirmation.
- [ ] Upload only explicitly mapped files through the shared PDF client; show per-file success/error state and allow retry without losing other mappings.
- [ ] Run UI contract tests and typecheck.

### Task 6: Legacy normalization, backup compatibility, and end-to-end verification

**Files:**
- Modify: `store.ts`
- Modify: `components/SettingsModal.tsx`
- Modify: `components/SystemManagementViews.tsx`
- Modify: `README.md` if runtime Storage env documentation is missing
- Create: `test/kqtn-legacy-normalization.test.ts`

- [ ] Write tests for legacy KQTN records without `sampleKey`, duplicate-key read collapse, and backup/restore preserving PDF metadata without embedding PDF bytes.
- [ ] Run focused tests and confirm RED.
- [ ] Implement read-time normalization and deterministic latest-record selection; do not silently delete legacy data.
- [ ] Ensure backup/restore and PostgreSQL upload retain `resultPdf` metadata while `stripTransientKqtnImages` still removes report images.
- [ ] Document required external Storage env variables and PDF backup boundary without adding secrets.
- [ ] Run all focused KQTN tests, `npm run typecheck`, `git diff --check` if git metadata is available, and `npm run build`.
- [ ] Inspect the final changed-file list and verify every requirement in the approved spec has a corresponding implementation/test.
