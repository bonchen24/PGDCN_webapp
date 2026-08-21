// Author: Gemini
// OS support: Web/Node
// Description: Maps notification metadata to destinations in the DDT Lab application

import { AppNotification, TestCategory } from '../types';

export type NotificationDestination =
  | { kind: 'requests'; requestCode?: string }
  | { kind: 'handover'; entityId?: string }
  | { kind: 'kqtn'; entityId?: string }
  | { kind: 'schedule_itd'; requestCode?: string }
  | { kind: 'schedule_emc'; requestCode?: string }
  | { kind: 'none' };

export const getNotificationDestination = (notification: AppNotification): NotificationDestination => {
  if (notification.entityType === 'HANDOVER_DOC') {
    return { kind: 'handover', entityId: notification.entityId };
  }
  if (notification.entityType === 'KQTN_RECORD') {
    return { kind: 'kqtn', entityId: notification.entityId };
  }
  if (notification.entityType === 'SCHEDULE') {
    return notification.testCategory === TestCategory.ATD
      ? { kind: 'schedule_itd', requestCode: notification.requestCode }
      : { kind: 'schedule_emc', requestCode: notification.requestCode };
  }
  if (notification.entityType === 'REQUEST' || notification.requestCode) {
    return { kind: 'requests', requestCode: notification.requestCode };
  }
  return { kind: 'none' };
};

// --- End of notificationNavigation.ts ---
