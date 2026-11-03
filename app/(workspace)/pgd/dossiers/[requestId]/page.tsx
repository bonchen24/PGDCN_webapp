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
    <div className="min-w-0">
      <PgdWorkspace
        embedded={true}
        initialRequestId={resolvedParams.requestId}
        onRequestClose={() => router.push('/pgd')}
      />
    </div>
  );
}
