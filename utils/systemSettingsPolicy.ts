// Author: Gemini
// OS support: Web/Node
// Description: Separates system settings access for Admin and operational Managers

import type { UserAccount } from '../types';
import { isOrganizationLeader } from './pcnRbac';

type SystemSettingsUser = Partial<UserAccount> & {
  'Chức vụ'?: string;
};

export const isSystemSettingsAdmin = (user?: SystemSettingsUser | null): boolean =>
  user?.active !== false && (user?.systemRole === 'admin' || user?.role === 'admin');

export const isSystemSettingsManager = (user?: SystemSettingsUser | null): boolean => {
  if (isSystemSettingsAdmin(user)) return false;
  if (!user || user.active === false || user.systemRole === 'viewer' || user.role === 'viewer') return false;
  if (!isOrganizationLeader(user)) return false;

  const scopes = new Set((user.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase()));
  return scopes.has('PCN') && scopes.has('PGD');
};

export const canViewSystemSettings = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user) || isSystemSettingsManager(user);

export const canEditOperationalSettings = (user?: SystemSettingsUser | null): boolean =>
  canViewSystemSettings(user);

export const canManageSystemUsers = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user) || isSystemSettingsManager(user);

export const canReadPcnUserDirectory = (user?: SystemSettingsUser | null): boolean => {
  if (!user || user.active === false) return false;
  if (isSystemSettingsAdmin(user)) return true;
  return (user.departmentScopes || []).some((scope) => String(scope).trim().toUpperCase() === 'PCN');
};

export const canSetSystemUserRole = (
  actor?: SystemSettingsUser | null,
  candidate?: SystemSettingsUser | null,
): boolean => {
  if (isSystemSettingsAdmin(actor)) return true;
  if (!isSystemSettingsManager(actor) || !candidate) return false;
  return !isSystemSettingsAdmin(candidate) && !isOrganizationLeader(candidate);
};

export const canManageSystemUser = (
  actor?: SystemSettingsUser | null,
  target?: SystemSettingsUser | null,
): boolean => {
  if (!canManageSystemUsers(actor) || !target) return false;
  if (isSystemSettingsAdmin(actor)) return true;
  if (isSystemSettingsAdmin(target) || isOrganizationLeader(target)) return false;

  const actorScopes = new Set((actor?.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase()));
  const targetScopes = (target.departmentScopes || []).map((scope) => String(scope).trim().toUpperCase());
  return targetScopes.length > 0 && targetScopes.every((scope) => actorScopes.has(scope));
};

export const isAdminOnlyAction = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user);

// --- End of systemSettingsPolicy.ts ---
