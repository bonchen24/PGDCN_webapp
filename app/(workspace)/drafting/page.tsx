'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import PgdcnUnifiedDraftingView, { type UnifiedDraftingTab } from '@/components/PgdcnUnifiedDraftingView';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';
import type { PgdDocumentTemplateKind } from '@/utils/pgdDocumentTemplates';
import type { PcnGeneratedDocumentKind } from '@/types';

function DraftingContent() {
  const searchParams = useSearchParams();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();

  if (!currentUser) return null;

  const scopes = currentUser.departmentScopes || ['PCN', 'PGD'];
  const domainParam = searchParams.get('domain');
  const initialDomain = domainParam === 'PCN' || domainParam === 'PGD' ? domainParam : undefined;
  const initialTab = (searchParams.get('tab') as UnifiedDraftingTab) || undefined;
  const initialPcnDossierId = searchParams.get('dossierId') || undefined;
  const initialPgdRequestId = searchParams.get('requestId') || undefined;

  return (
    <div className="min-w-0">
      <PgdcnUnifiedDraftingView
        currentUser={currentUser}
        scopes={scopes}
        pcnProposals={pcn.proposals}
        pcnDossiers={pcn.dossiers}
        pcnTemplates={pcn.templates}
        pcnRequirements={pcn.documentRequirements}
        pcnDocuments={pcn.dossierDocuments}
        pcnSampleLots={pcn.sampleLots}
        pcnSampleRoutes={pcn.sampleRoutes}
        pcnLabRequests={pcn.labRequests}
        pcnReturnedResults={pcn.returnedResults}
        onUploadPcnTemplate={pcn.uploadPcnTemplate}
        onReviewPcnTemplate={pcn.reviewPcnTemplate}
        pgdRequests={pgd.requests}
        pgdTemplates={pgd.documentTemplates}
        pgdDocuments={pgd.documents}
        canMutatePgd={currentUser.pgdRole !== 'PGD_VIEWER' && currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer'}
        initialDomain={initialDomain}
        initialTab={initialTab}
        initialPcnDossierId={initialPcnDossierId}
        initialPgdRequestId={initialPgdRequestId}
      />
    </div>
  );
}

export default function DraftingStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
        </div>
      }
    >
      <DraftingContent />
    </Suspense>
  );
}
