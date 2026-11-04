# AGENT INSTRUCTIONS & COMPLIANCE RULES

## 1. NGUYÊN TẮC CỐT LÕI (SSOT & PHẠM VI)
- **`design.md`** là SSOT ở cấp thiết kế kiến trúc, nhưng **không phải dependency bắt buộc** của mọi Atomic Task.
- Khẩu hiệu vận hành:
  - `Local fix -> code first.`
  - `System/design change -> consult design.md.`
  - `Only persistent design decisions -> update design.md.`

## 2. QUY TRÌNH XỬ LÝ THEO PHẠM VI TASK
1. **Atomic Task / Task cục bộ**:
   - Xác định đúng phạm vi -> Đọc file code trực tiếp liên quan -> Sửa tối thiểu -> Test đúng phạm vi ảnh hưởng.
   - Không đọc và không cập nhật `design.md`.
2. **System Task / Thay đổi thiết kế**:
   - Đối chiếu section liên quan trực tiếp trong `design.md`.
   - Nếu có quyết định thiết kế lâu dài mới: Cập nhật `design.md`.
   - Thực thi code theo chuẩn.

## 3. ĐIỀU KIỆN ĐỌC VÀ CẬP NHẬT `design.md`
- **Chỉ đọc `design.md` khi task liên quan đến:**
  1. Thay đổi kiến trúc hệ thống.
  2. Thêm tính năng hoặc workflow mới.
  3. Thay đổi logic nghiệp vụ/domain rule.
  4. Thay đổi schema, model dữ liệu hoặc quan hệ dữ liệu quan trọng.
  5. Thay đổi quy tắc mã hóa, trạng thái, quyền, routing.
  6. Thay đổi shared component, shared UI contract hoặc pattern dùng chung.
  7. Thay đổi template hoặc hành vi có ảnh hưởng nhiều module.
  8. Yêu cầu hiện tại không đủ rõ và cần đối chiếu quyết định thiết kế đã chốt trước đó.
- **Không đọc `design.md` cho các task cục bộ đã rõ yêu cầu:**
  - Sửa CSS/layout, căn lề, wrap text, overflow.
  - Sửa typo, label, text hiển thị.
  - Sửa checkbox, modal, input cụ thể.
  - Sửa bug trong một component/hàm đã xác định.
  - Test hoặc sửa regression nhỏ; task chỉ tác động 1–2 file và không đổi contract hệ thống.
- **Quy tắc nạp và cập nhật:**
  - Chỉ đọc section liên quan trực tiếp, không đọc toàn bộ file.
  - Không để nội dung cũ trong `design.md` lấn át yêu cầu mới nhất của người dùng. Nếu mâu thuẫn, ưu tiên yêu cầu mới và cập nhật lại `design.md` nếu là thay đổi thiết kế chính thức.
  - **Không cập nhật `design.md` chỉ để ghi lại việc sửa bug hoặc hoàn thành task.** Chỉ cập nhật khi có quyết định thiết kế lâu dài.
  - Use the central Obsidian vault at E:\coding\Obsidian for durable project rules and decisions under the global task-tier retrieval policy; keep design.md as the code-level contract.

## 4. NGÔN NGỮ GIAO TIẾP
- **Luôn phản hồi bằng tiếng Việt** khi giao tiếp với người dùng.
- Sử dụng tiếng Việt có dấu đầy đủ và chính xác.
- Đảm bảo thông tin rõ ràng, dễ hiểu cho người dùng Việt Nam.

## 5. QUY TẮC TƯƠNG TÁC
- **Luôn diễn giải lại yêu cầu** của người dùng để đảm bảo hiểu đúng.
- **Chỉ thực thi khi người dùng đồng ý** sau khi diễn giải.
- Phần diễn giải chỉ dùng lời nói, đặt thêm câu hỏi nếu muốn biết thêm thông tin, không viết code.
- Code chỉ được viết khi người dùng xác nhận đồng ý.
- Người dùng viết "OK tiến hành đi" tức là sẽ thực thi công việc mà không hỏi gì thêm.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->


## 6. QUY ĐỊNH GỌI AGY CLI TỪ CODEX (HEADLESS EXECUTION)
- Khi Codex đóng vai trò điều phối (coordinator) gọi gy (Antigravity CLI):
  1. **Cho phép sử dụng cờ --dangerously-skip-permissions**: Môi trường daemon/headless PTY không có TTY tương tác để duyệt lệnh, cờ này được phép sử dụng để công cụ file/command của AGY hoạt động bình thường.
  2. **Fallback tự động**: Nếu lệnh gy thất bại, timeout, hoặc gặp lỗi môi trường, Codex được phép fallback tự sinh mã theo spec thay vì dừng lại ở trạng thái BLOCKER.


## MULTI-AGENT GIT WORKFLOW & AUTOMATIC COMMIT
1. **Hai Luồng Độc Lập**:
   - **Antigravity Desktop**: Nhận task trực tiếp từ người dùng, tự phân tích, code, test và commit độc lập, không phụ thuộc C2C.
   - **Codex–AGY**: ChatGPT chuẩn bị Task Context Package, Codex orchestrate, AGY CLI execute, Codex review/test.
2. **Tự Động Hóa Theo Khẩu Lệnh Người Dùng (Zero Manual Command)**:
   - Khi người dùng bảo: 'commit', 'lưu lại', 'lưu commit', 'tiếp tục', 'làm đi':
     - Agent tự động kiểm tra diff, lọc file an toàn (không stage file nhạy cảm, secrets, hoặc file của task khác), chạy test và commit chuẩn (feat, fix, refactor).
     - Tuyệt đối không yêu cầu người dùng gõ lệnh thủ công.
3. **Quy Ước Nhánh & Worktree**:
   - Nhánh Antigravity: task/antigravity/<task-id>
   - Nhánh Codex–AGY: task/c2c/<task-id>
   - Nhánh chính: main
   - Khi chạy đồng thời, bắt buộc dùng Git Worktree tại .worktrees/<sanitized-branch-name>.
   - Cấm xóa worktree khi còn uncommitted changes.
4. **An Toàn Database & Production**:
   - Cấm migration đồng thời lên database production.
   - Không dùng prisma db push trên production.
   - Quét phát hiện destructive SQL (DROP TABLE, DROP COLUMN) trước khi tích hợp.
