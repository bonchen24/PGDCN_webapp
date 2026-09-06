# Archify Full Reader Integration Design

> Ngày: 2026-09-06  
> Branch: `codex/pcn-dynamic-dossier-workflow`  
> Source of truth: `design.md`, mục 0.2.3 và 0.8; các ranh giới dữ liệu, RBAC, private Storage và audit hiện hành không thay đổi.

## Mục tiêu

Hoàn thiện tích hợp Archify vào trang hồ sơ riêng của cả PCN và PGD. Người dùng vẫn có một viewer duy nhất cho từng hồ sơ, nhưng có thể chuyển giữa năm cách đọc do upstream Archify cung cấp: `workflow`, `lifecycle`, `dataflow`, `sequence` và `architecture`. Mỗi cách đọc được dựng từ dữ liệu thật đã được server authorize; không có topology, actor, sự kiện hoặc quan hệ nào do browser tự gửi.

## Phạm vi

### Trong phạm vi

- Dùng đúng upstream renderer/runtime đã vendor tại `vendor/archify/archify`, revision `ed7f4d4b48d4424d36edfed8043de3de8dea6b45`.
- Tạo lớp server renderer chung cho năm diagram type, dùng chính schema và renderer upstream thay vì sao chép layout SVG vào React.
- Tạo bộ adapter dữ liệu riêng cho PCN và PGD:
  - `workflow`: topology snapshot/lifecycle hiện hành, node/task, tài liệu, nhánh, song song, join và return.
  - `lifecycle`: các trạng thái nghiệp vụ hợp lệ, trạng thái hiện tại và lịch sử chuyển trạng thái đã ghi nhận.
  - `dataflow`: đường đi của hồ sơ, tài liệu, mẫu, PYC, KQTN, báo cáo và phê duyệt theo các backlink đã lưu.
  - `sequence`: chuỗi actor/task/document/audit event đã ghi nhận theo timestamp và sequence ổn định.
  - `architecture`: các boundary PCN/PGD, database, private Storage và phòng thử liên quan đến đúng hồ sơ.
- Mở rộng hai endpoint Archify hiện hành bằng query `diagram` được allowlist:
  - `/api/pcn/dossiers/:dossierId/archify?diagram=workflow|lifecycle|dataflow|sequence|architecture`
  - `/api/pgd/requests/:requestId/archify?diagram=workflow|lifecycle|dataflow|sequence|architecture`
- Mở rộng viewer React chung để chuyển diagram type trong cùng trang hồ sơ, giữ light theme, mobile scroll, loading/error state và action dock nghiệp vụ chỉ ở workflow.
- Giữ nguyên export upstream trong reader: SVG/PNG/JPEG/WebP/WebM, Share Card, Route Share Card và Reach Share Card. Các export không chứa private file bytes, token, focus state hoặc camera state.
- Khi dữ liệu chưa đủ để dựng một diagram type, UI hiển thị type ở trạng thái chưa khả dụng kèm lý do; không dựng dữ liệu giả chỉ để thỏa schema tối thiểu.

### Ngoài phạm vi

- Không đưa Archify CLI authoring, `compare`, gallery, guide hoặc các công cụ developer vào navigation nghiệp vụ.
- Không tạo persistence cho diagram type, focus, finder, route, reach, lens, radar, story, camera hoặc preset.
- Không thay đổi lifecycle, quyền xử lý task, template workflow, collection database, file boundary hoặc audit mutation.
- Không cho Archify thực hiện mutation hồ sơ trực tiếp; mọi `Bắt đầu node`, `Hoàn tất node`, `Trả về node` và upload tiếp tục đi qua callback/native API hiện hành.

## Quyết định kiến trúc

### 1. Runtime renderer chung

Tạo `utils/archifyRuntime.ts` với interface:

