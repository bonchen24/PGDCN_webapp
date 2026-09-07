# PGDCN Official/Superneat UI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoàn thiện các bề mặt UI PGDCN theo hướng Official/Superneat, tăng khả năng đọc, keyboard accessibility và responsive mà không thay đổi nghiệp vụ.

**Architecture:** Giữ nguyên shell, route, store, API và component boundaries hiện có. Thêm một lớp foundation CSS nhỏ cho focus/reduced-motion/token, sau đó chỉnh theo thứ tự shell → dashboard → login → primitive/modal/table/combobox; mỗi lớp có contract test riêng và không tạo design system thứ hai.

**Tech Stack:** Next.js App Router, React 18, TypeScript, Tailwind CSS v4, Lucide React, Node `node:test`, `tsx`, Chrome browser audit.

**Spec:** `design.md` mục 2–5 và phụ lục 5A; `docs/superpowers/specs/2026-09-08-pgdcn-ui-ux-pro-max-audit-design.md`.

## Global Constraints

- `design.md` là nguồn chuẩn duy nhất; mọi code UI phải khớp mục 2–5 và phụ lục 5A.
- Chỉ thay đổi UI, CSS, accessibility, responsive và presentation affordance; không thay đổi schema, API, persistence, RBAC, auth semantics, route, callback nghiệp vụ hoặc lifecycle.
- Visual direction là **Official / Superneat / Minimal Swiss**: không gradient, glassmorphism, neon, texture, shadow nặng hoặc motion trang trí.
- Spacing theo nhịp 4/8px; surface khoảng 12–16px, control khoảng 8–10px, pill chỉ cho badge/filter; mỗi màn hình chỉ có một primary CTA.
- Giữ UTF-8 và font stack hiện có với fallback hệ thống hỗ trợ tiếng Việt; không import webfont mới. QA phải kiểm tra `Đ/đ`, `Ă/ă`, `Â/â`, `Ê/ê`, `Ô/ô`, `Ơ/ơ`, `Ư/ư` và dấu thanh.
- Icon cấu trúc dùng Lucide hiện có, không dùng emoji/ký tự Unicode cho menu, navigation, state hoặc action.
- Interactive controls giữ touch target khoảng 44px; icon-only controls có accessible name; focus-visible phải rõ; reduced-motion phải được tôn trọng.
- Không stage/ghi đè thay đổi sẵn có trong `test/pgdcn-shell-ui.test.ts` hoặc `.agents/`.
- Mỗi task phải chạy test liên quan trước khi commit; commit chỉ stage đúng các file của task.

---

### Task 1: Tạo contract test cho Official/Superneat UI foundation

**Files:**
- Create: `test/pcn-official-superneat-ui.test.ts`
- Test: `test/pcn-official-superneat-ui.test.ts`

**Interfaces:**
- Consumes: source text từ `app/layout.tsx`, `index.css`, `components/PgdcnAppShell.tsx`, ba login screen và `components/PgdcnDashboardView.tsx`.
- Produces: các marker ổn định để task sau chứng minh viewport, focus, reduced-motion, icon, font và style direction đã được áp dụng.

- [ ] **Step 1: Viết các test fail cho yêu cầu foundation**

Tạo test Node theo pattern của `test/pgdcn-ui-ux-contract.test.ts`:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (path: string) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('PGDCN viewport keeps zoom available and global CSS handles motion/focus', () => {
  assert.doesNotMatch(read('../app/layout.tsx'), /maximumScale/);
  const css = read('../index.css');
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
});

test('audited surfaces keep the official icon and visual direction', () => {
  assert.doesNotMatch(read('../components/PgdcnAppShell.tsx'), />☰</);
  for (const path of ['../components/PcnLoginScreen.tsx', '../components/PgdLoginScreen.tsx', '../components/LoginScreen.tsx']) {
    const source = read(path);
    assert.match(source, /focus-visible/);
    assert.doesNotMatch(source, /radial-gradient|backdrop-blur/);
  }
});

test('Vietnamese-safe typography remains explicit in the global stack', () => {
  const css = read('../index.css');
  assert.match(css, /Roboto/);
  assert.match(css, /Segoe UI|Arial|sans-serif/);
});
```

- [ ] **Step 2: Chạy test để xác nhận fail đúng nguyên nhân**

Run:

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts
```

