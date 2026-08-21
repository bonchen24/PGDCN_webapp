<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch triển khai kiểm tra nhất quán dữ liệu cho form báo cáo thử nghiệm
-->

# Report Consistency Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Bổ sung kiểm tra tự động cho chuỗi ngày, metadata PYC/OCR/thông số kỹ thuật và chặn lưu/xuất báo cáo khi dữ liệu mâu thuẫn.

**Architecture:** Tách logic thuần vào `lib/reportValidation.ts`, kiểm thử độc lập bằng `node:test`, sau đó `ReportGeneratorView` chỉ dựng input validation từ state, hiển thị lỗi/cảnh báo và áp dụng kết quả trước hai action cuối. Bản ghi KQTN lưu thêm các state chi tiết mà form đang sử dụng.

**Tech Stack:** React 18, TypeScript, Node `node:test`, `tsx`, Tailwind CSS hiện có.

## Global Constraints

- Tuân thủ `design.md` như nguồn chuẩn duy nhất.
- Chỉ lỗi mâu thuẫn mới chặn; trường chưa đủ dữ liệu chỉ cảnh báo.
- Không thêm dependency và không sửa `.env`.
- Giữ nguyên logic đánh giá điều khoản và layout form ngoài vùng validation.
- File mới/chỉnh sửa có header/footer theo `AGENTS.md`.

---

### Task 1: Viết test đỏ cho bộ validation thuần

**Files:**
- Create: `test/report-validation.test.ts`
- Test target: `lib/reportValidation.ts`

**Interfaces:**
- Produces the required public functions `parseReportDateRange`, `normalizeComparableValue`, `normalizeSealStamp`, and `validateReportConsistency`.

- [ ] **Step 1: Write the failing tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeComparableValue,
  normalizeSealStamp,
  parseReportDateRange,
  validateReportConsistency,
} from '../lib/reportValidation';

test('parses a single date and a date range', () => {
  assert.deepEqual(parseReportDateRange('14/08/2026'), { start: '2026-08-14', end: '2026-08-14' });
  assert.deepEqual(parseReportDateRange('10/08/2026 – 14/08/2026'), { start: '2026-08-10', end: '2026-08-14' });
});

test('normalizes metadata and seal tokens for comparison', () => {
  assert.equal(normalizeComparableValue('  Đa-Star / Custom '), 'dastarcustom');
  assert.equal(normalizeSealStamp('IEMM-8892, IEMM.26/8891'), 'iemm268891|iemm8892');
});

test('reports an error when the report date precedes the test range', () => {
  const result = validateReportConsistency({
    dates: {
      requestDate: '2026-07-19',
      sampleReceiptDate: '2026-07-20',
      testDate: '10/08/2026 – 14/08/2026',
      reportDate: '2026-08-13',
    },
  });
  assert.equal(result.hasErrors, true);
  assert.ok(result.issues.some(issue => issue.code === 'DATE_ORDER'));
});

test('reports metadata, OCR and technical specification mismatches', () => {
  const result = validateReportConsistency({
    dates: {},
    source: {
      requestCode: 'DDT-2026-001',
      model: 'Dastar Custom',
      brand: 'Daestar',
      sealStamp: 'IEMM-8891',
      specifications: '220-240V; 50Hz; 660W',
    },
    report: {
      requestCode: 'DDT-2026-001',
      model: 'Dastar Other',
      brand: 'Daestar',
      sealStamp: 'IEMM-8892',
    },
    ocr: { model: 'Dastar Custom', brand: 'Wrong Brand', voltage: '110V', frequency: '50Hz', power: '660W' },
  });
  assert.equal(result.hasErrors, true);
  assert.ok(result.issues.some(issue => issue.field === 'model'));
  assert.ok(result.issues.some(issue => issue.field === 'sealStamp'));
  assert.ok(result.issues.some(issue => issue.field === 'ocr.brand'));
  assert.ok(result.issues.some(issue => issue.field === 'ocr.voltage'));
});

