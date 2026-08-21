// Author: Gemini
// OS support: Web/Node
// Description: Utility for triggering native Windows desktop notifications via Web Notification API

export const isNotificationSupported = (): boolean => {
  return typeof window !== 'undefined' && 'Notification' in window;
};

export const getNotificationPermission = (): NotificationPermission => {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
};

export const requestWindowsNotificationPermission = async (): Promise<boolean> => {
  if (!isNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.warn("Lỗi xin quyền thông báo Windows:", error);
    return false;
  }
};

export const sendWindowsNotification = async (
  title: string, 
  options?: NotificationOptions & { url?: string }
): Promise<boolean> => {
  if (!isNotificationSupported()) return false;

  if (Notification.permission !== 'granted') {
    return false;
  }

  try {
    const notifOptions: NotificationOptions = {
      body: options?.body || '',
      icon: options?.icon || '/tvci_logo.jpg',
      badge: options?.badge || '/tvci_logo.jpg',
      tag: options?.tag || `ddt-notif-${Date.now()}`,
      requireInteraction: false,
      ...options
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, notifOptions);
        return true;
      }
    }

    const notification = new Notification(title, notifOptions);
    notification.onclick = (event) => {
      event.preventDefault();
      window.focus();
      if (options?.url) {
        window.location.href = options.url;
      }
      notification.close();
    };

    return true;
  } catch (error) {
    console.warn("Không thể phát thông báo Windows:", error);
    return false;
  }
};

// --- End of windowNotification.ts ---
