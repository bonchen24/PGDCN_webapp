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
  OutboundLabRequest,
  PcnLabRequestStatus,
  PcnSampleLot,
  PcnSampleRoute,
  PcnDocumentRequirement,
  PcnDossierDocument,
} from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossiers';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import {
  buildPcnSampleFlowEvent,
  derivePcnSampleLotStatus,
  transitionPcnSampleRoute,
} from '@/utils/pcnSampleFlow';
import {
  getPcnSampleRouteStatusForLabRequest,
  isPcnLabRequestStatus,
} from '@/lib/server/pcn-samples';
import { buildPcnSampleHandoverDetails } from '@/utils/pcnHandoverPolicy';
import { transitionPcnLabRequest } from '@/utils/pcnLabRouting';
import { getPcnTimestampDenial } from '@/utils/pcnDossierDate';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canCreatePcnLabRequest } from '@/utils/pcnWorkflowStages';
import { isPcnDossierTransitionAllowed } from '@/utils/pcnWorkflow';
import { getPcnDossierStageGateDenial } from '@/utils/pcnDossierStageGate';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Cập nhật PYC PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const { requestId: rawRequestId } = await params;
  const requestId = String(rawRequestId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const rawStatus = String(body.status || '').trim().toUpperCase();
  const idempotencyKey = String(body.idempotencyKey || '').trim();
  const updateInput =
    body.updates && typeof body.updates === 'object' && !Array.isArray(body.updates) ? body.updates : {};

  if (!isSafePcnSampleKey(requestId) || !isPcnLabRequestStatus(rawStatus)) {
    return jsonBadRequest('Mã hoặc trạng thái PYC không hợp lệ.');
  }
  const status: PcnLabRequestStatus = rawStatus;
  if (!isSafePcnSampleKey(idempotencyKey)) {
    return jsonBadRequest('Cập nhật PYC phải có idempotencyKey an toàn.');
  }

  const idempotencyFingerprint = createHash('sha256')
    .update(JSON.stringify({ requestId, status, updates: updateInput }))
    .digest('hex');
  const actor = getPcnSessionUser(req)!;

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [idempotencyKey]);
      const activityId = stablePcnMutationId('activity-pcn-lab-request-status', `${requestId}:${idempotencyKey}`);
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'activityLogs' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [activityId]
      );
      if (existingActivityResult.rows[0]) {
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (
          String(existingActivity.entityId || '') !== requestId ||
          String(existingActivity.idempotencyKey || '') !== idempotencyKey ||
          String(existingActivity.toStatus || '').toUpperCase() !== status ||
          String(existingActivity.idempotencyFingerprint || '') !== idempotencyFingerprint
        ) {
          throw Object.assign(new Error('idempotencyKey đã được dùng cho một PYC khác.'), { statusCode: 409 });
        }
        const requestResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = $1 LIMIT 1`,
          [requestId]
        );
        if (!requestResult.rows[0]) {
          throw Object.assign(new Error('Không tìm thấy snapshot PYC đã commit.'), { statusCode: 404 });
        }
        const existingRequest = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
        const dossierResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
          [existingRequest.dossierId]
        );
        if (!dossierResult.rows[0]) {
          throw Object.assign(new Error('Không tìm thấy hồ sơ của PYC đã commit.'), { statusCode: 404 });
        }
        const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
        let lot: PcnSampleLot | undefined;
        let route: PcnSampleRoute | undefined;
        if (existingRequest.sampleRouteId && existingRequest.sampleLotId) {
          const [lotResult, routeResult] = await Promise.all([
            client.query(
              `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = $1 LIMIT 1`,
              [existingRequest.sampleLotId]
            ),
            client.query(
              `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 LIMIT 1`,
              [existingRequest.sampleRouteId]
            ),
          ]);
          lot = lotResult.rows[0] ? (mapDocumentRow(lotResult.rows[0]) as PcnSampleLot) : undefined;
          route = routeResult.rows[0] ? (mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute) : undefined;
        }
        return {
          request: existingRequest,
          dossier,
          ...(lot ? { lot } : {}),
          ...(route ? { route } : {}),
          activityLogs: [],
          idempotent: true,
        };
      }

      const requestProbeResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1`,
        [requestId]
      );
      if (!requestProbeResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC gửi PTN.'), { statusCode: 404 });
      }
      const requestProbe = mapDocumentRow(requestProbeResult.rows[0]) as OutboundLabRequest;
      let lot: PcnSampleLot | undefined;
      let route: PcnSampleRoute | undefined;
      if (requestProbe.sampleRouteId && requestProbe.sampleLotId) {
        const lotResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleLots' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [requestProbe.sampleLotId]
        );
        if (!lotResult.rows[0]) {
          throw Object.assign(new Error('Không tìm thấy lô mẫu liên kết với PYC.'), { statusCode: 404 });
        }
        lot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;
        const routeResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 AND data->>'sampleLotId' = $2
           LIMIT 1 FOR UPDATE`,
          [requestProbe.sampleRouteId, lot.id]
        );
        if (!routeResult.rows[0]) {
          throw Object.assign(new Error('Không tìm thấy tuyến mẫu liên kết với PYC.'), { statusCode: 404 });
        }
        route = mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute;
        if (route.labRequestId && route.labRequestId !== requestId) {
          throw Object.assign(new Error('Tuyến mẫu đang trỏ tới PYC khác.'), { statusCode: 409 });
        }
      } else if (requestProbe.sampleRouteId || requestProbe.sampleLotId) {
        throw Object.assign(new Error('PYC có liên kết mẫu không đầy đủ.'), { statusCode: 409 });
      }

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [requestProbe.dossierId]
      );
      if (!dossierResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ của PYC.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(
          new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi cập nhật PYC.'),
          { statusCode: 409 }
        );
      }
      assertPcnDossierOperator(dossier, actor);

      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [requestId]
      );
      if (!requestResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC gửi PTN.'), { statusCode: 404 });
      }
      const request = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
      if (!isPcnLabRequestStatus(request.status)) {
        throw Object.assign(new Error('PYC đang có trạng thái không hợp lệ.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      let nextRequest: OutboundLabRequest;
      if (request.status !== status) {
        try {
          transitionPcnLabRequest(request.status, status);
        } catch (error) {
          throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 409 });
        }
      }

      const allowedUpdates: Partial<
        Pick<
          OutboundLabRequest,
          | 'handoverAt'
          | 'receivedAt'
          | 'handoverNote'
          | 'handoverDocumentId'
          | 'handoverDetails'
          | 'sampleIssue'
          | 'returnedResultId'
        >
      > = {};
      for (const key of ['handoverAt', 'receivedAt', 'handoverNote', 'handoverDocumentId', 'returnedResultId'] as const) {
        if (typeof updateInput[key] === 'string' && updateInput[key].trim()) {
          allowedUpdates[key] = updateInput[key].trim();
        }
      }
      if (Object.prototype.hasOwnProperty.call(updateInput, 'handoverDetails')) {
        try {
          const details = buildPcnSampleHandoverDetails(updateInput.handoverDetails || {});
          allowedUpdates.handoverDetails = details;
          allowedUpdates.handoverAt = details.handoverAt;
          if (details.receivedAt) allowedUpdates.receivedAt = details.receivedAt;
          if (details.note) allowedUpdates.handoverNote = details.note;
        } catch (error) {
          throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 400 });
        }
      }
      for (const [key, label] of [
        ['handoverAt', 'Thời điểm bàn giao PYC'],
        ['receivedAt', 'Thời điểm PTN nhận PYC'],
      ] as const) {
        const timestampDenial = getPcnTimestampDenial(label, allowedUpdates[key] ?? request[key]);
        if (timestampDenial) throw Object.assign(new Error(timestampDenial), { statusCode: 400 });
      }
      if (Object.prototype.hasOwnProperty.call(updateInput, 'sampleIssue')) {
        const issue = updateInput.sampleIssue;
        if (
          !issue ||
          typeof issue !== 'object' ||
          Array.isArray(issue) ||
          !String(issue.type || '').trim() ||
          !String(issue.description || '').trim()
        ) {
          throw Object.assign(new Error('Thông tin mẫu có vấn đề không hợp lệ.'), { statusCode: 400 });
        }
        allowedUpdates.sampleIssue = {
          ...issue,
          type: String(issue.type).trim(),
          description: String(issue.description).trim(),
        };
      }
      nextRequest = { ...request, ...allowedUpdates, status, updatedAt: now };
      if (status === 'SENT' && !nextRequest.handoverAt) nextRequest.handoverAt = now;
      if (status === 'RECEIVED' && !nextRequest.receivedAt) nextRequest.receivedAt = now;
      for (const [key, label] of [
        ['handoverAt', 'Thời điểm bàn giao PYC'],
        ['receivedAt', 'Thời điểm PTN nhận PYC'],
      ] as const) {
        const timestampDenial = getPcnTimestampDenial(label, nextRequest[key]);
        if (timestampDenial) throw Object.assign(new Error(timestampDenial), { statusCode: 400 });
      }
      if (
        nextRequest.handoverAt &&
        nextRequest.receivedAt &&
        Date.parse(nextRequest.receivedAt) < Date.parse(nextRequest.handoverAt)
      ) {
        throw Object.assign(new Error('Thời điểm PTN nhận PYC không được sớm hơn thời điểm bàn giao.'), {
          statusCode: 400,
        });
      }
      if (status === 'SENT' && !canCreatePcnLabRequest(dossier)) {
        throw Object.assign(new Error('Hồ sơ chưa ở bước lấy mẫu & gửi PTN để gửi PYC.'), { statusCode: 409 });
      }

      if (
        status === 'SENT' &&
        ['FIELD_EVALUATION', 'AWAITING_SAMPLING'].includes(dossier.status) &&
        isPcnDossierTransitionAllowed(dossier.status, 'SENT_TO_LAB')
      ) {
        const requirementResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnDocumentRequirements'`
        );
        const configuredRequirements = requirementResult.rows.map(
          (row: any) => mapDocumentRow(row) as PcnDocumentRequirement
        );
        const documentResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`,
          [dossier.id]
        );
        const stageGateDenial = getPcnDossierStageGateDenial({
          dossier,
          nextStatus: 'SENT_TO_LAB',
          requirements: configuredRequirements.length > 0 ? configuredRequirements : undefined,
          documents: documentResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument),
          documentWaivers: dossier.documentWaivers,
        });
        if (stageGateDenial) throw Object.assign(new Error(stageGateDenial), { statusCode: 409 });
      }

      let nextLot = lot;
      let nextRoute = route;
      const targetRouteStatus = route ? getPcnSampleRouteStatusForLabRequest(status) : null;
      if (route && targetRouteStatus) {
        const currentMappedStatus = getPcnSampleRouteStatusForLabRequest(request.status);
        const isClosedHandoverAmendment =
          status === request.status &&
          route.status === 'CLOSED' &&
          Object.prototype.hasOwnProperty.call(updateInput, 'handoverDetails');
        if (isClosedHandoverAmendment) {
          nextRoute = route;
          nextLot = lot;
        } else {
          if (route.status !== currentMappedStatus && route.status !== targetRouteStatus) {
            throw Object.assign(
              new Error(`Snapshot tuyến ${route.labName} không đồng bộ với trạng thái PYC ${request.status}.`),
              { statusCode: 409 }
            );
          }
          try {
            nextRoute =
              route.status === targetRouteStatus
                ? { ...route, labRequestId: request.id, updatedAt: now }
                : transitionPcnSampleRoute(route, targetRouteStatus, {}, now);
          } catch (error) {
            throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 409 });
          }
          const siblingRoutesResult = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1
             ORDER BY document_id FOR UPDATE`,
            [lot!.id]
          );
          const siblingRoutes = siblingRoutesResult.rows
            .map(mapDocumentRow)
            .map((item: PcnSampleRoute) => (item.id === nextRoute!.id ? nextRoute! : item)) as PcnSampleRoute[];
          nextLot = { ...lot!, ...derivePcnSampleLotStatus(siblingRoutes), updatedAt: now };
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1`,
            [nextRoute.id, JSON.stringify(getDocumentPayload(nextRoute))]
          );
          await client.query(
            `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
             WHERE collection_name = 'pcnSampleLots' AND document_id = $1`,
            [nextLot.id, JSON.stringify(getDocumentPayload(nextLot))]
          );
          const sampleEvent = buildPcnSampleFlowEvent(
            {
              id: stablePcnMutationId('pcn-sample-event-pyc-status', `${request.id}:${idempotencyKey}`),
              sampleLotId: nextLot.id,
              routeId: nextRoute.id,
              labRequestId: request.id,
              idempotencyFingerprint,
              type:
                status === 'SENT'
                  ? 'SENT_TO_LAB'
                  : status === 'RECEIVED'
                  ? 'LAB_RECEIVED'
                  : status === 'RESULT_RETURNED'
                  ? 'RESULT_RETURNED'
                  : 'UPDATED',
              fromStatus: route.status,
              toStatus: nextRoute.status,
              location: nextLot.currentLocation,
              note: String(allowedUpdates.handoverNote || '').trim() || undefined,
              actorUsername: actor.username,
            },
            now
          );
          await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
             VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
            [sampleEvent.id, JSON.stringify(getDocumentPayload(sampleEvent))]
          );
        }
      }

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'labRequests' AND document_id = $1`,
        [nextRequest.id, JSON.stringify(getDocumentPayload(nextRequest))]
      );

      let nextDossier = dossier;
      if (
        status === 'SENT' &&
        ['FIELD_EVALUATION', 'AWAITING_SAMPLING'].includes(dossier.status) &&
        isPcnDossierTransitionAllowed(dossier.status, 'SENT_TO_LAB')
      ) {
        nextDossier = { ...dossier, status: 'SENT_TO_LAB', updatedAt: now };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
        );
      } else {
        nextDossier = { ...dossier, updatedAt: now };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
        );
      }

      const activity = {
        ...buildActivityLog({
          id: activityId,
          action: 'STATUS_CHANGED',
          entityType: 'PCN_LAB_REQUEST',
          entityId: request.id,
          entityLabel: request.pycNumber,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: (actor.systemRole || actor.role) as any,
          summary: `Cập nhật PYC sang ${nextRequest.status}`,
          source: 'UI',
          groupId: request.dossierId,
          changes: diffActivityFields(request, nextRequest, [
            'status',
            'handoverAt',
            'receivedAt',
            'handoverNote',
            'handoverDocumentId',
            'handoverDetails',
            'sampleIssue',
          ]),
          createdAt: now,
        }),
        idempotencyKey,
        toStatus: status,
        idempotencyFingerprint,
      };
      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))]
      );

      return {
        request: nextRequest,
        dossier: nextDossier,
        ...(nextLot ? { lot: nextLot } : {}),
        ...(nextRoute ? { route: nextRoute } : {}),
        activityLogs: [activity],
        idempotent: false,
      };
    });

    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN lab request status error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
