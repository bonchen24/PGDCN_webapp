// Author: Gemini
// OS support: Web/Node
// Description: Contract tests for business notification event audiences and messages

import assert from 'node:assert/strict';
import test from 'node:test';
import { RequestStatus, SampleStatus, TestCategory, TestRequest, HandoverDoc, HandoverType, KQTNRecord } from '../types';
import {
  buildAssignmentNotification,
  buildHandoverNotification,
  buildKqtnNotification,
  buildRequestNotification,
  buildScheduleNotification,
  isMajorHandoverUpdate,
  isMajorRequestUpdate,
} from '../utils/notificationEvents';

const request: TestRequest = {
  id: 'req-1',
  requestCode: 'PYC-001',
  status: RequestStatus.PENDING,
  sampleStatus: SampleStatus.IN_LAB,
  customerName: 'Công ty A',
  modelName: 'Model X',
  type: 'Tủ lạnh',
  testCategory: TestCategory.ATD,
  quantity: 1,
  priority: 1,
  requestDate: '2026-08-17',
  scheduledDate: null,
  duration: 60,
};

const handoverDoc: HandoverDoc = {
  id: 'handover-1',
  docNumber: 'BBGN-001',
  type: HandoverType.RECEIVE,
  date: '2026-08-17',
  customerName: 'Công ty A',
  representative: 'Nguyễn Văn A',
  labName: 'DDT Lab',
  labAddress: 'Hà Nội',
  labRepresentative: 'KTV',
  labRepPosition: 'Kỹ thuật viên',
  labRepPhone: '0900000000',
  sampleIds: ['req-1'],
  status: 'Signed',
};

const kqtnRecord: KQTNRecord = {
  id: 'kqtn-1',
  requestCode: 'PYC-001',
  sampleCode: 'M-001',
  reportNo: 'BC-001',
  sampleName: 'Mẫu X',
  model: 'Model X',
  standardId: 'TCVN',
  standardTitle: 'Tiêu chuẩn',
  version: 1,
  versionHistory: [],
  createdAt: '2026-08-17T08:00:00.000Z',
  createdBy: 'tester',
  updatedAt: '2026-08-17T08:00:00.000Z',
  updatedBy: 'tester',
};

test('builds request activity notifications for managers only', () => {
  const notification = buildRequestNotification({
    request,
    action: 'UPDATED',
    actorName: 'Người cập nhật',
  });

  assert.equal(notification.type, 'BUSINESS_ACTIVITY');
  assert.equal(notification.entityType, 'REQUEST');
  assert.equal(notification.targetRole, 'admin');
  assert.match(notification.message, /PYC-001/);
  assert.match(notification.message, /Người cập nhật/);
});

test('builds new request notifications for staff and managers', () => {
  const notification = buildRequestNotification({
    request,
    action: 'CREATED',
    actorName: 'Người tạo',
  });

  assert.equal(notification.type, 'NEW_REQUEST');
  assert.equal(notification.targetRole, 'staff');
  assert.equal(notification.title, 'Phiếu yêu cầu mới');
});

test('builds assignment notifications only for the assigned user', () => {
  const notification = buildAssignmentNotification({
    request: { ...request, scheduledDate: '2026-08-20' },
    actorName: 'Quản lý',
    assigneeName: 'Nguyễn Mạnh Trọng',
    assigneeUsername: 'nguyenmanhtrong',
  });

  assert.equal(notification.action, 'ASSIGNED');
  assert.deepEqual(notification.targetUsernames, ['nguyenmanhtrong']);
  assert.equal(notification.targetRole, 'staff');
  assert.match(notification.message, /2026-08-20/);
});

test('falls back to manager-only schedule notification when assignee is unknown', () => {
  const notification = buildScheduleNotification({
    request,
    actorName: 'Quản lý',
    scheduledDate: null,
    previousDate: '2026-08-20',
  });

  assert.equal(notification.action, 'UNSCHEDULED');
  assert.equal(notification.targetRole, 'admin');
  assert.match(notification.message, /PYC-001/);
});

test('builds handover and KQTN notifications with business metadata', () => {
  const handoverNotification = buildHandoverNotification({
    doc: handoverDoc,
    action: 'CREATED',
    actorName: 'Nhân viên',
  });
  const kqtnNotification = buildKqtnNotification({
    record: kqtnRecord,
    action: 'UPDATED',
    actorName: 'KTV',
  });

  assert.equal(handoverNotification.targetRole, 'staff');
  assert.equal(handoverNotification.docNumber, 'BBGN-001');
  assert.equal(kqtnNotification.targetRole, 'admin');
  assert.equal(kqtnNotification.reportNo, 'BC-001');
});

test('ignores small request text and display-name edits', () => {
  assert.equal(isMajorRequestUpdate({ note: 'Ghi chú mới' }), false);
  assert.equal(isMajorRequestUpdate({ customerName: 'Tên khách hàng mới' }), false);
  assert.equal(isMajorRequestUpdate({ modelName: 'Model đổi tên' }), false);
  assert.equal(isMajorRequestUpdate({ requestCode: 'PYC-002' }), false);
});

test('keeps notifications for request changes that affect testing operations', () => {
  assert.equal(isMajorRequestUpdate({ status: RequestStatus.TESTING }), true);
  assert.equal(isMajorRequestUpdate({ scheduledDate: '2026-08-20' }), true);
  assert.equal(isMajorRequestUpdate({ testerName: 'Nguyễn Mạnh Trọng' }), true);
  assert.equal(isMajorRequestUpdate({ testCategory: TestCategory.EMC }), true);
  assert.equal(isMajorRequestUpdate({ type: 'Máy giặt' }), true);
  assert.equal(isMajorRequestUpdate({ quantity: 2 }), true);
  assert.equal(isMajorRequestUpdate({ ecnCode: 'ECN-002' }), true);
});

test('ignores handover text edits but keeps sample and status changes', () => {
  assert.equal(isMajorHandoverUpdate({ customerName: 'Tên mới' }), false);
  assert.equal(isMajorHandoverUpdate({ representative: 'Người mới' }), false);
  assert.equal(isMajorHandoverUpdate({ docNumber: 'BBGN-002' }), false);
  assert.equal(isMajorHandoverUpdate({ sampleIds: ['req-2'] }), true);
  assert.equal(isMajorHandoverUpdate({ status: 'Signed' }), true);
  assert.equal(isMajorHandoverUpdate({ date: '2026-08-20' }), true);
});

// --- End of notification-business.test.ts ---