```ts
export type ArchifyDiagramType =
  | 'workflow'
  | 'lifecycle'
  | 'dataflow'
  | 'sequence'
  | 'architecture';

export type ArchifyDiagramRenderResult = {
  html: string;
  diagramType: ArchifyDiagramType;
  available: true;
};

export type ArchifyDiagramUnavailable = {
  available: false;
  diagramType: ArchifyDiagramType;
  reason: string;
};

export async function renderArchifyDiagram(
  diagramType: ArchifyDiagramType,
  document: unknown,
  context: { domain: 'pcn' | 'pgd'; recordId: string },
): Promise<ArchifyDiagramRenderResult>;
```

`workflow` tiếp tục dùng `workflow-compiler.mjs` và `utils.mjs` trực tiếp như hiện tại. Bốn renderer CLI-oriented còn lại được gọi qua một runner server-only sử dụng chính `render-architecture.mjs`, `render-dataflow.mjs`, `render-sequence.mjs` và `render-lifecycle.mjs` của upstream, với input/output trong thư mục tạm riêng của request. Runner phải:

- Dùng `process.execPath`, absolute vendor path và không nhận path từ request.
- Ghi JSON input tạm với `mkdtemp`, đọc HTML output, rồi luôn cleanup trong `finally`.
- Timeout sau 15 giây, giới hạn output chẩn đoán và trả lỗi 422 an toàn nếu schema/layout upstream từ chối dữ liệu.
- Không ghi output vào workspace, không để renderer đọc `ARCHIFY_REPO_ROOT` hoặc repository evidence của server.
- Dùng cùng bước normalize root HTML sang `data-theme="light"` và inject focus bridge same-origin tối thiểu của renderer hiện tại.

Không sửa layout/interaction của upstream reader. Nếu cần một export function cho test, chỉ thêm thin server bridge quanh entrypoint; không fork lại thuật toán layout.

### 2. Adapter dữ liệu và hợp đồng availability

Tạo một type suite server-only dùng discriminated union:

```ts
type ArchifyDossierSuite = {
  workflow: ArchifyWorkflowDocument;
  lifecycle: ArchifyLifecycleDocument;
  dataflow: ArchifyDataflowDocument | ArchifyDiagramUnavailable;
  sequence: ArchifySequenceDocument | ArchifyDiagramUnavailable;
  architecture: ArchifyArchitectureDocument;
};
```

Adapter không truyền file bytes. Tài liệu chỉ được biểu diễn bằng requirement/document id, version, trạng thái, node liên kết và metadata tối thiểu đã authorize. Activity chỉ lấy actor snapshot an toàn, action/entity, createdAt, sequence và label đã redact.

PCN adapter đọc `workflowSnapshot`, `pcnDossierWorkflowTasks`, `PcnDossierDocument`/waiver, PYC/mẫu/KQTN, approval steps và activity/flow facts đã route server lấy được. PGD adapter đọc request lifecycle, checklist/dossier documents, assignment, field inspection, sample, lab request/result, report, certificate, approvals và activity facts của đúng request.

Nguyên tắc dựng quan hệ:

- Workflow dùng transition authored và return policy trong snapshot; không suy diễn cạnh từ vị trí node.
- Lifecycle dùng state catalog hợp lệ và event/status transition đã lưu; trạng thái hiện tại là tag, không giả tạo mốc thời gian.
- Dataflow chỉ nối hai bản ghi khi có backlink/id liên kết thật; thiếu backlink thì bỏ quan hệ và đưa cảnh báo vào card.
- Sequence chỉ dùng activity/task/document events có timestamp hợp lệ; participant `Hệ thống PCN`/`Hệ thống PGD` là boundary thực hiện request, không phải actor giả.
- Architecture chỉ thêm boundary liên quan khi có record/route/persistence fact tương ứng; không thêm PTN nếu hồ sơ không có PYC PTN.

Các adapter tạo stable IDs từ khóa nghiệp vụ hiện có, giữ map ID riêng theo diagram type và validate toàn bộ reference trước khi gọi upstream. Mỗi document có tối đa 5 guided views, focus chỉ chứa semantic IDs tồn tại.

### 3. API và bảo mật

