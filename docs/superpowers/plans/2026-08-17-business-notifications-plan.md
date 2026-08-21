<!--
Author: Gemini
OS support: Web/Node
Description: Kế hoạch triển khai notification hoạt động nghiệp vụ và định tuyến thông báo theo vai trò/tài khoản
-->

# Business Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task with review checkpoints. Each task follows TDD and uses checkbox steps.

**Goal:** Phát notification cho các hoạt động nghiệp vụ quan trọng đối với Admin/Quản lý, đồng thời định tuyến phiếu mới, biên bản mới và công việc được giao đúng nhân viên mà không gây nhiễu bởi chỉnh sửa văn bản nhỏ.

**Architecture:** Giữ collection `notifications` trong PostgreSQL JSONB và mở rộng `AppNotification` bằng metadata sự kiện cùng danh sách username nhận riêng. Một bộ helper thuần TypeScript sẽ dựng message, lọc audience, resolve người được giao, merge notification và xác định đích điều hướng; Zustand chỉ chịu trách nhiệm gọi helper tại các action nghiệp vụ và đồng bộ dữ liệu.

**Tech Stack:** React 18, TypeScript 5.8, Zustand 4.5, `tsx --test`, PostgreSQL REST document API, Tailwind CSS, lucide-react.

## Global Constraints

- `design.md` là nguồn sự thật duy nhất cho nghiệp vụ, schema và UI của tính năng.
- Admin/Quản lý xem toàn bộ notification nghiệp vụ; nhân viên chỉ xem phiếu mới, biên bản mới và công việc giao cho chính họ.
- Chỉnh sửa nhỏ như xóa chữ, đổi tên/đổi mã hiển thị và ghi chú không phát notification; thay đổi ảnh hưởng tiến độ, trạng thái, phân công, mẫu, lịch hoặc KQTN vẫn phát notification.
- Không tạo notification cho thao tác chỉ đọc, đồng bộ nền, đọc notification hoặc thao tác hệ thống.
- Notification cũ chỉ có `type`, `targetRole`, `requestCode` vẫn phải hiển thị được.
- Không thêm dependency mới.
- Mọi file TS/TSX mới hoặc sửa phải giữ header `Author: Gemini`, `OS support: Web/Node`, `Description` và footer bắt buộc theo `design.md`.
- Không sửa `.env`.
- Vì workspace hiện tại không có `.git`, các checkpoint commit được thay bằng kiểm tra file/diff và sẽ không gọi `git commit`.

---

### Task 1: Notification domain contract, message builder, audience và recipient resolution

**Files:**
- Modify: `types.ts` tại `AppNotification` và các type liên quan.
- Create: `utils/notificationEvents.ts`.
- Test: `test/notification-events.test.ts`.

**Interfaces:**
- `NotificationEntityType = 'REQUEST' | 'HANDOVER_DOC' | 'KQTN_RECORD' | 'SCHEDULE'`.
- `NotificationAction = 'CREATED' | 'UPDATED' | 'DELETED' | 'STATUS_CHANGED' | 'SCHEDULED' | 'UNSCHEDULED' | 'ASSIGNED'`.
- `NotificationTargetRole = 'admin' | 'staff' | 'all'`.
- `NotificationDraft` chứa `type`, actor, entity metadata, audience, target usernames và các trường định vị tùy chọn.
- `buildNotification(draft, now, id)` trả về `AppNotification` đầy đủ `id`, `createdAt`, `read: false`.
- `isAdminUser(user)` nhận `UserAccount | null` và nhận diện role `admin` hoặc chức danh quản lý/lãnh đạo.
- `canViewNotification(notification, user)` trả về boolean theo `targetRole` và `targetUsernames`.
- `resolveTargetUsername(systemUsers, assigneeName)` trả về username ổn định hoặc `null` nếu không xác định được tài khoản.
- `getNotificationDestination(notification)` trả về một trong `REQUEST`, `HANDOVER`, `KQTN`, `SCHEDULE` hoặc `NONE`.

