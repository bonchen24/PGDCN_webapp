<!--
Author: Codex
OS support: Docker Desktop / Web
Description: Verified fix for PCN assistant private-file reading
-->

# Fix trợ lý PCN không đọc hồ sơ

## Nguyên nhân

Container production trước đó chạy với `.env` của repo nhưng thiếu service-role secret của Supabase. Server vẫn kết nối PostgreSQL và trả health 200, nhưng khi trợ lý tải file private thì dừng với lỗi `PCN file storage is not configured`.

## Đã xử lý

- Recreate bằng repo env kết hợp env Supabase bên ngoài:
  `docker compose --env-file .env --env-file 'E:\CODING\TVCI_APP\supabase-docker\.env' -f docker-compose.pcn.yml up -d --force-recreate webapp`
- Bổ sung Compose guard để thiếu `SUPABASE_SERVICE_ROLE_KEY`/`SERVICE_ROLE_KEY` bị chặn ngay khi validate.
- Không lưu giá trị secret, raw OCR, nội dung hồ sơ hoặc đường dẫn nguồn nghiên cứu vào note.

## Kiểm chứng

- Container `pcn_webapp-webapp` Up trên cổng `2357`.
- Storage private PCN: HTTP 200; tải được PDF test.
- Webapp gọi PaddleOCR nội bộ: HTTP 200; phản hồi có text.
- `npm test`: 691/691 pass; `npm run lint`: pass; `npm run build`: pass.
- Tab domain cũ có session PCN hết hạn; sau khi refresh cần đăng nhập lại đúng môi trường.
