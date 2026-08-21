<!--
Author: Gemini
OS support: Web/Node
Description: Đặc tả loại bỏ toàn bộ tích hợp Google lưu trữ và đồng bộ dữ liệu nghiệp vụ khỏi DDT Lab Web App
-->

# Đặc tả loại bỏ tích hợp Google lưu trữ dữ liệu

## Mục tiêu

Loại bỏ hoàn toàn các đường dẫn GAS Web App, Google Sheets, Google OAuth, Google Drive và Google Tasks khỏi runtime của DDT Lab Web App. PostgreSQL qua REST API là nguồn dữ liệu nghiệp vụ duy nhất; Zustand/IndexedDB chỉ làm lớp cache cục bộ và JSON tiếp tục là định dạng sao lưu.

## Quyết định

- Xóa route proxy `/api/gas`, fallback bootstrap/migrate GAS, autosync Google Sheets và chức năng nhập phiếu từ Google Sheet.
- Xóa luồng đăng nhập OAuth Google cùng UI kết nối Google Sheets/Tasks/Drive. Giữ nguyên Gemini AI vì chỉ phục vụ AI, không phải persistence.
- Xóa module `utils/googleAuth.ts` và component Google Tasks sau khi dọn toàn bộ caller.
- Giữ adapter `utils/firebase.ts` vì tên file hiện tại chỉ còn là compatibility layer cho PostgreSQL; loại bỏ riêng hàm migrate GAS khỏi adapter.
- Không xóa dữ liệu nghiệp vụ hiện có trong PostgreSQL, IndexedDB hoặc file backup.
- Không thực hiện `DROP COLUMN` trên DB đang chạy. Các cột legacy GAS/Google nếu còn tồn tại sẽ không được ứng dụng đọc/ghi; schema cài mới không khai báo chúng.
- Payload backup cũ có thể còn `scriptUrl`, `spreadsheetUrl` hoặc `googleTaskId`; restore phải bỏ qua các trường tích hợp này và không tạo lại kết nối Google.

## Phạm vi thay đổi

### Runtime và dữ liệu

- `store.ts` bỏ state/token Google, action migrate GAS, fetch external qua GAS, xóa Google Task, autosync Google Sheets, diagnostic GAS và fallback GAS.
- `server.ts` không còn `/api/gas`.
- `types.ts` không còn các trường cấu hình Google và kiểu chẩn đoán GAS; dữ liệu lịch sử vẫn được phép tồn tại trong JSONB nhưng không còn là API TypeScript runtime.
- `sql/schema.sql` không khai báo cột cấu hình GAS cho database mới.

### UI

- `App.tsx` không khởi tạo/khôi phục OAuth Google và không hiển thị trạng thái Google Sheets/Tasks.
- `SystemManagementViews.tsx` bỏ card kết nối, lưu/tải Google Sheets; phần Gemini model vẫn giữ.
- `SyncDiagnosticModal.tsx` chỉ còn các tab chẩn đoán, timestamp và collection PostgreSQL/local; bỏ tab/card GAS.
- `RequestModal.tsx` bỏ tab nhập dữ liệu từ Google Sheet và mọi URL mặc định Google.
- `HandoverModal.tsx` bỏ cấu hình spreadsheet thừa.
- `SettingsModal.tsx` bỏ trường script URL mặc định.

### Tệp và dependency

- Xóa source GAS (`gas/backend.gs`), script migrate/test GAS, module OAuth/Sheets/Tasks và component Google Tasks.
- Gỡ dependency `firebase` nếu không còn import runtime nào sử dụng nó; không gỡ `@google/genai` vì Gemini vẫn hoạt động.
- Cập nhật tài liệu dự án và kế hoạch PostgreSQL cũ để không mô tả GAS là nguồn import tùy chọn.

## Tương thích và an toàn dữ liệu

- Bản ghi bị xóa trước đây vẫn được bảo vệ bởi các tombstone PostgreSQL/local hiện có; việc bỏ GAS không được khôi phục chúng từ nguồn ngoài.
- Các trường legacy trong payload không bị xóa hàng loạt để tránh phá backup hoặc dữ liệu JSONB; chúng chỉ bị bỏ qua.
- Các thao tác CRUD sau thay đổi chỉ ghi PostgreSQL và cập nhật local store.

## Tiêu chí nghiệm thu

1. Không còn import/call runtime tới `googleAuth`, `/api/gas`, `migrateGASDataToPostgres`, `googleToken`, `googleUser`, `spreadsheetUrl`, `scriptUrl` hoặc `googleTaskId` trong source ứng dụng, ngoại trừ các kiểm thử tương thích/historical data được chủ động giữ lại.
2. Không còn UI Google Sheets, GAS Web App hoặc Google Tasks; UI Gemini vẫn còn.
3. Diagnostic chỉ báo cáo PostgreSQL và local store.
4. Test contract mới bắt lỗi nếu các điểm tích hợp trên quay lại.
5. `npm test`, `npm run lint` và `npm run build` đều kết thúc với exit code 0.

## Không thuộc phạm vi

- Không xóa dữ liệu trong tài khoản Google hoặc PostgreSQL.
- Không thay đổi Gemini AI, đăng nhập nội bộ, phân quyền, backup JSON hoặc API PostgreSQL ngoài việc loại bỏ route GAS.
- Không thay đổi cấu hình `.env`.

<!-- --- End of 2026-08-17-remove-google-integrations-design.md --- -->
