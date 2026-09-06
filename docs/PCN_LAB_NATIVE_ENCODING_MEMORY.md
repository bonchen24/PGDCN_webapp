# PCN — Memory/obs: native encoding liên thông phòng thử

> Ngày: 2026-09-06
> Branch PCN: `codex/pcn-dynamic-dossier-workflow`
> `design.md` vẫn là nguồn chuẩn duy nhất; file này chỉ là note tra cứu vận hành.

## Quyết định nghiệp vụ đã chốt

- `targetSystem` là app đích; `routeCode`/`labCode` là nhánh thử nghiệm.
- `PERFORMANCE` đi tới app `LABFTEE`.
- `EMC` và `ELECTRICAL_SAFETY`/`ITD` cùng đi tới app `DDT` của Phòng thử nghiệm Điện - Điện tử; không tách thành hai app DDT.
- PCN giữ nguyên mã PCN. Mỗi app PTN cấp mã bản địa riêng và lưu crosswalk về `pcnSampleItemId`/`pcnRouteId`.

## Quy tắc cấp mã bản địa

- DDT: PYC `DDT-YYMMDD-TT`; lô chạy dãy năm; mẫu EMC `EMC {lot}-{YY}-Mnn`, mẫu An toàn điện/ITD `ITD {lot}-{YY}-Mnn`.
- LABFTEE: PYC `HS-YYMMDD-TT`; lô chạy dãy năm; mẫu `ECN {lot}-{YY}-Mnn`.
- Cấp mã diễn ra trong transaction ingest, có advisory lock theo app/năm; ACK và reconcile trả lại mã PYC/lô bản địa.
- Callback/status dùng mã bản địa nhưng luôn giữ khóa PCN, đặc biệt `pcnSampleItemId`, để phản hồi đúng từng dòng mẫu.

## Commit đã lưu

- PCN: `c740e0f3182c20e575375793f1ef0a38607933b4` — `feat(pcn): map lab routes to native encodings`
- DDT: `ccafdc56467b88cf8099047c270bd66526b5f5ff` — `feat(ddt): allocate native request and sample codes`
- LABFTEE: `1f0d94f34305497f5ff3dc2998999f35aeb97be0` — `feat(labftee): allocate native request and sample codes`

## Kiểm chứng

- PCN full suite: `821/821` pass.
- DDT full suite: `418/418` pass.
- Native encoding focused tests: DDT `2/2`, LABFTEE `2/2`.
- PCN, DDT và LABFTEE đều build production thành công; LABFTEE `tsc` không còn lỗi liên quan.
- Docker Desktop đang chạy: PCN `2357`, LABFTEE `2358`, DDT `2359`; cả ba `/api/health` trả HTTP `200`.
- Live ACK + reconcile với dữ liệu test ẩn danh:
  - DDT/EMC: `DDT-260906-01`, lô `1304-26`.
  - LABFTEE/PERFORMANCE: `HS-260906-02`, lô `1034-26`.
  - `pcnSampleItemIds` được giữ qua reconcile; dữ liệu test được giữ lại để truy vết vận hành.

## Ghi chú triển khai

- Không commit secret, dữ liệu khách hàng thật hoặc giá trị env thực.
- Các thay đổi/dist/DOCX có sẵn ngoài phạm vi đã không được stage vào ba commit trên.
- Hiện không có connector Memory/Obsidian riêng trong phiên làm việc; note này là bản lưu cục bộ để truy hồi trong workspace.
