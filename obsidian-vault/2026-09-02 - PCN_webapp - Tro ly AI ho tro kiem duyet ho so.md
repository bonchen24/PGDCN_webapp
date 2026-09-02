<!--
Author: Codex
OS support: Windows / Node / Docker Desktop
Description: PCN approval-review assistant implementation and deployment record
-->

# PCN_webapp — Trợ lý AI hỗ trợ kiểm duyệt hồ sơ — 2026-09-02

## Phạm vi đã chốt

Trợ lý là một bề mặt độc lập, tùy chọn, phục vụ phán đoán và kiểm duyệt hồ sơ. Quyết định phê duyệt vẫn thuộc tiến trình canonical của bộ hồ sơ và người có thẩm quyền; trợ lý không phê duyệt thay người dùng.

## Luồng sử dụng

1. Người dùng mở **Trợ lý phê duyệt**.
2. Chọn lĩnh vực QC4 hoặc QC9.
3. Chọn đúng một hồ sơ đang ở `TECHNICAL_REVIEW` hoặc `WAITING_APPROVAL`.
4. Bấm **Xác nhận hồ sơ** để bắt đầu review hỗ trợ.
5. Theo dõi kết quả stream theo từng tiêu chí, mở evidence về hồ sơ/file gốc nếu cần.
6. Có thể xuất báo cáo DOCX/PDF hỗ trợ; không làm thay đổi hồ sơ.

## Bộ tiêu chí

1. Cổng đầu vào và phạm vi hồ sơ.
2. Độ đầy đủ hồ sơ.
3. Nhận dạng hồ sơ/khách hàng.
4. Thương mại và thông tin đề nghị.
5. Phân công đánh giá.
6. PYC, mẫu và chuỗi mã.
7. Kết quả phòng thử nghiệm.
8. Đánh giá kỹ thuật.
9. Quyết định chứng nhận.
10. Chất lượng tài liệu: text layer, OCR, lỗi khoảng trắng/dấu câu/chính tả cơ bản.
11. Logic liên kết và nhất quán hệ thống.

Mỗi finding có trạng thái, severity, nguồn rule/AI, mô tả, gợi ý và evidence gồm asset, tên file, trang, tab và bounding box khi OCR cung cấp được.

## OCR và AI

- PaddleOCR qua `OCR_SERVICE_URL` là nguồn OCR chính.
- PDF được OCR theo từng trang; ảnh xử lý theo asset; file lớn không bị chặn bởi giới hạn tổng 25MB.
- PaddleOCR không khả dụng, trả rỗng hoặc confidence thấp thì phiên review dừng và thông báo cho người dùng.
- Không dùng Gemini làm fallback OCR. Gemini chỉ phân tích semantic bổ sung khi có cấu hình phù hợp; lỗi Gemini không làm mất kết quả rule-first.

## Ranh giới an toàn

- Không có approval action trong UI/API của trợ lý.
- Không cập nhật `app_documents`, trạng thái/lifecycle, approval chain, issuance package hoặc activity/audit log.
- Kết quả review lưu memory TTL 15 phút; export là artifact tạm.
- Không lưu secret, credential, raw prompt/OCR hay dữ liệu hồ sơ thật vào note.

## Files chính

- `components/PcnAssistantView.tsx`
- `components/PcnWorkspace.tsx`
- `server.ts`
- `utils/pcnApprovalReview.ts`
- `utils/pcnApprovalReviewOcr.ts`
- `utils/pcnApprovalReviewReport.ts`
- `test/pcn-approval-assistant.test.ts`
- `test/pcn-approval-assistant-ocr.test.ts`
- `test/pcn-approval-assistant-report.test.ts`
- `test/pcn-approval-assistant-ui.test.ts`
- `design.md`

## Verification

- `npm test`: **630/630 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass.

## Deployment note

- Commit local: `57d07c6` (`feat(pcn): add approval review assistant`). Các thay đổi ngoài phạm vi trợ lý vẫn giữ nguyên chưa commit.
- Đã chạy `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d` trên Docker Desktop.
- Image: `pcn_webapp-webapp:latest`, digest `sha256:42bda0d9fcd350dfac750f925e06132d29bfcceab6f1fdbbaf45310d05cc7da6`.
- Container: `pcn_webapp-webapp`, trạng thái `Up`, port `0.0.0.0:2357->2357/tcp`.
- `GET http://localhost:2357/api/health`: HTTP 200 `{"status":"ok"}`; `/`: HTTP 200.
- Log xác nhận PostgreSQL kết nối thành công và schema khởi tạo thành công.
- Có cảnh báo automatic backup không chạy vì Supabase Storage chưa được cấu hình trong env triển khai; không ảnh hưởng health của app. Cần bổ sung cấu hình Storage ngoài repository nếu muốn bật backup tự động.
- Không sửa `.env` và không lưu secret, credential, raw payload hoặc file hồ sơ thật vào Memory/Obsidian.
