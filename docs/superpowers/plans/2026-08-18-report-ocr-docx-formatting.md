<!--
Author: Gemini
OS support: Web/Node
Description: Implementation plan for report OCR, DOCX metadata and graph formatting fixes
-->

# Report OCR, DOCX and Formatting Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with review checkpoints. Steps use checkbox syntax for tracking.

**Goal:** Make report dates, nameplate OCR fields, seal-stamp DOCX mapping and EMC graph sizing correct and regression-tested.

**Architecture:** Add small pure helpers for report formatting, nameplate OCR normalization, DOCX metadata preparation and graph sizing. Wire those helpers into the existing `ReportGeneratorView`, `EmcBepDien1VungNauForm` and `/api/generate-docx` flow without changing the business schema or replacing the existing DOCX templates.

**Tech Stack:** TypeScript, React, Express, Docxtemplater, Node test runner via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-08-18-report-ocr-docx-formatting-design.md`, plus the project contract in `design.md`.

## Global Constraints

- Use `design.md` as the source of truth for report behavior and DOCX dimensions.
- Missing manufacturer, country and five rated technical fields must render as `N/A`; missing dates must not be guessed.
- English report dates use `Month DD, YYYY`, for example `August 18, 2026`.
- DOCX graphs use width `624px` (`165mm` at 96 DPI) and preserve the source aspect ratio.
- Keep current `EmcData` field names and current DOCX templates backward compatible.
- Every touched JS/TS/TSX/Markdown file must retain the required Gemini header and filename footer.

---

### Task 1: Add pure report-formatting and OCR normalization helpers

**Files:**
- Create: `lib/reportFormatting.ts`
- Test: `test/report-formatting.test.ts`

**Interfaces:**
- `formatReportEnglishDate(value: unknown): string` returns `August 18, 2026` for ISO or Vietnamese dates and returns an empty string for invalid input.
- `formatBilingualReportDate(value: unknown): string` returns `Hà Nội, ngày 18 tháng 08 năm 2026 (Hanoi, August 18, 2026)` for a valid date.
- `normalizeNameplateOcrValues(input): { manufacturer: string; countryOfOrigin: string; power: string; voltage: string; current: string; frequency: string; clockFreq: string }` trims values and replaces missing values with `N/A`.

- [ ] **Step 1: Write the failing tests**

```ts
test('formats an ISO report date with an English month name', () => {
  assert.equal(formatReportEnglishDate('2026-08-18'), 'August 18, 2026');
});

test('formats a Vietnamese report date with an English month name', () => {
  assert.equal(formatReportEnglishDate('18/08/2026'), 'August 18, 2026');
});

