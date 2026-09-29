# BÁO CÁO BÀN GIAO (HANDOFF REPORT) — SUBAGENT EXPLORER 3
**Phân hệ phụ trách**: Sổ KQTN (Kết quả thử nghiệm) & Admin / Cài đặt  
**Thư mục làm việc**: `e:\CODING\PGDCN_webapp\.agents\teamwork\explorer_kqtn_admin`  
**Parent Orchestrator ID**: `92df2c9d-db73-4bf8-8a0e-f0ad87a92c30`  
**Thời điểm bàn giao**: 2026-09-28T21:51:30+07:00  
**Tài liệu xuất**: `audit_findings.md` (chứa bảng chi tiết 16 phát hiện)

---

## 1. OBSERVATION (Quan sát thực tế)
- **Mã nguồn KQTN**:
  - `components/ReportGeneratorView.tsx` và `components/KQTNView.tsx` không còn tồn tại trên filesystem (đã bị xóa hoàn toàn ở commit `7ce4aaa0bc64cc4b022d0606aa84a700a3eb9aef`).
  - Giao diện KQTN hiện hành chỉ gồm `components/PcnResultReturnView.tsx` (tiếp nhận bản scan KQTN, kết quả Đạt/Không đạt/Đang chờ, số báo cáo) và `components/PgdResultsStationPanel.tsx` (đánh giá KQTN Phù hợp / Không phù hợp).
  - Không có Data Grid KQTN 17 cột, không có thanh KPI nhanh KQTN, không có tính năng tùy biến cột KQTN (`Column Resizing`, bật/tắt cột), không có xuất Excel/CSV cho KQTN.
  - `components/PcnResultDetailModal.tsx` không có cấu trúc 4 Tabs như quy định tại Mục 4.5.
  - `components/PcnOcrPanel.tsx` chỉ xử lý đơn tệp (`processFile(file)`), không hỗ trợ `nameplatePhotos: string[]` và OCR tổng hợp đa tem nhãn.
- **Admin & Cài đặt**:
  - `utils/backupApi.ts` định nghĩa đầy đủ 6 API (`fetchBackups`, `runBackup`, `verifyBackup`, `downloadBackup`, `restoreBackup`, `deleteBackup`), nhưng không có bất kỳ component frontend nào import hoặc sử dụng file này (`backupApi.ts` là code mồ côi). `PcnSettingsView.tsx` và `PgdcnSystemSettingsView.tsx` không có UI Sao lưu & Khôi phục.
  - `components/PcnUserManagementView.tsx` dòng 85-87, 89-92: `managementRoleName` trả về `"Không giữ chức danh quản lý"` khi code là `'NONE'`; `professionalRoleNames` trả về `"Chưa gán vai trò chuyên môn"` khi rỗng, khiến badge/text hiển thị câu chữ phủ định lặp lại, dead-code dòng render `—` (dòng 497, 526).
  - `components/PcnUserManagementView.tsx` (dòng 235, 250), `components/PcnSettingsView.tsx` (dòng 73, 76), `components/PgdcnDossierTemplateManagementView.tsx` (dòng 111, 180) vẫn dùng `window.confirm` và `window.prompt` native.
  - `components/PcnUserManagementView.tsx` và `components/PcnCustomersManagementView.tsx` render toàn bộ danh sách, không có điều khiển phân trang.
  - `components/PcnCustomersManagementView.tsx` sử dụng token màu tím `indigo-*` thay vì `emerald-*` của PCN.
  - Không có giao diện quản lý danh mục Sản phẩm (`products`) và Nhãn hiệu (`brands`).
- **Trạng thái tương tác & Responsive**:
  - `components/PcnOcrPanel.tsx` dòng 63-70: `useEffect` lắng nghe `paste` không có dependency array `[]`.
  - `components/ActivityLogView.tsx` dòng 265: Dùng class `pgdcn-toolbar-nowrap` trên mobile khiến các select lọc bị ép hàng ngang.
  - `components/ActivityLogView.tsx` dòng 381-417: Modal chi tiết log thiếu xử lý phím `Escape` và focus trap.

---

## 2. LOGIC CHAIN (Chuỗi suy luận logic)
1. Từ quan sát mã nguồn KQTN đối chiếu với Mục 4.4 và 4.5 của `design.md`:
   - `design.md` Mục 4.4 & 4.5 mô tả chi tiết Trình tạo báo cáo KQTN 17 tiêu chuẩn, form nhập Điều 22.11/22.12/30, bảng công suất nhiễu 1 hàng và Cell-Grid Data Table 17 cột.
   - Tuy nhiên, trong đợt refactor loại bỏ DDT legacy runtime (commit 7ce4aaa), toàn bộ `ReportGeneratorView.tsx` và `KQTNView.tsx` đã bị xoá.
   - Do đó: Tồn tại mâu thuẫn trực tiếp giữa Single Source of Truth (`design.md`) và mã nguồn thực tế. Cần người dùng làm rõ: (a) Cập nhật lại `design.md` loại bỏ/chuyển đổi các mục KQTN DDT cũ sang quy trình tiếp nhận KQTN hiện tại; hoặc (b) Tái lập phân hệ Sổ KQTN Data Grid và ReportGeneratorView trên kiến trúc Next.js App Router mới.
