# Redis cache tùy chọn

Ứng dụng có thể dùng Redis để giảm truy vấn lặp lại cho danh sách template workflow PCN và PGD. Redis mặc định tắt; PostgreSQL luôn là nguồn dữ liệu chuẩn. Khi Redis không cấu hình được, mất kết nối hoặc hết thời gian chờ, API tiếp tục đọc PostgreSQL như trước.

## Cấu hình

Tạo một Redis endpoint dùng chung cho các app TVCI, gắn endpoint đó vào Docker private network đang dùng bởi webapp (`supabase_default`). Cấu hình env ở môi trường triển khai, không ghi credential vào source hoặc `.env.example`:

```dotenv
REDIS_ENABLED=true
REDIS_URL=redis://<redis-service-trong-private-network>:6379
```

`docker-compose.pcn.yml` chỉ chuyển tiếp `REDIS_ENABLED` và `REDIS_URL` tới server. Repo này không tạo Redis container và không publish cổng Redis; không đặt các biến này thành `NEXT_PUBLIC_*`. Nếu endpoint yêu cầu mật khẩu, nạp URL có credential từ secret/env bên ngoài repository.

Redis dùng namespace riêng `tvci:pgdcn:v1:<app>:<resource>:...`, TTL tối đa 15 giây và generation invalidation sau mutation template thành công. `/api/health` chỉ trả trạng thái kết nối cùng bộ đếm hit/miss/bypass/error/invalidation; URL và credential không được trả về. Không dùng Redis Pub/Sub cho notification hoặc làm queue bền vững.

## Rollback

Đặt `REDIS_ENABLED=false` hoặc bỏ `REDIS_URL`, rồi khởi động lại app. Không cần migration, xóa key hay thay đổi PostgreSQL. Redis chỉ tham gia hai API GET template; queue AI/document vẫn dùng worker hiện tại và được để dành tới khi có DB persistence cùng idempotency.
