# Đặc tả PCN — Lưu trình hồ sơ động và trang chi tiết riêng

**Ngày:** 2026-09-06  
**Trạng thái:** Thiết kế đã được người dùng duyệt trong hội thoại  
**Branch:** `codex/pcn-dynamic-dossier-workflow`

## Mục tiêu

Thay thế giả định lưu trình PCN cố định theo năm bước bằng workflow template theo loại hồ sơ. Khi tạo hồ sơ, hệ thống chụp một snapshot topology riêng cho hồ sơ đó; người dùng xử lý các node tài liệu/công việc theo đúng snapshot, có thể có nhánh rẽ, node song song, node gom, trả lại và xử lý lại. Khi mở hồ sơ từ bất kỳ danh sách/projection nào, ứng dụng điều hướng tới một trang chi tiết riêng theo `dossierId`.

## Quyết định kiến trúc

### Phương án được chọn

Sử dụng template có version và snapshot per dossier:

```text
WorkflowTemplate (PUBLISHED v3)
              │ clone khi tạo hồ sơ
              ▼
CertificationDossier.workflowSnapshot
              │ runtime state theo từng node
              ▼
PcnDossierWorkflowTask / ActivityLog
              │ projection
              ▼
Dashboard card → /pgdcn/pcn/dossiers/{dossierId}
```

Template là cấu hình dùng lại theo loại hồ sơ; snapshot là bằng chứng topology đã áp dụng. Template mới không được làm thay đổi hồ sơ đang chạy. Runtime task state phải tách khỏi `CertificationDossier.status` để hỗ trợ song song/rẽ nhánh, nhưng các lifecycle/boundary PCN hiện hành tiếp tục dùng `CertificationDossier.status` làm trạng thái tương thích và nguồn quyết định của các module chuyên biệt.

### Các phương án không chọn

1. **Tùy biến graph trực tiếp trên từng hồ sơ:** linh hoạt nhưng khó chuẩn hóa, khó audit và không có catalog dùng lại.
2. **Giữ catalog station hardcode rồi thêm vài biến thể:** ít thay đổi nhưng không đáp ứng node động, parallel join và quản trị template.

## Phạm vi

### Bao gồm

- Workflow template theo loại hồ sơ/Lĩnh vực/phương thức, có `DRAFT`, `PUBLISHED`, `RETIRED` và version bất biến.
- Node tài liệu/công việc, decision, parallel split/join, end; transition có điều kiện và policy.
- Clone snapshot khi tạo hồ sơ và runtime task state theo dossier/node.
- Trạng thái `READY`, `IN_PROGRESS`, `WAITING`, `COMPLETED`, `RETURNED`, `SKIPPED`, `STALE`, `CANCELLED`.
- Trả lại có target node, lý do, cycle và mở lại phạm vi phụ thuộc.
- Quyền sửa template chỉ cho Admin hoặc Quản lý PCN; nhân viên chỉ xử lý task được phép.
- Dashboard card gọn và route chi tiết riêng `/pgdcn/pcn/dossiers/[dossierId]`.
- Trang chi tiết có workflow map, node card đóng/mở, checklist/tài liệu tại node, thông tin hồ sơ và các vùng nghiệp vụ hiện hành.
- Test contract/pure projection, API/RBAC, route và UI; không nhúng PII/file private vào artifact tĩnh.

### Không bao gồm trong đợt này

- WYSIWYG graph editor tự do.
- Tự động suy luận workflow bằng AI.
- Thay thế các boundary chuyên biệt của PYC, KQTN, approval, issuance hoặc Storage.
- Thay đổi workflow PGD.
- Import dữ liệu legacy ngoài policy PCN.

## Mô hình dữ liệu

### `PcnWorkflowTemplate`

Collection đề xuất: `pcnWorkflowTemplates`.

```ts
interface PcnWorkflowTemplate {
  id: string;
  code: string;
  name: string;
  description?: string;
  appliesTo: {
    fieldCodes: string[];
    methods?: string[];
    dossierType?: string;
  };
  version: number;
  status: 'DRAFT' | 'PUBLISHED' | 'RETIRED';
  nodes: PcnWorkflowNodeDefinition[];
  transitions: PcnWorkflowTransitionDefinition[];
  createdAt: string;
  createdBy: string;
  publishedAt?: string;
  publishedBy?: string;
  updatedAt: string;
  updatedBy: string;
}
```

### Node và transition

