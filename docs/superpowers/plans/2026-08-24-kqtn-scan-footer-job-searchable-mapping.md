# KQTN Scan Footer Job and Searchable Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make large scanned combined PDFs practical to inspect by running one asynchronous footer-OCR job, and replace target-only dropdowns with searchable, filterable Mẫu thử mapping controls.

**Architecture:** The browser uploads a large combined PDF once as multipart form data to DDT and receives a `jobId`. The DDT server stores only the temporary in-memory source during the job, forwards it once to the shared TVCI PaddleOCR service's chunked footer endpoint, normalizes page results, and exposes polling status. The existing page-level OCR remains the fallback for small files and first-page identity extraction. Target mapping uses a focused React combobox backed by a pure normalized candidate-filter helper.

**Tech Stack:** TypeScript, Express, `multer`, `pdf-lib`, React, Node test runner, Python FastAPI, PaddleOCR.

**Spec:** `design.md` sections 7.3, 11.1, and 11.2.

## Global Constraints

- `design.md` remains the single source of truth.
- Large scan upload accepts up to 100 MB through multipart form data; the existing 25 MB limit for each stored result PDF remains unchanged.
- The OCR job must never send the 59 MB source PDF to Gemini and must not retain source bytes after the job finishes or expires.
- Footer OCR is a boundary signal only; uncertain results fall back to manual split and cannot auto-upload.
- Pending `sample-head:*` candidates remain visible as disabled targets and can never be uploaded to.
- Existing dirty-worktree changes are user-owned and must be preserved.

---

### Task 1: Lock the large-scan and searchable-mapping contracts with failing tests

**Files:**
- Modify: `design.md`
- Modify: `test/kqtn-pdf-api-contract.test.ts`
- Modify: `test/kqtn-paddleocr-contract.test.ts`
- Modify: `test/kqtn-ui-contract.test.ts`
- Create: `test/kqtn-candidate-filter.test.ts`

**Interfaces:**
- `POST /api/kqtn/ocr/footer-jobs` accepts multipart field `file` and returns `{ jobId, totalPages, status }` with HTTP 202.
- `GET /api/kqtn/ocr/footer-jobs/:jobId` returns `{ jobId, status, totalPages, processedPages, pages, error? }`.
- TVCI exposes `POST /ocr/pdf/footer-batch` with `chunk_size`, `dpi`, and `footer_ratio` query parameters.
- `filterKqtnBulkCandidates(candidates, query)` matches normalized tokens against sample code, report number, model, brand, sample name, and seal/stamp.

- [ ] **Step 1: Add the failing API and UI assertions.** Assert the job routes, multipart upload, polling status, TVCI batch endpoint, one-upload combined flow, and combobox semantics.
- [ ] **Step 2: Add failing pure filtering tests.** Cover Vietnamese diacritics/case normalization, matching each candidate field, empty-query ordering, and disabled pending candidates remaining in the result set.
- [ ] **Step 3: Run the focused tests and verify they fail because the new endpoints/helper/combobox are absent.**

### Task 2: Implement the shared TVCI chunked footer OCR endpoint

**Files:**
- Modify: `E:\CODING\TVCI_APP\ocr_service\main.py`
- Modify: `test/kqtn-paddleocr-contract.test.ts`

**Interfaces:**
- `POST /ocr/pdf/footer-batch` reads one PDF up to 100 MB, renders at most four pages per chunk, and returns `{ success, pages, total_pages, processing_time_s }`.
- Each page result contains `page`, `text`, `confidence`, and `word_count`.

- [ ] **Step 1: Run the new TVCI contract test and observe the expected failure.**
- [ ] **Step 2: Add the batch response model and a chunked implementation that calls `convert_from_bytes` only for the current page window, crops the footer before preprocessing, and releases the window before continuing.**
- [ ] **Step 3: Raise only the source-scan limit to 100 MB while keeping stored KQTN result limits in DDT unchanged; log total pages, chunk size, and elapsed time.**
- [ ] **Step 4: Run the Python syntax check and the focused contract test.**

