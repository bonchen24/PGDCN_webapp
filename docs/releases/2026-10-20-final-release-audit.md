# Kiểm toán chốt phát hành — 2026-10-20

**Trạng thái: BLOCKED — còn lỗ hổng mức cao trên các đường xử lý tài liệu production.**

- SHA đã kiểm tra: `affe8d7391c52038dec29851b3c6adb1cfd2401c`
- Baseline production: `ccda52144313a304acc0827659b2b6af1930ee6b`
- QA chạy trong worktree detached `E:\CODING\_release_finalize_20261020`; trạng thái ban đầu sạch, không có `.env`, `.temp`, `secrets/`, `node_modules/` hoặc `.next/`.
- Không chạy Docker, không push, không sửa database.

## Thay đổi được chốt

Hai tác vụ lập trình trước đã có mặt trên `master`:

- `256f922` — ẩn thao tác sửa PGD với người dùng chỉ đọc.
- `13963e0` — gắn form nháp PCN với requirement được chọn.

Các commit sau baseline `ccda521`:

- `c3eba6d` — bỏ route nháp PCN không được hỗ trợ.
- `1f3475b` — phản ánh trạng thái tải hồ sơ PGD trong panel bước.
- `3ec2597` — ẩn thao tác tải lên cho tài liệu PGD đã miễn.
- `c7591ca` — mở các form nháp PCN có hỗ trợ từ node.
- `256f922` — khóa thao tác chỉnh sửa PGD theo quyền chỉ đọc.
- `13963e0` — ràng buộc form nháp PCN với requirement.
- `a389a8a` — nhập bản sửa test `23c8a4e` từ nhánh checkpoint. Xung đột được giải quyết bằng cách giữ cả assertion route hiện tại lẫn assertion requirement/node mới.
- `affe8d7` — thay assertion nguồn lỗi thời bằng kiểm tra render component: bản nháp thiếu trường vẫn lưu được; requirement không hỗ trợ không được lưu.

`8f65ffa` là commit ghi lại hồ sơ production `ccda521`, đứng trước baseline và được giữ làm ngữ cảnh lịch sử.

## QA trên SHA cuối

| Lệnh | Kết quả |
|---|---:|
| `npm ci` | PASS — 278 package; cảnh báo kiểm toán dependencies được triage bên dưới |
| `npm run typecheck` | PASS |
| `npm run test:pcn` | PASS — 925/925 |
| PGD/PGDCN/drafting — 116 file test có tên khớp `pgd`, `pgdcn` hoặc `drafting` | PASS — 416/416 |
| `npm run build` | PASS — exit 0 |

Test được cập nhật `test/pgdcn-intelligent-pcn-drafting-ui.test.ts` render component thật. Test xác nhận validator trả về không hợp lệ với form trống nhưng nút lưu vẫn bật; cùng component ẩn nút lưu nếu requirement context không được hỗ trợ. Không thay đổi logic production trong lượt này.

Build tạo `.temp/` và cập nhật `next-env.d.ts` riêng trong worktree QA. Workspace gốc không bị build.

## Security triage

Trên đúng lockfile của SHA cuối:

- `npm audit --json`: exit 1, **17 package bị ảnh hưởng** — 5 moderate, 10 high, 2 critical.
- `npm audit --omit=dev --json`: cùng 17 package. Tất cả entry nằm trong dependency tree production (`dev=false`); một số package chỉ thuộc tooling hoặc mã legacy và không có call path trong tiến trình production hiện tại.
- Không chạy `npm audit fix` hoặc update hàng loạt.

