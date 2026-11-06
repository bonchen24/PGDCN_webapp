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
import { getPgdUserCapabilities, type PgdCapabilityAssignment } from '@/utils/pgdDossierCapabilities';
import type { PcnUserAccount } from '@/types';

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
      const users: PcnUserAccount[] = usersResult.rows.map((row: any) => toPcnUserAccount({ documentId: row.document_id, data: row.data || {} }));
      const assignmentIssues = validatePgdAssignment(assignment, users);
      if (assignmentIssues.length > 0) {
        throw Object.assign(new Error(`Phân công PGD chưa hợp lệ: ${assignmentIssues.map((issue) => issue.message).join(' ')}`), { statusCode: 400 });
      }
      if (!['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'RETURNED'].includes(assignment.status)) {
        throw Object.assign(new Error('Trạng thái phân công PGD không hợp lệ.'), { statusCode: 400 });
      }
      const approvalDenial = getPgdAssignmentApprovalDenial(assignment.status, actor);
      if (approvalDenial) throw Object.assign(new Error(approvalDenial), { statusCode: 403 });

      const userByName = new Map(users.map((user) => [user.username.toLowerCase(), user]));
      const assignedAt = new Date().toISOString();
      const roleAssignments: PgdCapabilityAssignment[] = [];
      const addCapability = (username: string | undefined, capability: PgdCapabilityAssignment['capability']) => {
        const normalized = String(username || '').trim();
        const user = userByName.get(normalized.toLowerCase());
        if (normalized && user && getPgdUserCapabilities(user).includes(capability)) {
          roleAssignments.push({ username: user.username, capability });
        }
      };
      const leadInspectorUsername = String(assignment.leadInspectorUsername || assignment.inspectorUsernames[0] || '').trim();
      addCapability(leadInspectorUsername, 'TEAM_LEAD');
      for (const username of assignment.inspectorUsernames) addCapability(username, 'ASSESSOR');
      addCapability(assignment.technicalReviewerUsername, 'TECHNICAL_REVIEW');
      addCapability(assignment.leadershipUsername, 'LEADERSHIP_APPROVAL');
      addCapability(assignment.officeIssuanceUsername, 'OFFICE_ISSUANCE');
      addCapability(assignment.archivistUsername, 'ARCHIVE');
      const persistedAssignment: PgdInspectionAssignment = {
        ...assignment,
        leadInspectorUsername,
        roleAssignments: roleAssignments.map((item) => ({ ...item, assignedByUsername: actor.username, assignedAt })),
        updatedAt: assignedAt,
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.assignments, persistedAssignment.id, JSON.stringify(getDocumentPayload(persistedAssignment))],
      );
      await client.query(
        `UPDATE app_documents SET data = data || jsonb_build_object('assignmentId', $2::text), updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, persistedAssignment.id, assignment.requestId],
      );
      await writePgdActivity(client, actor, {
        action: 'ASSIGNED',
        entityId: persistedAssignment.id,
        entityLabel: request.requestCode,
        requestCode: request.requestCode,
        summary: `Cập nhật phân công hồ sơ PGD cho ${persistedAssignment.leadInspectorUsername || persistedAssignment.inspectorUsernames.join(', ') || 'tổ giám định'}`,
        idSuffix: `assignment-${assignment.requestId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_ASSIGNMENT',
          action: 'ASSIGNED',
          entityId: assignment.id,
          entityLabel: request.requestCode,
          requestCode: request.requestCode,
          actorName: actor.name || actor.username,
          targetUsernames: Array.from(
            new Set(
              [persistedAssignment.leadInspectorUsername, ...persistedAssignment.inspectorUsernames, persistedAssignment.technicalReviewerUsername, persistedAssignment.leadershipUsername, persistedAssignment.officeIssuanceUsername, persistedAssignment.archivistUsername].filter(
                (u): u is string => Boolean(u && u.trim()),
              ),
            ),
          ),
        }),
      });
      return persistedAssignment;
    });

    return jsonOk({ assignment: result });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
