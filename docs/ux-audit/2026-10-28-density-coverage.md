# PGDCN Density Coverage — 2026-10-28

## Kết quả

Đã chụp và đo **33 tổ hợp màn hình/trạng thái × 2 viewport = 66 ảnh browser thật** ở 390×844 và 1440×1000. Ma trận mô phỏng Admin (23 tổ hợp/46 ảnh), Staff (8/16) và Viewer (2/4). Dùng Chromium headless trên `http://localhost:2367`; mọi phiên đăng nhập và API đều là fixture `QA_MOCKED` tổng hợp.

Playwright ghi nhận 2.180 GET API được trả bằng fixture hoặc trạng thái pending/503 có chủ đích; **0 lần thử ghi API, 0 request ra ngoài, 0 lỗi trang và 0 lỗi capture**. Có 24 lỗi console do các route synthetic cố ý trả 503 trong error scenarios; không có lỗi JavaScript trang. Không kết nối production DB/auth, không gửi dữ liệu thật.

Ảnh cùng DOM metrics cho ma trận chính nằm tại [thư mục coverage](artifacts/density/coverage-2026-10-28/) và [metrics.json](artifacts/density/coverage-2026-10-28/metrics.json). Metrics ghi đường dẫn từng ảnh, role, state, fixture, hành động kế tiếp, focus, overflow, vùng scroll/sticky và API route mode.

## Phạm vi browser đã xác minh

| Nhóm | Tổ hợp màn hình/trạng thái | Browser evidence |
|---|---|---|
| Staff | Sổ PCN, sổ mẫu PCN, soạn thảo PCN, Khách hàng; empty-state Khách hàng, sổ mẫu PCN/PGD; lỗi tải sổ PGD | `staff-pcn-register`, `staff-pcn-samples`, `staff-pcn-drafting`, `staff-customers`, `customers-empty`, `pcn-samples-empty`, `pgd-samples-empty`, `staff-pgd-register-error` |
| Viewer | Sổ PCN và chi tiết PCN chỉ đọc | `viewer-pcn-register`, `viewer-pcn-detail-readonly` |
| Trạng thái kết thúc | PCN `ISSUED`/`CANCELLED`; PGD `ARCHIVED`/`CANCELLED` | `pcn-issued-detail`, `pcn-cancelled-detail`, `pgd-archived-detail`, `pgd-cancelled-detail` |
| Empty-state | Khách hàng, sổ mẫu PCN, sổ mẫu PGD, sổ dữ liệu PGD tải thành công nhưng rỗng | `customers-empty`, `pcn-samples-empty`, `pgd-samples-empty`, `pgd-register-empty` |
| Fixture dài | Khách hàng; sổ PGD 18 dòng; sổ mẫu PGD 28 dòng; sổ mẫu PCN 24 dòng; soạn thảo PCN/PGD và 12 mẫu DOCX; trợ lý AI 12 hồ sơ; thông báo 32 mục | `customers-long`, `pgd-register-long`, `pgd-samples-long`, `pcn-samples-long`, `drafting-pcn-long`, `drafting-pgd-long`, `drafting-pcn-docx-settings-long`, `assistant-long`, `notifications-long` |
| Loading/error | Sổ PGD, soạn thảo, trợ lý AI và thông báo; có thêm lỗi sổ PGD trong role Staff | Các scenario `*-loading` và `*-error` trong metrics |
| Form tiếp nhận | Modal nhận PYC PGD ở mobile và desktop, gồm trạng thái ưu tiên khẩn, submit invalid, focus và scroll | `pgd-intake-modal` và ảnh chi tiết bên dưới |

Menu/workflow được mở qua điều hướng hiển thị và đối chiếu với `design.md` §5A.42–5A.43. Fixture Admin và Staff mô phỏng hai scope PCN+PGD. Fixture Viewer chỉ có scope PCN; menu không có PGD/thiết lập hệ thống và chi tiết PCN không có nút mutation-like. Coverage Viewer chỉ áp dụng cho đúng scope PCN read-only này; không suy rộng sang role hay state chưa mô phỏng.

## Kết quả đánh giá bổ sung

- Toàn bộ 66 capture chính có document overflow **0 px** ở 390px và 1440px. Bảng rộng giữ scroll bên trong bảng; viewport không bị kéo ngang.
- Các fixture dài đều render đủ số dòng/mục được kiểm tra: PGD 18, mẫu PGD 28, mẫu PCN 24, AI 12, thông báo 32. Trạng thái loading/error có nội dung riêng, không bị nhầm với empty-state.
- Capture modal, soạn thảo, AI, notifications và chi tiết dài không cho thấy điểm nghẽn mới đạt P1/P2. Không thêm finding chỉ vì trang có nhiều field hoặc thanh cuộn nội bộ.
- D01–D12 và F1–F5 giữ nguyên trạng thái baseline; không sửa lại các finding đã PASS.

### Modal tiếp nhận PYC PGD

Con số 69 của audit bề mặt trang gồm **66 field nghiệp vụ trong form + 1 điều khiển upload file + 2 điều khiển ngoài modal** (tìm hồ sơ và lọc sổ). Trong 66 field nghiệp vụ có 24 bắt buộc, 42 tùy chọn; ở mức ưu tiên `URGENT`, trường “Lý do ưu tiên” chuyển thành bắt buộc, tổng thành 25. Có 65 nhãn khác nhau; “Email” xuất hiện hai lần ở hai nhóm dữ liệu. Form chia thành 6 nhóm nghiệp vụ; không có cặp trùng cùng nhóm/nhãn.

