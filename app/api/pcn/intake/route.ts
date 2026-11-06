import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonCreated, jsonError, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { formatPcnIntakeValidationIssues, validatePcnProposalIntake } from '@/utils/pcnIntakePolicy';
import { formatPcnDossierCode, formatPcnProposalCode, getPcnVietnamDateKey } from '@/utils/pcnIdentifier';
import { snapshotPcnWorkflowTemplate } from '@/utils/pcnWorkflowTemplate';
import { matchPcnPublishedWorkflowTemplates, resolveWorkflowTemplateForCreate } from '@/utils/pgdcnIntakeTemplateMatching';
import { validateIntakeClassification } from '@/utils/pgdcnIntakeCatalog';
import { buildPcnDossierChecklist, getPcnDossierRequirementsWithCustom } from '@/utils/pcnDossierDocuments';
import { buildPcnWorkflowTaskSeed } from '@/utils/pcnWorkflowRuntime';
import {
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDossierWorkflowTask,
  PcnWorkflowTemplate,
} from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  const mutationError = requirePcnMutation(actor);
  if (mutationError) return mutationError;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const proposal = body?.proposal;
  const dossier = body?.dossier;
  const workflowTemplateSelection = body?.workflowTemplateSelection as { id?: string; version?: number } | undefined;
  const proposalId = String(proposal?.id || '').trim();
  const dossierId = String(dossier?.id || '').trim();
  if (!proposalId || !dossierId || String(dossier?.proposalId || '').trim() !== proposalId) {
    return jsonError('Đề nghị và hồ sơ phải có định danh hợp lệ và liên kết hai chiều.', 400);
  }
  if (
    !Array.isArray(proposal?.fieldCodes) ||
    proposal.fieldCodes.length === 0 ||
    !Array.isArray(dossier?.fieldCodes) ||
    dossier.fieldCodes.length === 0
  ) {
    return jsonError('Đề nghị phải có ít nhất một Lĩnh vực.', 400);
  }
  if (JSON.stringify([...proposal.fieldCodes].sort()) !== JSON.stringify([...dossier.fieldCodes].sort())) {
    return jsonError('Lĩnh vực của Đề nghị và hồ sơ phải giống nhau.', 400);
  }
  const intakeProposal = proposal;

  try {
    const result = await withPgTransaction(async (client) => {
      const existingProposal = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationProposals'
           AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [proposalId]
      );
      if (existingProposal.rows.length > 0) {
        const storedProposal = mapDocumentRow(existingProposal.rows[0]) as Record<string, any>;
        const linkedDossierId = String(storedProposal.dossierId || '').trim();
        if (linkedDossierId && linkedDossierId !== dossierId) {
          throw Object.assign(new Error('Mã Đề nghị đã liên kết với một hồ sơ khác.'), { statusCode: 409 });
        }
        const existingDossier = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [linkedDossierId || dossierId]
        );
        if (existingDossier.rows.length === 0) {
          throw Object.assign(new Error('Đề nghị đã tồn tại nhưng thiếu hồ sơ liên kết.'), { statusCode: 409 });
        }
        const existingDocuments = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1
           ORDER BY document_id`,
          [String(existingDossier.rows[0].document_id)]
        );
        const existingWorkflowTasks = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnDossierWorkflowTasks' AND data->>'dossierId' = $1
           ORDER BY document_id`,
          [String(existingDossier.rows[0].document_id)]
        );
        return {
          proposal: storedProposal,
          dossier: mapDocumentRow(existingDossier.rows[0]),
          dossierDocuments: existingDocuments.rows.map((row: any) => mapDocumentRow(row)) as PcnDossierDocument[],
          workflowTasks: existingWorkflowTasks.rows.map((row: any) => mapDocumentRow(row)) as PcnDossierWorkflowTask[],
          activityLogs: [],
          idempotent: true as const,
        };
      }

      const intakeValidation = validatePcnProposalIntake(intakeProposal, {
        requireStandards: true,
        requireProductGroup: true,
        requireRegistration: true,
      });
      if (!intakeValidation.valid) {
        throw Object.assign(new Error(formatPcnIntakeValidationIssues(intakeValidation.issues)), {
          statusCode: 400,
          code: 'PCN_INTAKE_VALIDATION_FAILED',
          issues: intakeValidation.issues,
          extra: {
            code: 'PCN_INTAKE_VALIDATION_FAILED',
            issues: intakeValidation.issues,
          },
        });
      }
      const catalogClassification = validateIntakeClassification({
        domain: 'PCN',
        productGroup: String(proposal.productGroup || '') as any,
        standard: Array.isArray(proposal.standards) ? proposal.standards.join(' ') : String(proposal.standards || ''),
        method: String(dossier.method || ''),
        fieldCode: Array.isArray(proposal.fieldCodes) ? String(proposal.fieldCodes[0] || '') : undefined,
      });
      if (!catalogClassification.valid) {
        throw Object.assign(new Error(catalogClassification.message), {
          statusCode: 400,
          code: 'PCN_INTAKE_CATALOG_DOMAIN_MISMATCH',
          extra: {
            code: 'PCN_INTAKE_CATALOG_DOMAIN_MISMATCH',
          },
        });
      }

      const now = new Date().toISOString();
      const proposalReceivedAt = String(intakeProposal.receivedAt || now).trim();
      const proposalDateKey = getPcnVietnamDateKey(proposalReceivedAt);
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `pcn-proposal-sequence:${proposalDateKey}`,
      ]);
      const proposalSerialResult = await client.query(
        `SELECT COALESCE(MAX(CAST(substring(data->>'proposalCode' FROM '^PCN-[0-9]{6}-([0-9]{2})$') AS INTEGER)), 0) AS last_serial
           FROM app_documents
          WHERE collection_name = $1
            AND data->>'proposalCode' ~ $2`,
        ['certificationProposals', `^PCN-${proposalDateKey}-[0-9]{2}$`]
      );
      const nextProposalSerial = Number(proposalSerialResult.rows[0]?.last_serial || 0) + 1;
      if (nextProposalSerial > 99) {
        throw Object.assign(
          new Error(`Đã hết dãy mã Đề nghị PCN cho ngày ${proposalDateKey}.`),
          { statusCode: 409 }
        );
      }
      const proposalCode = formatPcnProposalCode(nextProposalSerial, proposalReceivedAt);
      const dossierCode = formatPcnDossierCode(proposalCode, proposalReceivedAt);

      const workflowTemplateResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnWorkflowTemplates'
           AND data->>'status' = 'PUBLISHED'`
      );
      const workflowTemplates = workflowTemplateResult.rows.map(
        (row: any) => mapDocumentRow(row) as PcnWorkflowTemplate
      );
      const workflowCandidates = catalogClassification.confirmationStatus === 'CONFIRMED'
        ? matchPcnPublishedWorkflowTemplates(workflowTemplates, {
        fieldCodes: Array.from(
          new Set(proposal.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean))
        ),
        method: dossier.method,
        dossierType: String(dossier.dossierType || '').trim() || undefined,
      })
        : [];
      const workflowResolution = resolveWorkflowTemplateForCreate(workflowCandidates, workflowTemplateSelection);
      if (workflowResolution.status === 'invalid-selection') {
        throw Object.assign(new Error('Bộ hồ sơ mẫu đã chọn không còn được publish hoặc không còn phù hợp với thông tin Đề nghị.'), { statusCode: 409 });
      }
      if (workflowResolution.status === 'ambiguous') {
        throw Object.assign(new Error('Có nhiều bộ hồ sơ mẫu phù hợp. Vui lòng chọn một mẫu trước khi tạo Đề nghị.'), { statusCode: 409 });
      }
      const workflowTemplate = workflowResolution.status === 'resolved' ? workflowResolution.template : undefined;
      const sessionUser = actor;
      const workflowSnapshot = workflowTemplate ? snapshotPcnWorkflowTemplate(workflowTemplate, {
        capturedAt: now,
        capturedBy: sessionUser?.username || 'SYSTEM',
      }) : undefined;
      if (workflowSnapshot) {
        const dossierFieldSet = new Set(
          proposal.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean)
        );
        workflowSnapshot.nodes = workflowSnapshot.nodes.map((node) => ({
          ...node,
          requirementIds: node.requirementIds.filter((requirementId) => {
            const prefix = String(requirementId).split('-')[0].toUpperCase();
            return !['QC4', 'QC9'].includes(prefix) || dossierFieldSet.has(prefix);
          }),
        }));
      }

      const storedProposal = {
        ...intakeProposal,
        id: proposalId,
        proposalCode,
        status: 'CONVERTED',
        dossierId,
        fieldCodes: Array.from(
          new Set(proposal.fieldCodes.map((code: unknown) => String(code).trim().toUpperCase()).filter(Boolean))
        ),
        catalogConfirmationStatus: catalogClassification.confirmationStatus,
        ...(catalogClassification.matchedItem?.id ? { catalogItemId: catalogClassification.matchedItem.id } : {}),
        receivedAt: proposalReceivedAt,
        createdAt: proposal.createdAt || now,
        updatedAt: now,
      };
      const storedDossier = {
        ...dossier,
        id: dossierId,
        dossierCode,
        proposalId,
        status: 'INTAKE_REVIEW',
        fieldCodes: storedProposal.fieldCodes,
        workflowSchemaVersion: 2 as const,
        ...(workflowTemplate && workflowSnapshot ? {
          workflowTemplateId: workflowTemplate.id,
          workflowTemplateVersion: workflowTemplate.version,
          workflowSnapshot,
        } : { workflowTemplatePending: true }),
        labRequestIds: Array.isArray(dossier.labRequestIds) ? dossier.labRequestIds : [],
        returnedResultIds: Array.isArray(dossier.returnedResultIds) ? dossier.returnedResultIds : [],
        createdAt: dossier.createdAt || now,
        updatedAt: now,
      };

      const proposalWrite = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('certificationProposals', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [proposalId, JSON.stringify(getDocumentPayload(storedProposal))]
      );
      if (proposalWrite.rows.length === 0) {
        throw Object.assign(new Error('Đề nghị vừa được tạo bởi một thao tác khác; vui lòng tải lại.'), { statusCode: 409 });
      }

      const dossierWrite = await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('certificationDossiers', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING
         RETURNING document_id, data`,
        [dossierId, JSON.stringify(getDocumentPayload(storedDossier))]
      );
      if (dossierWrite.rows.length === 0) {
        throw Object.assign(new Error('Mã hồ sơ vừa được tạo bởi một thao tác khác; vui lòng tải lại.'), { statusCode: 409 });
      }

      const requirementResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnDocumentRequirements'
           AND COALESCE(data->>'active', 'true') = 'true'
         ORDER BY COALESCE((data->>'sortOrder')::int, 999), document_id`
      );
      const requirements = requirementResult.rows.map(
        (row: any) => mapDocumentRow(row) as PcnDocumentRequirement
      );
      const dossierRequirements = getPcnDossierRequirementsWithCustom(storedDossier, requirements);
      const dossierDocuments = buildPcnDossierChecklist(dossierId, storedDossier.fieldCodes, dossierRequirements, now);
      for (const document of dossierDocuments) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('dossierDocuments', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [document.id, JSON.stringify(getDocumentPayload(document))]
        );
      }

      const workflowTasks = workflowSnapshot ? buildPcnWorkflowTaskSeed(
        workflowSnapshot,
        dossierId,
        sessionUser?.username || 'SYSTEM',
        now
      ) : [];
      for (const task of workflowTasks) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('pcnDossierWorkflowTasks', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [task.id, JSON.stringify(getDocumentPayload(task))]
        );
      }

      const logs = [
        buildActivityLog({
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          action: 'CREATED',
          entityType: 'PCN_PROPOSAL',
          entityId: proposalId,
          entityLabel: proposalCode,
          summary: 'Tiếp nhận Đề nghị và tạo bộ hồ sơ chứng nhận',
          source: 'UI',
          createdAt: now,
        }),
        buildActivityLog({
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          action: 'CREATED',
          entityType: 'PCN_DOSSIER',
          entityId: dossierId,
          entityLabel: String(storedDossier.dossierCode || dossierId),
          summary: 'Tạo bộ hồ sơ chứng nhận đồng thời với Đề nghị',
          source: 'UI',
          createdAt: now,
        }),
      ];
      for (const log of logs) {
        const validationError = validateActivityLogPayload(log);
        if (validationError) throw new Error(validationError);
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [log.id, JSON.stringify(getDocumentPayload(log))]
        );
      }

      return {
        proposal: mapDocumentRow(proposalWrite.rows[0]),
        dossier: mapDocumentRow(dossierWrite.rows[0]),
        dossierDocuments,
        workflowTasks,
        activityLogs: logs,
        idempotent: false as const,
      };
    });
    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN intake error:', error);
    const status = Number(error?.statusCode) || 500;
    const extra = error?.extra || (error?.code ? { code: error.code, ...(error.issues ? { issues: error.issues } : {}) } : undefined);
    return jsonError(error?.message || String(error), status, extra);
  }
}
