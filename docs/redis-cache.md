# Redis cache tùy chọn

Ứng dụng có thể dùng Redis để giảm truy vấn lặp lại cho danh sách template workflow PCN và PGD. Redis mặc định tắt; PostgreSQL luôn là nguồn dữ liệu chuẩn. Khi Redis không cấu hình được, mất kết nối hoặc hết thời gian chờ, API tiếp tục đọc PostgreSQL như trước.

## Cấu hình

Redis endpoint nội bộ nằm trên Docker private network `tvci_app_redis_private` và được tạo, quản lý ngoài Compose của repo. Cấu hình runtime env bằng secret store hoặc env-file triển khai; không ghi password vào source, `.env.example` hoặc log:

```dotenv
REDIS_ENABLED=true
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=<runtime-secret>
```

`REDIS_URL` không chứa username hoặc password. Overlay `docker-compose.redis-cache.yml` chuyển tiếp ba biến server-side và chỉ nối service `webapp` vào external network `tvci_app_redis_private`; Compose mặc định không tạo Redis container, không gắn service khác vào mạng này và không publish cổng Redis. Không đặt các biến này thành `NEXT_PUBLIC_*`.

Redis dùng namespace riêng `tvci:pgdcn:v1:<app>:<resource>:...`, TTL tối đa 15 giây và generation invalidation sau mutation template thành công. `/api/health` chỉ trả trạng thái kết nối cùng bộ đếm hit/miss/bypass/error/invalidation; URL và credential không được trả về. Không dùng Redis Pub/Sub cho notification hoặc làm queue bền vững.

## Rollback

Đặt `REDIS_ENABLED=false` trong runtime env rồi khởi động lại riêng service `webapp` với cùng overlay; cache sẽ bypass Redis và tiếp tục đọc PostgreSQL. Nếu cần tháo app khỏi private network, bỏ overlay khi khởi động lại service bằng Compose cơ sở. Không cần migration, xóa key hay thay đổi PostgreSQL. Redis chỉ tham gia hai API GET template; queue AI/document vẫn dùng worker hiện tại và được để dành tới khi có DB persistence cùng idempotency.
