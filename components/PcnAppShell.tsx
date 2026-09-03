'use client';

import { useEffect } from 'react';

import PgdcnAppShell from './PgdcnAppShell';

// PcnWorkspace remains the embedded PCN workspace behind this compatibility shell.

export default function PcnAppShell() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // PWA registration is optional and must not block PCN operations.
    });
  }, []);

  return <PgdcnAppShell initialDomain="PCN" />;
}
