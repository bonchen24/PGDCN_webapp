# Hoàn thiện Trợ lý AI PGD theo UI/UX PCN

## Kết quả

- PGD dùng cùng nhịp UI với PCN: chọn hồ sơ, đọc theo tiêu chí, stream tiến độ, summary và card finding.
- Mỗi finding hiển thị rõ **Điểm cần sửa / đối chiếu**, nguồn kiểm tra và nút mở bằng chứng private đúng hồ sơ.
- Có trạng thái loading/ready/running/completed/error, hồ sơ đang chọn, progress 5 trạm, lỗi an toàn và retry.
- Vẫn là phiên read-only: AI không phê duyệt, không đổi trạng thái, không ghi ngược dữ liệu.

## Đường đọc hồ sơ

- Server giữ boundary PGD, kiểm tra provenance/bucket/checksum trước khi tải file.
- PaddleOCR là primary cho PDF/ảnh/DOCX scan; Gemini cá nhân là fallback khi OCR không đọc được.
- Text được lọc theo tab tương ứng của từng trạm để semantic review PGD chỉ đánh giá đúng tiêu chí và gắn bằng chứng.

## Kiểm chứng

- Full suite: 691/691 pass.
- `npm run lint`, `npm run build`, `git diff --check`: pass.
- Docker Desktop: `pcn_webapp-webapp` đang chạy port 2357; app health 200; OCR health 200.

Không lưu secret, raw OCR hoặc nội dung hồ sơ thật trong ghi chú này.
