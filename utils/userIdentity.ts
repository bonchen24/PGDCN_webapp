// Author: Gemini
// OS support: Web/Node
// Description: Canonical user identity helpers for preference persistence and lookup

export function normalizeUserKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '')
    .split('@')[0]
    .trim();
}

export function getUserFullName(
  user: unknown,
  fallback = 'Người dùng hệ thống'
): string {
  const source = user && typeof user === 'object'
    ? user as Record<string, unknown>
    : {};
  const candidates = [source['Họ và Tên'], source.full_name, source.name];
  const fullName = candidates
    .map(value => String(value ?? '').trim())
    .find(Boolean);

  return fullName || fallback;
}

export function getCanonicalUserKey(
  inputUsername: unknown,
  userRow?: Record<string, unknown> | null
): string {
  const rowKey = userRow?.id ??
    userRow?.['Tên đăng nhập'] ??
    userRow?.username ??
    userRow?.['Email'] ??
    userRow?.email;

  return normalizeUserKey(rowKey || inputUsername) || String(inputUsername ?? '').trim();
}

export function findUserPreference<T>(
  preferences: Record<string, T>,
  candidateKeys: unknown[]
): T | undefined {
  const keys = new Set<string>();

  for (const candidate of candidateKeys) {
    const rawKey = String(candidate ?? '').trim();
    if (rawKey) keys.add(rawKey);

    const normalizedKey = normalizeUserKey(candidate);
    if (normalizedKey) keys.add(normalizedKey);
  }

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(preferences, key)) {
      return preferences[key];
    }
  }

  return undefined;
}

// --- End of userIdentity.ts ---
