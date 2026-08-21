// Author: Gemini
// OS support: Web/Node
// Description: Pure helpers for business notification construction, audience filtering, merge and navigation metadata

import {
  AppNotification,
  AppNotificationType,
  NotificationAction,
  NotificationEntityType,
  NotificationTargetRole,
  UserAccount,
  TestRequest,
  HandoverDoc,
  KQTNRecord,
} from '../types';
import { getUserFullName } from './userIdentity';

export interface NotificationDraft extends Omit<AppNotification, 'id' | 'createdAt' | 'read'> {
  id?: string;
  createdAt?: string;
  read?: boolean;
}

interface RequestNotificationInput {
  request: Partial<TestRequest> & { id?: string };
  action: NotificationAction;
  actorName: string;
  previousStatus?: string;
  nextStatus?: string;
  activityLabel?: string;
}

interface AssignmentNotificationInput {
  request: Partial<TestRequest> & { id?: string };
  actorName: string;
  assigneeName?: string;
  assigneeUsername?: string | null;
}

interface ScheduleNotificationInput {
  request: Partial<TestRequest> & { id?: string };
  actorName: string;
  scheduledDate?: string | null;
  previousDate?: string | null;
}

interface HandoverNotificationInput {
  doc: HandoverDoc;
  action: NotificationAction;
  actorName: string;
}

interface KqtnNotificationInput {
  record: KQTNRecord;
  action: NotificationAction;
  actorName: string;
}

const normalizeIdentity = (value: unknown): string => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/^@/, '')
  .trim();

const getUserUsername = (user: any): string => String(
  user?.username || user?.['Tên đăng nhập'] || user?.email || user?.['Email'] || user?.id || ''
).trim();

const getUserName = (user: any): string => getUserFullName(user, '');

