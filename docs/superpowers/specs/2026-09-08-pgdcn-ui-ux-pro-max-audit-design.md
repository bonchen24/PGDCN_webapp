# Spec triển khai — Hoàn thiện UI/UX PGDCN theo ui-ux-pro-max

> Đây là spec triển khai của một đợt audit có kiểm soát. `design.md`, đặc biệt mục 2–5 và phụ lục 5A, vẫn là nguồn chuẩn duy nhất cho quyết định UI/UX. Spec này không thay thế hoặc sao chép đầy đủ `design.md`.

## 1. Bối cảnh và mục tiêu

App đã có shell PGDCN dùng chung cho PCN/PGD, compact density, các contract mobile-scroll và bộ test nghiệp vụ lớn. Đợt này hoàn thiện các điểm làm giảm chất lượng cảm nhận hoặc khả năng thao tác: zoom bị khóa, icon không nhất quán, focus chưa đồng đều, microcopy quá nhỏ, trạng thái loading/error chưa thống nhất và một số vùng bảng/modal cần bảo vệ scroll.

Mục tiêu là nâng chất lượng UI mà không đổi business behavior: giữ nguyên route, API, schema, persistence, RBAC, callback, collection và lifecycle hồ sơ.

## 2. Bằng chứng audit hiện tại

- `app/layout.tsx` đặt `maximumScale: 1`, trái với yêu cầu không khóa zoom.
- `components/PgdcnAppShell.tsx` còn dùng ký tự `☰` cho menu mobile thay vì icon vector.
- Nhiều component dùng `outline-none`/`focus:outline-hidden` nhưng không phải mọi nhánh đều có focus ring thay thế.
- Một số form/table và metadata dùng text 9–10px ở cả vùng người dùng cần đọc hoặc thao tác.
- Một số row có click handler đồng thời chứa button/link, cần chuẩn hóa để tránh hành vi lồng nhau khó đoán.
- Baseline hiện tại: typecheck pass và 844 PCN tests pass trước khi thay đổi.

## 3. Thiết kế được duyệt

### 3.1. Lớp nền

- Bỏ khóa zoom trong viewport metadata.
- Bổ sung/chuẩn hóa focus-visible, reduced-motion, semantic token và state feedback trong `index.css`/component class.
- Chuẩn hóa icon vector Lucide, accessible name, touch target và disabled/loading state.

### 3.2. Shell và dashboard

- Hoàn thiện header/sidebar/mobile navigation theo `aria-current`, `aria-expanded`, safe-area và scroll contract.
- Giữ thứ tự nội dung dashboard: command header → KPI → queue → pipeline → milestones → notifications.
- Không đưa AI assistant hoặc activity log vào CTA chính của dashboard nếu không thuộc scope hiện hành.

### 3.3. Login, modal, form và data surface

- Chuẩn hóa ba bề mặt login hiện có mà không đổi auth flow.
- Bảo đảm label, focus, error, loading, password toggle và keyboard interaction.
- Giữ modal anatomy có viewport bound, header/footer cố định và body cuộn độc lập.
- Bọc bảng rộng bằng contract cuộn ngang hoặc chuyển stack/card ở mobile; không thay schema dữ liệu.
- Chỉ xử lý nested interaction khi có bằng chứng từ bề mặt đang chỉnh.

### 3.4. Typography và visual hierarchy

- Giữ compact density của app nghiệp vụ, nhưng tăng khả năng đọc cho label, field, CTA, lỗi và thông tin chính.
- Giữ encoding UTF-8 và font stack hiện có với fallback hệ thống hỗ trợ tiếng Việt; không import webfont mới trong đợt này. QA phải kiểm tra `Đ/đ`, `Ă/ă`, `Â/â`, `Ê/ê`, `Ô/ô`, `Ơ/ơ`, `Ư/ư` và dấu thanh trong heading, label, input, badge và validation error.
- Visual direction là **Official / Superneat**: không gradient, glass, neon, texture, shadow nặng hoặc motion trang trí; ưu tiên surface phẳng, border rõ, một cấp shadow nhẹ và khoảng thở có chủ đích.
- Dùng spacing 4/8px; giới hạn radius theo vai trò (surface 12–16px, control 8–10px, pill chỉ cho badge/filter); mỗi màn hình chỉ có một primary CTA và copy hành động dùng sentence case.
- Dùng semantic token thay cho màu ad-hoc; không dùng màu đơn độc để truyền trạng thái.

## 4. Phạm vi file dự kiến

- `design.md` — đã bổ sung phụ lục 5A làm nguồn chuẩn cho đợt audit.
- `app/layout.tsx`, `index.css` — viewport, global focus/motion/scroll/token contract.
- `components/PgdcnAppShell.tsx`, `PgdcnSidebar.tsx`, `PgdcnDashboardView.tsx` — shell, navigation, dashboard hierarchy.
- `components/PcnLoginScreen.tsx`, `components/PgdLoginScreen.tsx`, `components/LoginScreen.tsx` — login accessibility và feedback.
- `components/PgdcnUiPrimitives.tsx` và các modal/table/combobox được xác định qua focused audit — dùng để sửa contract dùng chung, không refactor lan rộng.
- Test UI contract liên quan nếu cần; không ghi đè thay đổi sẵn có của người dùng trong `test/pgdcn-shell-ui.test.ts`.

## 5. Ngoài phạm vi

- Không đổi database/schema/API/RBAC/authentication semantics.
- Không đổi route, callback nghiệp vụ, status mapping, document generation hoặc file/storage boundary.
- Không thêm component library, dependency icon mới hoặc design system thứ hai.
- Không refactor toàn bộ codebase chỉ vì phát hiện code style không đồng nhất ngoài bề mặt đang audit.

## 6. Kế hoạch xác minh

- Static: `git diff --check`, `npm run typecheck`, `npm run build`.
- Regression: `npm run test:pcn` và các UI contract test liên quan.
- Browser: login và shell ở desktop; 320/375/390/430px portrait; tablet; kiểm tra focus bằng keyboard, reduced-motion, không tràn ngang và footer/modal không bị che.
- Acceptance: đối chiếu từng mục trong `design.md` 5A; chỉ kết luận hoàn tất khi mọi tiêu chí đều có bằng chứng.

## 7. Tiêu chí hoàn tất

- Không khóa zoom; không còn emoji/ký tự Unicode làm icon cấu trúc trên bề mặt đã audit.
- Các control chính có focus rõ, accessible name đúng, touch target phù hợp và trạng thái loading/disabled/error có thông điệp.
- Shell/dashboard giữ đúng phân cấp và thứ tự đã quy định; PCN/PGD vẫn tách biệt về màu, badge, callback và quyền.
- Không có tràn ngang toàn trang ở breakpoint mobile; modal/table/form giữ đúng scroll contract.
- Build, typecheck, test và browser audit đều pass.
