<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch thu gọn grid icon cho trang Lập báo cáo
-->

# Compact Report Standard Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Thu gọn grid icon trong `ReportGeneratorView.tsx` để 17 module hiển thị gọn hơn trong viewport desktop mà không refactor component hay thay đổi luồng báo cáo.

**Architecture:** Giữ nguyên markup, state, callback và nguồn dữ liệu hiện tại. Chỉ điều chỉnh Tailwind utility classes cho vùng dashboard, card, icon, label và số cột theo breakpoint.

**Tech Stack:** React 18, TypeScript, Tailwind CSS v4, Node `node:test` chạy qua `tsx`.

## Global Constraints

- Giữ nguyên `STANDARDS`, `expandedStandardId`, `handleSelectStandard` và các lựa chọn đặc biệt.
- Không thay đổi schema, state nghiệp vụ, API, OCR, lưu KQTN hoặc xuất DOCX.
- Không thay đổi các form nhập liệu.
- Không thay đổi `.env`.
- Không thêm dependency mới.
- Card giữ vùng tương tác tối thiểu khoảng `88–112px`; icon khoảng `24–28px`.
- Desktop hướng tới 7–8 cột; màn hình hẹp vẫn responsive và được phép cuộn nếu viewport không đủ chiều cao.

---

### Task 1: Viết regression test đỏ cho layout compact

**Files:**
- Create: `test/report-grid-layout.test.ts`
- Test target: `components/ReportGeneratorView.tsx`

- [ ] **Step 1: Write the failing test**

```ts
// Author: Gemini
// OS support: Web/Node
// Description: Regression tests for the compact report standard grid classes

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');

test('report standard grid uses compact responsive spacing and columns', () => {
  assert.match(source, /grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8/);
  assert.match(source, /gap-2 sm:gap-3/);
  assert.match(source, /pb-4 mt-0/);
});

test('report standard cards and icons use compact dimensions', () => {
  assert.match(source, /min-h-\[88px\] sm:min-h-\[104px\]/);
  assert.match(source, /w-6 h-6 sm:w-7 sm:h-7/);
  assert.match(source, /text-\[9px\] sm:text-\[10px\]/);
});

// --- End of report-grid-layout.test.ts ---
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/report-grid-layout.test.ts`

Expected: FAIL because the current source still uses `lg:grid-cols-6`, `sm:min-h-[160px]`, larger icon classes and larger dashboard spacing.

### Task 2: Apply compact grid styles without changing behavior

**Files:**
- Modify: `components/ReportGeneratorView.tsx:30-50`
- Modify: `components/ReportGeneratorView.tsx:1077-1157`

- [ ] **Step 1: Shrink the icon classes**

In `getStandardIcon`, replace every icon size/margin pair `w-8 h-8 sm:w-10 sm:h-10 ... mb-2 sm:mb-3` with `w-6 h-6 sm:w-7 sm:h-7 ... mb-1`. Preserve icon component, color, and `strokeWidth={1.5}` for every standard.

- [ ] **Step 2: Shrink dashboard spacing and increase desktop columns**

Change the dashboard/grid/card/label classes to these exact compact values:

```tsx
<div className="p-2 sm:p-4 lg:p-5 overflow-y-auto flex-grow min-h-0 bg-gradient-to-b from-slate-50 to-white">
  <div className="w-full max-w-[1400px] mx-auto">
    <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2 sm:gap-3 pb-4 mt-0">
      <div className="... min-h-[88px] sm:min-h-[104px] ... p-2 sm:p-3 ...">
        <div className="font-bold text-slate-700 text-[9px] sm:text-[10px] leading-tight ...">
```

Keep all `onClick`, overlay, option button, and `expandedStandardId` logic unchanged.

- [ ] **Step 3: Run the focused regression test**

Run: `npm test -- test/report-grid-layout.test.ts`

Expected: PASS with 2 tests and 0 failures.

### Task 3: Verify the application

**Files:**
- Verify: `components/ReportGeneratorView.tsx`
- Verify: `test/report-grid-layout.test.ts`
- Verify: `design.md`

- [ ] **Step 1: Run the complete test suite**

Run: `npm test`

Expected: exit code 0 with 0 failed tests.

- [ ] **Step 2: Run TypeScript validation**

Run: `npm run lint`

Expected: exit code 0 with no TypeScript errors.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code 0 and Vite emits the production bundle.

- [ ] **Step 4: Check that form components were not changed**

Run: `Get-Item components\EmcBepDien1VungNauForm.tsx,components\DefaultStandardForm.tsx,components\DayCapDienForm.tsx | Select-Object Name,LastWriteTime,Length`

Expected: form source contents remain outside the change scope.

The workspace has no Git metadata, so no commit command is included; final handoff must list changed files and verification outputs.

<!-- --- End of 2026-08-17-report-standard-grid.md --- -->
