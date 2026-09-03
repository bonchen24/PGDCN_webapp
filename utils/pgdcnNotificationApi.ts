import type { AppNotification } from '../types.ts';
import { normalizePgdcnNotification } from './pgdcnNotification.ts';

const PGDCN_NOTIFICATION_API_PATH = '/api/pgdcn/notifications';
type PgdcnNotificationFetch = typeof fetch;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {
    // Fall through to the status-based message.
  }
  return `PGDCN notification request failed with status ${response.status}`;
}

export function createPgdcnNotificationClient(fetchImpl: PgdcnNotificationFetch = fetch) {
  const request = async (path: string, init: RequestInit = {}): Promise<any> => {
    const response = await fetchImpl(path, {
      credentials: 'same-origin',
      ...init,
      headers: {
        Accept: 'application/json',
        ...(init.headers || {}),
      },
    });
    if (!response.ok) throw new Error(await readErrorMessage(response));
    if (response.status === 204) return {};
    return response.json();
  };

  return {
    async fetch(): Promise<AppNotification[]> {
      const payload = await request(PGDCN_NOTIFICATION_API_PATH);
      return Array.isArray(payload?.items)
        ? payload.items.map((item: AppNotification) => normalizePgdcnNotification(item))
        : [];
    },
    async markRead(notificationId: string): Promise<void> {
      await request(`${PGDCN_NOTIFICATION_API_PATH}/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
    },
    async markAllRead(): Promise<void> {
      await request(`${PGDCN_NOTIFICATION_API_PATH}/read-all`, { method: 'POST' });
    },
    async clear(): Promise<void> {
      await request(`${PGDCN_NOTIFICATION_API_PATH}/clear`, { method: 'DELETE' });
    },
  };
}

export const pgdcnNotificationClient = createPgdcnNotificationClient();

export const fetchPgdcnNotifications = (): Promise<AppNotification[]> => pgdcnNotificationClient.fetch();
export const markPgdcnNotificationRead = (notificationId: string): Promise<void> => pgdcnNotificationClient.markRead(notificationId);
export const markAllPgdcnNotificationsRead = (): Promise<void> => pgdcnNotificationClient.markAllRead();
export const clearPgdcnNotifications = (): Promise<void> => pgdcnNotificationClient.clear();
