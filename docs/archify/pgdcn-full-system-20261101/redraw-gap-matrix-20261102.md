# Ma trận rà soát và làm mới atlas Archify · 2026-11-02

Phạm vi đối chiếu: worktree `master` sạch tại `348b855a57595eec2646bb462e5c29571c3be501`, không đọc DB. Bản nguồn hiện hành là code trong commit này; mọi bản ghi template `PUBLISHED` đang hoạt động vẫn `NOT_VERIFIED`.

| Phạm vi | Tình trạng trước khi sửa | Việc cần làm | Ranh giới bằng chứng |
| --- | --- | --- | --- |
| `00-system-operation.workflow.json` | Sơ đồ 22 node đã có lane, nhưng đường PCN/PGD và handoff PTN/tài liệu còn gom thành đường tổng quan đơn giản; source pin `521f8d5`. | Vẽ lại hành trình chung rồi tách hai domain; cho thấy vai trò/API, ranh giới PTN, review/ký/giao/lưu và các điều kiện chính; chỉ giữ quan hệ được source hỗ trợ. | Không biểu diễn Atlas thành UI vận hành; quyền và trạng thái vẫn do API/domain gate quyết định. |
| `03-pcn-canonical.workflow.json` | 13 node nhưng nhánh workflow động được gom vào một node tổng hợp; source pin `521f8d5`. | Vẽ lại Đề nghị hợp lệ → chọn template → một dossier + snapshot → node/nhánh/join → checklist/DOCX/PTN → review/approval → issue/deliver/archive; thể hiện return/rework và join theo policy. | ID/version/status của bản ghi `PUBLISHED` thực tế giữ `NOT_VERIFIED`; QC4/QC9 là phạm vi code, không phải dữ liệu DB. |
| `04-pgd-canonical.workflow.json` | 12 tác vụ đúng thứ tự nhưng đa số chỉ có một cạnh sang bước kế tiếp; chưa tách rõ điều kiện, bàn giao và vòng trả sửa. | Giữ đủ 12 tác vụ, làm rõ owner/handoff, gate PYC/năng lực/phân công, KQTN, review, ký và trả sửa; hồ sơ bắt đầu từ PYC giám định. | Không thêm lối bỏ bước hoặc điều kiện PTN nếu code chưa xác nhận; phạm vi/method và các giới hạn chưa thể xác minh ghi `NOT_VERIFIED`. |
| 13 profile (`20–32`) | Đúng 2 pack QC4/QC9 và 11 profile catalog PGD đang có trong source; các sơ đồ còn chủ yếu lặp 9/12 nhãn tác vụ; source pin `521f8d5`. | Giữ đúng 13 profile. Làm rõ product group/profile/method, tài liệu nền bắt buộc, tài liệu tùy chọn/điều kiện, bước tạo DOCX hay nhận upload, trạng thái hồ sơ và owner; nối về handbook/matrix. | Profile/mẫu DOCX cấu hình trong code không đồng nghĩa template workflow `PUBLISHED` hoặc ID/version thực tế. Trigger không có trong code được ghi `NOT_VERIFIED`. |
| `node-playbook.json` / handbook / matrix / index | Có 197 node entry đủ trường cấu trúc; test integrity nền đạt 7/7. Generator ghim revision `521f8d5`, nên provenance chưa phản ánh master hiện tại. | AGY rà soát nội dung từ code; chạy builder để cập nhật revision, 197 entry, ledger, ma trận và liên kết theo các candidates mới; giữ một `index.html` làm cổng vào. | Mỗi node giữ role/actor, input/output, gate/branch, handoff, trạng thái tài liệu và nguồn; dữ liệu thực tế chưa biết đánh dấu `NOT_VERIFIED`. |
| Sơ đồ kỹ thuật `03`, `05`, `06`, `07`, `08`, `17`, `19` | Cùng source pin cũ; lần lượt bao quát graph PCN, tài liệu/template, mẫu/PTN, PGD evidence/approval, RBAC, upload/attach và release. | Cập nhật bảy bản đồ có bằng chứng cụ thể: nhánh song song hội tụ độc lập; DOCX draft/confirm/attach; PCN route per item và PYC theo lot; PGD manifest/hash/approval; API authorization; upload ngoài vs DOCX tạo nội bộ; release/return state riêng. | Không redraw 13 tham chiếu còn lại khi không có mâu thuẫn cụ thể. `RESULT_RETURNED` của PGD không bị nhầm với approval return; đường mutation `RETURNED` hiện vẫn `NOT_VERIFIED`. |