```ts
type PcnWorkflowNodeKind =
  | 'DOCUMENT_TASK'
  | 'APPROVAL_TASK'
  | 'DECISION'
  | 'PARALLEL_SPLIT'
  | 'PARALLEL_JOIN'
  | 'END';

interface PcnWorkflowNodeDefinition {
  id: string;
  kind: PcnWorkflowNodeKind;
  label: string;
  description?: string;
  actionKey?: string;
  requirementIds: string[];
  assigneeRole?: string;
  slaDays?: number;
  joinPolicy?: 'ALL' | 'ANY' | 'QUORUM';
  quorum?: number;
  active: boolean;
  sortOrder: number;
}

interface PcnWorkflowTransitionDefinition {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  label?: string;
  condition?: string;
  priority?: number;
  returnPolicy?: 'REWORK' | 'RESTART_DEPENDENCIES' | 'RESTART_TEMPLATE';
}
```

`condition` không được thực thi như code tùy ý từ client. Server chỉ chấp nhận một tập predicate đã allowlist, hoặc chuyển quyết định qua boundary domain chuyên biệt. `requirementIds` tham chiếu catalog tài liệu hiện hành; node không được tự tạo requirement hoặc file pointer.

### Snapshot và runtime

`CertificationDossier` bổ sung:

```ts
workflowTemplateId?: string;
workflowTemplateVersion?: number;
workflowSnapshot?: {
  templateCode: string;
  templateVersion: number;
  nodes: PcnWorkflowNodeDefinition[];
  transitions: PcnWorkflowTransitionDefinition[];
  capturedAt: string;
  capturedBy: string;
};
```

Collection runtime đề xuất: `pcnDossierWorkflowTasks`.

```ts
interface PcnDossierWorkflowTask {
  id: string;
  dossierId: string;
  nodeId: string;
  status: 'LOCKED' | 'READY' | 'IN_PROGRESS' | 'WAITING' | 'COMPLETED' | 'RETURNED' | 'SKIPPED' | 'STALE' | 'CANCELLED';
  cycleNo: number;
  assignedUsername?: string;
  returnReason?: string;
  returnTargetNodeId?: string;
  startedAt?: string;
  completedAt?: string;
  updatedAt: string;
  updatedBy: string;
}
```

Activity log vẫn là lịch sử audit append-only. Task state là trạng thái hiện tại; không dùng activity log thay cho current state và không dùng một `currentNodeId` đơn lẻ để đại diện cho nhiều nhánh song song.

## Quy tắc runtime

1. Khi chuyển Đề nghị thành hồ sơ, server xác định đúng một template `PUBLISHED`, kiểm tra điều kiện áp dụng và clone snapshot + task khởi tạo trong cùng transaction/idempotency boundary.
2. Node `DOCUMENT_TASK` chỉ mở khi predecessor/condition/join policy đạt. Checklist lấy từ requirement IDs trong snapshot và được kiểm tra lại theo `PcnDossierDocument` hiện hành hoặc waiver hợp lệ.
3. `PARALLEL_SPLIT` mở nhiều nhánh; `PARALLEL_JOIN` áp dụng `ALL`, `ANY` hoặc `QUORUM`. Nhánh không được mở ngoài topology snapshot.
4. `DECISION` chỉ chọn các cạnh có predicate hợp lệ và lưu kết quả decision; không nhận biểu thức tùy ý hoặc topology từ browser.
5. Trả lại không xóa task/file/history. Server lưu actor, lý do, target node, cycle và đánh dấu node phụ thuộc là `STALE` nếu cần. Sau khi sửa xong, task được mở lại theo target và điều kiện join.
6. Khi node có `actionKey` trỏ tới module hiện hành, action phải gọi boundary chuyên biệt tương ứng. Không cho node generic bypass PYC, KQTN, approval, issuance hoặc private file policy.
7. Template đã `PUBLISHED` không sửa tại chỗ. Admin/Quản lý tạo draft revision, validate graph, publish version mới và ghi audit. Hồ sơ đã có snapshot không bị cập nhật tự động.

## Quy tắc quyền

- Template CRUD/publish/retire: `isPcnSystemManager` ở cả UI và server; mapping hiện hành gồm Admin, `LEADERSHIP` hoặc chức danh có dấu hiệu Quản lý/Trưởng phòng.
- Nhân viên: xem snapshot thuộc scope PCN và xử lý task được assignment/policy cho phép; không đổi node, edge, requirement, template hoặc join policy.
- Viewer: chỉ đọc hồ sơ, map, checklist và phiên file qua private boundary.
- Query route, `node`, `tab` và mọi payload client không được dùng để authorize; server lấy dossier/template/task từ session và database PCN.

## UX và điều hướng

### Dashboard