### Task 3: Add DDT's asynchronous footer job and browser client

**Files:**
- Modify: `server.ts`
- Modify: `utils/kqtnPdfClient.ts`
- Modify: `test/kqtn-pdf-api-contract.test.ts`

**Interfaces:**
- `startKqtnFooterJob(file: File): Promise<{ jobId: string; totalPages: number }>` uploads the source once.
- `getKqtnFooterJob(jobId: string): Promise<KqtnFooterJobStatus>` polls the job.
- The server job forwards the uploaded buffer once to `/ocr/pdf/footer-batch`, parses `footerKey` with `extractKqtnFooterKey`, and expires its record after ten minutes.

- [ ] **Step 1: Add the in-memory job state types and request/response contract tests.**
- [ ] **Step 2: Implement the multipart 202 route with a 100 MB limit, PDF signature validation, page-count validation, and a bounded job map.**
- [ ] **Step 3: Implement the background runner with one internal OCR request, a 15-minute abort budget, normalized page results, per-page failure reporting, and cleanup of source bytes.**
- [ ] **Step 4: Implement the status route and browser client functions with explicit errors for failed/expired jobs.**
- [ ] **Step 5: Run focused API/client tests and `npm run lint`.**

### Task 4: Switch combined-PDF analysis to the job and keep first-page-only identity OCR

**Files:**
- Modify: `components/KqtnBulkPdfUploadModal.tsx`
- Modify: `test/kqtn-ui-contract.test.ts`

- [ ] **Step 1: Replace the 116-iteration page-level footer loop with one `startKqtnFooterJob(file)` call and bounded polling.**
- [ ] **Step 2: Convert completed job pages through `buildKqtnFooterSegments`, then OCR only each segment's first page with local PaddleOCR before Gemini fallback.**
- [ ] **Step 3: Preserve immediate manual fallback for job failure, missing pages, unstable footer keys, and ambiguous first-page metadata; display processed/total progress.**
- [ ] **Step 4: Run focused combined-flow tests and verify no combined path sends `extractKqtnBulkStructure` or loops over one-page footer requests.**

### Task 5: Replace target dropdowns with searchable/filterable comboboxes

**Files:**
- Create: `utils/kqtnCandidateFilter.ts`
- Create: `components/KqtnCandidateCombobox.tsx`
- Modify: `components/KqtnBulkPdfUploadModal.tsx`
- Create: `test/kqtn-candidate-filter.test.ts`
- Modify: `test/kqtn-ui-contract.test.ts`

**Interfaces:**
- `filterKqtnBulkCandidates(candidates: readonly KqtnBulkCandidate[], query: string): KqtnBulkCandidate[]` returns candidates whose normalized search tokens match any searchable field; it does not remove pending candidates.
- `KqtnCandidateCombobox` accepts `value`, `candidates`, `onChange`, and `disabled`, exposes `role="combobox"`/`role="listbox"`, and prevents selecting pending targets.

- [ ] **Step 1: Run the filter tests red.**
- [ ] **Step 2: Implement the normalized filter helper.**
- [ ] **Step 3: Implement keyboard/mouse combobox behavior, outside-click close, clear selection, result limit, status labels, and pending-disabled rendering.**
- [ ] **Step 4: Replace both single-file and combined mapping calls while preserving duplicate-target and overwrite guards.**
- [ ] **Step 5: Run focused UI/filter tests and `npm run lint`.**

### Task 6: Verify, build, and deploy the production containers

- [ ] Run `npm test` and confirm zero failures.
- [ ] Run `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Run the TVCI Python AST check and rebuild/recreate `tvci_ocr_service` with the named model-cache volumes.
- [ ] Build/recreate DDT production on Docker Desktop port `2359`.
- [ ] Smoke-test the job start/status flow, a multi-page footer batch, and the searchable mapping contract; inspect Docker logs for request size, OCR duration, and job completion.
