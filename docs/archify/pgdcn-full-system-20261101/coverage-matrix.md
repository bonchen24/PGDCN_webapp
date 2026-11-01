# Coverage matrix — bàn giao cuối PGDCN

Snapshot source: `521f8d517560f3767321c19ad492658bb507b4b4`. Bắt đầu tại [`index.html`](./index.html): ba sơ đồ chính, 13 profile hồ sơ cụ thể, sau đó là 20 sơ đồ tham chiếu.

## Ba sơ đồ chính

| Map | Scope và nội dung | Vai trò / gate | Status và bằng chứng |
|---|---|---|---|
| [00 · Sơ đồ vận hành hệ thống](./00-system-operation.html) | Intake khách hàng; đủ 13 đích menu; fork PCN/PGD; proposal/PYC, dossier, phân công; mẫu → PTN → KQTN; DOCX/checklist, AI/OCR, review/ký; issue/deliver/archive; notification/audit; Next API, RBAC, dữ liệu và storage. | Lane khách hàng, chuyên viên domain, quản lý/reviewer/ký, nền tảng/API và PTN ngoài. Có điều kiện rẽ, chờ, trả sửa và giới hạn UI/API. | `IMPLEMENTED` theo source. 22 node handbook. Source pointer trên từng node; receipt và digest được test. |
| [03 · Luồng hồ sơ chứng nhận (PCN)](./03-pcn-canonical.html) | Meta-workflow: `CertificationProposal` → tìm template `PUBLISHED` phù hợp → tạo đúng một `CertificationDossier`/checklist → assignment/claim → immutable `workflowSnapshot` → node type và nhánh động → file, sample/PTN khi snapshot yêu cầu → review/approval/ký → issue/deliver/archive. | Gate proposal/template, owner/scope, node requirements, nhánh, parallel join `ALL / ANY / QUORUM` nếu snapshot khai báo, waiver, currentVersion/confirm-to-dossier, review và signature. Return/rework có lý do/audit. Không áp một node graph cố định cho mọi case. | Hành vi PCN `IMPLEMENTED`; live template ID/version/PUBLISHED status `NOT_VERIFIED`. 13 node handbook. Intake route `app/api/pcn/intake/route.ts:130-194`; template/snapshot contract `utils/pcnWorkflowTemplate.ts:37-155`. |
| [04 · Luồng hồ sơ giám định (PGD)](./04-pgd-canonical.html) | Đúng rail 12 nhiệm vụ: 1 Tiếp nhận PYC; 2 Kiểm tra phạm vi & năng lực; 3 Phân công giám định; 4 Lập kế hoạch; 5 Kiểm tra hiện trường; 6 Lấy mẫu & niêm phong; 7 Giao mẫu / lập PYC PTN; 8 Tiếp nhận KQTN; 9 Xem xét KQTN; 10 Lập báo cáo; 11 Phê duyệt & ký; 12 Trả kết quả & lưu trữ. | 5 backend business stages; PYC/capability/assignment gates; sampling theo scope/method và không giả định có skip chung; KQTN liên kết `requestId` + `labRequestId`; rework về review/report; approvals và package/hash gates. | Canonical rail `IMPLEMENTED`; live workflow template ID/version/PUBLISHED `NOT_VERIFIED`. 12 node handbook. Task names `components/PgdDossierStepWorkPanel.tsx:48-60`; backend stage/gates `utils/pgdWorkflow.ts:33-76,148-199`. |

## Áp dụng theo loại bộ hồ sơ trong code catalog

Các hồ sơ dưới đây là source-configured profiles. Database workflow records và published versions chưa được đọc; vì vậy không có hồ sơ nào được gắn nhãn PUBLISHED. Mỗi map PGD chuyên biệt hóa file/điều kiện theo code profile trên rail 12 bước.

| Domain / mã | Profile hoặc pack | Catalog evidence | Bản đồ |
|---|---|---|---|
| PCN / QC4 | `QC4_BLANK_PACK`; 14 baseline checklist items | `utils/pcnDossierDocuments.ts:24-118`; `CONFIGURED_IN_CODE`, `isBlank:true`; không có workflow version trong catalog | [20 · QC4](./20-pcn-qc4-pack.html) |
| PCN / QC9 | `QC9_BLANK_PACK`; 17 items, gồm 3 thư tùy điều kiện | `utils/pcnDossierDocuments.ts:24-118`; `CONFIGURED_IN_CODE`, `isBlank:true`; không có workflow version trong catalog | [21 · QC9](./21-pcn-qc9-pack.html) |
| PGD / GĐ-THEP-KG | `STEEL_LOT_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [22 · Thép theo lô](./22-pgd-steel-kg.html) |
| PGD / GĐ-THEP-TT58 | `STEEL_TT58_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [23 · Thép TT58](./23-pgd-steel-tt58.html) |
| PGD / GĐ-MAY-01 | `MACHINERY_LINE_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [24 · Máy móc/dây chuyền](./24-pgd-machinery.html) |
| PGD / GĐ-THAN-01 | `COAL_LOT_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [25 · Than](./25-pgd-coal.html) |
| PGD / GĐ-NGOAI-01 | `OUTSIDE_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [26 · Hàng ngoài trời](./26-pgd-outside.html) |
| PGD / GĐ-HH-01 | `GENERAL_GOODS_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [27 · Hàng hóa chung](./27-pgd-other-goods.html) |
| PGD / GĐ-THEP-CB | `STEEL_CAO_BANG_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [28 · Thép Cao Bằng](./28-pgd-steel-cb.html) |
| PGD / GĐ-MAY-TN | `MACHINERY_MANUFACTURING_THAI_NGUYEN_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [29 · Máy móc Thái Nguyên](./29-pgd-machinery-thai-nguyen.html) |
| PGD / GĐ-SL-KL-01 | `QUANTITY_WEIGHT_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [30 · Số lượng/khối lượng](./30-pgd-quantity-weight.html) |
| PGD / GĐ-TTXX-01 | `CONDITION_ORIGIN_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [31 · Tình trạng/xuất xứ](./31-pgd-condition-origin.html) |
| PGD / GĐ-NGOAI-CT | `OUTSIDE_COLUMN_BRACES_INSPECTION` | `utils/pgdDomain.ts:234-447`; `active:true`; workflow record `NOT_VERIFIED` | [32 · Cột chống ngoài trời](./32-pgd-outside-column-braces.html) |

