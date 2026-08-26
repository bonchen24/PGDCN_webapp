# ITDC → ITD migration

Ngày: 2026-08-26
Dự án: `E:\CODING\DDT_webapp`

## Quyết định nghiệp vụ

- Mã hóa cũ đang ở `atdEncodeNumber` được nhập vào `itdEncodeNumber`.
- Giữ nguyên toàn bộ giá trị mã, vì vậy `ITDC...` vẫn là `ITDC...`; không đổi tiền tố sang `ITD`.
- Chỉ tự động chuyển khi cột ITD đang trống. Nếu hai cột khác nhau thì giữ nguyên để rà soát.

## Thực hiện

- Cập nhật quy tắc trong `design.md`.
- Thêm helper `utils/itdcToItdMigration.ts` với các trạng thái `migrate`, `already_migrated`, `conflict`, `unchanged`.
- Thêm `scripts/migrateItdcToItd.ts`; dry-run là mặc định, `--apply` dùng transaction và chỉ xóa trường nguồn sau khi cập nhật thành công.
- Tích hợp chuẩn hóa dữ liệu tại `addRequest` và `addRequests` trong `store.ts`.
- Thêm regression test `test/itdc-to-itd-migration.test.ts`.

## Kết quả dữ liệu

```text
mode apply
scanned 108
migrated 108
alreadyMigrated 0
conflicts 0
applied 108
```

Hậu kiểm: tổng `requests=632`, có `108` mã ITDC trong cột ITD, không còn giá trị trong cột legacy ATD. Chạy dry-run lần hai trả `scanned=0`.

## Kiểm thử

- `npm test`: 351/351 pass
- `npm run lint`: pass
- `npm run build`: pass
- `git diff --check`: pass
