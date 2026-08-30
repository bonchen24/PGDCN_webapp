import { del, get, set } from 'idb-keyval';

export function isBrowserStorageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof indexedDB !== 'undefined';
}

export const idbStorage = {
  getItem: async (name: string): Promise<string | null> => {
    if (!isBrowserStorageAvailable()) return null;
    const value = (await get(name)) || null;
    if (value) return value;

    const localValue = typeof localStorage !== 'undefined' ? localStorage.getItem(name) : null;
    if (localValue) {
      await set(name, localValue);
      return localValue;
    }
    return null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    if (!isBrowserStorageAvailable()) return;
    await set(name, value);
    try {
      localStorage.removeItem(name);
    } catch {
      // localStorage can be unavailable even when IndexedDB is usable.
    }
  },
  removeItem: async (name: string): Promise<void> => {
    if (!isBrowserStorageAvailable()) return;
    await del(name);
  },
};
