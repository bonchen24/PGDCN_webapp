'use client';

import React from 'react';
import PgdcnDossierTemplateManagementView from '@/components/PgdcnDossierTemplateManagementView';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';
import { getPgdDossierRequirements } from '@/utils/pgdDossier';

const PGD_TEMPLATE_REQUIREMENTS = Array.from(
  new Map(
    (['OTHER', 'STEEL_METAL', 'MACHINERY_LINE', 'COAL'] as const)
      .flatMap((productGroup) => getPgdDossierRequirements(productGroup))
      .map((item) => [item.code, item])
  ).values()
);

export default function TemplatesCatalogPage() {
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();

  if (!currentUser) return null;

  return (
    <div className="min-w-0">
      <PgdcnDossierTemplateManagementView
        currentUser={currentUser}
        pcnTemplates={pcn.workflowTemplates}
        pcnRequirements={pcn.documentRequirements}
        pcnDocxTemplates={pcn.templates}
        pgdTemplates={pgd.workflowTemplates}
        pgdRequirements={PGD_TEMPLATE_REQUIREMENTS}
        pgdDocxTemplates={pgd.documentTemplates}
        onCreatePcnWorkflowTemplate={pcn.createWorkflowTemplate}
        onUpdatePcnWorkflowTemplate={pcn.updateWorkflowTemplate}
        onCreatePcnWorkflowRevision={pcn.createWorkflowRevision}
        onPublishPcnWorkflowTemplate={pcn.publishWorkflowTemplate}
        onRetirePcnWorkflowTemplate={pcn.retireWorkflowTemplate}
        onCreatePgdWorkflowTemplate={pgd.createWorkflowTemplate}
        onUpdatePgdWorkflowTemplate={pgd.updateWorkflowTemplate}
        onCreatePgdWorkflowRevision={pgd.createWorkflowRevision}
        onPublishPgdWorkflowTemplate={pgd.publishWorkflowTemplate}
        onRetirePgdWorkflowTemplate={pgd.retireWorkflowTemplate}
      />
    </div>
  );
}
