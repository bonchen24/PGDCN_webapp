# PCN_webapp — Chuẩn hóa ngày tháng hành chính trong báo cáo

Ngày: 2026-09-10

## Kết quả

- Phạm vi chỉ áp dụng cho câu ngày tháng hành chính tiếng Việt trong báo cáo: `Hà Nội, ngày … tháng … năm …`.
- Ngày một chữ số thêm số 0: `ngày 01` … `ngày 09`.
- Tháng 1 và 2 thêm số 0: `tháng 01`, `tháng 02`.
- Tháng 3 đến 12 giữ nguyên, không thêm số 0: `tháng 3` … `tháng 12`.
- Phần tiếng Anh không đổi, vẫn dùng tên tháng đầy đủ, ví dụ `August 8, 2026`.

## Tệp đã cập nhật

- `design.md` — ghi quy tắc tại mục thông tin báo cáo.
- `lib/reportFormatting.ts` — formatter `formatBilingualReportDate`.
- `test/report-formatting.test.ts` — test tháng 1, 2, 3 và ngày một chữ số.
- `test/report-docx-metadata.test.ts` — cập nhật contract metadata DOCX.

## Kiểm chứng

- Test báo cáo: **9/9 pass**.
- Full PCN suite: **846/846 pass**.
- `npm run typecheck`: pass.
- `git diff --check`: pass; chỉ có cảnh báo line-ending LF/CRLF của Git.

## Nguồn chuẩn

`design.md` là nguồn chuẩn duy nhất. Ghi chú này chỉ là nhật ký tra cứu, không chứa secret hoặc dữ liệu hồ sơ thật.
