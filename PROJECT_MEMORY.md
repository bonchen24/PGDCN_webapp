<!--
Author: Gemini
OS support: Web/Node
Description: Persistent project memory and verified deployment observations for TVCI PCN and legacy DDT
-->

# TVCI — Project Memory & Observations

## Cập nhật 2026-09-03 — Governance QC20 và review template PCN

- Đã hoàn thiện boundary quản trị QC20 trong PCN: `PcnSettings.qc20ScopeConfiguration` tách khỏi snapshot `CertificationProposal.qc20Scope`; mặc định vẫn `NEEDS_PCN_CONFIRMATION`, không tự suy diễn danh mục pháp lý/kỹ thuật từ hồ sơ nguồn.
- Admin PCN xác nhận qua `POST /api/pcn/settings/qc20-scope/confirm` với `scopeVersion`, nguồn đối chiếu, dạng sản phẩm, mác thép, mã HS, tiêu chuẩn áp dụng, profile thành phần hóa học và ghi chú. Server lưu actor/thời điểm/audit, idempotent khi gửi lại cùng cấu hình và không ghi đè snapshot hồ sơ cũ. `GET /api/pcn/settings/qc20-readiness` là projection read-only.
- Preflight phát hành QC20 nay bắt buộc đồng thời phạm vi/profile đã xác nhận và hai template `CERTIFICATE`/`DECISION` có asset private đúng fingerprint, MIME và provenance. UI Cài đặt PCN hiển thị preflight và các thao tác `Phê duyệt`, `Yêu cầu chỉnh sửa`, `Ngừng dùng`.
- Upload asset mới cho template đã duyệt tự chuyển về `NEEDS_ANNOTATION`, xóa actor/thời điểm duyệt cũ và audit đủ thay đổi; asset mới phải review lại trước khi dùng. Không sao chép/sửa/xóa/import file từ thư mục PGD/UNC.
- Verification lượt này: `npm test` (active PCN) **678/678**, focused governance/template **18/18**, `npm run lint`, `npm run build`, `git diff --check` pass. Full maintenance suite **1140/1145**; 5 lỗi còn lại thuộc contract historical attachment/source discovery nằm ngoài runtime active vì design cấm history/import.
- Docker Desktop production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:e1418ca3f15658a402a82f02252f003e114c9663ed275b6c410f3948cb9c6721`; container `pcn_webapp-webapp` `Up`, publish `0.0.0.0:2357->2357/tcp`; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.

## Cập nhật 2026-09-03 — Lưu Phương thức ĐGSPH theo biểu mẫu TT58

- Rà soát lại mẫu TT58 trong folder PGD cho thấy Chứng thư có mục **Phương thức ĐGSPH: Phương thức 7**. Đã bổ sung trường snapshot `assessmentMethod` riêng cho `PgdInspectionRequest`; mã nguồn được chuẩn hóa là `METHOD_7`, không dùng mã quy trình `TT58` để thay thế.
- Intake PGD tự chọn mặc định `Phương thức 7` khi dùng `TT58` và bắt buộc xác nhận tại giao diện; domain/server chỉ nhận mã trong catalog. Cell `assessmentMethod` được bind vào phiếu tiếp nhận, kế hoạch, biên bản lấy mẫu, báo cáo, quyết định và chứng thư; module sinh tài liệu hiển thị control lựa chọn và prefill từ snapshot hồ sơ.
- Bộ DOCX/manifest PGD đã tái sinh với placeholder mới; không bổ sung báo giá hoặc thanh toán. Không import dữ liệu lịch sử, không đọc Desktop/UNC lúc runtime; file nguồn PGD không bị sửa/xóa/copy.
- Kiểm chứng: focused **31/31**, full `npm test` **672/672**, `npm run lint`, `npm run build`, `git diff --check` pass.
- Docker Desktop production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:a543c4111dcec3dc577e2e2624a13a159fce4a479e72dacb4ca8591f2c258bc3`; container `pcn_webapp-webapp-1` đang `Up` trên port `2357`; log xác nhận PostgreSQL connected/schema initialized/server running; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.

## Cập nhật 2026-09-03 — Hoàn thiện Quyết định PGD và deploy production

- Bổ sung template/cell `DECISION` cho PGD, mã `PGD-BM-09`, gồm số quyết định, ngày, căn cứ, nội dung phê duyệt/phát hành và người ký; template được phép dùng cho các mã phương thức PGD, bao gồm `QT-GĐ-14`.
- Bộ template PGD hiện có **9** loại; panel sinh tài liệu hiển thị “Quyết định PGD”. Các cell QT-GĐ-14 (`steelLotSize`, `steelSameGradeMultiProduct`, `steelManualSamplingPlanNote`) được prefill từ `request.productDetails` khi sinh tài liệu; các giá trị này tiếp tục được snapshot vào hồ sơ phát hành.
- Không bổ sung báo giá hoặc thanh toán vào PGD. Không import dữ liệu lịch sử, không đọc Desktop/UNC lúc runtime; file nguồn PGD không bị sửa/xóa/copy.
- Kiểm chứng: `npm run build` pass sau thay đổi; full `npm test` **672/672**, `npm run lint`, `git diff --check` pass. Không có script `typecheck` riêng; typecheck đã chạy qua lint/build.
- Docker Desktop production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:378eaa36076eb84bbd96b50aecce3ce5d925078d539e488f38cc97e8304196c9`; container `pcn_webapp-webapp-1` đang `Up` trên port `2357`; log xác nhận PostgreSQL connected/schema initialized/server running; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.

## Cập nhật 2026-09-03 — QT-GĐ-14 PGD: bảng lấy mẫu và template/cell

- Đã đọc read-only quy trình `QT-GĐ-14. Qtrinh rieng gd thep theo ttlt58 - icontrol.docx` trong folder PGD. Nguồn xác nhận phạm vi giám định chất lượng lô thép sản xuất trong nước/nhập khẩu theo TTLT 58/2015 và bảng cỡ lô `1–25`, `26–50`, `51–150`, `151–500`, `501–1200`, `1201–3200`.
- Catalog PGD đã có phương thức `QT-GĐ-14`; bảng nghiệp vụ trả về số mẫu ngoại quan/nhãn `2/3/3/5/5/8`, cơ lý/khối lượng `2/2/3/3/3/3`, hóa học/lớp phủ `1`, AQL `4` và `1.5`; cùng mác nhiều loại sản phẩm dùng cột B. Ngoài dải 1–3200 không tự ngoại suy và yêu cầu ghi căn cứ/kế hoạch thủ công.
- PYC, kế hoạch giám định và biên bản lấy mẫu có các cell `steelLotSize`, `steelSameGradeMultiProduct`, `steelManualSamplingPlanNote`; các giá trị được bind từ `request.productDetails`, snapshot cùng tài liệu và xuất hiện trong DOCX/manifest. `QT-GĐ-14` vẫn là mã nghiệp vụ PGD, không phải `QC20`; QC20 chỉ ở PCN.
- Không bổ sung báo giá hoặc thanh toán vào PGD. Không import dữ liệu lịch sử, không đọc Desktop/UNC lúc runtime; file nguồn PGD không bị sửa/xóa/copy.
- Kiểm chứng sau cập nhật: focused PGD **25/25**, full `npm test` **672/672**, `npm run lint`, `npm run build`, `git diff --check` đều pass. Repo không có script `typecheck` riêng; typecheck đã chạy qua lint/build.
- Docker production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:4b5adb7cb5925ad72c3c7477d95f1659e4eb3bea96e664fe5a864f0cff9ee840`; container `pcn_webapp-webapp-1` tạo mới và `Up` trên port `2357`; log xác nhận PostgreSQL connected/schema initialized/server running; `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.

## Cập nhật 2026-09-03 — PGD không quản lý báo giá và thanh toán

- Phạm vi PGD mới chỉ lưu và xử lý thông tin nghiệp vụ từ sổ phòng: số đăng ký/ngày tiếp nhận, hợp đồng, hóa đơn, packing list, vận đơn, tờ khai hải quan, C/O, hồ sơ kỹ thuật, thiếu hồ sơ, hoàn trả và chuyển phát.
- Đã loại bỏ báo giá và thanh toán khỏi catalog chứng từ, intake, bảng Sổ đăng ký, card chi tiết, domain PGD, template DOCX và manifest; không ảnh hưởng các trường PCN cùng tên ở miền PCN.
- `PGD-BM-01` snapshot các cell đăng ký còn lại; template pack được tái sinh sau khi thu hẹp phạm vi.
- Kiểm chứng cuối: focused PGD **25/25**, full `npm test` **671/671**, `npm run lint`, `npm run build` và `git diff --check` đều pass.
- Docker production đã rebuild/recreate: image `pcn_webapp-webapp:latest` digest `sha256:7245982be5b01b7987c8592fea84378dc234bc7803d5aaeaa8587f14a0292c0e`; container `pcn_webapp-webapp-1` `Up` trên port `2357`; health và ba route PGDCN đều HTTP 200, PostgreSQL connected/schema initialized.

## Cập nhật 2026-09-03 — Sổ đăng ký PGD theo nguồn phòng

- Bổ sung `registryMetadata` cho PYC PGD mới: số đăng ký, ngày tiếp nhận và tham chiếu hợp đồng, hóa đơn, packing list, vận đơn, tờ khai, C/O, hồ sơ kỹ thuật hoặc chứng từ khác. Metadata được validate/normalize ở domain và snapshot cùng hồ sơ; không phải import sổ lịch sử.
- Màn hình `Hồ sơ đang xử lý` nay là bảng `Sổ đăng ký PGD` có tìm kiếm theo chứng từ, lọc nhóm sản phẩm/trạng thái và mở đúng card hồ sơ; không cho sửa trực tiếp trên projection.
- Template `PGD-BM-01` và renderer DOCX đã bind thêm `registrationNumber`, `receivedAt`, `registryDocuments`; pack `templates/pgd` được tái sinh và manifest/placeholder đã khớp.
- Verification sau mở rộng: test liên quan **19/19**, full `npm test` **671/671**, `npm run lint`, `npm run build`, `git diff --check` đều pass.
- Docker production đã rebuild/recreate bằng `docker compose --env-file .env -f docker-compose.yml up -d --build webapp`. Image hiện hành digest `sha256:530fd168072ec89174a4e30bb61b0ceb0aea4b86a1a008c1a75580508499c35d`; `pcn_webapp-webapp-1` đang `Up`, publish `0.0.0.0:2357->2357/tcp`. Smoke `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200; log xác nhận PostgreSQL connected/schema initialized.

## Cập nhật 2026-09-03 — Rà soát sâu nguồn PGD và hoàn thiện hồ sơ chứng từ/mẫu

