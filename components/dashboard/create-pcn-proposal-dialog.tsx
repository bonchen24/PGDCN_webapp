'use client';

import { useRouter } from 'next/navigation';
import { usePcnStore } from '@/store-pcn';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { PcnProposalView } from '@/components/PcnWorkspace';

type CreatePcnProposalDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreatePcnProposalDialog({ open, onOpenChange }: CreatePcnProposalDialogProps) {
  const router = useRouter();
  const pcn = usePcnStore();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const canEdit = Boolean(currentUser && currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer');

  return <PcnProposalView
    fields={pcn.fields}
    proposals={pcn.proposals}
    dossiers={pcn.dossiers}
    documentRequirements={pcn.documentRequirements}
    workflowTemplates={pcn.workflowTemplates}
    dossierDocuments={pcn.dossierDocuments}
    dataLoaded={pcn.isLoaded}
    sampleLots={pcn.sampleLots}
    sampleItems={pcn.sampleItems}
    sampleRoutes={pcn.sampleRoutes}
    customers={pcn.customers}
    canEdit={canEdit}
    createOnly
    openFormRequest={open ? 1 : 0}
    onDismiss={() => onOpenChange(false)}
    onCreated={(dossierId) => {
      onOpenChange(false);
      router.push(`/pgdcn/pcn/dossiers/${encodeURIComponent(dossierId)}`);
    }}
    onAttachmentsUploaded={() => pcn.load(true)}
    onSave={(proposal, selection, context) => pcn.addProposal(proposal, selection, context)}
    onAttachWorkflowTemplate={async (dossierId, selection) => {
      const response = await fetch(`/api/pcn/dossiers/${encodeURIComponent(dossierId)}/workflow-template`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(selection),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || payload?.message || 'Không thể gắn bộ hồ sơ mẫu PCN.');
      await pcn.load(true);
    }}
    onUpdateProposal={(proposalId, updates) => pcn.updateProposal(proposalId, updates)}
    onOpenDossier={(dossier) => router.push(`/pgdcn/pcn/dossiers/${encodeURIComponent(dossier.id)}`)}
  />;
}
