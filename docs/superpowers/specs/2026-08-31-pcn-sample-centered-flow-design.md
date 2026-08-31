# Thiết kế sổ mẫu thử và luồng PYC kết hợp

## Mục tiêu

Đổi bề mặt **PYC & luân chuyển mẫu** từ danh sách lấy PYC/tuyến làm dòng chính thành sổ lấy `PcnSampleLot` làm đối tượng trung tâm. Người vận hành phải nhìn thấy ngay mỗi mẫu/lô mẫu cần đi qua phòng thử nào, đang ở chặng nào, vị trí hiện tại, PYC của từng phòng đã tồn tại hay chưa và KQTN đã về hay chưa.

## Quyết định nghiệp vụ đã duyệt

- Mỗi mẫu/model trong lô có một tuyến phòng thử tuần tự theo các route áp dụng cho item đó. Ví dụ tuyến QC4/QC9 có thể là `Hiệu suất → EMC → An toàn điện`; QC20 mặc định là tuyến `Phân tích thành phần hóa học / Hóa lý`.
- Các mẫu/model trong cùng một lô và các lô khác nhau trong cùng một hồ sơ chạy song song độc lập. Trạng thái hoặc sự cố của mẫu này không khóa các luồng mẫu khác.
- PYC là chứng từ outbound của từng chặng, không phải đối tượng bao ngoài mẫu. Mỗi chặng phải chỉ rõ `Đã có PYC` hoặc `Chưa có PYC`.
- Một PYC tương ứng đúng một lô. Một lô có thể có nhiều mẫu/model, nhiều loại mẫu và mỗi mẫu có quantity riêng từ 1 trở lên. PYC gửi tới từng phòng thử vẫn chỉ chứa một lô; nếu cùng lô đi nhiều phòng thì mỗi phòng có PYC riêng cùng liên kết về `pcnLotId`.
- `PcnSampleItem` là đối tượng nghiệp vụ chính bên trong lô. Mọi projection, payload tích hợp và trạng thái thực thi mới phải giữ được liên kết `pcnSampleItemId`; các trường mẫu đơn trên `PcnSampleLot` chỉ dùng tương thích dữ liệu cũ.
- Projection quản lý là read-only về dữ liệu nghiệp vụ. Người dùng được tạo và gửi PYC trong card hồ sơ; server PCN chịu trách nhiệm gửi sang app phòng thử và nhận ACK. Giao/nhận mẫu, cập nhật route và tiếp nhận KQTN vẫn đi qua các boundary tương ứng.
- PCN là nguồn chuẩn của `PcnSampleLot`, thứ tự route, PYC và khóa liên kết; app phòng thử là nguồn chuẩn của lịch thực thi, thời điểm bắt đầu/kết thúc và trạng thái thử tại phòng. PCN không dùng chung database với app đích.
- Kết quả `FAIL` do app phòng thử báo được lưu như snapshot thực thi để điều phối nhanh. KQTN chính thức vẫn là `ReturnedTestResult` của PCN sau khi người dùng tiếp nhận bản scan/kết quả theo boundary hiện hành.

## Phạm vi

### Trong phạm vi

- Bổ sung thứ tự chặng ổn định cho `PcnSampleRoute` và adapter tương thích dữ liệu cũ chưa có thứ tự.
- Xây projection nhóm theo mẫu/lô mẫu, gom route, PYC và KQTN liên kết vào một cấu trúc hiển thị.
- Redesign `PcnLabOperationsView` thành các card mẫu với stepper route; giữ tìm kiếm và nút mở card hồ sơ.
- Cập nhật KPI theo mẫu: tổng mẫu, đang ở PTN, chờ PYC, chờ KQTN và có sự cố.
- Thêm test contract cho thứ tự route, PYC thiếu/đủ, KQTN liên kết, nhiều mẫu chạy song song và dữ liệu PYC không gắn route.
- Thiết kế và triển khai contract server-to-server cho gửi PYC, ACK tạo phiếu ở app phòng thử, webhook trạng thái, đồng bộ lại và chống trùng/thứ tự sự kiện.
- Bổ sung snapshot thực thi cho route: `executionStatus`, `scheduledDate`, `startedAt`, `completedAt`, `executionOutcome`, mã hệ thống nguồn và mốc đồng bộ.

