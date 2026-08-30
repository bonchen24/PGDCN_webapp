import type { ActivityLog, ActivityLogAction, ActivityLogChange, ActivityLogEntityType, UserRole } from '../types.ts';
import type { UserAccount } from '../types.ts';
import { buildActivityLog, type ActivityLogActor } from './activityLog.ts';

export interface PcnActivityInput {
  id?: string;
  action: ActivityLogAction;
  entityType: Extract<ActivityLogEntityType, `PCN_${string}`>;
  entityId: string;
  entityLabel?: string;
  summary: string;
  actor?: ActivityLogActor & { role?: UserRole };
  changes?: ActivityLogChange[];
  createdAt?: string;
}

export function buildPcnAuditActor(user?: Partial<UserAccount> | null): ActivityLogActor & { role?: UserRole } {
  const name = String(user?.name || '').trim();
  const username = String(user?.username || '').trim();
  const position = String(user?.position || '').trim();
  return {
    ...(username ? { username } : {}),
    name: name || 'Người dùng PCN',
    ...(user?.systemRole || user?.role ? { role: user.systemRole || user.role } : {}),
    ...(position ? { position } : {}),
    ...(user?.departmentRoleCode ? { departmentRoleCode: user.departmentRoleCode } : {}),
    ...(user?.fieldCodes?.length ? { fieldCodes: user.fieldCodes } : {}),
  };
}

export function buildPcnActivityLog(input: PcnActivityInput): ActivityLog {
  const actor = input.actor || {};
  return buildActivityLog({
    id: input.id,
    createdAt: input.createdAt,
    actor,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    entityLabel: input.entityLabel,
    summary: input.summary,
    changes: input.changes,
    source: 'UI',
  });
}

// --- End of pcnAudit.ts ---
