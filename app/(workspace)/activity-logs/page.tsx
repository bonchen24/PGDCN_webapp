'use client';

import React from 'react';
import { ActivityLogView } from '@/components/ActivityLogView';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { usePcnStore } from '@/store-pcn';

export default function ActivityLogsPage() {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();

  return (
    <div className="min-w-0">
      <ActivityLogView currentUser={currentUser} systemUsers={pcn.users} />
    </div>
  );
}
