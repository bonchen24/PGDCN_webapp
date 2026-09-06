# Đặc tả: Hồ sơ mẫu quản trị trực quan

Ngày: 2026-09-06

## Mục tiêu

Tạo workspace **Hồ sơ mẫu** cho Admin và Quản lý PGDCN. Workspace tập hợp các bộ hồ sơ mẫu PCN/PGD, cho phép tạo mới, tạo revision, chỉnh sửa bằng giao diện trực quan, gán checklist tài liệu cho từng node, xem preview Archify, publish và ngừng áp dụng.

Người dùng không phải thao tác JSON. JSON Archify là projection nội bộ để render reader, không phải nguồn chỉnh sửa.

## Phạm vi và quyền

- Workspace chung có hai tab domain: PCN và PGD.
- Admin hệ thống quản lý được cả hai domain khi tài khoản có scope tương ứng; Quản lý chỉ quản lý domain có `departmentScopes` và role/chức danh quản lý hợp lệ.
- Tài khoản không có quyền quản trị không được hiển thị entry quản trị; nếu điều hướng trực tiếp thì nhận thông báo từ chối.
- PCN giữ contract/storage `PcnWorkflowTemplate` hiện có.
- PGD có contract/storage workflow template riêng; không đọc hoặc ghi collection PCN.

## Trải nghiệm người dùng

### Danh sách

Danh sách có tìm kiếm mã/tên, lọc domain và trạng thái, thống kê số bộ mẫu/phiên bản, và card hiển thị mã, tên, version, số node, số cạnh, số checklist, phạm vi áp dụng, người cập nhật và trạng thái.

Thao tác theo trạng thái:

- `DRAFT`: mở chỉnh sửa, tạo revision, publish.
- `PUBLISHED`: xem preview, tạo revision, retire.
- `RETIRED`: xem chi tiết lịch sử; không sửa tại chỗ.

### Editor trực quan

Editor gồm ba vùng:

1. Palette node: công việc/tài liệu, phê duyệt, quyết định, tách song song, gom song song, kết thúc.
2. Canvas: workflow theo lane/cột; kéo node giữa các drop zone; nối cạnh bằng chọn node nguồn rồi node đích.
3. Inspector: thuộc tính node/cạnh và checklist tài liệu của node đang chọn.

Thêm node sinh ID ổn định phía client cho draft; server chuẩn hóa và cấp ID/version chính thức khi lưu. Các thao tác canvas chỉ thay đổi draft trong state của editor cho tới khi người dùng chọn lưu.

Checklist tài liệu dùng ô tìm kiếm và checkbox từ requirement catalog của domain. Không upload file ở đây. Requirement được lưu theo ID/code ổn định trong node và được kiểm tra lại server.

Preview Archify mở ở panel hoặc modal cạnh editor, do builder domain chuyển draft thành `ArchifyWorkflowDocument`. Preview là reader chỉ đọc; chọn node trong reader đồng bộ node đang chọn trong editor nếu khả dụng.

### Hợp nhất với UX xử lý hồ sơ runtime

Trang quản trị mẫu dùng cùng mental model với UX runtime đã được xây dựng ở `PcnDossierNodeWorkPanel` và `pcnDossierNodeWork`:

- Mở bộ mẫu theo kiểu workflow-first: ban đầu ưu tiên header/thông tin cơ bản và bản đồ; chưa mở danh sách chi tiết nếu chưa chọn node.
- Chọn một node mở đúng vùng **Tài liệu kèm node**, chỉ liệt kê requirement đã gán cho node đó. Mỗi dòng cho biết tên, mã, bắt buộc/tùy chọn và nguồn catalog; không hiển thị tài liệu của node khác.
- Các nút `Upload`, `Tạo theo biểu mẫu`, `Xóa tài liệu`, `Bỏ qua` và `Tiếp tục` thuộc panel xử lý hồ sơ runtime, không xuất hiện như mutation file trên trang quản trị template. Trang template chỉ cấu hình requirement và preview trạng thái/đầu mục mà hồ sơ phát sinh sẽ nhận.
- Tên trạng thái, cách đếm mục đã xử lý, cách hiển thị gợi ý và cách chọn node phải nhất quán với panel runtime. Khi thêm node nhỏ hơn, đó là tạo node độc lập trong revision template; không tách topology của hồ sơ đang chạy.
- Preview Archify và editor cùng dùng stable node/edge IDs để có thể chuyển từ preview sang node đang chọn mà không tạo một topology khác.