- [ ] **Step 1: Viết test đỏ cho builder và audience**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { UserAccount } from '../types';
import {
  buildNotification,
  canViewNotification,
  resolveTargetUsername,
} from '../utils/notificationEvents';

test('builds a staff notification with business metadata', () => {
  const notification = buildNotification({
    id: 'notification-1',
    type: 'BUSINESS_ACTIVITY',
    entityType: 'REQUEST',
    action: 'CREATED',
    entityId: 'request-1',
    entityLabel: 'PYC-DDT-001',
    title: 'Phiếu yêu cầu mới',
    message: 'Có phiếu yêu cầu mới: PYC-DDT-001',
    targetRole: 'staff',
    createdBy: 'Nguyễn Văn A',
  }, '2026-08-17T10:00:00.000Z');

  assert.equal(notification.id, 'notification-1');
  assert.equal(notification.createdAt, '2026-08-17T10:00:00.000Z');
  assert.equal(notification.read, false);
  assert.equal(notification.entityType, 'REQUEST');
  assert.equal(notification.action, 'CREATED');
});

test('shows staff notification to admin and hides admin-only notification from staff', () => {
  const admin: UserAccount = { username: 'admin', name: 'Admin', role: 'admin' };
  const staff: UserAccount = { username: 'tester.a', name: 'Tester A', role: 'tester' };
  const staffNotification = buildNotification({
    id: 'staff-1', type: 'BUSINESS_ACTIVITY', title: 'Phiếu mới', message: 'Phiếu mới',
    targetRole: 'staff', createdBy: 'Admin', entityType: 'REQUEST', action: 'CREATED',
  }, '2026-08-17T10:00:00.000Z');
  const adminNotification = { ...staffNotification, id: 'admin-1', targetRole: 'admin' as const };

  assert.equal(canViewNotification(staffNotification, admin), true);
  assert.equal(canViewNotification(staffNotification, staff), true);
  assert.equal(canViewNotification(adminNotification, staff), false);
});

