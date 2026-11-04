'use client';

import React from 'react';
import PgdcnCustomersView from '@/components/PgdcnCustomersView';
import { usePcnSessionStore } from '@/utils/pcnSessionState';

export default function CustomersPage() {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const scopes = currentUser?.departmentScopes || ['PCN', 'PGD'];

  return (
    <div className="min-w-0">
      <PgdcnCustomersView scopes={scopes} />
    </div>
  );
}
