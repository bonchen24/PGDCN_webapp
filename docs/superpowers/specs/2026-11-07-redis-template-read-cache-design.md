# Thiết kế cache Redis cho danh sách template PCN/PGD

## Mục tiêu

Giảm truy vấn PostgreSQL lặp lại khi đọc danh sách template workflow của PCN và PGD, đồng thời giữ nguyên PostgreSQL làm nguồn dữ liệu chuẩn và giữ nguyên policy xác thực, quyền, workflow, hồ sơ và phê duyệt hiện có.

## Phạm vi

- Cache read-through cho `GET /api/pcn/workflow-templates` và `GET /api/pgd/workflow-templates` sau khi route xác thực session và kiểm tra quyền hiện hành.
- Scope key gồm app/module, resource, username đã chuẩn hóa và mọi role/scope dùng trong policy của route; key lưu hash scope thay vì session token hoặc dữ liệu nhạy cảm.
- Cache có TTL 15 giây và generation riêng theo app/resource. Mutation template thành công tăng generation; nếu invalidation thất bại thì mutation vẫn thành công và TTL giới hạn stale data.
- Redis chỉ bật khi `REDIS_ENABLED=true` và có `REDIS_URL`. Timeout, Redis down hoặc cấu hình tắt đều chạy loader PostgreSQL hiện tại. Không retry liên tục.
- Cung cấp trạng thái và bộ đếm hit/miss/bypass/error/invalidation an toàn qua health endpoint; không trả URL hoặc secret.
- Docker Compose chỉ chuyển tiếp env tới app trên private network sẵn có. Không tạo Redis service/container hoặc publish Redis port; endpoint dùng chung được quản lý bên ngoài repo.
- Thêm hướng dẫn bật/tắt/rollback. Không thay đổi `.env`, schema PostgreSQL, workflow gate, IndexedDB outbox, revision/CAS, notification persistence, RBAC policy hoặc worker.

## Ngoài phạm vi

- Cache hồ sơ, PYC, mẫu vật, lịch, KQTN, chữ ký, phê duyệt, phiên đăng nhập, thông tin xác thực hoặc payload file.
- Redis Pub/Sub, queue hoặc thay thế worker. Tác vụ AI/document chỉ được xem xét sau khi có queue persistence trong DB và idempotency.
- Tạo Redis container riêng trong repo hoặc kết nối client/browser trực tiếp tới Redis.

## Các hướng đã cân nhắc

1. **Cache `/api/db/:collection` dùng chung** — bị loại vì phạm vi rộng, cần cache/invalidation cho nhiều loại dữ liệu và tăng nguy cơ lộ dữ liệu theo scope.
2. **Tạo API mới cho catalog tĩnh PCN** — bị loại vì trùng với catalog hiện có và không giảm truy vấn PostgreSQL runtime.
3. **Cache hai API GET template workflow hiện có** — được chọn vì dữ liệu đã ở PostgreSQL, route có policy server-side, test tập trung được theo từng app, và cache có thể vô hiệu hóa sau mutation mà không sửa cấu trúc workflow.

## Thiết kế

`lib/server/redis-cache.ts` cung cấp Redis client node-redis v6 tùy chọn, timeout hữu hạn, reconnect tự động tắt, cooldown ngắn khi lỗi, read-through có coalescing request đồng thời, TTL, generation invalidation đọc/ghi từ Redis dùng chung và metrics trong process. Namespace dùng dạng `tvci:pgdcn:v1:<app>:<resource>:scope:<sha256>:g<generation>`.

Hai GET route giữ nguyên authorization/query. Sau kiểm tra quyền, route tạo scope từ actor hiện tại và gọi cache với loader chứa đúng query hiện có. Các route POST/update/revision/publish/retire tăng generation sau transaction thành công. Cache lỗi không làm lỗi API; PostgreSQL tiếp tục xử lý request.

## Kiểm thử

- Unit tests với Redis store giả lập, không kết nối DB production: hit/miss, TTL, generation invalidation, scope isolation, concurrent miss, disabled/down/timeout fallback và metrics.
- Route contract/integration tests riêng PCN và PGD xác nhận authorization diễn ra trước cache, cache đúng scope, invalidation sau mutation, và phản hồi vẫn như cũ khi Redis off.
- Chạy focused tests, typecheck và kiểm tra diff. Không build image hoặc triển khai production.
