<!--
Author: Codex
OS support: Windows / Node / Docker Desktop
Description: PGD template/cell module and verified PCN/PGD production deployment
-->

# PCN_webapp — PGD template, cell và Docker production — 2026-09-02

## Cập nhật 2026-09-03 — Governance QC20 và review template PCN

- QC20 chỉ thuộc PCN. Đã bổ sung cấu hình phạm vi cấp phòng `PcnSettings.qc20ScopeConfiguration`, tách khỏi snapshot QC20 của từng Đề nghị; trạng thái khởi tạo là chờ Admin PCN xác nhận, không tự điền danh mục pháp lý/kỹ thuật.
- Admin xác nhận qua `POST /api/pcn/settings/qc20-scope/confirm`; bắt buộc phiên bản phạm vi, nguồn đối chiếu, dạng sản phẩm, mác thép, mã HS, tiêu chuẩn áp dụng, profile thành phần hóa học và ghi chú. Có actor/thời điểm/audit, retry cùng cấu hình là idempotent. `GET /api/pcn/settings/qc20-readiness` chỉ đọc.
- Phát hành QC20 bị chặn nếu phạm vi/profile chưa xác nhận hoặc template GCN/QĐ chưa có asset private đúng fingerprint/provenance và trạng thái `APPROVED`. Cài đặt PCN có preflight GCN/QĐ và review `Phê duyệt`, `Yêu cầu chỉnh sửa`, `Ngừng dùng`.
- Thay asset của template đã duyệt sẽ reset về `NEEDS_ANNOTATION` và xóa thông tin duyệt cũ; phải review lại. Không đọc runtime, sao chép, sửa, xóa hoặc import file từ thư mục PGD/UNC.
- Verification: active PCN **678/678**, focused governance/template **18/18**, lint/build/diff-check pass; full maintenance suite **1140/1145**, 5 lỗi còn lại chỉ ở contract historical attachment/source discovery bị loại khỏi runtime active theo design.
- Docker Desktop: image `pcn_webapp-webapp:latest` digest `sha256:e1418ca3f15658a402a82f02252f003e114c9663ed275b6c410f3948cb9c6721`; container `pcn_webapp-webapp` đang `Up` trên cổng `2357`; health và `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.

## Cập nhật 2026-09-03 — Lưu Phương thức ĐGSPH theo biểu mẫu TT58

- Rà soát lại mẫu TT58 trong folder PGD cho thấy Chứng thư có mục **Phương thức ĐGSPH: Phương thức 7**. Đã bổ sung trường snapshot `assessmentMethod` riêng cho `PgdInspectionRequest`; mã nguồn được chuẩn hóa là `METHOD_7`, không dùng mã quy trình `TT58` để thay thế.
- Intake PGD tự chọn mặc định `Phương thức 7` khi dùng `TT58` và bắt buộc xác nhận tại giao diện; domain/server chỉ nhận mã trong catalog. Cell `assessmentMethod` được bind vào phiếu tiếp nhận, kế hoạch, biên bản lấy mẫu, báo cáo, quyết định và chứng thư; module sinh tài liệu hiển thị control lựa chọn và prefill từ snapshot hồ sơ.
- Bộ DOCX/manifest PGD đã tái sinh với placeholder mới; không bổ sung báo giá hoặc thanh toán. Không import dữ liệu lịch sử, không đọc Desktop/UNC lúc runtime; file nguồn PGD không bị sửa/xóa/copy.
- Verification: focused **31/31**, full `npm test` **672/672**, `npm run lint`, `npm run build`, `git diff --check` pass.
- Docker Desktop production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:a543c4111dcec3dc577e2e2624a13a159fce4a479e72dacb4ca8591f2c258bc3`; container `pcn_webapp-webapp-1` đang `Up` trên port `2357`; PostgreSQL connected/schema initialized/server running; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.

## Cập nhật 2026-09-03 — Hoàn thiện Quyết định PGD và deploy production