test('resolves assigned tester by username or display name', () => {
  const users = [{ id: 'tester.a', username: 'tester.a', name: 'Tester A', 'Họ và Tên': 'Tester A' }];
  assert.equal(resolveTargetUsername(users, 'Tester A'), 'tester.a');
  assert.equal(resolveTargetUsername(users, 'Unknown'), null);
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- test/notification-events.test.ts`

Expected: FAIL vì các type/helper notification mới chưa tồn tại.

- [ ] **Step 3: Viết implementation tối thiểu**

Mở rộng `AppNotification` bằng `entityType`, `action`, `entityId`, `entityLabel`, `docNumber`, `reportNo`, `testCategory`, `previousStatus`, `nextStatus`, `scheduledDate`, `targetUsernames`. Tạo `utils/notificationEvents.ts` với các hàm trong Interfaces; chuẩn hóa username không phân biệt hoa thường và nhận các tên field song ngữ đang có trong `systemUsers`.

- [ ] **Step 4: Chạy test xanh và lint type**

Run: `npm test -- test/notification-events.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: TypeScript không có lỗi trong type/helper mới.

---

### Task 2: Merge notification, xóa bền vững và tương thích dữ liệu cũ

**Files:**
- Modify: `utils/notificationEvents.ts`.
- Modify: `store.ts` các action notification và luồng `syncTwoWay`.
- Test: `test/notification-merge.test.ts`.

**Interfaces:**
- `mergeNotifications(local, cloud, limit = 50)` merge theo `id`, ưu tiên bản ghi mới hơn và giữ `read: true` nếu một phía đã đọc.
- `collectNotificationIds(...lists)` trả về danh sách ID duy nhất dùng cho thao tác xóa cloud.

- [ ] **Step 1: Viết test đỏ cho merge và xóa**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectNotificationIds, mergeNotifications } from '../utils/notificationEvents';

test('merges local and cloud notifications without duplicate ids', () => {
  const result = mergeNotifications([
    { id: 'n-1', title: 'Local', message: 'Local', createdAt: '2026-08-17T10:00:00Z', read: false, type: 'SYSTEM' },
  ], [
    { id: 'n-1', title: 'Cloud', message: 'Cloud', createdAt: '2026-08-17T10:00:00Z', read: true, type: 'SYSTEM' },
    { id: 'n-2', title: 'New', message: 'New', createdAt: '2026-08-17T11:00:00Z', read: false, type: 'SYSTEM' },
  ], 50);

  assert.deepEqual(result.map(item => item.id), ['n-2', 'n-1']);
  assert.equal(result.find(item => item.id === 'n-1')?.read, true);
});

test('collects unique ids from local and cloud lists before deletion', () => {
  assert.deepEqual(collectNotificationIds(
    [{ id: 'n-1' }, { id: 'n-2' }],
    [{ id: 'n-2' }, { id: 'n-3' }],
  ), ['n-1', 'n-2', 'n-3']);
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- test/notification-merge.test.ts`

Expected: FAIL vì helper mới chưa tồn tại.

- [ ] **Step 3: Implement merge và clear bền vững**

Thay logic merge inline trong `syncTwoWay` bằng helper mới. Sửa `clearNotifications` để lấy ID từ local và cloud, set state rỗng ngay lập tức, gọi `batchDeleteFromPostgres('notifications', ids)` và chạy lại đồng bộ sau khi xóa thành công; nếu cloud không đọc được thì vẫn xóa các ID local và giữ lỗi đồng bộ ở log.

- [ ] **Step 4: Chạy test xanh**

Run: `npm test -- test/notification-merge.test.ts`

Expected: PASS.

---

### Task 3: Phát notification từ các action nghiệp vụ trong Zustand

**Files:**
- Modify: `store.ts` tại `addRequest`, `addRequests`, `updateRequest`, `deleteRequest`, `deleteRequestGroup`, `updateRequestStatus`, `updateTestResult`, `moveRequest`, `addHandoverDoc`, `deleteHandoverDoc`, `addKqtnRecord`, `updateKqtnRecord`, `deleteKqtnRecord`.
- Test: `test/notification-store-events.test.ts`.

**Interfaces:**
- Internal `appendNotifications(set, drafts)` tạo notification, cập nhật state local, phát Windows notification và không tự gọi sync để action quyết định thời điểm sync.
- Tạo phiếu mới và biên bản mới dùng `targetRole: 'staff'`; Admin/Quản lý xem được qua bộ lọc quyền.
- Sửa/xóa phiếu, biên bản, KQTN, đổi trạng thái và lịch dùng `targetRole: 'admin'`.
- Giao việc mới dùng `targetRole: 'staff'` và `targetUsernames: [resolvedUsername]`; nếu không resolve được chỉ tạo bản ghi `targetRole: 'admin'`.

- [ ] **Step 1: Viết test đỏ cho các event chính**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildNotification } from '../utils/notificationEvents';

test('new request event is visible to staff and admin', () => {
  const event = buildNotification({
    id: 'request-created', type: 'NEW_REQUEST', entityType: 'REQUEST', action: 'CREATED',
    entityId: 'req-1', entityLabel: 'PYC-DDT-001', title: 'Phiếu yêu cầu mới',
    message: 'Có phiếu yêu cầu mới: PYC-DDT-001', targetRole: 'staff', createdBy: 'Admin',
  }, '2026-08-17T10:00:00Z');
  assert.equal(event.targetRole, 'staff');
  assert.equal(event.action, 'CREATED');
});

test('assignment event is restricted to the resolved assignee', () => {
  const event = buildNotification({
    id: 'assignment-1', type: 'BUSINESS_ACTIVITY', entityType: 'SCHEDULE', action: 'ASSIGNED',
    entityId: 'req-1', entityLabel: 'PYC-DDT-001', title: 'Công việc mới được giao',
    message: 'Bạn được giao công việc PYC-DDT-001', targetRole: 'staff',
    targetUsernames: ['tester.a'], createdBy: 'Admin',
  }, '2026-08-17T10:00:00Z');
  assert.deepEqual(event.targetUsernames, ['tester.a']);
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- test/notification-store-events.test.ts`

Expected: FAIL vì action wiring và audience mới chưa tồn tại.

- [ ] **Step 3: Implement action instrumentation**

Thay các notification thủ công trong `addRequest`/`addRequests` bằng helper chung. Mỗi action lấy snapshot trước khi mutate để tạo message xóa/đổi trạng thái chính xác. `moveRequest` chỉ phát một event cho mẫu được di chuyển; nếu có người được giao mới thì dùng event `ASSIGNED`, nếu chỉ đổi/gỡ lịch thì dùng event Admin-only. `addHandoverDoc` phân biệt create/update bằng `exists`; chỉ create gửi notification staff. Không phát thêm status notification cho các request bị cập nhật phụ trong cùng thao tác lập biên bản.

- [ ] **Step 4: Chạy test xanh và lint**

Run: `npm test -- test/notification-store-events.test.ts`

Expected: PASS.

Run: `npm run lint`

Expected: TypeScript không có lỗi.

---

### Task 4: Dropdown, quyền hiển thị và điều hướng notification

**Files:**
- Modify: `components/NotificationDropdown.tsx`.
- Modify: `App.tsx` tại `ActiveTab`, state modal và callback notification.
- Modify: `utils/notificationEvents.ts` nếu cần hoàn thiện destination mapping.
- Test: `test/notification-navigation.test.ts`.

**Interfaces:**
- `NotificationDropdownProps.onSelectNotification?: (notification: AppNotification) => void`.
- `getNotificationDestination` maps `REQUEST` → `REQUEST`, `HANDOVER_DOC` → `HANDOVER`, `KQTN_RECORD` → `KQTN`, `SCHEDULE` → `SCHEDULE`.

- [ ] **Step 1: Viết test đỏ cho destination và audience**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { getNotificationDestination } from '../utils/notificationEvents';

test('maps notification entity to the matching application destination', () => {
  assert.equal(getNotificationDestination({ entityType: 'REQUEST' } as any), 'REQUEST');
  assert.equal(getNotificationDestination({ entityType: 'HANDOVER_DOC' } as any), 'HANDOVER');
  assert.equal(getNotificationDestination({ entityType: 'KQTN_RECORD' } as any), 'KQTN');
  assert.equal(getNotificationDestination({ entityType: 'SCHEDULE' } as any), 'SCHEDULE');
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- test/notification-navigation.test.ts`

Expected: FAIL nếu destination helper chưa hoàn chỉnh.

- [ ] **Step 3: Implement UI và callback điều hướng**

Dropdown dùng `canViewNotification` trước khi tính unread/list. Hiển thị icon theo `entityType`, chip mã phiếu/số biên bản/số báo cáo, action label và người thực hiện. Khi click, đánh dấu đã đọc rồi gọi callback. `App.tsx` mở tab requests và tìm mã phiếu, mở handover modal theo `entityId`, chuyển KQTN sang tab `kqtn`, và chọn tab lịch theo `testCategory`. Admin/Quản lý dùng cùng một predicate với dropdown.

- [ ] **Step 4: Chạy test xanh và build**

Run: `npm test -- test/notification-navigation.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: Vite build thành công.

---

### Task 5: Backup, restore và upload PostgreSQL cho notifications

**Files:**
- Modify: `components/SettingsModal.tsx` trong `handleBackup`.
- Modify: `store.ts` trong `restoreFromBackup` và `uploadToPostgres`.
- Create: `utils/notificationBackup.ts`.
- Test: `test/notification-backup.test.ts`.

**Interfaces:**
- `buildBackupPayload(state, timestamp)` trả về backup JSON có key `notifications`.
- `normalizeBackupNotifications(rawNotifications, now)` chuẩn hóa danh sách notification và tạo ID cho bản ghi thiếu ID.
- Backup JSON có key `notifications` là mảng notification.
- Restore chuẩn hóa ID, giữ metadata audience và set vào Zustand.
- Upload PostgreSQL tính stale IDs, xóa các notification cloud không còn trong backup và batch-save notification hiện tại.

- [ ] **Step 1: Viết test đỏ cho backup contract**

```typescript
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackupPayload, normalizeBackupNotifications } from '../utils/notificationBackup';

test('includes notifications in exported backup payload', () => {
  const payload = buildBackupPayload({
    requests: [], handoverDocs: [], kqtnRecords: [], customers: [], products: [],
    brands: [], dayConfigs: {}, systemUsers: [], notifications: [
      { id: 'n-1', title: 'Phiếu mới', message: 'PYC-DDT-001', targetRole: 'staff', type: 'NEW_REQUEST', read: false, createdAt: '2026-08-17T10:00:00Z' },
    ], settings: { workOnSaturday: true, workOnSunday: false },
  }, '2026-08-17T11:00:00Z');

  assert.deepEqual(payload.notifications, [{
    id: 'n-1', title: 'Phiếu mới', message: 'PYC-DDT-001', targetRole: 'staff', type: 'NEW_REQUEST', read: false, createdAt: '2026-08-17T10:00:00Z',
  }]);
  assert.equal(payload.timestamp, '2026-08-17T11:00:00Z');
});

test('normalizes notification records from restore data', () => {
  const normalized = normalizeBackupNotifications([
    { title: 'Biên bản mới', message: 'NM DDT-001', targetRole: 'staff' },
  ], '2026-08-17T11:00:00Z', () => 'restored-1');

  assert.deepEqual(normalized, [{
    id: 'restored-1', title: 'Biên bản mới', message: 'NM DDT-001', targetRole: 'staff',
    type: 'BUSINESS_ACTIVITY', read: false, createdAt: '2026-08-17T11:00:00Z',
  }]);
});
```

- [ ] **Step 2: Chạy test đỏ**

Run: `npm test -- test/notification-backup.test.ts`

Expected: FAIL vì `buildBackupPayload` và `normalizeBackupNotifications` chưa tồn tại.

- [ ] **Step 3: Implement backup/restore/upload**

Tạo `utils/notificationBackup.ts` với hai helper thuần TypeScript. Thay payload inline trong `handleBackup` bằng `buildBackupPayload`. Trong restore đọc `backupData.notifications`, gọi `normalizeBackupNotifications`, set `notifications` và không tạo notification mới từ thao tác restore. Trong upload fetch collection cloud, tính stale notification IDs, batch-delete, batch-save danh sách state và reset marker/config liên quan nếu có. Giữ test `test/postgres-api.test.ts` hiện có chạy để đảm bảo `toPostgresDocuments` tiếp tục nhập collection notifications.

- [ ] **Step 4: Chạy test backup, full test và lint**

Run: `npm test -- test/notification-backup.test.ts`

Expected: PASS.

Run: `npm test`

Expected: Tất cả test PASS.

Run: `npm run lint`

Expected: TypeScript không có lỗi.

---

### Task 6: Verification và bàn giao

**Files:**
- Verify: `types.ts`, `utils/notificationEvents.ts`, `store.ts`, `components/NotificationDropdown.tsx`, `App.tsx`, `components/SettingsModal.tsx`, `design.md` và các test mới.

- [ ] **Step 1: Kiểm tra header/footer và placeholder**

Run: `rg -n -i 'TBD|TODO|FIXME|implement later' types.ts utils/notificationEvents.ts store.ts components/NotificationDropdown.tsx App.tsx components/SettingsModal.tsx test/notification-*.test.ts`

Expected: Không có placeholder mới trong phần notification.

- [ ] **Step 2: Chạy verification đầy đủ**

Run: `npm test`

Expected: Exit code 0, không có test fail.

Run: `npm run lint`

Expected: Exit code 0.

Run: `npm run build`

Expected: Exit code 0 và tạo build Vite thành công.

- [ ] **Step 3: Kiểm tra trạng thái thay đổi**

Run: `Get-Item design.md,docs\superpowers\specs\2026-08-17-business-notifications-design.md,docs\superpowers\plans\2026-08-17-business-notifications-plan.md | Select-Object FullName,Length,LastWriteTime`

Expected: Ba tài liệu đặc tả/kế hoạch tồn tại; các file implementation/test thay đổi nằm trong workspace DDT WebApp. Không thực hiện commit local vì workspace không có `.git`.

---
<!-- --- End of 2026-08-17-business-notifications-plan.md --- -->
