# Thiết kế AI Trợ lý PCN

## Mục tiêu

AI Trợ lý là một workspace nghiệp vụ cá nhân hóa cho nhân viên Phòng Chứng nhận. Workspace phải trả lời được người dùng cần làm gì, hồ sơ nào đang chậm, dữ liệu nào còn thiếu và bước tiếp theo của hồ sơ, dựa trên dữ liệu PCN hiện tại. Chat chỉ là một bề mặt của workspace, không phải giao diện chính.

## Phạm vi và nguyên tắc

- Giữ nguyên PCN shell, sidebar, pipeline, dossier detail và các module hiện hành.
- Thêm mục sidebar `AI Trợ lý` trong `PcnWorkspace`, đặt sau `Kiểm kê hồ sơ lịch sử` và trước `Đề nghị`.
- Không dùng `components/AIChatBot.tsx` của DDT cho PCN. AI PCN không nhận context nghiệp vụ do trình duyệt tự gửi và không dùng API key cá nhân từ header.
- PostgreSQL PCN là nguồn dữ liệu duy nhất; dashboard không dùng mock data.
- Nội dung hồ sơ, tên file và text do người dùng nhập là dữ liệu không tin cậy, không được coi là chỉ dẫn cho model.

## Mô hình danh tính và capability

`systemRole` quyết định quyền truy cập hệ thống; `departmentRoleCode` mô tả loại công việc; `fieldCodes` giới hạn phạm vi QC4/QC9; assignment của dossier quyết định quan hệ công việc trực tiếp. Không dùng một role duy nhất để cấp quyền cho Agent.

`AgentContextBuilder` lấy user từ session HttpOnly và đọc lại `systemUsers` server-side trước khi tạo context. Context an toàn gồm user snapshot, chức vụ, system role, field scope, responsibility dẫn xuất, capability hiệu lực, công việc được phép xem và ngày hiện tại theo `Asia/Ho_Chi_Minh`. Không đưa password, token, raw file bytes hoặc toàn bộ database vào model.

Capability được derive từ chức vụ, assignment và các policy PCN hiện hành:

- Dùng chung: xem công việc của tôi, tìm hồ sơ trong phạm vi, xem deadline, phân tích hồ sơ, kiểm tra thiếu tài liệu.
- `CERTIFICATION_EXPERT`: theo dõi đánh giá, KQTN và chuẩn bị nội dung đánh giá.
- `TECHNICAL_REVIEWER`: xem hồ sơ chờ soát xét và checklist review.
- `SAMPLE_COORDINATOR`: theo dõi lô mẫu, PYC và kết quả phòng thử nghiệm.
- `DOCUMENT_CLERK`: theo dõi tài liệu và chuẩn bị draft tài liệu.
- `LEADERSHIP` hoặc `systemRole=admin`: xem backlog, workload, hồ sơ chưa phân công và hồ sơ chờ phê duyệt; chỉ được đề xuất điều phối.
- `viewer`: chỉ đọc, không được tạo proposed action có khả năng ghi dữ liệu.

Capability không thay thế permission server. Mọi action ghi dữ liệu phải gọi lại policy endpoint chuyên biệt của PCN với actor lấy từ session hiện tại.

## Context workspace và priority

`pcnAgentWorkspace` dùng lại `buildPcnWorkQueueRows`, `buildPcnDossierCompleteness` và `getPcnPipelineStation` để tạo các projection:

- `myWork`: hồ sơ liên quan trực tiếp qua owner/evaluator/reviewer/approval assignment.
- `deadlines`: deadline dossier và PYC có liên kết, kèm trạng thái quá hạn/sắp đến.
- `metrics`: việc hôm nay, việc quá hạn, hồ sơ đang xử lý, hồ sơ chờ khách hàng, deadline gần.
- `recommendations`: cảnh báo hồ sơ quá hạn, thiếu tài liệu, đứng lâu, bị block, mới có kết quả hoặc mới được bổ sung.
- `departmentWorkload`: chỉ trả khi capability cho phép.
- `tasks`: các `pcnTasks` đang mở được giao trực tiếp; metrics tách `openTasks`, `overdueTasks` và cộng task vào tổng quá hạn/today tương ứng. Vai trò theo dõi mẫu có shortcut và tool riêng cho hồ sơ đang chờ KQTN.

Priority score do backend tính bằng rule ổn định: quá hạn, số ngày tới hạn, trạng thái block/chờ, thiếu tài liệu, thời gian không đổi và mức độ giao việc. Mỗi item phải trả `score`, `reasons`, `priority` và nguồn dữ liệu. LLM chỉ diễn giải projection này.

## Tool layer

Agent chỉ gọi registry các tool đã định nghĩa, không expose SQL:

