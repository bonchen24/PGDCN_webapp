// Author: Gemini
// OS support: Web/Node
// Description: Pure builders, diff helpers, redaction, and access policy for system activity logs

import type { ActivityLog, ActivityLogAction, ActivityLogChange, ActivityLogEntityType, UserAccount, UserRole } from '../types.ts';
import { getUserFullName } from './userIdentity.ts';

export interface ActivityLogActor {
  username?: string;
  name?: string;
  full_name?: string;
  'Họ và Tên'?: string;
  role?: UserRole;
  position?: string;
  departmentRoleCode?: string;
  fieldCodes?: string[];
}

export interface ActivityLogInput {
  id?: string;
  createdAt?: string;
  actor?: ActivityLogActor | null;
  actorUsername?: string;
  actorName?: string;
  actorRole?: UserRole;
  action: ActivityLogAction;
  entityType: ActivityLogEntityType;
  entityId?: string;
  entityLabel?: string;
  requestCode?: string;
  docNumber?: string;
  reportNo?: string;
  summary: string;
  changes?: ActivityLogChange[];
  source: ActivityLog['source'];
  groupId?: string;
  idempotencyKey?: string;
  idempotencyFingerprint?: string;
}

const REDACTED = '[REDACTED]';

const isSensitiveField = (field: string): boolean =>
  /(password|token|secret|api[-_]?key|geminiApiKey|customPassword)/i.test(field);

export const sanitizeActivityValue = (value: unknown): unknown => {
  if (value === undefined) return null;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(sanitizeActivityValue);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([key]) => !isSensitiveField(key))
        .map(([key, item]) => [key, sanitizeActivityValue(item)])
    );
  }
  return String(value);
};

const normalizeChange = (change: ActivityLogChange): ActivityLogChange => ({
  field: String(change.field),
  before: isSensitiveField(change.field) ? REDACTED : sanitizeActivityValue(change.before),
  after: isSensitiveField(change.field) ? REDACTED : sanitizeActivityValue(change.after),
});

export const diffActivityFields = (
  before: unknown,
  after: unknown,
  fields?: string[]
): ActivityLogChange[] => {
  const previous = before && typeof before === 'object' && !Array.isArray(before)
    ? before as Record<string, unknown>
    : {};
  const next = after && typeof after === 'object' && !Array.isArray(after)
    ? after as Record<string, unknown>
    : {};
  const keys = fields ? fields : Array.from(new Set([...Object.keys(previous), ...Object.keys(next)])).sort();

  return keys
    .filter(field => JSON.stringify(previous[field]) !== JSON.stringify(next[field]))
    .map(field => normalizeChange({ field, before: previous[field], after: next[field] }));
};

const createActivityId = (): string => {
  const randomPart = Math.random().toString(36).slice(2, 10);
  return `activity-${Date.now()}-${randomPart}`;
};

export const isValidActivityTimestamp = (value: unknown): value is string => {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(text)
    && !Number.isNaN(Date.parse(text));
};

export const buildActivityLog = (input: ActivityLogInput): ActivityLog => {
  const actor = input.actor || {};
  const actorName = String(input.actorName || getUserFullName(actor)).trim();
  const log: ActivityLog = {
    id: String(input.id || createActivityId()),
    createdAt: input.createdAt || new Date().toISOString(),
    actorName: actorName || 'Người dùng hệ thống',
    action: input.action,
    entityType: input.entityType,
    summary: String(input.summary || '').trim() || 'Thao tác hệ thống',
    source: input.source,
  };

  const actorUsername = input.actorUsername || actor.username;
  const actorRole = input.actorRole || actor.role;
  if (actorUsername) log.actorUsername = String(actorUsername);
  if (actorRole) log.actorRole = actorRole;
  if (input.entityId) log.entityId = String(input.entityId);
  if (input.entityLabel) log.entityLabel = String(input.entityLabel);
  if (input.requestCode) log.requestCode = String(input.requestCode);
  if (input.docNumber) log.docNumber = String(input.docNumber);
  if (input.reportNo) log.reportNo = String(input.reportNo);
  if (input.groupId) log.groupId = String(input.groupId);
  if (input.idempotencyKey) log.idempotencyKey = String(input.idempotencyKey);
  if (input.idempotencyFingerprint) log.idempotencyFingerprint = String(input.idempotencyFingerprint);
  if (input.changes?.length) log.changes = input.changes.map(normalizeChange);

  return log;
};

export const isActivityLogVisibleToUser = (user: Pick<UserAccount, 'role' | 'position' | 'systemRole'> | null | undefined): boolean => {
  if (!user) return false;
  const systemRole = String(user.systemRole || '').trim().toLowerCase();
  if (systemRole === 'admin' || systemRole === 'staff' || systemRole === 'viewer') return true;
  return user.role !== 'office_clerk';
};

export const activityActionLabels: Record<ActivityLogAction, string> = {
  CREATED: 'Tạo mới',
  UPDATED: 'Cập nhật',
  DELETED: 'Xóa',
  STATUS_CHANGED: 'Đổi trạng thái',
  SCHEDULED: 'Xếp lịch',
  UNSCHEDULED: 'Gỡ lịch',
  ASSIGNED: 'Giao việc',
  IMPORTED: 'Nhập dữ liệu',
  RESTORED: 'Khôi phục',
  CONFIGURED: 'Cấu hình',
};

export const activityEntityLabels: Record<ActivityLogEntityType, string> = {
  PCN_PROPOSAL: 'Đề nghị PCN',
  PCN_DOSSIER: 'Hồ sơ chứng nhận PCN',
  PCN_CUSTOMER: 'Khách hàng PCN',
  PCN_LAB_REQUEST: 'PYC gửi PTN',
  PCN_RESULT: 'KQTN trả về PCN',
  PCN_APPROVAL: 'Phê duyệt PCN',
  PCN_ISSUANCE: 'Phát hành PCN',
  PCN_TEMPLATE: 'Biểu mẫu PCN',
  PCN_FIELD: 'Lĩnh vực',
  PCN_USER: 'Nhân sự PCN',
  PCN_SIGNER_DELEGATION: 'Ủy quyền người ký PCN',
  PCN_QUALITY_DOCUMENT: 'Tài liệu chất lượng PCN',
  PCN_DRAFT: 'Bản soạn thảo PCN',
  PCN_SAMPLE_LOT: 'Lô mẫu PCN',
  REQUEST: 'Phiếu yêu cầu',
  HANDOVER_DOC: 'Biên bản giao nhận',
  KQTN_RECORD: 'Kết quả thử nghiệm',
  SCHEDULE: 'Lịch thử nghiệm',
  USER: 'Người dùng',
  CUSTOMER: 'Khách hàng',
  PRODUCT: 'Sản phẩm',
  BRAND: 'Thương hiệu',
  SYSTEM_SETTINGS: 'Thiết lập hệ thống',
  SYSTEM: 'Hệ thống',
};

// --- End of activityLog.ts ---