2. Từ quan sát Admin & Cài đặt:
   - Mục 7.6 quy định chi tiết module Backup & Restore trên shell PCN cho Admin (danh sách archive, checkpoint, xác nhận chuỗi `KHOIPHUC`, retention max 3 archive/2GiB). Backend API và client helper `utils/backupApi.ts` đã có nhưng UI bị bỏ quên hoàn toàn. Suy luận: Đây là tính năng còn thiếu (missing feature) cần được bổ sung vào `PgdcnSystemSettingsView` hoặc `PcnSettingsView`.
   - Mục 5A.34 quy định dùng `—` cho các vị trí không phân công trong bảng nhân sự. Nhưng code `types.ts` định nghĩa option `{ code: 'NONE', name: 'Không giữ chức danh quản lý' }` và code component fallback về chuỗi này, dẫn đến render badge phủ định thay vì `—`.
   - Sử dụng `window.prompt` và `window.confirm` vi phạm trực tiếp các tiêu chuẩn UI/UX hiện đại, không đáp ứng chuẩn trợ năng WCAG và responsive trên mobile/PWA.

---

## 3. CAVEATS (Vùng giới hạn & Giả định)
- **Giới hạn phạm vi**: Explorer 3 chỉ thực hiện phân tích tĩnh (read-only code review) các phân hệ Sổ KQTN và Admin/Settings, không thực thi sửa đổi mã nguồn (tuân thủ nghiêm ngặt R4).
- **Giả định về kiến trúc KQTN**: Giả định rằng việc xóa `KQTNView.tsx` và `ReportGeneratorView.tsx` ở commit 7ce4aaa là có chủ đích trong đợt dọn dẹp DDT runtime, nhưng việc chưa cập nhật Mục 4.4 và 4.5 của `design.md` là lỗi thiếu sót về tài liệu đồng bộ. Nếu TVCI thực tế vẫn cần chức năng lập báo cáo KQTN nội bộ, đây sẽ là một khối lượng công việc phát triển mới đáng kể.
- **Môi trường DB/Server**: Không can thiệp DB trực tiếp hay chạy thao tác khôi phục database trong quá trình kiểm tra API backup.

---

## 4. CONCLUSION (Kết luận & Đề xuất hành động)
- Đã hoàn thành 100% rà soát kỹ thuật mã nguồn Sổ KQTN và Admin / Cài đặt, đối chiếu chặt chẽ từng điều khoản trong `design.md`.
- Phát hiện tổng cộng **16 vấn đề** được lập bảng chi tiết trong `audit_findings.md`:
  - **3 vấn đề mức độ High**: Mâu thuẫn kiến trúc Sổ KQTN Data Grid; mâu thuẫn kiến trúc ReportGeneratorView 17 chuẩn; thiếu hoàn toàn giao diện Sao lưu & Khôi phục (Backup & Restore UI).
  - **10 vấn đề mức độ Medium**: Modal chi tiết KQTN thiếu tabs; Badge Tokens định danh KQTN chưa chuẩn; thiếu Đa tem nhãn động và OCR tổng hợp; vi phạm câu chữ phủ định lặp lại tại bảng nhân sự; dùng native dialog prompt/confirm; thiếu phân trang bảng Nhân sự & Khách hàng; thiếu quản lý Danh mục Sản phẩm & Nhãn hiệu; responsive bộ lọc nhật ký; rò rỉ paste listener trong OCR.
  - **3 vấn đề mức độ Low**: Hardcoded token `indigo` tại Khách hàng; hitbox nút xóa và aria-label thiếu tại Khách hàng; phím Escape và focus trap cho modal chi tiết nhật ký.
- **Hành động tiếp theo kiến nghị cho Orchestrator**: Trình báo cáo tổng hợp cho người dùng phê duyệt phương án xử lý mâu thuẫn kiến trúc KQTN trước khi phân bổ task thực thi code.

---

## 5. VERIFICATION METHOD (Phương pháp kiểm chứng độc lập)
1. **Kiểm chứng sự thiếu hụt KQTN Grid & ReportGeneratorView**:
   - Chạy lệnh kiểm tra file: `Test-Path components/KQTNView.tsx`, `Test-Path components/ReportGeneratorView.tsx` (kết quả: `False`).
   - Kiểm tra commit xoá: `git log -n 1 --stat -- "**/ReportGeneratorView*"` (xác nhận xoá 1770 dòng tại commit `7ce4aaa`).
2. **Kiểm chứng file mồ côi `utils/backupApi.ts`**:
   - Chạy tìm kiếm import: `git grep "backupApi" components/ app/` (kết quả: không có file frontend nào import).
3. **Kiểm chứng vi phạm Mục 5A.34 tại bảng nhân sự**:
   - Mở `components/PcnUserManagementView.tsx` tại dòng 86 và 460-498 để xác nhận `managementRoleName('NONE')` trả về `"Không giữ chức danh quản lý"` và render thành badge thay vì dấu `—`.
4. **Kiểm chứng native prompt/confirm**:
   - Chạy: `git grep -n "window\.prompt\|window\.confirm" components/` để xác nhận các vị trí vi phạm tại dòng 235, 250 của `PcnUserManagementView.tsx` và dòng 73, 76 của `PcnSettingsView.tsx`.
