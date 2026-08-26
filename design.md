<!--
Author: Gemini
OS support: Web/Node
Description: File thiết kế chi tiết kiến trúc, dữ liệu, Frontend UI/UX, quy chuẩn thiết kế Card phiếu yêu cầu, Card mẫu thử và chuẩn tuân thủ cho DDT Lab Web App
-->

# DESIGN DOCUMENTATION - DDT LAB WEB APP UPGRADE
## (Hệ Thống Quản Lý Thử Nghiệm, Kho Mẫu & Điều Phối Lịch Tự Động - Phòng Điện - Điện Tử)

---

## 📄 MỤC LỤC
1. [TỔNG QUAN DỰ ÁN & TRIẾT LÝ THIẾT KẾ FRONTEND](#1-tổng-quan-dự-án--triết-lý-thiết-kế-frontend)
2. [HỆ THỐNG MÀU SẮC & DESIGN TOKENS](#2-hệ-thống-màu-sắc--design-tokens)
3. [CHI TIẾT THIẾT KẾ CÁC CARD THÀNH PHẦN (CARD COMPONENTS)](#3-chi-tiết-thiết-kế-các-card-thành-phần-card-components)
   - 3.1. [Card Phiếu Yêu Cầu (Request Card)](#31-card-phiếu-yêu-cầu-request-card)
   - 3.2. [Card Mẫu Thử / Kho Mẫu (Sample Inventory Card)](#32-card-mẫu-thử--kho-mẫu-sample-inventory-card)
   - 3.3. [Card Lịch Thử Nghiệm (Schedule Item Card)](#33-card-lịch-thử-nghiệm-schedule-item-card)
   - 3.4. [Card Biên Bản Giao Nhận (Handover Doc Card)](#34-card-biên-bản-giao-nhận-handover-doc-card)
   - 3.5. [Card Nhật Ký Tổng Hợp (Summary Log Card)](#35-card-nhật-ký-tổng-hợp-summary-log-card)
4. [CỬA SỔ NỔI & FORM INTERACTIVE (MODAL DESIGN)](#4-cửa-sổ-nổi--form-interactive-modal-design)
   - 4.1. [RequestModal (Tạo/Sửa Phiếu & AI OCR)](#41-requestmodal-tạosửa-phiếu--ai-ocr)
   - 4.2. [TestExecutionModal (Nhập KQTN & AI Extract)](#42-testexecutionmodal-nhập-kqtn--ai-extract)
   - 4.3. [HandoverModal & PrintFormModal](#43-handovermodal--printformmodal)
   - 4.4. [ReportGeneratorView & KQTN Management](#44-reportgeneratorview--kqtn-management-trình-tạo-báo-cáo-thử-nghiệm--quản-lý-kqtn)
   - 4.5. [Phân Hệ Sổ Kết Quả Thử Nghiệm](#45-phân-hệ-sổ-kết-quả-thử-nghiệm-kqtn-redesign--modern-data-grid-architecture)
   - 4.6. [DocxSettingsModal & Quản Lý Biểu Mẫu DOCX Template](#46-docxsettingsmodal--quản-lý-biểu-mẫu-docx-template)
5. [CẤU TRÚC LAYOUT TỔNG THỂ & BẢNG ĐIỀU HƯỚNG](#5-cấu-trúc-layout-tổng-thể--bảng-điều-hướng)
   - 5.2. [Tỷ lệ hiển thị giao diện toàn cục](#52-tỷ-lệ-hiển-thị-giao-diện-toàn-cục)
   - 5.3. [Chuẩn responsive cho mobile](#53-chuẩn-responsive-cho-mobile)
6. [MÔ HÌNH DỮ LIỆU & SCHEMA (DATA MODELS & TYPES)](#6-mô-hình-dữ-liệu--schema-data-models--types)
7. [CƠ CHẾ BẢO MẬT, PHÂN QUYỀN & LƯU TRỮ](#7-cơ-chế-bảo-mật-phân-quyền--lưu-trữ)
   - 7.1. [Phân quyền Người dùng](#71-phân-quyền-người-dùng-rbac-matrix)
   - 7.2. [Lưu trữ dữ liệu Đa tầng](#72-lưu-trữ-dữ-liệu-đa-tầng-multi-tier-persistence)
   - 7.3. [Hợp đồng REST API & triển khai Docker](#73-hợp-đồng-rest-api--triển-khai-docker)
   - 7.4. [Hệ thống Thông báo & Hoạt động Nghiệp vụ](#74-hệ-thống-thông-báo--hoạt-động-nghiệp-vụ-business-notification-system)
   - 7.5. [Bảo toàn dữ liệu khi quản trị người dùng](#75-nguyên-tắc-bảo-toàn-dữ-liệu-nghiệp-vụ-khi-quản-trị-người-dùng-data-integrity--user-lifecycle-isolation)
   - 7.6. [Sao lưu & khôi phục dữ liệu](#76-chuẩn-hóa-sao-lưu--khôi-phục-dữ-liệu-toàn-diện-backup--restore-specification)
8. [QUY CHUẨN MÃ NGUỒN VÀ TUÂN THỦ (CODE CONVENTIONS)](#8-quy-chuẩn-mã-nguồn-và-tuân-thủ-code-conventions)

---

## 1. TỔNG QUAN DỰ ÁN & TRIẾT LÝ THIẾT KẾ FRONTEND

**DDT Lab Web App Upgrade** là ứng dụng Web Single Page Application (SPA) cao cấp được xây dựng để phục vụ công tác quản lý, theo dõi kho mẫu vật lý và điều phối lịch thử nghiệm tự động tại **Phòng Điện - Điện tử (Trung tâm Thử nghiệm - Kiểm định Công nghiệp)**.

### 🎨 Triết lý thiết kế Frontend:
1. **Giao diện Phòng Thử Nghiệm Hiện Đại (Industrial Laboratory Precision)**:
   - Sử dụng nền sáng chủ đạo (`bg-slate-50` / `bg-white`) tạo cảm giác sạch sẽ, tin cậy và có độ tương phản cao.
   - Loại bỏ các hiệu ứng trang trí dư thừa, tập trung vào khả năng hiển thị thông tin kỹ thuật rõ ràng, chính xác.
2. **Cấu trúc Thẻ Thông Minh (Card-Driven Dashboard)**:
   - Mọi thực thể nghiệp vụ (Phiếu yêu cầu, Mẫu thử, Biên bản, Lịch thử nghiệm) đều được đóng gói thành các **Card** tự chứa thông tin, có phân cấp thị giác rõ ràng qua Badge, Mã màu và Typography.
3. **Phản hồi Trực quan & Cảnh báo Nổi bật**:
   - Trạng thái quá hạn, mẫu tồn kho lâu hoặc ưu tiên khẩn cấp (`URGENT`) được cảnh báo bằng hiệu ứng nhấp nháy đỏ (`animate-pulse border-red-500 bg-red-50`).
4. **Trải nghiệm Tương tác Mượt mà**:
   - Tích hợp Kéo - Thả (`@dnd-kit`) cho xếp lịch và sắp xếp thứ tự ưu tiên.
   - Tải file thả thả trực tiếp (Drag-and-Drop Zone) hỗ trợ AI bóc tách tài liệu tức thì.

---

## 2. HỆ THỐNG MÀU SẮC & DESIGN TOKENS

### 🎨 2.1. Bảng màu Nền & Khung (Base Palette)
- **Primary Canvas**: `bg-slate-50` (`#f8fafc`)
- **Card Background**: `bg-white` (`#ffffff`)
- **Border Neutral**: `border-slate-200` (`#e2e8f0`)
- **Header Accent**: `bg-slate-900` (`#0f172a`) / `text-slate-900`

### 🏷️ 2.2. Hệ thống Badge Trạng Thái Phiếu (Request Status Tokens)
| Trạng thái (`RequestStatus`) | Giá trị hiển thị | Mã Tailwind Badge |
| :--- | :--- | :--- |
| `PENDING` | Chờ duyệt | `bg-amber-100 text-amber-800 border-amber-300` |
| `APPROVED` | Đã chấp nhận | `bg-blue-100 text-blue-800 border-blue-300` |
| `SAMPLES_RECEIVED` | Đã nhận mẫu | `bg-cyan-100 text-cyan-800 border-cyan-300` |
| `SCHEDULED` | Đã xếp lịch | `bg-indigo-100 text-indigo-800 border-indigo-300` |
| `TESTING` | Đang thử nghiệm | `bg-purple-100 text-purple-800 border-purple-300 animate-pulse` |
| `RESULTS_SUBMITTED` | Chờ duyệt KQTN | `bg-orange-100 text-orange-800 border-orange-300` |
| `RESULTS_APPROVED` | Đã duyệt KQ | `bg-emerald-100 text-emerald-800 border-emerald-300` |
| `COMPLETED` | Hoàn thành | `bg-teal-100 text-teal-800 border-teal-300` |
| `CANCELLED` | Đã hủy | `bg-rose-100 text-rose-800 border-rose-300` |
| `REQ_SUPPLEMENT` | Cần bổ sung | `bg-red-100 text-red-800 border-red-300` |

### 📦 2.3. Hệ thống Badge Kho Mẫu (Sample Status Tokens)
- **Chờ nhận mẫu** (`WAITING`): `bg-amber-50 text-amber-700 border-amber-200` (Biểu tượng: `Clock`)
- **Mẫu trong kho** (`IN_LAB`): `bg-emerald-50 text-emerald-700 border-emerald-200` (Biểu tượng: `PackageCheck`)
- **Đã trả khách** (`RETURNED`): `bg-slate-100 text-slate-600 border-slate-200` (Biểu tượng: `Truck`)

### 👨‍🔬 2.4. Mã màu Kỹ thuật viên (Tester Badge Tokens)
- `Tester 1`: `bg-blue-600 text-white`
- `Tester 2`: `bg-emerald-600 text-white`
- `Tester 3`: `bg-violet-600 text-white`
- `Tester 4`: `bg-amber-600 text-white`
- `Tester 5`: `bg-rose-600 text-white`
- `Tester 6`: `bg-cyan-600 text-white`
- `Tester 7`: `bg-indigo-600 text-white`
- `Tester 8`: `bg-teal-600 text-white`

---

## 3. CHI TIẾT THIẾT KẾ CÁC CARD THÀNH PHẦN (CARD COMPONENTS)

### 3.1. Card Phiếu Yêu Cầu (Request Card)
Card Phiếu Yêu Cầu là thành phần giao diện trung tâm hiển thị thông tin tổng quan của từng hồ sơ thử nghiệm trong danh sách.

```
+----------------------------------------------------------------------------------+
| [MÃ PYC: DDT-2026-001]                  [TRẠNG THÁI: Đang thử nghiệm] [VIP ⭐]   |
| Khách hàng: Công ty TNHH Điện Lạnh Việt Nam                                      |
+----------------------------------------------------------------------------------+
| Tên Mẫu: Tủ Lạnh Inverter 450L          Hãng: Panasonic                           |
| Chủng loại: Tủ Lạnh                     Số lượng: 02 Bộ                            |
| Mã hóa ATD: ITDC-2026-001               Mã hóa EMC: EMC-2026-001                  |
| Tem niêm phong: IEMM-8891, IEMM-8892                                             |
+----------------------------------------------------------------------------------+
| 📅 Dự kiến: 22/07/2026 - 25/07/2026 | 👤 KTV: Nguyễn Văn A | 📍 Buồng: Chamber 1   |
+----------------------------------------------------------------------------------+
| [ Xem chi tiết ]  [ Sửa ]  [ Xếp lịch ]  [ In phiếu ]  [ Nhập KQ ]  [ Xóa ]       |
+----------------------------------------------------------------------------------+
```

#### Cấu trúc thành phần (Anatomy):
1. **Header Card**:
   - Góc trái: Số Phiếu Yêu Cầu (`requestCode`) in đậm (`font-bold text-slate-900 font-mono`).
   - Góc phải: Badge Trạng thái phiếu + Badge Mức ưu tiên (`PriorityLevel`: NORMAL, HIGH, VIP, URGENT).
   - Nếu `priority === URGENT`: Card hiển thị viền đỏ nhấp nháy `ring-2 ring-red-500 animate-pulse`.
2. **Body Card**:
   - Tên Khách hàng (`customerName`), Tên sản phẩm (`modelName`), Hãng sản xuất (`brand`).
   - Khối Mã Hóa (`encodeNumber`, `atdEncodeNumber`, `emcEncodeNumber`): Được tạo kiểu khung chữ nhật bo góc nhỏ, font monospace `font-mono bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-xs`.
   - Danh sách Tem niêm phong (`sealStamp`).
3. **Sub-Footer / Thông tin Xếp lịch**:
   - Ngày nhận mẫu & Ngày dự kiến trả kết quả.
   - Badge đại diện KTV phụ trách (`testerName`) có màu định danh riêng.
   - Buồng thử nghiệm chỉ định (`chamberId`: Chamber 1 / Chamber 2).
4. **Action Toolbar (Thanh thao tác)**:
    - Các nút biểu tượng hành động nhanh: `Xem chi tiết` (Eye), `Chỉnh sửa` (Pencil), `Xếp lịch` (Calendar), `In BMGN/PYC` (Printer), `Nhập/Duyệt kết quả` (FileCheck), `Xóa` (Trash2).
    - Icon nhận diện chính trong card dùng kích thước compact khoảng `14px`; chevron điều khiển dùng khoảng `10px`. Vùng chạm mobile có thể lớn hơn icon theo chuẩn accessibility nhưng không được làm icon thị giác phình to.
    - Trong danh sách Phiếu YC trên mobile, các action `Sửa/In/Giao nhận/Xóa` dùng ô màu hiển thị khoảng `28x28px`, được neo ở góc phải phía trên của card; lớp nút bên ngoài vẫn giữ vùng chạm khoảng `44px` và không được đổi handler, tooltip hoặc phân quyền nghiệp vụ. Từ breakpoint `md`, toolbar trở lại luồng bố cục desktop và không giữ khoảng đệm dành riêng cho toolbar mobile.

---

### 3.2. Card Mẫu Thử / Kho Mẫu (Sample Inventory Card)
Nằm ở thanh Sidebar Kho Mẫu Vật Lý (`WarehouseSidebar.tsx`), hiển thị trạng thái thực tế của mẫu vật trong phòng lab.

```
+-------------------------------------------------------------+
| 📦 [ITDC-2026-088]                     [ Mẫu trong kho ]    |
| Tủ Lạnh Toshiba GR-RS600                                    |
| Vị trí: Kệ A2 - Buồng EMC                                  |
| ⏱️ Tồn kho: 4 ngày (Nhận ngày 18/07/2026)                  |
| [ Chờ nhận ]  -->  [ Mẫu trong kho ]  -->  [ Đã trả khách ] |
+-------------------------------------------------------------+
```

#### Cấu trúc thành phần:
1. **Header**: Mã mã hóa mẫu vật (`encodeNumber` / `itdEncodeNumber` / `emcEncodeNumber`) hiển thị dạng monospace nổi bật + Badge Trạng thái kho.
2. **Body**: Tên mẫu thử, Chủng loại, Vị trí lưu kho vật lý (`sampleLocation`).
3. **Indicator Tồn Kho**:
   - Tính toán số ngày mẫu nằm trong kho từ `receivedDate`.
   - Nếu thời gian tồn kho > 10 ngày mà chưa trả khách: Cảnh báo chữ đỏ `text-rose-600 font-medium` kèm icon `AlertTriangle`.
4. **Interactive Status Switcher**:
   - Nhóm 3 nút bấm dạng Tab Pill chuyển đổi trạng thái mẫu nhanh chóng 1-Click: `Chờ nhận` -> `Mẫu trong kho` -> `Đã trả khách`.

---

### 3.3. Card Lịch Thử Nghiệm (Schedule Item Card)
Hiển thị trong giao diện Bảng Lịch An Toàn Điện (`ATDView`) và Bảng Lịch EMC (`EMCView` - Chamber 1 & Chamber 2).

```
+-----------------------------------------------------------------------+
| ⣿ [ITDC-001] Condi Air Panasonic Inverter                             |
| 🕒 Thử nghiệm: 24 Phút (3 ngày) | 📍 Chamber 1                          |
| 👤 KTV: Lê Văn B                                                       |
| [======================== Tiến độ: 60% ========================]      |
+-----------------------------------------------------------------------+
```

#### Cấu trúc thành phần:
1. **Grip Handle (Nút cầm kéo thả)**: Biểu tượng 6 chấm `GripVertical` phục vụ kéo thả sắp xếp lại thứ tự ưu tiên thử nghiệm (`@dnd-kit`).
2. **Thông tin kỹ thuật**: Mã hóa mẫu thử, Tên thiết bị, Định mức phút thử nghiệm (`testTimeATD` / `testTimeEMC`).
3. **Phân bổ KTV & Buồng**: Tag tên KTV phụ trách tô màu tương ứng, chỉ số Buồng thử (`Chamber 1` / `Chamber 2`).
4. **Thanh Tiến độ Thử nghiệm (Progress Bar)**:
   - Thể hiện tỷ lệ phần trăm thời gian thử nghiệm đã trôi qua so với tổng thời gian dự kiến.
5. **Tính năng Tìm kiếm & Định vị Mẫu khớp trên Lịch**:
   - Hỗ trợ lọc đa điều kiện ở Sidebar Lịch thử: Ô tìm kiếm từ khóa, Lọc theo Khách hàng (`selectedCustomer`) và Lọc theo Thương hiệu (`selectedBrand`).
   - Khi bấm chọn mẫu từ danh sách "Mẫu khớp trên lịch", hệ thống tự động chuyển lịch về tuần/tháng chứa mẫu đó, tự động cuộn tới vị trí mẫu (`scrollIntoView`) và bật hiệu ứng Highlight viền nổi bật (`ring-4 ring-rose-500 scale-[1.04] animate-pulse`).

---

### 3.4. Card Biên Bản Giao Nhận (Handover Doc Card)
Hiển thị trong Modal Quản lý Biên Bản Giao Nhận (`HandoverDocsModal.tsx`).

```
+-----------------------------------------------------------------------+
| 📄 [BMGN-2026/07-005]                     [ Loại: Trả mẫu ]            |
| Khách hàng: Công ty Cổ phần Cơ Điện Lạnh Á Châu                       |
| Người giao: Nguyễn Văn X | Đại diện nhận: Trần Văn Y                  |
| Phương tiện/Biển số: 29C-123.45                                       |
| 📦 Danh sách mẫu: 03 Mẫu (ITDC-001, ITDC-002, EMC-005)                |
| [ Tải file Word (.docx) ]               [ Xem chi tiết ]              |
+-----------------------------------------------------------------------+
```

#### Cấu trúc thành phần:
1. **Header**: Số BMGN (`docNumber`) + Tag phân loại (`Nhận mẫu` - Màu Xanh dương / `Trả mẫu` - Màu Cam).
2. **Body**: Đơn vị khách hàng, Đại diện hai bên, Thông tin xe / Tài xế vận chuyển.
3. **Mẫu đính kèm**: Chip danh sách các mã hóa mẫu thử được bàn giao trong đợt.
4. **Action**: Nút xuất file Word tự động điền mẫu `GiaoNhanMau.docx` bằng thư viện `docxtemplater`.

---

### 3.5. Card Nhật Ký Tổng Hợp (Summary Log Card)
Hiển thị trong Màn hình Nhật Ký Hoạt Động & Sổ Tổng Hợp (`SummaryLogView.tsx`), dạng bảng dữ liệu tổng hợp đa cột (ngày yêu cầu, mã phiếu, khách hàng, model, nhãn hiệu, số lượng, tem niêm phong, phân loại, loại sản phẩm, chỉ tiêu thử nghiệm, số lô ITD/EMC/ITDC, trạng thái, người thử nghiệm,...) và timeline nhật ký hoạt động.

```
+-----------------------------------------------------------------------+
| 🕒 14:30 - 21/07/2026 | 👤 Admin (Hùng)                              |
| ⚡ [CẬP NHẬT KẾT QUẢ]: Phiếu DDT-2026-012 -> Đã duyệt kết quả TN      |
| 📝 Chi tiết: Công suất đo: 1200W, CSPF: 4.85 (Đạt Cấp 5 Sao)          |
+-----------------------------------------------------------------------+
```

---

## 4. CỬA SỔ NỔI & FORM INTERACTIVE (MODAL DESIGN)

### 4.1. RequestModal (Tạo/Sửa Phiếu & AI OCR)
- **Vùng Upload AI Droppable**:
  - Drag & Drop zone hỗ trợ file `.pdf`, `.docx`, `.png`, `.jpg`.
  - Tự động gọi API `/api/gemini/extract-requests` để trích xuất thông tin Khách hàng, Sản phẩm, Mã tem niêm phong và điền tự động vào Form.
- **Form Chia Cụm Thông Minh**:
  - Cụm 1: Thông tin Khách hàng & Hóa đơn tài chính.
  - Cụm 2: Thông tin Mẫu thử & Tiêu chuẩn áp dụng (TCVN / IEC).
  - Cụm 3: Mã hóa mẫu tự động (ITDC, ITD, EMC) & Tem niêm phong.
- **Khởi động theo vai trò Khách**:
  - Khi tài khoản có role `guest` đăng nhập, `RequestModal` tự động mở đúng một lần trong phiên đăng nhập đó.
  - Việc đóng modal không tự động mở lại; nút `Tạo Phiếu` vẫn cho phép mở modal thủ công.
- **Nhập liệu có thể xóa trắng**:
  - Các trường input trong `RequestModal` phải giữ được giá trị rỗng tạm thời trong lúc người dùng chỉnh sửa, không tự động ghi đè bằng giá trị mặc định ngay khi ô phát sinh chuỗi rỗng.
  - Giá trị mặc định/tự động của số lượng, số bản kết quả, số lần Fail, MTT, đơn vị tính và tem niêm phong chỉ được áp dụng khi khởi tạo mẫu hoặc chuẩn hóa lúc thêm/lưu phiếu.
- **Quy tắc tem niêm phong theo bên phát hành**:
  - Chỉ tem có tiền tố `IEMM` (không phân biệt hoa/thường, sau khi bỏ khoảng trắng đầu chuỗi) mới dùng cơ chế tự sinh hậu tố `M01`, `M02`... theo thứ tự mẫu.
  - Tem của các bên khác được nhập và lưu theo free style; hệ thống không tự nối hậu tố, không chuẩn hóa cấu trúc mã và khi sửa phiếu phải giữ nguyên mã riêng của từng mẫu.

### 4.2. TestExecutionModal (Nhập KQTN & AI Extract)
- **Cụm thông số đo đạc**: Công suất làm lạnh, Công suất tiêu thụ điện, Chỉ số hiệu suất năng lượng (CSPF), Cấp sao năng lượng (1-5 sao).
- **Trình tải Báo cáo Thử nghiệm**: Cho phép tải file báo cáo thử nghiệm để AI tự bóc tách các chỉ số đo đạc thực tế.
- **Quy trình Phê duyệt 2 Bước**:
  - KTV nhấn "Gửi duyệt" -> Trạng thái: `RESULTS_SUBMITTED`.
  - Admin xem xét -> Nhấn "Phê duyệt" (`RESULTS_APPROVED`) hoặc "Cần bổ sung" (`REQ_SUPPLEMENT`).

### 4.3. HandoverModal & PrintFormModal
- **HandoverModal**: Giao diện chọn nhanh danh sách mẫu nhận/trả bằng Checkbox list, tự động lọc mẫu đang có trong kho.
- **PrintFormModal**: Canvas xem trước trang in khổ A4 và nút In trực tiếp hoặc Tải xuống file Word chuẩn biểu mẫu.

### 4.4. ReportGeneratorView & KQTN Management (Trình tạo Báo cáo Thử nghiệm & Quản lý KQTN)
- **Bộ chọn Module Chuẩn Báo cáo (Compact Report Grid)**:
  - Danh sách 17 chuẩn/mẫu báo cáo được hiển thị dưới dạng grid responsive, ưu tiên hiển thị trọn trong một viewport desktop thông dụng và giảm tối đa nhu cầu cuộn danh sách.
  - Kích thước card và icon thu gọn theo breakpoint nhưng vẫn giữ vùng tương tác tối thiểu phù hợp cho thao tác chuột và cảm ứng; tên chuẩn được phép xuống dòng để không cắt mất nội dung.
  - Các lựa chọn nghiệp vụ đặc biệt (đầy đủ/giảm thiểu chỉ tiêu, nhóm EMC có biến thể) giữ nguyên hành vi hiện tại trong `ReportGeneratorView`; không thay đổi luồng nhập liệu, lưu KQTN hoặc xuất DOCX.
- **Typography Form Nhập liệu (Compact Report Form Typography)**:
  - Ba form preview (`EmcBepDien1VungNauForm`, `DefaultStandardForm`, `DayCapDienForm`) dùng scope giao diện riêng để giảm font điều khiển nhập liệu về khoảng `12px`, tiêu đề section về khoảng `14–16px` và giữ nguyên khả năng đọc.
  - Scope typography chỉ áp dụng trong vùng form preview của trang Lập báo cáo; không thay đổi Header, Sidebar, thanh thao tác hoặc định dạng dữ liệu xuất DOCX.

- **Định danh giao diện Báo cáo & KQTN (Report/KQTN Identifier UI)**:
  - Form Thông tin Báo cáo không hiển thị trường nhập `Số (Nº)`; `Số mã hóa` là trường định danh đầu tiên sau tiêu đề form.
  - Bảng và phần chi tiết mặc định của KQTN không hiển thị `Số KQTN`; `Số mã hóa` là định danh đầu tiên sau số thứ tự.
  - Trường dữ liệu `reportNo` vẫn được giữ trong schema, payload lưu trữ, nhật ký và tương thích xuất file; khi tạo báo cáo, giá trị nội bộ này được đồng bộ theo `codingNumber` thay vì yêu cầu nhập riêng.
  - Ngày báo cáo vẫn được dùng cho validation, lưu KQTN và xuất DOCX nhưng không hiển thị thêm chuỗi diễn giải ngày đầy đủ bên dưới ô chọn ngày.
    - **Điều 22.12**:
        + Dòng chính `22.12`: Yêu cầu: *"Tay cầm, nút bấm và các bộ phận tương tự.\nThử nghiệm bằng tay và cố gắng tháo các bộ phận này bằng cách đặt lực hướng trục"*, Kết quả: *"Lực kéo hướng trục: 15N (ít khả năng bị kéo); 30N (nhiều khả năng bị kéo theo hướng trục)\nĐược cố định một cách tin cậy, không bị lỏng khi sử dụng bình thường"*.
    - **Cấu hình bảng phụ (subTables) cho TCVN 5699-2-23 (Máy sấy tóc)**:
      - Loại bỏ cấu hình `subTable: "CLAUSE_22"` và `subTable: "CLAUSE_24"` khỏi Điều 22 và Điều 24 (do các bảng đo nhiệt độ nước chỉ áp dụng cho Bình đun nước nóng TCVN 5699-2-21).
      - Bảng Điều 19 (Hoạt động không bình thường) khởi tạo chính xác các dòng đo không bị trùng lặp hàng đo sàn/vách góc thử nghiệm.
    - Form `hair_dryer` phải hiển thị và cho phép nhập kết quả cho các dòng con của Điều 22.32, Điều 24.2 và Điều 30.2 theo biểu mẫu chuẩn, giữ `displayId` rỗng cho các dòng con không có số điều riêng.
    - Bảng chi tiết Điều 30 phải có thêm nhóm **Thử nghiệm ngọn lửa hình kim** gồm 3 dòng kết quả, với giới hạn lần lượt `≤ 30`, `≤ 30` và `≤ 15` giây; dữ liệu phải được lưu cùng `testResultsData` và truyền qua luồng xuất DOCX hiện tại.
    - Cấu hình `hair_dryer` phải khớp toàn bộ các placeholder đánh giá của template `5699-2-23 placeholder.docx`, bao gồm các dòng con tại Điều 13.1, 22.2, 22.14, 22.32, 22.36, 24.2, 27.1, 27.3, 30.1 và 30.2.
    - Với các module TCVN khác có cặp template đầy đủ/rút gọn, cấu hình clause phải khớp các placeholder đánh giá `{eval_*}` của DOCX tương ứng; các dòng con trong template phải được khai báo thành trường nhập liệu riêng, giữ `displayId` rỗng khi không có số điều riêng.

- **Chuẩn hóa Định dạng & Phân tách Cột Bảng KQTN (KQTN Table Column Standardization)**:
  - Tách bạch rõ ràng 4 trường dữ liệu độc lập, chuẩn hóa tên gọi nghiệp vụ:
    1. **Số phiếu YC** (`requestCode`): Số phiếu yêu cầu thử nghiệm ban đầu (thường có định dạng `DDT-...`), hiển thị định dạng `font-medium text-slate-600` hoặc mã badge xám/lam nhạt.
    2. **Số KQTN** (`reportNo`): Số kết quả thử / Số giấy KQTN (thường mang mã `ITD...`, `EMC...`, `ITDC...`), giữ để tương thích dữ liệu nhưng không hiển thị trong giao diện mặc định.
    3. **Số mã hóa** (`sampleCode` / `codingNumber`): Mã hóa phân bổ mẫu thử phòng lab (dạng `01-ITD-26`, `01-EMC-26`, `01-ITDC-26`), hiển thị Badge Token chuẩn `font-black font-mono text-[10px] uppercase bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded border border-emerald-200/50`.
    4. **Tem niêm phong** (`sealStamp`): Mã tem niêm phong vật lý. **Quy chuẩn nhận diện toàn diện:** Mọi chuỗi ký tự có tiền tố `IEMM` dưới bất kỳ định dạng nào (như `IEMM....`, `IEMM/...`, `IEMM-...`, `IEMM.26/...`, `IEMM xxxx`) đều được hệ thống và AI nhận diện là **Số tem niêm phong (`sealStamp`)**. Hiển thị Badge Token chuẩn `font-mono bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200/50 font-bold`, hoặc `Chưa niêm phong` nếu trống.
  - Trường nhập `sealStamp` hỗ trợ danh sách chọn nhanh nhưng vẫn cho phép nhập thủ công. Danh sách gợi ý chuẩn gồm: `IEMM.00/HQA/0000.0A-SP-M00`, `IEMM.00/HQA/0000.1A-SP`, `TĐC-0000-00`, `TTP-0000-00`, `VIC/00.HQ/0000/00-00`.
  - Tự động điền chính xác khi chọn mẫu từ danh sách PYC (`SelectSampleModal`):
    - `requestCode`: gán theo số phiếu yêu cầu dạng `DDT-...` (`req.requestCode`).
    - `reportNo` (Số KQTN): gán mặc định theo số mã hóa `ITD...` / `EMC...` / `ITDC...` (hoặc `req.requestCode` nếu chưa có mã hóa).
    - `codingNumber`: gán theo số mã hóa `encodeNum`.
    - `sealStamp`: gán theo `req.sealStamp` (mọi mã có tiền tố `IEMM...`).
  - **Đầy đủ dòng nhập liệu cho mẫu TCVN 5699-2**:
    - **Quy chuẩn Điều 22.11 và 22.12 cho các mẫu đầy đủ chỉ tiêu TCVN 5699-2**:
      - **Điều 22.11**: Chia tách thành 3 dòng:
        + Dòng chính `22.11`: Yêu cầu: *"Các bộ phận không tháo rời được, dùng để bảo vệ chống chạm bộ phận mang điện"*, Kết quả: *"Được cố định chắc chắn và chịu được ứng suất cơ học xuất hiện trong sử dụng bình thường"*.
        + Dòng con `22.11_1` (`displayId: ""`): Yêu cầu: *"Thử nghiệm lực đẩy và kéo với bộ phận nhiều khả năng phải tháo ra cho dù chúng được cố định bằng vít, đinh tán hay chi tiết tương tự"*, Kết quả: *"Lực đẩy: 50N\nLực kéo: 50N (bộ phận không thể trượt ngón tay); 30N (bộ phận nhô ra <10mm)"*.
        + Dòng con `22.11_2` (`displayId: ""`): Yêu cầu: *"Thử nghiệm momen xoắn với bộ phận có thể phải chịu lực xoắn đồng thời với lực kéo và lực đẩy (nếu chỗ nhô ra của bộ phận nắm vào được <10mm thì momen giảm đi 50%)"*, Kết quả: *"2Nm (kích thước ≤ 50mm)\n4Nm (kích thước >50mm)\nCác bộ phận vẫn ở vị trí khóa và không rời ra"*.
      - **Điều 22.12**:
        + Dòng chính `22.12`: Yêu cầu: *"Tay cầm, nút bấm và các bộ phận tương tự.\nThử nghiệm bằng tay và cố gắng tháo các bộ phận này bằng cách đặt lực hướng trục"*, Kết quả: *"Lực kéo hướng trục: 15N (ít khả năng bị kéo); 30N (nhiều khả năng bị kéo theo hướng trục)\nĐược cố định một cách tin cậy, không bị lỏng khi sử dụng bình thường"*.
    - Form `hair_dryer` phải hiển thị và cho phép nhập kết quả cho các dòng con của Điều 22.32, Điều 24.2 và Điều 30.2 theo biểu mẫu chuẩn, giữ `displayId` rỗng cho các dòng con không có số điều riêng.
    - Bảng chi tiết Điều 30 phải có thêm nhóm **Thử nghiệm ngọn lửa hình kim** gồm 3 dòng kết quả, với giới hạn lần lượt `≤ 30`, `≤ 30` và `≤ 15` giây; dữ liệu phải được lưu cùng `testResultsData` và truyền qua luồng xuất DOCX hiện tại.
    - Cấu hình `hair_dryer` phải khớp toàn bộ các placeholder đánh giá của template `5699-2-23 placeholder.docx`, bao gồm các dòng con tại Điều 13.1, 22.2, 22.14, 22.32, 22.36, 24.2, 27.1, 27.3, 30.1 và 30.2.
    - Với các module TCVN khác có cặp template đầy đủ/rút gọn, cấu hình clause phải khớp các placeholder đánh giá `{eval_*}` của DOCX tương ứng; các dòng con trong template phải được khai báo thành trường nhập liệu riêng, giữ `displayId` rỗng khi không có số điều riêng.

- **Thông tin Báo cáo (Report Metadata Sidebar)**:
  - Cho phép chọn mẫu từ danh sách PYC (`SelectSampleModal`) để tự động điền các trường: Số mã hóa, Tem niêm phong (`sealStamp`), Tên mẫu, Model, Nhãn hiệu, Đơn vị gửi mẫu, Địa chỉ, Ngày nhận mẫu, Ngày thử nghiệm (`testDate` lấy từ lịch trình thử nghiệm trên DB `scheduledDate`/`endDate` hoặc `result.testDate`), Người thử nghiệm; `reportNo` nội bộ được đồng bộ theo số mã hóa.
  - **Trường Ký duyệt Báo cáo (Người thử nghiệm & Phụ trách PTN)**:
    - Bố trí 2 trường nhập liệu ký duyệt gồm: **Người thử nghiệm** (`testerName` ứng với `{testerName}`) và **Phụ trách phòng TN** (`managerName` ứng với `{managerName}`/`{managerNam}`) cạnh nhau trên cùng một hàng (grid 2 cột trên desktop/tablet).
    - Trường **Phụ trách phòng TN** chỉ nhận diện và hiển thị trong droplist các nhân sự giữ chức danh **Trưởng phòng hoặc Phó trưởng phòng** (mặc định gồm: **Vũ Việt Anh** và **Lương Xuân Hùng**).
    - Trường **Người thử nghiệm** tích hợp `<datalist>` gợi ý danh sách nhân sự từ cấu hình `testers` để KTV chọn nhanh hoặc nhập tự do.
  - **Trường Ngày thử nghiệm thống nhất (Unified Test Date Field)**:
    - Thay thế giao diện 2 ô ngày riêng biệt (bắt đầu - kết thúc) bằng **1 trường nhập liệu chung** duy nhất (`Ngày thử nghiệm`), hỗ trợ hiển thị và nhập linh hoạt cả ngày đơn (`14/08/2026`) lẫn dải ngày (`10/08/2026 – 14/08/2026`).
    - Đối với các thử nghiệm EMC (và các loại thử nghiệm khác), khi kỹ thuật viên bấm **"Chọn mẫu"**, hệ thống tự động trích xuất ngày thử nghiệm đã lưu trên DB (từ `scheduledDate`, `endDate`, hoặc `result.testDate`), chuyển đổi định dạng chuẩn `DD/MM/YYYY` (hoặc `DD/MM/YYYY – DD/MM/YYYY`) và tự động điền vào trường `Ngày thử nghiệm`.
  - Cho phép người dùng chỉnh sửa trực tiếp trường "Tem niêm phong" và "Ngày thử nghiệm" trên giao diện cột thông tin báo cáo.
  - Xuất file `.docx` báo cáo tự động truyền đầy đủ `sealStamp`, `{testDate}`, `{testerName}`, `{managerName}` (và alias `{managerNam}`) vào dữ liệu template biểu mẫu Word.
  - Trường ngày tiếng Anh trong báo cáo phải dùng tên tháng đầy đủ theo mẫu `August 18, 2026`; không được xuất ngày tháng dạng số ở phần tiếng Anh. Phần tiếng Việt tiếp tục giữ định dạng hành chính hiện tại.
  - Khi không có giá trị ngày hợp lệ, không tự suy diễn ngày; giữ dữ liệu trống để người dùng xử lý.
  - Lưu trữ và phiên bản hóa Kết quả thử nghiệm (`KQTNRecord`) bao gồm các trường `sealStamp`, `testDate`, `testerName` và `managerName`.
- **Đầy đủ dòng nhập liệu cho mẫu TCVN 5699-2-23**:
  - Form `hair_dryer` phải hiển thị và cho phép nhập kết quả cho các dòng con của Điều 22.32, Điều 24.2 và Điều 30.2 theo biểu mẫu chuẩn, giữ `displayId` rỗng cho các dòng con không có số điều riêng.
  - Bảng chi tiết Điều 30 phải có thêm nhóm **Thử nghiệm ngọn lửa hình kim** gồm 3 dòng kết quả, với giới hạn lần lượt `≤ 30`, `≤ 30` và `≤ 15` giây; dữ liệu phải được lưu cùng `testResultsData` và truyền qua luồng xuất DOCX hiện tại.
  - Cấu hình `hair_dryer` phải khớp toàn bộ các placeholder đánh giá của template `5699-2-23 placeholder.docx`, bao gồm các dòng con tại Điều 13.1, 22.2, 22.14, 22.32, 22.36, 24.2, 27.1, 27.3, 30.1 và 30.2.
  - Với các module TCVN khác có cặp template đầy đủ/rút gọn, cấu hình clause phải khớp các placeholder đánh giá `{eval_*}` của DOCX tương ứng; các dòng con trong template phải được khai báo thành trường nhập liệu riêng, giữ `displayId` rỗng khi không có số điều riêng.
  - Với các module EMC và dây cáp điện, mọi placeholder dữ liệu dạng scalar, bảng, ảnh và trường kết quả trong DOCX phải có nguồn từ form/state tương ứng và được kiểm tra hồi quy trước khi phát hành báo cáo.
  - **Quy chuẩn Bảng Công suất nhiễu EMC (Phần 6 / `TablePowerDisturbance` / `tablePower*`)**:
    - Áp dụng chung cho tất cả các mẫu báo cáo EMC (Bếp từ, Điều hòa, Máy giặt, Máy hút bụi, Máy sấy tóc, Máy khoan, v.v.):
    - Bảng kết quả công suất nhiễu chỉ hiển thị và sử dụng **duy nhất 1 hàng**.
    - Khi tải dữ liệu từ file Radimation hoặc khi dán dữ liệu (paste): nếu dữ liệu có từ 2 hàng trở lên, hệ thống **tự động chỉ lấy hàng 1** và bỏ các hàng thừa.
    - Khi xuất báo cáo Word DOCX, hệ thống luôn đảm bảo bảng công suất nhiễu chỉ render tối đa 1 hàng kết quả.
  - **Cấu hình EMC Máy khoan (`emc_may_khoan`) Phần 6 (Công suất nhiễu)**:
    - Hiển thị đầy đủ 2 bài đo công suất nhiễu cho 2 chiều quay của máy khoan:
      1. **6.3.1. Thử nghiệm khi EUT quay cùng chiều kim đồng hồ (Testing when EUT rotate clockwise)**: Dòng con `6.3.1.1. Kết quả công suất nhiễu của dây dẫn nguồn (Result of Main line disturbance power)` (ảnh `powerDisturbance` mapping `image_6_3_1_1`, bảng `tablePower` mapping `table_6_3_1_1`).
      2. **6.3.2. Thử nghiệm khi EUT quay ngược chiều kim đồng hồ (Testing when EUT rotate counterclockwise)**: Dòng con `6.3.2.1. Kết quả công suất nhiễu của dây dẫn nguồn (Result of Main line disturbance power)` (ảnh `powerDisturbance_2` mapping `image_6_3_2_1`, bảng `tablePower_2` mapping `table_6_3_2_1`).
    - Biểu mẫu Word `maykhoan placeholder.docx` đồng bộ đầy đủ cả 2 mục 6.3.1.1 và 6.3.2.1 tương ứng.

- **Cơ chế Quản lý Đa Tem Nhãn Linh Hoạt & AI OCR Tổng Hợp (Dynamic Multi-nameplate & Batch OCR)**:
  - **Quản lý Đa Tem Nhãn Động cho tất cả thiết bị**:
    - Áp dụng cho mọi chủng loại thiết bị (Tủ lạnh, Điều hòa không khí, Bếp từ, Bình đun, Quạt điện, Dây cáp điện, v.v.).
    - Giao diện danh sách tem động (`nameplatePhotos: string[]`): Mặc định hiển thị 2 ô tem cơ bản (Tem 1, Tem 2) và cho phép bấm nút **"+ Thêm ảnh tem nhãn"** để mở rộng linh hoạt (Tem 3, Tem 4...) cho các thiết bị nhiều tem nhãn (như Tủ lạnh có tem thông số + tem sơ đồ điện + tem máy nén/block + tem niêm phong; Điều hòa có dàn lạnh + dàn nóng + cụm nguồn).
    - Mỗi ô tem hỗ trợ đầy đủ công cụ: Cắt/xoay ảnh (`CropperModal`), Xóa ảnh, Kéo thả/Dán ảnh (`paste`/`drag-and-drop`), và Chạy OCR độc lập cho từng tem.
  - **AI OCR Tổng hợp Toàn diện (Multi-image Prompting & Fusion)**:
    - Nút **"OCR Tổng Hợp Tất Cả Tem Nhãn"**: Gửi đồng thời toàn bộ danh sách ảnh tem đã tải lên đến AI Gemini.
    - AI tự động trích xuất và hợp nhất: Model tổng, cụm thành phần (`indoorModel`, `outdoorModel`, `compressorModel`), nhãn hiệu (`brand`), mã số tem niêm phong (`sealStamp`), nhà sản xuất (`manufacturer`), nước sản xuất (`countryOfOrigin`/`origin`), công suất danh nghĩa (`power`), điện áp danh nghĩa (`voltage`), dòng điện danh nghĩa (`current`), tần số danh nghĩa (`frequency`), tần số xung nhịp lớn nhất (`clockFreq`), môi chất lạnh và xuất xứ.
    - Sau khi OCR, các trường kỹ thuật nêu trên và nhà sản xuất/nước sản xuất phải được điền vào form báo cáo; nếu tem không có thông tin thì giá trị hiển thị và giá trị xuất DOCX là `N/A`.
  - **Đối soát Tem Niêm Phong (`sealStamp`)**:
    - Tự động đối chiếu mã số tem niêm phong đọc từ ảnh tem với phiếu yêu cầu; hiển thị badge cảnh báo khác biệt nếu có sai lệch để KTV xác nhận.
  - **Lưu trữ & Báo cáo Word (`.docx`)**:
    - `KQTNRecord` lưu trữ đầy đủ `nameplatePhotos` (đồng thời giữ `nameplatePhoto1`, `nameplatePhoto2` để tương thích ngược).
    - Bộ tạo báo cáo Word tự động truyền toàn bộ ảnh tem vào file `.docx`.
    - Mapping dữ liệu phải dùng `sealStamp` cho nhãn Tem niêm phong. Các template cũ còn placeholder `{codingNumber}` tại vị trí nhãn Tem niêm phong được xử lý bằng alias tương thích ở lớp xuất DOCX, không được lấy số mã hóa làm giá trị tem.
    - Khi xuất DOCX, toàn bộ ảnh tem động `label`, `label2`, `label3`, ... phải được giữ đúng thứ tự, ghép cạnh nhau thành một ảnh ngang duy nhất và chỉ mapping vào placeholder `anh_1`. Ảnh mẫu và ảnh thiết lập EMC tiếp tục mapping vào các vị trí kế tiếp theo thứ tự của template; không được phân tán các ảnh tem sang `anh_2`, `anh_3`, ... .

- **Kiểm tra nhất quán hồ sơ trước khi lưu/xuất (Report Consistency Validation)**:
  - Khi người dùng chọn một PYC, hệ thống giữ dữ liệu PYC làm nguồn đối chiếu cho `requestDate`, `requestCode`, Model, nhãn hiệu, số mã hóa, tem niêm phong và thông số kỹ thuật nếu có.
  - Chuỗi thời gian bắt buộc tuân theo thứ tự: `Ngày phiếu yêu cầu <= Ngày nhận mẫu <= Ngày thử nghiệm bắt đầu <= Ngày thử nghiệm kết thúc <= Ngày báo cáo`. Ngày thử nghiệm được hỗ trợ dạng một ngày hoặc một khoảng ngày; chuỗi ngày sai định dạng hoặc sai thứ tự là lỗi chặn thao tác.
  - Model, nhãn hiệu, số mã hóa và tem niêm phong trên báo cáo phải khớp dữ liệu PYC sau khi chuẩn hóa chữ hoa/thường, dấu tiếng Việt và ký tự phân cách. Mọi sai khác là lỗi chặn thao tác.
  - Nếu có dữ liệu OCR từ tem nhãn, hệ thống đối chiếu Model, nhãn hiệu, tem niêm phong và các giá trị kỹ thuật đã đọc với dữ liệu báo cáo/PYC. Nếu PYC có trường `specifications`, các giá trị kỹ thuật OCR hoặc form EMC chỉ được chấp nhận khi xuất hiện trong chuỗi thông số của PYC; sai khác là lỗi chặn thao tác.
  - Trường bắt buộc chưa nhập hoặc chưa đủ dữ liệu để đối chiếu chỉ hiển thị cảnh báo không chặn; các sai lệch do không trùng khớp với thông tin trên PYC (Model, nhãn hiệu, số mã hóa, tem niêm phong, thông số PYC/OCR) cũng chỉ hiển thị cảnh báo và vẫn cho phép lưu/xuất DOCX.
  - Chỉ lỗi dữ liệu không hợp lệ của form, như ngày sai định dạng hoặc sai thứ tự thời gian, mới chặn thao tác. Khi bị chặn, khu vực nút thao tác phải hiển thị rõ các trường/vị trí cần xử lý; dữ liệu kết quả chi tiết (`testResultsData`, `emcData`, `dayCapDienData`) phải được lưu cùng `KQTNRecord` để phục vụ kiểm tra và phiên bản hóa.

### 4.5. Phân Hệ Sổ Kết Quả Thử Nghiệm (KQTN Redesign & Modern Data Grid Architecture)
- **Kiến trúc Bảng Lưới Chuyên Nghiệp (Professional Cell-Grid Data Table)**:
  - Header & Toolbar tinh gọn, tối ưu không gian làm việc với thanh thống kê chỉ số nhanh (Tổng bản ghi, Đã xuất BC, Phiên bản cập nhật).
  - Tìm kiếm đa năng tức thời: Lọc trên toàn bộ các trường `requestCode`, `reportNo`, `sampleCode`, `sealStamp`, `sampleName`, `model`, `brand`, `senderUnit`, `testerName`.
  - Hệ thống bộ lọc chuyên sâu: Lọc theo Tiêu chuẩn (`standardTitle`), Người thử nghiệm (`testerName`), Loại thử nghiệm (`criteriaType`: Đầy đủ / Rút gọn), Phiên bản.
  - Phân trang chuẩn quốc tế: 20 / 50 / 100 / Tất cả, kèm điều hướng nhảy trang và hiển thị số lượng bản ghi thực tế.
- **Tùy Biến Cột Cá Nhân Hóa (Column Customization & Persistence)**:
  - Bật/tắt hiển thị từng cột dữ liệu, kéo/sắp xếp thứ tự cột, thay đổi độ rộng cột (`Column Resizing`) với bộ chỉ báo ký tự cột kiểu bảng tính (A, B, C...).
  - Lưu trạng thái tùy biến cột theo tài khoản người dùng (`localStorage` + Cloud Sync).
- **Bộ Trường Dữ Liệu Chuẩn Hóa Của Bản Ghi KQTN**:
  1. `stt`: Số thứ tự dòng.
  2. `requestCode`: Số phiếu YC (dạng `DDT-...`).
  3. `reportNo`: Số KQTN / Số kết quả thử (dạng `ITD...`, `EMC...`, `ITDC...`).
  4. `sampleCode`: Số mã hóa phân bổ mẫu phòng lab (dạng `01-ITD-26`, `01-EMC-26`...).
  5. `sealStamp`: Tem niêm phong (nhận diện mọi tiền tố `IEMM...`).
  6. `version`: Phiên bản bản ghi (`v1`, `v2`...).
  7. `sampleName`: Tên mẫu thử nghiệm.
  8. `model`: Ký hiệu kiểu / Model.
  9. `brand`: Nhãn hiệu / Thương hiệu sản phẩm.
  10. `senderUnit`: Đơn vị gửi mẫu / Khách hàng.
  11. `standardTitle`: Tiêu chuẩn thử nghiệm áp dụng.
  12. `criteriaType`: Loại thử nghiệm (Đầy đủ / Rút gọn).
  13. `testDate`: Ngày thử nghiệm (hỗ trợ ngày đơn và dải ngày).
  14. `reportDate`: Ngày lập báo cáo.
  15. `testerName`: Kỹ thuật viên thử nghiệm.
  16. `updatedAt`: Thời điểm cập nhật cuối.
  17. `updatedBy`: Người thực hiện cập nhật.
- **Hệ Thống Thao Tác & Quản Lý Phiên Bản (Action Controls & Version History)**:
  - **Modal Chi tiết Đa tầng (Tabbed Detail Modal)**:
    - Tab 1: Tổng quan mẫu thử & Đối soát mã phiếu/tem niêm phong.
    - Tab 2: Thông số kỹ thuật & Tem nhãn OCR.
    - Tab 3: Dữ liệu đo đạc chi tiết (EMC, Dây cáp điện, Thiết bị gia dụng).
    - Tab 4: Lịch sử phiên bản (`Version History`) theo dõi dòng thời gian sửa đổi, người sửa và ghi chú lý do.
  - **Xuất dữ liệu Excel / CSV**: Xuất tức thời theo danh sách cột đang hiển thị và bộ lọc hiện hành.
  - **Xóa bản ghi**: Bảo vệ phân quyền Admin với hộp thoại xác nhận an toàn.

### 4.6. DocxSettingsModal & Quản Lý Biểu Mẫu DOCX Template (Docx Template Management)
- **Mục đích & Vị trí điều hướng**:
  - Nằm trên trang **Lập báo cáo** (`ReportGeneratorView.tsx`), nút **"Cài đặt biểu mẫu"** (icon `Settings`/`FileCog`) được bố trí tại Header thanh điều hướng, cho phép người dùng mở modal quản lý ở cả giao diện Dashboard danh sách chuẩn lẫn form chi tiết tiêu chuẩn.
- **Giao diện Modal Quản lý Biểu mẫu (`DocxSettingsModal.tsx`)**:
  - **Kiến trúc Header & Bộ lọc**:
    - Header modal hiện đại, hiển thị rõ số lượng template đang quản lý trong hệ thống.
    - Ô tìm kiếm tức thời theo Tên tiêu chuẩn (TCVN 5699, QCVN 9, TCVN 6610...), Chủng loại thiết bị (Nồi cơm điện, Lò nướng, Điều hòa, Bếp từ...) hoặc Tên file biểu mẫu (`.docx`).
    - Phân nhóm nhanh bằng thẻ Tab Pill: `Tất cả`, `An toàn điện (TCVN)`, `Tương thích điện từ (EMC)`, `Dây cáp điện`, `Hồ sơ chung (PYC/BMGN)`.
  - **Bảng Danh mục Biểu mẫu (Template Catalog Grid)**:
    - Hiển thị danh mục chi tiết 40+ biểu mẫu chuẩn hóa kèm icon nhận diện thiết bị.
    - Thể hiện rõ tên chuẩn, chủng loại thiết bị, biến thể (Đầy đủ / Giảm thiểu / Số vùng nấu / Có sấy...).
    - Hiển thị tên file `.docx` vật lý, trạng thái file (`Sẵn sàng` / `Chưa có file`), dung lượng (KB/MB) và ngày cập nhật gần nhất.
  - **Hệ Thống Thao Tác Biểu Mẫu**:
    - **Tải về (`Download`)**: Tải trực tiếp file `.docx` hiện tại về máy tính để kiểm tra nội dung hoặc chỉnh sửa cấu trúc placeholder.
    - **Cập nhật File mới (`Upload/Update`)**: Cho phép chọn file từ máy hoặc kéo thả file `.docx` mới để ghi đè cập nhật cho từng module cụ thể; kiểm tra định dạng MIME wordprocessingml/docx hợp lệ trước khi ghi.
    - **Khôi phục File gốc (`Reset/Restore`)**: Cho phép hoàn tác về biểu mẫu gốc mặc định khi cần thiết.
- **Hợp đồng REST API Quản trị Template**:
  - `GET /api/templates`: Danh sách metadata toàn bộ các template biểu mẫu của hệ thống.
  - `GET /api/templates/:filename/download`: Tải file template `.docx` theo tên file.
  - `POST /api/templates/upload`: Tiếp nhận file `.docx` mới qua `multipart/form-data`, lưu an toàn vào `public/` (và `dist/` nếu có) kèm cơ chế sao lưu tự động.
  - `POST /api/templates/:filename/reset`: Khôi phục file `.docx` từ bản lưu gốc.

---

## 5. CẤU TRÚC LAYOUT TỔNG THỂ & BẢNG ĐIỀU HƯỚNG

```
+----------------------------------------------------------------------------------+
| HEADER BAR: Logo TVCI | Tên App | Sync Status Indicator | User Profile | Logout   |
+---------------------+------------------------------------------------------------+
| SIDEBAR NAVIGATION  | MAIN VIEW CONTAINER                                        |
| 📋 Danh sách phiếu  | (Nội dung thay đổi theo Navigation được chọn)             |
| ⚡ Lịch ATD          |                                                            |
| 🧲 Lịch EMC         |                                                            |
| 📦 Kho mẫu vật lý   |                                                            |
| 📄 Biên bản BMGN    |                                                            |
| 📊 Báo cáo nhật ký  |                                                            |
| ⚙️ Cấu hình hệ thống |                                                            |
+---------------------+------------------------------------------------------------+
| FLOATING WIDGETS: 💬 AI ChatBot Drawer (Trợ lý ảo hỗ trợ tra cứu)               |
+----------------------------------------------------------------------------------+
```

Nhật ký đồng bộ và chẩn đoán PostgreSQL không hiển thị thành nút riêng trên Header; người dùng mở chức năng này từ phần Cấu hình hệ thống.

### 5.1. Cài đặt Web App và nhận diện trên Taskbar (PWA Install & Taskbar Identity)

- Ứng dụng phải đáp ứng chuẩn PWA để Chrome tự hiển thị biểu tượng cài đặt trên thanh địa chỉ khi đang chạy tại `localhost` hoặc HTTPS.
- Manifest phải khai báo `id`, `scope`, `start_url`, `display: standalone`, `orientation: portrait`, `theme_color`, `background_color` và các icon PNG hợp lệ ở kích thước `192x192` và `512x512`.
- Icon dùng cho shortcut/taskbar phải giữ nhận diện logo TVCI và khai báo `purpose: any maskable` để hệ điều hành không cắt sai vùng logo khi tạo biểu tượng.
- Service worker `/sw.js` phải được đăng ký khi khởi động ứng dụng; không được chủ động unregister service worker hoặc xóa cache từ `index.html`.
- Global CSS phải được import từ entry Vite `index.tsx`, không thêm link trực tiếp tới `/index.css` trong HTML vì URL này không phải static asset production.
- Nhánh fetch tài nguyên của service worker phải bắt lỗi mạng và trả `Response.error()` để không phát sinh unhandled promise rejection khi dev server hoặc production tạm thời không truy cập được.
- Không hiển thị nút `Cài webapp` trong Header; trình duyệt vẫn được phép tự hiển thị UI cài đặt native trên thanh địa chỉ hoặc menu hệ thống.
- Luồng PWA nền (`beforeinstallprompt`, `appinstalled`) và trạng thái standalone vẫn được giữ để không ảnh hưởng khả năng cài đặt native của trình duyệt.
- Khi chạy ở chế độ standalone, ứng dụng phải yêu cầu khóa hướng màn hình dọc bằng `screen.orientation.lock('portrait')` nếu API được trình duyệt hỗ trợ; lỗi không hỗ trợ phải được bỏ qua an toàn.
- Lỗi đăng ký service worker hoặc trình duyệt không hỗ trợ PWA không được làm gián đoạn việc khởi động và sử dụng dữ liệu nghiệp vụ.

### 5.2. Tỷ lệ hiển thị giao diện toàn cục (Global UI Scale)

- Toàn bộ giao diện web của ứng dụng phải hiển thị ở tỷ lệ **100%** theo kích thước CSS mặc định, bao gồm thanh điều hướng, bảng dữ liệu, card, form và modal.
- Tỷ lệ này được áp dụng tại vùng mount React (`#root`) bằng CSS global; vùng chứa phải giữ `width: 100%` và `min-height: 100%` để không vượt viewport khi `html, body` khóa overflow.
- Nội dung cửa sổ in, biểu mẫu xuất báo cáo và các tài liệu DOCX/PDF không chịu ảnh hưởng bởi tỷ lệ UI này; các quy chuẩn kích thước in giữ nguyên theo từng module.
- Không thay đổi token dữ liệu, kích thước ảnh báo cáo hoặc logic nghiệp vụ chỉ để phục vụ việc thu/phóng giao diện.
- Đây là thay đổi **chỉ dành cho UI/CSS**; không được sửa dữ liệu, API, logic nghiệp vụ, điều hướng hoặc tích hợp hệ thống.

### 5.2.1. Mật độ giao diện compact (Compact UI Density)

- App shell sau đăng nhập dùng scope CSS `ddt-compact` để giảm gap, padding và font theo một bậc thống nhất; nhóm token `gap-3/4/6/8`, `space-y-3/4/6` và `p-3/4/6/8` được thu gọn; `#root` vẫn giữ `zoom: 1`.
- Compact áp dụng cho header, sidebar, toolbar, card, filter và vùng nội dung nghiệp vụ; mục tiêu là tăng lượng thông tin hiển thị mà không làm mất phân cấp thị giác.
- Vùng thao tác mobile vẫn giữ touch target tối thiểu khoảng 44px; không dùng `transform: scale()` hoặc `zoom` để thu nhỏ hitbox.
- `.report-form-compact`, canvas preview, nội dung in và file DOCX/PDF giữ typography/layout riêng, không bị global compact override.
- Header phải hiển thị đúng nhãn theo `activeTab`, bao gồm `Nhật ký hệ thống`; thay đổi compact không làm đổi handler nghiệp vụ, schema, API hoặc format xuất.

### 5.3. Chuẩn responsive cho mobile (Mobile Responsive Standard)

- Audit mobile được thực hiện tuần tự trên các bề rộng viewport 320px, 375px, 390px và 430px; desktop giữ nguyên hành vi và phân cấp thị giác hiện có.
- Trải nghiệm mobile/PWA chỉ hỗ trợ hướng dọc (`orientation: portrait`); nếu thiết bị cảm ứng (`pointer: coarse`) đang nằm ngang, ứng dụng phải khóa thao tác và hướng dẫn người dùng xoay lại màn hình dọc. Không áp dụng lớp khóa này cho cửa sổ desktop hoặc DevTools responsive dùng pointer chuột.
- Shell mobile dùng header gọn, bottom navigation có thể cuộn ngang khi số mục vượt chiều rộng, và vùng nội dung phải chừa khoảng an toàn cho thanh điều hướng cố định cùng `env(safe-area-inset-bottom)`.
- Mọi layout flex/grid phải cho phép phần tử co lại bằng `min-width: 0`; chuỗi nghiệp vụ dài được xuống dòng hoặc truncate có chủ đích, không tạo tràn ngang toàn trang.
- Modal và form trên mobile ưu tiên dạng bottom sheet hoặc khung toàn chiều rộng có chiều cao tối đa theo viewport; header, vùng nội dung và footer thao tác phải cuộn độc lập khi cần.
- Bảng dữ liệu và lịch không được ép chữ quá nhỏ để né tràn; dùng card/stack hoặc vùng cuộn ngang có chỉ báo rõ ràng cho dữ liệu nhiều cột.
- Lịch bật từ các trường ngày trong biểu mẫu báo cáo phải được render ngoài vùng cuộn của form và có lớp hiển thị cao hơn nội dung, để toàn bộ ngày và điều hướng tháng luôn nhìn thấy và chọn được.
- Bảng KQTN trên mobile phải nằm trong vùng flex có `min-height: 0`, cuộn dọc độc lập và giữ chiều rộng nội dung để cuộn ngang; các dòng dữ liệu phải vẫn hiển thị trong viewport nhỏ.
- Vùng thao tác cảm ứng chính giữ kích thước tối thiểu khoảng 44px; icon-only control phải có `aria-label` hoặc `title` phù hợp.
- Nút **Tùy chỉnh nhân sự** trên trang Tổng quan phải mở/đóng danh sách bằng click/tap và có trạng thái truy cập `aria-expanded`; không phụ thuộc riêng vào `hover` để hoạt động trên mobile/PWA.
- Các thay đổi thuộc đợt audit này chỉ được tác động đến CSS, class layout, breakpoint và cách trình bày; không thay đổi schema, dữ liệu, API, logic nghiệp vụ, điều hướng hoặc định dạng xuất báo cáo.

---

## 6. MÔ HÌNH DỮ LIỆU & SCHEMA (DATA MODELS & TYPES)

Toàn bộ Type định nghĩa hệ thống nằm ở file `/types.ts`.

### Các Interface Cốt lõi:
- **`TestRequest`**: Chứa toàn bộ thông tin Phiếu yêu cầu, Mã hóa, Thông số mẫu, Kết quả đo đạc và Lịch thử nghiệm.
- **`HandoverDoc`**: Thông tin Biên bản giao nhận mẫu (Số BMGN, Loại giao/nhận, Danh sách mẫu, Xe vận chuyển).
- **`CustomerRef`**: Danh mục Khách hàng (Tên, Mã số thuế, Địa chỉ, Người liên hệ, Điện thoại).
- **`ProductRef`**: Định mức sản phẩm (Tên loại máy, Định mức phút thử ATD, Định mức phút thử EMC).
- **`Tester`**: Danh sách KTV (Tên, Tên viết tắt, Mã màu Badge, Vị trí).
- **`AppSettings`**: Cấu hình hệ thống (Chế độ làm việc T7/CN, KTV mặc định và sao lưu). Trường `geminiModel` cũ chỉ được giữ để tương thích dữ liệu; không còn là trường chỉnh sửa trong Thiết lập hệ thống.
- **Phạm vi nhân sự trên Tổng quan**: Bảng công việc, KPI và danh sách **Tùy chỉnh nhân sự** chỉ hiển thị các nhân viên thực sự được giao ít nhất một phiếu vào lịch thử nghiệm. Một phân công hợp lệ là phiếu có `scheduledDate` và `testerName` khác rỗng, `Chưa giao` hoặc `Khác`; không dùng các danh sách KTV mặc định (`defaultTesters*`) để đưa nhân sự chưa được giao việc lên Dashboard. Phân công đã hoàn thành vẫn thuộc phạm vi lịch đã từng được giao; nếu không có phân công hợp lệ nào, Dashboard không hiển thị cột/KPI nhân sự.
- **`UserPreferences`**: Cấu hình riêng theo tài khoản, gồm mật khẩu tùy chỉnh, API Key Gemini, mô hình Gemini (`geminiModel`) và ảnh đại diện. Trường `displayName` từ dữ liệu cũ (nếu còn) không được đọc, ghi hoặc dùng để thay đổi danh tính người dùng.

### Quy tắc chuyển cột mã hóa ITDC → ITD
- `itdEncodeNumber` là cột đích chuẩn cho dữ liệu mã hóa An toàn điện/ITD.
- Dữ liệu cũ trong `atdEncodeNumber` được chuyển sang `itdEncodeNumber` nhưng **giữ nguyên toàn bộ chuỗi mã**, bao gồm tiền tố `ITDC`; không tự đổi `ITDC` thành `ITD`.
- Bản ghi chỉ được chuyển tự động khi cột ITD đang trống. Nếu cả hai cột đã có giá trị khác nhau, migration phải giữ nguyên dữ liệu và xuất danh sách cần rà soát, tuyệt đối không ghi đè.
- Migration phải chạy được nhiều lần an toàn, hỗ trợ chế độ dry-run và chỉ xóa giá trị nguồn sau khi bản ghi đã được chuyển thành công và có backup/đối soát.

### Quy tắc định danh người dùng trên giao diện
- `username` / `Tên đăng nhập` là khóa kỹ thuật phục vụ đăng nhập, phân quyền, lưu preference và truy vết nội bộ; không phải tên hiển thị.
- Danh tính người dùng trong giao diện nghiệp vụ phải lấy từ `Họ và Tên` (ánh xạ vào `UserAccount.name`), ưu tiên giá trị này hơn các trường tên tổng quát hoặc bí danh.
- Không hiển thị nickname, `@username` hoặc `displayName` trong sidebar, bộ lọc/chi tiết nhật ký và các thông báo nghiệp vụ. Khi không có họ tên hợp lệ, dùng nhãn trung tính `Người dùng hệ thống`.
- Màn hình đăng nhập và quản trị tài khoản vẫn được phép hiển thị trường `Tên đăng nhập` vì đây là thông tin xác thực/kỹ thuật, không phải danh tính hiển thị.

---

## 7. CƠ CHẾ BẢO MẬT, PHÂN QUYỀN & LƯU TRỮ

### 7.1. Phân quyền Người dùng (RBAC Matrix):
- **Admin**: Full quyền (Tạo/Sửa/Xóa Phiếu, Duyệt KQ, Quản lý Danh mục, Cấu hình hệ thống).
- **Tester**: Quyền Xếp lịch, Cập nhật trạng thái Kho mẫu, Nhập KQTN (Gửi duyệt).
- **Viewer / Guest**: Chỉ xem danh sách và lịch thử nghiệm.
- **Phân quyền riêng tại trang Thiết lập hệ thống**:
  - **Admin** (`role = admin`): được xem và thực hiện toàn bộ thao tác, gồm quản lý tài khoản, reset mật khẩu, backup/restore và ghi dữ liệu backup lên PostgreSQL.
  - **Quản lý** (tài khoản không phải Admin có `position` chứa `Quản lý` hoặc `Trưởng phòng`): được xem trang, chỉnh sửa ngày làm việc và danh sách KTV mặc định, đồng thời mở chẩn đoán đồng bộ; không được quản lý tài khoản, reset mật khẩu, backup/restore hoặc ghi đè dữ liệu PostgreSQL.
  - **Các vai trò khác**: không hiển thị mục Thiết lập hệ thống và chỉ được xem dữ liệu theo RBAC hiện hành.
  - Các giới hạn trên phải được kiểm tra cả ở giao diện và trong Zustand store; không chỉ dựa vào trạng thái disabled của nút.

### 7.2. Lưu trữ dữ liệu Đa tầng (Multi-Tier Persistence):
1. **Local State**: Zustand cho phản hồi tức thì trên UI.
2. **Primary Database**: PostgreSQL là nguồn dữ liệu runtime duy nhất của ứng dụng, được truy cập qua REST API nội bộ của Express.
3. **Document Contract**: Các collection nghiệp vụ (`requests`, `handoverDocs`, `kqtnRecords`, `customers`, `products`, `brands`, `systemUsers`, `systemConfig`, `userPreferences`, `notifications`, `activityLogs`) được lưu trong bảng `app_documents` với khóa `(collection_name, document_id)` và payload `JSONB`, bảo toàn đầy đủ trường động của mô hình TypeScript.
4. **No External Google Storage**: Ứng dụng không sử dụng Google Apps Script, Google Sheets, Google Drive, Google Tasks hoặc Google OAuth làm nguồn đọc/ghi dữ liệu nghiệp vụ. Dữ liệu chỉ được đồng bộ qua PostgreSQL REST API; IndexedDB/Zustand là lớp cache cục bộ và JSON là định dạng sao lưu/khôi phục.
5. **Tương thích dữ liệu cũ**: Payload JSON hoặc cấu hình PostgreSQL còn trường `scriptUrl`, `spreadsheetUrl`, `googleTaskId` từ phiên bản cũ không bị xóa cưỡng bức trong đợt thay đổi này; ứng dụng không đọc, ghi hoặc khôi phục các trường đó vào luồng Google nào.
6. **Cấu hình Gemini theo tài khoản**: API Key và `geminiModel` được lưu trong collection `userPreferences` theo username chuẩn hóa. Mọi luồng gọi AI ưu tiên model cá nhân; tài khoản chưa có trường `geminiModel` mới tạm dùng giá trị `AppSettings.geminiModel` legacy rồi mới fallback về model mặc định của server. Nút kiểm tra danh sách model Google nằm trong **Cài đặt cá nhân**, không nằm trong Thiết lập hệ thống dành cho Admin.
7. **Ranh giới danh mục khởi tạo**: `systemUsers` trong Thiết lập hệ thống là danh sách runtime đọc từ collection PostgreSQL `systemUsers`; dữ liệu mặc định chỉ được seed vào collection này khi DB chưa có tài khoản. Các file `brands.csv`, `products.csv` và `customers.csv` chỉ được preload một lần trong lúc khởi tạo app để tạo dữ liệu cục bộ ban đầu, không được đọc lại trong mỗi chu kỳ đồng bộ và không được tự động ghi các dòng CSV vào PostgreSQL. Các danh mục do người dùng thêm, sửa hoặc xóa vẫn được lưu theo luồng CRUD DB hiện hành.
8. **Supabase PostgreSQL production mode**: Production Docker Desktop chạy webapp trên PostgreSQL của Supabase self-host qua network `supabase_default` và service `supabase-db`. DDT dùng database riêng `ddt_lab` trong instance Supabase, không dùng chung hoặc xóa các schema/database hệ thống của Supabase. Container và volume PostgreSQL độc lập của DDT đã được xóa sau khi migration và health check hoàn tất.
9. **Supabase Storage file boundary**: Bucket private `ddt-files` lưu các file PDF KQTN nghiệp vụ và metadata tương ứng trong `file_assets`; các object ảnh legacy và metadata legacy đã được cleanup. Production webapp không tạo file asset mới cho ảnh OCR/Lập báo cáo.
10. **Supabase Storage Docker wiring**: Compose production mặc định dùng `http://supabase-storage:5000` trên network `supabase_default`; service role secret phải được nạp từ env bên ngoài qua `SUPABASE_SERVICE_ROLE_KEY` hoặc alias `SERVICE_ROLE_KEY` của Supabase self-host, không ghi secret vào source/repository.
11. **Ảnh OCR và ảnh lập báo cáo là dữ liệu tạm**: Ảnh tải lên/dán vào luồng OCR hoặc form Lập báo cáo chỉ được giữ trong state của phiên hiện tại để xử lý OCR, crop và xuất DOCX. Khi lưu `kqtnRecords`, ứng dụng phải loại bỏ `productPhoto*`, `nameplatePhoto*`, `nameplatePhotos` và `emcData.images`; không tạo file asset mới và không ghi Base64 ảnh vào PostgreSQL. Dữ liệu ảnh legacy đã được cleanup, và ảnh mới không được tiếp tục nhân bản khi chỉnh sửa/lưu báo cáo.
12. **Ranh giới đồng bộ khi lưu phiếu**: `RequestModal` chỉ đọc riêng collection `requests` trước khi lưu để kiểm tra mã phiếu trùng; không thực hiện full sync cho bước kiểm tra. Sau khi cập nhật state cục bộ, luồng tạo/sửa phiếu phải thực hiện đúng một full sync hậu lưu để ghi phiếu, notification, các thay đổi liên quan và hòa giải hai chiều. `addRequests` chỉ bỏ qua sync trong chính luồng `RequestModal`; các caller khác vẫn giữ cơ chế sync mặc định. Nhật ký hoạt động tiếp tục ghi trực tiếp qua `/api/activity-logs` và không được gộp vào full sync.
13. **Bản nháp Phiếu Yêu Cầu**: Khi tạo phiếu mới, `RequestModal` tự lưu bản nháp theo tài khoản trong IndexedDB cục bộ để người dùng có thể tiếp tục sau khi đóng modal ngoài ý muốn. Bản nháp chỉ chứa các trường nghiệp vụ có thể tuần tự hóa gồm thông tin chung, danh sách mẫu, mẫu đang nhập và tùy chọn thông tin hóa đơn; không lưu ảnh/file OCR, trạng thái quét hoặc dữ liệu UI tạm thời. Nếu phát hiện bản nháp khi mở modal tạo mới, người dùng phải chủ động chọn khôi phục hoặc xóa. Nút `Xóa bản nháp` xóa dữ liệu cục bộ, đưa form đang mở về đúng trạng thái ban đầu như vừa mở modal và giữ modal hiển thị; không áp dụng cơ chế bản nháp cho modal chỉnh sửa nhóm phiếu. Sau khi lưu phiếu thành công, bản nháp tương ứng phải được xóa.

### 7.3. Hợp đồng REST API & triển khai Docker:
- `GET /api/db/health`: Kiểm tra kết nối PostgreSQL.
- `GET /api/db/:collection`: Đọc toàn bộ document của collection, trả về `id` cùng payload JSONB.
- `PUT /api/db/:collection/:id`: Upsert một document theo định danh.
- `DELETE /api/db/:collection/:id`: Xóa một document theo định danh.
- `POST /api/db/:collection/batch` và `POST /api/db/:collection/delete-batch`: Ghi/xóa theo lô tối đa 250 document mỗi lượt.
- Không còn route proxy `/api/gas` và không có REST endpoint nào gọi sang Google để lưu/đọc dữ liệu nghiệp vụ. Endpoint `/api/gemini/*` chỉ phục vụ AI, không phải persistence.
- `GET /api/gemini/models` chỉ được gọi theo thao tác chủ động **Kiểm tra Google** trong Cài đặt cá nhân; khi chưa có key trả `503/GEMINI_API_KEY_MISSING`, khi Google/network lỗi trả `503/GEMINI_API_UPSTREAM_UNAVAILABLE`, không trả lỗi `500` chung.
- Môi trường development chạy trên `PORT=1359` và kết nối direct PostgreSQL Supabase qua `127.0.0.1:15432` (chỉ bind loopback); Compose mặc định và Compose production kết nối `supabase-db:5432` trên network `supabase_default`. Web server production lắng nghe `PORT=2359` và Docker Desktop publish `2359:2359`.
- KQTN bulk OCR dùng chung PaddleOCR microservice `tvci_ocr_service` của TVCI_APP. Production DDT gọi qua network nội bộ `supabase_default` bằng `OCR_SERVICE_URL=http://tvci_ocr_service:8100`; development chạy trên host dùng `http://127.0.0.1:8100`, với OCR port chỉ bind loopback để không public ra Internet.
- PaddleOCR cung cấp endpoint OCR PDF cục bộ dành cho Bulk Upload; với PDF ghép, service chỉ OCR vùng footer của từng trang, không OCR phần nội dung toàn trang để phân nhóm. DDT chuẩn hóa khóa footer theo `Số mã hóa` và các họ định danh `ITD`, `EMC`, `ITDC`; ngày, số trang và text thân báo cáo không được dùng làm khóa. Bulk Upload dùng PaddleOCR và matching tên file làm nguồn nhận diện chính; Gemini không phải dependency bắt buộc và không được tự động gọi để chặn phiên khi OCR local không đủ rõ.
- Với PDF scan lớn (ví dụ khoảng 59 MB/116 trang), Bulk Upload phải upload multipart một lần vào DDT, nhận `jobId` và polling tiến độ; không encode/gửi lại từng trang từ trình duyệt. DDT giữ PDF nguồn tạm trong job có TTL, chuyển một lần tới endpoint footer-batch của PaddleOCR rồi xóa bytes nguồn khi job hoàn tất/thất bại/hết hạn.
- Footer-batch của PaddleOCR phải nhận toàn bộ PDF một lần. DDT tạo PDF tạm với MediaBox/CropBox chỉ chứa khoảng 8% cuối trang (dòng mã và phân số footer) theo hướng hiển thị, có tính rotation 90/180/270 của scan, vì pdf2image mặc định ưu tiên MediaBox; service vẫn crop thêm khi endpoint nhận `footer_ratio` nếu hỗ trợ. Service dùng thumbnail 90 DPI để chọn ứng viên và OCR ứng viên footer ở 150 DPI, giải phóng ảnh sau từng trang và tuần tự hóa lượt gọi predictor dùng chung để tránh lỗi tensor khi dev/production chạy đồng thời; job bất đồng bộ có ngân sách tối đa 15 phút và báo lỗi từng trang nếu có.
- OCR production phải pin cặp runtime CPU tương thích `paddleocr==3.7.0` và `paddlepaddle==3.2.0`; service warm-up engine khi khởi động và lưu cache model trong named volumes để tránh lỗi PIR/oneDNN và độ trễ khởi tạo ở request đầu tiên. Bulk OCR dùng cặp model mobile `PP-OCRv5_mobile_det/rec`; OCR toàn trang dùng DPI thấp `120` cho scan lớn và proxy trang đầu dùng `150 DPI` để giữ phản hồi trong giới hạn reverse proxy.

### 7.4. Hệ thống Thông báo & Hoạt động Nghiệp vụ (Business Notification System):
- **Nguyên tắc ít nhiễu**: Chỉ phát notification ngay cho thay đổi lớn có tác động tới tiến độ, phân công, trạng thái, mẫu, biên bản hoặc kết quả. Chỉnh sửa văn bản nhỏ như xóa chữ, đổi tên/đổi mã hiển thị, ghi chú và các field mô tả không phát notification.
- **Nguồn sự kiện lớn**: Tạo/xóa phiếu, thay đổi trạng thái, xếp/gỡ/chuyển lịch, giao việc, tạo/xóa biên bản, cập nhật/xóa KQTN và các cập nhật phiếu ảnh hưởng tới loại kiểm tra, số lượng, độ ưu tiên, ngày nhận mẫu, kết quả hoặc định danh kỹ thuật đều phát notification có metadata `entityType`, `action`, `entityId`, `entityLabel` và người thực hiện.
- **Phạm vi Admin/Quản lý**: Admin/Quản lý nhận toàn bộ notification nghiệp vụ, bao gồm cả thông báo phân công công việc.
- **Phạm vi nhân viên**: Nhân viên chỉ nhận phiếu yêu cầu mới, biên bản mới được tạo và công việc mới được giao cho chính tài khoản đó.
- **Kênh hiển thị**: Mọi tài khoản đã đăng nhập đều có chuông và dropdown notifications; nội dung hiển thị vẫn được lọc theo `targetRole` và `targetUsernames` để tránh gửi lan và gây loãng.
- **Định tuyến theo tài khoản**: Notification dùng `targetRole` (`admin` hoặc `staff`) và `targetUsernames` tùy chọn. Notification `staff` được Admin/Quản lý xem được; khi có `targetUsernames`, chỉ tài khoản được chỉ định nhận notification ở nhóm nhân viên.
- **Định danh người được giao**: Trường `testerName` trên phiếu được đối chiếu với `systemUsers` theo tên đăng nhập/họ tên để lưu username ổn định vào `targetUsernames`; nếu không xác định được tài khoản, notification phân công chỉ hiển thị cho Admin/Quản lý và không gửi nhầm cho nhân viên khác.
- **Gộp sự kiện**: Một thao tác nhóm (ví dụ xóa toàn bộ phiếu theo mã hoặc tạo nhiều mẫu cùng mã phiếu) tạo một notification tổng hợp, tránh phát nhiều notification cho cùng một hành động của người dùng.
- **Điều hướng**: Click notification mở đúng khu vực nghiệp vụ: phiếu mở tab danh sách và bộ lọc mã phiếu; biên bản mở tab giao nhận và chi tiết biên bản; KQTN mở tab kết quả; lịch mở đúng tab ATD/EMC.
- **Lưu trữ & đồng bộ**: Notification được lưu trong collection `notifications` của `app_documents`, merge theo `id`, giới hạn hiển thị 50 bản ghi mới nhất. Xóa tất cả phải xóa cả bản ghi cloud để không quay lại sau đồng bộ.
- **Sao lưu & khôi phục**: Gói backup JSON phải bao gồm `notifications`; restore và upload PostgreSQL phải chuẩn hóa, xóa bản ghi cloud ngoài backup và khôi phục đúng danh sách notification.
- **Tương thích**: Notification cũ chỉ có `type`, `targetRole`, `requestCode` vẫn phải hiển thị được; các trường metadata mới là tùy chọn khi đọc dữ liệu lịch sử.

### 7.4.1. Nhật ký hệ thống (System Activity Audit Log):
- **Mục đích**: Activity log là sổ audit riêng, dùng để tra cứu lịch sử thao tác toàn hệ thống; không dùng thay cho notification và không bị ảnh hưởng bởi thao tác xóa/đánh dấu notification.
- **Phạm vi ghi**: Mọi mutation nghiệp vụ thành công đều ghi log, kể cả chỉnh sửa nhỏ. Phiếu, biên bản, KQTN, lịch, trạng thái, phân công, người dùng, danh mục và thiết lập đều phải có actor, thời gian, action, entity, summary và diff phù hợp.
- **Chính sách ít nhiễu**: Chỉ thay đổi lớn mới phát notification; thay đổi nhỏ vẫn xuất hiện trong activity log nhưng không phát notification ngay.
- **Lưu trữ**: Dùng collection `activityLogs` trong `app_documents`, append-only đối với UI, không có endpoint sửa/xóa log cho người dùng.
- **Quyền xem**: Tất cả tài khoản đã đăng nhập được thấy và đọc nhánh `Nhật ký hệ thống`; nhánh này nằm ngay trước `Thiết lập`. Activity log là dữ liệu chỉ đọc trên giao diện, không cho người dùng sửa/xóa.
- **Đọc dữ liệu**: Trang dùng API phân trang/lọc chuyên dụng theo cursor; không tải toàn bộ lịch sử vào Zustand.
- **Sao lưu**: Gói backup đầy đủ phải bao gồm `activityLogs`; restore không được làm mất log đã tồn tại và phải ghi một log tổng hợp cho thao tác restore thành công.
- **Bộ lọc & KPI**: Trang có dropdown/checkbox chọn nhiều người dùng từ `systemUsers`; bỏ chọn hết tương đương xem tất cả. Không hiển thị bộ lọc “Từ ngày/Đến ngày”; thay bằng selector kỳ `Ngày`, `Tuần`, `Tháng`, `Năm`, mặc định `Tháng`. Biên kỳ của cả nhật ký và KPI cố định theo `Asia/Ho_Chi_Minh` (GMT+7), không phụ thuộc timezone trình duyệt.
- **KPI trực quan**: API summary tổng hợp theo actor trong cùng kỳ đã chọn, không phụ thuộc page size nhật ký. UI dùng danh sách biểu đồ thanh ngang xếp chồng để so sánh nhiều nhân viên trong cùng viewport; mỗi dòng phải hiển thị tổng thao tác và các số liệu nhóm Phiếu/KQTN/Biên bản/Lịch/Khác. Phần cơ cấu chi tiết của người được chọn có thể hiển thị bổ sung trên desktop, nhưng không được làm giảm khả năng đọc danh sách KPI trên mobile; số phiếu/mẫu/biên bản phải đếm distinct entity ID.

### 7.5. Nguyên Tắc Bảo Toàn Dữ Liệu Nghiệp Vụ Khi Quản Trị Người Dùng (Data Integrity & User Lifecycle Isolation):
- **Cách ly tuyệt đối (Zero Cascade Deletion)**: Thao tác thêm mới (`addUser`), chỉnh sửa (`updateUser`), hoặc xóa tài khoản người dùng (`deleteUser`) chỉ tác động duy nhất đến danh mục tài khoản truy cập (`systemUsers`).
- **Bảo toàn 100% hồ sơ nghiệp vụ**: Tuyệt đối không xóa, không ghi đè, không làm hao hụt bất kỳ bản ghi nào thuộc danh sách Mẫu thử & Phiếu yêu cầu (`requests`), Biên bản giao nhận mẫu (`handoverDocs`), hay Biên bản kết quả thử nghiệm (`kqtnRecords`).
- **Lưu giữ lịch sử phân công**: Các trường thông tin KTV phụ trách (`testerName`), Người tạo (`createdBy`), Người nhận bàn giao (`representative`) gắn với các mẫu thử/phiếu thử nghiệm cũ vẫn được giữ nguyên dạng văn bản lịch sử, hiển thị đầy đủ trên Lịch điều phối, Nhật ký tổng hợp, và Phiếu in.
- **Đồng bộ xóa danh mục an toàn**: Áp dụng cơ chế danh sách xóa định danh (`deletedUserIds`) trong cấu hình hệ thống (`systemConfig`) để đảm bảo tài khoản đã xóa không bị khôi phục nhầm trong các chu kỳ đồng bộ hai chiều, đồng thời không gây ảnh hưởng đến dữ liệu thử nghiệm.

### 7.6. Chuẩn Hóa Sao Lưu & Khôi Phục Dữ Liệu Toàn Diện (Backup & Restore Specification):
- **Cấu trúc gói sao lưu JSON**: Bao gồm đầy đủ `requests`, `handoverDocs`, `kqtnRecords`, `customers`, `products`, `brands`, `dayConfigs`, `systemUsers`, `notifications`, `activityLogs`, `settings`, `timestamp`; trường `resultPdf` chỉ chứa metadata/pointer, không nhúng byte file.
- **Sao lưu đầy đủ phía Admin**: Bản sao lưu máy chủ dạng archive phải chứa dump PostgreSQL của `ddt_lab` (bao gồm `file_assets`), manifest metadata file và toàn bộ object PDF KQTN tương ứng trong Supabase Storage. Ảnh OCR/Lập báo cáo mới là dữ liệu tạm nên không thuộc backup và không được đưa vào `file_assets`.
- **Migrate file có thể lặp lại**: Job migrate dùng checksum và object path ổn định để chạy lại an toàn, không xóa Base64 nguồn trước khi consumer đã chuyển sang Storage và đã kiểm tra restore.
- **Quy trình khôi phục an toàn (Safe Restore Flow)**:
  1. Kiểm tra cấu trúc và tính hợp lệ của tệp sao lưu JSON.
  2. Chuẩn hóa dữ liệu đầu vào và làm mới dấu thời gian `updatedAt`.
  3. Gom nhóm xóa hàng loạt (`POST /api/db/:collection/delete-batch`, tối đa 250 bản ghi/lượt) các bản ghi PostgreSQL không thuộc file sao lưu.
  4. Gom nhóm lưu hàng loạt (`POST /api/db/:collection/batch`) toàn bộ danh mục mới vào PostgreSQL.
  5. Đặt lại toàn bộ danh sách xóa định danh (`deleted*Ids`) về rỗng trên `systemConfig` để tránh xung đột xóa nhầm trong chu kỳ đồng bộ tiếp theo.
  6. Cập nhật Store Zustand và tải lại dữ liệu mới nhất từ REST API PostgreSQL trên giao diện người dùng.
- **Khôi phục file nghiệp vụ**: Sau khi khôi phục dump PostgreSQL, phải khôi phục object PDF từ archive trước khi báo thành công; metadata `file_assets` và `resultPdf.objectPath` phải trỏ tới object tồn tại. File ngoài danh sách backup không được tự động đưa trở lại dữ liệu nghiệp vụ.

---

## 8. QUY CHUẨN MÃ NGUỒN VÀ TUÂN THỦ (CODE CONVENTIONS)

### ⚠️ QUY TẮC BẮT BUỘC KHI CẬP NHẬT HOẶC TẠO FILE:

1. **Bảo mật File Môi trường (`.env`)**:
   - Mọi thao tác tác động lên file `.env` đều phải được sự đồng ý rõ ràng từ người dùng.

2. **Quản lý Server & Testing**:
   - Khi thay đổi các cấu hình server hoặc backend, bắt buộc kill tiến trình cũ và khởi chạy server mới trên cổng 1359 để kiểm thử.

## 9. QUY CHUẨN KÍCH THƯỚC VÀ TỶ LỆ HÌNH ẢNH TRONG BÁO CÁO (.DOCX)

- **Bảo toàn tỷ lệ khung hình (Aspect Ratio = width / height)**: Tất cả hình ảnh khi chèn hoặc thay thế vào các file Word (.docx) báo cáo phải luôn giữ nguyên tỷ lệ chiều ngang / chiều dọc gốc của ảnh, tuyệt đối không làm méo hoặc biến dạng hình.
- **Hình ảnh đồ thị thử nghiệm (EMC / Radimation Graphs)**:
  - Chiều ngang cố định chuẩn: **165mm** (tương đương 624px theo chuẩn 96 DPI của Word / OpenXML).
  - Chiều dọc được tính toán tự động theo đúng tỷ lệ thực tế của ảnh gốc: `Height = Math.round(OriginalHeight * (624 / OriginalWidth))`.
- **Hình ảnh chụp mẫu thử, tem nhãn và ảnh thiết lập (`anh_1` - `anh_6`)**:
  - Toàn bộ ảnh tem được ghép ngang vào một ảnh composite tại `anh_1`; từng ảnh thành phần phải giữ nguyên tỷ lệ khung hình.
  - Ảnh composite và các ảnh hỗ trợ được căn chỉnh theo khung giới hạn tối đa (`MAX_WIDTH` x `MAX_HEIGHT`) của từng vị trí bố cục.
  - Tỷ lệ co/phóng luôn đồng nhất theo cả 2 trục bằng hệ số `ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h)` để đảm bảo giữ nguyên tỷ lệ gốc.

## 10. QUY CHUẨN NHẬT KÝ ĐỒNG BỘ VÀ CHẨN ĐOÁN DỮ LIỆU (SYNC DIAGNOSTIC SYSTEM)

- **Cơ chế Chẩn đoán Hai tầng**:
  - Tầng 1: PostgreSQL Server qua REST API (`/api/db/:collection`) - đối chiếu số lượng, thời gian cập nhật và trạng thái kết nối.
  - Tầng 2: IndexedDB / Local Store - kiểm tra danh sách bản ghi cục bộ và danh sách ID đã xóa (`deletedRequestIds`).
- **So sánh Timestamp Bản ghi Mới nhất**:
  - Trích xuất bản ghi mới nhất trên Cloud vs Bản ghi mới nhất tại Local (`createdAt`, `updatedAt`, `requestDate`).
  - Đo độ lệch thời gian (`timeDifferenceSeconds`) và hiển thị 10 bản ghi mới nhất từ Cloud để người dùng kiểm chứng ngay lập tức.
- **Chẩn đoán đích danh Lô / Mã mẫu (Deep Lot Inspection)**:
  - Cho phép tra cứu trực tiếp bất kỳ mã lô (ví dụ: `1242-26`, `1142-26`) hoặc mã PYC để tìm kiếm trên 2 nguồn (PostgreSQL API, Local DB).
  - Tự động đưa ra kết luận chẩn đoán nguyên nhân (do chưa lưu, nằm trong danh sách đã xóa, hay bị ẩn bởi bộ lọc phân loại/ngày tháng) và đề xuất hướng xử lý cụ thể.

---


## 11. KQTN THEO ĐẦU MẪU, FILE PDF & BULK UPLOAD

- Một đầu mẫu thử nghiệm dùng chung cho KQTN và Sổ Tổng hợp được định danh bằng `sampleCode`/số mã hóa chuẩn hóa và tham chiếu về `requestId`/phiếu yêu cầu. Sổ Tổng hợp quản lý vòng đời, thông tin hành chính, trạng thái nhận mẫu, lịch và giao trả; KQTN quản lý kết quả thử nghiệm và PDF.
- `sampleCode` là bắt buộc khi lưu KQTN. Các biến thể về khoảng trắng, dấu phân cách, chữ hoa/thường hoặc dấu tiếng Việt phải quy về cùng `sampleKey`. Mỗi `sampleKey` chỉ có một KQTN hiện hành.
- KQTN hiển thị đầu mẫu từ `requests` cùng trạng thái `Chưa có KQTN` hoặc `Đã có KQTN`; KQTN không tạo nguồn mẫu thứ hai và không thay thế luồng biên bản Giao nhận.
- Khi chưa có KQTN, Lưu tạo bản ghi mới. Khi đã có KQTN, hệ thống phải hỏi xác nhận ghi đè; hủy không thay đổi dữ liệu. Đồng ý ghi đè cập nhật cùng `id`, tăng `version`, thêm `versionHistory`, không tạo thêm dòng.
- Bảng KQTN có cột `File PDF`: chưa có file thì Upload; có file thì Xem file, Download hoặc Ghi đè. Ghi đè chỉ hoàn tất khi file mới lưu thành công và object cũ đã bị xóa.
- `KQTNRecord.resultPdf` chỉ lưu metadata/pointer private gồm `assetId`, `objectPath`, `originalName`, `mimeType`, `byteSize`, `sha256`, `uploadedAt`, `uploadedBy`; không lưu Base64 PDF trong JSONB.
- Header KQTN có `Bulk Upload`. AI đọc mã hóa/model từ tên file và nội dung PDF để đề xuất đầu mẫu; người dùng sửa mapping thủ công từng file, xem cảnh báo độ tin cậy và xác nhận riêng các trường hợp ghi đè.
- `Bulk Upload` hỗ trợ cả nhiều PDF đơn và một PDF nguồn ghép nhiều báo cáo. Với PDF ghép, các trang được chia thành các nhóm liên tục bắt đầu từ trang bìa báo cáo; trang trắng phân cách ở đầu/cuối nhóm bị loại khỏi PDF con. Hệ thống chỉ dùng khóa footer để xác định nhóm, `sampleCode`/số mã hóa và `reportNo` (`ITD`/`EMC`/`ITDC`); các giá trị được chuẩn hóa hoa thường, dấu tiếng Việt, dấu phân cách và số thứ tự `M02` tương đương `M2`. Sau khi có nhóm, hệ thống OCR Paddle tối đa 3 trang đầu của từng nhóm để lấy model và tìm mẫu đích; dừng sớm khi đã đọc được model. Luồng này không phụ thuộc Gemini.
- Việc nhận diện PDF ghép là best-effort: khi OCR không xác định được khóa footer hoặc model đọc từ các trang đầu bị thiếu/trùng nhiều đầu mẫu, nhóm chuyển sang trạng thái cần chọn thủ công. Footer không được so sánh với `candidate.model` và không được dùng để suy diễn model; model chỉ đến từ OCR giới hạn ở các trang đầu nhóm. Nếu không có match duy nhất, người dùng rà soát/chọn thủ công trước khi upload.
- PDF nguồn ghép chỉ tồn tại tạm trong phiên xử lý; hệ thống tạo PDF con rồi đi qua cùng API PDF đơn hiện tại. Giới hạn kích thước PDF kết quả vẫn áp dụng cho từng PDF con, độc lập với kích thước PDF nguồn; không lưu byte PDF nguồn vào JSONB hoặc tạo thêm bản ghi KQTN.
- Bulk upload xử lý độc lập từng nhóm, hiển thị tiến độ/thành công/thất bại và cho phép retry nhóm lỗi. Một thao tác ghép nhiều nhóm được ghi thành một activity log tổng hợp; mỗi nhóm vẫn tuân thủ duy nhất `sampleKey` và xác nhận ghi đè riêng.
- PDF kết quả là file nghiệp vụ trong bucket private `ddt-files` của Supabase Storage; metadata được kiểm kê trong `file_assets`. Quy tắc ảnh OCR/ảnh lập báo cáo chỉ lưu tạm vẫn giữ nguyên.
- API PDF: `POST /api/kqtn/:recordId/pdf`, `GET /api/kqtn/:recordId/pdf`, `GET /api/kqtn/:recordId/pdf?download=1`, `DELETE /api/kqtn/:recordId/pdf`. Admin/Tester được ghi/ghi đè; Viewer/Guest chỉ đọc/download theo quyền KQTN.
- Response của API `GET` PDF phải dùng `Content-Disposition` ASCII-safe: `filename` fallback không chứa ký tự điều khiển và `filename*` mã hóa UTF-8, để trình xem PDF nghiêm ngặt không từ chối file có tên tiếng Việt hoặc tên bị lỗi mã hóa.
- Backup JSON chỉ lưu metadata PDF, không nhúng byte PDF. Backup đầy đủ phải gồm metadata `file_assets` và object PDF; restore phải khôi phục object trước khi xác nhận pointer hoạt động.

<!-- --- End of design.md --- -->
<!-- Codex bulk upload clarification -->
### 11.1. Bulk Upload session and target mapping
- Header KQTN phải tách rõ **Nhiều PDF đơn** (mỗi file là một kết quả, không cắt) và **Một PDF ghép** (một file nguồn chứa nhiều kết quả, cắt theo nhóm trang rồi gán từng nhóm vào mẫu đích).
- Với PDF ghép, nút xác nhận phải thể hiện rõ “Tách PDF con và lưu vào mẫu đích”; hệ thống tạo PDF con rồi gọi API PDF đơn hiện tại để lưu vào đúng KQTN đích đã chọn, đồng thời giữ trạng thái thành công/thất bại theo từng nhóm và cho phép retry nhóm lỗi.
- Đóng modal chỉ ẩn modal và giữ nguyên phiên xử lý trong bộ nhớ của trang. Chỉ “Xóa phiên/Bắt đầu lại” mới xóa file, mapping và trạng thái; không yêu cầu khôi phục sau reload cứng vì PDF nguồn là dữ liệu tạm của phiên.
- Candidate chưa có KQTN thực (`isPending=true`) phải hiển thị “Chưa có KQTN” nhưng vẫn được chọn làm mẫu đích; đây là cảnh báo nghiệp vụ, không phải khóa thao tác. Khi người dùng xác nhận upload vào candidate pending, Bulk Upload tạo bản ghi KQTN tối thiểu từ thông tin đầu mẫu/request rồi lưu PDF vào cùng bản ghi; không tự tạo bản ghi mới nếu đã có KQTN.
- Trường ghép PDF với Mẫu thử phải là combobox tìm kiếm/lọc, không chỉ là dropdown. Từ khóa được chuẩn hóa không phân biệt hoa thường, dấu tiếng Việt và dấu phân cách; tìm trên `sampleCode`, `reportNo`, `model`, `brand`, `sampleName` và `sealStamp`. Kết quả phải có trạng thái KQTN/PDF hiện tại, hỗ trợ bàn phím/xóa lựa chọn, và candidate pending vẫn nhìn thấy, có thể chọn nhưng phải hiển thị cảnh báo.

### 11.2. Scanned combined PDF segmentation
- PDF scan không có text layer vẫn phải được xử lý theo từng trang. Với PDF ghép lớn, lượt đầu upload nguồn một lần và tạo job OCR; DDT tạo PDF chỉ chứa footer rồi PaddleOCR dùng preflight bố cục trên chính vùng footer để chọn số trang ứng viên giới hạn, không OCR phần thân trang. Nếu PDF có text layer đầy đủ, service vẫn có thể dùng trực tiếp text theo trang, nhưng kết quả phân nhóm phải đi qua cùng bộ lọc khóa footer.
- Nhánh visual-candidate/classifier toàn trang chỉ còn là fallback tương thích cho nguồn cũ; không được gọi trong luồng Bulk Upload PDF ghép chuẩn. Luồng chuẩn không đọc tiêu đề, `PHỤ LỤC` hay thân báo cáo để quyết định mốc. Sau khi có khóa footer, hệ thống tạo nhóm rồi OCR Paddle tối đa 3 trang đầu nhóm để lấy model đã chuẩn hóa và match model với đầu mẫu; khóa footer chỉ dùng cho nhóm/mã báo cáo, không dùng như model. Combobox tìm kiếm/lọc vẫn là đường sửa mapping khi model thiếu hoặc không duy nhất.
- Các lỗi OCR phổ biến ở khóa footer (`ITD 1132 -26-M03`, `S6 (N°)`, khoảng trắng/dấu phân cách) phải được chuẩn hóa trước khi so sánh. Không tạo segment riêng từ trang phụ lục, trang nội dung, ngày tháng hoặc một dòng số không thuộc `Số mã hóa`/`ITD`/`EMC`/`ITDC`.
- Endpoint footer một trang và `footer-batch` vẫn được giữ cho fallback/manual hoặc nguồn nhỏ; nguồn lớn không được quay lại vòng lặp 116 request page-level. DDT phải polling `GET /api/kqtn/ocr/footer-jobs/:jobId`, hiển thị tiến độ `processedPages/totalPages` cùng chiến lược `footer-batch`, và chuyển manual split khi job thất bại/hết hạn/không tìm được đủ khóa footer.
- Footer là nguồn nhận diện chính để tìm mốc nhóm: khóa được lấy từ `Số mã hóa` hoặc mã bắt đầu bằng `ITD`, `EMC`, `ITDC`, sau khi chuẩn hóa khoảng trắng/dấu phân cách và lỗi OCR hiển nhiên. Bỏ qua số trang, ngày tháng, số tiêu chuẩn và text nội dung. Khóa footer ổn định được dùng để gom các trang liên tục; khóa không đọc rõ chuyển sang rà soát thủ công.
- Nếu footer OCR đọc được phân số trang dạng `current/total` (ví dụ `1/20`, `2/20`), mỗi segment phải đối chiếu `pageEnd - pageStart + 1` với `total`. Khi lệch, UI phải báo rõ số trang thực tế và số trang footer, đánh dấu cảnh báo để người dùng rà soát nhưng vẫn cho phép tách và lưu theo mốc/mapping hiện tại; cảnh báo không được chặn thao tác lưu. Nếu footer không có phân số thì không suy diễn tổng trang.
- Metadata cover (`isReportCover`, model, brand) không phải điều kiện để chia nhóm footer. Sau khi chia nhóm, mỗi nhóm được phép OCR Paddle tối đa 3 trang đầu để lấy model; nếu không đọc được model và footer cũng không map được mã mẫu thì giữ mapping thủ công, không tự động gọi Gemini.
- Mỗi marker mạnh tạo đúng một segment liên tục tới trước marker kế tiếp. Trang trắng ở biên được loại khỏi PDF con; trang trắng nằm giữa nội dung chỉ được loại khi AI xác nhận là trang phân cách. Mọi segment phải giữ `pageStart`, `pageEnd`, metadata marker và mapping về một `sampleKey` duy nhất.
- Nếu scan không đủ rõ để xác định marker hoặc có marker trùng/không map duy nhất với đầu mẫu hiện hữu, UI phải hiển thị nhóm `Cần rà soát`, cho phép sửa mốc trang/chọn mẫu, và chặn upload tự động cho nhóm đó.
- OCR job nhanh phải có ngân sách hữu hạn 5 phút, giới hạn số trang ứng viên và giải phóng ảnh sau mỗi cửa sổ render. Khi vượt thời gian hoặc service không trả đủ ứng viên, UI chuyển ngay sang tách thủ công và không phát sinh thêm retry page-level cho cùng nguồn. Structure extraction Gemini vẫn giữ ngân sách 45 giây, không retry SDK và chỉ dùng một model đã chọn cho mỗi request; khi vượt thời gian, API trả `504` với mã `KQTN_STRUCTURE_TIMEOUT`.

### 11.3. Bulk Upload confirmation gate
- Việc chọn file chỉ tạo một lựa chọn chờ xác nhận; không được gọi AI metadata/structure extraction và không được bắt đầu đọc, tách hoặc upload PDF ở bước này.
- UI phải hiển thị rõ file đã chọn và nút `Xác nhận và bắt đầu phân tích`. Chỉ sau thao tác xác nhận này hệ thống mới bắt đầu phân tích PDF tương ứng với mode `Nhiều PDF đơn` hoặc `Một PDF ghép`.
- Người dùng có thể bỏ chọn hoặc chọn lại trước khi xác nhận. Thao tác này không được làm mất phiên Bulk Upload đang có; chỉ khi xác nhận mới thay thế nguồn/đợt phân tích tương ứng.
<!-- --- End of design.md --- -->
