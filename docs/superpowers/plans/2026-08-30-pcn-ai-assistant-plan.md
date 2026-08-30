# Kế hoạch triển khai AI Trợ lý PCN

## Phạm vi

Triển khai AI Workspace vào profile PCN, giữ nguyên navigation và workflow hiện tại, sử dụng dữ liệu PostgreSQL thật, không làm thay đổi chatbot DDT legacy.

## Các bước

### 1. Contracts và deterministic domain layer

- Bổ sung type cho `PcnAgentCapability`, `PcnAgentUserWorkContext`, workspace metrics, priority item, recommendation, response block, action và audit.
- Tạo capability service derive từ system role, department role, field scope và assignment; không dùng role đơn độc.
- Tạo workspace service dùng pipeline/work queue/completeness hiện tại để lọc scope, tính priority, briefing, recommendations và workload.
- Tạo task policy và action policy với whitelist, forbidden actions và confirmation state.

### 2. Agent tools và provider

- Tạo tool registry chỉ gồm các tool PCN đã định nghĩa, mỗi tool kiểm tra capability/scope.
- Tạo orchestrator nhận message đã validate, chọn tool deterministic theo intent nghiệp vụ, trả structured response blocks.
- Tạo LLM provider abstraction và Gemini provider server-side; LLM chỉ nhận context projection/tool result.
- Có fallback deterministic khi Agent tắt hoặc provider không khả dụng.

### 3. Persistence và API

- Mở rộng allowlist/schema bootstrap cho các document collections Agent cần thiết.
- Tạo endpoint workspace/chat/action confirm/action cancel dưới `/api/pcn/agent` sau middleware session.
- Server tự load snapshot từ allowlist collection, không nhận danh sách records/permissions từ client.
- Confirm action tạo `pcnTasks` trong transaction sau permission/payload validation; ghi `agentActions` và `agentAuditLogs` append-only.

### 4. UI

- Thêm section `agent` vào `PcnWorkspace` và Sidebar hiện tại.
- Tạo `PcnAgentWorkspaceView` với header identity, KPI, priority cards, recommendations, quick actions, workload quản lý và structured chat.
- Mở dossier/module canonical bằng callback hiện có; không nhân bản form hoặc mutation dossier.
- Giữ responsive desktop-first, mobile một cột, không thêm floating chatbot cho PCN.

### 5. Kiểm thử và kiểm chứng

- TDD cho capability isolation, priority/briefing, tool whitelist, action confirmation và forbidden actions.
- Contract tests cho API route, database collection policy và Sidebar/Workspace.
- Chạy `npm run typecheck` tương đương `tsc --noEmit` nếu script hiện tại không có, `npm test`, `npm run build`, smoke runtime và browser verification trên `1357`.
- Khi thay đổi server, restart native dev server trên cổng `1357` theo quy định của `design.md`.

## Thứ tự thực hiện

1. Test domain layer thất bại.
2. Implement domain layer tối thiểu.
3. Test tool/action thất bại rồi implement.
4. Implement server snapshot/API và persistence.
5. Test API contracts.
6. Implement Sidebar/UI.
7. Chạy full verification và xử lý lỗi thật, không disable lint/typecheck/test.

## Tiếp tục Phase 2: Task nghiệp vụ cá nhân

- Dùng `pcnTasks` đã có trong snapshot để tính `openTasks` và `overdueTasks`, đồng thời đưa các số liệu này vào briefing và KPI.
- Bổ sung tool `get_my_tasks` và trả `task_list` cho câu hỏi việc của tôi/quá hạn; không trộn task vào danh sách hồ sơ.
- Hiển thị task mở trong workspace và trong structured chat, giữ action tạo task ở trạng thái đề xuất cho tới khi người dùng xác nhận.
- Bổ sung shortcut và tool riêng cho `SAMPLE_COORDINATOR` theo dõi hồ sơ đang chờ KQTN; provider nhận context bounded gồm identity, permissions, current date và thống kê công việc, không nhận toàn bộ database.
- Bổ sung kiểm thử đỏ/xanh cho task counters, task briefing, task tool, intent routing và task-list UI contract.

## Tiếp tục Phase 3: Bảo vệ phạm vi Lĩnh vực

- Lọc hồ sơ theo `fieldCodes` server-side trước khi dựng work queue và mọi projection Agent; scope rỗng mới đại diện cho toàn bộ Lĩnh vực.
- Giữ các tool Agent dùng chung projection đã lọc để không tạo đường tra cứu chéo QC4/QC9.
- Bổ sung test cô lập hồ sơ theo scope và chạy lại typecheck/contract trước khi restart server 1357.

## Tiếp tục Phase 4: Đề xuất điều phối cho quản lý

- Bổ sung `get_assignment_candidates` trong allowlist, chỉ trả người dùng đang hoạt động, không phải viewer và phù hợp phạm vi `fieldCodes` của hồ sơ chưa có chủ.
- Xếp ứng viên bằng rule deterministic theo số hồ sơ, quá hạn, deadline gần và tên; không giao quyền quyết định phân công cho LLM.
- Tạo action `PROPOSE_ASSIGNMENT` ở mức `DRAFT/PROPOSED`, ghi audit đề xuất nhưng không sửa `ownerUsername`; boundary confirm hiện tại chỉ thực thi `CREATE_TASK`, do đó đề xuất phân công không thể tự biến thành mutation.
- Hiển thị quick action `Đề xuất phân công` cho capability quản lý và phân biệt card đề xuất phân công với card task cần xác nhận.
- Kiểm thử manager scope, capability/permission, không ghi DB và chạy full suite/build/smoke/browser trên cổng 1357.

## Tiếp tục Phase 5: Tín hiệu KQTN mới và deadline task

- Tạo recommendation `NEW_RESULT` từ KQTN thật được trả trong cửa sổ 3 ngày lịch Việt Nam; giữ dossier scope và nguồn record để audit/giải thích.
- Chuẩn hóa deadline task từ các cách nói rõ ràng của người dùng (`hôm nay`, `ngày mai`, ngày cụ thể) thành ngày ISO trong bản nháp action; không tự suy diễn khi câu hỏi không nêu hạn.
- Giữ action tạo task ở `EXECUTE_WITH_CONFIRMATION`, hiển thị hạn trong mô tả đề xuất và chỉ ghi `pcnTasks` sau confirm.
- Bổ sung test boundary thời gian, KQTN cũ/mới, task proposal và chạy lại full verification/runtime.
