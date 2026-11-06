import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import { diffActivityFields } from '@/utils/activityLog';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';
import {
  getPgdStatusLabel,
  PGD_COLLECTIONS,
  PgdAssessmentRound,
  PgdInspectionRequest,
  PgdInspectionStatus,
} from '@/utils/pgdDomain';
import { getPgdAssignmentApprovalDenial, getPgdOperationalStepGateDenial } from '@/utils/pgdWorkflow';
import { hasPgdDossierCapability } from '@/utils/pgdDossierCapabilities';
import { createPgdAssessmentRound } from '@/utils/pgdAssessmentRounds';
import { readPgdTransitionContext, writePgdActivity } from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.requests, 'write');
  if (mutationError) return mutationError;

  const { requestId: rawRequestId } = await params;
  const requestId = String(rawRequestId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const nextStatus = String(body?.status || '').trim().toUpperCase() as PgdInspectionStatus;
  const exceptionReason = String(body?.reason || '').trim();

  if (!requestId || !nextStatus) {
    return jsonBadRequest('Thiếu mã hồ sơ hoặc trạng thái PGD tiếp theo.');
  }

  if (['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(nextStatus) && (!exceptionReason || exceptionReason.length > 1000)) {
    return jsonBadRequest('Nhánh trả bổ sung/tạm dừng/hủy hồ sơ PGD bắt buộc có lý do tối đa 1000 ký tự.');
  }

  try {
    const actor = getPgdSessionUser(req)!;
    const result = await withPgTransaction(async (client) => {
      const currentResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, requestId],
      );
      if (!currentResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });
      const current = mapDocumentRow(currentResult.rows[0]) as PgdInspectionRequest;
      if (current.domain !== 'pgd') throw Object.assign(new Error('Hồ sơ không thuộc miền PGD.'), { statusCode: 409 });

      const isV2 = current.workflowSchemaVersion === 2 || current.workflowSnapshot?.workflowSchemaVersion === 2;

      if (isV2 && ['SIGNED', 'RESULT_RETURNED', 'ARCHIVED'].includes(nextStatus)) {
        throw Object.assign(new Error('Các trạng thái phát hành, trả kết quả và lưu trữ do luồng phát hành chuyên biệt xử lý.'), { statusCode: 409 });
      }

      if (isV2 && current.status === 'TECHNICAL_REVIEW' && nextStatus === 'LEADERSHIP_APPROVAL') {
        throw Object.assign(new Error('Thẩm xét chuyên môn phải thực hiện qua luồng phê duyệt để lưu snapshot hồ sơ.'), { statusCode: 409 });
      }

      if (isV2 && ['REJECTED', 'ON_HOLD'].includes(nextStatus) && current.status !== 'CAPABILITY_REVIEW') {
        throw Object.assign(new Error('Quyết định trả bổ sung hoặc tạm dừng chỉ áp dụng tại bước xem xét năng lực (B2).'), { statusCode: 409 });
      }

      if (isV2) {
        const isManager = !getPgdAssignmentApprovalDenial('APPROVED', actor);

        if (current.status === 'CAPABILITY_REVIEW') {
          if (!isManager) {
            throw Object.assign(new Error('Chỉ Quản lý hoặc Lãnh đạo có thẩm quyền mới được đánh giá năng lực hồ sơ PGD.'), { statusCode: 403 });
          }
        }

        let assignment: any;
        const needsAssignmentCheck =
          (current.status === 'PREPARING' && nextStatus === 'FIELD_INSPECTION') ||
          (['FIELD_INSPECTION', 'WAITING_LAB_RESULTS'].includes(current.status) && ['WAITING_LAB_RESULTS', 'RESULTS_REVIEW'].includes(nextStatus)) ||
          (current.status === 'RESULTS_REVIEW' && nextStatus === 'TECHNICAL_REVIEW') ||
          (current.status === 'TECHNICAL_REVIEW') ||
          (current.status === 'LEADERSHIP_APPROVAL');

        if (needsAssignmentCheck) {
          const assignmentResult = await client.query(
            `SELECT data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY updated_at DESC LIMIT 1`,
            [PGD_COLLECTIONS.assignments, requestId],
          );
          assignment = assignmentResult.rows[0]?.data;
        }

        if (current.status === 'PREPARING' && nextStatus === 'FIELD_INSPECTION') {
          const isTeamLead = hasPgdDossierCapability(assignment, actor.username, 'TEAM_LEAD');
          if (!isTeamLead && !isManager) {
            throw Object.assign(new Error('Chỉ Trưởng đoàn được phân công mới có quyền bắt đầu đánh giá hiện trường.'), { statusCode: 403 });
          }
        }

        if (['FIELD_INSPECTION', 'WAITING_LAB_RESULTS'].includes(current.status) && ['WAITING_LAB_RESULTS', 'RESULTS_REVIEW'].includes(nextStatus)) {
          const isAssessorOrLead = hasPgdDossierCapability(assignment, actor.username, 'ASSESSOR') || hasPgdDossierCapability(assignment, actor.username, 'TEAM_LEAD');
          if (!isAssessorOrLead && !isManager) {
            throw Object.assign(new Error('Chỉ Giám định viên hoặc Trưởng đoàn được phân công mới có quyền thực hiện bước này.'), { statusCode: 403 });
          }
        }

        if (current.status === 'RESULTS_REVIEW' && nextStatus === 'TECHNICAL_REVIEW') {
          const isTeamLead = hasPgdDossierCapability(assignment, actor.username, 'TEAM_LEAD');
          if (!isTeamLead && !isManager) {
            throw Object.assign(new Error('Chỉ Trưởng đoàn được phân công mới có quyền bàn giao hồ sơ sang thẩm xét chuyên môn.'), { statusCode: 403 });
          }
        }

        if (current.status === 'TECHNICAL_REVIEW') {
          const isTechnicalReviewer = hasPgdDossierCapability(assignment, actor.username, 'TECHNICAL_REVIEW');
          if (!isTechnicalReviewer && !isManager) {
            throw Object.assign(new Error('Chỉ người có quyền thẩm xét kỹ thuật mới được xử lý bước này.'), { statusCode: 403 });
          }
        }

        if (current.status === 'LEADERSHIP_APPROVAL') {
          const isLeadership = hasPgdDossierCapability(assignment, actor.username, 'LEADERSHIP_APPROVAL');
          if (!isLeadership && !isManager) {
            throw Object.assign(new Error('Chỉ Lãnh đạo có thẩm quyền mới được phê duyệt bước này.'), { statusCode: 403 });
          }
        }
      }

      const context = await readPgdTransitionContext(client, requestId, current.currentAssessmentRoundId);
      context.requiresPlanAcceptance = current.workflowSchemaVersion === 2 || current.workflowSnapshot?.workflowSchemaVersion === 2;
      const denial = getPgdOperationalStepGateDenial({ currentStatus: current.status, nextStatus, evidence: context });
      if (denial) throw Object.assign(new Error(denial), { statusCode: 409 });

      const now = new Date().toISOString();
      let firstAssessmentRound: PgdAssessmentRound | undefined;
      if (isV2 && current.status === 'PREPARING' && nextStatus === 'FIELD_INSPECTION') {
        const roundResult = await client.query(`SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY (data->>'sequence')::int, document_id FOR UPDATE`, [PGD_COLLECTIONS.assessmentRounds, current.id]);
        const existingRounds = roundResult.rows.map((row: any) => mapDocumentRow(row) as PgdAssessmentRound);
        firstAssessmentRound = createPgdAssessmentRound({ id: `pgd-round-${randomUUID()}`, requestId: current.id, openedByUsername: actor.username, existingRounds }, now);
        await client.query(`INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)`, [PGD_COLLECTIONS.assessmentRounds, firstAssessmentRound.id, JSON.stringify(getDocumentPayload(firstAssessmentRound))]);
      }
      const next = {
        ...current,
        status: nextStatus,
        updatedAt: now,
        ...(firstAssessmentRound ? {
          assessmentRoundIds: Array.from(new Set([...(current.assessmentRoundIds || []), firstAssessmentRound.id])),
          currentAssessmentRoundId: firstAssessmentRound.id,
        } : {}),
        ...(['REJECTED', 'ON_HOLD', 'CANCELLED'].includes(nextStatus)
          ? { exceptionReason, exceptionAt: now, exceptionByUsername: actor.username }
          : {}),
      };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $1 AND document_id = $3`,
        [PGD_COLLECTIONS.requests, JSON.stringify(getDocumentPayload(next)), requestId],
      );

      await writePgdActivity(client, actor, {
        action: 'STATUS_CHANGED',
        entityId: next.id,
        entityLabel: next.requestCode,
        requestCode: next.requestCode,
        summary: `Chuyển trạng thái hồ sơ PGD sang ${getPgdStatusLabel(next.status)}${exceptionReason ? `: ${exceptionReason}` : ''}`,
        changes: diffActivityFields(current, next, ['status']),
        idSuffix: `status-${current.status}-${next.status}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_REQUEST',
          action: 'STATUS_CHANGED',
          entityId: next.id,
          entityLabel: next.requestCode,
          requestCode: next.requestCode,
          previousStatus: current.status,
          nextStatus: next.status,
          actorName: actor.name || actor.username,
        }),
      });

      return next;
    });

    return jsonOk({ request: result });
  } catch (error: any) {
    console.error('PGD transition error:', error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 403) return jsonForbidden(error?.message || String(error));
    if (statusCode === 404) return jsonNotFound(error?.message || String(error));
    if (statusCode === 409) return jsonConflict(error?.message || String(error));
    return jsonBadRequest(error?.message || String(error));
  }
}