- Bổ sung template/cell `DECISION` cho PGD, mã `PGD-BM-09`, gồm số quyết định, ngày, căn cứ, nội dung phê duyệt/phát hành và người ký; template được phép dùng cho các mã phương thức PGD, bao gồm `QT-GĐ-14`.
- Bộ template PGD hiện có **9** loại; panel sinh tài liệu hiển thị “Quyết định PGD”. Các cell QT-GĐ-14 (`steelLotSize`, `steelSameGradeMultiProduct`, `steelManualSamplingPlanNote`) được prefill từ `request.productDetails` khi sinh tài liệu; các giá trị này tiếp tục được snapshot vào hồ sơ phát hành.
- Không bổ sung báo giá hoặc thanh toán vào PGD. Không import dữ liệu lịch sử, không đọc Desktop/UNC lúc runtime; file nguồn PGD không bị sửa/xóa/copy.
- Verification: `npm run build`, full `npm test` **672/672**, `npm run lint`, `git diff --check` pass. Không có script `typecheck` riêng; typecheck đã chạy qua lint/build.
- Docker Desktop production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:378eaa36076eb84bbd96b50aecce3ce5d925078d539e488f38cc97e8304196c9`; container `pcn_webapp-webapp-1` đang `Up` trên port `2357`; PostgreSQL connected/schema initialized/server running; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.

## Cập nhật 2026-09-03 — QT-GĐ-14 PGD: bảng lấy mẫu và template/cell

- Đã đọc read-only quy trình `QT-GĐ-14. Qtrinh rieng gd thep theo ttlt58 - icontrol.docx` trong folder PGD. Nguồn xác nhận phạm vi giám định chất lượng lô thép sản xuất trong nước/nhập khẩu theo TTLT 58/2015 và bảng cỡ lô `1–25`, `26–50`, `51–150`, `151–500`, `501–1200`, `1201–3200`.
- Catalog PGD có `QT-GĐ-14`; bảng nghiệp vụ trả về số mẫu ngoại quan/nhãn `2/3/3/5/5/8`, cơ lý/khối lượng `2/2/3/3/3/3`, hóa học/lớp phủ `1`, AQL `4` và `1.5`; cùng mác nhiều loại sản phẩm dùng cột B. Ngoài dải 1–3200 không tự ngoại suy và yêu cầu ghi căn cứ/kế hoạch thủ công.
- PYC, kế hoạch giám định và biên bản lấy mẫu có cell `steelLotSize`, `steelSameGradeMultiProduct`, `steelManualSamplingPlanNote`; bind từ `request.productDetails`, snapshot cùng tài liệu và xuất hiện trong DOCX/manifest. `QT-GĐ-14` là mã nghiệp vụ PGD, không phải `QC20`; QC20 chỉ ở PCN.
- Không bổ sung báo giá hoặc thanh toán vào PGD. Không import dữ liệu lịch sử, không đọc Desktop/UNC lúc runtime; file nguồn PGD không bị sửa/xóa/copy.
- Verification: focused PGD **25/25**, full `npm test` **672/672**, `npm run lint`, `npm run build`, `git diff --check` pass. Không có script `typecheck` riêng; typecheck đã chạy qua lint/build.
- Docker production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:4b5adb7cb5925ad72c3c7477d95f1659e4eb3bea96e664fe5a864f0cff9ee840`; container `pcn_webapp-webapp-1` mới `Up` trên port `2357`; PostgreSQL connected/schema initialized/server running; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` HTTP 200.

## Cập nhật 2026-09-03 — PGD không quản lý báo giá và thanh toán

- Phạm vi PGD mới chỉ lưu và xử lý thông tin nghiệp vụ từ sổ phòng: số đăng ký/ngày tiếp nhận, hợp đồng, hóa đơn, packing list, vận đơn, tờ khai hải quan, C/O, hồ sơ kỹ thuật, thiếu hồ sơ, hoàn trả và chuyển phát.
- Đã loại bỏ báo giá và thanh toán khỏi catalog chứng từ, intake, bảng Sổ đăng ký, card chi tiết, domain PGD, template DOCX và manifest; không ảnh hưởng các trường PCN cùng tên ở miền PCN.
- `PGD-BM-01` snapshot các cell đăng ký còn lại; template pack được tái sinh sau khi thu hẹp phạm vi.
- Kiểm chứng cuối: focused PGD **25/25**, full `npm test` **671/671**, `npm run lint`, `npm run build` và `git diff --check` đều pass.
- Docker production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:7245982be5b01b7987c8592fea84378dc234bc7803d5aaeaa8587f14a0292c0e`; container `pcn_webapp-webapp-1` `Up` trên port `2357`; health và ba route PGDCN đều HTTP 200, PostgreSQL connected/schema initialized.

