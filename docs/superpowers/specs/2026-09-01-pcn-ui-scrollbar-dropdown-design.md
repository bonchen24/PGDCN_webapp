# Thiết kế UI/UX PCN: scrollbar và dropdown chuẩn

Ngày: 2026-09-01
Phạm vi: PCN runtime hiện tại (`/`)
Trạng thái: Đã được duyệt hướng xử lý, chờ review spec trước triển khai

## 1. Mục tiêu

Chuẩn hóa hai hành vi UI xuyên suốt PCN:

1. Mọi trang dài và mọi modal có nội dung vượt viewport phải có vùng cuộn hoạt động, nhìn thấy được khi cần và không làm mất header/footer hoặc nút hành động.
2. Các trường có danh mục hoặc tập giá trị hữu hạn phải dùng dropdown phù hợp; danh sách dài phải có combobox tìm kiếm thay vì `datalist` hoặc nhập tự do không có kiểm soát.

Thay đổi chỉ thuộc UI/layout/accessibility và cách chọn giá trị. Không thay đổi schema, API boundary, persistence, lifecycle, RBAC, format xuất file hoặc dữ liệu nghiệp vụ.

## 2. Hiện trạng và vấn đề

- Shell PCN đã có `main` với `mobile-scroll-y`; các page chính đã dùng `pcn-page-surface`, nhưng contract chưa được kiểm tra tập trung.
- Hầu hết modal chuẩn đã có `max-h`, `min-h-0`, header/footer `shrink-0` và body cuộn.
- Nhánh chỉ-xem của `PcnApprovalModal` dùng panel không có giới hạn chiều cao và body cuộn riêng.
- Modal tạo ủy quyền trong `PcnSignerDelegationPanel` là form trực tiếp không có `max-h`/body cuộn.
- Form Đề nghị dùng `datalist` cho khách hàng. Một số trường danh mục còn dùng input tự do, trong khi các option tương ứng đã có trong snapshot/type/config.
- `PcnLabRequestView` đã chọn hồ sơ, Lĩnh vực, lô và tuyến bằng select nhưng tên phòng thử vẫn có thể nhập tự do; giá trị này cần được dẫn xuất từ tuyến/catalog khi có.

## 3. Thiết kế được chọn

### 3.1. Contract cuộn cấp trang

- `PcnWorkspace` shell tiếp tục là chủ sở hữu duy nhất của cuộn dọc cấp trang qua `main.min-h-0.min-w-0.mobile-scroll-y.overflow-y-auto`.
- Mọi projection/page PCN giữ `pcn-page-surface min-w-0 min-h-full`; không thêm một vùng `h-full overflow-y-auto` mới chỉ để né tràn.
- `index.css` bổ sung token CSS cho scrollbar PCN và `scrollbar-gutter: stable` trên vùng cuộn dọc để tránh layout nhảy khi scrollbar xuất hiện. Hành vi cuộn native vẫn được giữ trên touch.
- Các bảng, timeline hoặc workflow rộng dùng `mobile-scroll-x` ở đúng vùng dữ liệu; không để tràn ngang lan ra body.
- Các page có bottom navigation dùng `mobile-safe-bottom` hoặc padding tương đương để nội dung cuối không bị che.

### 3.2. Contract modal

Modal PCN phải theo cấu trúc:

```text
overlay fixed inset-0
└─ panel flex min-h-0 max-h-[94dvh] flex-col overflow-hidden
   ├─ header shrink-0
   ├─ body min-h-0 flex-1 mobile-scroll-y overflow-y-auto
   └─ footer shrink-0
```

- Modal đơn giản nhưng có khả năng mở rộng vẫn tạo body scroll container ngay từ đầu; khi nội dung vượt viewport, scrollbar xuất hiện mà không đẩy footer ra ngoài màn hình.
- Modal bottom-sheet trên mobile giữ `w-full`, `rounded-t-2xl`, `max-h` theo `dvh`; desktop chuyển về panel giữa màn hình.
- Nhánh render khác nhau của cùng modal, bao gồm nhánh chỉ xem/không đủ quyền, phải dùng cùng contract.
- Không đặt `overflow-hidden` lên panel nếu body không có vùng scroll thay thế.
- Header chứa tiêu đề/đóng, footer chứa hành động; không đặt nút duyệt/lưu ở giữa vùng cuộn nếu nút đó là hành động kết thúc form.
- Modal lồng (ví dụ preview file hoặc output document) phải giữ vùng cuộn độc lập của modal trên cùng; chỉ cho phép cuộn ngang nội dung file/bảng khi cần.

### 3.3. Contract dropdown

Chọn control theo bản chất dữ liệu:

| Loại dữ liệu | Control | Quy tắc |
| --- | --- | --- |
| Tập enum nhỏ | Native `<select>` | Có option placeholder, label rõ, giá trị code giữ nguyên |
| Danh mục dài | Searchable combobox | Tìm theo mã + tên, keyboard/touch, trạng thái rỗng và không có kết quả |
| Chọn nhiều | Checkbox/chip group hoặc multi-select | Giữ nhiều giá trị, có trạng thái đã chọn rõ ràng |
| Giá trị nghiệp vụ tự do | Input/textarea | Chỉ dùng cho mã, tên, model, địa chỉ, mô tả, ghi chú và thông tin chưa có catalog |

