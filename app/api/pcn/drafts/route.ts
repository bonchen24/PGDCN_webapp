import { NextRequest } from 'next/server';
import { randomUUID } from 'crypto';
import { pool, withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation, requirePcnSession } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import {
  CertificationDossier,
  CertificationProposal,
  PcnDraftFormKind,
  PcnDraftWorkspace,
  PCN_CERTIFICATION_FIELD_CODES,
} from '@/types';
import { validatePcnDraftSourceSelection } from '@/utils/pcnDraftSourcePolicy';
import { jsonBadRequest, jsonCreated, jsonNotFound, jsonOk, jsonServerError } from '@/lib/server/response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const profile = (process.env.DATABASE_PROFILE || 'pcn').trim();
  if (profile !== 'pcn') {
    return jsonNotFound('Soạn thảo PCN chỉ khả dụng trong profile PCN.');
  }

  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  try {
    const result = await pool.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnDraftWorkspaces'
       ORDER BY updated_at DESC, document_id ASC`,
    );
    return jsonOk({ items: result.rows.map(mapDocumentRow) });
  } catch (error: any) {
    console.error('PCN drafting read error:', error);
    return jsonServerError(error?.message || String(error));
  }
}

export async function POST(req: NextRequest) {
  const profile = (process.env.DATABASE_PROFILE || 'pcn').trim();
  if (profile !== 'pcn') {
    return jsonNotFound('Soạn thảo PCN chỉ khả dụng trong profile PCN.');
  }

  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const actor = getPcnSessionUser(req)!;
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const formKinds = new Set<PcnDraftFormKind>([
    'PROPOSAL_FORM',
    'DOSSIER_COVER',
    'ASSIGNMENT_FORM',
    'EVALUATION_PLAN',
    'FIELD_INSPECTION',
    'SAMPLE_TAKING',
    'SAMPLE_CODING',
    'SAMPLE_HANDOVER',
    'LAB_REQUEST',
    'EVALUATION_REPORT',
    'CERTIFICATION_RESULT',
    'COMMERCIAL',
    'CLIENT_PACKAGE',
  ]);

  const formKind = String(body?.formKind || '').trim().toUpperCase() as PcnDraftFormKind;
  const title = String(body?.title || '').trim();
  const templateId = String(body?.templateId || '').trim();
  const draftId = String(body?.id || '').trim() || `pcn-draft-${randomUUID()}`;
  const sourceProposalId = String(body?.sourceProposalId || '').trim();
  const sourceDossierId = String(body?.sourceDossierId || '').trim();
  const fieldCodes: string[] = Array.isArray(body?.fieldCodes)
    ? [...new Set(body.fieldCodes.map((item: unknown) => String(item).trim().toUpperCase()).filter(Boolean))] as string[]
    : [];
  const values = body?.values && typeof body.values === 'object' && !Array.isArray(body.values)
    ? Object.fromEntries(
        Object.entries(body.values).slice(0, 120).map(([key, value]) => [
          String(key).slice(0, 120),
          Array.isArray(value) ? value.slice(0, 50).map((item) => String(item).slice(0, 500)) : String(value ?? '').slice(0, 5000),
        ])
      )
    : {};

  if (
    !formKinds.has(formKind) ||
    !title ||
    title.length > 240 ||
    !templateId ||
    templateId.length > 200 ||
    draftId.length > 240 ||
    /[\\/]/.test(draftId) ||
    fieldCodes.some((code) => !PCN_CERTIFICATION_FIELD_CODES.includes(code as any))
  ) {
    return jsonBadRequest('Thông tin bản soạn thảo PCN không hợp lệ.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDraftWorkspaces' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [draftId],
      );
      const existing = existingResult.rows[0] ? (mapDocumentRow(existingResult.rows[0]) as PcnDraftWorkspace) : undefined;

      let sourceProposal: CertificationProposal | undefined;
      let sourceDossier: CertificationDossier | undefined;
      if (sourceDossierId) {
        const sourceDossierResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
          [sourceDossierId],
        );
        sourceDossier = sourceDossierResult.rows[0] ? (mapDocumentRow(sourceDossierResult.rows[0]) as CertificationDossier) : undefined;
      }
      const linkedProposalId = sourceProposalId || sourceDossier?.proposalId || '';
      if (linkedProposalId) {
        const sourceProposalResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationProposals' AND document_id = $1 LIMIT 1`,
          [linkedProposalId],
        );
        sourceProposal = sourceProposalResult.rows[0] ? (mapDocumentRow(sourceProposalResult.rows[0]) as CertificationProposal) : undefined;
      }

      validatePcnDraftSourceSelection({ sourceProposalId, sourceDossierId, proposal: sourceProposal, dossier: sourceDossier });

      const canonicalFieldCodes = sourceDossier?.fieldCodes?.length
        ? [...new Set(sourceDossier.fieldCodes.map((code) => String(code).trim().toUpperCase()))]
        : sourceProposal?.fieldCodes?.length
          ? [...new Set(sourceProposal.fieldCodes.map((code) => String(code).trim().toUpperCase()))]
          : fieldCodes;

      const now = new Date().toISOString();
      const draft: PcnDraftWorkspace = {
        id: draftId,
        title,
        formKind,
        templateId,
        ...(sourceProposalId ? { sourceProposalId } : {}),
        ...(sourceDossierId ? { sourceDossierId } : {}),
        fieldCodes: canonicalFieldCodes,
        values,
        status: 'DRAFT',
        outputAssetIds: [],
        outputs: [],
        createdByUsername: existing?.createdByUsername || actor.username,
        updatedByUsername: actor.username,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnDraftWorkspaces', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [draft.id, JSON.stringify(getDocumentPayload(draft))],
      );

      const activityLog = buildActivityLog({
        action: existing ? 'UPDATED' : 'CREATED',
        entityType: 'PCN_DRAFT',
        entityId: draft.id,
        entityLabel: draft.title,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: (actor.systemRole || actor.role) as any,
        summary: existing ? 'Cập nhật bản soạn thảo PCN' : 'Tạo bản soạn thảo PCN',
        source: 'UI',
        createdAt: now,
        groupId: draft.id,
      });

      const validationError = validateActivityLogPayload(activityLog);
      if (validationError) throw new Error(validationError);

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))],
      );

      return { draft, activityLog };
    });

    return jsonCreated(result);
  } catch (error: any) {
    console.error('PCN drafting save error:', error);
    return jsonBadRequest(error?.message || String(error));
  }
}
