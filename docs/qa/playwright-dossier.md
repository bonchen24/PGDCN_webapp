# Playwright QA hồ sơ PCN/PGĐCN

`npm run qa:dossier` xác minh ứng dụng PGĐCN đang chạy bằng Chromium thật. Harness kiểm tra origin và fingerprint ứng dụng trước khi đăng nhập, sau đó xác minh session, vai trò, phạm vi phòng ban, trang chi tiết hồ sơ, 7 bước, vùng tài liệu, kích thước desktop 1440×1000 và mobile 390×844, lỗi console và tràn ngang.

## Server và hồ sơ QA

Mặc định dùng `http://127.0.0.1:1357`. Chỉ định origin và mã hồ sơ QA an toàn bằng biến môi trường:

```powershell
$env:PGDCN_UX_BASE_URL = 'http://127.0.0.1:1357'
$env:PGDCN_QA_PCN_DOSSIER_ID = '<id hồ sơ PCN QA>'
$env:PGDCN_QA_PGD_DOSSIER_ID = '<id hồ sơ PGĐCN QA>'
```

Có thể chỉ kiểm tra một phòng ban. Session phải có scope tương ứng. Harness chỉ đọc hồ sơ; không tạo hoặc sửa dữ liệu.

## Đăng nhập thật

Mặc định, khi có credential, harness đăng nhập qua API bằng `POST /api/auth/pcn-session` trong `BrowserContext.request`. Cookie `Set-Cookie` được chia sẻ với browser context; harness dùng trang để gọi `GET /api/auth/pcn-session`, xác nhận role và scope, rồi mở thẳng URL hồ sơ. Mã HTTP 401 (chưa đăng nhập hoặc session hết hạn) và 403 (bị từ chối quyền) được báo riêng. Mật khẩu, token và cookie không được ghi vào log.

Cung cấp credential qua environment của tiến trình, không đặt mật khẩu trong lệnh hoặc file repo:

```powershell
$env:PGDCN_QA_USERNAME = '<tài khoản QA>'
$qaPassword = Read-Host 'Mật khẩu QA' -AsSecureString
$env:PGDCN_QA_PASSWORD = [System.Net.NetworkCredential]::new('', $qaPassword).Password
Remove-Variable qaPassword
npm run qa:dossier
Remove-Item Env:PGDCN_QA_USERNAME, Env:PGDCN_QA_PASSWORD -ErrorAction SilentlyContinue
```

`PGDCN_QA_AUTH_MODE=ui` chạy smoke riêng qua form đăng nhập thật. Chế độ mặc định `api` không mở form đăng nhập.

Storage state Playwright đáng tin cậy có thể được dùng thay cho đăng nhập ban đầu. File phải nằm ngoài repo. Nếu session trả 401 và cặp credential QA cũng được cung cấp, harness đăng nhập API đúng một lần, xác minh lại session trên trang rồi cập nhật storage state. Không thử đăng nhập lại khi nhận 403.

```powershell
$env:PGDCN_QA_STORAGE_STATE = Join-Path $env:TEMP 'pgdcn-qa-storage-state.json'
$env:PGDCN_QA_USERNAME = '<tài khoản QA>'
# Gán PGDCN_QA_PASSWORD an toàn như ví dụ phía trên để cho phép làm mới session hết hạn.
npm run qa:dossier
```

Nếu thiếu cả storage state lẫn cặp credential, QA REAL AUTH sẽ dừng với thông báo cấu hình cần thiết; không giả lập cookie hoặc xác nhận đăng nhập thành công.

## Screenshot và kiểm thử mock

Mặc định không tạo screenshot. Khi dùng dữ liệu QA an toàn, có thể lưu ảnh ngoài repo:

```powershell
$env:PGDCN_QA_SCREENSHOT_DIR = Join-Path $env:TEMP 'pgdcn-qa-artifacts'
npm run qa:dossier
```

`npm run test:qa:dossier-harness` kiểm thử cấu hình, phân loại auth, cookie handoff, điều hướng hồ sơ trực tiếp, redaction và luồng refresh session bằng fixture cục bộ; đây không phải đăng nhập production.

`npm run qa:dossier:mock` là kiểm tra giao diện tổng hợp có route/API stub. Nó chỉ phục vụ visual/layout, không xác minh tài khoản, dữ liệu thật hoặc RBAC. Kết quả mock không được báo cáo là REAL AUTH.
