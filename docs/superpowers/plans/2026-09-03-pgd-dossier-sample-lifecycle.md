# Kế hoạch hoàn thiện PGD từ mẫu nghiệp vụ phòng

## Ràng buộc chung

- Nguồn tham chiếu PGD trên Desktop chỉ được đọc để suy ra cấu trúc nghiệp vụ; không sửa, xóa, copy, import hoặc đọc nguồn đó lúc runtime.
- `design.md` là SSoT; PGD vẫn độc lập với PCN, QC20 không được xuất hiện trong catalog PGD.
- Chỉ bổ sung khả năng cho hồ sơ mới; giữ tương thích với các hồ sơ PGD đã tạo trong app.

## Task 1 — Domain checklist và vòng đời mẫu

- Bổ sung `pgdDossierDocuments` vào allowlist PGD.
- Tạo utility PGD riêng cho nhóm yêu cầu checklist, pointer tài liệu, validate mẫu, sổ mẫu và hủy mẫu có audit.
- Mở rộng `PgdSample` với mã niêm phong, cỡ lô/mẫu, người/địa điểm/ngày lấy, retention và trạng thái hủy.
- Viết test trước implementation; test phải chứng minh checklist thép/máy/than, provenance PGD, tách LAB/RETAINED và không hard-delete.

## Task 2 — API và persistence

- Bootstrap trả checklist/document evidence và samples.
- Thêm API metadata tài liệu chứng từ theo request; nếu Storage đã cấu hình thì nhận file private, nếu chưa thì cho phép ghi nhận metadata có kiểm soát.
- Thêm API cập nhật metadata mẫu và hủy mẫu; mọi mutation kiểm tra quyền PGD, khóa hậu ký và ghi `pgdActivityLogs`.
- Không đưa tài liệu chứng từ vào `pgdDocuments` (đây là collection của tài liệu sinh từ template).

## Task 3 — UI card PGD

- Hiển thị checklist hồ sơ chứng từ theo nhóm, trạng thái thiếu/đã có, phiên bản và tải file khi có.
- Hiển thị sổ mẫu PTN/mẫu lưu, số niêm phong, hạn lưu và trạng thái hủy; hỗ trợ ghi nhận chứng từ metadata và thao tác nghiệp vụ cần thiết.
- Giữ giao diện compact; không hiển thị QC20 trong mọi projection/catalog PGD.

## Task 4 — Memory và verification

- Cập nhật memory/Obsidian sau khi tính năng hoàn tất.
- Chạy test targeted, toàn bộ test, typecheck, build và kiểm tra không có runtime reference Desktop/UNC.
