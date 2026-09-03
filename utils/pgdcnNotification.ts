import type {
  AppNotification,
  DepartmentScope,
  NotificationAction,
  NotificationDomain,
  NotificationEntityType,
  UserAccount,
} from '../types.ts';

export type PgdcnNotificationNavigationTarget =
  | { domain: 'PCN'; section: 'proposals' | 'operations' | 'lab-operations' | 'drafting'; recordId: string }
  | { domain: 'PGD'; section: 'requests' | 'field' | 'labs' | 'results'; recordId: string };

export type PgdNotificationDraftInput = {
  entityType: Extract<NotificationEntityType, `PGD_${string}`>;
  action: NotificationAction;
  entityId: string;
  entityLabel: string;
  actorName: string;
  requestCode?: string;
  previousStatus?: string;
  nextStatus?: string;
  targetUsernames?: string[];
};

const normalizeIdentity = (value: unknown): string => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/^@/, '')
  .trim();

const timestamp = (value: string | undefined): number => {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : 0;
};

export function normalizePgdcnNotification(input: AppNotification): AppNotification & { domain: NotificationDomain } {
  return {
    ...input,
    domain: input.domain === 'PGD' ? 'PGD' : 'PCN',
    read: Boolean(input.read),
  };
}

export function buildPgdNotificationDraft(input: PgdNotificationDraftInput): Omit<AppNotification, 'id' | 'createdAt' | 'read' | 'domain'> {
  const isCreated = input.action === 'CREATED';
  const isRequestCreated = input.entityType === 'PGD_REQUEST' && isCreated;
  const title = input.entityType === 'PGD_REQUEST'
    ? (input.action === 'STATUS_CHANGED' ? 'Hồ sơ PGD đổi trạng thái' : isCreated ? 'PYC PGD mới' : 'Hồ sơ PGD được cập nhật')
    : input.entityType === 'PGD_ASSIGNMENT'
      ? 'Công việc PGD được phân công'
      : input.entityType === 'PGD_FIELD_INSPECTION'
        ? 'Hiện trường PGD được cập nhật'
        : input.entityType === 'PGD_SAMPLE'
          ? 'Mẫu PGD được cập nhật'
          : input.entityType === 'PGD_LAB_REQUEST'
            ? 'PYC PTN PGD được cập nhật'
            : input.entityType === 'PGD_LAB_RESULT'
              ? 'Kết quả PGD mới'
              : input.entityType === 'PGD_REPORT'
                ? 'Báo cáo PGD được cập nhật'
                : input.entityType === 'PGD_CERTIFICATE'
                  ? 'Chứng thư PGD được cập nhật'
                  : 'Phê duyệt PGD được cập nhật';
  const statusText = input.action === 'STATUS_CHANGED'
    ? ` | Trạng thái: ${input.previousStatus || '—'} → ${input.nextStatus || '—'}`
    : '';
  return {
    type: isCreated ? 'NEW_REQUEST' : input.action === 'STATUS_CHANGED' ? 'STATUS_CHANGE' : 'BUSINESS_ACTIVITY',
    title,
    message: `${input.entityLabel}${statusText} | Bởi: ${input.actorName || 'Người dùng hệ thống'}`,
    entityType: input.entityType,
    action: input.action,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    requestCode: input.requestCode,
    previousStatus: input.previousStatus,
    nextStatus: input.nextStatus,
    createdBy: input.actorName,
    targetRole: input.targetUsernames?.length || isRequestCreated ? 'staff' : 'admin',
    targetUsernames: input.targetUsernames?.length ? input.targetUsernames : undefined,
  };
}

export function mergePgdcnNotifications(
  lists: readonly AppNotification[][],
  limit = 50,
): Array<AppNotification & { domain: NotificationDomain }> {
  const byId = new Map<string, AppNotification & { domain: NotificationDomain }>();
  for (const list of lists) {
    for (const raw of list || []) {
      if (!raw?.id) continue;
      const next = normalizePgdcnNotification(raw);
      const current = byId.get(next.id);
      if (!current) {
        byId.set(next.id, next);
        continue;
      }
      const newest = timestamp(next.createdAt) >= timestamp(current.createdAt) ? next : current;
      byId.set(next.id, { ...newest, read: current.read || next.read });
    }
  }

  return Array.from(byId.values())
    .sort((left, right) => timestamp(right.createdAt) - timestamp(left.createdAt) || right.id.localeCompare(left.id))
    .slice(0, Math.max(0, limit));
}

const isManager = (user: UserAccount): boolean => {
  const position = normalizeIdentity(user.position);
  return user.role === 'admin'
    || user.systemRole === 'admin'
    || user.departmentRoleCode === 'LEADERSHIP'
    || user.pgdRole === 'PGD_MANAGER'
    || position.includes('quan ly')
    || position.includes('truong phong')
    || position.includes('pho')
    || position.includes('lanh dao');
};

export function canViewPgdcnNotification(
  notification: AppNotification,
  user: UserAccount | null | undefined,
): boolean {
  if (!user) return false;
  const normalized = normalizePgdcnNotification(notification);
  const scopes = (user.departmentScopes || []).filter((scope): scope is DepartmentScope => scope === 'PCN' || scope === 'PGD');
  if (scopes.length > 0 && !scopes.includes(normalized.domain)) return false;
  if (isManager(user)) return true;

  const targetUsernames = normalized.targetUsernames || [];
  if (targetUsernames.length > 0) {
    const username = normalizeIdentity(user.username);
    return targetUsernames.some((target) => normalizeIdentity(target) === username);
  }
  return normalized.targetRole === 'staff'
    || normalized.targetRole === 'all'
    || (!normalized.targetRole && normalized.type === 'SYSTEM');
}

export function getPgdcnNotificationNavigation(notification: AppNotification): PgdcnNotificationNavigationTarget | null {
  const entityId = String(notification.entityId || '').trim();
  if (!entityId) return null;
  const domain = normalizePgdcnNotification(notification).domain;
  if (domain === 'PCN') {
    switch (notification.entityType) {
      case 'PCN_DOSSIER':
      case 'PCN_PROPOSAL':
        return { domain, section: 'proposals', recordId: entityId };
      case 'PCN_SAMPLE_LOT':
      case 'PCN_LAB_REQUEST':
      case 'PCN_RESULT':
        return { domain, section: 'lab-operations', recordId: entityId };
      case 'PCN_APPROVAL':
      case 'PCN_ISSUANCE':
        return { domain, section: 'drafting', recordId: entityId };
      default:
        return null;
    }
  }

  switch (notification.entityType) {
    case 'PGD_REQUEST':
    case 'PGD_ASSIGNMENT':
      return { domain, section: 'requests', recordId: entityId };
    case 'PGD_FIELD_INSPECTION':
    case 'PGD_SAMPLE':
      return { domain, section: 'field', recordId: entityId };
    case 'PGD_LAB_REQUEST':
      return { domain, section: 'labs', recordId: entityId };
    case 'PGD_LAB_RESULT':
    case 'PGD_REPORT':
    case 'PGD_CERTIFICATE':
    case 'PGD_APPROVAL':
      return { domain, section: 'results', recordId: entityId };
    default:
      return null;
  }
}