const createNotificationId = (): string => `notif-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

const requestLabel = (request: Partial<TestRequest>): string => request.requestCode || request.id || 'phiếu chưa xác định';

const requestSummary = (request: Partial<TestRequest>): string =>
  `${requestLabel(request)} | ${request.customerName || 'Chưa rõ khách hàng'} | ${request.modelName || 'Chưa rõ mẫu'}`;

const MAJOR_REQUEST_UPDATE_FIELDS = new Set<keyof TestRequest>([
  'status',
  'sampleStatus',
  'scheduledDate',
  'testerName',
  'chamberId',
  'testCategory',
  'type',
  'quantity',
  'priority',
  'requestDate',
  'receivedDate',
  'endDate',
  'duration',
  'result',
  'ecnCode',
  'encodeNumber',
  'atdEncodeNumber',
  'emcEncodeNumber',
  'itdEncodeNumber',
  'deadlineDate',
  'customsDeadline',
  'returnDate',
  'returnDocNo',
  'sampleLocation',
  'testCriteria',
  'standard',
  'mtt',
  'sealStamp',
  'sampleCondition',
  'postTestHandling',
]);

const MAJOR_HANDOVER_UPDATE_FIELDS = new Set<keyof HandoverDoc>([
  'sampleIds',
  'type',
  'date',
  'status',
]);

export const isMajorRequestUpdate = (updates: Partial<TestRequest> = {}): boolean =>
  Object.keys(updates).some(key => MAJOR_REQUEST_UPDATE_FIELDS.has(key as keyof TestRequest));

export const isMajorHandoverUpdate = (updates: Partial<HandoverDoc> = {}): boolean =>
  Object.keys(updates).some(key => MAJOR_HANDOVER_UPDATE_FIELDS.has(key as keyof HandoverDoc));

export const buildRequestNotification = ({
  request,
  action,
  actorName,
  previousStatus,
  nextStatus,
  activityLabel,
}: RequestNotificationInput): NotificationDraft => {
  const isCreated = action === 'CREATED';
  const title = activityLabel || (isCreated
    ? 'Phiếu yêu cầu mới'
    : action === 'DELETED'
      ? 'Phiếu yêu cầu đã xóa'
      : action === 'STATUS_CHANGED'
        ? 'Phiếu yêu cầu đổi trạng thái'
        : 'Phiếu yêu cầu được cập nhật');
  const statusText = action === 'STATUS_CHANGED'
    ? ` | Trạng thái: ${previousStatus || '—'} → ${nextStatus || request.status || '—'}`
    : '';

  return {
    type: isCreated ? 'NEW_REQUEST' : action === 'STATUS_CHANGED' ? 'STATUS_CHANGE' : 'BUSINESS_ACTIVITY',
    title,
    message: `${activityLabel ? `${activityLabel}: ` : ''}${requestSummary(request)}${statusText} | Bởi: ${actorName || 'Người dùng hệ thống'}`,
    entityType: 'REQUEST',
    action,
    entityId: request.id,
    entityLabel: requestLabel(request),
    requestCode: request.requestCode,
    customerName: request.customerName,
    modelName: request.modelName,
    testCategory: request.testCategory,
    previousStatus,
    nextStatus,
    createdBy: actorName,
    targetRole: isCreated ? 'staff' : 'admin',
  };
};

export const buildAssignmentNotification = ({
  request,
  actorName,
  assigneeName,
  assigneeUsername,
}: AssignmentNotificationInput): NotificationDraft => ({
  type: 'BUSINESS_ACTIVITY',
  title: 'Công việc mới được giao',
  message: `${requestSummary(request)} | Ngày thử: ${request.scheduledDate || 'Chưa xếp lịch'} | Người thực hiện: ${assigneeName || 'Chưa xác định'} | Bởi: ${actorName || 'Người dùng hệ thống'}`,
  entityType: 'REQUEST',
  action: 'ASSIGNED',
  entityId: request.id,
  entityLabel: requestLabel(request),
  requestCode: request.requestCode,
  customerName: request.customerName,
  modelName: request.modelName,
  testCategory: request.testCategory,
  scheduledDate: request.scheduledDate,
  createdBy: actorName,
  targetRole: assigneeUsername ? 'staff' : 'admin',
  targetUsernames: assigneeUsername ? [assigneeUsername] : undefined,
});

export const buildScheduleNotification = ({
  request,
  actorName,
  scheduledDate,
  previousDate,
}: ScheduleNotificationInput): NotificationDraft => {
  const isScheduled = Boolean(scheduledDate);
  return {
    type: 'BUSINESS_ACTIVITY',
    title: isScheduled ? 'Lịch thử nghiệm được cập nhật' : 'Công việc được trả về hàng chờ',
    message: `${requestSummary(request)} | Lịch: ${previousDate || 'Chưa xếp'} → ${scheduledDate || 'Hàng chờ'} | Bởi: ${actorName || 'Người dùng hệ thống'}`,
    entityType: 'SCHEDULE',
    action: isScheduled ? 'SCHEDULED' : 'UNSCHEDULED',
    entityId: request.id,
    entityLabel: requestLabel(request),
    requestCode: request.requestCode,
    customerName: request.customerName,
    modelName: request.modelName,
    scheduledDate: scheduledDate || null,
    createdBy: actorName,
    targetRole: 'admin',
  };
};

export const buildHandoverNotification = ({
  doc,
  action,
  actorName,
}: HandoverNotificationInput): NotificationDraft => ({
  type: 'BUSINESS_ACTIVITY',
  title: action === 'CREATED' ? 'Biên bản mới được tạo' : action === 'DELETED' ? 'Biên bản đã xóa' : 'Biên bản được cập nhật',
  message: `Biên bản ${doc.docNumber} | Khách hàng: ${doc.customerName || 'Chưa rõ'} | ${doc.type} | Bởi: ${actorName || 'Người dùng hệ thống'}`,
  entityType: 'HANDOVER_DOC',
  action,
  entityId: doc.id,
  entityLabel: doc.docNumber,
  docNumber: doc.docNumber,
  customerName: doc.customerName,
  createdBy: actorName,
  targetRole: action === 'CREATED' ? 'staff' : 'admin',
});

export const buildKqtnNotification = ({
  record,
  action,
  actorName,
}: KqtnNotificationInput): NotificationDraft => ({
  type: 'BUSINESS_ACTIVITY',
  title: action === 'CREATED' ? 'Kết quả thử nghiệm mới' : action === 'DELETED' ? 'Kết quả thử nghiệm đã xóa' : 'Kết quả thử nghiệm được cập nhật',
  message: `Báo cáo ${record.reportNo} | Mẫu: ${record.sampleName || record.model} | Phiếu: ${record.requestCode || 'Chưa liên kết'} | Bởi: ${actorName || 'Người dùng hệ thống'}`,
  entityType: 'KQTN_RECORD',
  action,
  entityId: record.id,
  entityLabel: record.reportNo,
  requestCode: record.requestCode,
  reportNo: record.reportNo,
  modelName: record.model,
  createdBy: actorName,
  targetRole: 'admin',
});

export const buildNotification = (
  draft: NotificationDraft,
  now: string = new Date().toISOString(),
  id: string = draft.id || createNotificationId(),
): AppNotification => ({
  ...draft,
  id,
  createdAt: draft.createdAt || now,
  read: draft.read ?? false,
});

export const isAdminUser = (user: UserAccount | null | undefined): boolean => {
  if (!user) return false;
  const position = String(user.position || '').toLowerCase();
  return user.role === 'admin' ||
    position.includes('quản lý') ||
    position.includes('trưởng phòng') ||
    position.includes('phó') ||
    position.includes('lãnh đạo');
};

export const canViewNotification = (
  notification: AppNotification,
  user: UserAccount | null | undefined,
): boolean => {
  if (isAdminUser(user)) return true;
  if (!user) return false;

  const targetUsernames = notification.targetUsernames || [];
  if (targetUsernames.length > 0) {
    const currentUsername = normalizeIdentity(user.username);
    return targetUsernames.some(target => normalizeIdentity(target) === currentUsername);
  }

  return notification.targetRole === 'staff' || notification.targetRole === 'all' ||
    (!notification.targetRole && notification.type === 'SYSTEM');
};

export const resolveTargetUsername = (systemUsers: any[], assigneeName: string | undefined): string | null => {
  const normalizedAssignee = normalizeIdentity(assigneeName);
  if (!normalizedAssignee) return null;

  const matchedUser = (systemUsers || []).find(user => {
    const username = normalizeIdentity(getUserUsername(user));
    const name = normalizeIdentity(getUserName(user));
    return normalizedAssignee === username || normalizedAssignee === name;
  });

  const username = getUserUsername(matchedUser);
  return username || null;
};

export const mergeNotifications = (
  localNotifications: AppNotification[] = [],
  cloudNotifications: AppNotification[] = [],
  limit = 50,
): AppNotification[] => {
  const notificationMap = new Map<string, AppNotification>();
  [...localNotifications, ...cloudNotifications].forEach(notification => {
    if (!notification?.id) return;
    const existing = notificationMap.get(notification.id);
    notificationMap.set(notification.id, existing
      ? { ...existing, ...notification, read: existing.read || notification.read }
      : notification);
  });

  return Array.from(notificationMap.values())
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .slice(0, limit);
};

export const collectNotificationIds = (...lists: Array<Array<{ id?: string }> | undefined>): string[] => {
  const ids = new Set<string>();
  lists.flatMap(list => list || []).forEach(notification => {
    const id = String(notification?.id || '').trim();
    if (id) ids.add(id);
  });
  return Array.from(ids);
};

export type { AppNotificationType, NotificationAction, NotificationEntityType, NotificationTargetRole };

// --- End of notificationEvents.ts ---
