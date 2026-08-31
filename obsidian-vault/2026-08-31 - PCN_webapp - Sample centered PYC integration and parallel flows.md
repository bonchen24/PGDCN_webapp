<!--
Author: Codex
OS support: Windows / Node
Description: PCN sample-centered PYC, parallel sample flows and lab-app integration handoff
-->

# PCN_webapp — Mẫu thử trung tâm, PYC và tích hợp phòng thử — 2026-08-31

## Quyết định nghiệp vụ

- Một PYC tương ứng đúng một lô mẫu.
- Một lô có thể có một hoặc nhiều `PcnSampleItem`; mỗi mẫu/model có mã mẫu, loại mẫu, model, số lượng và đơn vị riêng.
- Cùng một lô gửi nhiều phòng thử thì mỗi phòng có một PYC riêng, nhưng tất cả cùng liên kết về `sampleLotId`.
- Mỗi mẫu/model có thể chạy luồng độc lập và song song. Trạng thái hoặc FAIL của mẫu này không khóa mẫu khác.
- PYC mới không được tạo rời lô/tuyến. PYC cũ thiếu liên kết chỉ được giữ để đối soát tương thích.

## Phần đã triển khai trong PCN

- `PcnSampleItem`, `sampleItemIds`, `itemSnapshots` và projection theo từng mẫu/model.
- Card quản lý hiển thị phòng thử theo thứ tự, vị trí hiện tại, PYC, lịch thử, trạng thái thực hiện, ngày bắt đầu/kết thúc, PASS/FAIL và KQTN.
- Tạo lô lưu các item con và route trong transaction; tổng quantity của lô được tính từ quantity từng item.
- PYC tạo trong card hồ sơ; gửi PYC và đồng bộ lại đi qua server PCN, browser không gọi trực tiếp app phòng thử.
- Webhook HMAC có replay protection, idempotency, duplicate/stale guard và hỗ trợ cập nhật theo `pcnSampleItemIds`.
- Reconcile lấy snapshot hiện hành từ app phòng thử rồi đưa qua cùng pipeline xử lý webhook.

## Hợp đồng bàn giao cho DDT/Hiệu suất

- App phòng thử triển khai `POST /api/integrations/v1/lab-requests` để nhận PYC.
- App phòng thử triển khai `POST /api/integrations/v1/lab-requests/:externalRequestId/reconcile` để trả event hiện hành.
- App phòng thử gửi webhook về `/api/pcn/integrations/lab-status-events`.
- Event dùng `externalSequence` độc lập theo từng `pcnSampleItemId`; reconcile trả `statusEvents[]` để không dùng sequence của mẫu này chặn mẫu khác. `statusEvent` đơn chỉ giữ để tương thích.
- Không gửi secret, password hoặc byte file qua payload; KQTN chính thức vẫn đi qua boundary tiếp nhận KQTN của PCN.
- Hai app phòng thử dùng database riêng, chỉ kết nối PCN qua API/HMAC.

## Kiểm thử và trạng thái

- `npm test`: **559/559 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: exit 0; cảnh báo còn lại là line-ending trên Windows.
- Đã rebuild/recreate container production PCN `pcn_webapp-webapp-1` và DDT `ddt_webapp-webapp-1` trên network `supabase_default`; cả hai `/api/health` trả HTTP 200 sau deploy. Cần nghiệm thu một PYC thật có từ 2 mẫu để xác nhận webhook/reconcile xuyên container.

## Ghi chú an toàn

- Không lưu secret, credential, file hồ sơ thật hoặc raw payload vào Memory/Obsidian.
- `design.md` vẫn là nguồn chuẩn duy nhất cho schema, API và UI; ghi chú này chỉ là nhật ký triển khai.
