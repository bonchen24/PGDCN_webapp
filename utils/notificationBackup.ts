// Author: Gemini
// OS support: Web/Node
// Description: Builds and normalizes backup payloads containing business notifications

import { ActivityLog, ActivityLogAction, ActivityLogEntityType, AppNotification } from '../types';
import { buildNotification, type NotificationDraft } from './notificationEvents';
import { buildActivityLog } from './activityLog';

export interface BackupPayload {
  requests: unknown[];
  handoverDocs: unknown[];
  kqtnRecords: unknown[];
  customers: unknown[];
  products: unknown[];
  brands: unknown[];
  dayConfigs: Record<string, unknown>;
  systemUsers: unknown[];
  settings: Record<string, unknown>;
  notifications: AppNotification[];
  activityLogs: ActivityLog[];
  timestamp: string;
}

export const buildBackupPayload = (
  state: any,
  timestamp = new Date().toISOString(),
  activityLogs: ActivityLog[] = []
): BackupPayload => ({
  requests: Array.isArray(state?.requests) ? state.requests : [],
  handoverDocs: Array.isArray(state?.handoverDocs) ? state.handoverDocs : [],
  kqtnRecords: Array.isArray(state?.kqtnRecords) ? state.kqtnRecords : [],
  customers: Array.isArray(state?.customers) ? state.customers : [],
  products: Array.isArray(state?.products) ? state.products : [],
  brands: Array.isArray(state?.brands) ? state.brands : [],
  dayConfigs: state?.dayConfigs && typeof state.dayConfigs === 'object' ? state.dayConfigs : {},
  systemUsers: Array.isArray(state?.systemUsers) ? state.systemUsers : [],
  settings: state?.settings && typeof state.settings === 'object' ? state.settings : {},
  notifications: Array.isArray(state?.notifications) ? state.notifications : [],
  activityLogs: Array.isArray(activityLogs) ? activityLogs : [],
  timestamp,
});

export const downloadBackupJson = (payload: BackupPayload): void => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Backup_DDTLab_${payload.timestamp.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const normalizeBackupNotifications = (rawNotifications: unknown, now = new Date().toISOString()): AppNotification[] => {
  if (!Array.isArray(rawNotifications)) return [];

  return rawNotifications
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item, index) => {
      const id = String(item.id || `backup-notification-${index}`);
      const draft = {
        ...item,
        id,
        type: item.type || 'SYSTEM',
        title: item.title || 'Thông báo hệ thống',
        message: item.message || '',
        createdAt: item.createdAt || now,
        read: item.read ?? false,
      } as NotificationDraft;
      return buildNotification(draft, now, id);
    });
};

const VALID_ACTIVITY_ACTIONS = new Set<ActivityLogAction>([
  'CREATED',
  'UPDATED',
  'DELETED',
  'STATUS_CHANGED',
  'SCHEDULED',
  'UNSCHEDULED',
  'ASSIGNED',
  'IMPORTED',
  'RESTORED',
  'CONFIGURED',
]);

const VALID_ACTIVITY_ENTITIES = new Set<ActivityLogEntityType>([
  'REQUEST',
  'HANDOVER_DOC',
  'KQTN_RECORD',
  'SCHEDULE',
  'USER',
  'CUSTOMER',
  'PRODUCT',
  'BRAND',
  'SYSTEM_SETTINGS',
  'SYSTEM',
]);

export const normalizeBackupActivityLogs = (rawActivityLogs: unknown, now = new Date().toISOString()): ActivityLog[] => {
  if (!Array.isArray(rawActivityLogs)) return [];

  return rawActivityLogs
    .filter((item): item is Record<string, any> => Boolean(item && typeof item === 'object'))
    .map((item, index) => {
      const action = VALID_ACTIVITY_ACTIONS.has(item.action) ? item.action : 'UPDATED';
      const entityType = VALID_ACTIVITY_ENTITIES.has(item.entityType) ? item.entityType : 'SYSTEM';
      const source = item.source === 'UI' || item.source === 'IMPORT' || item.source === 'RESTORE' || item.source === 'SYSTEM'
        ? item.source
        : 'SYSTEM';
      return buildActivityLog({
        ...item,
        id: String(item.id || `backup-activity-${index}`),
        createdAt: String(item.createdAt || now),
        actorName: String(item.actorName || 'Người dùng hệ thống'),
        summary: String(item.summary || item.message || 'Hoạt động hệ thống'),
        action,
        entityType,
        source,
      });
    });
};

// --- End of notificationBackup.ts ---
