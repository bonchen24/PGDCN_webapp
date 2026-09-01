import type { AppNotification } from '../types';

const PCN_NOTIFICATION_API_PATH = '/api/pcn/notifications';

type PcnNotificationFetch = typeof fetch;

async function readErrorMessage(response: Response): Promise<string> {
  try {
    const payload = await response.json() as { error?: unknown };
    if (typeof payload.error === 'string' && payload.error.trim()) return payload.error;
  } catch {
    // Fall through to the status-based message.
  }
  return `PCN notification request failed with status ${response.status}`;
}

export function createPcnNotificationClient(fetchImpl: PcnNotificationFetch = fetch) {
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
      const payload = await request(PCN_NOTIFICATION_API_PATH);
      return Array.isArray(payload?.items) ? payload.items as AppNotification[] : [];
    },
    async markRead(notificationId: string): Promise<void> {
      await request(`${PCN_NOTIFICATION_API_PATH}/${encodeURIComponent(notificationId)}/read`, { method: 'POST' });
    },
    async markAllRead(): Promise<void> {
      await request(`${PCN_NOTIFICATION_API_PATH}/read-all`, { method: 'POST' });
    },
    async clear(): Promise<void> {
      await request(`${PCN_NOTIFICATION_API_PATH}/clear`, { method: 'POST' });
    },
  };
}

export const pcnNotificationClient = createPcnNotificationClient();

export const fetchPcnNotifications = (): Promise<AppNotification[]> => pcnNotificationClient.fetch();
export const markPcnNotificationRead = (notificationId: string): Promise<void> => pcnNotificationClient.markRead(notificationId);
export const markAllPcnNotificationsRead = (): Promise<void> => pcnNotificationClient.markAllRead();
export const clearPcnNotifications = (): Promise<void> => pcnNotificationClient.clear();
