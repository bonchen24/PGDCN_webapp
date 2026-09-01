<!--
Author: Codex
OS support: Windows / Node
Description: PCN sample-centered collapsed/open UI implementation note
-->

# PCN_webapp — UI collapsed/open cho PYC & luân chuyển mẫu — 2026-09-01

## Phạm vi

- Trang phục vụ PCN lập PYC và theo dõi luân chuyển mẫu nội bộ giữa các phòng thử thuộc TVCI.
- Mẫu/model vẫn là đối tượng chính; PYC, phòng thử, lịch và KQTN chỉ là thông tin liên kết.
- Không mở rộng sang PYC gửi đơn vị bên ngoài.

## Thiết kế đã triển khai

- Hai projection `PcnSampleFlowView` và `PcnLabOperationsView` mặc định thu gọn từng lô/mẫu.
- Phần tóm tắt luôn nhìn thấy: mã mẫu/model, số lượng, Tuần tự/Song song, vị trí, trạng thái và số phép thử.
- Mở từng mẫu/lô để xem đúng các route đã gán, PYC, lịch thử, thực thi, kết quả và hành động.
- Có **Mở tất cả** / **Thu gọn tất cả** theo danh sách lọc; state chỉ nằm ở UI và không thay đổi dữ liệu nghiệp vụ.
- Giữ nguyên quy tắc quantity: quantity bằng 1 chạy tuần tự theo chặng; quantity lớn hơn 1 có thể chạy song song.

## Files và verification

- Chuẩn UI: `design.md`.
- UI: `components/PcnSampleFlowView.tsx`, `components/PcnLabOperationsView.tsx`.
- Regression contracts: `test/pcn-sample-flow.test.ts`, `test/pcn-lab-operations.test.ts`.
- `npm test`: **573/573 pass**; `npm run lint`: pass; `npm run build`: pass; `git diff --check`: exit 0.

`design.md` là nguồn chuẩn duy nhất; note này chỉ là nhật ký tham chiếu. Không lưu secret, credential, raw payload hoặc file hồ sơ thật.
