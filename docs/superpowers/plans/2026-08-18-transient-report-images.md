<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch loại bỏ persistence cho ảnh OCR và ảnh tạm lập báo cáo
-->

# Transient Report Images Implementation Plan

**Goal:** Không lưu ảnh OCR/ảnh lập báo cáo vào PostgreSQL hoặc Storage khi lưu KQTN; chỉ giữ trong state để xử lý trong phiên.

**Spec:** `docs/superpowers/specs/2026-08-18-transient-report-images-design.md`

## Task 1: Test the persistence boundary

- [x] Viết test helper loại bỏ toàn bộ trường ảnh nhưng giữ metadata/số liệu.
- [x] Viết test contract cho ReportGeneratorView.
- [x] Chạy test đỏ trước implementation.

## Task 2: Implement transient-only KQTN persistence

- [x] Thêm helper tạo payload KQTN an toàn trước khi gọi `addKqtnRecord`.
- [x] Cập nhật ReportGeneratorView dùng helper.
- [x] Không thay đổi ảnh trong state, OCR hoặc DOCX runtime.

## Task 3: Verify and document legacy data

- [x] Cập nhật design/spec về legacy image cleanup đã xác nhận và hoàn tất.
- [x] Bỏ service-role key khỏi production webapp Compose.
- [x] Chạy full test, lint và build.
- [x] Xóa 114 object hiện hữu sau khi có xác nhận cleanup riêng và tạo backup trước thao tác.

<!-- --- End of 2026-08-18-transient-report-images.md --- -->