Hai route Archify parse `diagram` bằng allowlist cố định, mặc định `workflow`, từ chối giá trị khác bằng 400. Route vẫn gọi `requirePcnSession`/`requirePgdSession`, kiểm tra ownership/scope như route hiện tại và tự query dữ liệu server-side. `embed`, `theme` và `focus` chỉ ảnh hưởng presentation, không làm thay đổi authorization.

Response HTML dùng `Content-Type: text/html` và `Cache-Control: private, no-store`. Lỗi renderer trả JSON an toàn khi chưa gửi body; không trả stack trace, SQL, filesystem path, secret, file bytes hoặc dữ liệu ngoài scope. Reader bridge chỉ gửi `{ source, domain, recordId, nodeId?, edgeId? }` tới parent cùng origin.

### 4. Viewer UX

`PcnArchifyWorkflowEmbed.tsx` được mở rộng thành viewer diagram chung nhưng giữ tên file/import để tránh tạo hai implementation. Header compact có:

- Mã hồ sơ và badge `ARCHIFY`.
- Một select/button group cho năm diagram type, chỉ enable các type có `available=true`.
- Mô tả ngắn loại sơ đồ và lý do khi type chưa đủ dữ liệu.
- Iframe duy nhất, `theme=light`, responsive height và containment/scroll theo chuẩn `design.md`.

Workflow tiếp tục mở action dock PCN khi chọn node. Lifecycle/dataflow/sequence/architecture chỉ dùng Semantic Passport/read controls của upstream; không nhân bản Passport hoặc toolbar trong React. PGD không nhận callback mutation từ Archify nếu native surface chưa có mutation boundary tương ứng.

Diagram type được truyền qua query URL để deep-link và refresh được cùng view, nhưng không lưu DB. Khi đổi type, component reset frame state và selected node/edge, giữ hồ sơ đang mở và không reload toàn app. Nếu iframe lỗi, hiển thị error state sáng có nút thử lại.

### 5. Verification

Bộ test phải bao phủ:

- Mỗi adapter PCN/PGD tạo document đúng schema upstream cho năm diagram type.
- Workflow vẫn giữ node động, branch, parallel join, return và document status hiện có.
- Lifecycle không tạo event chưa lưu; dataflow không tạo cạnh thiếu backlink; sequence sort ổn định và redacts actor; architecture không thêm boundary không có evidence.
- Renderer dùng đúng vendor entrypoint/template, normalize theme light, cleanup input/output tạm và fail closed với diagram type/path/schema không hợp lệ.
- Hai route allowlist `diagram`, session/RBAC, no-store và không nhận topology từ browser.
- Viewer có selector, disabled-unavailable state, loading/error/retry, action dock chỉ workflow, mobile height và same-origin message guard.
- Full `npm test`, `npm run lint`, `npm run build`, `git diff --check`; Docker production rebuild và `/api/health` HTTP 200.

## Tiêu chí nghiệm thu

1. Mở một hồ sơ PCN hoặc PGD ở trang riêng thấy viewer Archify thật, mặc định `workflow`, không còn sơ đồ trạm dọc làm bản đồ chính.
2. Chuyển được sang `lifecycle`; trạng thái hiện tại và lịch sử đã ghi nhận vẫn phân biệt rõ với trạng thái catalog chưa đi qua.
3. Khi hồ sơ có đủ liên kết, `dataflow`, `sequence` và `architecture` render bằng renderer upstream, giữ stable IDs và hỗ trợ Finder/Passport/reach/route/lens/story/export.
4. Khi thiếu dữ liệu cho một view, người dùng thấy lý do rõ ràng và không thấy topology giả.
5. Node workflow vẫn có thể thực hiện action qua boundary PCN hiện hành; Archify không tự ghi database.
6. Hai miền dùng cùng viewer và runtime nhưng không trộn dữ liệu, scope, asset hoặc mutation.
7. Mobile có scroll dọc, light surface và không xuất hiện khung đen ở host/fallback/reader.