- Rà soát read-only bổ sung cho folder PGD xác nhận ngoài bộ TT58 còn có nhóm hồ sơ giám định thép, máy/dây chuyền, than; sổ đăng ký thép/máy/giám định ngoài; bộ quy trình `QT-GĐ-02`, `03`, `04`, `05`, `06`, `07`, `08`, `09`, `10`, `12`; cùng tài liệu năng lực/đánh giá VICAS, VIAS, ISO và audit log ngày công. Đây chỉ là nguồn tham chiếu nghiệp vụ, không sửa/xóa/copy/import vào app.
- Catalog PGD đã bổ sung lựa chọn mã quy trình có kiểm soát theo nhóm: thép/kim loại (`QT-GĐ-02/03/04/06/10`), máy/dây chuyền (`QT-GĐ-04/05/06/07/09/12`) và than (`QT-GĐ-02/03/04/08`). Mã phương thức không còn là ô nhập tự do; `QT-GĐ-14` chưa gán vì nguồn chưa xác nhận tên/phạm vi. `QC20` vẫn chỉ thuộc PCN.
- PGD dossier dùng collection riêng `pgdDossierDocuments`, checklist hiện bao phủ PYC, hợp đồng, hóa đơn, packing list, vận đơn, tờ khai, C/O, hồ sơ kỹ thuật, kế hoạch, hiện trường/lấy mẫu, giao nhận PTN, KQTN, báo cáo, quyết định, chứng thư và lưu trữ. Chứng từ thương mại có cờ tùy chọn theo điều kiện hồ sơ.
- Dossier evidence và sổ mẫu đã được khóa theo đúng trạm nghiệp vụ ở cả UI/server; lỗi tải checklist không làm mất danh sách thiếu; file input được reset sau lưu; hủy mẫu lưu chỉ ghi trạng thái + actor/thời điểm/lý do sau hạn lưu, không xóa dòng.
- Kiểm chứng sau vòng review: 24/24 test domain/API/UI dossier-sample pass, full `npm test` 670/670 pass, `npm run lint`, `npm run build` và `git diff --check` pass. Review cuối APPROVED.
- Docker production đã rebuild/recreate bằng `docker compose --env-file .env -f docker-compose.yml up -d --build webapp`. Image `pcn_webapp-webapp:latest` digest `sha256:5eb8b637b2ba8d8e0949641b1dcb8f240ad87a92b608628c0d4c5b073577485f`; container `pcn_webapp-webapp-1` đang `Up`, publish `0.0.0.0:2357->2357/tcp`. Smoke `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200; log xác nhận PostgreSQL connected/schema initialized.

## Chốt hiện trạng 2026-09-03 — Dashboard chung PGDCN Operations cockpit

- Dashboard dùng chung `/pgdcn/` đã được thiết kế lại theo mô hình Operations cockpit cho cả PCN — Chứng nhận và PGD — nhưng vẫn giữ collection, lifecycle, status và workspace riêng của từng miền.
- Bố cục mới: command header `Điều hành phòng` → 6 KPI hiện hành → `Hàng đợi hành động` ưu tiên quá hạn → `Pipeline theo miền` → `Mốc sắp tới` tối đa 5 dòng → `Thông báo phòng` dùng chung.
- Header/vùng action chính chỉ còn CTA theo scope: PCN `Tạo Đề nghị`, PGD `Tiếp nhận PYC`; đã bỏ nút `Trợ lý AI` và `Nhật ký hoạt động` khỏi dashboard/header, sidebar vẫn giữ hai route này.
- Projection `utils/pgdcnDashboard.ts` đã thêm status label tiếng Việt, bottleneck theo ưu tiên miền, pipeline segment có nhóm `Khác`, queue quá hạn/cần xử lý, milestone sort/cap và lọc `departmentScopes` trước toàn bộ phép đếm.
- UI `components/PgdcnDashboardView.tsx` giữ test id KPI/notifications, tách accent PCN emerald và PGD blue, hỗ trợ responsive 2/4/6 cột, `ddt-compact`, `pcn-page-surface`, `mobile-safe-bottom`, `mobile-touch-target`, `min-w-0`; shell điều hướng CTA về PCN `proposals` và PGD `intake`.
- Regression tests: focused dashboard **5/5 pass**; full suite **657/657 pass**; `npm run lint` pass; `npm run build` pass; `git diff --check` pass.
- Các commit feature trên `master`: `5f9d90d` projection, `32a3c47` cockpit UI, `a3f4807` shell CTA wiring, `b289ec2` compact density; spec đã lưu tại `docs/superpowers/specs/2026-09-03-pgdcn-shared-dashboard-redesign-design.md`.
- Docker Desktop production đã build/recreate bằng `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d`. Image `pcn_webapp-webapp:latest` digest `sha256:8cd04de8b5e31b4f6e605a28ddb0a4147c7bb9c7e6bc42d504ec1e61cb40f0c5`; container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`.
- Smoke test production: `/api/health`, `/pgdcn/`, `/pgdcn/pcn/`, `/pgdcn/pgd/` đều HTTP 200; log xác nhận PostgreSQL connected, schema initialized và server chạy port `2357`.
- Automatic backup hiện cảnh báo không chạy vì Supabase Storage chưa được cấu hình; không thay đổi `.env`, không ghi secret/credential/dữ liệu hồ sơ thật vào Memory/Obsidian.

## Chốt hiện trạng 2026-09-03 — Dashboard gọn và notifications chung PGDCN

