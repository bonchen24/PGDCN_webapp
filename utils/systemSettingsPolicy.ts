// Author: Gemini
// OS support: Web/Node
// Description: Separates system settings access for Admin and operational Managers

import type { UserAccount } from '../types';

type SystemSettingsUser = Partial<UserAccount> & {
  'Chức vụ'?: string;
};

const normalizedPosition = (user?: SystemSettingsUser | null): string =>
  String(user?.position || user?.['Chức vụ'] || '').trim().toLowerCase();

export const isSystemSettingsAdmin = (user?: SystemSettingsUser | null): boolean =>
  user?.role === 'admin';

export const isSystemSettingsManager = (user?: SystemSettingsUser | null): boolean => {
  if (isSystemSettingsAdmin(user)) return false;
  const position = normalizedPosition(user);
  return position.includes('quản lý') || position.includes('trưởng phòng');
};

export const canViewSystemSettings = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user) || isSystemSettingsManager(user);

export const canEditOperationalSettings = (user?: SystemSettingsUser | null): boolean =>
  canViewSystemSettings(user);

export const isAdminOnlyAction = (user?: SystemSettingsUser | null): boolean =>
  isSystemSettingsAdmin(user);

// --- End of systemSettingsPolicy.ts ---