## Đối chiếu cấu hình PGD

`utils/pgdDomain.ts` khai báo 11 profile hoạt động và bốn `productGroup`: `STEEL_METAL`, `MACHINERY_LINE`, `COAL`, `OTHER`. `utils/pgdDossier.ts` phân biệt tài liệu mặc định với tài liệu tùy chọn có điều kiện, đồng thời liệt kê một số yêu cầu field/lab ở base checklist. Chỉ cờ `required` trong code không đủ chứng minh điều kiện áp dụng cho mọi hồ sơ; khi code không biểu đạt trigger hoặc trạng thái N/A, atlas phải nêu rõ bất định, không tự thêm quy tắc.

## Kiểm tra nền

- `node --test docs/archify/pgdcn-full-system-20261101/test/atlas-integrity.test.cjs`: 7/7 đạt trước chỉnh sửa.
- Candidate workflow hiện ghim `521f8d517560f3767321c19ad492658bb507b4b4`; các candidate được làm mới sẽ ghim commit nguồn sạch `348b855a57595eec2646bb462e5c29571c3be501` trước khi Archify finalize.
- Không thay đổi app UI, schema, API, quyền, DB hay deployment.

## Kết quả redraw và nghiệm thu (2026-11-02)

- Baseline: clean local master 348b855a57595eec2646bb462e5c29571c3be501; nguồn và các candidate đều ghim cùng revision này.
- Đã redraw 3 sơ đồ chính, 13 profile theo catalog mã (QC4/QC9 + 11 PGD active), và 7 tham chiếu kỹ thuật 03, 05, 06, 07, 08, 17, 19. Cả 23 candidate đều có receipt Archify hiện hành khớp SHA và đạt đủ validate → deliver → check → browser-check.
- 00-system-operation tách PCN/PGD, PYC vs CertificationProposal, ranh giới PTN, role/API gate và chuỗi review/ký/giao/lưu. 03-pcn-canonical thể hiện proposal → single dossier/snapshot, node task, branch/join có điều kiện, reasoned return/rework, checklist/DOCX/PTN, approval, issue/delivery/archive. 04-pgd-canonical giữ đúng 12 tác vụ trên 5 trạm backend; sampling/PTN là gate theo case/profile, không tự đặt skip.
- 13 profile nêu rõ group/profile/method, baseline vs optional/conditional, tạo DOCX vs upload, actor và gate. Candidate/document matrix liên kết asset DOCX trong repo; file generated chỉ complete sau confirm + attach. node-playbook.json và handbook có 197 mục, mỗi mục có actor, action, input/output, gate/branch, handoff, file status và evidence source.
- 7 technical maps được cập nhật đúng phạm vi ưu tiên: runtime split/join/return, document template vs checklist, PCN lot/item routing và PGD result boundary, approval package/manifest, API RBAC, generated DOCX vs external upload, issuance/release. Các map tham chiếu khác không redraw.
- Ảnh trước: review/redraw-20261102/before/{00-system-operation,03-pcn-canonical,04-pgd-canonical}/. Ảnh sau + receipts: review/redraw-20261102/after/{00-system-operation,03-pcn-canonical,04-pgd-canonical}/; mỗi map có capture sáng/tối ở 1440x900 và 2048x1320. Visual-check pass; không tràn ngang, PGD contained; hai map cao dùng cuộn dọc được Archify chấp nhận.
- ID/version/status của workflow/template runtime PUBLISHED vẫn NOT_VERIFIED; PCN QC4/QC9 và PGD được giữ là code profiles, không gán thành DB ID. PGD trigger/N/A cho tài liệu khi code không xác định cũng được ghi NOT_VERIFIED.
- Không truy cập DB, migration, Docker/deployment hay ghi dữ liệu. Phiên bản Archify dùng là 3.1.0; CLI báo có bản 3.2.0, không tự cập nhật.

- QA kết thúc: atlas-integrity 7/7; handbook 197/197 đủ trường và source; 263 link DOCX trên 150 dòng matrix đều tồn tại; không có template version bằng commit SHA. npm run typecheck và npm run build đều thành công; git diff --check pass.
