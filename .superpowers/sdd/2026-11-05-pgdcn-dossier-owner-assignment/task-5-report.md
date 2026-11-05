# Task 5 report — assignment actions across PCN queues and registers

## Đã thực hiện

- `PcnDossierQueueView` dùng `PcnDossierAssignmentControl`; nhận `users`, `currentUser` và callback từ route PCN. `app/(workspace)/pcn/page.tsx` nối callback vào `pcn.updateDossier(dossierId, { ownerUsername })`. Component vẫn có fallback store/session cho callsite cũ.
- `PcnOperationsRegisterView` dùng `renderCell` của shared grid cho cột chủ hồ sơ, gọi `onUpdateDossier` hiện có và tắt inline editing riêng cột owner. Cột đánh giá viên và soát xét vẫn editable độc lập.
- Giữ nguyên `PcnPipelineBoard` và `PcnWorkQueueView`; test xác nhận quản lý có phân công, nhân viên vẫn tự nhận hồ sơ. Candidate PCN phải active, không phải viewer, thuộc PCN và bao phủ mọi field code của dossier.
- Cập nhật Task 5 brief để ghi caller route và các bề mặt được tái sử dụng/kiểm chứng. Không đổi `design.md`, schema hay nguồn dữ liệu.

## RED

Trước sửa UI, chạy ba test mục tiêu (`pcn-dossier-queue-view-ui`, `summary-register-grid`, `dossier-owner-assignment-surfaces`): **33 pass, 3 fail**. Các lỗi đúng với hành vi còn thiếu: queue và register chưa render PCN assignment control; owner trong register vẫn là ô generic. Test hồi quy board/work queue đã pass từ trước.

## GREEN và kiểm tra

- Bộ 11 test PCN queue/board/work queue/register/workspace: **132 pass, 0 fail, 0 skipped**.
- Bộ test queue/register/surfaces sau lần sửa fixture cuối: **38 pass, 0 fail**.
- `npm run typecheck`: thành công.
- `git diff --check`: thành công; chỉ có cảnh báo line ending Git trên test/progress đã có sẵn.
- Impeccable detector trên `components/PcnDossierQueueView.tsx`, `components/PcnOperationsRegisterView.tsx`, `app/(workspace)/pcn/page.tsx`: output `[]`, exit code 0.

## Giới hạn kiểm tra trình duyệt

Dev server worktree khởi chạy ở cổng 3010; route PCN chuyển tới `/login` do `/api/auth/pcn-session` trả 401, nên không thể xem trạng thái quản lý/nhân viên trong browser mà không đăng nhập. Không dùng thông tin đăng nhập. Helper Playwright của skill không chạy được vì môi trường thiếu Python; đã dùng `playwright-cli` để xác nhận redirect và đóng browser/server. Cổng 1357 được giữ nguyên.
