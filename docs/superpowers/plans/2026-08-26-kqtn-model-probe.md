# KQTN combined model probe implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Use footer OCR only for combined-PDF grouping and read a bounded number of first pages in each group to normalize and match the target model.

**Architecture:** Keep footer detection and model recognition separate. After footer ranges are built, create at most three one-page probe PDFs per range and OCR them with the existing Paddle page endpoint, stopping at the first usable model. Match the extracted model through the existing candidate matcher while retaining footer identifiers only as report/group metadata.

**Tech Stack:** React, TypeScript, `pdf-lib`, PaddleOCR HTTP endpoints, Node test runner.

**Spec:** `design.md` sections 11.1 and 11.2.

## Global Constraints

- Footer is the source for group boundaries and page-count warnings; it must not be compared with a candidate model.
- Combined PDF probing is bounded to three first pages per group and must not call Gemini or OCR the entire group.
- Missing or ambiguous model recognition keeps manual mapping available and does not block split/save after mapping.
- Footer/page-count mismatches remain warnings only.

---

### Task 1: Update the authoritative design and define testable model-probe helpers

**Files:**
- Modify: `design.md:641-669`
- Create: `utils/kqtnBulkModelProbe.ts`
- Test: `test/kqtn-bulk-model-probe.test.ts`

**Interfaces:**
- `getKqtnModelProbePageNumbers(pageStart: number, pageEnd: number, maxPages?: number): number[]`
- `extractKqtnModelFromProbeTexts(texts: readonly string[]): string`

- [x] **Step 1: Write failing tests** for three-page bounds, empty/short ranges, first usable model selection, and footer text not being treated as model text.
- [x] **Step 2: Run the focused test** and confirm it fails because the helper module is absent.
- [x] **Step 3: Update `design.md`** to document footer-only grouping plus bounded first-page model probing.
- [x] **Step 4: Implement the helpers** using existing `parseKqtnOcrMetadata` and normalized model extraction.
- [x] **Step 5: Run the focused test** and confirm it passes.

### Task 2: Prevent footer identifiers from matching candidate models

**Files:**
- Modify: `utils/kqtnBulkMatching.ts:50-83`
- Test: `test/kqtn-bulk-matching.test.ts`

**Interfaces:**
- Preserve `matchKqtnBulkFile` for both single-file metadata and combined model-probe metadata.

- [x] **Step 1: Add a failing regression test** showing a footer report identifier that equals a candidate model does not produce an identity match.
- [x] **Step 2: Run that test** and confirm the current matcher incorrectly matches it.
- [x] **Step 3: Separate code/report identity fields from model fallback** in the matcher.
- [x] **Step 4: Run the matching tests** and confirm footer identity and standalone model matching both remain correct.

### Task 3: Probe the first three pages of each combined group and map by model

**Files:**
- Modify: `components/KqtnBulkPdfUploadModal.tsx:20-190,314-370`
- Modify: `test/kqtn-ui-contract.test.ts`

**Interfaces:**
- Reuse `createPdfSegmentFile`, `extractKqtnPageTextWithPaddle`, `parseKqtnOcrMetadata`, and the Task 1 helpers.

- [x] **Step 1: Add failing UI contract assertions** for bounded probe page selection, Paddle page OCR in the combined analysis path, and footer key not being passed as model metadata.
- [x] **Step 2: Run the focused UI contract test** and confirm it fails against the current no-probe combined flow.
- [x] **Step 3: Implement bounded probes** with a small concurrency limit, early stop after a usable model, and manual fallback when no model is found.
- [x] **Step 4: Match each segment with footer code/report fields plus the probed model, without using the footer key as model.
- [x] **Step 5: Run focused tests** and confirm the combined mapping contract passes.

### Task 4: Verify the complete change

**Files:**
- No additional source files.

- [x] **Step 1: Run `node --require .\\scripts\\native-dev-preload.cjs .\\node_modules\\tsx\\dist\\cli.mjs --test` and record the result: 325 tests passed.
- [x] **Step 2: Run `npx tsc --noEmit` and `npm run build`.
- [x] **Step 3: Run `git diff --check` and inspect the final diff for unrelated changes.
