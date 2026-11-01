# Atlas Archify PGDCN — bộ bàn giao cuối

## Mở atlas

Mở [`index.html`](./index.html) trực tiếp bằng Chrome/Edge. Đây là landing page offline, dùng đường dẫn tương đối và không cần API, máy chủ hoặc kết nối mạng. Ba sơ đồ chính nằm đầu trang; bên dưới là từng profile hồ sơ PCN/PGD; cuối trang là 20 sơ đồ tham chiếu kỹ thuật.

Ba lối vào chính:

1. [`00-system-operation.html`](./00-system-operation.html) — **SƠ ĐỒ VẬN HÀNH HỆ THỐNG**: 13 đích menu, lane vai trò, khách hàng, intake PCN/PGD, đề nghị/PYC, dossier, sample–PTN–KQTN, DOCX/checklist, AI/OCR, review/ký, phát hành, lưu trữ, thông báo/audit và API/dữ liệu.
2. [`03-pcn-canonical.html`](./03-pcn-canonical.html) — **SƠ ĐỒ CHI TIẾT LUỒNG HỒ SƠ CHỨNG NHẬN (PCN)**: meta-workflow proposal → match template PUBLISHED → tạo đúng một dossier/checklist → immutable snapshot → node động, nhánh và join → file/sample/PTN khi áp dụng → review, ký, cấp, giao, lưu. Nhánh và yêu cầu file chi tiết phụ thuộc snapshot/template.
3. [`04-pgd-canonical.html`](./04-pgd-canonical.html) — **SƠ ĐỒ CHI TIẾT LUỒNG HỒ SƠ GIÁM ĐỊNH (PGD)**: đúng 12 nhiệm vụ vận hành, theo đúng thứ tự nguồn; giữ khác biệt giữa năm backend business stages, điều kiện sampling/PTN, gate KQTN và tuyến trả sửa.

### Hồ sơ cụ thể có trong mã nguồn

Đây là catalog cấu hình được xác minh trong source code; các ID/version/status của workflow runtime hoặc bản ghi PUBLISHED trong database vẫn là **NOT_VERIFIED** vì không có kết nối đọc database chỉ đọc được cấp. Tên dưới đây không được trình bày thành workflow database đã publish.

**PCN — 2 blank dossier-pack profiles**

- `QC4_BLANK_PACK` — QC4; checklist baseline 14 mục.
- `QC9_BLANK_PACK` — QC9; checklist baseline 17 mục, trong đó 3 thư có điều kiện.

**PGD — 11 profile trong code catalog có `active: true`**

| Mã | Profile trong code | Sơ đồ |
|---|---|---|
| GĐ-THEP-KG | `STEEL_LOT_INSPECTION` | [22-pgd-steel-kg](./22-pgd-steel-kg.html) |
| GĐ-THEP-TT58 | `STEEL_TT58_INSPECTION` | [23-pgd-steel-tt58](./23-pgd-steel-tt58.html) |
| GĐ-MAY-01 | `MACHINERY_LINE_INSPECTION` | [24-pgd-machinery](./24-pgd-machinery.html) |
| GĐ-THAN-01 | `COAL_LOT_INSPECTION` | [25-pgd-coal](./25-pgd-coal.html) |
| GĐ-NGOAI-01 | `OUTSIDE_INSPECTION` | [26-pgd-outside](./26-pgd-outside.html) |
| GĐ-HH-01 | `GENERAL_GOODS_INSPECTION` | [27-pgd-other-goods](./27-pgd-other-goods.html) |
| GĐ-SL-KL-01 | `QUANTITY_WEIGHT_INSPECTION` | [30-pgd-quantity-weight](./30-pgd-quantity-weight.html) |
| GĐ-TTXX-01 | `CONDITION_ORIGIN_INSPECTION` | [31-pgd-condition-origin](./31-pgd-condition-origin.html) |
| GĐ-THEP-CB | `STEEL_CAO_BANG_INSPECTION` | [28-pgd-steel-cb](./28-pgd-steel-cb.html) |
| GĐ-MAY-TN | `MACHINERY_MANUFACTURING_THAI_NGUYEN_INSPECTION` | [29-pgd-machinery-thai-nguyen](./29-pgd-machinery-thai-nguyen.html) |
| GĐ-NGOAI-CT | `OUTSIDE_COLUMN_BRACES_INSPECTION` | [32-pgd-outside-column-braces](./32-pgd-outside-column-braces.html) |

Mỗi profile PGD có rail 12 node và tài liệu riêng theo bước. Các tài liệu kỹ thuật/đầu vào bổ sung lấy từ profile/product group trong mã nguồn; thay đổi runtime/database chưa được kiểm chứng. Hai sơ đồ PCN là pack/checklist profile chứ không khẳng định có workflow template ID, version hay trạng thái PUBLISHED.

## Sổ tay node và bảng hồ sơ

