<!--
Author: Gemini
OS support: Web/Node
Description: Nhật ký triển khai KQTN Bulk footer-first segmentation và OCR trang đầu.
-->

# KQTN Bulk — Footer-first segmentation và OCR trang đầu

## Bối cảnh

Bulk KQTN PDF ghép gặp HTTP 524 tại `/api/gemini/extract-kqtn-bulk-structure`. Request đồng bộ gửi batch scan nhiều trang vào Gemini, sau đó retry page-level, khiến thời gian vượt reverse-proxy timeout.

## Quyết định

- `Nhiều PDF đơn`: mỗi file chỉ gửi PDF trang đầu tới metadata OCR để nhận diện và gán mẫu thử.
- `Một PDF ghép`: lượt 1 chỉ OCR footer theo batch; lượt 2 chỉ OCR trang đầu của mỗi segment ứng viên.
- Footer là tín hiệu tìm mốc, không phải bằng chứng đủ để upload. Chỉ chấp nhận mốc khi `footerKey` khác nhóm trước và lặp lại ở trang kế tiếp.
- Footer tĩnh, footer nhiễu, thiếu metadata, timeout hoặc OCR trang đầu thất bại đều giữ nhóm ở trạng thái cần rà soát/manual split.

## Thay đổi đã triển khai

- `design.md` mục 11.2 ghi nhận quy tắc footer-first và first-page OCR.
- `server.ts` giữ timeout 45 giây, một model/một attempt; thêm `mode: "footer"` cho endpoint bulk structure và schema `footerKey`; timeout trả HTTP 504 với `KQTN_STRUCTURE_TIMEOUT`.
- `utils/kqtnPdfClient.ts` thêm `extractKqtnBulkFooter`.
- `utils/kqtnBulkSplit.ts` thêm `KqtnBulkFooterPage` và `buildKqtnFooterSegments`, có trim trang trắng ở cuối segment.
- `components/KqtnBulkPdfUploadModal.tsx` đổi sang footer batch 6 trang; sau khi tạo segment, tạo PDF một trang đầu và gọi `extractKqtnPdfMetadata` để mapping.

## Kiểm thử

- `npm test`: 272/272 pass.
- `npm run lint`: pass.
- `npm run build`: pass; chỉ còn cảnh báo bundle lớn hơn 500 kB.
- `git diff --check`: pass.

## Runtime / vận hành

- Port `1359` đang có listener PID `22268`; kiểm tra HTTP root và module Bulk Upload đều trả 200, module chứa flow footer-first mới.
- Máy có lỗi `uv_os_get_passwd ENOMEM` khi chạy trực tiếp `npm run dev`. Workaround:

```powershell
$env:NODE_OPTIONS='--require=E:\CODING\DDT_webapp\scripts\test-node-userinfo-preload.cjs'
node node_modules/tsx/dist/cli.cjs server.ts
```

- Không dừng PID đang giữ port nếu chưa xác định chắc đó là tiến trình của workspace.

## Việc nên làm tiếp

- Thử với một PDF scan thực tế có footer mã báo cáo thay đổi theo từng mẫu.
- Nếu footer của tài liệu chỉ là footer tĩnh, giữ manual split; không nới điều kiện tự động tách.

<!-- --- End of 2026-08-24 - DDT_webapp - KQTN bulk footer-first OCR.md --- -->