### Ngoài phạm vi

- Không tạo workflow engine hoặc database dùng chung mới. Có thể dùng các endpoint tích hợp chuyên biệt và lưu event tích hợp vào `pcnSampleFlowEvents` append-only.
- Không thay đổi state machine năm bước của `CertificationDossier`.
- Không biến projection read-only thành nơi mutation.
- Không tự tạo PYC khi route thiếu PYC.
- Không phục hồi các màn hình DDT/legacy hoặc lịch thử nghiệm.

## Mô hình dữ liệu và projection

`PcnSampleLot` là aggregate của lô; `PcnSampleItem` là collection con và là nguồn dữ liệu mẫu/model. `PcnSampleRoute` được mở rộng với `sequence?: number` và `sampleItemIds?: string[]` để tương thích record cũ; route mới phải có sequence bắt đầu từ 1 và có phạm vi item rõ nếu chỉ thử một phần lô. Khi record cũ không có sequence, helper browser-safe dùng thứ tự danh mục `PCN_SAMPLE_LAB_OPTIONS` và `createdAt`/`id` làm tie-breaker ổn định, không ghi ngược vào database. Route không có `sampleItemIds` được hiểu là áp dụng cho toàn bộ item trong lô chỉ trong projection tương thích. Readiness, execution snapshot và vị trí hiện tại được tính theo từng item; vì vậy nhiều mẫu trong cùng lô có thể đồng thời ở các chặng khác nhau.

```ts
interface PcnSampleItem {
  id: string;
  sampleLotId: string;
  sampleCode: string;
  sampleType: string;
  model: string;
  brand?: string;
  quantity: number;
  unit?: string;
  serialNumbers?: string[];
  notes?: string;
}
```

Mỗi route có thêm snapshot thực thi tùy chọn và liên kết app đích:

```ts
type PcnSampleExecutionStatus =
  | 'UNSCHEDULED'
  | 'SCHEDULED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'BLOCKED'
  | 'CANCELLED';

type PcnSampleExecutionOutcome = 'PENDING' | 'PASS' | 'FAIL';

interface PcnSampleExecutionSnapshot {
  status: PcnSampleExecutionStatus;
  scheduledDate?: string; // ngày địa phương YYYY-MM-DD của app phòng thử
  startedAt?: string;
  completedAt?: string;
  outcome?: PcnSampleExecutionOutcome;
  note?: string;
  sourceSystemCode: string;
  lastExternalStatus?: string;
  lastExternalEventId?: string;
  lastExternalSequence?: number;
  lastSyncedAt?: string;
}

interface PcnLabRequestIntegrationLink {
  targetSystemCode: string;
  syncStatus: 'NOT_SENT' | 'PENDING' | 'ACKNOWLEDGED' | 'REJECTED' | 'ERROR';
  externalRequestId?: string;
  externalRequestCode?: string;
  lastDispatchAt?: string;
  lastAcknowledgedAt?: string;
  payloadFingerprint?: string;
  errorCode?: string;
  errorMessage?: string;
}
```

`PcnSampleFlowEvent` được mở rộng metadata kỹ thuật tùy chọn (`sourceSystemCode`, `externalEventId`, `externalRequestId`, `externalSequence`, `payloadFingerprint`) để dùng làm inbox append-only và bằng chứng audit; không lưu raw payload hoặc secret.

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
  sampleItemId: string;
  sampleCode: string;
  sampleType: string;
  model: string;
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
  sampleItemIds?: string[];
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

## Contract tích hợp với app phòng thử

### Gửi PYC và ACK

