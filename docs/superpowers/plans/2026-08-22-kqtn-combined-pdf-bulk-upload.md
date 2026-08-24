# KQTN Combined PDF Bulk Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mở rộng Bulk Upload KQTN để tách một PDF scan ghép nhiều báo cáo thành các PDF con, rà soát mapping theo từng nhóm trang, rồi upload tuần tự vào các KQTN record hiện hữu.

**Architecture:** Giữ nguyên API upload PDF đơn và dùng `pdf-lib` ở browser để đọc số trang, gửi batch trang nhỏ cho Gemini nhận diện trang bìa, tạo segment thuần bằng helper có thể kiểm thử, sau đó tách/upload từng segment. Luồng nhiều PDF đơn hiện tại tiếp tục dùng matching và upload cũ; UI thêm chế độ rõ ràng cho PDF ghép để không tự tách nhầm một báo cáo nhiều trang.

**Tech Stack:** React/TypeScript, `pdf-lib`, Express, Gemini structured JSON, Node test runner via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-08-22-kqtn-combined-pdf-bulk-upload-design.md`

## Global Constraints

- Không tạo API upload hàng loạt; mỗi PDF con gọi `uploadKqtnPdf(recordId, file)`.
- `sampleCode`/`sampleKey` là định danh chuẩn; `reportNo` chỉ là tín hiệu matching và không thay thế `sampleCode`.
- PDF nguồn chỉ tồn tại trong state phiên; chỉ PDF con được upload và lưu metadata pointer.
- Mapping confidence thấp, không khớp hoặc trùng candidate không được tự động upload.
- Segment upload tuần tự; thành công giữ nguyên, lỗi được giữ lại để retry.
- PDF con phải tuân thủ giới hạn 25 MB hiện hành.

### Task 1: Pure segment and matching contracts

**Files:**
- Create: `utils/kqtnBulkSplit.ts`
- Modify: `utils/kqtnBulkMatching.ts`
- Test: `test/kqtn-bulk-split.test.ts`, `test/kqtn-bulk-matching.test.ts`

- [x] Viết test đỏ cho segment từ trang bìa M02-M07, trim blank ở biên, normalize range không overlap và fallback manual khi không có cover.
- [x] Viết test đỏ cho matching ưu tiên sample code/report number, seal stamp, model+brand, rồi model thấp confidence.
- [x] Cài helper và mở rộng candidate/inspection metadata.
- [x] Chạy focused tests xanh.

### Task 2: Structure extraction API

**Files:**
- Modify: `utils/kqtnPdfClient.ts`
- Modify: `server.ts`
- Test: `test/kqtn-pdf-api-contract.test.ts`

- [x] Bổ sung client `extractKqtnBulkStructure` gửi batch PDF và page offset.
- [x] Bổ sung route `/api/gemini/extract-kqtn-bulk-structure` với JSON schema cho từng trang.
- [x] Chuyển page number batch-local sang page number toàn file và fallback lỗi rõ ràng.
- [x] Bổ sung contract test cho endpoint/prompt/schema.

### Task 3: Combined-PDF review/upload UI

**Files:**
- Modify: `components/KqtnBulkPdfUploadModal.tsx`
- Modify: `test/kqtn-ui-contract.test.ts`

- [x] Giữ nguyên chế độ nhiều PDF đơn và thêm chế độ một PDF ghép.
- [x] Khi phân tích PDF ghép, tạo batch trang, gọi structure API, dựng segment draft và cho phép nhập `pageStart/pageEnd`.
- [x] Hiển thị metadata, confidence, candidate selector, trạng thái, preview PDF con và thêm/xóa segment.
- [x] Chặn mapping chưa rà soát, overlap, candidate trùng, record tạm và PDF con vượt 25 MB.
- [x] Tách PDF con bằng `pdf-lib`, upload tuần tự, xác nhận overwrite theo segment, giữ failed để retry và chỉ đóng khi không còn việc cần xử lý.
- [x] Cập nhật focused UI contracts.

### Task 4: Verification and handoff

**Files:**
- Modify: `design.md` only if implementation reveals a spec correction.

- [x] Chạy focused tests, `npm run lint`, `npm run build`.
- [x] Chạy full test suite và ghi nhận riêng lỗi có sẵn ngoài phạm vi.
- [x] Kiểm tra `git diff --check` và báo rõ thao tác deploy/restart cần thiết.

<!-- --- End of 2026-08-22-kqtn-combined-pdf-bulk-upload.md --- -->
