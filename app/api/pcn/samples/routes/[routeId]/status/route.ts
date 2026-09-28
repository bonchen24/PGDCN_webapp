import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonCreated,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
} from '@/lib/server/response';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  CertificationDossier,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleRouteStatus,
  PcnSampleItem,
  OutboundLabRequest,
  PcnSampleFlowEventType,
} from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossiers';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { sanitizePcnPathSegment } from '@/lib/server/storage';
import {
  buildPcnSampleFlowEvent,
  derivePcnSampleLotStatus,
  getPcnSampleRouteStartDenial,
  transitionPcnSampleRoute,
  type PcnSampleRouteUpdate,
} from '@/utils/pcnSampleFlow';
import { getPcnLabRequestStatusForSampleRoute } from '@/lib/server/pcn-samples';
import { transitionPcnLabRequest } from '@/utils/pcnLabRouting';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canProcessPcnSampleFlow } from '@/utils/pcnWorkflowStages';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ routeId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Cập nhật tuyến mẫu PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const { routeId: rawRouteId } = await params;
  const routeId = String(rawRouteId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const status = String(body.status || '').trim().toUpperCase() as PcnSampleRouteStatus;
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  const updateInput = body.update && typeof body.update === 'object' && !Array.isArray(body.update) ? body.update : {};

  if (
    !isSafePcnSampleKey(routeId) ||
    !['PENDING', 'SENT', 'RECEIVED', 'RESULT_RETURNED', 'RETURNED_TO_PCN', 'CLOSED', 'ISSUE', 'CANCELLED'].includes(status)
  ) {
    return jsonBadRequest('Mã tuyến hoặc trạng thái tuyến mẫu không hợp lệ.');
  }
  if (!isSafePcnSampleKey(idempotencyKey)) {
    return jsonBadRequest('Cập nhật tuyến mẫu phải có idempotencyKey an toàn.');
  }

  const idempotencyFingerprint = createHash('sha256')
    .update(JSON.stringify({ routeId, status, update: updateInput }))
    .digest('hex');
  const actor = getPcnSessionUser(req)!;

  try {
    const result = await withPgTransaction(async (client) => {
      const eventId = `pcn-sample-event-${sanitizePcnPathSegment(idempotencyKey)}`;
      const existingEventResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleFlowEvents' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [eventId]
      );
      if (existingEventResult.rows.length > 0) {
        const existingEvent = mapDocumentRow(existingEventResult.rows[0]) as Record<string, any>;
        if (
          String(existingEvent.routeId || '') !== routeId ||
          String(existingEvent.toStatus || '').toUpperCase() !== status ||
          (existingEvent.idempotencyFingerprint && existingEvent.idempotencyFingerprint !== idempotencyFingerprint)
        ) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho một chuyển tuyến khác.'), { statusCode: 409 });
        }
        const [routeResult, lotResult, dossierResult] = await Promise.all([
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 LIMIT 1`,
            [routeId]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = $1 LIMIT 1`,
            [existingEvent.sampleLotId]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = (SELECT data->>'dossierId' FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = $1) LIMIT 1`,
            [existingEvent.sampleLotId]
          ),
        ]);
        if (!routeResult.rows[0] || !lotResult.rows[0] || !dossierResult.rows[0]) {
          throw Object.assign(new Error('Không tìm thấy snapshot đã commit của chuyển tuyến mẫu.'), { statusCode: 404 });
        }
        return {
          route: mapDocumentRow(routeResult.rows[0]),
          lot: mapDocumentRow(lotResult.rows[0]),
          dossier: mapDocumentRow(dossierResult.rows[0]),
          event: existingEvent,
          activityLogs: [],
          idempotent: true,
        };
      }

      const routeProbe = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1
         LIMIT 1`,
        [routeId]
      );
      if (routeProbe.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy tuyến luân chuyển mẫu.'), { statusCode: 404 });
      }
      const routeProbeData = mapDocumentRow(routeProbe.rows[0]) as PcnSampleRoute;
      const lotResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleLots' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [routeProbeData.sampleLotId]
      );
      if (lotResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy lô mẫu của tuyến luân chuyển.'), { statusCode: 404 });
      }
      const lot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;
      const routeResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [routeId]
      );
      if (routeResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy tuyến luân chuyển mẫu.'), { statusCode: 404 });
      }
      const route = mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute;
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [lot.dossierId]
      );
      if (dossierResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ của lô mẫu.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(
          new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi cập nhật tuyến mẫu.'),
          { statusCode: 409 }
        );
      }
      assertPcnDossierOperator(dossier, actor);
      if (!canProcessPcnSampleFlow(dossier)) {
        throw Object.assign(new Error('Hồ sơ chưa đến bước lấy mẫu & gửi PTN để xử lý luồng mẫu.'), { statusCode: 409 });
      }
      const labRequestId = String(updateInput.labRequestId || '').trim();
      if (labRequestId) {
        const labRequestResult = await client.query(
          `SELECT document_id FROM app_documents
           WHERE collection_name = 'labRequests' AND document_id = $1 AND data->>'dossierId' = $2 LIMIT 1`,
          [labRequestId, dossier.id]
        );
        if (labRequestResult.rows.length === 0) {
          throw Object.assign(new Error('PYC gắn vào tuyến mẫu không thuộc hồ sơ.'), { statusCode: 400 });
        }
      }
      const routeUpdate: PcnSampleRouteUpdate = {
        ...(labRequestId ? { labRequestId } : {}),
        ...(String(updateInput.note || '').trim() ? { note: String(updateInput.note).trim() } : {}),
      };
      const siblingRoutesResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1
         ORDER BY document_id FOR UPDATE`,
        [lot.id]
      );
      const siblingRoutes = siblingRoutesResult.rows.map(mapDocumentRow) as PcnSampleRoute[];
      if (route.status === 'PENDING' && status === 'SENT' && route.sampleItemIds?.length) {
        const sampleItemsResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleItems' AND data->>'sampleLotId' = $1
           ORDER BY document_id`,
          [lot.id]
        );
        const sampleItems = sampleItemsResult.rows.map(mapDocumentRow) as PcnSampleItem[];
        const routeStartDenial = getPcnSampleRouteStartDenial(route, siblingRoutes, sampleItems);
        if (routeStartDenial) throw Object.assign(new Error(routeStartDenial), { statusCode: 409 });
      }
      const now = new Date().toISOString();
      let nextRoute: PcnSampleRoute;
      try {
        nextRoute = transitionPcnSampleRoute(route, status, routeUpdate, now);
      } catch (error) {
        throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 409 });
      }
      const nextSiblingRoutes = siblingRoutes.map((item) => (item.id === nextRoute.id ? nextRoute : item));
      const derived = derivePcnSampleLotStatus(nextSiblingRoutes);
      const nextLot: PcnSampleLot = { ...lot, ...derived, updatedAt: now };
      const linkedPycResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND data->>'sampleRouteId' = $1
         LIMIT 1 FOR UPDATE`,
        [route.id]
      );
      const linkedPyc = linkedPycResult.rows[0] ? (mapDocumentRow(linkedPycResult.rows[0]) as OutboundLabRequest) : undefined;
      if (route.labRequestId && (!linkedPyc || linkedPyc.id !== route.labRequestId)) {
        throw Object.assign(new Error('Tuyến mẫu có backlink PYC nhưng không tìm thấy PYC tương ứng.'), { statusCode: 409 });
      }
      if (linkedPyc && (linkedPyc.sampleLotId !== lot.id || linkedPyc.dossierId !== dossier.id)) {
        throw Object.assign(new Error('PYC liên kết với tuyến mẫu không cùng hồ sơ/lô.'), { statusCode: 409 });
      }
      let nextLinkedPyc = linkedPyc;
      const syncedPycStatus = getPcnLabRequestStatusForSampleRoute(nextRoute.status);
      if (linkedPyc && syncedPycStatus && linkedPyc.status !== syncedPycStatus) {
        try {
          transitionPcnLabRequest(linkedPyc.status, syncedPycStatus);
        } catch (error) {
          throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 409 });
        }
        nextLinkedPyc = {
          ...linkedPyc,
          status: syncedPycStatus,
          updatedAt: now,
          ...(syncedPycStatus === 'SENT' && !linkedPyc.handoverAt ? { handoverAt: now } : {}),
          ...(syncedPycStatus === 'RECEIVED' && !linkedPyc.receivedAt ? { receivedAt: now } : {}),
        };
      }
      const routeWithPyc = linkedPyc ? { ...nextRoute, labRequestId: linkedPyc.id } : nextRoute;
      const nextDossier: CertificationDossier = { ...dossier, updatedAt: now };

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1`,
        [routeWithPyc.id, JSON.stringify(getDocumentPayload(routeWithPyc))]
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnSampleLots' AND document_id = $1`,
        [nextLot.id, JSON.stringify(getDocumentPayload(nextLot))]
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
      );
      if (nextLinkedPyc && nextLinkedPyc.status !== linkedPyc?.status) {
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'labRequests' AND document_id = $1`,
          [nextLinkedPyc.id, JSON.stringify(getDocumentPayload(nextLinkedPyc))]
        );
      }

      const eventType: PcnSampleFlowEventType =
        status === 'SENT'
          ? 'SENT_TO_LAB'
          : status === 'RECEIVED'
          ? 'LAB_RECEIVED'
          : status === 'RESULT_RETURNED'
          ? 'RESULT_RETURNED'
          : status === 'RETURNED_TO_PCN'
          ? 'SAMPLE_RETURNED'
          : status === 'CLOSED'
          ? 'CLOSED'
          : status === 'ISSUE'
          ? 'ISSUE_RECORDED'
          : 'UPDATED';

      const event = buildPcnSampleFlowEvent(
        {
          id: eventId,
          sampleLotId: lot.id,
          routeId: routeWithPyc.id,
          ...(linkedPyc ? { labRequestId: linkedPyc.id } : {}),
          idempotencyFingerprint,
          type: eventType,
          fromStatus: route.status,
          toStatus: routeWithPyc.status,
          location: nextLot.currentLocation,
          note: routeUpdate.note,
          actorUsername: actor.username,
        },
        now
      );
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [event.id, JSON.stringify(getDocumentPayload(event))]
      );
      const activity = buildActivityLog({
        id: `activity-${sanitizePcnPathSegment(eventId)}`,
        action: 'STATUS_CHANGED',
        entityType: 'PCN_SAMPLE_LOT',
        entityId: lot.id,
        entityLabel: lot.lotCode,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: (actor.systemRole || actor.role) as any,
        summary: `Cập nhật tuyến ${route.labName}: ${route.status} → ${routeWithPyc.status}`,
        source: 'UI',
        groupId: lot.id,
        changes: diffActivityFields(route, routeWithPyc, [
          'status',
          'sentAt',
          'receivedAt',
          'resultReturnedAt',
          'returnedAt',
          'note',
          'labRequestId',
        ]),
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))]
      );
      let linkedActivity: ReturnType<typeof buildActivityLog> | undefined;
      if (nextLinkedPyc && nextLinkedPyc.status !== linkedPyc?.status) {
        linkedActivity = buildActivityLog({
          id: stablePcnMutationId('activity-pcn-lab-request-route-sync', eventId),
          action: 'STATUS_CHANGED',
          entityType: 'PCN_LAB_REQUEST',
          entityId: nextLinkedPyc.id,
          entityLabel: nextLinkedPyc.pycNumber,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: (actor.systemRole || actor.role) as any,
          summary: `Đồng bộ trạng thái PYC theo tuyến mẫu: ${linkedPyc?.status} → ${nextLinkedPyc.status}`,
          source: 'UI',
          groupId: lot.id,
          changes: diffActivityFields(linkedPyc, nextLinkedPyc, ['status', 'handoverAt', 'receivedAt']),
          createdAt: now,
        });
        const linkedValidationError = validateActivityLogPayload(linkedActivity);
        if (linkedValidationError) throw new Error(linkedValidationError);
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [linkedActivity.id, JSON.stringify(getDocumentPayload(linkedActivity))]
        );
      }
      return {
        route: routeWithPyc,
        lot: nextLot,
        dossier: nextDossier,
        event,
        activityLogs: linkedActivity ? [activity, linkedActivity] : [activity],
      };
    });

    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN sample route update error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