Người dùng tạo PYC trong card hồ sơ, chọn một route/mẫu cụ thể rồi bấm **Gửi PYC**. Browser gọi `POST /api/pcn/lab-requests/:requestId/dispatch`; browser không gọi app phòng thử. Server:

1. Khóa PYC, route, lot và dossier; kiểm tra quan hệ thuộc cùng một hồ sơ, route đang được phép gửi và `targetSystemCode` đã cấu hình.
2. Dựng payload tối thiểu gồm `contractVersion`, `sourceSystem=PCN`, `targetSystem`, `messageId`, `idempotencyKey`, PYC, hồ sơ, mẫu/lô, route, tiêu chuẩn/chỉ tiêu, số lượng, mã mẫu và callback endpoint server.
3. Gửi `POST /api/integrations/v1/lab-requests` tới adapter app đích bằng HMAC server-to-server.
4. Khi ACK hợp lệ, lưu `externalRequestId`, mã phiếu ngoài, trạng thái tiếp nhận, fingerprint và thời điểm; chuyển `integration.syncStatus` thành `ACKNOWLEDGED` và cập nhật route/PYC theo transaction.
5. Khi timeout hoặc lỗi, giữ PYC không bị nhân bản, chuyển `syncStatus=ERROR`, lưu mã lỗi trung tính và cho phép gửi lại với cùng idempotency key. ACK lặp với cùng fingerprint trả snapshot cũ; fingerprint khác bị từ chối `409`.

ACK tối thiểu:

```json
{
  "contractVersion": "1",
  "accepted": true,
  "sourceSystem": "PCN",
  "targetSystem": "PERFORMANCE",
  "messageId": "msg-...",
  "idempotencyKey": "PCN:route:request:v1",
  "externalRequestId": "performance-request-...",
  "externalRequestCode": "HS-2026-001",
  "status": "RECEIVED",
  "acceptedAt": "2026-08-31T03:00:00.000Z"
}
```

### Webhook trạng thái

App phòng thử gửi `POST /api/pcn/integrations/lab-status-events` với chữ ký HMAC, timestamp, `sourceSystemCode`, `externalEventId`, `externalRequestId`, `pcnRouteId`/`pcnLabRequestId`, `externalSequence`, `eventType`, `occurredAt` và dữ liệu mốc cần thiết. Event types:

- `RECEIVED`: app đích đã nhận và tạo/tiếp nhận phiếu.
- `SCHEDULED`/`RESCHEDULED`: đã lên lịch hoặc đổi ngày, kèm `scheduledDate` theo ngày địa phương của app đích.
- `IN_PROGRESS`: đã bắt đầu thử, kèm `startedAt` nếu có.
- `TEST_COMPLETED`: đã hoàn tất thao tác thử, kèm `completedAt`; chưa mặc nhiên là KQTN chính thức.
- `RESULT_UPDATED`: cập nhật tín hiệu kết quả `PASS`/`FAIL`/`PENDING` và số báo cáo ngoài nếu có; không gửi file bytes.
- `RETURNED`: mẫu đã rời app đích/trả về PCN.
- `ISSUE`: bị chặn/có sự cố, kèm mã và ghi chú ngắn.
- `CANCELLED`: route/phiếu bị hủy ở app đích.

PCN kiểm tra chữ ký/replay window, khóa route/PYC, bỏ qua event trùng, từ chối event có sequence nhỏ hơn snapshot hiện tại và ghi event mới vào `pcnSampleFlowEvents` với id ổn định. Với event hợp lệ, PCN cập nhật snapshot thực thi, route/PYC liên quan và audit trong một transaction. Không tự tạo `ReturnedTestResult` chính thức chỉ từ webhook `RESULT_UPDATED`.

### Đồng bộ lại

`POST /api/pcn/lab-requests/:requestId/reconcile` cho phép người dùng yêu cầu server PCN gọi API tra cứu của app đích bằng `externalRequestId`. Kết quả được xử lý qua cùng mapper/sequence guard của webhook. Nút chỉ xuất hiện khi PYC đã ACK hoặc đang lỗi đồng bộ; mọi lỗi/không khả dụng phải hiển thị rõ và không làm mất snapshot gần nhất.

