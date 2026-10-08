import { createHash } from 'crypto';
import { pool, withPgTransaction } from '@/lib/server/db';
import {
  CertificationDossier,
  CertificationProposal,
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierWorkflowTask,
  PcnUserAccount,
  PcnWorkflowTemplate,
  IssuancePackage,
  ReturnedTestResult,
} from '@/types';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { isPcnSystemManager, isOrganizationLeader, getPcnDossierDeletionDenial } from '@/utils/pcnRbac';
import { getPcnDossierStageGateDenial } from '@/utils/pcnDossierStageGate';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { formatPcnIntakeValidationIssues, validatePcnProposalIntake } from '@/utils/pcnIntakePolicy';
import { formatPcnDossierCode, formatPcnProposalCode, getPcnVietnamDateKey } from '@/utils/pcnIdentifier';
import { selectPcnPublishedWorkflowTemplate, snapshotPcnWorkflowTemplate } from '@/utils/pcnWorkflowTemplate';
import { buildPcnDossierChecklist, getPcnDocumentRequirements } from '@/utils/pcnDossierDocuments';
import { buildPcnWorkflowTaskSeed } from '@/utils/pcnWorkflowRuntime';
import { getPcnDossierOperatorDenial, getPcnOwnerAssignmentAuthorityDenial, getPcnDossierAssignmentDenial } from '@/utils/pcnDossierAssignment';
import { getPcnDossierDateDenial } from '@/utils/pcnDossierDate';
import { getPcnOperationalFormKind, normalizePcnOperationalFormsPatch } from '@/utils/pcnOperationalForms';
import { mergePcnDocumentWaivers, normalizePcnDocumentWaiverPatch } from '@/utils/pcnDocumentWaivers';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canProcessPcnOperationalForm } from '@/utils/pcnWorkflowStages';
import {
  getPcnDossierExceptionReasonDenial,
  getPcnDossierMethodChangeDenial,
  getPcnDossierStatusMutationDenial,
  isPcnDossierTransitionAllowed,
} from '@/utils/pcnWorkflow';
import { getPcnEffectiveApprovalSteps } from '@/utils/pcnApproval';
import { buildPcnRetentionMetadata, updatePcnLegalHold } from '@/utils/pcnRetention';
import { toPcnUserAccount } from '@/utils/pcnAuth';

export function assertPcnDossierOperator(
  dossier: Pick<CertificationDossier, 'ownerUsername'>,
  actor: PcnUserAccount
): void {
  const denial = getPcnDossierOperatorDenial({
    ownerUsername: dossier.ownerUsername,
    actorUsername: actor.username,
    actorIsSystemManager: isPcnSystemManager(actor),
  });
  if (denial) throw Object.assign(new Error(denial), { statusCode: 403 });
}

export async function hardDeleteOwnedDocumentGraph(
  client: any,
  input: { parentCollection: string; parentId: string; relationField: 'dossierId' | 'requestId' }
): Promise<any[]> {
  const relatedRows = new Map<string, any>();
  let relationIds = [input.parentId];
  for (let depth = 0; depth < 8 && relationIds.length > 0; depth += 1) {
    const result = await client.query(
      `SELECT collection_name, document_id, data
         FROM app_documents
        WHERE (collection_name = $1 AND document_id = $2)
           OR data->>'dossierId' = ANY($3::text[])
           OR data->>'requestId' = ANY($3::text[])
           OR data->>'proposalId' = ANY($3::text[])
           OR data->>'sampleLotId' = ANY($3::text[])
           OR data->>'routeId' = ANY($3::text[])
           OR data->>'sampleRouteId' = ANY($3::text[])
           OR data->>'labRequestId' = ANY($3::text[])
        FOR UPDATE`,
      [input.parentCollection, input.parentId, relationIds]
    );
    const discoveredIds: string[] = [];
    for (const row of result.rows) {
      const key = `${row.collection_name}:${row.document_id}`;
      if (!relatedRows.has(key)) {
        relatedRows.set(key, row);
        discoveredIds.push(row.document_id);
      }
    }
    relationIds = discoveredIds;
  }

  const documentIds = Array.from(relatedRows.values()).map((r) => r.document_id);
  const assetResult = await client.query(
    `SELECT id, bucket_name, object_path
       FROM file_assets
      WHERE source_document_id = ANY($1::text[])
      FOR UPDATE`,
    [documentIds]
  );
  const assets = assetResult.rows;

  if (assets.length > 0) {
    await client.query(`DELETE FROM file_assets WHERE id = ANY($1::text[])`, [assets.map((a: any) => a.id)]);
  }

  for (const row of relatedRows.values()) {
    await client.query(
      `DELETE FROM app_documents WHERE collection_name = $1 AND document_id = $2`,
      [row.collection_name, row.document_id]
    );
  }

  return assets;
}

export async function assertPcnTechnicalReviewSubmissionReady(client: any, dossier: CertificationDossier): Promise<void> {
  const requirementResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'pcnDocumentRequirements'`,
  );
  const configuredRequirements = requirementResult.rows.map((row: any) => mapDocumentRow(row) as PcnDocumentRequirement);
  const documentResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`,
    [dossier.id],
  );
  const returnedResultResult = await client.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'returnedResults' AND data->>'dossierId' = $1`,
    [dossier.id],
  );
  const hasConfirmedReturnedScan = returnedResultResult.rows.some((row: any) => {
    const result = mapDocumentRow(row) as ReturnedTestResult;
    return Boolean(result.fileAssetId && result.outcome !== 'PENDING' && result.isOfficial !== false);
  });
  const resolvedRequirementIds = hasConfirmedReturnedScan
    ? getPcnDocumentRequirements(dossier.fieldCodes, configuredRequirements.length > 0 ? configuredRequirements : undefined)
      .filter((requirement) => requirement.code === 'TEST_REPORT')
      .map((requirement) => requirement.id)
    : [];
  const stageGateDenial = getPcnDossierStageGateDenial({
    dossier,
    nextStatus: 'WAITING_APPROVAL',
    requirements: configuredRequirements.length > 0 ? configuredRequirements : undefined,
    documents: documentResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument),
    documentWaivers: dossier.documentWaivers,
    resolvedRequirementIds,
  });
  if (stageGateDenial) throw Object.assign(new Error(stageGateDenial), { statusCode: 409 });
  const finalRequirements = getPcnDocumentRequirements(dossier.fieldCodes, configuredRequirements.length > 0 ? configuredRequirements : undefined)
    .filter((requirement) => requirement.required && ['CERTIFICATE', 'DECISION'].includes(requirement.code));
  const currentDocuments = documentResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument);
  const missingDraft = finalRequirements.find((requirement) => {
    const document = currentDocuments.find((item) => item.requirementId === requirement.id);
    return !(document?.status === 'PRESENT' && document.currentVersionId && document.versions.some((version) => version.assetId === document.currentVersionId));
  });
  if (missingDraft) throw Object.assign(new Error(`Phải có bản dự thảo ${missingDraft.code === 'CERTIFICATE' ? 'GCN' : 'QĐ'} trước khi trình bước 5.`), { statusCode: 409 });
}