## Cập nhật 2026-09-03 — Sổ đăng ký PGD theo nguồn phòng

- PYC PGD mới lưu `registryMetadata` gồm số đăng ký, ngày tiếp nhận và tham chiếu hợp đồng, invoice, packing list, vận đơn, tờ khai, C/O, hồ sơ kỹ thuật hoặc chứng từ khác; được validate và snapshot, không import sổ cũ.
- Bổ sung bảng `Sổ đăng ký PGD` có tìm kiếm theo chứng từ, lọc nhóm/trạng thái và mở card hồ sơ; projection chỉ đọc.
- `PGD-BM-01`/DOCX renderer bind thêm `registrationNumber`, `receivedAt`, `registryDocuments`; pack và manifest placeholder đã tái sinh đồng bộ.
- Verification: test liên quan **19/19**, full `npm test` **671/671**, lint/build/diff check pass.
- Docker image mới digest `sha256:530fd168072ec89174a4e30bb61b0ceb0aea4b86a1a008c1a75580508499c35d`; container `pcn_webapp-webapp-1` Up trên port 2357; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` HTTP 200; PostgreSQL connected/schema initialized.

## Cập nhật 2026-09-03 — Rà soát sâu nguồn PGD và dossier chứng từ/mẫu

- Đã đọc read-only bổ sung nhóm hồ sơ giám định thép, máy/dây chuyền, than; sổ đăng ký và bộ quy trình `QT-GĐ-02/03/04/05/06/07/08/09/10/12`, cùng tài liệu năng lực VICAS/VIAS/ISO và audit log. Không sửa, xóa, copy hoặc import file nguồn.
- Catalog PGD dùng mã quy trình có kiểm soát: thép/kim loại `QT-GĐ-02/03/04/06/10`, máy/dây chuyền `QT-GĐ-04/05/06/07/09/12`, than `QT-GĐ-02/03/04/08`; `QT-GĐ-14` để chờ xác nhận tên/phạm vi. Không dùng `QC20` trong PGD.
- `pgdDossierDocuments` đã có checklist theo hồ sơ nguồn: PYC, hợp đồng, invoice, packing list, vận đơn, tờ khai, C/O, hồ sơ kỹ thuật, kế hoạch, biên bản hiện trường/lấy mẫu, giao nhận PTN, KQTN, báo cáo, quyết định, chứng thư và lưu trữ. Nhóm thương mại được đánh dấu tùy chọn khi không phát sinh.
- UI/server cùng áp dụng khóa checklist theo 5 trạm; lỗi tải checklist hiển thị fallback và cảnh báo; sổ mẫu tách PTN/mẫu lưu; hủy mẫu lưu là mutation trạng thái có lý do sau hạn lưu, không hard-delete; file input reset sau lưu.
- Verification vòng này: 24/24 test dossier/sample/domain/API/UI pass, `npm run lint` pass.
- Review cuối APPROVED; full `npm test` **670/670**, `npm run lint`, `npm run build` và `git diff --check` đều pass.
- Docker production đã rebuild/recreate từ code cuối bằng `docker compose --env-file .env -f docker-compose.yml up -d --build webapp`. Image digest `sha256:5eb8b637b2ba8d8e0949641b1dcb8f240ad87a92b608628c0d4c5b073577485f`; container `pcn_webapp-webapp-1` đang `Up` trên port `2357`; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200; PostgreSQL connected/schema initialized.

## Cập nhật 2026-09-03 — Dashboard chung PGDCN Operations cockpit

- Dashboard `/pgdcn/` đã chuyển sang cockpit điều hành dùng chung cho PCN và PGD, giữ nguyên ranh giới dữ liệu/workspace riêng và lọc theo `departmentScopes` trước khi tính số liệu.
- Thứ tự giao diện: `Điều hành phòng`, 6 KPI, `Hàng đợi hành động` ưu tiên quá hạn, pipeline PCN/PGD tách biệt, mốc sắp tới tối đa 5 dòng và notification feed dùng chung.
- Header không còn `Trợ lý AI` hoặc `Nhật ký hoạt động`; CTA hiển thị theo quyền: PCN `Tạo Đề nghị`, PGD `Tiếp nhận PYC`. Hai route AI/activity vẫn ở sidebar dùng chung.
- Projection/UI đã thêm status tiếng Việt, bottleneck, pipeline segment/nhóm `Khác`, queue, milestone và điều hướng CTA về PCN `proposals` / PGD `intake`. Accent PCN emerald, PGD blue; responsive/compact contracts được giữ.
- Verification: focused dashboard **5/5**, full suite **657/657**, lint, production build và `git diff --check` đều đạt.
- Commit trên `master`: `5f9d90d`, `32a3c47`, `a3f4807`, `b289ec2`; đặc tả tại `docs/superpowers/specs/2026-09-03-pgdcn-shared-dashboard-redesign-design.md`.

### Docker Desktop production — image hiện hành

- Lệnh: `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d`.
- Image: `pcn_webapp-webapp:latest`, digest `sha256:8cd04de8b5e31b4f6e605a28ddb0a4147c7bb9c7e6bc42d504ec1e61cb40f0c5`.
- Container: `pcn_webapp-webapp`, trạng thái `Up`, publish `0.0.0.0:2357->2357/tcp`.
- Smoke: `/api/health`, `/pgdcn/`, `/pgdcn/pcn/`, `/pgdcn/pgd/` đều HTTP 200; log xác nhận PostgreSQL connected/schema initialized/server port 2357.
- Cảnh báo: automatic backup chưa chạy vì Supabase Storage chưa cấu hình trong env triển khai. Không thay đổi `.env` hoặc ghi secret/credential/dữ liệu hồ sơ thật vào note.

## Cập nhật điều hướng và Cài đặt hệ thống — 2026-09-02

- Shell `/pgdcn/` hiện tổ chức nhánh dùng chung gồm Tổng quan phòng, Khách hàng, Trợ lý AI, Nhật ký hoạt động và Cài đặt hệ thống; menu nghiệp vụ PCN/PGD không lặp Dashboard, Khách hàng hoặc Nhân sự.
- Cài đặt hệ thống có surface **Nhân sự & tài khoản**. Admin hoặc Quản lý (`LEADERSHIP`/`PGD_MANAGER`) gán trực tiếp phạm vi phòng (`departmentScopes`), chức vụ (`position`), role nghiệp vụ, phạm vi Lĩnh vực và trạng thái; nút reset mật khẩu không hiển thị mật khẩu. Không có danh mục phòng ban/chức vụ riêng.
- Sidebar dùng compact spacing `space-y-0.5`, `min-h-9`, `gap-2`, `px-2/px-2.5`; mobile vẫn giữ touch target.
- Verification: contract mới **9/9**, `npm test` **656/656**, lint/typecheck pass, build pass. Docker image mới digest `sha256:e119a53a3d63afac5f7942167bd8156b49dee20f78dbd0c4cad036dc7e5747e5`, container `pcn_webapp-webapp-1` Up trên port 2357; health và `/pgdcn*` đều 200.

## Cập nhật 2026-09-03 — Nút Cài đặt DOCX và bộ template PGD thật

- Header `Soạn thảo tài liệu PCN` và `Tạo tài liệu PGD` đã có nút `Cài đặt DOCX`. PCN điều hướng tới `Cài đặt PCN`; PGD điều hướng tới `Cài đặt PGD`.
- `Cài đặt hệ thống` chung không còn chứa cấu hình template DOCX. Mỗi phòng tự quản lý template, placeholder và luồng sinh tài liệu trong khu vực cài đặt của mình.
- PGD có 8 asset DOCX thật (`PGD-BM-01.docx` đến `PGD-BM-08.docx`) trong `templates/pgd/`, kèm `manifest.json` và `README.md`. Metadata của mỗi mẫu gồm tên file, danh sách placeholder và placeholder bắt buộc.
- Luồng sinh tài liệu đọc DOCX thật và thay `[[key]]` bằng Docxtemplater. Form nhập liệu được tạo từ `placeholderKeys`; không còn sinh DOCX layout giả với bảng `Cell/Giá trị`. Các template đã lưu từ trước vẫn được hydrate về metadata mới.
- `utils/pgdTemplatePack.ts` kiểm tra trực tiếp file nguồn, kích thước và độ khớp placeholder. Bootstrap/API trả `sourceInspection`; endpoint `GET /api/pgd/document-templates/:templateId/source` tải đúng DOCX trong folder PGD. Lưu template và generation đều chặn source thiếu hoặc metadata lệch.
- `Cài đặt PGD` hiển thị trạng thái source, byte size, placeholder, danh sách thiếu/thừa và nút `Tải DOCX nguồn`.
- Form `Tạo tài liệu PGD` đã dùng `PgdTableFieldEditor`: placeholder `TABLE` nhập theo dòng/cột, có nhãn nghiệp vụ, thêm/xóa dòng, kiểu input số/ngày/giờ và không còn JSON textarea.
- Các điểm chính trong code: `components/PcnDraftingWorkspaceView.tsx`, `components/PcnWorkspace.tsx`, `components/PgdDocumentGenerationPanel.tsx`, `components/PgdWorkspace.tsx`, `components/PgdcnSystemSettingsView.tsx`, `components/PgdcnAppShell.tsx`, `utils/pgdDocumentTemplates.ts`, `utils/pgdDocumentGeneration.ts`, `server.ts`.
- `design.md` đã được cập nhật tại §0.3, §0A.4 và §0A.6–0A.7 để phản ánh quyền sở hữu cài đặt theo phòng và hợp đồng DOCX/placeholder.

### Kiểm chứng và lưu ý

- 18/18 test PGD liên quan đạt, `npm run lint`, `next build` và `git diff --check` đều đạt.
- Full suite ghi nhận 1114 test, 1108 đạt và 6 lỗi thuộc các vùng lịch sử/ngoài phạm vi của task. Visual render DOCX chưa thực hiện được vì máy thiếu LibreOffice/`soffice`; kiểm tra cấu trúc OOXML, manifest, placeholder và generation đã đạt.

> Ghi chú lịch sử: các đoạn bên dưới mô tả giai đoạn cũ “Template & Cell PGD”. Runtime hiện dùng `Cài đặt PGD` và DOCX thật; cell chỉ còn vai trò metadata/validation cho form, không phải nguồn layout tài liệu.

---

## Nguồn biểu mẫu đã tham chiếu

Đã đọc thư mục `\\TVCI_NAS\\P. Giám định - Chứng nhận` ở chế độ chỉ đọc để hiểu hoạt động Phòng Giám định - Chứng nhận. Phần triển khai chỉ chuẩn hóa cấu trúc nghiệp vụ vào mã nguồn; không sao chép, sửa, xóa hoặc import file/hồ sơ lịch sử từ thư mục nguồn.

Nhóm biểu mẫu TT58 được dùng làm nguồn tham chiếu cho PGD: hồ sơ giám định, phiếu phân công, PYC phân tích, biên bản hiện trường/lấy mẫu và chứng thư. Nhóm QC20 vẫn là lĩnh vực PCN, không xuất hiện trong catalog PGD.

## Template PGD

Catalog hiện có 8 template:

1. PYC/tiếp nhận giám định.
2. Phiếu phân công.
3. Kế hoạch giám định.
4. Biên bản kiểm tra hiện trường.
5. Biên bản lấy mẫu.
6. Phiếu giao nhận/PYC PTN.
7. Báo cáo giám định.
8. Chứng thư giám định.

Template hỗ trợ nhóm sản phẩm thép/kim loại, máy móc/dây chuyền, than và lĩnh vực khác theo catalog PGD. Bản đã phát hành được snapshot theo version; không cập nhật đè làm thay đổi hồ sơ cũ.

## Module cell và sinh tài liệu

- Cell có key, nhãn, section, dòng/cột, kiểu dữ liệu, bắt buộc, đơn vị, binding và validation.
- Cell có trạng thái bật/tắt; cell `active=false` được giữ trong snapshot lineage nhưng không render trong tài liệu và không tạo required gate.
- Kiểu dữ liệu: `TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `TABLE`.
- Binding chỉ lấy dữ liệu PGD canonical hoặc giá trị người dùng nhập; không binding sang PCN/QC20 hay đường dẫn nguồn.
- Sinh DOCX/PDF dùng cùng context hash, snapshot template, snapshot hồ sơ liên quan, checksum và metadata `pgdDocuments`.
- API chính:
  - `GET /api/pgd/document-templates`
  - `PUT /api/pgd/document-templates/:templateId`
  - `GET /api/pgd/documents`
  - `POST /api/pgd/documents/generate`
  - `GET /api/pgd/documents/:documentId/download`