`get_my_work`, `get_overdue_work`, `get_upcoming_deadlines`, `search_certification_records`, `get_certification_record`, `get_missing_documents`, `get_record_workflow`, `get_test_results`, `get_pending_reviews`, `get_pending_approvals`, `get_department_workload`.

Mỗi tool nhận context server-side, kiểm tra capability/scope trước khi đọc và trả projection tối thiểu. Tool không được gọi HTTP tùy ý, shell, code execution hoặc truy cập file ngoài boundary PCN.

## API và LLM

- `GET /api/pcn/agent/workspace`: dựng lại context và workspace từ database hiện tại.
- `POST /api/pcn/agent/chat`: nhận message giới hạn kích thước, dựng context mới, chạy tool whitelist và trả response blocks có cấu trúc.
- `POST /api/pcn/agent/actions/:id/confirm`: xác nhận action đã đề xuất; server xác thực actor, capability, payload và policy trước khi ghi.
- `POST /api/pcn/agent/actions/:id/cancel`: hủy proposed action.

Response blocks gồm `message`, `work_summary`, `record_list`, `task_list`, `warning`, `recommendation`, `draft`, `proposed_action`, `chart_data`. Câu hỏi “việc của tôi” trả cả hồ sơ và task; câu hỏi “quá hạn/chậm” gọi riêng tool hồ sơ và task. Phân tích hồ sơ hiển thị nhãn tài liệu thiếu thực tế từ checklist; yêu cầu bổ sung tài liệu chỉ tạo draft, không ghi dữ liệu nghiệp vụ.

LLM provider được trừu tượng hóa. Provider hiện tại dùng Gemini server-side với `AGENT_ENABLED`, `AGENT_PROVIDER`, `AGENT_MODEL` và `GEMINI_API_KEY`; không nhận API key từ client. Khi provider không sẵn sàng, các truy vấn chuẩn vẫn dùng câu trả lời grounded từ deterministic tools, không dựng dữ liệu giả.

## Action policy và task

Ba mức action:

- `READ`: tự động đọc, tìm, lọc, phân tích và tóm tắt.
- `DRAFT/PROPOSE`: tạo draft hoặc đề xuất trong response, chưa ghi nghiệp vụ.
- `EXECUTE_WITH_CONFIRMATION`: sau khi người dùng xác nhận, server kiểm tra lại quyền rồi mới ghi.

MVP có một entity `pcnTasks` tối thiểu vì PCN hiện chưa có entity task: tiêu đề, loại, dossier liên quan, người phụ trách, hạn, trạng thái, nguồn tạo, timestamps. Agent chỉ được đề xuất/tạo task theo dõi nghiệp vụ sau xác nhận. Không cho Agent tự approve/cấp/sign/xóa hồ sơ hoặc tài liệu, chỉnh quyền user, tạo admin, đổi cấu hình hay ký số.

`agentConversations`, `agentMessages`, `agentActions`, `agentAuditLogs` và `pcnTasks` dùng document collections riêng trong `app_documents`, chỉ truy cập qua endpoint Agent chuyên biệt, không mở rộng generic CRUD cho client. `agentAuditLogs` append-only và lưu user, conversation, message, tools, records accessed, recommendation, proposed/confirmed action, execution result, timestamp.

## UI workspace

`PcnAgentWorkspaceView` nhận user identity để hiển thị nhưng dùng API server làm nguồn dữ liệu. Layout desktop-first theo design system PCN:

1. Header AI Trợ lý và chức vụ hiện tại.
2. KPI “Công việc của tôi”.
3. Kanban/list ưu tiên với work card chuẩn, completeness và nút mở dossier chuẩn.
4. Task của tôi (khi có task mở), AI Đề xuất và cảnh báo có lý do dữ liệu.
5. Quick Actions render từ capability server trả về.
6. Chat nghiệp vụ và response block có cấu trúc.

Không tạo bản sao mutation của dossier. Card chỉ dẫn về dossier canonical hoặc module hiện hành. Tablet/mobile chuyển thành một cột và giữ nút hành động chạm được.

## Kiểm thử bắt buộc

- User A không đọc được công việc của User B nếu không có capability/phạm vi.
- Leadership có thể xem workload khi có capability; specialist không thấy projection quản lý.
- Capability thay đổi theo `systemRole`, `departmentRoleCode`, `fieldCodes` và assignment.
- Priority, completeness, missing documents và briefing là deterministic.
- Tool registry từ chối tool không whitelist hoặc ngoài scope.
- Proposed action không làm thay đổi dữ liệu; confirm action mới tạo task.
- Forbidden action luôn bị từ chối ở server.
- Workspace và chat API trả dữ liệu thật theo session.