Áp dụng tối thiểu:

- Đề nghị: kênh tiếp nhận, khách hàng, Lĩnh vực và các trường enum dùng select; khách hàng dùng combobox khi danh sách dài. Khi chọn khách hàng, snapshot địa chỉ/liên hệ/MST được điền theo hành vi hiện tại. Nếu snapshot cũ không còn trong catalog, hiển thị option hiện tại cần rà soát, không âm thầm làm mất dữ liệu.
- Hồ sơ/PYC: phương thức, trạng thái, Lĩnh vực, hồ sơ, lô, tuyến, phòng thử và kết quả dùng select hoặc dữ liệu dẫn xuất từ tuyến/catalog; PYC, mã hồ sơ, model, tiêu chuẩn và ghi chú vẫn là input tự do khi không có catalog tương ứng.
- Nhân sự/ủy quyền: role hệ thống, role phòng ban, người ủy quyền, người được ủy quyền, người phê duyệt và Lĩnh vực dùng option từ danh sách PCN hiện hành.
- Soạn thảo/sinh tài liệu: loại tài liệu, nguồn hồ sơ, checklist và PYC dùng select/combobox theo độ dài danh sách.
- Không thay `datalist` bằng một select lớn không tìm kiếm nếu danh mục có thể dài; combobox phải là control accessible với `aria-expanded`, `aria-controls`, lựa chọn bằng bàn phím và vùng popup không bị cắt bởi container cuộn.

Không tự phát minh danh mục mới. Control lấy option từ `types.ts`, snapshot PCN hoặc settings/catalog đã có; nếu chưa có catalog thì giữ input tự do và ghi rõ trong kế hoạch triển khai.

## 4. Phạm vi file dự kiến

- `index.css`: token scrollbar, gutter, và contract CSS dùng chung.
- `components/PcnWorkspace.tsx`: contract page shell và combobox khách hàng trong form Đề nghị.
- `components/PcnApprovalModal.tsx`: sửa nhánh chỉ xem theo modal contract.
- `components/PcnSignerDelegationPanel.tsx`: chuyển modal ủy quyền sang cấu trúc có body scroll.
- Các modal PCN hiện hữu (`PcnDossierDetailView`, `PcnDocumentOutputModal`, `PcnLabRequestView`, `PcnIssuanceView`, `PcnOperationalFormModal`, `PcnSampleHandoverModal`, `PcnTemplateSettingsModal`, `PcnPersonalSettingsPanel`, `PcnDossierFilePreview`, `PcnLabRequestDetailModal`, `PcnResultDetailModal`) được rà soát và chỉ chỉnh khi thiếu contract hoặc thiếu `min-w-0/min-h-0`.
- `components/PcnLabRequestView.tsx`, `components/PcnSampleFlowView.tsx`, `components/PcnDraftingWorkspaceView.tsx`, `components/PcnSettingsView.tsx`, `components/PcnUserManagementView.tsx`: thay các input danh mục xác định được bằng select/combobox, không đổi payload.
- `test/pcn-ui-contract.test.ts`: kiểm tra tĩnh các modal/page và các invariant dropdown/scroll để tránh hồi quy.

## 5. Trạng thái, lỗi và accessibility

- Select/combobox có placeholder không hợp lệ khi trường bắt buộc chưa chọn; lỗi hiển thị cạnh field và `aria-invalid`.
- Combobox đóng khi chọn, Escape hoặc click ngoài; không khóa scroll body và không để popup bị cắt bởi `overflow-hidden` của modal.
- Khi danh mục đang tải, control disabled có trạng thái “Đang tải…”; khi rỗng có “Chưa có dữ liệu phù hợp”.
- Giá trị legacy không khớp catalog được giữ nguyên dưới dạng option cần rà soát; không tự xóa hoặc chuẩn hóa dữ liệu.
- Icon-only button vẫn có `aria-label`/`title`; vùng chạm mobile tối thiểu khoảng 44px.
- Scrollbar dùng màu tương phản vừa đủ trên nền sáng, kích thước mảnh; kiểm tra cả Chromium desktop và viewport mobile. Hệ điều hành có thể tự ẩn scrollbar native trên touch, nhưng vùng cuộn vẫn phải thao tác được.

## 6. Kiểm thử và xác minh

1. Chạy `npm run typecheck` nếu script tồn tại, nếu không dùng lệnh typecheck hiện hành của repo.
2. Chạy `npm run test:pcn` và test contract UI mới.
3. Chạy `git diff --check`.
4. Mở runtime PCN, kiểm tra desktop và các viewport 320, 375, 390, 430px.
5. Kiểm tra ít nhất: mở page dài, mở modal form dài, mở modal chỉ xem, mở modal lồng preview, cuộn tới footer, chọn dropdown, tìm combobox, Escape/click ngoài và dữ liệu legacy không khớp catalog.
6. Kiểm tra không có tràn ngang toàn trang và không có nút hành động bị che bởi mobile nav/footer.

## 7. Ngoài phạm vi

- Không đổi database/schema/API hoặc thêm collection/catalog mới.
- Không đổi business state machine, quyền, audit, tích hợp phòng thử hoặc logic sinh tài liệu.
- Không sửa DDT legacy chỉ vì có pattern dropdown/scroll tương tự; chỉ PCN runtime thuộc phạm vi.
