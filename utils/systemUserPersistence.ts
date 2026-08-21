// Author: Gemini
// OS support: Web/Node
// Description: Helpers for preserving system-user lifecycle markers during persistence

export function removeDeletedUserMarker(
  localDeletedUserIds: string[],
  cloudDeletedUserIds: string[],
  userId: string
): string[] {
  const normalizedUserId = String(userId).trim().toLowerCase();
  const mergedIds = [...localDeletedUserIds, ...cloudDeletedUserIds]
    .map(id => String(id).trim())
    .filter(Boolean);

  return Array.from(new Set(mergedIds))
    .filter(id => id.toLowerCase() !== normalizedUserId);
}

export function getDeletedUserIdsFromConfig(configs: any[]): string[] {
  const config = (configs || []).find(item =>
    item?.id === 'deletedUserIds' || item?.configKey === 'deletedUserIds'
  );
  const rawValue = config?.configValue;
  if (Array.isArray(rawValue)) return rawValue.map(String).filter(Boolean);
  if (rawValue === undefined || rawValue === null) return [];

  const value = String(rawValue).trim();
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    if (parsed !== undefined && parsed !== null) return [String(parsed)].filter(Boolean);
  } catch {
    return value.split(',').map(item => item.trim()).filter(Boolean);
  }
  return [value];
}

// --- End of systemUserPersistence.ts ---