- UI: mục **Template & Cell PGD** tại `/pgdcn/pgd`; quản lý template/cell và chọn PYC để sinh tài liệu.
- Lịch sử tài liệu có thể tải lại file từ private Storage khi metadata có `fileAssetId`; nếu Storage chưa cấu hình, UI nêu rõ file chỉ tải được ở lần sinh trực tiếp.

PYC PGD đã nhận thêm dữ liệu lô/sản phẩm: mác/model, kích thước, tiêu chuẩn sản phẩm, xuất xứ, nhà sản xuất/nhập khẩu và chứng từ hải quan/thương mại.

## Ranh giới dữ liệu

- Domain PGD dùng collection/API/RBAC riêng.
- Không đọc UNC/Desktop lúc runtime.
- Không import hồ sơ lịch sử.
- QC20 không được đưa vào catalog PGD.
- Không thay đổi `.env` và không lưu secret, credential hoặc dữ liệu hồ sơ thật vào note.

## Cập nhật 2026-09-03 — Commit và rebuild production PGDCN

- Commit: `e7ebaa6` — `feat: complete PGDCN QC20 governance and PGD document workflow` trên nhánh `master`.
- Verification: `npm test` **678/678 pass**, `npm run lint` pass, `npm run build` pass, `git diff --cached --check` pass.
- Docker Desktop production đã chạy `docker compose -f docker-compose.pcn.yml up --build -d`; image `pcn_webapp-webapp:latest` digest `sha256:ccdd19d462bcc801b0990988f276fd3861b836fe1f184d20cb1cc7d4ad981e25`; container `pcn_webapp-webapp` `Up` trên port `2357`.
- Smoke sau deploy: `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.
- Full maintenance suite: **1140/1145 pass**; 5 lỗi là các contract historical attachment/source-discovery ngoài active runtime và bị loại khỏi runner theo design.
- Artifact/tài liệu nguồn không bị đưa vào commit: không commit `dist`, `.bak`, attachment, `tmp`, kế hoạch nội bộ; không sửa/xóa folder PGD/UNC nguồn.

## Verification

- `npm test`: **656/656 pass**.
- Test PGD template/cell/document: **10/10 pass**; toàn bộ nhóm PGD/PGDCN liên quan: **56/56 pass**.
- `npm run lint`: pass.
- `npm run build`: pass.
- `git diff --check`: không có lỗi whitespace; chỉ có cảnh báo line-ending LF/CRLF trên Windows.

## Docker Desktop production — image hiện hành

Lệnh đã chạy:

```powershell
docker compose --env-file .env -f docker-compose.yml up -d --build webapp
```

Kết quả:

- Image: `pcn_webapp-webapp:latest`
- Digest: `sha256:e119a53a3d63afac5f7942167bd8156b49dee20f78dbd0c4cad036dc7e5747e5`
- Container: `pcn_webapp-webapp-1`, trạng thái `Up`
- Port: `0.0.0.0:2357->2357/tcp`
- `GET http://localhost:2357/api/health`: HTTP 200
- `GET http://localhost:2357/`, `/pgdcn/`, `/pgdcn/pcn`, `/pgdcn/pgd`: HTTP 200
- Log: PostgreSQL connected và schema initialized thành công.

Cảnh báo: automatic backup chưa chạy vì Supabase Storage chưa được cấu hình trong env triển khai. File PGD vẫn sinh trực tiếp được; muốn lưu bền vững cần cấu hình Storage ngoài repository.

## Chốt hiện trạng

Phòng hiện được triển khai dưới tên **Phòng Giám định - Chứng nhận (PGDCN)** với hai miền PCN/PGD tách biệt. QC20 chỉ thuộc PCN. PGD sử dụng catalog template riêng lấy từ các biểu mẫu đã đọc read-only, có cell bật/tắt, snapshot/version, sinh tài liệu DOCX/PDF và lịch sử tải lại file private khi Storage được cấu hình.

Runtime không đọc UNC/Desktop, không import hồ sơ lịch sử và không sửa/xóa thư mục biểu mẫu nguồn. Trạng thái kiểm thử chốt: PCN **656/656**, PGD/PGDCN **56/56**, template/cell/document **10/10**, lint/build pass. Docker production đang chạy image `pcn_webapp-webapp:latest` digest `sha256:e119a53a3d63afac5f7942167bd8156b49dee20f78dbd0c4cad036dc7e5747e5` trên cổng `2357`, health/route PGD HTTP 200.
