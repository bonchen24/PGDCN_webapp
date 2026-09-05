# PGDCN UI/UX completion — shared shell, assistant and dossier workspaces

## Context

PGDCN đã có shared shell, trang Tổng quan, hai miền PCN/PGD và Trợ lý AI. Tuy nhiên, các bề mặt này chưa đồng nhất hoàn toàn về mật độ thông tin, trạng thái tải/lỗi, toolbar, form grid và cách mở một bộ hồ sơ. Lỗi Storage vừa được xử lý ở runtime cũng cho thấy Trợ lý AI cần một lớp UX lỗi rõ ràng hơn để người dùng phân biệt lỗi cấu hình, lỗi bằng chứng và lỗi dịch vụ.

Đợt này hoàn thiện UI/UX theo ba lớp liên tiếp, giữ `design.md` là nguồn chuẩn duy nhất. PCN và PGD vẫn là hai boundary nghiệp vụ riêng; các thay đổi chỉ tác động tới layout, client state, hiển thị lỗi và điều hướng tới bề mặt hiện có.

## Goals

- Đưa người dùng sau đăng nhập tới `Tổng quan phòng` với shell nhất quán và điều hướng dễ hiểu.
- Chuẩn hóa UI compact, grid nhiều cột, toolbar, filter, card/bảng và responsive cho các trang PCN/PGD quan trọng.
- Làm Trợ lý AI có trạng thái rõ ràng từ lúc tải hồ sơ tới khi hoàn tất hoặc dừng lỗi; không để raw Supabase/Storage error làm hỏng bố cục.
- Trình bày lỗi file private, file DOCX không có text và PaddleOCR không sẵn sàng bằng thông điệp có hành động tiếp theo.
- Giữ workflow ngang trong trang hồ sơ và giữ các bước, trạng thái, quyền, callback nghiệp vụ riêng theo từng miền.

## Non-goals

- Không thêm collection, schema field, migration, workflow state hoặc API nghiệp vụ mới.
- Không gộp PCN và PGD thành một loại hồ sơ; không đổi mã PYC, mã lô, status enum hoặc RBAC.
- Không thay thế bộ biểu mẫu DOCX/PDF, không đưa placeholder/cell quản trị ra UI ngoài contract hiện có.
- Không xóa, import, watcher hoặc thay đổi dữ liệu trong thư mục PGD gốc trên Desktop.
- Không triển khai chatbot tự do hay cho AI tự động phê duyệt/chuyển trạng thái.

## Design

### 1. Shared shell and Tổng quan

`PgdcnAppShell` remains the owner of the current target, session scope, notification feed and page-level scroll. `PgdcnSidebar` keeps the shared pages first, followed by PCN and PGD groups. After authentication, the initial target is `department-dashboard` unless the user opens an explicit deep link.

The shared header shows the IEMM/TVCI identity, current context and user menu. The sidebar uses `aria-current="page"` for the active page and `aria-expanded` for domain groups. On mobile it becomes a drawer with a visible close action; on desktop it can collapse without removing accessible labels.

`PgdcnDashboardView` retains the six read-only KPI cards and the operations-cockpit order already defined in `design.md`: command header, KPI strip, action queue, domain pipeline, upcoming milestones, notifications. The visual pass only tightens card height, empty/loading states, CTA hierarchy, grid collapse and focus states. Dashboard callbacks remain navigation-only.

### 2. Trợ lý AI

`PgdcnAssistantView` keeps the PCN/PGD domain switch. The PCN review surface gets a small state model in the client:

```ts
type AssistantViewState = 'loading' | 'ready' | 'running' | 'completed' | 'error';
type AssistantErrorKind = 'STORAGE_CONFIG' | 'EMPTY_DOCUMENT' | 'OCR_UNAVAILABLE' | 'SERVICE' | 'UNKNOWN';
```

The visible anatomy is:

1. domain switch and read-only explanation;
2. field/filter and candidate list;
3. selected dossier summary with one primary action;
4. running timeline with current criterion, completed criteria count and a cancel-safe disabled state;
5. result cards with summary metrics and evidence actions;
6. error card with a Vietnamese explanation, next action and optional technical detail.