## Node handbook và tài liệu theo bước

| Deliverable | Coverage |
|---|---|
| [`node-handbook.html`](./node-handbook.html) / [`node-playbook.json`](./node-playbook.json) | 197 entries, mỗi entry gắn map ID + diagram node ID, việc cần làm, URL, actor/reviewer/handoff, RBAC/read-only, input/precondition, file in/out, guard, branch/rework, after-state, implementation status và source line ranges. Fragment `#node=<id>` chọn đúng node; viewer đồng bộ map. |
| [`document-matrix-pcn.html`](./document-matrix-pcn.html) | 18 dòng: 9 stage × QC4/QC9. `workflowSnapshot`/native-node requirements được ghi là data-driven, không gán danh sách file giả cho node chưa xác minh. |
| [`document-matrix-pgd.html`](./document-matrix-pgd.html) | 132 dòng: 12 task × 11 profile, kể cả file baseline/conditional và file mở rộng theo product group. |
| [`source-evidence-final.md`](./source-evidence-final.md) | Gộp source pointer theo file/range cho node handbook; test kiểm tra file tồn tại và line range trong snapshot. |

### Cách hiểu trạng thái file

- PCN/PGD checklist record dùng `MISSING / PRESENT / WAIVED`; `PRESENT` phải gắn current file/version theo contract tương ứng.
- PCN DOCX draft chưa complete cho tới khi confirm-to-dossier; file upload chưa attach/current asset chưa đạt; review/verification là gate riêng; bản cũ có thể là `SUPERSEDED`.
- PGD checklist không khai báo per-file `DRAFT / GENERATED / CONFIRMED`; upload không liên kết không đạt package gate. Package kiểm tra completeness, private asset và hash. `WAIVED` chỉ được nêu khi có record; mutation path chưa xác minh.
- Required/default/optional được lấy từ source code baseline/profile và điều kiện ghi cạnh từng tài liệu. Runtime DB merge/override `NOT_VERIFIED`.
- PGD DOCX manifest version 1.3 và PCN DOCX catalog mô tả biểu mẫu; chúng không phải workflow-template version/status.

## 20 sơ đồ tham chiếu kỹ thuật

Giữ nguyên atlas nền đã tạo; ba sơ đồ đầu tiên hiện là entry maps riêng. Các trang tham chiếu: `00-master.html`, `01-navigation.html`, `02-pcn-intake-assignment.html`, `03-pcn-dynamic-workflow.html`, `04-pgd-12-steps.html`, `05-documents-and-templates.html`, `06-samples-and-lab.html`, `07-pgd-evidence-approval-package.html`, `08-auth-rbac.html`, `09-ai-ocr.html`, `10-system-architecture.html`, `11-data-lineage.html`, `12-data-model-erd.html`, `13-audit-notifications.html`, `14-customers-and-work-queues.html`, `15-deployment-security.html`, `16-sequence-pcn-create.html`, `17-sequence-document-upload-attach.html`, `18-sequence-pgd-pyc-kqtn.html`, `19-sequence-pcn-approval-release.html`.

## Kiểm tra và giới hạn

- Kiểm tra tĩnh: `node --test docs/archify/pgdcn-full-system-20261101/test/atlas-integrity.test.cjs`.
- Mỗi 16 workflow map có Archify CLI 3.1.0 `finalize --quality showcase`; test xác nhận `validate`, `deliver`, `check`, `browser-check` và SHA-256 candidate.
- 5 map đại diện có visual receipt ở 1440×900 và 2048×1320, sáng/tối. Landing/viewer được smoke-test bằng Playwright qua localhost; static pages dùng relative paths, không kéo tài nguyên UI từ mạng.
- Không có kết nối database đọc-only cho template definitions; không đọc private customer/case records hoặc file bytes, không ghi database.
- Chỉ tài liệu Archify trong branch/worktree `task/c2c/full-system-archify-20261101` thay đổi; không sửa runtime/deploy/schema.
