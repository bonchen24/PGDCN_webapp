# Playwright QA hồ sơ PCN/PGD

`npm run qa:dossier` chạy xác minh UI thật bằng Chromium trong một Playwright context riêng. Lệnh luôn kiểm tra `GET /` và fingerprint PGDCN trước khi mở browser, sau đó kiểm tra phiên thật qua `GET /api/auth/pcn-session`, scope phòng ban, trang chi tiết hồ sơ, 7 giai đoạn, vùng thao tác tài liệu, kích thước 1440 × 1000 và 390 × 844, lỗi console và tràn ngang.

## Chọn server và hồ sơ QA

Mặc định harness dùng `http://127.0.0.1:1357`. Có thể chỉ định origin chính xác:

```powershell
$env:PGDCN_UX_BASE_URL = 'http://127.0.0.1:1357'
$env:PGDCN_QA_PCN_DOSSIER_ID = '<id hồ sơ PCN QA>'
$env:PGDCN_QA_PGD_DOSSIER_ID = '<id hồ sơ PGD QA>'
```

Chỉ đặt ID của dữ liệu QA an toàn. Có thể chạy một phòng ban hoặc cả hai; phiên phải có scope tương ứng với từng ID.

Nếu cổng 1357 đang chạy đúng PGDCN, dùng server đó. Nếu cần server QA riêng, mở terminal thứ nhất và truyền cổng qua biến `PORT`:

```powershell
$env:PORT = '1358'
npm run dev
```

Ở terminal QA thứ hai, đặt `$env:PGDCN_UX_BASE_URL = 'http://127.0.0.1:1358'`. Không truyền `--port` cho `npm run dev`. Harness sẽ kiểm tra fingerprint ứng dụng và process đang nghe đúng cổng; nếu sai, lệnh dừng mà không tắt process nào.

## Phiên đăng nhập thật

Dùng một trong hai chế độ sau.

**Storage state Playwright đáng tin cậy:** chỉ định file đã được tạo bằng quy trình đăng nhập được tin cậy. File phải nằm ngoài repo và không được commit. Harness chỉ đọc file, không tạo hoặc ghi lại cookie:

```powershell
$env:PGDCN_QA_STORAGE_STATE = Join-Path $env:TEMP 'pgdcn-qa-storage-state.json'
npm run qa:dossier
```

**Đăng nhập qua UI thật:** cung cấp tài khoản QA qua environment của tiến trình. Có thể nhập mật khẩu ẩn trong PowerShell như sau:

```powershell
$env:PGDCN_QA_USERNAME = Read-Host 'Tài khoản QA'
$qaPassword = Read-Host 'Mật khẩu QA' -AsSecureString
$env:PGDCN_QA_PASSWORD = [System.Net.NetworkCredential]::new('', $qaPassword).Password
Remove-Variable qaPassword
npm run qa:dossier
Remove-Item Env:PGDCN_QA_USERNAME, Env:PGDCN_QA_PASSWORD -ErrorAction SilentlyContinue
```

Lệnh nhập mật khẩu không ghi giá trị vào command history. Harness điền `#pcn-username` và `#pcn-password`, bấm nút đăng nhập, rồi xác nhận phiên, role và scope qua endpoint thật. Mật khẩu không được in ra, ghi vào file hoặc lưu thành storage state. Nếu không có phiên hoặc credential hợp lệ, lệnh báo `Cần phiên đăng nhập QA hợp lệ...` và không mở browser.

## Screenshot và bài test mock

Screenshot không được tạo mặc định. Chỉ bật khi dùng dữ liệu QA an toàn và lưu ngoài repo:

```powershell
$env:PGDCN_QA_SCREENSHOT_DIR = Join-Path $env:TEMP 'pgdcn-qa-artifacts'
npm run qa:dossier
```

Ảnh có thể chứa nội dung hồ sơ; không chia sẻ ảnh chứa dữ liệu thật. Harness chỉ ghi hai tên ảnh theo phòng ban và viewport, không đưa ID hồ sơ vào tên file.

`npm run qa:dossier:mock` chạy các bài Playwright có route/API được stub. Chúng là **synthetic/mock**, không xác thực tài khoản, không kiểm tra RBAC thật và không được dùng làm kết quả QA UI đã đăng nhập. Bài `test/pcn-pgd-dossier-wheel-scroll.playwright.test.mjs` kiểm tra PCN/PGD tại 1366, 1440 và 390 px: cuộn wheel trên nội dung/bảng, PageDown, vùng không tràn, PDF iframe và overlay xem nhanh. Có thể ghi ảnh mock ra ngoài repo bằng `PGDCN_SCROLL_SCREENSHOT_DIR`. Chromium headless giữ PDF iframe ở `about:blank`, nên bài wheel chỉ xác nhận hit-test và cuộn vùng hồ sơ khi PDF viewer không nhận wheel; cần QA tài khoản thật để xác nhận viewer PDF native. Test thuần cho URL, fingerprint, phiên và ID chạy bằng `npm run test:qa:dossier-harness`.