The client maps the existing stream error code/message to a stable UI kind. `STORAGE_CONFIG` explains that the administrator must configure private Storage; `EMPTY_DOCUMENT` names the file and offers “Mở hồ sơ”/“Mở file”; `OCR_UNAVAILABLE` explains that the evidence cannot currently be read and preserves prior criterion results; other failures use a retry action. Raw server text is never the only label in the primary error card and is shown only in a collapsible detail for admin/manager users.

PGD assistant rules remain read-only and local. Its cards adopt the same status tokens, empty state, evidence action and responsive grid as PCN without calling PCN APIs.

### 3. PCN/PGD workspace and dossier surface

The main list/workspace pages use a shared presentation contract, not a shared data model:

- header row: page title, scope/status context, primary CTA;
- filter row: search, native enum selects/comboboxes, reset action;
- summary row: compact counts only when already available from the source projection;
- content: dense grid/table on desktop, stacked cards or an explicit horizontal-scroll region on mobile;
- empty/error state: explanation plus the next safe action.

The dossier detail surface uses a consistent header and a horizontally scrollable step rail. Each domain supplies its own step labels and active state. The content below uses two-column grids for metadata and evidence, with full-width sections for tables, documents and audit. Admin/manager edit and soft-delete actions remain governed by the existing server RBAC and confirmation/audit rules.

### 4. Visual and accessibility contract

- Use `ddt-compact`, `pcn-page-surface`, `mobile-scroll-y`, `mobile-scroll-x`, `mobile-safe-bottom`, `mobile-touch-target` and `min-w-0`.
- PCN remains emerald, PGD remains blue; warning/error uses amber/rose, always paired with text and icon.
- Use visible focus rings, labels for icon-only controls, semantic headings and live regions for assistant progress/errors.
- Do not add a second page-level scroll container. Modals keep fixed header/footer and independently scrollable bodies.
- Test the main routes at 320, 375, 390, 430 and desktop widths. The acceptance target is no page-level horizontal overflow and no clipped primary action.

## Files and responsibilities

- `design.md`: source-of-truth UI/UX completion contract under section 5.2.1.3.
- `components/PgdcnAppShell.tsx`: default target and shared navigation state.
- `components/PgdcnSidebar.tsx`: active/expanded/mobile accessibility and compact navigation presentation.
- `components/PgdcnDashboardView.tsx`: cockpit spacing, empty states and responsive presentation.
- `components/PgdcnAssistantView.tsx`: shared assistant state shell and PGD card presentation.
- `components/PcnAssistantView.tsx`: assistant progress/error mapping and evidence actions.
- `components/PcnWorkspace.tsx`, `components/PgdWorkspace.tsx` and dossier/list components: toolbar/grid/step-rail alignment within existing domain contracts.
- `styles/globals.css` or the existing global CSS entry: only shared tokens/overflow/focus rules required by the contract.
- `test/pgdcn-ui-ux-contract.test.ts`: static/contract assertions for shell defaults, assistant state copy, accessibility markers and layout tokens.
- Existing assistant/dashboard tests: extend only where the new visible contract changes their assertions.

## Verification and acceptance

- App opens at `Tổng quan phòng` after login and deep links continue to work.
- Shared sidebar active/expanded/mobile behavior is keyboard and screen-reader legible.
- Dashboard preserves scope isolation, six KPI labels, existing test ids and canonical callbacks.
- Assistant visibly distinguishes loading, ready, running, completed and error states; a Storage error is actionable and does not leak raw text into the main layout.
- A file with no extractable DOCX text identifies the file and gives a path to open the dossier/evidence; the run is not falsely marked complete.
- PCN and PGD list/detail surfaces follow the same toolbar/grid/step-rail rhythm while retaining separate data and statuses.
- Run focused tests, `npm run lint`, `npm run typecheck`, `npm run build`, `git diff --check`, then rebuild and smoke-test Docker on port `2357`.
