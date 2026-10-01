# AGENT INSTRUCTIONS & COMPLIANCE RULES

## 1. NGUYÊN TẮC TỐI CAO (SINGLE SOURCE OF TRUTH)
- **`design.md`** là tài liệu chuẩn duy nhất (Single Source of Truth) định nghĩa toàn bộ kiến trúc, dữ liệu, thiết kế giao diện (UI/UX Cards, Badge Tokens) và quy chuẩn mã nguồn cho dự án này.
- Khi thực hiện bất kỳ yêu cầu phát triển hoặc chỉnh sửa nào, Agent **BẮT BUỘC** phải tham chiếu và tuân thủ tuyệt đối các quy định trong `design.md`.

## 2. QUY TRÌNH PHÁT TRIỂN & CẬP NHẬT
1. **Kiểm tra Spec**: Đối chiếu yêu cầu người dùng với `design.md`.
2. **Cập nhật Document trước**: Nếu có thay đổi về luồng nghiệp vụ, schema hoặc UI, phải được người dùng xác nhận và cập nhật vào `design.md` trước.
3. **Thực thi Code**: Sửa đổi code chuẩn xác theo `design.md`.

## 3. CHÍNH SÁCH NẠP NGỮ CẢNH `design.md`
- `design.md` vẫn là **nguồn chuẩn duy nhất**; không tạo hoặc duy trì một bản sao chuẩn thứ hai trong Obsidian.
- Không đọc toàn bộ `design.md` theo mặc định. Trước tiên xác định phạm vi yêu cầu, tìm heading liên quan trong mục lục, rồi chỉ đọc mục đó và các mục phụ thuộc trực tiếp.
- Định tuyến context mặc định:
  - UI/UX, Card, Modal, Layout: mục 2–5.
  - Data model, schema, persistence, API, RBAC, notification, backup: mục 6–7.
  - Quy chuẩn mã nguồn: mục 8.
  - DOCX, hình ảnh, PDF và KQTN: mục 9 và 11.
  - Sync, local store và chẩn đoán dữ liệu: mục 10.
- Nếu yêu cầu trải qua nhiều miền, chỉ nạp các nhóm tương ứng; không nạp các phần còn lại nếu không cần.
- Khi phạm vi chưa rõ, chỉ đọc mục lục và danh sách heading trước để chọn context, không nạp toàn bộ tài liệu.
- Obsidian chỉ được dùng như bản tham chiếu cá nhân tùy chọn, không phải nguồn để Agent quyết định khi coding.

## 4. NGÔN NGỮ GIAO TIẾP
- **Luôn phản hồi bằng tiếng Việt** khi giao tiếp với người dùng.
- Sử dụng tiếng Việt có dấu đầy đủ và chính xác.
- Đảm bảo thông tin rõ ràng, dễ hiểu cho người dùng Việt Nam.

## 5. QUY TẮC TƯƠNG TÁC
- **Luôn diễn giải lại yêu cầu** của người dùng để đảm bảo hiểu đúng.
- **Chỉ thực thi khi người dùng đồng ý** sau khi diễn giải.
- Phần diễn giải chỉ dùng lời nói, đặt thêm câu hỏi nếu muốn biết thêm thông tin, không viết code.
- Code chỉ được viết khi người dùng xác nhận đồng ý.
- Người dùng viết "OK tiến hành đi" tức là sẽ thực thi công việc mà không hỏi gì thêm.


<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