### Bảo mật và idempotency

- Secret của từng app đích chỉ nằm ở server secret store/env; không nằm trong client, database nghiệp vụ, event hoặc audit.
- HMAC ký cả method/path/timestamp/message id/body fingerprint; server từ chối timestamp ngoài replay window, chữ ký sai, `sourceSystemCode` chưa cấu hình hoặc target không khớp.
- Outbound retry dùng cùng `idempotencyKey` cho cùng một PYC/route/payload version. Inbound dedup theo `sourceSystemCode + externalEventId`; sequence guard theo `sourceSystemCode + externalRequestId`.
- Event đến trễ không được ghi đè trạng thái mới. Event trùng trả HTTP 200 với `idempotent=true` để app đích không retry vô hạn.
- Mọi ACK, lỗi gửi, event nhận, event stale và reconcile phải có audit kỹ thuật/nghiệp vụ phù hợp; không lưu raw credential hoặc payload nhạy cảm.

## UI behavior

`PcnLabOperationsView` keeps the existing PCN shell and compact density but changes the visual hierarchy:

1. Header: “Sổ mẫu thử & luân chuyển”, short explanation, search field.
2. KPI: counts by sample lot, not route.
3. Each sample card: lot/sample identity, dossier/customer, quantity, current location, lot status and issue warning.
4. Route stepper: ordered lab nodes with route status, PYC status, execution status, scheduled date, start/completion milestones and result outcome. The current node is visually emphasized; missing PYC and sync errors are explicit.
5. Actions: open canonical dossier card, create/send PYC for the selected route, and reconcile an acknowledged route through server callbacks. Projection itself does not mutate route data directly.

Search must cover dossier code, proposal code, customer, product, lot code, sample code/type, model, brand, lab name/code, PYC number, current location and issue text. Mobile uses horizontal scrolling for the route stepper while keeping sample identity and current location visible before the scroll area.

The old route-row builder may remain as a compatibility adapter only if existing callers/tests depend on it; the active view must consume the sample-grouped projection. The screen copy must not describe itself as “Tổng hợp PYC outbound” when the primary object is the sample.

## Data integrity and compatibility

- No mutation is performed while deriving the projection.
- A missing lot, missing dossier or missing proposal is represented with neutral fallback labels and an integrity warning; the page must not crash.
- Existing routes without `sequence` continue to render in deterministic order.
- Existing unlinked PYC rows remain visible and searchable.
- Remote schedule/execution values are displayed with source system and last-sync time; PCN does not present them as locally edited facts.
- A remote `FAIL` blocks automatic progression to the next route and shows the remediation/retest action; it does not delete or replace previous formal results.
- No changes are made to persistence boundaries, audit semantics or PCN RBAC.

## Verification criteria

- Unit/contract tests prove a lot with three routes renders three ordered route nodes and marks only the valid next node ready.
- Tests prove two lots in one dossier produce two independent projections and a current route in one lot does not block the other lot.
- Tests prove a route with no linked PYC shows `hasLabRequest=false` even when another PYC exists for the same dossier.
- Tests prove returned KQTN is joined only through the linked PYC and is shown on the correct route.
- Tests prove legacy route data without sequence is deterministic.
- Tests prove schedule/start/completion/outcome event mapping and reject stale/duplicate webhook events.
- Tests prove failed execution blocks the next route while a passed execution makes the next route ready.
- Tests prove two independently linked PYC dispatches return separate external request IDs and retrying one route does not duplicate the other.
- UI contract tests prove the page uses sample-centered labels, renders the route stepper, shows explicit “Chưa có PYC”, schedule/execution badges and sync error state.
- `npm run typecheck`/project-equivalent type validation, targeted PCN tests, `git diff --check` and production build are run before completion.