- Dashboard PGDCN đã chuyển sang bố cục gọn, responsive nhiều cột hơn và có thêm các card KPI vận hành; card **KPI người dùng** được giữ như một điểm nhìn chính.
- Bổ sung card **Thông báo phòng** ngay trên Dashboard và chuông notification trong header dùng chung cho cả PCN và PGD; không tách thành hai phòng/luồng riêng.
- Feed dùng chung collection `notifications` trong `app_documents`, chuẩn hóa notification PCN legacy về `domain=PCN` và notification mới của PGD về `domain=PGD`; hiển thị tối đa 50 bản ghi mới nhất, có badge miền và trạng thái chưa đọc.
- PGD phát notification ở các mốc nghiệp vụ lớn: tiếp nhận request, đổi trạng thái, phân công, hiện trường, mẫu, yêu cầu PTN, KQTN, báo cáo, chứng thư và duyệt; các chỉnh sửa nhỏ/import/restore/template không phát notification.
- API dùng chung: `GET /api/pgdcn/notifications`, đánh dấu một notification đã đọc, đọc tất cả và xóa feed; server lọc theo `departmentScopes`, audience và target username; viewer chỉ đọc.
- Mở chuông hoặc card sẽ refresh feed; chọn notification sẽ đánh dấu đã đọc từ Dashboard (nếu chưa đọc) và điều hướng về đúng bề mặt PCN/PGD.
- Đã thêm spec/plan và regression tests cho projection, API, event emission, UI dropdown, shell refresh và Dashboard card. Verification chốt: `npm test` **657/657 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` pass.
- Docker Desktop production đã build/recreate thành công bằng `docker compose --env-file .env -f docker-compose.yml up -d --build webapp`; image `pcn_webapp-webapp:latest` digest `sha256:51dad484894f48efbf417ee99b619135c3901fd36d6eb1a8303bd1731712f1b7`, container `pcn_webapp-webapp-1` đang `Up` trên cổng `2357`.
- Smoke test production: `/api/health`, `/pgdcn/`, `/pgdcn/pcn/` và `/pgdcn/pgd/` đều trả HTTP 200 sau redirect; startup log xác nhận PostgreSQL connected và schema initialized.
- Không thay đổi `.env`, không ghi secret/credential, không đưa attachment, file tạm hoặc bundle `dist` sinh tự động vào commit.

## Chốt hiện trạng 2026-09-03 — Cài đặt DOCX PCN/PGD và bộ template thật

- Header `Soạn thảo tài liệu PCN` và `Tạo tài liệu PGD` đã có nút `Cài đặt DOCX`; nút PCN mở `Cài đặt PCN`, nút PGD mở `Cài đặt PGD`.
- `Cài đặt hệ thống` dùng chung chỉ còn phạm vi Nhân sự & tài khoản. Cấu hình template DOCX, placeholder và sinh tài liệu thuộc từng phòng tương ứng.
- PGD quản lý 8 biểu mẫu DOCX thật (`PGD-BM-01` đến `PGD-BM-08`) cùng `fileName`, `placeholderKeys`, `requiredPlaceholderKeys`; form nhập liệu được suy ra từ metadata placeholder.
- `utils/pgdDocumentGeneration.ts` đọc DOCX đóng gói trong `templates/pgd/*.docx` và render bằng Docxtemplater với delimiter `[[key]]`. Bảng DOCX giả kiểu `Cell/Giá trị` đã được loại khỏi luồng sinh tài liệu; hydration vẫn tương thích các bản ghi template cũ đã lưu.
- `utils/pgdTemplatePack.ts` kiểm tra trực tiếp file nguồn, kích thước và độ khớp placeholder; server trả `sourceInspection` cho bootstrap/API, còn `GET /api/pgd/document-templates/:templateId/source` cho phép tải đúng DOCX trong folder PGD. PUT và generation đều chặn source thiếu hoặc metadata lệch.
- `Cài đặt PGD` hiển thị trạng thái file nguồn, byte size, danh sách placeholder, chênh lệch thiếu/thừa và nút `Tải DOCX nguồn`.
- Form `Tạo tài liệu PGD` đã dùng `PgdTableFieldEditor`: các placeholder `TABLE` nhập theo dòng/cột, có nhãn nghiệp vụ, thêm/xóa dòng, kiểu input số/ngày/giờ và không còn JSON textarea.
- Bộ asset gồm `templates/pgd/*.docx`, `templates/pgd/manifest.json`, `templates/pgd/README.md`; script tạo asset là `scripts/generate-pgd-docx-templates.ts`. `design.md` đã cập nhật các mục §0.3, §0A.4 và §0A.6–0A.7.
- Kiểm chứng hiện tại: 18/18 test PGD liên quan đạt; `npm run lint` đạt; `next build` đạt; `git diff --check` đạt. Full suite có 1114 test, 1108 đạt và 6 lỗi lịch sử/ngoài phạm vi ở root App Router và attachment/source discovery/manual mapping.
- Chưa render visual DOCX vì môi trường thiếu LibreOffice/`soffice`; các kiểm tra OOXML, manifest, placeholder và generation structure đã đạt.
- Typecheck độc lập hiện đạt qua `npm run lint`.
- Không ghi `.env`, secret, credential, đường dẫn UNC/Desktop hay dữ liệu hồ sơ thật.

## Chốt hiện trạng 2026-09-02 — Điều hướng chung PGDCN và Cài đặt hệ thống

- Shell `/pgdcn/` đã đưa **Tổng quan phòng**, **Khách hàng**, **Trợ lý AI**, **Nhật ký hoạt động** và **Cài đặt hệ thống** vào nhánh dùng chung; Dashboard/Khách hàng/Nhân sự không còn lặp trong menu chi tiết PCN/PGD.
- PCN chỉ còn các lối vào nghiệp vụ Đề nghị, Sổ điều hành, PYC & luân chuyển mẫu và Soạn thảo tài liệu; PGD chỉ còn Tiếp nhận PYC, Hồ sơ đang xử lý, Hiện trường & Lấy mẫu, PTN & Bàn giao mẫu, Báo cáo & Chứng thư và Template & Cell PGD. QC20 vẫn chỉ thuộc PCN.
- `Cài đặt hệ thống → Nhân sự & tài khoản` dùng danh sách tài khoản PGDCN hợp nhất. Admin hoặc Quản lý (`LEADERSHIP`/`PGD_MANAGER`) được gán trực tiếp `departmentScopes`, `position`, role nghiệp vụ, phạm vi Lĩnh vực, trạng thái và reset mật khẩu; không có màn hình/collection danh mục phòng ban hoặc chức vụ riêng. Password không trả về client.
- Sidebar PGDCN đã giảm nhịp layout xuống `space-y-0.5`, item `min-h-9`, `gap-2`, padding compact; mobile vẫn giữ `mobile-touch-target`.
- Verification sau thay đổi: contract mới **9/9 pass**, `npm test` **656/656 pass**, `npm run lint` (tsc noEmit) pass, `npm run build` pass. Docker image `pcn_webapp-webapp:latest` digest `sha256:e119a53a3d63afac5f7942167bd8156b49dee20f78dbd0c4cad036dc7e5747e5`; container `pcn_webapp-webapp-1` đang `Up`, publish `0.0.0.0:2357->2357/tcp`; `/api/health`, `/pgdcn/`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200.
- Không đọc/sửa/xóa thư mục `\\TVCI_NAS\\P. Giám định - Chứng nhận`, không import hồ sơ lịch sử, không đọc UNC/Desktop lúc runtime. Chưa thay đổi `.env` và không ghi secret/credential/dữ liệu hồ sơ thật vào Memory/Obsidian.

## Chốt hiện trạng 2026-09-02 — Phòng Giám định - Chứng nhận (PGDCN)

- PGDCN hiện có hai miền tách biệt: PCN — Chứng nhận và PGD — Giám định; dùng chung session/tài khoản/khách hàng theo quyền nhưng tách collection, API, RBAC, catalog và lifecycle.
- QC20 (`QCVN 20:2019/BKHCN` + Sửa đổi 1:2021, Phương thức 7) chỉ thuộc PCN; không xuất hiện trong catalog PGD.
- PGD đã có luồng hồ sơ mới từ tiếp nhận/năng lực → phân công → hiện trường/lấy mẫu → PTN/KQ → báo cáo/chứng thư → duyệt/ký/trả/lưu trữ; không bao gồm quản lý báo giá hoặc thanh toán.
- PGD đã chuẩn hóa 8 template từ biểu mẫu phòng đọc read-only, có quản lý cell bật/tắt, typed validation, snapshot/version, sinh DOCX/PDF, context hash/checksum và tải lại file private khi Storage có cấu hình.
- Nguồn `\\TVCI_NAS\\P. Giám định - Chứng nhận` chỉ là nguồn tham chiếu lúc phát triển; runtime không đọc UNC/Desktop, không import hồ sơ lịch sử và không sửa/xóa file nguồn.
- Verification chốt: PCN **656/656**, nhóm PGD/PGDCN **56/56**, nhóm template/cell/document **10/10**, lint/build pass. Docker `pcn_webapp-webapp-1` đang `Up` trên cổng `2357`, image digest hiện hành `sha256:e119a53a3d63afac5f7942167bd8156b49dee20f78dbd0c4cad036dc7e5747e5`, health và route PGD trả HTTP 200.
- Lưu ý vận hành: automatic backup chưa chạy vì Supabase Storage chưa được cấu hình ngoài repository; không ghi secret, credential hay dữ liệu hồ sơ thật vào Memory/Obsidian.

## Cập nhật 2026-09-02 — Xây dựng PGD template/cell và triển khai Docker production

- Đã đọc ở chế độ chỉ đọc thư mục `\\TVCI_NAS\\P. Giám định - Chứng nhận`, tập trung vào các biểu mẫu trong `Giám định\\Mẫu biên bản`. Đã rút trích khung nghiệp vụ từ bộ biểu mẫu PGD, đặc biệt nhóm TT58: hồ sơ giám định, phân công, PYC phân tích, biên bản hiện trường/lấy mẫu và chứng thư; không sửa, xóa hoặc import hồ sơ lịch sử.
- Catalog PGD trong app có 8 template: PYC/tiếp nhận, phân công, kế hoạch, biên bản hiện trường, lấy mẫu, giao nhận/PYC PTN, báo cáo giám định và chứng thư giám định. QC20 và các biểu mẫu QC20 được giữ trong PCN, không đưa vào catalog PGD.
- Đã bổ sung module quản lý cell PGD với key/nhãn/vị trí/kiểu dữ liệu/bắt buộc/đơn vị/binding/validation; hỗ trợ TEXT, NUMBER, DATE, BOOLEAN và TABLE. Cell value được kiểm tra theo schema, còn template đã phát hành được snapshot/version hóa, không sửa tại chỗ.
- Audit bổ sung đã hoàn thiện trạng thái bật/tắt cell: `active=false` giữ trong snapshot lineage nhưng không render và không tạo required gate; lịch sử tài liệu có asset private có nút tải lại qua endpoint PGD riêng.
- Đã bổ sung sinh DOCX/PDF qua API PGD, context hash, checksum, source snapshots và metadata `pgdDocuments`. Khi Storage PGD được cấu hình, file được lưu private qua `file_assets`; hiện môi trường chưa cấu hình Storage nên API vẫn trả file trực tiếp, không coi response là lưu trữ lâu dài.
- UI có mục **Template & Cell PGD** trong `/pgdcn/pgd`; PYC PGD nhận thêm mác/model, kích thước, tiêu chuẩn sản phẩm, xuất xứ, nhà sản xuất/nhập khẩu và chứng từ hải quan.
- Ranh giới an toàn: module PGD không đọc UNC/Desktop lúc runtime, không có historical import, không dùng collection PCN/QC20 và không tích hợp thư mục nguồn vào app.
- Verification: `npm test` **656/656 pass**, test riêng PGD template/cell/document **10/10 pass**; toàn bộ nhóm PGD/PGDCN liên quan **56/56 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` không có lỗi whitespace.
- Docker Desktop production: sau audit active-cell/download đã chạy lại `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d` thành công. Image `pcn_webapp-webapp:latest`, digest `sha256:2ae5e85c5c62169a1c295877b527cf76a6d8b09a63ef26f94aa2156e33c953a0`; container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`; `/api/health` và `/` đều HTTP 200; log xác nhận PostgreSQL connected/schema initialized.
- Cảnh báo vận hành hiện tại: automatic backup không chạy vì Supabase Storage chưa được cấu hình trong env triển khai. Không thay đổi `.env`, không ghi secret/credential hoặc dữ liệu hồ sơ thật vào Memory/Obsidian.

## Cập nhật 2026-09-02 — Kiểm tra ảnh và sửa lần hai responsive mobile PCN

- Ảnh thực tế xác nhận lần sửa scroll trước chưa đủ: `DossierWorkflowSummary` (bản đồ bước + tóm tắt bước) vẫn nằm trước `main`, chiếm gần hết viewport và bị `overflow-hidden` của focused shell cắt; vì vậy checklist/vùng bổ sung phía dưới không thể tiếp cận bằng cuộn. Ảnh dashboard đồng thời cho thấy card hồ sơ có nguy cơ tràn mép phải bởi nội dung mã dài/status badge.
- Đã đưa workflow summary vào trong body `pcn-dossier-focus-scroll` để bản đồ bước, checklist và toàn bộ vùng hồ sơ cuộn cùng một surface; header nhận diện, bộ chọn vùng và footer vẫn ngoài vùng nội dung. Card pipeline thêm `min-w-0 w-full overflow-hidden`, mã hồ sơ `break-all`, status badge `max-w/truncate`, và các wrapper dashboard `min-w-0/w-full`.
- `design.md` đã ghi rõ quy tắc này: trên mobile chỉ giữ chrome cần thiết trong viewport; nội dung workflow nằm trong scroll body và card dashboard không được cắt ngang.
- Verification: `npm run test:pcn` **635/635 pass**, `npx tsc --noEmit -p tsconfig.json` pass, `npm run lint` pass, `npm run build` pass, `git diff --check` pass.
- Docker Desktop production đã rebuild/recreate thành công; image `pcn_webapp-webapp:latest` có image ID/digest `sha256:3ae998a85680f803e12f09f66624fa5686b2b9ccaa51a6a36cdd83e45dd89819`. Container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`; `/api/health` và `/` đều trả HTTP 200; startup log xác nhận PostgreSQL connected/schema initialized.

## Cập nhật 2026-09-02 — Sửa scroll mobile cho workspace hồ sơ PCN

- Workspace hồ sơ toàn màn hình đã có scroll dọc độc lập cho vùng nội dung trên mobile: shell dùng chiều cao `100dvh` và `min-h-0`; content flex child dùng `h-0 min-h-0 flex-1` cùng class `pcn-dossier-focus-scroll` (`overflow-y: auto`, `touch-action: pan-y`, `-webkit-overflow-scrolling: touch`). Header, bản đồ workflow, bộ chọn vùng và footer giữ nguyên trong viewport; checklist/lịch sử phiên/nút bổ sung file đều có thể quan sát bằng cuộn cảm ứng.
- Bổ sung regression contract trong `test/pcn-mobile-scroll.test.ts` và cập nhật UI contract để nhận diện boundary cuộn riêng của dossier focus shell.
- Verification: `npm run test:pcn` **633/633 pass**, `npx tsc --noEmit -p tsconfig.json` pass, `npm run lint` pass, `npm run build` pass, `git diff --check` pass.
- Docker Desktop production đã rebuild; image `pcn_webapp-webapp:latest` có image ID/digest `sha256:e1c171891f2797d19777c057fd28ac626f10880fbf1a06fa3eedb2022d235064`. Container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`; `/api/health` và `/` đều trả HTTP 200; log xác nhận PostgreSQL connected/schema initialized.

## Cập nhật 2026-09-02 — Trợ lý AI hỗ trợ kiểm duyệt hồ sơ PCN

- Trợ lý nằm độc lập trên sidebar với nhãn **Trợ lý phê duyệt**, nhưng chỉ là công cụ hỗ trợ phán đoán/kiểm duyệt; không có nút/API phê duyệt, không đổi trạng thái hồ sơ, không khóa hồ sơ, không gọi approval/issuance và không ghi activity/audit.
- Người dùng chọn lĩnh vực QC4/QC9, chọn đúng một hồ sơ đang ở `TECHNICAL_REVIEW` hoặc `WAITING_APPROVAL`, rồi xác nhận để bắt đầu phiên review. Kết quả được stream tuần tự theo 11 tiêu chí: entry gate, completeness, identity, commercial, field evaluation, PYC/sample, lab results, technical assessment, certificate decision, document quality và system logic.
- Rule engine kiểm tra cả thiếu tài liệu, metadata, tiêu chuẩn mâu thuẫn, chuỗi PYC/mẫu, backlink KQTN, kết quả FAIL mới nhất, lỗi typography/chính tả cơ bản và độ tin cậy OCR. Mỗi finding giữ evidence trỏ về asset, file, trang, bbox/tab để người dùng mở lại hồ sơ canonical và tự kiểm tra.
- PaddleOCR là OCR chính qua `OCR_SERVICE_URL`, xử lý PDF theo từng trang và ảnh theo từng asset; không áp giới hạn tổng dung lượng 25MB, file lớn được đọc theo trang/chunk. Nếu PaddleOCR không khả dụng, trả rỗng hoặc confidence thấp thì dừng phiên; Gemini chỉ được dùng bổ sung cho semantic review và không làm OCR fallback.
- Kết quả chỉ lưu tạm trong memory 15 phút; export DOCX/PDF là artifact hỗ trợ, không ghi thành `file_asset`. Không đưa Desktop/research source path, raw OCR, raw prompt, secret, credential hoặc dữ liệu hồ sơ thật vào Memory/Obsidian.
- Verification code: `npm test` **630/630 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` pass trước khi đóng gói production.
- Commit local: `57d07c6` (`feat(pcn): add approval review assistant`). Các thay đổi ngoài phạm vi trợ lý vẫn để nguyên chưa commit.
- Docker Desktop production đã build/recreate bằng `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d`; image `pcn_webapp-webapp:latest` digest `sha256:42bda0d9fcd350dfac750f925e06132d29bfcceab6f1fdbbaf45310d05cc7da6`.
- Container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`; `/api/health` trả HTTP 200 `{"status":"ok"}` và `/` trả HTTP 200. Log xác nhận PostgreSQL connected/schema initialized.
- Log startup có cảnh báo automatic backup không chạy do Supabase Storage chưa được cấu hình trong env triển khai; đây là cảnh báo vận hành riêng, không làm app health fail. Cần bổ sung Storage URL/bucket/service-role key ở env ngoài repository nếu muốn backup tự động hoạt động.

## Cập nhật 2026-09-02 — Hoàn thiện hồ sơ theo từng bước và triển khai Docker production

- Đã chuyển workflow PCN từ cách hiểu “bước là card lọc theo trạng thái” thành vùng thao tác trong chi tiết từng hồ sơ. Hồ sơ đi qua đúng 5 bước: (1) Tiếp nhận & đầu vào, (2) Lấy mẫu & gửi PTN, (3) KQTN & đánh giá, (4) Hoàn thiện & soát xét trước duyệt, (5) Phê duyệt — Lãnh đạo thực hiện. Sau bước 5 là lifecycle riêng: cấp số, phát hành, giao khách hàng, lưu trữ; không tạo bước 6.
- Mỗi bước hỗ trợ checklist bắt buộc/tùy chọn, nhập/chỉnh sửa dữ liệu, tải phiên tài liệu mới, xem phiên hiện tại/lịch sử/tiến độ và nút “Hoàn tất bước và chuyển bước”. Bước sau bị khóa cho đến khi gate của bước trước đạt; bước trước được sửa trước khi duyệt theo quyền owner.
- Owner hồ sơ chịu trách nhiệm hoàn thiện bước 1–4; các tác vụ chuyên môn tiếp tục qua kiểm tra vai trò. Approval chain hiệu lực chỉ còn một quyết định Lãnh đạo. Waiver bắt buộc có lý do, người quyết định và thời điểm do server đóng dấu; waiver không xóa requirement hoặc lịch sử file.
- Bản dự thảo GCN/QĐ bắt buộc có trước khi trình bước 5. Từ chối duyệt đưa hồ sơ về bước 4 và giữ lý do/audit. Thay đổi tài liệu hoặc dữ liệu bước trước sẽ mở lại các bước sau để rà soát và đưa approval/bộ phát hành về trạng thái cần trình lại.
- Sau duyệt/phát hành, bước trước bị khóa. Boundary thu hồi riêng (`POST /api/pcn/issuance/:issuanceId/withdraw`) yêu cầu actor được phân quyền, lý do, người thực hiện và thời điểm; thu hồi giữ nguyên bản chính/số phát hành và mở lại bước 4.
- Tương thích dữ liệu cũ được giữ: `TECHNICAL_REVIEW` ánh xạ bước 4; `WAITING_APPROVAL`, `APPROVED`, `ISSUED`, `DELIVERED`, `ARCHIVED` ánh xạ bước 5. Approval chain cũ chỉ đọc làm lịch sử; hồ sơ cũ chờ duyệt dùng quyết định Lãnh đạo hiệu lực mới.
- Khi mở hồ sơ từ dashboard, hàng đợi hoặc sổ nghiệp vụ, Workspace truyền ngữ cảnh vùng thao tác nếu có; nếu không có thì chi tiết hồ sơ tự mở đúng vùng của compact step hiện tại và tự đồng bộ lại khi trạng thái đổi bước. Nút chuẩn bị bộ GCN/QĐ chỉ xuất hiện tại bước 4; không còn ép mọi hồ sơ mở vào vùng Tài liệu.
- Workspace hồ sơ hiện mở toàn màn hình để tập trung vào đúng một hồ sơ. Ngay dưới sơ đồ bước có nút **Bổ sung tài liệu**; nút mở checklist, tự cuộn tới yêu cầu có thể bổ sung đầu tiên. Từng yêu cầu hiển thị hành động rõ theo trạng thái: **Bổ sung file**, **Thay phiên bản** hoặc **Chưa đến bước hiện tại**; phiên cũ vẫn nằm trong lịch sử.
- Các vùng chuẩn đã cập nhật gồm `design.md`, stage map/gate, approval, waiver, dossier API/server, issuance/withdrawal, UI chi tiết hồ sơ và UI phê duyệt. Không thay đổi `.env`, không ghi secret, credential hoặc dữ liệu hồ sơ thật vào Memory/Obsidian.
- Verification: `npm run test:pcn` **618/618 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` pass.
- Docker Desktop production: chạy `docker compose --env-file .env -f docker-compose.pcn.yml up --build -d`; image `pcn_webapp-webapp:latest` digest `sha256:d40bec2edbaf8d6b30be8cc12f32da21adbe1ae12aa312121f45749b3760a513`.
- Kết quả triển khai đã xác minh: container `pcn_webapp-webapp` ở trạng thái `Up`, publish `0.0.0.0:2357->2357/tcp`; `GET http://localhost:2357/api/health` trả HTTP 200 `{"status":"ok"}`; trang `/` trả HTTP 200; log xác nhận kết nối và khởi tạo PostgreSQL thành công.

## Cập nhật 2026-09-01 — Hoàn thiện UI/UX PCN: scrollbar, modal và dropdown

- Phạm vi đợt này chỉ là UI/UX PCN; `design.md` §5.3 đã được cập nhật làm chuẩn cho scroll độc lập, scrollbar token/gutter, modal responsive và quy tắc dropdown catalog. Không thay đổi schema, API, payload hay logic nghiệp vụ.
- Shell PCN giữ một scroll dọc cấp trang tại `PcnWorkspace` `main`; các bảng/workflow rộng mới có scroll ngang riêng. Scrollbar dùng token chung và `scrollbar-gutter: stable` để hạn chế layout nhảy.
- Các modal PCN được rà soát theo contract `min-h-0`/`max-h` theo viewport, header/footer `shrink-0`, body `mobile-scroll-y`. Đã sửa rõ nhánh read-only của `PcnApprovalModal` và form `PcnSignerDelegationPanel`; vùng nội dung vẫn cuộn độc lập trên viewport thấp/mobile.
- Thay datalist khách hàng bằng `components/PcnCatalogCombobox.tsx`: tìm theo mã/tên/thông tin liên quan, hỗ trợ ARIA, Escape/Arrow/Enter, xóa lựa chọn và popup có scrollbar. Giá trị legacy ngoài catalog không bị mất mà được gắn trạng thái cần rà soát.
- Trường phòng thử nghiệm trong `PcnLabRequestView` dùng native `<select>` theo `PCN_SAMPLE_LAB_OPTIONS`, có placeholder và giữ giá trị cũ chưa được cấu hình. Các trường catalog hữu hạn tiếp tục dùng native select; không còn `datalist` trong UI PCN.
- Contract test UI mới: `test/pcn-ui-contract.test.ts` **26/26 pass**. Regression PCN **599/599 pass**, `npm run lint`, `npm run build` và `git diff --check` đều pass. Browser smoke test tại `127.0.0.1:1357` xác nhận màn hình đăng nhập không tạo overflow toàn trang; chưa kiểm tra sâu sau đăng nhập vì không có credential trong phiên.
- Các commit chính: `97a3431` (UI contract tests), `a605f25` (scrollbar contract), `7ba92a6` (catalog combobox), `fe3e5cd` (modal scroll). Workspace vẫn giữ nguyên các thay đổi sẵn có của người dùng; không push/merge và không reset/dọn file ngoài phạm vi.

## Cập nhật 2026-09-01 — UI collapsed/open cho PYC & luân chuyển mẫu

- Trang **Phiếu yêu cầu & Luân chuyển mẫu nội bộ** và projection **Điều phối phòng thử** dùng layout accordion theo mẫu/model: mặc định collapsed, phần tóm tắt vẫn hiện mã mẫu, model, số lượng, chế độ điều phối, vị trí và trạng thái.
- Người dùng mở từng mẫu để xem các phép thử đã gán, PYC, lịch thử, trạng thái thực hiện, PASS/FAIL, KQTN và hành động theo chặng; không tự hiển thị các phòng thử chưa được gán.
- Có nút **Mở tất cả** và **Thu gọn tất cả** theo danh sách đang lọc. State mở/đóng chỉ thuộc UI, không ghi DB/API; route tuần tự/song song và phạm vi PYC nội bộ không thay đổi.
- Đã thêm kiểm thử hợp đồng UI cho hai projection. Verification: `npm test` **573/573 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` exit 0.

## Cập nhật 2026-09-01 — Triển khai LABFTEE_APP và topology 3 app

- Runtime hiện hành: PCN `2357` (`pcn_webapp-webapp`), LABFTEE_APP `2358` (`labftee-app-prod`, `APP_CODE=PERFORMANCE`) và DDT `2359` (`ddt_webapp-webapp`, `APP_CODE=DDT`); DDT nhận hai route `EMC` và `ELECTRICAL_SAFETY`, LABFTEE nhận route `PERFORMANCE`.
- PCN production đã inject ba adapter route qua `PCN_LAB_INTEGRATIONS_JSON`; PERFORMANCE và DDT dùng hai HMAC secret riêng, không đưa secret vào payload hoặc database.
- LABFTEE đã có ingress nhận PYC, callback status theo từng mẫu và endpoint `POST /api/integrations/v1/lab-requests/:externalRequestId/reconcile` trả `statusEvents[]` item-scoped; reconcile chỉ đọc envelope, request và callback outbox.
- Production image LABFTEE đã bổ sung `prisma.config.ts` để migration chạy được. Database cũ đã baseline 3 migration nền và deploy migration `20260831000000_add_pcn_integration` forward-only; không reset dữ liệu hiện hữu.
- Verification runtime: cả 3 `/api/health` trả 200; probe HMAC từ PCN tới đủ `PERFORMANCE`, `EMC`, `ELECTRICAL_SAFETY` trả 404 đúng với mã giả; probe health ngược từ LABFTEE/DDT về PCN trả 200. Chưa gửi PYC thật; nghiệm thu E2E cần một PYC có từ 2 mẫu.

## Cập nhật 2026-08-31 — Mô hình mẫu thử trung tâm và tích hợp PYC phòng thử

- `PcnSampleItem` là đối tượng nghiệp vụ chính bên trong `PcnSampleLot`; một PYC mới bắt buộc gắn đúng một lô và một tuyến phòng thử. Một lô có thể có nhiều mẫu/model, loại mẫu và số lượng riêng.
- Các mẫu/model trong cùng lô và các lô khác nhau trong cùng hồ sơ có projection/luồng độc lập, có thể chạy song song. Route có thể giới hạn `sampleItemIds`; webhook item-level cập nhật `itemSnapshots` mà không ghi đè trạng thái mẫu khác.
- `PcnLabOperationsView` hiển thị một card cho mỗi mẫu/model, gồm vị trí hiện tại, phòng thử theo thứ tự, PYC đã có/chưa có, lịch thử, tiến độ thực hiện, PASS/FAIL, KQTN và trạng thái đồng bộ.
- PCN không dùng chung database với DDT/Hiệu suất. Server PCN gửi PYC bằng HMAC server-to-server, nhận ACK, nhận webhook trạng thái có idempotency/sequence guard và hỗ trợ reconcile khi thất lạc webhook.
- Hợp đồng tích hợp nằm trong `docs/superpowers/specs/2026-08-31-pcn-sample-centered-flow-design.md`; prompt triển khai cho app phòng thử cần giữ các khóa `pcnLabRequestId`, `pcnRouteId`, `pcnLotId`, `pcnSampleItemId`, `externalRequestId` và `externalRequestCode`.
- Verification lượt hoàn thiện: `npm test` **559/559 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` exit 0. Kết nối container và HMAC boundary đã được xác minh; chưa chạy PYC nghiệp vụ thật có từ 2 mẫu.

## Tổng kết hiện trạng PCN và audit mobile — 2026-08-31

### Phạm vi sản phẩm đã chốt

- Runtime sản phẩm là PCN của Trung tâm TVCI, dùng Next.js App Router; không dùng logic Phòng Giám định/DDT, Haimy, Cutover hoặc các màn hình historical làm luồng vận hành.
- Đầu vào là **Đề nghị**. Mỗi Đề nghị tạo đúng một bộ hồ sơ/card; **PYC** chỉ phát sinh khi PCN gửi yêu cầu tới phòng thử nghiệm khác.
- Hồ sơ đi qua năm trạm tuần tự: tiếp nhận/đề nghị, chuẩn bị đánh giá & lấy mẫu, thử nghiệm/liên kết PYC và nhận KQTN, soát xét/phê duyệt, phát hành & giao khách hàng. Tài liệu hoặc ngoại lệ bị bỏ qua phải được đánh dấu và nêu lý do.
- QC4, QC9, QC20 là các nhánh/lĩnh vực trong cùng pipeline. Mẫu được mã hóa theo lô, hiển thị dạng bảng cell tổng hợp và theo dõi flow riêng qua Hiệu suất, EMC, An toàn điện hoặc tuyến cấu hình tương ứng.
- KQTN do phòng thử nghiệm cấp; PCN lưu bản scan, OCR chỉ tạo dữ liệu nháp có nguồn/độ tin cậy và phải được người dùng xác nhận.
- Giữ Danh sách khách hàng. Nhân sự PCN tách khỏi khách hàng, có **system role** và **department role** riêng; Lương Xuân Hùng là Admin, các tài khoản nhân viên PCN được ánh xạ từ danh sách khách DDT theo roster đã xác nhận.
- Database logic PCN và private Storage PCN tách riêng; file hồ sơ, DOCX/PDF sinh ra và metadata đi qua boundary PCN.

### Audit responsive mobile vừa hoàn tất

- `design.md` §5.3 đã bổ sung contract `pcn-page-surface`: page root có `min-width: 0`/`min-height: 100%`, shell `main` là chủ sở hữu duy nhất của scroll dọc cấp trang.
- `index.css` bổ sung khóa tràn ngang cho `html/body`, `pcn-page-surface`, safe-area cho bottom navigation và fallback `overflow-x: hidden` cho `mobile-scroll-y`.
- `PcnWorkspace` giữ một vùng cuộn chính; bottom navigation có thể cuộn ngang và nút có vùng chạm tối thiểu khoảng 44px.
- Các PCN workspace root đã bỏ kiểu `h-full overflow-y-auto` gây scroll lồng; các bảng/timeline và vùng dữ liệu rộng vẫn dùng scroll ngang riêng.
- Modal Đề nghị, PYC, KQTN, giao nhận mẫu, sinh tài liệu, template và form nghiệp vụ dùng vùng nội dung cuộn độc lập; header/footer giữ cố định trong khung modal. Form nghiệp vụ đã tách footer khỏi vùng cuộn.
- Đã kiểm tra runtime không tràn ngang ở viewport 320, 375, 390 và 430px trên native `1357` và production `2357` (browser kiểm tra tại màn hình đăng nhập, không nhập credential).

### Verification và triển khai mới nhất

- `npm test`: **540/540 pass**; `npm run lint`: pass; `npm run build`: pass; `git diff --check`: exit 0.
- Test contract responsive riêng: **5/5 pass**.
- Production Docker image đã build/recreate thành công; container `pcn_webapp-webapp-1` chạy trên `0.0.0.0:2357->2357/tcp`.
- `GET http://localhost:2357/api/health` trả HTTP 200 với `{"status":"ok"}`; không thay đổi `.env` và không tạo secret mới, cấu hình được lấy từ container production đang chạy.
- Không tạo branch mới, không commit và không reset/dọn các thay đổi cũ trong workspace. Các mục bên dưới có thể là lịch sử DDT hoặc checkpoint PCN trước đó; mục này là trạng thái mới nhất cho PCN.

## Ranh giới runtime PCN hiện tại — 2026-08-31

- PCN có các lối vào/workspace nghiệp vụ: **Tổng quan**, **Đề nghị**, **Sổ điều hành**, **PYC & luân chuyển mẫu**, **Soạn thảo tài liệu**, **Trợ lý tiến trình** và **Danh sách khách hàng**; **Nhân sự PCN** và **Cài đặt PCN** chỉ nằm trong nhóm **Quản trị** cho Admin.
- QC4, QC9, QC20 và các nhánh quy chuẩn khác là bộ lọc/nhánh trong Tổng quan và Đề nghị, không phải các trang độc lập.
- Mỗi Đề nghị là một bộ hồ sơ/card; khi mở card chỉ dùng năm vùng làm việc: Tổng quan, Tài liệu hồ sơ, Mẫu & PYC, KQTN, Phê duyệt & phát hành. Sinh biểu mẫu, tệp liên kết và lịch sử là các khối gấp trong vùng tương ứng.
- Các trang lịch sử, cutover, Haimy, backup, toàn vẹn dữ liệu, nhật ký, agent, kho lưu trữ, quản lý template và các trang workflow đứng riêng là phạm vi đã loại khỏi runtime PCN; không dùng các ghi chú cũ bên dưới làm yêu cầu tạo màn hình mới.
- Kiểm chứng sau khi thu gọn: `npm run lint`, `npm run build`, nhóm test scope/pipeline/sidebar/notification và `git diff --check` đều pass. Không commit và không tạo worktree mới.

## Cập nhật 2026-08-30 — PCN: upload tài liệu theo node graphic và kiểm chứng cuối lượt

- Chi tiết hồ sơ PCN dùng graphic workflow làm điểm điều hướng chính. Khi nhân viên chọn một node, checklist **Tài liệu tại bước** và các nút upload được dẫn xuất theo đúng `stationKey` của node đó, thay vì luôn lấy theo trạng thái hồ sơ hiện tại.
- Mỗi mục checklist có nút **Tải phiên mới** ngay cạnh tài liệu; upload vẫn đi qua `uploadDossierDocument` và private Storage boundary hiện hành, giữ phiên cũ, không tạo bảng/collection trạng thái mới và không ghi byte file vào JSON/DB.
- Khu vực kiểm tra trực quan vẫn read-only; người có quyền xử lý thao tác upload tại checklist của node đang chọn. Tài khoản viewer/quản lý chỉ xem theo capability hiện hành.
- Đã cập nhật `design.md` để ghi rõ node graphic đang chọn là nguồn của panel upload theo bước. Test hồi quy mới kiểm tra checklist chọn đúng node `SAMPLING_LAB` dù dossier đang ở trạng thái `AWAITING_DOCUMENTS`.
- Kiểm chứng cuối lượt: focused pipeline test **23/23 pass**, toàn bộ `npm test` **955/955 pass**, `npm run lint` (TypeScript) pass, `npm run build` pass, `git diff --check` exit 0.
- PCN native development dùng `http://localhost:1357`; PCN Docker production dùng `http://localhost:2357` theo `design.md`. Endpoint hiện tại `http://127.0.0.1:2357/` trả HTTP 200; chưa xác minh được container đã rebuild từ source mới nhất vì Docker API trên máy đang trả `permission denied`.
- Không commit, không thay đổi `.env` và không đưa secret/dữ liệu hồ sơ thật vào memory. Workspace đang có nhiều thay đổi cũ của người dùng; không dọn hoặc reset các thay đổi đó.

## Cập nhật 2026-08-30 — PCN webapp: bộ hồ sơ và graphic workflow

- Profile đang triển khai là `pcn`, dùng `docker-compose.pcn.yml`, database logic `pcn_certification` trên network `supabase_default`; Docker production của PCN dùng cổng `2357`.
- Dashboard PCN dùng một bề mặt công việc tại một thời điểm, mặc định là **Hồ sơ cần hoàn thiện** dạng card; hàng đợi chỉ là góc nhìn phụ, không nhân đôi dossier. Graphic 5 bước chỉ nằm trong chi tiết của đúng hồ sơ đang mở và không dùng để lọc danh sách card dashboard.
- Một hồ sơ có `ownerUsername` duy nhất xuyên suốt từ Đề nghị, tài liệu/biên bản, đánh giá, PYC/KQTN, đóng gói đến trình lãnh đạo. Card hồ sơ chưa có chủ có điểm vào **Nhận hồ sơ**; self-claim dùng cùng policy server với hàng đợi.
- Chi tiết dossier đã có checklist trực quan read-only, upload theo từng yêu cầu với phiên bản, danh sách thành phần bộ hồ sơ, liên kết PYC/KQTN/phát hành và khu vực sinh biểu mẫu Word/PDF/biên bản.
- Quyền nhận/chuyển chủ hồ sơ không được suy ra từ UI: nhân viên chỉ tự nhận hồ sơ trống của chính mình; Admin/Lãnh đạo mới được điều phối; viewer bị chặn; mutation vẫn qua server boundary và audit.
- Verification trước triển khai: `npm test` và `npm run lint` phải pass trên tree hiện tại; `npm run build` là bước bắt buộc trước khi dựng image. Không đưa `.env`, secret, attachment hoặc dữ liệu thô trong `tmp/` vào commit.
- Deploy production sau commit phải dùng `docker compose --env-file <Supabase env> -f docker-compose.pcn.yml up --build -d`; cần có `PCN_SESSION_SECRET` ổn định trong env triển khai, không dùng secret hard-code trong repository.

## Observation triển khai 2026-08-30 — PCN production Docker Desktop

- Commit code đã tạo: `cd0d0dac97f215e13204c400006402407714fbc7` (`feat(pcn): add certification workspace and workflow`).
- Docker image đã build thành công: `pcn_webapp-webapp:latest`, image digest `sha256:1449b235609f47022b7c4216960e8fc2d8d5b2ece158a87e5c890500c65a2a5d`.
- Container đang chạy: `pcn_webapp-webapp-1`, publish `0.0.0.0:2357->2357/tcp`.
- Kiểm tra runtime: `GET /api/health` trả HTTP 200 với `{"status":"ok"}`; PostgreSQL `supabase-db:5432` accepting connections và truy vấn runtime xác nhận `pcn_certification|postgres`.
- `GET /api/db/health` không kèm phiên đăng nhập trả HTTP 401 (`Phiên PCN không hợp lệ hoặc đã hết hạn.`), phù hợp với lớp bảo vệ xác thực của API.
- Build context ban đầu phình khoảng 1,8 GB do `.next`; `.dockerignore` đã bổ sung `.next`, `tmp`, `obsidian-vault` và `.codex-remote-attachments`, context lần build thành công còn khoảng 7,54 MB.
- Lần deploy này dùng `PCN_SESSION_SECRET` sinh tạm trong phiên compose vì file env Supabase hiện chưa có biến này. Cần đặt một secret ổn định trong env triển khai trước lần recreate/restart tiếp theo; không ghi secret vào repository hoặc memory.

## Lưu ý vận hành hiện tại — Môi trường chạy & Cổng dịch vụ

- **PCN native development (`npm run dev:pcn`)**: Chạy Node/Express server trực tiếp tại `http://localhost:1357`.
- **PCN Docker Desktop production (`docker-compose.pcn.yml`)**: Container web app publish tại `http://localhost:2357`.
- Các ghi chú DDT legacy trong tài liệu lịch sử dùng cổng `1359`/`2359`; không dùng nhầm các cổng đó cho profile PCN.
- Môi trường PCN dùng PostgreSQL/Supabase network hiện có; trước khi recreate Docker cần có `PCN_SESSION_SECRET` ổn định trong env triển khai.
- Không deploy project lên Synology NAS; SSH/rsync tới NAS không thuộc quy trình hiện tại.
- `deploy.sh` đã được chuyển thành script build/restart Docker Desktop local. Script không đồng bộ `.env`, service account hoặc secret ra máy từ xa.
- Sau khi deploy, kiểm tra `http://localhost:2359/api/health` và `http://localhost:2359/api/db/health`.
- Dùng `COMPOSE_ENV_FILE` để chỉ định env file của stack Supabase khi cần; PCN không có dependency mặc định vào thư mục tham chiếu bên ngoài workspace.

## Cập nhật 2026-08-24 — Form Báo cáo: Quy chuẩn Bảng Công suất nhiễu EMC chỉ hiển thị 1 hàng (tự động lấy hàng 1)

- **Quy chuẩn Toàn hệ thống (`design.md`)**:
  - Bổ sung quy định chung: Bảng kết quả Công suất nhiễu (Phần 6 / `tablePower*`) trên tất cả các form báo cáo EMC chỉ hiển thị và sử dụng duy nhất **1 hàng** kết quả.
  - Khi tải file Radimation hoặc khi dán dữ liệu (paste): nếu tệp có từ 2 hàng trở lên, hệ thống tự động **chỉ lấy hàng 1** và bỏ qua các hàng phía sau.
- **Thực thi Code**:
  - `EmcBepDien1VungNauForm.tsx`:
    - `RadimationUploader`: Với các bảng `isPower` (`tablePower*`), tự động lấy hàng 1 (`targetRows[startIndex] || targetRows[0]`) và gán `[mappedObj]`.
    - `TablePowerDisturbance`: Giới hạn render bảng `data[tableName].slice(0, 1)`.
    - `handlePaste`: Khi paste vào `tablePower*`, chỉ xử lý hàng đầu tiên và giữ độ dài bảng bằng 1.
  - `server.ts`: Áp dụng `.slice(0, 1)` cho toàn bộ các trường `tablePower*`, `table_6_3_*`, `table_7_3_*` khi xuất DOCX template.
- **Kiểm thử**:
  - `test/report-docx-image-integration.test.ts` (12/12 pass), `npm run lint` (0 errors), `npm run build` (pass).

## Cập nhật 2026-08-24 — Form Báo cáo: Bổ sung mục 6.3.2.1 EMC Máy khoan (Công suất nhiễu 2 chiều quay)

- **Đồng bộ Design & Form Đánh giá**:
  - Cập nhật mục 4.4 trong `design.md` làm Single Source of Truth cho cấu hình bài đo Công suất nhiễu của **EMC Máy khoan** (`emc_may_khoan`).
  - Trong `EmcBepDien1VungNauForm.tsx`, tách riêng cấu hình Section 6 cho máy khoan gồm đầy đủ 2 chiều quay song song:
    1. **6.3.1. Thử nghiệm khi EUT quay cùng chiều kim đồng hồ**: Dòng con `6.3.1.1. Kết quả công suất nhiễu của dây dẫn nguồn` (ảnh `powerDisturbance`, bảng `tablePower`).
    2. **6.3.2. Thử nghiệm khi EUT quay ngược chiều kim đồng hồ**: Dòng con `6.3.2.1. Kết quả công suất nhiễu của dây dẫn nguồn` (ảnh `powerDisturbance_2`, bảng `tablePower_2`).
- **Template DOCX**:
  - Đồng bộ `maykhoan placeholder.docx` (trong `public/` và `dist/`) bổ sung đầy đủ khối `6.3.2` & `6.3.2.1` với `{%image_6_3_2_1}`, `{#table_6_3_2_1}...{/table_6_3_2_1}` và `Bảng 14`.
- **Kiểm thử**:
  - `test/report-*.test.ts` (11/11 pass), `npm run lint` (0 errors), `npm run build` (pass).

## Cập nhật 2026-08-24 — Form Báo cáo: Bổ sung trường Phụ trách phòng TN (managerName) & Droplist chọn nhanh

- **Đồng bộ Design & Schema**:
  - Cập nhật mục 4.4 trong `design.md` làm Single Source of Truth cho 2 trường ký duyệt báo cáo: `testerName` (`{testerName}`) và `managerName` (`{managerName}` / `{managerNam}`).
  - Thêm `managerName?: string;` vào `KQTNRecord` trong `types.ts`.
- **Giao diện ReportGeneratorView**:
  - Mở rộng state `reportMeta` với trường `managerName`.
  - Tái cấu trúc khu vực chữ ký thành 2 cột song song (responsive grid): **Người thử nghiệm** (`testerName`) và **Phụ trách phòng TN** (`managerName`).
  - Trang bị **Droplist chọn nhanh** cho `managerName` chỉ nhận diện các nhân sự giữ chức danh **Trưởng phòng hoặc Phó trưởng phòng** (mặc định gồm: **Vũ Việt Anh** và **Lương Xuân Hùng**), đồng thời giữ giá trị cũ khi tải lại KQTN.
  - Trang bị `<datalist>` danh sách nhân sự cho `testerName`.
  - Hiển thị thông tin **Phụ trách PTN** trong modal chi tiết của `KQTNView.tsx`.
- **Backend & DOCX Template Mapping**:
  - `server.ts` (`POST /api/generate-docx`): Ánh xạ `managerName` và alias `managerNam` vào template data của Docxtemplater.
- **Verification**:
  - `test/report-docx-image-integration.test.ts` & `test/report-docx-metadata.test.ts` (7/7 pass).
  - `npm run lint` (0 errors), `npm run build` (pass, bundle tạo thành công).

## Cập nhật 2026-08-24 — Docx Template Settings Modal & Code Conventions Update

- **DocxSettingsModal & Quản lý Biểu mẫu Word**:
  - Cập nhật mục 4.6 trong `design.md` làm source of truth.
  - Tạo `lib/reportTemplatesCatalog.ts` tổng hợp 43 định nghĩa template DOCX (An toàn điện 5699, EMC QCVN 9, Dây cáp điện 6610, PYC, BMGN).
  - Thêm 4 REST API routes trong `server.ts` (`GET /api/templates`, `GET /api/templates/:filename/download`, `POST /api/templates/upload`, `POST /api/templates/:filename/reset`) với cơ chế sao lưu tự động `.bak` trước khi ghi đè.
  - Tạo `components/DocxSettingsModal.tsx` và gắn nút "Cài đặt docx" vào header của `ReportGeneratorView.tsx`.
  - Hỗ trợ tìm kiếm tức thì, lọc theo nhóm tab, tải về, chọn file/kéo thả để cập nhật và khôi phục bản gốc.
- **Loại bỏ quy chuẩn Header/Footer khi coding**:
  - Đã cập nhật `AGENTS.md` và `design.md` (Mục 8) loại bỏ hoàn toàn yêu cầu bắt buộc header `// Author: Gemini` và footer `// --- End of [filename] ---`.
- **Quy định cổng chạy**:
  - Ghi nhớ cổng Dev server là `1359`, cổng Docker Desktop production là `2359`.
- **Verification**: `test/docx-template-settings.test.ts` (4/4 pass), `test/report-*.test.ts` (9/9 pass), audit scripts (2/2 pass), `npm run lint` (0 errors), `npm run build` (pass).
- **Production deployment**: Rebuilt image `ddt_webapp-webapp:latest` và recreate container `ddt_webapp-webapp-1` trên Docker Desktop (cổng 2359).

## Cập nhật 2026-08-22 — Bulk Upload KQTN trên Docker Desktop

- Bulk Upload Plan B đã được build/recreate trên Docker Desktop local bằng `docker-compose.supabase.yml`.
- Container `ddt_webapp-webapp-1` đang chạy trên cổng `2359`; `/api/health` và `/api/db/health` đều trả HTTP 200 sau deploy.
- Bản deploy gồm luồng PDF ghép nhiều kết quả, tách PDF con, review mapping, upload tuần tự, retry nhóm lỗi và activity log tổng hợp.

## Cập nhật 2026-08-22 — Dashboard staffing, bỏ PEAK và backup file đầy đủ

- Dashboard Tổng quan hiện chỉ đưa nhân viên lên bảng công việc, KPI và menu **Tùy chỉnh nhân sự** khi có ít nhất một phiếu có `scheduledDate` và `testerName` thực tế; loại `Chưa giao`, `Khác` và các bản ghi lịch sử `-log-`. Phân công đã hoàn thành vẫn được giữ trong tập nhân sự vì từng thuộc một lịch thử nghiệm.
- Logic lọc được tách vào `utils/dashboardStaffing.ts`; `App.tsx` không còn lấy nhân sự từ `defaultTestersAtd`, `defaultTestersChamber1` hoặc `defaultTestersChamber2` cho Dashboard.
- Đã xóa banner và toàn bộ phép tính riêng phục vụ cảnh báo `PEAK MODE` trong `App.tsx`.
- Cập nhật `design.md` để làm source of truth cho phạm vi nhân sự theo lịch thực tế và hợp đồng backup đầy đủ.
- Cảnh báo Admin có nút **Sao lưu đầy đủ** gọi server backup. `utils/backupManager.ts` tạo archive `.zip` chứa `database.dump`, `storage/manifest.json` và object PDF KQTN từ Supabase Storage; restore chạy `pg_restore` trước rồi khôi phục object. Backup JSON/CSV chỉ còn là bản portable, không được tính là backup file đầy đủ.
- Ảnh OCR và ảnh lập báo cáo vẫn là dữ liệu tạm, không đưa vào backup hoặc `file_assets`; PDF KQTN là file nghiệp vụ và được backup.
- Verification: test Dashboard/PEAK/backup `11/11`, `npm run lint` pass, `npm run build` pass, `git diff --check` pass. Full suite `220/222` pass; hai lỗi còn lại là contract Compose đang kỳ vọng không có `SUPABASE_SERVICE_ROLE_KEY` và test cũ kỳ vọng store gọi trực tiếp `fetchCollection("systemUsers", true)`, đều nằm ngoài thay đổi này.
- Workspace vẫn có các thay đổi chưa commit từ trước; lượt này không reset hoặc ghi đè các thay đổi ngoài phạm vi.

## Cập nhật 2026-08-20 — Bản nháp phiếu yêu cầu và reset form

- Đã cập nhật `design.md` quy định bản nháp chỉ áp dụng cho modal tạo phiếu mới, lưu cục bộ theo tài khoản bằng IndexedDB, không lưu ảnh/OCR hoặc trạng thái UI tạm thời.
- `utils/requestDraft.ts` cung cấp khóa bản nháp chuẩn hóa theo username, kiểm tra payload, đọc/ghi/xóa IndexedDB.
- `RequestModal` tự lưu bản nháp sau khi người dùng thay đổi, flush khi đóng modal, cho phép khôi phục khi mở lại và xóa sau khi lưu phiếu thành công.
- Nút `Xóa bản nháp` xóa dữ liệu cục bộ, reset toàn bộ form về trạng thái vừa mở modal và giữ modal đang hiển thị; modal chỉnh sửa phiếu không dùng cơ chế này.
- Verification: test draft + save-sync `6/6`, `npm run lint` pass, `npm run build` pass; full suite `214/215` pass, lỗi còn lại là contract Compose cũ liên quan `SUPABASE_SERVICE_ROLE_KEY`.
- Production Docker đã rebuild/recreate sau thay đổi; container `ddt_webapp-webapp-1` đang `Up`, `/api/health` và `/api/db/health` đều HTTP 200 trên cổng `2359`.

## Cập nhật 2026-08-20 — Tối ưu lưu phiếu và deploy production Docker Desktop

- Đã xác định nguyên nhân lưu phiếu chậm là `RequestModal` thực hiện full sync lặp trong bước pre-check, trong `addRequests()` và sau khi lưu.
- Đã cập nhật `design.md` quy định pre-check chỉ đọc collection `requests`; sau mutation chỉ thực hiện một full sync hậu lưu. Các caller khác của `addRequests()` vẫn giữ sync mặc định.
- Đã thêm `fetchLatestRequests()` với fallback về local khi API lỗi; `RequestModal` truyền `skipSync=true` cho `addRequests()` rồi thực hiện một full sync cuối để bảo toàn merge, notification và persistence.
- Regression tests cho luồng này đạt `15/15`; `npm run lint` pass; `npm run build` pass. Full suite đạt `211/212`; test còn lại là contract Compose Supabase không liên quan, do `SUPABASE_SERVICE_ROLE_KEY` vẫn hiện diện trong Compose.
- Đã build production Docker image `ddt_webapp-webapp:latest` và recreate container `ddt_webapp-webapp-1` bằng `docker-compose.supabase.yml`.
- Verification sau deploy: container `Up`, publish `2359:2359`, server kết nối PostgreSQL thành công, `/api/health` HTTP 200, `/api/db/health` HTTP 200, collection `requests` trả `587` bản ghi.
- Build vẫn có cảnh báo bundle JavaScript lớn hơn 500 kB; không chặn deployment và chưa nằm trong phạm vi tối ưu lần này.

## Cập nhật 2026-08-18 — Hoàn tất chuyển runtime sang Supabase PostgreSQL

- Webapp production trên cổng `2359` hiện kết nối `supabase-db:5432`, database `ddt_lab`, qua network `supabase_default`.
- Đã đối chiếu toàn bộ dữ liệu giữa runtime cũ và Supabase: 1.079 document cũ đều đã có ở Supabase; Supabase giữ thêm `activityLogs`, `kqtnRecords`, `products` và `userPreferences`.
- Đã đồng bộ 7 `systemConfig` có timestamp mới hơn từ runtime cũ và bổ sung `chamberId` còn thiếu cho một phiếu; notification payload đầy đủ trên Supabase được giữ nguyên.
- Đã tạo backup trước migration: `backups/ddt-legacy-postgres-20260818-211058.dump` và `backups/ddt-supabase-postgres-20260818-211058.dump`.
- Đã xóa container `ddt_webapp-postgres_db-1`, volume `ddt_webapp_pgdata` và volume orphan `ddt_webapp_postgres_data`; không còn PostgreSQL DDT standalone.

## Cập nhật 2026-08-18 — UI mobile/PWA và xuất DOCX

- Global UI đã trả về mức `100%`; layout desktop không còn bị co dưới.
- Portrait guard của PWA chỉ áp dụng cho thiết bị cảm ứng (`pointer: coarse`); desktop/DevTools dùng pointer chuột không bị khóa xoay hoặc hiện cảnh báo ngang.
- Đã bỏ nút `Cài đặt webapp` khỏi header.
- Đã thu gọn icon trong card Phiếu yêu cầu, sửa nút `Tùy chỉnh nhân sự` trên Tổng quan để hoạt động bằng click/tap và giữ bảng KQTN mobile trong vùng cuộn hiển thị được mẫu.
- Validation DOCX: mismatch với thông tin PYC, OCR hoặc thông số PYC chỉ là cảnh báo và vẫn cho phép lưu/xuất DOCX. Chỉ ngày sai định dạng hoặc sai thứ tự thời gian mới chặn.
- Khi có lỗi chặn, khu vực ngay trên nhóm nút báo `Xuất DOCX đang bị chặn` và liệt kê trường/vị trí cần xử lý. Khi chỉ có mismatch, UI báo `Có cảnh báo đối soát` và xác nhận vẫn có thể xuất DOCX.
- Kiểm tra cuối: 38/38 test hồi quy liên quan pass, `npm run lint` pass, `npm run build` pass; Docker production đã rebuild trên `2359`, PostgreSQL healthy trên `15432`, `/api/db/health` trả HTTP 200.

## Cập nhật 2026-08-19 — Ghép ảnh tem động vào một placeholder DOCX

- Đã xác nhận yêu cầu nghiệp vụ: mọi ảnh tem động `label`, `label2`, `label3`, ... phải giữ đúng thứ tự, ghép cạnh nhau thành một ảnh ngang duy nhất và chỉ mapping vào `anh_1`; không phân tán sang `anh_2`, `anh_3`, ... .
- Đã cập nhật `design.md` để quy tắc composite ảnh tem trở thành source of truth.
- `lib/reportDocxImageMapping.ts` có mapper numeric-order, loại slot tem rỗng, tạo composite PNG ngang bằng `Resvg` và giữ tỷ lệ từng ảnh thành phần.
- `server.ts` tạo composite trước khi render DOCX, loại bỏ các assignment cứng `data.anh_*` có thể ghi đè mapping; ảnh mẫu/thiết lập EMC bắt đầu từ slot sau `anh_1`.
- `ReportGeneratorView.tsx` truyền fallback `nameplatePhotos`; `EmcBepDien1VungNauForm.tsx` sắp xếp các ô tem theo số thứ tự.
- Đã thêm regression tests cho numeric order, composite PNG, DOCX render và contract server/template audit.
- Verification: `npx tsc --noEmit` pass, `npm run build` pass, focused DOCX/audit tests `8/8` pass. Full suite `199/200` pass; test còn lại là lỗi contract Compose có sẵn liên quan `SUPABASE_SERVICE_ROLE_KEY`, không liên quan DOCX.

## Trạng thái kiến trúc

- PostgreSQL là database runtime chính; ứng dụng không còn dùng Firestore cho luồng lưu trữ runtime.
- Dữ liệu nghiệp vụ được lưu trong bảng PostgreSQL `app_documents` với khóa `(collection_name, document_id)` và payload `JSONB`.
- REST API nội bộ cho database nằm dưới `/api/db/*`; batch tối đa 250 document mỗi lượt.
- Bản backup JSON đã được import: **1.291 document**.
- Danh sách người dùng hiện có trong PostgreSQL: **16 document** thuộc collection `systemUsers`.
- Hệ thống notification nghiệp vụ dùng collection `notifications` trong `app_documents`, merge theo `id` và giữ tối đa 50 bản ghi mới nhất.
- Chính sách notification là low-noise: chỉ báo ngay các thay đổi lớn ảnh hưởng tiến độ, phân công, trạng thái, mẫu, biên bản hoặc KQTN; không báo các chỉnh sửa chữ, ghi chú, đổi tên/đổi mã hiển thị.
- Admin/Quản lý xem toàn bộ notification nghiệp vụ; nhân viên chỉ xem phiếu mới, biên bản mới và công việc được giao đúng username.
- Mọi tài khoản đã đăng nhập đều có chuông/dropdown notifications; nội dung vẫn được lọc theo audience và `targetUsernames` để tránh gây loãng.
- Notification metadata gồm entity/action, request/doc/report reference, trạng thái trước/sau, lịch thử và target username để phục vụ lọc quyền và điều hướng click.
- Nhật ký hệ thống dùng collection riêng `activityLogs` trong `app_documents`, append-only đối với UI và không dùng chung trạng thái đọc/xóa của notifications.
- Mọi mutation nghiệp vụ thành công đều ghi activity log, kể cả sửa nhỏ; notification vẫn giữ chính sách low-noise chỉ báo thay đổi lớn.
- Activity log được append qua `POST /api/activity-logs` hoặc `POST /api/activity-logs/batch`; trang đọc qua `GET /api/activity-logs` với cursor/filter, không hydrate toàn bộ lịch sử vào Zustand.
- Trang `Nhật ký hệ thống` dành cho mọi tài khoản đã đăng nhập, nằm ngay trước `Thiết lập` trên sidebar; dữ liệu chỉ đọc, chi tiết có diff before/after đã redaction và export CSV theo các dòng đã tải.
- App shell sau đăng nhập dùng scope `ddt-compact`: giảm gap/padding/font theo một bậc cho header, sidebar, toolbar, card và filter; giữ touch target mobile và scope riêng của report/print.
- API append/batch dựng lại payload qua `buildActivityLog` trước khi lưu để loại trường ngoài contract và redaction dữ liệu nhạy cảm; cập nhật KQTN được phân loại là `KQTN_RECORD`.

## Cổng và triển khai

- Dev server: `http://localhost:1359`.
- Dev PostgreSQL Docker: `localhost:15432` ánh xạ vào cổng container `5432`.
- Docker production app: `http://localhost:2359`.
- Docker Compose production chỉ gồm `webapp`, kết nối database `ddt_lab` trên Supabase network `supabase_default`; không còn volume PostgreSQL local.
- Domain public đã kiểm tra: `https://ddtdev.tvci.id.vn`.
- Vite dev HMR đã gắn vào HTTP server chính; WebSocket public dùng cùng origin, không còn cổng ngẫu nhiên `24678`.
- `ddtdev.tvci.id.vn` đã nằm trong `server.allowedHosts`.

## UI/UX đã chốt

- Đã bỏ nút riêng **“Nhật ký đồng bộ”** khỏi Header.
- Chức năng chẩn đoán đồng bộ PostgreSQL vẫn mở từ **Cấu hình hệ thống**.
- PWA dùng nhãn **“Cài webapp”**, không dùng “Download”. Chrome/Edge tự cung cấp biểu tượng cài đặt trên thanh địa chỉ khi app chạy tại `localhost` hoặc HTTPS đủ điều kiện.
- Manifest PWA dùng tên `PTN Điện - Điện tử | TVCI Lab`, `display: standalone`, `scope: /`, icon PNG TVCI tại `public/icons/tvci-icon-32.png`, `public/icons/tvci-icon-192.png` và `public/icons/tvci-icon-512.png`.
- `index.html` đăng ký `/sw.js`; không được thêm lại logic unregister service worker hoặc xóa toàn bộ cache khi khởi động.
- Service worker hiện dùng cache `ddt-lab-pwa-v3` và pre-cache manifest/icon PWA.
- Dropdown notification đã điều hướng được tới danh sách phiếu, màn hình giao nhận mẫu, KQTN và lịch thử nghiệm.

## Xác minh gần nhất

- `npm test`: **142/142 pass** ngày 18/08/2026 khi dùng preload test có sẵn `scripts/test-node-userinfo-preload.cjs` để tránh lỗi môi trường Node/Windows `uv_os_get_passwd ENOMEM`; không thêm shim tạm vào source notification.
- `npm run lint`: pass sau khi thêm activity log model/API/store/UI.
- `npm run build`: pass ngày 18/08/2026; còn cảnh báo chunk JavaScript lớn hơn 500 kB, không phải lỗi build.
- Đã backfill **38 activity logs** từ các notification phát sinh trong buổi sáng 18/08/2026, giữ lại actor/action/entity; các phiếu chỉ có `updatedAt` nhưng không có actor không được gán người thực hiện. Sau đó có thêm 1 log người dùng mới, nên production hiện có 39 bản ghi.
- Production Docker Desktop đã build/recreate thành công ngày 18/08/2026: `ddt_webapp-webapp` chạy port `2359`, `ddt_webapp-postgres_db-1` healthy với port host `15432`; `/api/health` trả 200 và `/api/activity-logs` đọc được dữ liệu.
- Production Docker đã rebuild sau KPI extension; bundle mới có summary API, checkbox người dùng, biểu đồ KPI và GMT+7. Summary ngày 18/08/2026 xác minh 6 nhân viên, HungX 15 hoạt động và Vũ Nam Thái 4 mẫu KQTN.
- Production Docker đã rebuild lại sau khi mở Nhật ký cho mọi tài khoản đăng nhập và xác nhận notifications dùng chung chuông/dropdown với audience filtering; `/api/health` và `/api/activity-logs` trả HTTP 200.
- Production Docker đã rebuild lại sau compact density và hoàn thiện Header Nhật ký; container chạy port `2359`, PostgreSQL healthy, `/api/health` và `/api/activity-logs` tiếp tục trả HTTP 200.
- Compact density vòng 2 đã thu gọn thêm các modal lớn dùng `p-8`, `gap-6/8` và `space-y-6`; vẫn giữ ngoại lệ report form và touch target mobile. Docker đã rebuild/smoke test lại ngày 18/08/2026.
- KPI tạo hàng loạt đã được chuẩn hóa thành một audit log cho từng phiếu để đếm đúng distinct entity; bộ lọc có sequence guard chống phản hồi cũ ghi đè; server chỉ nhận `createdAt` dạng ISO hợp lệ.
- Đã sửa lỗi PWA: bỏ link trực tiếp `/index.css` khỏi HTML, giao CSS cho Vite entry, và bắt lỗi fetch tài nguyên trong `public/sw.js`; Docker production rebuild/smoke check pass, HTML không còn gọi CSS sai.
- Trang Nhật ký hệ thống có scrollbar dọc riêng cho vùng bộ lọc/KPI và bảng dữ liệu; không mở scrollbar toàn app để giữ layout viewport/mobile ổn định.
- Gemini model discovery không còn tự gọi khi mở Thiết lập; endpoint chỉ chạy khi bấm kiểm tra, thiếu key trả `503/GEMINI_API_KEY_MISSING`, lỗi kết nối Google trả `503/GEMINI_API_UPSTREAM_UNAVAILABLE`.
- Notification contract/helper tests bao phủ audience, assignment username, event metadata, merge/xóa, navigation và backup/restore.
- Activity log tests bao phủ builder/redaction/quyền, cursor API/append batch, backup/import append-only, store entity coverage, bulk request audit, timestamp validation, chống stale response, sidebar placement, UI controls và vùng cuộn dọc.
- Activity KPI tests bao phủ summary API, chọn nhiều nhân viên, giới hạn hiển thị, chart segments và format thời gian GMT+7.
- Trang Nhật ký đã chuyển KPI sang ranking thanh ngang xếp chồng responsive: mỗi nhân viên có tổng thao tác, thanh phân bổ Phiếu/KQTN/Biên bản/Lịch/Khác và các số P/M/KQ/BB/L/Kh; danh sách có giới hạn cuộn nội bộ để xem nhiều người trên mobile. Bộ lọc mobile có thể thu gọn và trang đã chừa safe-area cho bottom navigation.
- Xác minh vòng thay đổi KPI compact: nhóm test Activity/KPI/mobile/global UI đạt 21/21, `npm run lint` và `npm run build` đạt. Lệnh `npm test` trong lần chạy này bị Node/Windows chặn trước khi nạp test bởi `uv_os_get_passwd ENOMEM`; đây là giới hạn môi trường, không phải assertion của thay đổi.
- Compact UI tests bao phủ scope `ddt-compact`, ngoại lệ report form spacing/typography, touch-target contract và nhãn Header của trang Nhật ký.
- Gemini credential tests bao phủ phân biệt thiếu key/upstream network và không tự gọi model khi mount trang Thiết lập.
- Production build đã phát hành đủ `dist/manifest.json`, `dist/sw.js` và `dist/icons/*` cho PWA.
- Docker Desktop production: `docker compose up -d --build` pass ngày 17/08/2026; image `ddt_webapp-webapp:latest` đã được build và container `ddt_webapp-webapp-1` chạy trên `2359:2359`.
- PostgreSQL container `ddt_webapp-postgres_db-1` healthy trên `15432:5432`.
- Production smoke check pass: `/api/health` trả HTTP 200 `{"status":"ok"}`, `/api/db/health` trả HTTP 200 với `database: postgresql`.
- PWA asset smoke check pass: `/manifest.json`, `/sw.js`, `/icons/tvci-icon-192.png` và `/icons/tvci-icon-512.png` đều trả HTTP 200 trong container production.
- `/api/health` và `/api/db/health` trả HTTP 200 ở dev, Docker và domain public.
- Batch write/delete đã kiểm tra thành công cho `handoverDocs`, `products`, `systemUsers`, `brands`, `systemConfig` và `requests`.

## Observations và lưu ý vận hành

- Không sửa file `.env`; cấu hình mẫu nằm ở `.env.example`.
- Dev/Docker runtime dùng PostgreSQL trên Supabase; chạy Compose với env file Supabase trước khi mở app.
- Docker production nhận `POSTGRES_HOST=supabase-db` và `POSTGRES_PORT=5432` trên network `supabase_default`.
- Nếu chưa cấu hình `GEMINI_API_KEY` hoặc Gemini key cá nhân, `/api/gemini/models` trả `503` với mã `GEMINI_API_KEY_MISSING`; đây là trạng thái cấu hình có chủ ý, không phải lỗi PostgreSQL.
- Khi truy cập domain qua reverse proxy, proxy phải hỗ trợ HTTP Upgrade/WebSocket để HMR hoạt động.
- `clearNotifications` phải xóa cả local state và các document tương ứng trên cloud; không dùng backfill request cũ vì sẽ làm notification đã xóa xuất hiện lại.
- Backup JSON, restore và `uploadToPostgres` phải bao gồm collection `notifications`, chuẩn hóa legacy records và xóa cloud records không còn trong backup.
- Backup JSON có thêm `activityLogs`; backup chủ động tải toàn bộ log qua cursor, restore chỉ merge theo id và không xóa lịch sử hiện có; CLI importer dùng `DO NOTHING` cho id activity log trùng.
- Không thêm `activityLogs` vào generic `/api/db/:collection` whitelist để tránh mở PUT/DELETE; chỉ route activity chuyên dụng được phép append/query.
- Không dùng lại port `5432` trên host cho project vì có dịch vụ khác; port public của database project là `15432`.
- Docker Desktop phải đang chạy và Docker Engine phải cho phép CLI truy cập trước khi dùng `docker compose`.

## Cập nhật 2026-09-02 — Tìm kiếm catalog PCN không dấu

- Các catalog dài trong PCN dùng chung `components/PcnCatalogCombobox.tsx`: tìm kiếm theo nhiều token, không phân biệt hoa thường và không phân biệt dấu tiếng Việt; nhãn hiển thị vẫn giữ nguyên tiếng Việt có dấu.
- Chuẩn hóa tìm kiếm tập trung tại `utils/pcnSearch.ts`, bao gồm quy đổi `Đ/đ` và Unicode NFD; mỗi token phải khớp ít nhất một trường searchable của option.
- Đã áp dụng cho khách hàng, hồ sơ, nguồn soạn thảo, lô/tuyến mẫu, PYC, người dùng/phân công, người ký và model Gemini. Enum ngắn vẫn dùng native select; không dùng `datalist` cho PCN.
- Regression: UI contract **28/28 pass**, search behavior **3/3 pass**, PCN suite **617/617 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` pass.

## Cập nhật 2026-08-26 — Chuyển mã hóa ITDC cũ sang cột ITD

- Đã cập nhật `design.md`: `itdEncodeNumber` là cột đích; dữ liệu từ `atdEncodeNumber` được copy nguyên chuỗi, giữ nguyên tiền tố `ITDC`, không đổi thành `ITD`; không ghi đè khi ITD đã có giá trị khác; hỗ trợ dry-run/idempotent và chỉ xóa nguồn sau khi đối soát.
- Đã thêm `utils/itdcToItdMigration.ts` để lập kế hoạch/chuyển từng record, giữ nguyên record khi có conflict.
- Đã thêm script `scripts/migrateItdcToItd.ts` và npm command `npm run migrate:itdc-to-itd`; mặc định dry-run, `--apply` chạy transaction và có kiểm tra giá trị nguồn chống cập nhật đồng thời.
- Đã tích hợp chuẩn hóa tại biên `addRequest`/`addRequests` trong `store.ts` để dữ liệu tạo mới không tiếp tục ghi riêng mã legacy.
- Migration production đã chạy thành công: **108** bản ghi chuyển, **0** conflict; hậu kiểm `requests`: `itdItdc=108`, `legacyAtd=0`. Dry-run lần sau trả `scanned=0`.
- Regression test mới: `test/itdc-to-itd-migration.test.ts` (**6/6 pass**). Verification cuối: `npm test` **351/351 pass**, `npm run lint` pass, `npm run build` pass, `git diff --check` pass. Build chỉ còn cảnh báo chunk lớn hiện hữu.

## Cập nhật 2026-08-25 — Hoàn tất Bulk Upload KQTN, Storage PDF và cảnh báo footer

- Bulk Upload PDF ghép đã chuyển sang luồng PaddleOCR footer-first dùng chung `tvci_ocr_service`: upload nguồn một lần, tạo footer job bất đồng bộ, polling tiến độ và chỉ OCR trang ứng viên/trang đầu nhóm cần nhận diện. Bulk mapping không phụ thuộc Gemini; nếu PaddleOCR không đủ metadata hoặc lỗi thì giữ trạng thái rà soát/chọn mẫu thủ công, không gọi Gemini tự động.
- Với file scan 116 trang đã xác nhận mapping đúng 6 nhóm: `1132-26-M02` trang 1–20, `M03` 21–39, `M04` 40–59, `M05` 60–78, `M06` 79–96 và `M07` 97–116. Các trang kết quả/phụ lục lặp không còn bị nâng thành nhóm thừa.
- Mapping mẫu đích dùng combobox tìm kiếm/lọc; candidate chưa có KQTN vẫn chọn được và hiển thị cảnh báo. Khi upload, hệ thống tạo bản ghi KQTN tối thiểu nếu cần; mẫu đã có PDF sẽ hỏi xác nhận ghi đè. Ô trang bắt đầu/kết thúc giữ được giá trị rỗng tạm thời khi người dùng đang edit.
- Footer OCR có `current/total` được đối chiếu với số trang thực tế. Nếu lệch, UI báo cảnh báo nhưng vẫn cho phép tách và lưu theo mốc/mapping người dùng đã rà soát; chỉ khoảng trang không hợp lệ mới chặn.
- Sửa lỗi lưu PDF production: Compose mặc định dùng `http://supabase-storage:5000` và map cả `SUPABASE_SERVICE_ROLE_KEY` lẫn alias `SERVICE_ROLE_KEY` từ env Supabase bên ngoài; không ghi secret vào repository. Giới hạn hiện tại là 25 MiB cho PDF đơn/PDF con, 100 MiB cho PDF nguồn ghép và chưa có giới hạn cứng số trang.
- Production Docker `ddt_webapp-webapp-1` đã rebuild/recreate trên cổng `2359`. Health app/DB trả HTTP 200; storage smoke upload/delete trả HTTP 200; bucket duplicate trả `statusCode=409` đúng contract.
- Verification cuối: `npm test` **311/311 pass**, `npm run lint` pass, `npm run build` pass (chỉ còn cảnh báo chunk >500 kB), `git diff --check` exit 0.
- Attachment ảnh người dùng và mọi secret/env thật không đưa vào commit.

## Cập nhật 2026-08-25 — Bulk mapping không chặn bởi Gemini

- Docker logs xác nhận footer job PaddleOCR hoàn tất `116/116` trang, nhưng mapping production cũ vẫn gọi Gemini và nhận `400 API key not valid`; đây là lỗi cấu hình Gemini, không phải lỗi Storage/PaddleOCR.
- `components/KqtnBulkPdfUploadModal.tsx` đã bỏ fallback Gemini khỏi cả PDF đơn và PDF ghép. Matching dùng PaddleOCR trang đầu + tên file; khi không có metadata, UI xóa đề xuất không chắc chắn và yêu cầu người dùng chọn qua combobox tìm kiếm.
- `design.md` đã cập nhật quy tắc Bulk Upload: Gemini là tùy chọn cho luồng khác, không phải dependency của bulk; lỗi/thiếu key không được chặn tách hoặc mapping thủ công.
- Verification sau thay đổi: `npm test` **312/312 pass**, `npm run lint` (tsc) pass, `npm run build` pass, `git diff --check` pass. Build chỉ còn cảnh báo chunk lớn hiện hữu.
- Image production cần rebuild sau commit mới; không đưa `dist` sinh tự động, `.env` hoặc attachment vào commit.

## Cập nhật 2026-09-03 — Commit và rebuild production PGDCN

- Commit đã tạo trên nhánh `master`: `e7ebaa6` — `feat: complete PGDCN QC20 governance and PGD document workflow`.
- Nội dung commit gồm code/schema/UI PGDCN, QC20 governance trong PCN, PGD template/cell/document workflow, template PGD-BM-01..09, test, `design.md` và memory/obs. Không commit `dist` sinh tự động, backup `.bak`, attachment, `tmp` hoặc kế hoạch nội bộ.
- Verification trước commit: `npm test` **678/678 pass**, `npm run lint` (tsc noEmit) pass, `npm run build` pass, `git diff --cached --check` pass.
- Docker Desktop production đã rebuild/recreate bằng `docker compose -f docker-compose.pcn.yml up --build -d`. Image `pcn_webapp-webapp:latest` digest `sha256:ccdd19d462bcc801b0990988f276fd3861b836fe1f184d20cb1cc7d4ad981e25`; container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`.
- Smoke test sau deploy: `/api/health`, `/pgdcn`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200; production Next build hoàn tất và container khởi động thành công.
- Full maintenance suite vẫn có **1140/1145 pass**; 5 lỗi còn lại thuộc contract historical attachment/source-discovery bị loại khỏi active runner theo nguyên tắc không import hồ sơ lịch sử, không ảnh hưởng active PCN/PGD.

## Cập nhật 2026-09-03 — PGD source-form pack BM-GĐ-07.21/BM-QT-09-04

- Rà soát read-only folder PGD xác nhận hai biểu mẫu vận hành cần tách rõ: `BM-GĐ-07.21` (Biên bản vụ giám định) và `BM-QT-09-04` (Biên bản giao mẫu PTN). Không sửa, xóa, copy hoặc import file nguồn; runtime vẫn không đọc Desktop/UNC.
- PGD đã bổ sung template/cell `INSPECTION_MINUTES` (`PGD-BM-14`) và `SAMPLE_HANDOVER` (`PGD-BM-15`), có thông tin lô, chứng từ tham chiếu, kết quả hiện trường, đại diện khách hàng, mã PTN, bên giao/nhận và nhiều dòng mẫu/chỉ tiêu/phương pháp.
- PYC PGD lưu thêm `transportName`; `PgdLabRequest` lưu `laboratoryCode` và snapshot `senderUnit`. Hai template mới được định tuyến vào trạm `FIELD_SAMPLING`, snapshot template/cell/context hash giữ nguyên khi sinh tài liệu.
- Gói DOCX `templates/pgd` và `manifest.json` đã tái sinh phiên bản `1.2`; header dùng đúng tên **Phòng Giám định - Chứng nhận**.
- Kiểm chứng mới nhất: `npm test` **665/665**, `npm run lint`, `npm run build` và `git diff --check` pass; BM-14/BM-15 render sạch một trang.
- Đã commit phần source-form/cell/document workflow tại `27f63a8` (`feat: complete PGD source forms and document workflow`); các file `dist` sinh tự động, backup, attachment, `tmp` và kế hoạch nội bộ vẫn được giữ ngoài commit.
- Docker Desktop production đã rebuild/recreate từ tree sau commit. Image `pcn_webapp-webapp:latest` digest `sha256:3e81a6aa36adb1528828d184e4f1ac520a3e6996eccff478ad8bf0059e416c5c`; container `pcn_webapp-webapp` đang `Up`, publish `0.0.0.0:2357->2357/tcp`.
- Smoke test sau rebuild: `/api/health`, `/pgdcn/pcn`, `/pgdcn/pgd` đều HTTP 200; PostgreSQL kết nối và schema khởi tạo thành công. Cảnh báo backup tự động còn lại do Supabase Storage chưa cấu hình.

## Files quan trọng

- `server.ts`: Express API, PostgreSQL routes, HMR integration và Gemini endpoints.
- `utils/db.ts`: PostgreSQL pool/schema initialization.
- `utils/postgresApi.ts`: browser REST adapter cho PostgreSQL.
- `utils/firebase.ts`: compatibility layer cũ, hiện chuyển qua PostgreSQL REST.
- `utils/gemini.ts`: browser helpers cho AI extraction.
- `utils/geminiCredentials.ts`: resolve API key và thông báo thiếu key.
- `docker-compose.yml`: PostgreSQL và webapp ports/healthcheck.
- `vite.config.ts`: dev port `1359`, allowlist hostname và Vite plugins.
- `design.md`: source of truth về kiến trúc/UI/schema.
- `utils/notificationEvents.ts`: audience filtering, event builders, identity resolution và merge helpers.
- `utils/notificationNavigation.ts`: mapping notification metadata tới màn hình nghiệp vụ.
- `utils/notificationBackup.ts`: backup payload và legacy notification normalization.
- `utils/pcnSearch.ts`: chuẩn hóa và lọc catalog PCN theo truy vấn tiếng Việt không dấu.
- `utils/activityLog.ts`: ActivityLog builder, diff/redaction, action/entity labels và access policy.
- `utils/activityLogApi.ts`: REST client append, batch restore, cursor pagination và explicit backup export.
- `components/ActivityLogView.tsx`: trang lọc/phân trang/chi tiết/CSV cho Nhật ký hệ thống.
- `utils/activityLogKpi.ts` và `utils/activityLogTime.ts`: chọn KPI/chart segments và format thời gian cố định GMT+7.
- `docs/superpowers/specs/2026-08-18-system-activity-log-design.md`: đặc tả audit log đã duyệt.
- `docs/superpowers/plans/2026-08-18-system-activity-log.md`: implementation plan và checkpoint TDD.
- `docs/superpowers/specs/2026-08-17-business-notifications-design.md`: đặc tả notification nghiệp vụ.
- `docs/superpowers/plans/2026-08-17-business-notifications-plan.md`: kế hoạch triển khai và verification.

## Trạng thái Git và tích hợp

- Workspace `E:\CODING\DDT_webapp` hiện là Git checkout trên nhánh `master`; có thể tạo commit local. Remote/push chưa được yêu cầu trong lượt này.

<!-- --- End of PROJECT_MEMORY.md --- -->
