'use client';

import React, { useMemo } from 'react';
import { ActivityLogView } from '@/components/ActivityLogView';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';

export default function ActivityLogsPage() {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();
  const systemUsers = useMemo(
    () => Array.from(new Map([...pgd.users, ...pcn.users].map((user) => [user.username, user])).values()),
    [pcn.users, pgd.users]
  );

  return (
    <div className="min-w-0">
      <ActivityLogView currentUser={currentUser} systemUsers={systemUsers} />
    </div>
  );
}