Giữ một card hồ sơ chuẩn. Card hiển thị mã hồ sơ, khách hàng/sản phẩm, chủ hồ sơ, node đang hoạt động, tiến độ, tài liệu thiếu, trạng thái trả lại và nút `Mở hồ sơ`. Dashboard không render toàn bộ graph và không biến node thành bộ lọc hồ sơ.

### Trang chi tiết

Route canonical: `/pgdcn/pcn/dossiers/[dossierId]`.

- Header: mã hồ sơ, khách hàng, Lĩnh vực, phương thức, owner, trạng thái, deadline.
- Workflow map: node tuần tự, branch, split/join, trạng thái task; desktop cuộn ngang có kiểm soát, mobile xếp dọc.
- Node card collapsed: nhãn, loại tài liệu, trạng thái, assignee và việc tiếp theo.
- Node card expanded: mô tả, checklist, file version hiện tại, lịch sử, bình luận, return reason và thao tác theo quyền.
- Vùng nghiệp vụ: Tổng quan, Tài liệu hồ sơ, Mẫu & PYC, KQTN, Phê duyệt; vùng được chọn bằng node/action key, không tạo route con cho từng node.
- Nút quay lại dùng `router.back()` khi có history hợp lệ, fallback về `/pgdcn/pcn`; link notification/card có thể truyền `?node=<id>&tab=<tab>`.

Không nhúng byte file, token, password hoặc raw PII vào snapshot export/HTML Archify. Bản đồ native chỉ hiển thị dữ liệu đã authorize trong session.

## Tương thích và migration

- Giữ `CertificationDossier.status` và các trạng thái hiện hành để không phá vỡ issuance, PYC, KQTN và báo cáo.
- `PCN_PIPELINE_STATIONS`/`PcnDossierStationKey` trở thành adapter của default template và fallback cho hồ sơ legacy; không còn là giới hạn UI.
- Hồ sơ cũ không có `workflowSnapshot` dùng adapter read-only khi đọc. Mutation liên quan workflow phải materialize snapshot server-side trước khi commit.
- Default template ban đầu map các miền nghiệp vụ hiện hành và requirement catalog hiện tại; không đổi dữ liệu hồ sơ/file cũ khi rollout.
- Backup/restore PCN phải bổ sung collection template/task và bảo toàn snapshot/history.

## Kiểm thử và tiêu chí nghiệm thu

- Pure tests: chọn template deterministic; snapshot bất biến; transition predicate; split/join `ALL`/`ANY`/`QUORUM`; return target/cycle; stale dependency.
- API/RBAC tests: viewer/staff bị từ chối sửa template; Admin/Quản lý được draft/publish; published immutable; snapshot không bị thay đổi khi template revision.
- UI contract tests: dashboard chỉ có một card path; nút mở dùng route dossier; trang detail render graph riêng; panel node đóng/mở; không còn text “5 bước” làm giới hạn PCN.
- Route tests: direct URL, unknown dossier, unauthorized dossier, `node`/`tab` query và back navigation.
- Regression: toàn bộ các boundary upload/private file, proposal/dossier, PYC, KQTN, approval, issuance, archive và audit vẫn giữ behavior hiện hành.
- Visual/runtime: kiểm tra desktop/mobile, branch/parallel map, collapsed/expanded node, route refresh và deep link sau khi server chạy đúng cổng 1357.

## Các file dự kiến

- `types.ts`: type template, snapshot và task runtime.
- `utils/pcnWorkflowTemplate.ts`: validate/resolve template, snapshot và legacy adapter.
- `utils/pcnWorkflowRuntime.ts`: pure transition/readiness/return projection.
- `utils/pcnWorkflowTemplateApi.ts`, `utils/pcnWorkflowTaskApi.ts`: boundary server/client theo pattern PCN hiện hành.
- `store-pcn.ts`: load/merge template, snapshot và task state; mutation chuyên biệt.
- `components/PcnWorkflowMap.tsx`: render graph động từ projection.
- `components/PcnWorkflowNodePanel.tsx`: collapsed/expanded node details.
- `components/PcnDossierDetailPage.tsx` hoặc tách từ `PcnDossierDetailView.tsx`: trang chi tiết canonical.
- `components/PcnWorkflowTemplateManagementView.tsx`: Admin/Quản lý quản lý template.
- `app/pgdcn/pcn/dossiers/[dossierId]/page.tsx`: route hồ sơ riêng.
- `sql/pcn-schema.sql` và migration SQL tương ứng: collections/tables/indexes nếu boundary SQL cần cập nhật.
- `test/pcn-workflow-template.test.ts`, `test/pcn-workflow-runtime.test.ts`, `test/pcn-dossier-route.test.ts`, `test/pcn-workflow-ui.test.ts`.

