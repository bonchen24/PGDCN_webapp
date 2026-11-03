'use client';

import React, { Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { usePgdStore } from '@/store-pgd';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import PgdDossierQueueView, { type PgdDossierQueueRow } from '@/components/PgdDossierQueueView';
import PgdSummaryRegisterView from '@/components/PgdSummaryRegisterView';
import PgdSampleOperationsView from '@/components/PgdSampleOperationsView';
import { getPgdDossierRequirements } from '@/utils/pgdDossier';
import {
  getPgdStatusLabel,
  getPgdCatalogItemLabel,
  type PgdInspectionRequestInput,
} from '@/utils/pgdDomain';
import {
  getPgdDossierCurrentStepNumber,
  getPgdDossierFlowStepIdForStatus,
  PGD_DOSSIER_FLOW_STEPS,
} from '@/components/PgdDossierFlow';
import type { PcnUserAccount } from '@/types';

const PGD_PRODUCT_GROUP_LABELS: Record<string, string> = {
  STEEL_METAL: 'Thép / kim loại',
  MACHINERY_LINE: 'Máy / dây chuyền',
  COAL: 'Than',
  OTHER: 'Hàng hóa khác',
};

function getPgdUserDisplayName(username: string | undefined, users: PcnUserAccount[]): string {
  const normalized = String(username || '').trim().toLowerCase();
  if (!normalized) return 'Chưa phân công';
  return users.find((user) => user.username.trim().toLowerCase() === normalized)?.name || username || 'Chưa phân công';
}

function PgdPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get('tab') || 'queue';
  const currentUser = usePcnSessionStore((state) => state.currentUser);

  const pgd = usePgdStore();

  const queueRows = useMemo<PgdDossierQueueRow[]>(() => {
    const activeRequests = pgd.requests.filter((request) => !request.deletedAt);
    return activeRequests.map((request) => {
      const requirements = getPgdDossierRequirements(request.productGroup).filter((requirement) => requirement.required);
      const checklist = request.dossierChecklist || [];
      const requiredDocumentPresent = requirements.filter((requirement) =>
        checklist.some((item) => item.requirementCode === requirement.code && (item.status === 'PRESENT' || item.status === 'WAIVED'))
      ).length;
      const currentStepId = getPgdDossierFlowStepIdForStatus(request.status);
      const currentStep = PGD_DOSSIER_FLOW_STEPS.find((step) => step.id === currentStepId) || PGD_DOSSIER_FLOW_STEPS[0];
      const missingRequiredCount = Math.max(0, requirements.length - requiredDocumentPresent);

      return {
        requestId: request.id,
        requestCode: request.requestCode,
        customerName: request.customerSnapshot?.name || '',
        productName: request.productName || '',
        status: request.status,
        statusLabel: getPgdStatusLabel(request.status),
        currentStepNumber: getPgdDossierCurrentStepNumber(request.status),
        currentStepLabel: currentStep.label,
        nextActionLabel: currentStep.label,
        requiredDocumentPresent,
        requiredDocumentTotal: requirements.length,
        missingRequiredCount,
        ownerUsername: request.ownerUsername,
        ownerDisplayName: getPgdUserDisplayName(request.ownerUsername, pgd.users),
        productGroup: PGD_PRODUCT_GROUP_LABELS[request.productGroup] || request.productGroup,
        catalogLabel: getPgdCatalogItemLabel(request.catalogItemId, pgd.catalog),
      };
    });
  }, [pgd.catalog, pgd.requests, pgd.users]);

  const handleOpenDossier = (requestId: string) => {
    router.push(`/pgd/dossiers/${requestId}`);
  };

  if (activeTab === 'operations') {
    return (
      <PgdSummaryRegisterView
        requests={pgd.requests}
        assignments={pgd.assignments}
        samples={pgd.samples}
        labRequests={pgd.labRequests}
        labResults={pgd.labResults}
        reports={pgd.reports}
        certificates={pgd.certificates}
        documents={pgd.documents}
        catalog={pgd.catalog}
        users={pgd.users}
        currentUsername={currentUser?.username}
        canEdit={Boolean(currentUser && currentUser.systemRole !== 'viewer')}
        onOpenRequest={handleOpenDossier}
        onUpdateRequest={pgd.updateRequest}
        onAssignOwner={pgd.assignOwner}
      />
    );
  }

  if (activeTab === 'samples') {
    return (
      <PgdSampleOperationsView
        requests={pgd.requests}
        samples={pgd.samples}
        labRequests={pgd.labRequests}
        labResults={pgd.labResults}
        onOpenRequest={handleOpenDossier}
      />
    );
  }

  return (
    <div className="min-w-0">
      <PgdDossierQueueView
        rows={queueRows}
        onOpenDossier={handleOpenDossier}
      />
    </div>
  );
}

export default function PgdQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
        </div>
      }
    >
      <PgdPageContent />
    </Suspense>
  );
}