- [`node-handbook.html`](./node-handbook.html) tra cứu 197 node có thao tác: 22 node vận hành hệ thống, 13 node PCN canonical, 12 node PGD canonical, 18 node cho hai PCN pack và 132 node cho 11 PGD profile. Sổ tay có lọc/tìm kiếm, fragment `#node=<id>`, actor, việc cần làm, URL, RBAC, tiền điều kiện, file vào/ra, gate, nhánh, lỗi, handoff và source line ranges; sơ đồ đồng bộ trong iframe.
- [`document-matrix-pcn.html`](./document-matrix-pcn.html) có 18 dòng: 9 bước cho mỗi pack QC4/QC9.
- [`document-matrix-pgd.html`](./document-matrix-pgd.html) có 132 dòng: 12 bước cho mỗi profile PGD.
- [`source-evidence-final.md`](./source-evidence-final.md) ánh xạ node → đường dẫn và dòng code. [`source-evidence.md`](./source-evidence.md) giữ evidence của sơ đồ tham chiếu gốc.

Checklist PCN/PGD trong model dùng trạng thái `MISSING / PRESENT / WAIVED`. Bảng phân biệt file DOCX đang draft, file đã generate nhưng chưa confirm-to-dossier, upload chưa attach, current version, review/verification, waiver và version cũ đã superseded theo từng contract. PGD checklist không khai báo trạng thái riêng `DRAFT / GENERATED / CONFIRMED`; PGD package vẫn kiểm tra asset, tính đầy đủ và hash.

## Tham chiếu kỹ thuật

`00-master.html` và `01-navigation.html`–`19-sequence-pcn-approval-release.html` là 20 sơ đồ tham chiếu đã có. Chúng được giữ lại cho kiến trúc, navigation, intake/assignment, workflow, tài liệu, sample/lab, package/approval, RBAC, AI/OCR, data model/lineage, audit/notification, topology và API sequence. Không có bản tham chiếu nào thay cho ba sơ đồ chính ở đầu atlas.

## Kiểm chứng

- 16 workflow chính/profile đã chạy Archify CLI 3.1.0 `finalize --quality showcase`; receipt cho mỗi map ghi `validate`, `deliver`, `check`, `browser-check` đều `pass`, và SHA-256 receipt khớp file workflow hiện tại.
- 5 sơ đồ đại diện đã qua `visual-check` ở hai kích thước và hai theme: hệ thống, PCN canonical, PGD canonical, QC9, và PGD thép theo lô.
- Chạy kiểm tra tĩnh trong repo bằng `node --test docs/archify/pgdcn-full-system-20261101/test/atlas-integrity.test.cjs`. Bài kiểm tra xác nhận thứ tự 3 sơ đồ chính, 13 profile, đủ 197 node handbook/source pointers, 12 bước PGD, ma trận file và receipt.
- Landing page và viewer được chạy thử bằng Playwright trên static HTTP localhost: link/query viewer, lọc tên/mã và domain, node anchor, iframe sơ đồ, lỗi console/resource; các trang HTML vẫn mở trực tiếp bằng `file://` do dùng relative paths.
- Tên/version/PUBLISHED status của live workflow template không được xác minh. Không truy vấn customer/case data, không đọc file bytes, không ghi database.

## Bằng chứng, snapshot và phạm vi

- Snapshot code: `521f8d517560f3767321c19ad492658bb507b4b4` trên `master`.
- Catalog PCN: `QC4_BLANK_PACK` và `QC9_BLANK_PACK` là profile bộ hồ sơ trống trong source; chúng không phải workflow template record. Checklist source: `utils/pcnDossierDocuments.ts:24-118`.
- Catalog PGD: 11 profile `active: true` trong `utils/pgdDomain.ts:234-447`; checklist: `utils/pgdDossier.ts:171-222`; 12 task: `components/PgdDossierStepWorkPanel.tsx:48-60`.
- DOCX manifest version 1.3 là manifest biểu mẫu, không phải workflow version.
- Tài liệu nằm trong `docs/archify/pgdcn-full-system-20261101/` trên branch/worktree riêng `task/c2c/full-system-archify-20261101`. Chỉ thay đổi artifact tài liệu; không sửa runtime, không deploy, không migration hoặc ghi database.
- AGY headless không khởi tạo được phiên làm việc do môi trường không có credential provider; đã dùng fallback authoring được cho phép trong `AGENTS.md` và chạy các gate Archify cục bộ.


## Đối chiếu giao diện hồ sơ sau đợt UI refresh

- Hướng dẫn thao tác PCN/PGD trong handbook và hai bảng tài liệu được đối chiếu với source commit `081f0a48945dce3c6f419804ce4e6b956e50a147`. Trường `revision` của atlas tiếp tục gắn với snapshot sơ đồ gốc `521f8d517560f3767321c19ad492658bb507b4b4`; metadata UI refresh được ghi riêng.
- PCN giữ rail ngang native và yêu cầu file theo snapshot/template. Với summary không có snapshot, giao diện chỉ nêu tối đa ba tài liệu thiếu của bước đang chọn; “Xem danh sách tài liệu” mở checklist đầy đủ.
- PGD giữ đủ 12 bước và yêu cầu theo productGroup/profile/template. CTA blocker/chỉ xem/đang tải/lỗi chỉ mở workbench; action trên từng dòng dẫn tới thao tác file hiện có. Mọi thay đổi trạng thái vẫn qua API và server gate.
- UI refresh không đổi topology nên 36 workflow candidate/HTML và receipts finalize/browser-check hiện có được giữ nguyên. Atlas vẫn có 3 sơ đồ chính, 13 profile cấu hình đã xác minh trong source, 20 sơ đồ tham chiếu và 197 node handbook. ID/version của workflow PUBLISHED trong database vẫn là **NOT_VERIFIED**.
