<!--
Author: Codex
OS support: Windows / Node / Docker Desktop
Description: PCN dossier five-step completion workflow and verified Docker Desktop production deployment
-->

# PCN_webapp — Hoàn thiện hồ sơ theo từng bước và Docker production — 2026-09-02

## Kiểm tra ảnh và sửa responsive mobile lần hai

Ảnh thực tế cho thấy lần sửa scroll trước chưa đủ: bản đồ workflow và tóm tắt bước vẫn nằm ngoài `main`, chiếm gần hết viewport và bị shell `overflow-hidden` cắt nên checklist phía dưới không thể tiếp cận. Card dashboard cũng có nguy cơ tràn mép phải do mã hồ sơ dài và status badge không giới hạn.

Đã đưa `DossierWorkflowSummary` vào trong `pcn-dossier-focus-scroll`; header nhận diện, bộ chọn vùng và footer vẫn nằm ngoài scroll body. Card pipeline và các wrapper dashboard dùng `min-w-0/w-full`, mã hồ sơ dùng `break-all`, status badge dùng `max-w/truncate`. `design.md` đã cập nhật cùng quy tắc responsive này.

## Kết luận

Đã hoàn thiện workflow hồ sơ PCN theo hướng mỗi bước là một vùng thao tác trong chi tiết hồ sơ, không phải card lọc. `design.md` vẫn là nguồn chuẩn duy nhất; note này chỉ là nhật ký tham chiếu.

## Workflow đã triển khai

1. **Tiếp nhận & đầu vào**
2. **Lấy mẫu & gửi PTN**
3. **KQTN & đánh giá**
4. **Hoàn thiện & soát xét trước duyệt**
5. **Phê duyệt — Lãnh đạo thực hiện**

Mỗi bước có checklist tài liệu bắt buộc/tùy chọn, chỉnh sửa dữ liệu, tải phiên mới, lịch sử phiên, tiến độ và nút **Hoàn tất bước và chuyển bước**. Bước sau bị khóa khi gate bước trước chưa đạt; owner được hoàn thiện bước 1–4 và có thể xem/sửa bước trước khi hồ sơ chưa được duyệt.

Khi mở từ dashboard, hàng đợi hoặc sổ nghiệp vụ, hồ sơ giữ ngữ cảnh vùng thao tác được chọn; nếu không có ngữ cảnh thì chi tiết tự mở theo bước hiện tại và tự cập nhật vùng khi trạng thái chuyển bước. Chuẩn bị bộ GCN/QĐ chỉ được hiển thị ở bước 4, không còn mặc định mở mọi hồ sơ ở vùng Tài liệu.

Workspace hồ sơ mở toàn màn hình, chỉ tập trung vào hồ sơ đang xử lý. Nút **Bổ sung tài liệu** nằm ngay dưới sơ đồ bước; khi bấm sẽ mở checklist và tự cuộn tới yêu cầu có thể bổ sung đầu tiên. Mỗi yêu cầu phân biệt rõ **Bổ sung file**, **Thay phiên bản** và **Chưa đến bước hiện tại**, đồng thời giữ lịch sử phiên.

Trên mobile, workspace dùng shell `100dvh` với `min-h-0`; vùng nội dung dùng flex boundary `h-0 min-h-0 flex-1` và class `pcn-dossier-focus-scroll` để cuộn dọc độc lập, hỗ trợ `touch-action: pan-y` và `-webkit-overflow-scrolling: touch`. Header, bản đồ bước, bộ chọn vùng và footer không bị trôi theo nội dung; checklist, lịch sử phiên và nút bổ sung file đều có thể quan sát đầy đủ.

Sau bước 5 là lifecycle riêng: **cấp số → phát hành → giao khách hàng → lưu trữ**. Không có bước 6.

## Quyền, gate và audit

- Bước 5 chỉ có một approval step hiệu lực của Lãnh đạo.
- Waiver phải có lý do; `decidedBy` và `decidedAt` do server đóng dấu. Waiver không xóa requirement hoặc lịch sử file.
- GCN/QĐ bản dự thảo phải có trước khi trình duyệt.
- Từ chối duyệt quay về bước 4 và giữ lý do/audit.
- Sửa tài liệu hoặc dữ liệu bước trước sẽ mở lại các bước sau để rà soát và đưa approval/bộ phát hành về trạng thái cần trình lại.
- Sau duyệt/phát hành, muốn sửa phải thu hồi qua boundary riêng `POST /api/pcn/issuance/:issuanceId/withdraw`, có kiểm tra quyền, lý do, actor, thời điểm và idempotency; bản chính/số phát hành không bị ghi đè.
- Dữ liệu cũ giữ nguyên mã trạng thái và approval history read-only; không migrate cưỡng bức.

## Verification code

- `npm run test:pcn`: **635/635 pass**.
- `npx tsc --noEmit -p tsconfig.json`: pass. Repository không có script `typecheck`; `npm run lint` vẫn là bước kiểm tra TypeScript hiện hành.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: pass; chỉ còn cảnh báo line-ending LF/CRLF của Git trên Windows.

## Docker Desktop production

Lệnh triển khai:

```powershell
docker compose --env-file .env -f docker-compose.pcn.yml up --build -d
```

Kết quả đã xác minh:

- Image: `pcn_webapp-webapp:latest`
- Digest: `sha256:3ae998a85680f803e12f09f66624fa5686b2b9ccaa51a6a36cdd83e45dd89819`
- Container: `pcn_webapp-webapp`
- Port: `0.0.0.0:2357->2357/tcp`
- `GET http://localhost:2357/api/health`: HTTP 200, `{"status":"ok"}`
- `GET http://localhost:2357/`: HTTP 200
- Container log xác nhận kết nối và khởi tạo PostgreSQL thành công.

Không thay đổi `.env` và không lưu secret, credential, raw payload hoặc file hồ sơ thật vào Memory/Obsidian.

## Files tham chiếu

- `design.md`
- `server.ts`
- `components/PcnDossierDetailView.tsx`
- `components/PcnIssuanceView.tsx`
- `utils/pcnWorkflowStages.ts`
- `utils/pcnDossierStepAccess.ts`
- `utils/pcnDossierStageGate.ts`
- `utils/pcnIssuance.ts`
- `index.css` (`.pcn-dossier-focus-scroll`)
- `test/pcn-mobile-scroll.test.ts`
- `test/pcn-dashboard-layout.test.ts`
