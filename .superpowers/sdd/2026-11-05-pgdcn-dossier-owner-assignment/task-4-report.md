# Task 4 report — Bỏ editor phân công muộn trong PGD operations

## Đã thực hiện

- Gỡ picker, nút lưu, state đồng bộ và callback gán chủ hồ sơ khỏi `PgdDossierOperationsPanel`.
- Dòng chủ hồ sơ vẫn hiển thị username đã lưu hoặc “Chưa gán”; projection không lấy username phiên đăng nhập làm owner mặc định.
- Giữ thông báo `lockedReason` sau khi ký. `PgdDossierAssignmentControl` ở header trong Task 3 là thao tác phân công duy nhất tại màn hình chi tiết.
- Giữ nguyên giới hạn mutation tài liệu, checklist, DOCX/PDF và đóng gói; cập nhật mô tả để không còn nói editor này đổi người phụ trách.

## Bằng chứng RED

Lệnh:

```text
node --require ./scripts/native-dev-preload.cjs ./node_modules/tsx/dist/cli.mjs --test test/pgd-dossier-operations-ui.test.ts test/dossier-owner-assignment-surfaces.test.ts
```

Kết quả trước khi sửa: **11/13 pass, 2 fail đúng kỳ vọng**. Hai regression báo picker/nút lưu còn xuất hiện trong `PgdDossierOperationsPanel`, gồm assertion trên operations panel và assertion xác nhận header không có editor thứ hai.

## Bằng chứng GREEN

- Focused PGD assignment/detail/flow: **14/14 pass** với `pgd-dossier-operations-ui.test.ts`, `dossier-owner-assignment-surfaces.test.ts`, `pgd-dossier-flow-evidence.test.ts`.
- `npm test`: **1.224 pass, 0 fail, 8 skipped** (1.232 tests, 47 suites).
- `npm run typecheck`: exit code 0.
- `git diff --check`: exit code 0.

## Giới hạn

- Không chạy browser end-to-end; regression xác nhận surface và source contract bằng test hiện có.
- Không thay đổi workflow, snapshot, OCR, DOCX, API hay persisted data.
