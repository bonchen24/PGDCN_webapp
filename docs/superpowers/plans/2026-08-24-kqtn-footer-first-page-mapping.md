# KQTN Footer-First Mapping Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce Gemini load for KQTN bulk upload by detecting combined-PDF boundaries from repeated footer identifiers and OCRing only each segment's first page for sample mapping.

**Architecture:** Add a footer-only analysis mode to the existing bounded bulk-structure endpoint. The browser sends larger footer-analysis batches, turns stable footer changes into candidate segments, then calls the existing single-page metadata endpoint once per segment; ambiguous or incomplete footer detection remains manual. Individual-PDF bulk mapping continues to OCR only page one.

**Tech Stack:** TypeScript, Express, `@google/genai`, React, Node test runner, `pdf-lib`.

**Spec:** `design.md` section 11.2 and `docs/superpowers/specs/2026-08-22-kqtn-combined-pdf-bulk-upload-design.md`.

## Global Constraints

- `design.md` remains the single source of truth.
- Footer identifiers are candidate boundaries only; no uncertain segment may auto-upload.
- Footer analysis and structure analysis share the 45-second bounded request contract and do not retry page-by-page after timeout.
- Existing uncommitted user changes must be preserved.
- No new runtime dependency or `.env` change.

### Task 1: Lock footer-first contracts with failing tests

**Files:**
- Modify: `test/kqtn-pdf-api-contract.test.ts`
- Modify: `test/kqtn-ui-contract.test.ts`
- Modify: `test/kqtn-bulk-scan.test.ts`

- [x] **Step 1: Write failing tests** for the footer request mode, footer response field, footer batch size, first-page metadata call after segmentation, and stable repeated-footer boundary behavior.
- [x] **Step 2: Run the focused tests** and confirm they fail because the footer API/client/helper/UI flow is absent.

### Task 2: Add footer-only API and browser client

**Files:**
- Modify: `server.ts`
- Modify: `utils/kqtnPdfClient.ts`
- Modify: `utils/kqtnBulkSplit.ts`

- [x] **Step 1: Add `footerKey` to page metadata and `footer` to segment detection types.**
- [x] **Step 2: Add `extractKqtnBulkFooter`** using the existing endpoint with `mode: 'footer'` and the same timeout handling.
- [x] **Step 3: Add the footer-only prompt/schema branch** that ignores page numbers and returns one page record per input page.
- [x] **Step 4: Add `buildKqtnFooterSegments`** that requires a footer key to repeat on the next page before creating a boundary, trims trailing blank pages, and returns a manual segment if the first boundary is not reliable.
- [x] **Step 5: Run the focused API/helper tests** and confirm they pass.

### Task 3: Replace combined full-page scanning with footer-first mapping

**Files:**
- Modify: `components/KqtnBulkPdfUploadModal.tsx`

- [x] **Step 1: Replace two-page structure batches with bounded footer batches.**
- [x] **Step 2: Build candidate ranges from footer pages and create initial review segments without filename-based auto-mapping.**
- [x] **Step 3: Extract only each segment's first page and call `extractKqtnPdfMetadata` to enrich the segment before matching.**
- [x] **Step 4: Preserve manual fallback for timeout, missing pages, unstable footer keys, and first-page OCR errors.**
- [x] **Step 5: Run focused UI and workflow tests.**

### Task 4: Verify the complete change

- [x] Run `npm test -- --test-name-pattern "footer|first page|combined structure timeout|bulk file selection"`.
- [x] Run `npm test` (271/271 passing).
- [x] Run `npm run lint`.
- [x] Run `npm run build`.
- [x] Run `git diff --check`.
- [x] Review the final diff to ensure unrelated dirty-worktree changes remain untouched.
