# Loại bỏ runtime DDT legacy khỏi PCN_webapp

## Mục tiêu

Chuyển repository về một runtime duy nhất là Next.js PGDCN (PCN + PGD), loại bỏ entrypoint, UI và tooling DDT cũ không còn được route hiện hành sử dụng, đồng thời giữ nguyên contract tích hợp để PCN vẫn gửi PYC và nhận phản hồi từ các phòng thử nghiệm DDT bên ngoài.

## Phạm vi

- Xác nhận route sản phẩm hiện hành là `app/**` và shell `PcnAppShell`/`PgdcnAppShell` dưới namespace `/pgdcn/**`.
- Loại bỏ entrypoint Vite/React cũ và nhóm module chỉ được `App.tsx`/`store.ts` DDT cũ sử dụng.
- Loại bỏ script chạy DDT legacy, dependency build Vite không còn dùng và fixture/template DDT chỉ phục vụ runtime cũ.
- Dọn các class, tài liệu và contract kiểm tra còn khẳng định Vite/entrypoint DDT là runtime sản phẩm.
- Đặt mặc định server và dev command theo profile PCN.
- Bổ sung kiểm thử guard để module active không import runtime DDT legacy.

## Ranh giới bắt buộc giữ lại

- `server.ts` và các API PCN/PGD đang được Docker production sử dụng.
- `utils/pcnLabIntegration.ts`, biến môi trường `PCN_LAB_DDT_*` và adapter outbound/inbound để PCN giao tiếp với app DDT bên ngoài.
- Các type/utility dùng chung còn được import bởi PCN/PGD.
- Database, storage và container DDT bên ngoài; task này không xoá dữ liệu runtime.

## Nguyên tắc xoá

Chỉ xoá file sau khi xác nhận không có import từ route Next, shell PCN/PGD, `server.ts`, script migration/production hoặc test đang được giữ lại. File legacy không thể xoá an toàn trong đợt này phải được ghi rõ là compatibility backend và giữ nguyên.

## Kiểm thử nghiệm thu

- Guard test không còn entrypoint Vite/legacy DDT trong production source.
- Guard test vẫn tìm thấy adapter DDT của PCN và các biến môi trường tích hợp.
- `npm run test:all` cho nhóm test PCN/PGD liên quan đạt.
- `npm run typecheck`, `npm run build`, `git diff --check` đạt.
- Docker image PCN build/recreate thành công; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` trả HTTP 200.

## Ngoài phạm vi

- Không thay đổi schema hoặc xoá collection/database DDT.
- Không đổi payload mapping PYC giữa PCN và DDT.
- Không di chuyển lịch sử tài liệu, backup hoặc dữ liệu người dùng.
