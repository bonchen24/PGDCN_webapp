# Proposal: UX work-first superneat cho PCN/PGD

- **Ngày:** 2026-10-22
- **Mã:** SPEC-PGDCN-05
- **Trạng thái:** proposal chờ duyệt; chưa phải quyết định kiến trúc
- **Audit:** [Audit end-to-end](../../audits/2026-10-22-pgdcn-end-to-end-operational-audit.md)
- **SSOT tham chiếu:** design.md mục 5A.19, 5A.22, 5A.23, 5A.26, 5A.28 và responsive requirements

## Hiện trạng và bằng chứng

Root master đã có dashboard “Việc của tôi”, Next Action/overdue cues và test tĩnh về dashboard, queue, workflow-first detail. Điều đó hỗ trợ hướng work-first, nhưng chưa phải bằng chứng visual usability hoặc browser QA đầy đủ ở desktop/mobile.

Các worktree compact-table/workfirst đang tách khỏi HEAD master. Worktree QA dùng synthetic data và chặn API; tài liệu gate của compact-worktable đánh NOT READY vì thiếu D3 PCN step panel. Ảnh overflow/render failure thuộc worktree QA, không được coi là lỗi đã tái hiện trên master.

## Mục tiêu và ngoài phạm vi

**Mục tiêu:** người dùng nhìn thấy việc cần làm tiếp theo, lý do/blocker và owner; tăng thông tin hữu ích trên mỗi hàng; dùng cùng ngôn ngữ trạng thái PCN/PGD; hạn chế card/giải thích dư; thao tác chính rõ; responsive và keyboard/touch dùng được.

**Ngoài phạm vi:** đổi status/workflow/data model; thêm store; đặt business priority/SLA mới; ẩn thông tin nghiệp vụ bắt buộc; cho UI vượt quyền server.

## Phương án và đánh đổi

1. **Giữ cấu trúc hiện hành, chỉ giảm spacing/card.** Ít regression; có thể vẫn phải điều hướng nhiều để xử lý việc.
2. **Work queue table desktop + stacked compact rows trên mobile, cùng một projection dữ liệu — đề xuất khảo sát.** Hiển thị nhiều cột trên desktop, giữ action/identity trên mobile; cần test parity và không để hai mode lệch nhau.
3. **Một dạng list responsive duy nhất trên mọi kích thước.** Dễ giữ parity; desktop mất mật độ thông tin khi xử lý hàng loạt.

Đề xuất thử phương án 2 trên một màn hình và một nhóm user trước. Không port trực tiếp worktree UX nếu chưa review diff/gate.

## Hợp đồng hiển thị

- Queue row ưu tiên: mã hồ sơ, khách hàng, domain/loại việc, trạng thái bằng chữ, người phụ trách, hạn hoặc tuổi chờ nếu có nguồn, blocker/thiếu evidence và Next Action.
- Mỗi row có một action chính phù hợp trạng thái và quyền hiện tại; hành động phụ ở menu/chi tiết. Action luôn đi qua callback/API có guard; disabled state giải thích lý do ngắn.
- “Việc của tôi”, việc chờ người khác và hồ sơ cần theo dõi là các filter/projection; cùng hồ sơ không xuất hiện lặp trong nhiều vùng chính cùng lúc.
- PCN và PGD giữ state machine riêng nhưng dùng cùng pattern trình bày: status text, tone semantic, owner, due, current work. Không đổi lifecycle label để làm giao diện trông đồng nhất.
- Chi tiết hồ sơ ưu tiên trạng thái → bước hiện tại → blocker/evidence → Next Action → CTA; workflow map, audit, file lineage và technical metadata ở lớp disclosure phía sau theo design.md.
- Desktop giữ table compact, sorting/filtering/accessibility. Mobile 320/375/390/430px ưu tiên mã, trạng thái, owner, due và action; phần phụ mở tại chỗ hoặc detail, không ép cuộn ngang toàn trang. Nếu bảng cần overflow, vùng cuộn phải có dấu hiệu và giữ context row.
- Không tự đặt chuẩn pixel/44px làm acceptance nếu chưa khớp shared component; kiểm tra touch target, focus ring, keyboard semantics, contrast và text label theo design system hiện hành.

## Nghiệm thu

1. Synthetic fixtures có hồ sơ ở mọi state PCN/PGD và vai trò viewer/staff/manager; mỗi row cho thấy đúng action theo policy.
2. Desktop 1280px+ và viewport 320/375/390/430px không cắt mã/khách hàng/trạng thái/action; kiểm tra scroll container và focus.
3. Mobile không mất owner, blocker hay action chính; table/list projection cho cùng tập record và cùng filter result.
4. Có keyboard-only pass cho filter, row/detail, menus và dialogs; screen reader name/state của action/status rõ.
5. Test tĩnh kiểm tra status text và không suy diễn evidence; browser visual test dùng API mock/block, không kết nối dữ liệu thật.
6. Đo tác vụ: mở việc được giao, xác định blocker, thực hiện action và quay lại queue; ghi nhận số bước và lỗi hiểu status trước/sau.
7. Check contrast, zoom 200%, long Vietnamese text/code, empty/loading/error state và browser narrow viewport.

## Phụ thuộc và câu hỏi mở

Phụ thuộc API queue/projection có quyền và Next Action tin cậy; spec workflow để status/blocker không bị UI tự suy diễn; access boundary để action không bypass quyền. Cần người dùng chọn nhóm thử nghiệm (PCN, PGD hoặc cả hai), cột bắt buộc trên desktop, tiêu chí ưu tiên deadline/assignment/blocker và nghiệm thu mobile tại môi trường thiết bị thực.

## Spec liên quan

[Workflow/lifecycle](2026-10-22-pgdcn-workflow-and-case-lifecycle-design.md) · [Access/audit](2026-10-22-pgdcn-access-and-audit-boundaries-design.md) · [Mẫu/PTN](2026-10-22-pgdcn-samples-and-lab-results-design.md) · [Tài liệu/AI/Storage](2026-10-22-pgdcn-documents-ai-and-storage-design.md)
