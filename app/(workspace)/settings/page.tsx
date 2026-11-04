'use client';

import React from 'react';
import PgdcnSystemSettingsView from '@/components/PgdcnSystemSettingsView';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { usePcnStore } from '@/store-pcn';

export default function SettingsPage() {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();

  if (!currentUser) return null;

  return (
    <div className="min-w-0">
      <PgdcnSystemSettingsView
        currentUser={currentUser}
        users={pcn.users}
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
