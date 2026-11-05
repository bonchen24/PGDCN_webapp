'use client';

import React, { use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle, ArrowLeft } from 'lucide-react';

import { usePcnStore } from '@/store-pcn';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import PcnDossierDetailView from '@/components/PcnDossierDetailView';
import { downloadPcnDossierPackage } from '@/utils/pcnDossierPackageApi';
import type { PcnDossierDetailTab } from '@/utils/pcnDossierNavigation';
import { Button } from '@/components/ui/button';

const DETAIL_TABS = new Set<PcnDossierDetailTab>(['overview', 'documents', 'lab', 'results', 'issuance']);

export default function PcnDossierWorkspacePage({
  params,
}: {
  params: Promise<{ dossierId: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const dossierId = decodeURIComponent(resolvedParams.dossierId);
  const rawTab = searchParams.get('tab')?.trim();
  const initialTab = rawTab && DETAIL_TABS.has(rawTab as PcnDossierDetailTab) ? (rawTab as PcnDossierDetailTab) : undefined;
  const initialNodeId = searchParams.get('node')?.trim() || undefined;

  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();

  const dossier = pcn.dossiers.find((d) => d.id === dossierId);
  const proposal = dossier ? pcn.proposals.find((p) => p.id === dossier.proposalId) : undefined;

  if (!currentUser) return null;

  if (!dossier) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600 mb-3 border border-amber-200">
          <AlertTriangle size={24} />
        </div>
        <h2 className="text-base font-bold text-slate-900">Không tìm thấy hồ sơ PCN</h2>
        <p className="mt-1 text-xs text-slate-500 max-w-sm">
          Mã hồ sơ <span className="font-mono font-semibold">{dossierId}</span> không tồn tại hoặc bạn chưa có quyền truy cập.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4 gap-1.5 text-xs font-semibold"
          onClick={() => router.push('/pcn')}
        >
          <ArrowLeft size={14} /> Quay lại Hàng đợi hồ sơ
        </Button>
      </div>
    );
  }

  const canEditMilestones = Boolean(
    currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer'
  );

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <PcnDossierDetailView
        dossier={dossier}
        proposal={proposal}
        fields={pcn.fields}
        templates={pcn.templates}
        labRequests={pcn.labRequests}
        results={pcn.returnedResults}
        approvalSteps={pcn.approvalSteps}
        issuancePackages={pcn.issuancePackages}
        activityLogs={pcn.activityLogs}
        documentRequirements={pcn.documentRequirements}
        dossierDocuments={pcn.dossierDocuments}
        dossierAttachments={pcn.dossierAttachments}
        generatedDocuments={pcn.generatedDocuments}
        officialDocuments={pcn.officialDocuments}
        signerDelegations={pcn.signerDelegations}
        sampleLots={pcn.sampleLots}
        sampleItems={pcn.sampleItems}
        sampleRoutes={pcn.sampleRoutes}
        users={pcn.users}
        currentUser={currentUser}
        standalone={true}
        initialTab={initialTab}
        initialNodeId={initialNodeId}
        workflowTasks={pcn.workflowTasks}
        onStartWorkflowTask={(taskId) => pcn.startWorkflowTask(dossier.id, taskId)}
        onCompleteWorkflowTask={(taskId) => pcn.completeWorkflowTask(dossier.id, taskId)}
        onReturnWorkflowTask={(taskId, input) => pcn.returnWorkflowTask(dossier.id, taskId, input)}
        onUploadDocument={(requirementId, file) => pcn.uploadDossierDocument(dossier.id, requirementId, file)}
        onRemoveCurrentDocument={(requirementId) => pcn.removeCurrentDossierDocument(dossier.id, requirementId)}
        onWaiveDocument={(requirementId, reason) => pcn.waiveDossierDocument(dossier.id, requirementId, reason)}
        onUpdateStatus={(status, exceptionReason) =>
          pcn.updateDossier(dossier.id, {
            status,
            ...(exceptionReason !== undefined ? { exceptionReason } : {}),
          })
        }
        onUpdateDossier={(updates) => pcn.updateDossier(dossier.id, updates)}
        onDeleteDossier={(reason, confirmationCode) =>
          pcn.deleteDossier(dossier.id, reason, confirmationCode)
        }
        canEditMilestones={canEditMilestones}
        onPreflight={(kind, sampleRouteId, labRequestId) =>
          pcn.preflightDossierDocuments(dossier.id, kind, sampleRouteId, labRequestId)
        }
        onGenerateDocuments={(kind, formats, sampleRouteId, expectedContextHash, labRequestId) =>
          pcn.generateDossierDocuments(
            dossier.id,
            kind,
            formats,
            sampleRouteId,
            expectedContextHash,
            labRequestId
          )
        }
        onConfirmGenerated={(generated, requirement) =>
          pcn.confirmGeneratedDocument(dossier.id, generated, requirement)
        }
        onDownloadPackage={() => downloadPcnDossierPackage(dossier.id, dossier.dossierCode)}
        onClose={() => router.push('/pcn')}
        onCreateSampleLot={pcn.addSampleLot}
        onUpdateSampleRoute={pcn.updateSampleRoute}
        onSaveLabRequest={pcn.addLabRequest}
        onUpdateLabRequest={pcn.updateLabRequest}
        onDispatchLabRequest={pcn.dispatchLabRequest}
        onReconcileLabRequest={pcn.reconcileLabRequest}
        onSaveHandover={(request, details) =>
          pcn.updateLabRequest(request.id, request.status, { handoverDetails: details })
        }
        onSaveResult={pcn.addReturnedResult}
        onAttachResultFile={pcn.attachResultFile}
        onPrepareIssuance={async () => {
          await pcn.createIssuanceBundle(dossier.id);
        }}
        onApproveStep={(stepId, decision, comment) =>
          pcn.actOnApprovalStep(stepId, decision, comment)
        }
        onIssue={pcn.issuePackage}
        onDeliver={pcn.deliverPackage}
        onArchive={pcn.archivePackage}
        onWithdraw={pcn.withdrawPackage}
        onAttachIssuanceFile={pcn.attachIssuanceFile}
        onPreflightOfficialDocuments={pcn.preflightOfficialDocuments}
        onGenerateOfficialDocuments={pcn.generateOfficialDocuments}
        onCreateSignerDelegation={pcn.addSignerDelegation}
        onRevokeSignerDelegation={pcn.revokeSignerDelegation}
      />
    </div>
  );
}
