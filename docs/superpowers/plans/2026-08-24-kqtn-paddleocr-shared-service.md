# KQTN Shared PaddleOCR Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragile Gemini PDF footer scanning with the existing TVCI PaddleOCR service, while keeping Gemini as a fallback for ambiguous first-page metadata.

**Architecture:** `tvci_ocr_service` exposes page and footer OCR endpoints on the internal `supabase_default` Docker network. DDT’s server proxies base64 one-page PDFs to that service, the browser flow uses local OCR text for footer segmentation and first-page matching, and calls the existing Gemini metadata endpoint only when local OCR cannot produce a usable match.

**Tech Stack:** FastAPI, PaddleOCR, pdf2image/Poppler, Node/Express, TypeScript, pdf-lib, Docker Compose, Node test runner.

**Spec:** `E:\CODING\DDT_webapp\design.md` sections 7.3 and 11.2.

## Global Constraints

- OCR service remains internal-only; DDT reaches it as `http://tvci_ocr_service:8100` on `supabase_default`.
- Footer OCR receives one page and crops the bottom 20% before PaddleOCR; it never sends a combined scan to Gemini.
- A missing/low-confidence OCR result must preserve manual split/mapping; it must not auto-upload.
- Existing Gemini metadata extraction remains available as a fallback.
- Preserve unrelated dirty worktree changes in both repositories.
- All new source files follow the existing UTF-8 header/footer conventions.

---

### Task 1: Define the shared OCR contract and tests

**Files:**
- Modify: `E:\CODING\DDT_webapp\test\kqtn-pdf-api-contract.test.ts`
- Create: `E:\CODING\DDT_webapp\test\kqtn-paddleocr-contract.test.ts`
- Modify: `E:\CODING\TVCI_APP\ocr_service\main.py`
- Modify: `E:\CODING\TVCI_APP\docker-compose.yml`

**Interfaces:**
- `POST /ocr/pdf/footer?page=1&footer_ratio=0.2` returns `{ success, page, text, confidence, processing_time_s }`.
- `POST /ocr/pdf/page?page=1` returns the same shape without footer cropping.
- `OCR_SERVICE_URL` points DDT to `http://tvci_ocr_service:8100`.

- [ ] Write static contract tests for the two FastAPI routes, crop ratio, and Docker network attachment.
- [ ] Run the focused contract tests and confirm they fail because the routes/network are absent.

### Task 2: Add PaddleOCR page/footer endpoints

**Files:**
- Modify: `E:\CODING\TVCI_APP\ocr_service\main.py`

**Interfaces:**
- Add one helper that renders only the requested PDF page with `convert_from_bytes(first_page=page, last_page=page, dpi=150)`.
- Add one helper that crops `footer_ratio` of the image height, preprocesses it, and returns OCR text/confidence.
- Add `/ocr/pdf/footer` and `/ocr/pdf/page` using the response contract from Task 1.

- [ ] Implement the smallest helper and endpoint changes needed for page/footer OCR.
- [ ] Run the focused contract tests and confirm they pass.

### Task 3: Make the shared service reachable from DDT Docker

**Files:**
- Modify: `E:\CODING\TVCI_APP\docker-compose.yml`
- Modify: `E:\CODING\DDT_webapp\docker-compose.yml`
- Modify: `E:\CODING\DDT_webapp\docker-compose.supabase.yml`

**Interfaces:**
- `ocr_service` joins both `tvci_app_app_network` and external `supabase_default`.
- DDT `webapp` receives `OCR_SERVICE_URL=http://tvci_ocr_service:8100`.
- No host port is published for PaddleOCR.

- [ ] Add the external network to the TVCI OCR service while preserving its existing app network.
- [ ] Add the DDT environment variable to both production compose definitions.
- [ ] Run compose config validation for both repositories without exposing secret values.

### Task 4: Add DDT server proxy and OCR client

**Files:**
- Modify: `E:\CODING\DDT_webapp\server.ts`
- Modify: `E:\CODING\DDT_webapp\utils\kqtnPdfClient.ts`
- Create: `E:\CODING\DDT_webapp\utils\kqtnOcrMetadata.ts`
- Modify: `E:\CODING\DDT_webapp\test\kqtn-pdf-api-contract.test.ts`
- Create: `E:\CODING\DDT_webapp\test\kqtn-ocr-metadata.test.ts`

**Interfaces:**
- `POST /api/kqtn/ocr/footer` accepts `{ base64Data, pageNumber }` and proxies multipart PDF to `/ocr/pdf/footer`.
- `POST /api/kqtn/ocr/page` accepts `{ base64Data, pageNumber }` and proxies multipart PDF to `/ocr/pdf/page`.
- Browser functions `extractKqtnFooterWithPaddle` and `extractKqtnPageTextWithPaddle` return typed OCR responses.
- `extractKqtnFooterKey(text)` removes page numbers/date-only lines and returns a stable normalized candidate or an empty string.
- `parseKqtnOcrMetadata(text)` extracts label-based `sampleCode`, `model`, and `brand` candidates without inventing values.

- [ ] Write tests for footer-key normalization and label-based metadata parsing, including no-key/manual cases.
- [ ] Run the focused tests and confirm the new functions/routes fail before implementation.
- [ ] Implement server proxy, timeout/error mapping, browser clients, and pure OCR text parsers.
- [ ] Run the focused tests and confirm they pass.

### Task 5: Switch combined and single-file flows to OCR-first

**Files:**
- Modify: `E:\CODING\DDT_webapp\components\KqtnBulkPdfUploadModal.tsx`
- Modify: `E:\CODING\DDT_webapp\test\kqtn-ui-contract.test.ts`
- Modify: `E:\CODING\DDT_webapp\test\kqtn-bulk-scan.test.ts`

**Interfaces:**
- Combined footer pass calls PaddleOCR for each one-page footer PDF and uses `buildKqtnFooterSegments` unchanged.
- Segment first-page OCR uses PaddleOCR metadata; if matching fields are empty/ambiguous, it calls `extractKqtnPdfMetadata` as fallback.
- Single-file first-page inspection follows the same OCR-first/fallback behavior.

- [ ] Change the failing UI contract tests to require PaddleOCR calls before Gemini calls.
- [ ] Run the focused UI tests and confirm they fail against the current Gemini-first flow.
- [ ] Implement OCR-first sequencing with existing manual fallback states preserved.
- [ ] Run focused bulk scan/UI tests and confirm they pass.

### Task 6: Build and deploy both Docker services

**Files:**
- No additional source files.

- [ ] Start/recreate `tvci_ocr_service` with the shared network and wait for `/health`.
- [ ] Build/recreate DDT production image with the local Supabase credentials already required by Docker Desktop.
- [ ] Verify `http://tvci_ocr_service:8100/health` from the DDT container and DDT `/api/db/health`.
- [ ] Run full `npm test`, `npm run lint`, `npm run build`, and `git diff --check`.
- [ ] Read Docker logs and verify OCR request timing/status without logging PDF contents or credentials.
