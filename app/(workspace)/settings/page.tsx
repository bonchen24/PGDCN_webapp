'use client';

import React, { useMemo } from 'react';
import PgdcnSystemSettingsView from '@/components/PgdcnSystemSettingsView';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';

export default function SettingsPage() {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();
  const systemUsers = useMemo(
    () => Array.from(new Map([...pgd.users, ...pcn.users].map((user) => [user.username, user])).values()),
    [pcn.users, pgd.users]
  );

  if (!currentUser) return null;

  return (
    <div className="min-w-0">
      <PgdcnSystemSettingsView
        currentUser={currentUser}
        users={systemUsers}
        roles={pcn.departmentRoles}
        fields={pcn.fields}
        onCreate={pcn.addPcnUser}
        onUpdate={pcn.updatePcnUser}
        onDelete={pcn.deletePcnUser}
        onResetPassword={pcn.resetPcnUserPassword}
      />
    </div>
  );
}
