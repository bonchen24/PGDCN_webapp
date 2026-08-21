# Global UI Scale 90% Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thu nhỏ đồng nhất toàn bộ giao diện web xuống 90% bằng CSS global mà không thay đổi runtime logic hoặc các nội dung in/xuất.

**Architecture:** Giữ nguyên React tree và Tailwind utilities. Thêm một rule duy nhất cho `#root` trong `index.css`, dùng `zoom: 0.9` cùng `width` và `min-height` ở `100%` để không vượt viewport. Một test tĩnh xác nhận rule tồn tại và bảo vệ phạm vi CSS-only.

**Tech Stack:** React 18, Vite, Tailwind CSS v4, CSS global, Node test runner qua `tsx`.

## Global Constraints

- Toàn bộ giao diện web phải hiển thị ở tỷ lệ **90%** so với kích thước CSS mặc định 100%.
- Nội dung cửa sổ in, biểu mẫu xuất báo cáo và tài liệu DOCX/PDF không chịu ảnh hưởng bởi tỷ lệ UI.
- Đây là thay đổi **chỉ dành cho UI/CSS**; không sửa dữ liệu, API, logic nghiệp vụ, điều hướng hoặc tích hợp hệ thống.
- Không thay đổi token dữ liệu, kích thước ảnh báo cáo hoặc logic nghiệp vụ.
- Tuân thủ header/footer bắt buộc của dự án đối với file được tạo hoặc sửa.

---

### Task 1: Add and verify the global 90% UI scale

**Files:**
- Modify: `index.css` — cập nhật rule CSS global cho `#root` trong `@layer base`.
- Create: `test/global-ui-scale.test.ts` — kiểm tra tĩnh tỷ lệ và bù viewport.
- Read-only verification: `design.md`, `docs/superpowers/specs/2026-08-17-global-ui-scale-design.md`.

**Interfaces:**
- Consumes: React mount element `#root` được tạo trong `index.tsx`.
- Produces: CSS rule áp dụng cho toàn bộ vùng UI React, không thay đổi component/API/data.

- [ ] **Step 1: Write the failing static test**

Create `test/global-ui-scale.test.ts` with the required project header/footer and assert the `#root` rule contains the exact visual scale without exceeding the viewport:

```ts
// Author: Gemini
// OS support: Web/Node
// Description: Regression test for the global 90% UI scale

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const stylesheet = fs.readFileSync(new URL('../index.css', import.meta.url), 'utf8');

test('global UI scale is 90% and stays within the viewport', () => {
  assert.match(
    stylesheet,
    /#root\s*\{[\s\S]*zoom:\s*0\.9;[\s\S]*width:\s*100%;[\s\S]*min-height:\s*100%;[\s\S]*\}/
  );
  assert.doesNotMatch(stylesheet, /111\.111111%/);
});

// --- End of global-ui-scale.test.ts ---
```

- [ ] **Step 2: Run the test and confirm it fails before implementation**

Run: `npx tsx --test test/global-ui-scale.test.ts`

Expected: FAIL because `index.css` still uses an oversized `111.111111%` viewport compensation.

- [ ] **Step 3: Add the minimal CSS-only implementation**

Inside the existing `@layer base` block in `index.css`, after the `body` rule, add:

```css
  #root {
    zoom: 0.9;
    width: 100%;
    min-height: 100%;
  }
```

Do not modify `App.tsx`, component classes, API code, data stores, print templates, or export logic.

- [ ] **Step 4: Run the focused regression test**

Run: `npx tsx --test test/global-ui-scale.test.ts`

Expected: PASS with one test passing.

- [ ] **Step 5: Run the project checks**

Run: `npm run lint`

Expected: TypeScript completes with exit code 0.

Run: `npm run build`

Expected: Vite completes a production build with exit code 0.

- [ ] **Step 6: Review the final diff for scope**

Run: `git diff --check`

Expected: The command cannot run because this workspace is not a Git repository; instead inspect the changed files and confirm runtime changes are limited to the CSS rule and the new static test. Do not initialize Git or modify unrelated files.