Expected: FAIL vì `maximumScale`, ký tự `☰`, gradient/backdrop blur và focus-visible chưa được chuẩn hóa.

- [ ] **Step 3: Kiểm tra test không chạm file người dùng**

Run:

```bash
git status --short
```

Expected: chỉ thấy test mới cùng các thay đổi sẵn có trước task; không được sửa `test/pgdcn-shell-ui.test.ts` hoặc `.agents/`.

- [ ] **Step 4: Commit test contract**

```bash
git add -- test/pcn-official-superneat-ui.test.ts
git commit -m "test: add official superneat ui contracts"
```

### Task 2: Chuẩn hóa viewport, focus, reduced-motion và font-safe CSS

**Files:**
- Modify: `app/layout.tsx:12-20`
- Modify: `index.css:1-80, 180-220`
- Test: `test/pcn-official-superneat-ui.test.ts`

**Interfaces:**
- Consumes: viewport metadata và token/font stack hiện có.
- Produces: viewport không khóa zoom; focus indicator dùng được cho keyboard; reduced-motion override; token nền cho Official/Superneat.

- [ ] **Step 1: Viết/điều chỉnh test cho các marker CSS cụ thể**

Mở rộng test foundation để kiểm tra `maximumScale` không tồn tại, có `@media (prefers-reduced-motion: reduce)`, có `:focus-visible`, và CSS giữ `font-family` hiện tại. Không assert màu raw trong component.

- [ ] **Step 2: Chạy test trước implementation**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts
```

Expected: FAIL nếu marker chưa đạt.

- [ ] **Step 3: Implement foundation tối thiểu**

Trong `app/layout.tsx`, giữ `width: 'device-width'`, `initialScale: 1`, `viewportFit: 'cover'`, `themeColor` và xóa `maximumScale`.

Trong `index.css`, giữ font stack UTF-8-safe hiện tại và thêm token semantic cùng rule tương đương:

```css
:root {
  --pcn-focus-ring: #2563eb;
  --pcn-surface-shadow: 0 1px 2px rgb(15 23 42 / 0.06);
}

