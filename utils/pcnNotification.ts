import type { ActivityLog, AppNotification, NotificationAction, NotificationEntityType, NotificationTargetRole } from '../types.ts';

const PCN_NOTIFICATION_ENTITIES = new Set<NotificationEntityType>([
  'PCN_PROPOSAL',
  'PCN_DOSSIER',
  'PCN_SAMPLE_LOT',
  'PCN_LAB_REQUEST',
  'PCN_RESULT',
  'PCN_APPROVAL',
  'PCN_ISSUANCE',
]);

const ACTIVITY_SOURCES_WITHOUT_NOTIFICATION = new Set(['IMPORT', 'RESTORE']);
const PCN_NOTIFICATION_ACTIONS = new Set<NotificationAction>([
  'CREATED',
  'UPDATED',
  'DELETED',
  'STATUS_CHANGED',
  'SCHEDULED',
  'UNSCHEDULED',
  'ASSIGNED',
]);

function getAssigneeUsernames(activity: ActivityLog): string[] {
  const assignmentFields = new Set(['assigneeUsername', 'ownerUsername', 'evaluatorUsername', 'reviewerUsername', 'assignedToUsername']);
  return Array.from(new Set((activity.changes || [])
    .filter((change) => assignmentFields.has(change.field) && typeof change.after === 'string')
    .map((change) => String(change.after).trim().toLowerCase())
    .filter(Boolean)));
}

function isPcnDossierAssignment(activity: ActivityLog): boolean {
  if (activity.entityType !== 'PCN_DOSSIER') return false;
  const assignmentFields = new Set(['ownerUsername', 'evaluatorUsername', 'reviewerUsername']);
  return (activity.changes || []).some((change) => assignmentFields.has(change.field) && typeof change.after === 'string' && Boolean(String(change.after).trim()));
}

function getTitle(activity: ActivityLog): string {
  const labels: Record<string, string> = {
    PCN_PROPOSAL: 'Đề nghị PCN',
    PCN_DOSSIER: 'Hồ sơ PCN',
    PCN_SAMPLE_LOT: 'Lô mẫu PCN',
    PCN_LAB_REQUEST: 'PYC gửi PTN',
    PCN_RESULT: 'KQTN PCN',
    PCN_APPROVAL: 'Phê duyệt PCN',
    PCN_ISSUANCE: 'Phát hành PCN',
  };
  const label = labels[activity.entityType] || 'Hoạt động PCN';
  if (activity.action === 'CREATED') return `${label} mới`;
  if (activity.action === 'STATUS_CHANGED') return `${label} đổi trạng thái`;
  if (activity.action === 'ASSIGNED') return `${label} được phân công`;
  return `${label} được cập nhật`;
}

export function isPcnNotification(notification: Pick<AppNotification, 'entityType'> | null | undefined): boolean {
  return Boolean(notification?.entityType && PCN_NOTIFICATION_ENTITIES.has(notification.entityType));
}

export function buildPcnNotificationFromActivity(activity: ActivityLog): AppNotification | null {
  const entityType = PCN_NOTIFICATION_ENTITIES.has(activity.entityType as NotificationEntityType)
    ? activity.entityType as NotificationEntityType
    : null;
  const action = PCN_NOTIFICATION_ACTIONS.has(activity.action as NotificationAction)
    ? activity.action as NotificationAction
    : null;
  if (!entityType || !action || ACTIVITY_SOURCES_WITHOUT_NOTIFICATION.has(String(activity.source || '').toUpperCase())) return null;

  const targetUsernames = getAssigneeUsernames(activity);
  const effectiveAction: NotificationAction = isPcnDossierAssignment(activity) ? 'ASSIGNED' : action;
  const isNewProposal = entityType === 'PCN_PROPOSAL' && effectiveAction === 'CREATED';
  const targetRole: NotificationTargetRole = isNewProposal || effectiveAction === 'ASSIGNED' ? 'staff' : 'admin';
  return {
    id: `pcn-notif-${activity.id}`,
    type: 'BUSINESS_ACTIVITY',
    title: getTitle(activity),
    message: `${activity.summary || 'Có hoạt động mới trong PCN'} | Bởi: ${activity.actorName || 'Người dùng hệ thống'}`,
    entityType,
    action: effectiveAction,
    entityId: activity.entityId,
    entityLabel: activity.entityLabel,
    createdBy: activity.actorName,
    createdAt: activity.createdAt,
    read: false,
    targetRole,
    ...(targetUsernames.length > 0 ? { targetUsernames } : {}),
  };
}

// --- End of pcnNotification.ts ---
