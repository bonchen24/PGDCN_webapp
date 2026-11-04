# Phát triển cục bộ

Server development của PGDCN_webapp chạy tại `http://localhost:1357`.

Trong PowerShell, chạy lệnh sau từ thư mục dự án:

```powershell
npm run dev
```

Script development của dự án mặc định dùng cổng 1357 khi biến môi trường `PORT` chưa được đặt. Khi cần chỉ rõ cổng cho phiên PowerShell hiện tại:

```powershell
$env:PORT = '1357'
npm run dev
```
