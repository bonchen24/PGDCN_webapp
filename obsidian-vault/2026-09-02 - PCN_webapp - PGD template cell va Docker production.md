<!--
Author: Codex
OS support: Windows / Node / Docker Desktop
Description: PGD template/cell module and verified PCN/PGD production deployment
-->

# PCN_webapp — PGD template, cell và Docker production — 2026-09-02

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
- Các điểm chính trong code: `components/PcnDraftingWorkspaceView.tsx`, `components/PcnWorkspace.tsx`, `components/PgdDocumentGenerationPanel.tsx`, `components/PgdWorkspace.tsx`, `components/PgdcnSystemSettingsView.tsx`, `components/PgdcnAppShell.tsx`, `utils/pgdDocumentTemplates.ts`, `utils/pgdDocumentGeneration.ts`, `server.ts`.
- `design.md` đã được cập nhật tại §0.3, §0A.4 và §0A.6–0A.7 để phản ánh quyền sở hữu cài đặt theo phòng và hợp đồng DOCX/placeholder.

### Kiểm chứng và lưu ý

- 25/25 test liên quan đạt, `next build` đạt và `git diff --check` đạt.
- Full suite ghi nhận 1097 test, trong đó 6 lỗi thuộc các vùng lịch sử/ngoài phạm vi của task. Visual render DOCX chưa thực hiện được vì máy thiếu LibreOffice/`soffice`; kiểm tra cấu trúc OOXML, manifest, placeholder và generation đã đạt.
- Typecheck độc lập hiện bị ảnh hưởng bởi nhóm notification PGDCN chưa hoàn chỉnh đang có trong workspace; nhóm này không thuộc thay đổi template.

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
