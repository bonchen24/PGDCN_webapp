import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonForbidden, jsonNotFound, jsonOk, jsonServerError } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdInspectionAssignment,
  PgdInspectionRequest,
  validatePgdAssignment,
} from '@/utils/pgdDomain';
import { getPgdAssignmentApprovalDenial } from '@/utils/pgdWorkflow';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { toPcnUserAccount } from '@/utils/pcnAuth';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.assignments, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const assignment = (await req.json().catch(() => ({}))) as PgdInspectionAssignment;
  if (!assignment?.id || assignment.domain !== 'pgd' || !assignment.requestId || !Array.isArray(assignment.inspectorUsernames)) {
    return jsonBadRequest('Phân công PGD thiếu id, miền hoặc mã hồ sơ.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, assignment.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của phân công.'), { statusCode: 404 });
      const request = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(request);
      assertPgdRequestStationMutationAllowed(request, request.status === 'CAPABILITY_REVIEW' ? 'INTAKE_CAPABILITY' : 'PREPARATION');

      const usersResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'systemUsers' ORDER BY document_id`);
      const users = usersResult.rows.map((row: any) => toPcnUserAccount({ documentId: row.document_id, data: row.data || {} }));
      const assignmentIssues = validatePgdAssignment(assignment, users);
      if (assignmentIssues.length > 0) {
        throw Object.assign(new Error(`Phân công PGD chưa hợp lệ: ${assignmentIssues.map((issue) => issue.message).join(' ')}`), { statusCode: 400 });
      }
      if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RETURNED'].includes(assignment.status)) {
        throw Object.assign(new Error('Trạng thái phân công PGD không hợp lệ.'), { statusCode: 400 });
      }
      const approvalDenial = getPgdAssignmentApprovalDenial(assignment.status, actor);
      if (approvalDenial) throw Object.assign(new Error(approvalDenial), { statusCode: 403 });

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.assignments, assignment.id, JSON.stringify(getDocumentPayload(assignment))],
      );
      await client.query(
        `UPDATE app_documents SET data = data || jsonb_build_object('assignmentId', $2::text), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, assignment.id, assignment.requestId],
      );
      await writePgdActivity(client, actor, {
        action: 'ASSIGNED',
        entityId: assignment.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Phân công hồ sơ PGD cho ${assignment.leadInspectorUsername || assignment.inspectorUsernames.join(', ') || 'tổ giám định'}`,
        idSuffix: `assignment-${assignment.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_ASSIGNMENT',
          action: 'ASSIGNED',
          entityId: assignment.id,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          actorName: actor.name || actor.username,
          targetUsernames: Array.from(
            new Set(
              [assignment.leadInspectorUsername, ...assignment.inspectorUsernames, assignment.technicalReviewerUsername].filter(
                (u): u is string => Boolean(u && u.trim()),
              ),
            ),
          ),
        }),
      });
      return assignment;
    });

    return jsonOk({ assignment: result });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
