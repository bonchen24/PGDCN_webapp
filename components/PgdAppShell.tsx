'use client';

import { useEffect } from 'react';

import PgdcnAppShell from './PgdcnAppShell';

// PgdWorkspace remains the embedded PGD workspace behind this compatibility shell.

export default function PgdAppShell() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Optional infrastructure must not block PGD operations.
    });
  }, []);

  return <PgdcnAppShell initialDomain="PGD" />;
}