### Versioning

Tạo mới bắt đầu từ mẫu rỗng hoặc clone revision. Sửa bản đã publish tạo bản nháp revision mới. Publish chỉ khi validation pass; retire bắt buộc nhập lý do. Hồ sơ runtime đã snapshot không bị ảnh hưởng bởi revision sau đó.

## Dữ liệu và API

PCN tái sử dụng `/api/pcn/workflow-templates` và các mutation revision/publish/retire hiện có, mở rộng response/adapter nếu cần để phục vụ editor có cấu trúc. PGD thêm workflow template contract và endpoint chuyên biệt tương đương dưới `/api/pgd/...`. UI dùng adapter chung để chuyển hai contract domain thành view model editor; adapter không làm phẳng hoặc trộn dữ liệu lưu trữ.

Mỗi bản ghi template gồm metadata versioned, `nodes`, `transitions` và requirement references theo node. PGD requirement references dùng code của `PgdDossierRequirement`; PCN dùng ID của `PcnDocumentRequirement`. Không lưu asset file trong template.

Preview template dùng endpoint đọc riêng của domain để trả HTML Archify từ topology draft/persisted đã validate. HTML không chứa dữ liệu hồ sơ thật, file private, checksum hoặc thông tin runtime nhạy cảm.

## Validation và lỗi

Client hiển thị lỗi inline trước publish; server là nguồn quyết định cuối. Các rule tối thiểu: metadata bắt buộc, ID duy nhất, edge hợp lệ và không tự trỏ, có start/end, split có ít nhất hai nhánh, join có ít nhất hai đầu vào và policy hợp lệ, condition/action key thuộc allowlist, requirement đúng domain và không trùng trong node.

Lỗi lưu giữ nguyên draft trên màn hình và hiển thị toast + vùng lỗi. Conflict version trả HTTP 409 và yêu cầu người dùng tải lại thay vì âm thầm ghi đè. Loading state khóa nút mutation tương ứng.

## Files dự kiến

- `components/PgdcnSidebar.tsx`, `components/PgdcnAppShell.tsx`: entry và target điều hướng chung.
- `components/PgdcnDossierTemplateManagementView.tsx`: danh sách, domain tabs và state editor.
- `components/PgdcnDossierTemplateCanvas.tsx`, `components/PgdcnDossierTemplateInspector.tsx`: canvas/palette/inspector tách trách nhiệm.
- `components/PcnDossierNodeWorkPanel.tsx`, `utils/pcnDossierNodeWork.ts`: contract UX runtime cần giữ tương thích khi chiếu requirement của node.
- `utils/pgdcnDossierTemplate.ts`: view model/adapters và thao tác draft dùng chung.
- `utils/pgdWorkflowTemplate.ts`, `utils/pgdWorkflowTemplateApi.ts`: contract, validation, API PGD.
- `utils/pgdArchifyWorkflowTemplate.ts`, `utils/pcnArchifyWorkflowTemplate.ts`: builder preview từ template, giữ stable IDs.
- `store-pgd.ts`, `store-pcn.ts`: bootstrap/mutation state cho template.
- `server.ts`, `sql/pcn-schema.sql`: boundary, persistence, allowlist và seed/indices PGD.
- `test/`: unit, API contract và UI interaction tests.

## Kiểm thử nghiệm thu

- Admin/Quản lý đúng scope thấy đúng domain và mutation; user ngoài scope bị từ chối.
- Tạo draft, kéo node, nối cạnh, gán requirement, lưu và mở lại giữ nguyên cấu hình.
- Validation chặn topology sai và cho publish topology hợp lệ.
- Publish/retire tạo audit và không sửa snapshot hồ sơ runtime.
- Preview Archify phản ánh node/cạnh/lane/requirement label của draft mà không chứa file private.
- Mở template ban đầu không hiển thị phần tài liệu chi tiết; chọn node chỉ hiện requirement của node đó và không lộ thao tác file runtime.
- Mobile editor vẫn thao tác được qua scroll/inspector; lựa chọn node không dựa riêng vào màu.
