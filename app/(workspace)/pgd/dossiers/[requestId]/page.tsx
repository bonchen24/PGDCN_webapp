'use client';

import React, { use } from 'react';
import { useRouter } from 'next/navigation';
import PgdWorkspace from '@/components/PgdWorkspace';

export default function PgdDossierWorkspacePage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PgdWorkspace
        embedded={true}
        initialRequestId={decodeURIComponent(resolvedParams.requestId)}
        onRequestClose={() => router.push('/pgd')}
      />
    </div>
  );
}
