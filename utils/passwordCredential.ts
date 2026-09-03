// Author: Codex
// OS support: Browser/Node
// Description: Small adapter around the browser password credential manager.

export interface PasswordCredentialManager {
  get?: (options: { password: true; mediation: 'silent' }) => Promise<unknown>;
  store?: (credential: unknown) => Promise<unknown>;
}

export interface PasswordCredentialConstructor {
  new (input: { id: string; password: string }): unknown;
}

export interface SavedPasswordCredential {
  username: string;
  password: string;
}

export function isPasswordCredentialStorageAvailable(
  manager: PasswordCredentialManager | null | undefined,
  CredentialConstructor: PasswordCredentialConstructor | null | undefined,
): boolean {
  return typeof manager?.store === 'function' && Boolean(CredentialConstructor);
}

export async function loadPasswordCredential(
  manager: PasswordCredentialManager | null | undefined,
): Promise<SavedPasswordCredential | null> {
  if (!manager?.get) return null;
  try {
    const credential = await manager.get({ password: true, mediation: 'silent' });
    if (!credential || typeof credential !== 'object') return null;
    const value = credential as { id?: unknown; password?: unknown };
    const username = typeof value.id === 'string' ? value.id.trim() : '';
    const password = typeof value.password === 'string' ? value.password : '';
    return username && password ? { username, password } : null;
  } catch {
    return null;
  }
}

export async function storePasswordCredential(
  manager: PasswordCredentialManager | null | undefined,
  CredentialConstructor: PasswordCredentialConstructor | null | undefined,
  username: string,
  password: string,
): Promise<boolean> {
  const normalizedUsername = String(username || '').trim();
  const normalizedPassword = String(password || '');
  if (!manager?.store || !CredentialConstructor || !normalizedUsername || !normalizedPassword) return false;
  try {
    await manager.store(new CredentialConstructor({ id: normalizedUsername, password: normalizedPassword }));
    return true;
  } catch {
    return false;
  }
}

// --- End of passwordCredential.ts ---
