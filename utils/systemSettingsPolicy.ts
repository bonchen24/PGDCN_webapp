// Author: Gemini
// OS support: Web/Node
// Description: Separates system settings access for Admin and operational Managers

import type { UserAccount } from '../types';
import { isOrganizationLeader } from './pcnRbac';

type SystemSettingsUser = Partial<UserAccount> & {
  'Chức vụ'?: string;
};

export const isSystemSettingsAdmin = (user?: SystemSettingsUser | null): boolean =>
  user?.systemRole === 'admin' || user?.role === 'admin';

export const isSystemSettingsManager = (user?: SystemSettingsUser | null): boolean => {
  if (isSystemSettingsAdmin(user)) return false;
  return isOrganizationLeader(user);
};

export const canViewSystemSettings = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user) || isSystemSettingsManager(user);

export const canEditOperationalSettings = (user?: SystemSettingsUser | null): boolean =>
  canViewSystemSettings(user);

export const canManageSystemUsers = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user) || isSystemSettingsManager(user);

export const isAdminOnlyAction = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user);

// --- End of systemSettingsPolicy.ts ---
