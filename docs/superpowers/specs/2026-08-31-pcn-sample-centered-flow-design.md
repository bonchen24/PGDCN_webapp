# Thiết kế sổ mẫu thử và luồng PYC kết hợp

## Mục tiêu

Đổi bề mặt **PYC & luân chuyển mẫu** từ danh sách lấy PYC/tuyến làm dòng chính thành sổ lấy `PcnSampleLot` làm đối tượng trung tâm. Người vận hành phải nhìn thấy ngay mỗi mẫu/lô mẫu cần đi qua phòng thử nào, đang ở chặng nào, vị trí hiện tại, PYC của từng phòng đã tồn tại hay chưa và KQTN đã về hay chưa.

## Quyết định nghiệp vụ đã duyệt

- Một mẫu/lô mẫu có một tuyến phòng thử tuần tự. Ví dụ tuyến QC4/QC9 có thể là `Hiệu suất → EMC → An toàn điện`; QC20 mặc định là tuyến `Phân tích thành phần hóa học / Hóa lý`.
- Các mẫu/lô mẫu khác nhau trong cùng một hồ sơ chạy song song. Trạng thái hoặc sự cố của mẫu này không khóa các luồng mẫu khác.
- PYC là chứng từ outbound của từng chặng, không phải đối tượng bao ngoài mẫu. Mỗi chặng phải chỉ rõ `Đã có PYC` hoặc `Chưa có PYC`.
- Projection quản lý là read-only. Tạo/sửa PYC, giao/nhận mẫu, cập nhật route và tiếp nhận KQTN vẫn đi qua card hồ sơ và boundary hiện có.

## Phạm vi

### Trong phạm vi

- Bổ sung thứ tự chặng ổn định cho `PcnSampleRoute` và adapter tương thích dữ liệu cũ chưa có thứ tự.
- Xây projection nhóm theo mẫu/lô mẫu, gom route, PYC và KQTN liên kết vào một cấu trúc hiển thị.
- Redesign `PcnLabOperationsView` thành các card mẫu với stepper route; giữ tìm kiếm và nút mở card hồ sơ.
- Cập nhật KPI theo mẫu: tổng mẫu, đang ở PTN, chờ PYC, chờ KQTN và có sự cố.
- Thêm test contract cho thứ tự route, PYC thiếu/đủ, KQTN liên kết, nhiều mẫu chạy song song và dữ liệu PYC không gắn route.

### Ngoài phạm vi

- Không tạo collection hoặc endpoint workflow mới.
- Không thay đổi state machine năm bước của `CertificationDossier`.
- Không biến projection read-only thành nơi mutation.
- Không tự tạo PYC khi route thiếu PYC.
- Không phục hồi các màn hình DDT/legacy hoặc lịch thử nghiệm.

## Mô hình dữ liệu và projection

`PcnSampleLot` vẫn là nguồn dữ liệu mẫu. `PcnSampleRoute` được mở rộng với `sequence?: number` để tương thích record cũ; dữ liệu mới sinh từ flow phải có sequence bắt đầu từ 1. Khi record cũ không có sequence, helper browser-safe dùng thứ tự danh mục `PCN_SAMPLE_LAB_OPTIONS` và `createdAt`/`id` làm tie-breaker ổn định, không ghi ngược vào database.

Projection mới nên có ranh giới rõ trong `utils/pcnLabOperations.ts`:

```ts
interface PcnSampleFlowProjection {
  id: string;
  dossierId: string;
  dossierCode: string;
  proposalCode: string;
  customerName: string;
  productName: string;
  lotId: string;
  lotCode: string;
  sampleName: string;
  model?: string;
  brand?: string;
  quantity: number;
  unit?: string;
  lotStatus: PcnSampleLot['status'];
  currentLocation: string;
  activeRouteId?: string;
  activeRouteCount: number;
  hasDataIssue: boolean;
  routes: PcnSampleFlowRouteProjection[];
}

interface PcnSampleFlowRouteProjection {
  routeId: string;
  sequence: number;
  labCode: PcnSampleRoute['labCode'];
  labName: string;
  routeStatus: PcnSampleRoute['status'];
  readiness: 'COMPLETED' | 'CURRENT' | 'READY' | 'BLOCKED' | 'CANCELLED';
  labRequestId?: string;
  pycNumber?: string;
  pycStatus?: OutboundLabRequest['status'];
  hasLabRequest: boolean;
  resultReportNumber?: string;
  resultOutcome?: ReturnedTestResult['outcome'];
  requestedAt?: string;
  sentAt?: string;
  receivedAt?: string;
  resultReturnedAt?: string;
  issueDescription?: string;
}
```

The exact property names can be adjusted to existing type conventions, but the behavior is mandatory:

- Routes are sorted by `sequence`; ties use lab catalog order, then `createdAt`, then `id`.
- `hasLabRequest` is true only when the route has a valid linked request through `route.labRequestId`, `request.sampleRouteId`, or the existing canonical route linkage. A request for the same dossier alone must not be guessed as belonging to a route.
- `readiness` is `COMPLETED` for a route with `RESULT_RETURNED`, `RETURNED_TO_PCN` or `CLOSED`; `CURRENT` for the active received/sent/result-pending route; `READY` only for the first pending route or a pending route whose prior route has completed; `BLOCKED` for a later pending route whose prior route is not complete; and `CANCELLED` for cancelled routes.
- More than one `CURRENT` route in a single lot sets `hasDataIssue=true` and exposes a visible warning. The projection must not silently choose one route as the only current location.
- A `labRequests` record without a matching route remains visible in an explicit unlinked-PYC section/card so operators can resolve the linkage; it must not be attached to an arbitrary route.

## UI behavior

`PcnLabOperationsView` keeps the existing PCN shell and compact density but changes the visual hierarchy:

1. Header: “Sổ mẫu thử & luân chuyển”, short explanation, search field.
2. KPI: counts by sample lot, not route.
3. Each sample card: lot/sample identity, dossier/customer, quantity, current location, lot status and issue warning.
4. Route stepper: ordered lab nodes with route status, PYC status, KQTN summary and dates. The current node is visually emphasized; missing PYC is explicit.
5. Actions: open canonical dossier card, and where an existing callback is available, open the relevant dossier region. No direct mutation is introduced in the projection.

Search must cover dossier code, proposal code, customer, product, lot code, sample name, model, brand, lab name/code, PYC number, current location and issue text. Mobile uses horizontal scrolling for the route stepper while keeping sample identity and current location visible before the scroll area.

The old route-row builder may remain as a compatibility adapter only if existing callers/tests depend on it; the active view must consume the sample-grouped projection. The screen copy must not describe itself as “Tổng hợp PYC outbound” when the primary object is the sample.

## Data integrity and compatibility

- No mutation is performed while deriving the projection.
- A missing lot, missing dossier or missing proposal is represented with neutral fallback labels and an integrity warning; the page must not crash.
- Existing routes without `sequence` continue to render in deterministic order.
- Existing unlinked PYC rows remain visible and searchable.
- No changes are made to persistence boundaries, audit semantics or PCN RBAC.

## Verification criteria

- Unit/contract tests prove a lot with three routes renders three ordered route nodes and marks only the valid next node ready.
- Tests prove two lots in one dossier produce two independent projections and a current route in one lot does not block the other lot.
- Tests prove a route with no linked PYC shows `hasLabRequest=false` even when another PYC exists for the same dossier.
- Tests prove returned KQTN is joined only through the linked PYC and is shown on the correct route.
- Tests prove legacy route data without sequence is deterministic.
- UI contract tests prove the page uses sample-centered labels, renders the route stepper and shows explicit “Chưa có PYC”.
- `npm run typecheck`/project-equivalent type validation, targeted PCN tests, `git diff --check` and production build are run before completion.

