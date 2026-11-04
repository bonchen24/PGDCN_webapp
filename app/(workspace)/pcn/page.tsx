'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { usePcnStore } from '@/store-pcn';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { buildPcnOperationsRegisterRows } from '@/utils/pcnOperationsRegister';
import PcnDossierQueueView from '@/components/PcnDossierQueueView';
import PcnOperationsRegisterView from '@/components/PcnOperationsRegisterView';
import PcnSampleFlowView from '@/components/PcnSampleFlowView';

function PcnPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'queue';
  const currentUser = usePcnSessionStore((state) => state.currentUser);

  const pcn = usePcnStore();

  const registerRows = useMemo(() => {
    return buildPcnOperationsRegisterRows({
      proposals: pcn.proposals,
      dossiers: pcn.dossiers,
      sampleLots: pcn.sampleLots,
      sampleRoutes: pcn.sampleRoutes,
      labRequests: pcn.labRequests,
      returnedResults: pcn.returnedResults,
      issuancePackages: pcn.issuancePackages,
      documentRequirements: pcn.documentRequirements,
      dossierDocuments: pcn.dossierDocuments,
      fields: pcn.fields,
    });
  }, [
    pcn.proposals,
    pcn.dossiers,
    pcn.sampleLots,
    pcn.sampleRoutes,
    pcn.labRequests,
    pcn.returnedResults,
    pcn.issuancePackages,
    pcn.documentRequirements,
    pcn.dossierDocuments,
    pcn.fields,
  ]);

  const handleOpenDossier = (dossierId: string) => {
    router.push(`/pcn/dossiers/${dossierId}`);
  };

  if (activeTab === 'operations') {
    return (
      <PcnOperationsRegisterView
        fields={pcn.fields}
        proposals={pcn.proposals}
        dossiers={pcn.dossiers}
        sampleLots={pcn.sampleLots}
        sampleRoutes={pcn.sampleRoutes}
        labRequests={pcn.labRequests}
        returnedResults={pcn.returnedResults}
        issuancePackages={pcn.issuancePackages}
        documentRequirements={pcn.documentRequirements}
        dossierDocuments={pcn.dossierDocuments}
        users={pcn.users}
        currentUser={currentUser}
        currentUsername={currentUser?.username}
        canEdit={Boolean(currentUser && currentUser.systemRole !== 'viewer')}
        onOpenDossier={(dossier) => handleOpenDossier(dossier.id)}
        onUpdateProposal={pcn.updateProposal}
        onUpdateDossier={pcn.updateDossier}
      />
    );
  }

  if (activeTab === 'samples') {
    return (
      <PcnSampleFlowView
        sampleLots={pcn.sampleLots}
        sampleItems={pcn.sampleItems}
        sampleRoutes={pcn.sampleRoutes}
        dossiers={pcn.dossiers}
        proposals={pcn.proposals}
        fields={pcn.fields}
        currentUser={currentUser}
        canEdit={Boolean(currentUser && currentUser.systemRole !== 'viewer')}
        onCreate={pcn.addSampleLot}
        onRouteStatusChange={pcn.updateSampleRoute}
      />
    );
  }

  return (
    <div className="min-w-0">
      <PcnDossierQueueView
        rows={registerRows}
        onOpenDossier={handleOpenDossier}
      />
    </div>
  );
}

export default function PcnQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        </div>
      }
    >
      <PcnPageContent />
    </Suspense>
  );
}