test('missing optional values produce warnings without blocking', () => {
  const result = validateReportConsistency({
    dates: {},
    source: { model: 'Model A' },
    report: {},
  });
  assert.equal(result.hasErrors, false);
  assert.ok(result.issues.some(issue => issue.severity === 'warning'));
});
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm test -- test/report-validation.test.ts`

Expected: FAIL because `lib/reportValidation.ts` and its exported functions do not exist.

### Task 2: Implement the pure validation module

**Files:**
- Create: `lib/reportValidation.ts`

**Interfaces:**
- `parseReportDateRange(value: string | undefined): { start?: string; end?: string; invalid?: boolean }`
- `normalizeComparableValue(value: unknown): string`
- `normalizeSealStamp(value: unknown): string`
- `validateReportConsistency(input: ReportValidationInput): ReportValidationResult`

- [ ] **Step 1: Implement date parsing and normalization**

Support ISO date/ISO datetime and `DD/MM/YYYY`; split only on an explicit date-range separator so the hyphens inside ISO dates are not treated as range separators. Return canonical `YYYY-MM-DD` strings.

- [ ] **Step 2: Implement metadata and technical comparisons**

Compare only when the PYC/source value exists. Generate warnings for missing report/OCR values and errors for mismatches. Match technical OCR/form values against normalized `source.specifications` only when that specification string is non-empty.

- [ ] **Step 3: Run the focused test to verify it passes**

Run: `npm test -- test/report-validation.test.ts`

Expected: PASS with all validation cases green.

### Task 3: Integrate validation into ReportGeneratorView

**Files:**
- Modify: `components/ReportGeneratorView.tsx`

**Interfaces:**
- Consumes `validateReportConsistency` and `ReportValidationResult` from `lib/reportValidation.ts`.
- Produces a `reportValidation` value derived from selected PYC, `reportMeta`, `ocrData` and EMC form metadata.

- [ ] **Step 1: Track selected PYC and request date**

Store the selected `TestRequest`, copy its `requestDate` into `reportMeta`, and seed EMC brand/model fields from the selected sample while preserving existing user-entered detailed results.

- [ ] **Step 2: Derive and render validation issues**

Use `useMemo` to build validation input. Add an inline summary with error/warning counts, field-level messages for date and identity fields, and mark affected controls with the existing red/amber utility tokens.

- [ ] **Step 3: Block save and DOCX generation on errors**

Return before persistence or fetch when `reportValidation.hasErrors` is true. Keep warning-only reports actionable and show a success state when no issue exists.

- [ ] **Step 4: Persist detailed report data**

Add `testResultsData`, `emcData`, `dayCapDienData` and current photos to the `KQTNRecord` created by `handleSaveReport`, using the existing fields in `types.ts`.

- [ ] **Step 5: Add source-level regression assertions**

Extend `test/report-form-typography.test.ts` or add a focused integration source test to assert that ReportGenerator calls validation and guards both action handlers.

- [ ] **Step 6: Run focused tests**

Run: `npm test -- test/report-validation.test.ts test/report-form-typography.test.ts`

Expected: PASS with zero failures.

### Task 4: Verify the complete change

**Files:**
- Verify: `design.md`
- Verify: `docs/superpowers/specs/2026-08-17-report-consistency-validation-design.md`
- Verify: `docs/superpowers/plans/2026-08-17-report-consistency-validation.md`
- Verify: `lib/reportValidation.ts`
- Verify: `components/ReportGeneratorView.tsx`
- Verify: `test/report-validation.test.ts`

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: exit code 0 with zero failed tests.

- [ ] **Step 2: Run TypeScript validation**

Run: `npm run lint`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0 and Vite emits the production bundle.

- [ ] **Step 4: Inspect the final diff/status**

Run: `git diff --check` and `git status --short`.

Expected: no whitespace errors. This workspace currently has no Git metadata, so report changed files without a commit if the repository remains non-Git.

<!-- --- End of 2026-08-17-report-consistency-validation.md --- -->