| Package đã khóa | Mức / loại | Đường chạy và đánh giá |
|---|---|---|
| `xlsx@0.18.5` | High, direct | Đọc spreadsheet từ private assets trong `lib/server/pgd-assistant.ts:382`; đây là parser production nhận file hồ sơ. Advisory áp dụng khi đọc workbook được tạo có chủ ý. NPM không cung cấp bản đã vá; SheetJS nêu bản vá 0.20.2 qua CDN. Đây là blocker. [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9). |
| `@xmldom/xmldom@0.8.13` | High, transitive | Qua `mammoth`/`docxtemplater`; `mammoth.extractRawText` đọc DOCX ở `app/api/gemini/extract-requests/route.ts:124` và `lib/server/ocr.ts:211`. Đường đọc DOCX production có thể nhận tài liệu tải lên, nên blocker. Audit cho biết có bản vá. |
| `adm-zip@0.6.0` | High, direct | `app/api/extract-radimation/route.ts:305` mở ZIP lấy từ multipart upload, sau đó đọc entry; các advisory DoS/zip-bomb liên quan parser này. Audit cho biết có bản vá `0.6.1+`. |
| `image-size@2.0.2` | High, direct | Đọc buffer ảnh trong `app/api/extract-radimation/route.ts:267` và `app/api/generate-docx/route.ts:461`; advisory infinite-loop áp dụng cho một số định dạng ảnh. Audit cho biết có bản vá. |
| `next@16.3.7` | High, direct | Tiến trình production dùng Next. Các finding trong npm audit phụ thuộc tính năng cụ thể; repo không có Pages Router, `use cache`, metadata image route hoặc `images.remotePatterns`, và advisory SSRF ghi rõ không ảnh hưởng khi không cấu hình `remotePatterns`. Next có advisory RCE cho image optimization trên glibc; Dockerfile hiện dùng `node:22-alpine`, nên điều kiện nền tảng không khớp. Đề xuất nâng tối thiểu lên bản đã vá `16.4.1` trước lần triển khai kế tiếp để loại bỏ phụ thuộc vào các điều kiện này. [Next SSRF advisory](https://github.com/vercel/next.js/security/advisories/GHSA-cjq9-62q9-8jv4), [Next SVG RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw). |
| `xmldom@0.1.31` | Critical, transitive | Qua `docxtemplater-image-module-free`. Module chỉ gọi DOMParser ở nhánh PPTX; `app/api/generate-docx/route.ts` hiện chọn template `.docx` từ `public/`, nên chưa thấy đầu vào PPTX không tin cậy đi vào nhánh này. Ghi nhận là package critical đang cài nhưng không xem là call path khai thác hiện tại. Không có bản vá theo audit; thay module cũ nếu cần hỗ trợ PPTX. |
| `proxy-addr@2.0.7` | Critical, transitive | Qua Express trong `server.legacy.ts`. Docker chạy `npm start` → `scripts/run-next-start.cjs`, không khởi chạy Express legacy; không thấy call path production hiện tại. |
| `basic-ftp@6.2.0` | High, direct | Chỉ được import bởi `server.legacy.ts`; không dùng trong tiến trình Next hiện tại. |
| `compression@1.8.1` | High, direct | Chỉ được import trong `server.legacy.ts`; không dùng trong tiến trình Next hiện tại. |
| `multer@2.2.0` | High, direct | Chỉ được cấu hình trong `server.legacy.ts`; không dùng trong tiến trình Next hiện tại. |
| `undici@7.29.0` | High, transitive | Qua `cheerio`; route chỉ gọi `cheerio.load` để đọc XML cục bộ, không gọi API tải URL của Cheerio. Chưa thấy call path tới phần mạng bị ảnh hưởng. |
| `source-map-js@1.2.1` | High, transitive | Qua PostCSS/Next và Tailwind; thuộc xử lý CSS/build, chưa thấy parser này nhận dữ liệu request trong runtime. |
| `argparse@1.0.10` | Moderate, transitive | Qua `mammoth`; được dùng bởi CLI của Mammoth, không phải lời gọi `extractRawText` trong API. |
| `sprintf-js@1.0.3` | Moderate, transitive | Theo chuỗi `argparse`/Mammoth CLI; chưa thấy đường gọi từ API production. |
| `mammoth@1.12.0` | Moderate, direct | NPM ghi nhận phụ thuộc CLI nêu trên; API dùng thư viện đọc DOCX, đồng thời chịu finding high riêng của `@xmldom/xmldom`. |
| `docxtemplater-image-module-free@1.1.1` | Moderate, direct | Dùng khi sinh DOCX; finding đi qua `xmldom` cũ và nhánh parser hiện tại chỉ dành cho PPTX. |
| `qs@6.15.3` | Moderate, transitive | Qua Express/body-parser của `server.legacy.ts`; không thuộc tiến trình Next hiện tại. |

**Quyết định:** BLOCKED vì `xlsx`, `@xmldom/xmldom`, `adm-zip` và `image-size` nằm trên các đường xử lý tài liệu/ảnh production có dữ liệu hồ sơ hoặc upload. Kết quả test và build xanh không thay thế remediation.

**Remediation tối thiểu:** tạo thay đổi bảo mật riêng từ lockfile sạch; thay `xlsx@0.18.5` bằng bản SheetJS đã vá qua nguồn chính thức hoặc thư viện thay thế được duyệt; nâng `@xmldom/xmldom`, `adm-zip` và `image-size` đến bản đã vá; nâng Next lên ít nhất `16.4.1`; thay `docxtemplater-image-module-free` nếu cần xử lý PPTX. Sau đó chạy lại audit, typecheck, hai suite và production build. Không sửa `package.json`/`package-lock.json` đang dirty của workspace gốc trong lượt này.

## Workspace và thao tác phát hành

Workspace gốc vẫn giữ nguyên sáu file tracked dirty (`.agents/teamwork/BRIEFING.md`, `.agents/teamwork/ORIGINAL_REQUEST.md`, `.agents/teamwork/handoff.md`, `AGENTS.md`, `package.json`, `package-lock.json`) và các path untracked có trước lượt này. Không stage chúng. Các commit mới chỉ chứa test đã xác minh và report này; không push.

Docker Desktop build/deploy được để lại cho tác vụ release kế tiếp, sau khi blocker bảo mật được xử lý.