| Đo đạc | 390×844 | 1440×1000 |
|---|---:|---:|
| Chiều cao nội dung form | 5.490 px | 2.221 px |
| CTA “Tạo PYC & mở hồ sơ” trước scroll | y=781–825, cao 44 px | y=929–973, cao 44 px |
| CTA còn trong khung modal sau scroll | Có | Có |
| Vùng cuộn dọc bên trong modal | 1 (`scrollHeight` 5.508 / `clientHeight` 604 px) | 1 |
| Tràn ngang tài liệu | 0 px | 0 px |
| Focus sau submit thiếu trường bắt buộc | `Người / đơn vị yêu cầu*` | `Người / đơn vị yêu cầu*` |
| Focus trap khi Tab qua cuối dialog | Đúng | Đúng |

Footer nằm ngoài vùng cuộn của form nên CTA vẫn hiện trong khung khi cuộn; CSS `position` của footer là `static`, không phải sticky positioning. Không đổi presentation hoặc validation vì bằng chứng không cho thấy CTA bị mất, focus bị kẹt sai, hay field bắt buộc bị che.

Ảnh: [modal mobile đầu form](artifacts/density/coverage-2026-10-28/pgd-intake-modal/admin-390x844-top.png), [mobile mức ưu tiên khẩn](artifacts/density/coverage-2026-10-28/pgd-intake-modal/admin-390x844-urgent-conditional.png), [mobile sau scroll/validation](artifacts/density/coverage-2026-10-28/pgd-intake-modal/admin-390x844-footer-validation.png), [desktop đầu form](artifacts/density/coverage-2026-10-28/pgd-intake-modal/admin-1440x1000-top.png), [desktop sau scroll/validation](artifacts/density/coverage-2026-10-28/pgd-intake-modal/admin-1440x1000-footer-validation.png).

### D13 — Empty-state PGD xuất hiện khi dữ liệu chưa sẵn sàng (P2, đã sửa)

| Đo đạc | Trước | Sau |
|---|---|---|
| Bootstrap pending | Empty-state “Chưa có hồ sơ PGD…” hiện như kết quả đã tải xong; không có loading status | Empty-state bị giữ lại; có `role=status` và nội dung đang tải |
| Bootstrap synthetic HTTP 503 | Cùng empty-state gây hiểu nhầm; không có retry | Có `role=alert`, nội dung nêu dữ liệu chưa tải và nút retry 44 px; empty-state không xuất hiện |
| Bootstrap thành công, danh sách rỗng | Chưa dùng để phân biệt với lỗi/pending | Empty-state vẫn hiện đúng sau khi tải thành công |
| Retry bàn phím | Không có | Enter kích hoạt retry và phát GET fixture; không phát mutation |
| Tràn ngang | — | 0 px ở các viewport kiểm tra |

Before: [loading 390px](artifacts/density/coverage-2026-10-28/d13-before/pgd-register-loading/admin-390x844.png), [error 390px](artifacts/density/coverage-2026-10-28/d13-before/pgd-register-error/admin-390x844.png); DOM baseline tại [d13-before/metrics.json](artifacts/density/coverage-2026-10-28/d13-before/metrics.json). After: [loading 390px](artifacts/density/coverage-2026-10-28/pgd-register-loading/admin-390x844.png), [error 390px](artifacts/density/coverage-2026-10-28/pgd-register-error/admin-390x844.png), [error 1440px](artifacts/density/coverage-2026-10-28/pgd-register-error/admin-1440x1000.png), [Staff error 390px](artifacts/density/coverage-2026-10-28/staff-pgd-register-error/staff-390x844.png). Regression ảnh/DOM được chạy ở 320, 375, 390, 430, 768, 1280 và 1440px với trạng thái Admin/Staff liên quan; mỗi width xác nhận không tràn ngang và retry có vùng chạm ít nhất 44 px.

> Implementation trong `components/PgdcnAppShell.tsx` chỉ phân biệt `loading | ready | error` theo bootstrap result; empty-state chỉ hiện khi bootstrap thành công. Không đổi schema, API, quyền, workflow hoặc business validation. Quy tắc trạng thái này được ghi vào `design.md` §5A.43.

## Verification và kết luận

- Playwright Chromium capture: **PASS**, 33 scenario/state, 66 ảnh chính, 3 role fixture; D13 regression RED trước fix và GREEN sau fix.
- `npm test`: **962 pass, 0 fail, 6 skipped** (các test opt-in cần preview URL); `npm run typecheck`: **PASS**; `npm run build`: **PASS**; `git diff --check`: **PASS**.
- P1 còn lại: **0**. P2 còn lại: **0**. D13 là P2 duy nhất phát hiện mới; đã sửa và kiểm tra trước/sau. Không có issue mới nào khác có evidence đạt ngưỡng sửa.
- Baseline Git: `94e0d1b`. Thay đổi được commit chọn lọc trên local `master`; SHA được ghi trong phần kết quả task. Không push.