test('returns N/A for missing nameplate fields', () => {
  assert.deepEqual(normalizeNameplateOcrValues({ voltage: '220V' }), {
    manufacturer: 'N/A', countryOfOrigin: 'N/A', power: 'N/A', voltage: '220V',
    current: 'N/A', frequency: 'N/A', clockFreq: 'N/A',
  });
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/report-formatting.test.ts`

Expected: FAIL because `lib/reportFormatting.ts` does not exist yet.

- [ ] **Step 3: Implement the minimal helpers**

Use an explicit English month array and strict `YYYY-MM-DD` / `DD/MM/YYYY` parsing. Do not use the browser locale because it can vary by machine. Treat `null`, `undefined`, whitespace and invalid dates as missing.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- test/report-formatting.test.ts`

Expected: PASS with all date and `N/A` assertions passing.

- [ ] **Step 5: Commit**

No repository commit is available in this workspace; leave the focused test and helper ready for the next task.

### Task 2: Add DOCX metadata preparation and regression tests

**Files:**
- Create: `lib/reportDocxMetadata.ts`
- Test: `test/report-docx-metadata.test.ts`

**Interfaces:**
- `buildReportDocxMetadata(input): ReportDocxMetadata` consumes `reportMeta`, `ocrData` and `emcData` and produces normalized `reportDate`, `sealStamp`, legacy `codingNumber`, `manufacturer`, `countryOfOrigin`, `emcPower`, `emcVoltage`, `emcCurrent`, `emcFrequency` and `emcClockFreq`.
- `sealStamp` is the source of truth; `codingNumber` is populated with the same seal value solely for current templates whose “Tem niêm phong” label still contains `{codingNumber}`.

- [ ] **Step 1: Write the failing tests**

```ts
test('maps sealStamp into the legacy codingNumber placeholder', () => {
  const metadata = buildReportDocxMetadata({
    reportMeta: { rawReportDate: '2026-08-18', sealStamp: 'IEMM-8891', codingNumber: '01-EMC-26' },
    emcData: {},
  });
  assert.equal(metadata.sealStamp, 'IEMM-8891');
  assert.equal(metadata.codingNumber, 'IEMM-8891');
});

test('normalizes missing OCR report fields to N/A', () => {
  const metadata = buildReportDocxMetadata({ reportMeta: {}, ocrData: {}, emcData: { voltage: '220V' } });
  assert.equal(metadata.manufacturer, 'N/A');
  assert.equal(metadata.countryOfOrigin, 'N/A');
  assert.equal(metadata.emcPower, 'N/A');
  assert.equal(metadata.emcVoltage, '220V');
  assert.equal(metadata.emcCurrent, 'N/A');
  assert.equal(metadata.emcFrequency, 'N/A');
  assert.equal(metadata.emcClockFreq, 'N/A');
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/report-docx-metadata.test.ts`

Expected: FAIL because the helper is not implemented.

- [ ] **Step 3: Implement the helper**

Use `formatBilingualReportDate` for `rawReportDate`, accept `countryOfOrigin` and legacy `origin`, prefer `emcData` over `ocrData` for rated fields, and use `N/A` only for the seven requested nameplate fields. Keep `sealStamp` empty when absent so the existing “no seal” display behavior remains intact.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- test/report-docx-metadata.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

No repository commit is available in this workspace; retain the helper and regression test.

### Task 3: Add graph sizing helper and tests

**Files:**
- Create: `lib/reportDocxImageSizing.ts`
- Test: `test/report-docx-image-sizing.test.ts`

**Interfaces:**
- `DOCX_GRAPH_WIDTH_PX = 624`.
- `getDocxGraphSize(width: number, height: number): [number, number]` returns `[624, Math.round(height * (624 / width))]` for valid dimensions.

- [ ] **Step 1: Write the failing tests**

```ts
test('uses 624px for a graph and preserves a 16:9 ratio', () => {
  assert.deepEqual(getDocxGraphSize(1600, 900), [624, 351]);
});

test('preserves a portrait graph ratio', () => {
  const [width, height] = getDocxGraphSize(1000, 1400);
  assert.equal(width, 624);
  assert.equal(height / width, 1.4);
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/report-docx-image-sizing.test.ts`

Expected: FAIL because the sizing helper is not implemented.

- [ ] **Step 3: Implement the helper**

Return a safe `[624, 351]` fallback for non-positive dimensions and round only the computed height.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- test/report-docx-image-sizing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

No repository commit is available in this workspace; retain the helper and test.

### Task 4: Wire OCR results into the report form

**Files:**
- Modify: `components/EmcBepDien1VungNauForm.tsx`
- Modify: `components/ReportGeneratorView.tsx`
- Modify: `server.ts`
- Test: `test/report-ocr-integration.test.ts`

**Interfaces:**
- Add optional `onNameplateOcr?: (values: { manufacturer: string; countryOfOrigin: string }) => void` to the EMC form props.
- `EmcBepDien1VungNauForm` normalizes the five rated fields to `N/A` after OCR and calls the callback with manufacturer/country values.
- `ReportGeneratorView` writes callback values into `reportMeta.manufacturer` and `reportMeta.countryOfOrigin` and passes `ocrData` into the DOCX request unchanged for fallback use.

- [ ] **Step 1: Write the failing integration-contract tests**

Assert that the component source exposes the callback, that the OCR handler calls `normalizeNameplateOcrValues`, and that the server OCR schema/prompt accepts `countryOfOrigin` while preserving the legacy `origin` alias.

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/report-ocr-integration.test.ts`

Expected: FAIL because the callback and schema wiring are not present.

- [ ] **Step 3: Implement the minimal wiring**

Import the normalization helper in the EMC form, replace blank rated fields after OCR with normalized values, call the parent callback, and update the parent `reportMeta`. Update the Gemini OCR prompt/schema to name `countryOfOrigin` explicitly and keep `origin` as a compatibility fallback.

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `npm test -- test/report-ocr-integration.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

No repository commit is available in this workspace; retain the integration changes.

### Task 5: Wire DOCX metadata and graph sizing into the server route

**Files:**
- Modify: `server.ts`
- Test: `test/report-docx-image-integration.test.ts`
- Test: `test/report-docx-metadata.test.ts`

- [ ] **Step 1: Extend the failing route contract tests**

Assert that `server.ts` imports and calls `buildReportDocxMetadata`, uses `DOCX_GRAPH_WIDTH_PX` or `getDocxGraphSize`, and no longer returns the hard-coded graph width `560` in the EMC chart branch.

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npm test -- test/report-docx-image-integration.test.ts test/report-docx-metadata.test.ts`

Expected: FAIL on the new source-contract assertions.

- [ ] **Step 3: Implement the route wiring**

Build normalized metadata immediately after request-body extraction, spread it over the matching metadata keys in `data`, and call `getDocxGraphSize(w, h)` from the image module for EMC graph tags. Keep the existing image max-size logic for product/nameplate photos.

- [ ] **Step 4: Run the focused tests to verify they pass**

Run: `npm test -- test/report-docx-image-integration.test.ts test/report-docx-metadata.test.ts test/report-docx-image-sizing.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

No repository commit is available in this workspace; retain the route wiring.

### Task 6: Full verification and document consistency check

**Files:**
- Verify: `design.md`
- Verify: `docs/superpowers/specs/2026-08-18-report-ocr-docx-formatting-design.md`
- Verify: all files modified in Tasks 1–5

- [ ] **Step 1: Run all report regression tests**

Run: `npm test -- test/report-formatting.test.ts test/report-docx-metadata.test.ts test/report-docx-image-sizing.test.ts test/report-ocr-integration.test.ts test/report-docx-image-mapping.test.ts test/report-docx-image-render.test.ts test/report-docx-image-integration.test.ts test/report-validation.test.ts test/report-validation-integration.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run typecheck**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Run whitespace/header/footer checks**

Run: `git diff --check` when a git repository is available; otherwise inspect each touched file for the required header/footer and report that repository-level diff checking is unavailable.

- [ ] **Step 5: Report evidence and remaining gaps**

Confirm each user requirement 1–5 against a test or source-level assertion. Explicitly note that item 6 contained no requirement.

<!-- --- End of 2026-08-18-report-ocr-docx-formatting.md --- -->