@layer base {
  :where(button, a, input, select, textarea, [role='button'], [role='combobox']):focus-visible {
    outline: 2px solid var(--pcn-focus-ring);
    outline-offset: 2px;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

Không thêm `@import` Google Fonts; không đổi font của report preview/DOCX/PDF.

- [ ] **Step 4: Chạy test và typecheck**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts
npm run typecheck
```

Expected: PASS, không có TypeScript error.

- [ ] **Step 5: Commit foundation**

```bash
git add -- app/layout.tsx index.css test/pcn-official-superneat-ui.test.ts
git commit -m "fix: harden pgdcn ui foundation"
```

### Task 3: Làm sạch shell và mobile navigation

**Files:**
- Modify: `components/PgdcnAppShell.tsx:3,293-319`
- Modify: `components/PgdcnSidebar.tsx:65-138`
- Modify: `components/PgdcnUiPrimitives.tsx:23-42`
- Test: `test/pcn-official-superneat-ui.test.ts`

**Interfaces:**
- Consumes: `PgdcnNavigationTarget`, `PgdcnSidebar` state và CSS foundation từ Task 2.
- Produces: shell mobile có icon Lucide, navigation state/accessibility rõ, header và primitive surface theo Official/Superneat.

- [ ] **Step 1: Viết test fail cho shell contract**

Thêm các assertion:

```ts
const shell = read('../components/PgdcnAppShell.tsx');
assert.match(shell, /from ['"]lucide-react['"]/);
assert.match(shell, /Menu/);
assert.match(shell, /aria-label="Mở menu phòng"/);
assert.doesNotMatch(shell, />☰</);

const sidebar = read('../components/PgdcnSidebar.tsx');
assert.match(sidebar, /aria-current/);
assert.match(sidebar, /aria-expanded/);
assert.match(sidebar, /focus-visible/);
```

- [ ] **Step 2: Chạy test để xác nhận fail**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts
```

- [ ] **Step 3: Thay icon và chuẩn hóa affordance**

Trong `PgdcnAppShell.tsx`, import `Menu` từ `lucide-react` và thay literal `☰` bằng:

```tsx
<button
  type="button"
  onClick={() => setMobileOpen(true)}
  aria-label="Mở menu phòng"
  className="mobile-touch-target rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden"
>
  <Menu aria-hidden="true" size={18} />
</button>
```

Trong sidebar, giữ nguyên callback/permission và bổ sung `focus-visible` cho navigation item, group toggle, close mobile, settings và logout. Không dùng hover làm điều kiện hoạt động; giữ `aria-current="page"` và `aria-expanded` hiện có.

Trong `PgdcnUiPrimitives.tsx`, giữ các export hiện có (`PgdcnPageHeader`, `PgdcnToolbar`, `PgdcnStatusBadge`, `PgdcnWorkflowRail`, `PgdcnStatePanel`), chỉ chuẩn hóa surface class: border neutral, radius vừa phải, shadow nhẹ và `min-w-0`/scroll contract.

- [ ] **Step 4: Chạy UI contract và typecheck**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts test/pgdcn-ui-ux-contract.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit shell**

```bash
git add -- components/PgdcnAppShell.tsx components/PgdcnSidebar.tsx components/PgdcnUiPrimitives.tsx test/pcn-official-superneat-ui.test.ts
git commit -m "fix: refine pgdcn shell navigation"
```

### Task 4: Chuẩn hóa dashboard theo nhịp Official/Superneat

**Files:**
- Modify: `components/PgdcnDashboardView.tsx:57-205`
- Test: `test/pcn-official-superneat-ui.test.ts`

**Interfaces:**
- Consumes: `getPgdcnDashboardProjection`, existing callbacks `onOpenPcn`, `onOpenPgd`, `onOpenPcnWorkspace`, `onOpenPgdWorkspace`, `onOpenNotifications`.
- Produces: presentation hierarchy đúng thứ tự command header → KPI → queue → pipeline → milestones → notifications; không đổi projection hoặc callback.

- [ ] **Step 1: Viết test fail cho dashboard order/style**

Kiểm tra source vẫn có các component theo đúng thứ tự và class không dùng gradient/backdrop blur; kiểm tra CTA workspace có `mobile-touch-target`, các list action có `aria-label` và focus-visible.

```ts
const dashboard = read('../components/PgdcnDashboardView.tsx');
for (const marker of ['CommandHeader', 'AttentionQueue', 'DomainPipeline', 'UpcomingMilestones', 'SharedNotifications']) {
  assert.match(dashboard, new RegExp(marker));
}
assert.doesNotMatch(dashboard, /radial-gradient|backdrop-blur/);
assert.match(dashboard, /mobile-touch-target/);
assert.match(dashboard, /focus-visible/);
```

- [ ] **Step 2: Chạy test trước implementation**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts
```

- [ ] **Step 3: Refine class/layout, giữ nguyên dữ liệu**

Trong `Kpi`, `CommandHeader`, `AttentionQueue`, `DomainPipelineCard`, `UpcomingMilestones` và `SharedNotifications`:

- dùng surface trắng, `border-slate-200`, radius nhất quán và tối đa một shadow nhẹ;
- giữ accent emerald/blue theo domain, không dùng màu làm tín hiệu duy nhất;
- giữ list action full-width với min-width 0, label/metadata wrap có chủ đích;
- chỉ giữ pill cho status/count/filter, không biến toàn bộ card thành pill;
- giữ một primary CTA ở `CommandHeader`, các action `Xem tất cả`/mở section là secondary;
- đổi `focus:outline-none focus:ring-*` sang `focus-visible:ring-*` ở các button được chạm;
- không thêm metric, collection, filter, navigation hoặc mutation.

- [ ] **Step 4: Chạy tests liên quan**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts test/pgdcn-dashboard.test.ts test/pcn-dashboard-layout.test.ts test/pgdcn-ui-ux-contract.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit dashboard**

```bash
git add -- components/PgdcnDashboardView.tsx test/pcn-official-superneat-ui.test.ts
git commit -m "fix: polish pgdcn operations dashboard"
```

### Task 5: Chuẩn hóa ba login surface, giữ nguyên auth flow

**Files:**
- Modify: `components/PcnLoginScreen.tsx:80-173`
- Modify: `components/PgdLoginScreen.tsx:31-44`
- Modify: `components/LoginScreen.tsx:230-491`
- Test: `test/pcn-official-superneat-ui.test.ts`

**Interfaces:**
- Consumes: existing `establishPcnSession`, `usePcnSessionStore`, legacy login/reset handlers.
- Produces: login presentation chính thức, focus/loading/error semantics rõ, password toggle có hitbox và accessible name; auth behavior không đổi.

- [ ] **Step 1: Viết test fail cho login style/accessibility**

Kiểm tra ba file có `focus-visible`, `aria-label` cho password toggle, `role="alert"`, `disabled`/busy state và không có `radial-gradient`/`backdrop-blur`/`uppercase tracking-widest` trên primary action.

- [ ] **Step 2: Chạy test trước implementation**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts
```

- [ ] **Step 3: Refine login layout và controls**

- Giữ IEMM asset, nội dung tiếng Việt và dark official surface; bỏ decorative gradient/backdrop blur, dùng nền navy/slate phẳng, border rõ và shadow nhẹ.
- Bỏ CSS uppercase/tracking rộng khỏi heading, label và button action; giữ uppercase chỉ ở eyebrow thương hiệu nếu cần.
- Giữ `label`/`htmlFor`, `autoComplete`, password manager behavior và `role="alert"`.
- Bổ sung `min-h-11`/`mobile-touch-target` và `focus-visible:ring-2` cho password toggle, remember checkbox và action buttons.
- Khi có lỗi, thêm `aria-invalid`/`aria-describedby` đúng field mà không thay đổi message hoặc submit handler.
- Khi busy, giữ text tiếng Việt `Đang xác thực...`/`Đang đăng nhập...`, spinner và disabled semantics; không cho submit lặp.
- Không lưu mật khẩu mới, không đổi endpoint, không đổi session semantics.

- [ ] **Step 4: Chạy login contracts, typecheck và build**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts test/pcn-login-contract.test.ts test/pcn-login-remember.test.ts
npm run typecheck
npm run build
```

- [ ] **Step 5: Commit login surfaces**

```bash
git add -- components/PcnLoginScreen.tsx components/PgdLoginScreen.tsx components/LoginScreen.tsx test/pcn-official-superneat-ui.test.ts
git commit -m "fix: refine pgdcn login surfaces"
```

### Task 6: Hardening modal, combobox, table và form affordance

**Files:**
- Modify: `components/PcnCatalogCombobox.tsx:146-199`
- Modify: `components/PgdWorkspace.tsx:582-785`
- Modify: `components/PcnDocumentOutputModal.tsx`
- Modify: `components/PcnProposalDetailModal.tsx`
- Modify: `components/PcnResultDetailModal.tsx`
- Modify: `components/PcnLabRequestDetailModal.tsx`
- Test: `test/pcn-official-superneat-ui.test.ts`

**Interfaces:**
- Consumes: existing combobox roles, modal callbacks, table row open handlers and PCN/PGD scroll contracts.
- Produces: focusable/operable controls, modal viewport/scroll contract and table interaction không bị nested click gây nhầm.

- [ ] **Step 1: Viết test fail cho focused interaction surfaces**

Thêm assertions cho combobox và modal:

```ts
const combobox = read('../components/PcnCatalogCombobox.tsx');
assert.match(combobox, /role="listbox"/);
assert.match(combobox, /aria-label/);
assert.match(combobox, /focus-visible/);
assert.match(combobox, /mobile-touch-target/);

for (const path of ['../components/PcnDocumentOutputModal.tsx', '../components/PcnProposalDetailModal.tsx']) {
  const source = read(path);
  assert.match(source, /role="dialog"/);
  assert.match(source, /aria-modal="true"/);
  assert.match(source, /max-h-|mobile-scroll-y|overflow-y-auto/);
}
```

Thêm test kiểm tra `PgdWorkspace` không dùng click handler trên `<tr>` đồng thời chứa button mở hồ sơ; action mở hồ sơ phải có một interactive owner rõ ràng.

- [ ] **Step 2: Chạy test để xác nhận fail hoặc ghi nhận surface đã đạt**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts
```

Nếu một surface đã đạt, giữ nguyên và chỉ ghi nhận marker; không refactor không cần thiết.

- [ ] **Step 3: Sửa combobox và modal theo contract**

- `PcnCatalogCombobox`: giữ search normalization và keyboard behavior; bổ sung `focus-visible` trên input/clear/toggle/option, target khoảng 44px và trạng thái `aria-expanded`/`aria-activedescendant` không đổi semantics.
- Modal focused: giữ `role="dialog"`, `aria-modal`, `aria-labelledby`; panel dùng `max-h-[...] min-h-0`, header/footer `shrink-0`, body `mobile-scroll-y`; icon-only close có accessible name và focus-visible.
- `PgdWorkspace` summary register: bỏ row-level click nếu nó bọc interactive child; dùng button/link duy nhất ở ô mã hồ sơ với accessible name, giữ callback `onOpen(request.id)` và không đổi dữ liệu.
- Form field: giữ label, thêm `inputMode="numeric"`/`type="date"` khi đã có business type rõ; không đổi value mapping hoặc API payload.

- [ ] **Step 4: Chạy focused UI tests và typecheck**

```bash
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pcn-official-superneat-ui.test.ts test/pcn-mobile-scroll.test.ts test/pcn-document-modals.test.ts test/pgd-operational-stations-ui.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit interaction surfaces**

```bash
git add -- components/PcnCatalogCombobox.tsx components/PgdWorkspace.tsx components/PcnDocumentOutputModal.tsx components/PcnProposalDetailModal.tsx components/PcnResultDetailModal.tsx components/PcnLabRequestDetailModal.tsx test/pcn-official-superneat-ui.test.ts
git commit -m "fix: harden pgdcn modal and form interactions"
```

### Task 7: Browser audit, regression suite và handoff

**Files:**
- Modify: none planned; verified regressions return to the originating task file and test before the plan checklist is updated.
- Test: existing contracts plus browser observations.

**Interfaces:**
- Consumes: all completed tasks and canonical `design.md` 5A acceptance criteria.
- Produces: evidence that UI works at required viewports, font rendering is correct and no business regression occurred.

- [ ] **Step 1: Chạy static/regression verification**

```bash
git diff --check
npm run typecheck
npm run test:pcn
npm run build
```

Expected: all commands exit 0; test suite remains green and existing user changes remain outside task commits.

- [ ] **Step 2: Chạy local app và kiểm tra browser**

```bash
npm run dev:pcn
```

Kiểm tra bằng Chrome/CUA ở desktop và viewport 320, 375, 390, 430px portrait:

- login PCN/PGD: heading, label, input, error, spinner và password toggle;
- shell: menu mobile, sidebar state, current page, group expand/collapse, safe bottom area;
- dashboard: command header, KPI, queue, pipeline, milestones, notifications đúng thứ tự;
- ký tự `Đ/đ Ă/ă Â/â Ê/ê Ô/ô Ơ/ơ Ư/ư` và dấu thanh không lỗi font/encoding;
- Tab focus nhìn thấy trên input, button, sidebar, modal, combobox;
- bật reduced-motion, không có animation làm thay đổi layout;
- không có horizontal scroll toàn trang, modal footer không bị che.

- [ ] **Step 3: Nếu có regression, sửa test trước rồi sửa class tối thiểu**

Mỗi regression phải có assertion hoặc browser evidence tái hiện; không sửa data/API để làm pass visual check. Chạy lại command liên quan sau từng fix.

- [ ] **Step 4: Kiểm tra trạng thái repo và commit verification note nếu cần**

```bash
git status --short
git log -7 --oneline
```

Không stage `test/pgdcn-shell-ui.test.ts` hoặc `.agents/` nếu chúng không thuộc task. Báo cáo cuối phải nêu command đã chạy và kết quả thực tế.

## Plan Self-Review

- Spec coverage: viewport/zoom, Official/Superneat visual rules, Vietnamese-safe font, focus/accessibility, touch target, reduced-motion, scroll contract, dashboard order, login feedback, modal/table/combobox, build/test/browser acceptance đều có task.
- Placeholder scan: không dùng `TBD`, `TODO`, “implement later” hoặc bước kiểm thử mơ hồ; mỗi task có file, test, command và commit.
- Scope: không thay đổi business behavior, schema, API, route, auth semantics hoặc storage.
- User changes: test `test/pgdcn-shell-ui.test.ts` và `.agents/` được giữ ngoài các lệnh stage của plan.
