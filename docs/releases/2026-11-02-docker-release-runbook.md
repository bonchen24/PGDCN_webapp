# Sổ tay vận hành triển khai Docker (Docker Release Runbook) — 2026-11-02

Tài liệu hướng dẫn quy trình kiểm tra cấu hình, triển khai (deployment) và khôi phục (rollback) an toàn cho dịch vụ `webapp` thuộc hệ thống PGDCN.

---

## 1. Nguyên tắc & Định danh triển khai

- **Project Name cố định**: Luôn chỉ định `-p pgdcn_webapp` trong mọi lệnh Compose.
- **Compose Files**: Luôn nạp đồng thời file cấu hình gốc và file override release:
  - `-f docker-compose.pcn.yml`
  - `-f docker-compose.pcn.release.yml`
- **Môi trường & Biến bí mật (Env Files)**: Sử dụng trực tiếp các file môi trường cục bộ hiện có, **tuyệt đối không commit lên Git** và không in/ghi log giá trị bí mật:
  - File môi trường ứng dụng: `.env` (tại thư mục gốc repo)
  - File môi trường Supabase: `E:\CODING\TVCI_APP\supabase-docker\.env`
- **Tài nguyên dùng chung**:
  - Network: External network `supabase_default`.
  - Volume: External volume `pcn_webapp_backups` mount tại `/app/backups`.
- **An toàn dữ liệu**: Tuyệt đối **không** dùng `docker compose down -v` và **không** tạo project mới để tránh mất mát volume hoặc gián đoạn mạng.

---

## 2. Kiểm tra cấu hình & Dry-run an toàn

Trước khi triển khai, bắt buộc chạy kiểm tra tính hợp lệ của cấu hình Compose và mô phỏng triển khai dry-run. Để bảo vệ dữ liệu bí mật khỏi bị lộ qua console/log, thực hiện chặn toàn bộ output, kiểm tra `$LASTEXITCODE` và chỉ thông báo trạng thái thành công/thất bại:

```powershell
# 1. Kiểm tra cú pháp Compose hợp lệ (không in output nếu hợp lệ)
docker compose `
  -p pgdcn_webapp `
  -f docker-compose.pcn.yml `
  -f docker-compose.pcn.release.yml `
  --env-file .env `
  --env-file "E:\CODING\TVCI_APP\supabase-docker\.env" `
  config --quiet

# 2. Dry-run mô phỏng an toàn (chặn output, kiểm tra exit code không làm lộ env hay output Compose)
docker compose `
  -p pgdcn_webapp `
  -f docker-compose.pcn.yml `
  -f docker-compose.pcn.release.yml `
  --env-file .env `
  --env-file "E:\CODING\TVCI_APP\supabase-docker\.env" `
  --dry-run `
  up -d --build webapp *> $null

if ($LASTEXITCODE -ne 0) {
    $dryRunExitCode = $LASTEXITCODE
    throw "Dry-run validation failed with exit code $dryRunExitCode. Compose output was suppressed."
}
Write-Host "Dry-run validation succeeded."
```

> [!NOTE]
> Các thay đổi chỉ liên quan đến tài liệu (docs-only) hoặc file override Compose không yêu cầu redeploy lại runtime production.

---

## 3. Lệnh triển khai chính thức (Deployment)

Sau khi kiểm tra cấu hình thành công, thực thi build và khởi chạy container `webapp`:

```powershell
docker compose `
  -p pgdcn_webapp `
  -f docker-compose.pcn.yml `
  -f docker-compose.pcn.release.yml `
  --env-file .env `
  --env-file "E:\CODING\TVCI_APP\supabase-docker\.env" `
  up -d --build webapp
```

---

## 4. Quy trình khôi phục an toàn (Safe Rollback)

Nếu bản phát hành gặp sự cố, thực hiện rollback về Docker image đã ghim trước đó (`pgdcn_webapp-webapp:rollback-d11b0d02-20261102`).

### Các bước thực hiện:

1. **Xác minh image rollback tồn tại**:
   ```powershell
   docker image inspect pgdcn_webapp-webapp:rollback-d11b0d02-20261102 > $null
   ```

2. **Gắn tag image rollback về `latest`**:
   ```powershell
   docker tag pgdcn_webapp-webapp:rollback-d11b0d02-20261102 pgdcn_webapp-webapp:latest
   ```

3. **Khởi chạy lại container bằng image đã ghim** (dùng cùng project, compose files và env files):
   ```powershell
   docker compose `
     -p pgdcn_webapp `
     -f docker-compose.pcn.yml `
     -f docker-compose.pcn.release.yml `
     --env-file .env `
     --env-file "E:\CODING\TVCI_APP\supabase-docker\.env" `
     up -d --no-build --pull never webapp
   ```

### Lưu ý sống còn khi Rollback:
- Giữ nguyên volume `pcn_webapp_backups` và external network `supabase_default`.
- **Không** chạy DB restore hay migration; không xóa hoặc recreate volumes.
- Tuyệt đối **không** khuyến nghị hoặc sử dụng `down -v` hay khởi tạo project Compose mới.
