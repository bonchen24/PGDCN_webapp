import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonNotFound,
  jsonOk,
  jsonServerError,
  jsonUnauthorized,
} from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  CertificationDossier,
  OutboundLabRequest,
  PcnLabRequestStatus,
  PcnSampleExecutionSnapshot,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleRouteItemSnapshot,
  PcnSampleRouteStatus,
} from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import {
  PcnLabIntegrationConfig,
  buildPcnLabBodySha256,
  getPcnLabIntegrationConfig,
  getPcnLabIntegrationSecret,
  getPcnLabRequestStatusForSampleRoute,
  updatePcnSampleRequestBundleDispatch,
  verifyPcnLabHmacSignature,
} from '@/lib/server/pcn-samples';
import {
  PcnLabStatusEventInput,
  getPcnLabIntegrationEventId,
  mapPcnLabStatusEvent,
} from '@/utils/pcnLabIntegration';
import {
  buildPcnSampleFlowEvent,
  derivePcnSampleLotStatus,
  projectPcnSampleRouteFromItemSnapshots,
  transitionPcnSampleRoute,
} from '@/utils/pcnSampleFlow';
import { transitionPcnLabRequest } from '@/utils/pcnLabRouting';
import { DATABASE_PROFILE } from '@/lib/server/env';

export const dynamic = 'force-dynamic';

function getPcnLabWebhookReplayWindowSeconds(): number {
  const configured = Number(process.env.PCN_LAB_WEBHOOK_REPLAY_WINDOW_SECONDS || 300);
  return Math.min(3600, Math.max(30, Number.isFinite(configured) ? configured : 300));
}

function applyPcnRemoteRouteStatus(route: PcnSampleRoute, targetStatus: PcnSampleRouteStatus, now: string): PcnSampleRoute {
  if (route.status === targetStatus) return route;
  if (targetStatus === 'ISSUE') {
    if (['CLOSED', 'CANCELLED'].includes(route.status)) {
      throw Object.assign(new Error('Không thể ghi nhận sự cố cho tuyến đã kết thúc.'), { statusCode: 409 });
    }
    return { ...route, status: 'ISSUE', updatedAt: now };
  }
  if (targetStatus === 'CANCELLED') {
    if (['CLOSED', 'CANCELLED'].includes(route.status)) return route;
    return transitionPcnSampleRoute(route, 'CANCELLED', {}, now);
  }
  const statusPath: PcnSampleRouteStatus[] =
    targetStatus === 'RECEIVED'
      ? ['SENT', 'RECEIVED']
      : targetStatus === 'RESULT_RETURNED'
        ? ['SENT', 'RECEIVED', 'RESULT_RETURNED']
        : targetStatus === 'RETURNED_TO_PCN'
          ? ['SENT', 'RECEIVED', 'RESULT_RETURNED', 'RETURNED_TO_PCN']
          : [targetStatus];
  let next = route;
  for (const status of statusPath) {
    if (next.status === status) continue;
    if (next.status === 'PENDING' && status === 'SENT') {
      next = transitionPcnSampleRoute(next, 'SENT', {}, now);
      continue;
    }
    if (next.status === 'SENT' && status === 'RECEIVED') {
      next = transitionPcnSampleRoute(next, 'RECEIVED', {}, now);
      continue;
    }
    if (next.status === 'RECEIVED' && status === 'RESULT_RETURNED') {
      next = transitionPcnSampleRoute(next, 'RESULT_RETURNED', {}, now);
      continue;
    }
    if (next.status === 'RESULT_RETURNED' && status === 'RETURNED_TO_PCN') {
      next = transitionPcnSampleRoute(next, 'RETURNED_TO_PCN', {}, now);
      continue;
    }
    if (next.status === 'RETURNED_TO_PCN' && status === 'CLOSED') {
      next = transitionPcnSampleRoute(next, 'CLOSED', {}, now);
      continue;
    }
    if (next.status === 'ISSUE' && status === 'RECEIVED') {
      next = transitionPcnSampleRoute(next, 'RECEIVED', {}, now);
      continue;
    }
    throw Object.assign(new Error(`Không thể đồng bộ tuyến mẫu từ ${next.status} sang ${targetStatus}.`), { statusCode: 409 });
  }
  return next;
}

function applyPcnRemoteLabRequestStatus(
  request: OutboundLabRequest,
  targetStatus: PcnLabRequestStatus,
  now: string,
): OutboundLabRequest {
  if (request.status === targetStatus) return request;
  const statusPath: PcnLabRequestStatus[] =
    targetStatus === 'RECEIVED'
      ? ['SENT', 'RECEIVED']
      : targetStatus === 'RESULT_RETURNED'
        ? ['SENT', 'RECEIVED', 'RESULT_RETURNED']
        : [targetStatus];
  let current = request.status;
  for (const status of statusPath) {
    if (current === status) continue;
    transitionPcnLabRequest(current, status);
    current = status;
  }
  return {
    ...request,
    status: current,
    updatedAt: now,
    ...(current === 'SENT' && !request.handoverAt ? { handoverAt: now } : {}),
    ...(current === 'RECEIVED' && !request.receivedAt ? { receivedAt: now } : {}),
  };
}

function buildPcnRemoteExecutionSnapshot(
  current: PcnSampleExecutionSnapshot | undefined,
  next: PcnSampleExecutionSnapshot,
): PcnSampleExecutionSnapshot {
  return {
    ...(current || {}),
    ...next,
  };
}

export async function POST(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Webhook phòng thử chỉ khả dụng trong profile PCN.');
  }

  const body = (await req.json().catch(() => null)) as Record<string, any> | null;
  const sourceSystemCode = String(body?.sourceSystemCode || '').trim().toUpperCase();
  const timestamp = String(req.headers.get('x-pcn-timestamp') || '').trim();
  const messageId = String(req.headers.get('x-pcn-message-id') || body?.messageId || '').trim();
  const providedSignature = String(req.headers.get('x-pcn-signature') || '').trim();

  let config: PcnLabIntegrationConfig | null = null;
  try {
    config = getPcnLabIntegrationConfig(sourceSystemCode);
    if (!config) {
      return jsonServerError(`Chưa cấu hình tích hợp app phòng thử ${sourceSystemCode || 'không xác định'}.`);
    }
    const secret = getPcnLabIntegrationSecret(config);
    const timestampSeconds = Number(timestamp);
    if (
      !body ||
      !messageId ||
      !timestamp ||
      !Number.isInteger(timestampSeconds) ||
      Math.abs(Math.floor(Date.now() / 1000) - timestampSeconds) > getPcnLabWebhookReplayWindowSeconds()
    ) {
      return jsonUnauthorized('Webhook phòng thử thiếu timestamp/messageId hoặc đã quá thời hạn.');
    }

    const bodySha256 = buildPcnLabBodySha256(body);
    const url = new URL(req.url);
    if (
      !verifyPcnLabHmacSignature({
        secret,
        providedSignature,
        method: req.method,
        path: url.pathname,
        timestamp,
        messageId,
        bodySha256,
      })
    ) {
      return jsonUnauthorized('Chữ ký webhook phòng thử không hợp lệ.');
    }

    const eventInput = {
      ...body,
      sourceSystemCode,
      externalEventId: String(body.externalEventId || '').trim(),
      externalRequestId: String(body.externalRequestId || '').trim(),
      externalRequestCode: String(body.externalRequestCode || '').trim() || undefined,
      externalSequence: Number(body.externalSequence),
      pcnRouteId: String(body.pcnRouteId || '').trim() || undefined,
      pcnLabRequestId: String(body.pcnLabRequestId || '').trim() || undefined,
      pcnSampleItemIds: Array.isArray(body.pcnSampleItemIds)
        ? body.pcnSampleItemIds.map((value: unknown) => String(value).trim()).filter(Boolean)
        : undefined,
      sampleFeedback: Array.isArray(body.sampleFeedback) ? body.sampleFeedback : undefined,
      eventType: String(body.eventType || '').trim().toUpperCase(),
      occurredAt: String(body.occurredAt || '').trim(),
    } as PcnLabStatusEventInput;

    const mapped = mapPcnLabStatusEvent(eventInput);
    if (!eventInput.pcnRouteId && !eventInput.pcnLabRequestId) {
      return jsonBadRequest('Webhook phải có pcnRouteId hoặc pcnLabRequestId.');
    }

    const result = await withPgTransaction(async (client) => {
      const integrationLockKey = `${sourceSystemCode}:${eventInput.externalRequestId}`;
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [integrationLockKey]);

      const eventId = getPcnLabIntegrationEventId(sourceSystemCode, eventInput.externalEventId);
      const existingEventResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleFlowEvents' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [eventId],
      );
      if (existingEventResult.rows[0]) {
        return { event: mapDocumentRow(existingEventResult.rows[0]), idempotent: true };
      }

      let route: PcnSampleRoute | undefined;
      if (eventInput.pcnRouteId) {
        const routeResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [eventInput.pcnRouteId],
        );
        route = routeResult.rows[0] ? (mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute) : undefined;
      } else {
        const requestResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'labRequests' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [eventInput.pcnLabRequestId],
        );
        const requestById = requestResult.rows[0] ? (mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest) : undefined;
        if (requestById?.sampleRouteId) {
          const routeResult = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1
             LIMIT 1 FOR UPDATE`,
            [requestById.sampleRouteId],
          );
          route = routeResult.rows[0] ? (mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute) : undefined;
        }
      }
      if (!route) throw Object.assign(new Error('Không tìm thấy tuyến mẫu của webhook phòng thử.'), { statusCode: 404 });
      if (route.labCode !== sourceSystemCode) {
        throw Object.assign(new Error('sourceSystemCode không khớp với phòng thử của tuyến mẫu.'), { statusCode: 409 });
      }

      const lotResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleLots' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [route.sampleLotId],
      );
      if (!lotResult.rows[0]) throw Object.assign(new Error('Không tìm thấy lô mẫu của webhook phòng thử.'), { statusCode: 404 });
      const lot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;

      const sampleItemsResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleItems' AND data->>'sampleLotId' = $1
         ORDER BY document_id`,
        [lot.id],
      );
      const sampleItems = sampleItemsResult.rows.map(mapDocumentRow) as PcnSampleItem[];
      const lotSampleItemIds = new Set(
        sampleItemsResult.rows.map((r: any) => String(r.document_id || '').trim()).filter(Boolean),
      );
      const eventSampleItemIds = Array.from(
        new Set([
          ...(eventInput.pcnSampleItemIds || []),
          ...(mapped.sampleFeedback || []).map((feedback) => feedback.pcnSampleItemId),
        ]),
      );
      if (eventSampleItemIds.some((itemId) => !lotSampleItemIds.has(itemId))) {
        throw Object.assign(new Error('Webhook chứa mẫu/model không thuộc lô PCN.'), { statusCode: 409 });
      }
      if (route.sampleItemIds?.length && eventSampleItemIds.some((itemId) => !route.sampleItemIds!.includes(itemId))) {
        throw Object.assign(new Error('Webhook chứa mẫu/model không thuộc phạm vi tuyến phòng thử.'), { statusCode: 409 });
      }

      let request: OutboundLabRequest | undefined;
      const requestId = eventInput.pcnLabRequestId || route.labRequestId;
      if (requestId) {
        const requestResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'labRequests' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [requestId],
        );
        request = requestResult.rows[0] ? (mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest) : undefined;
        if (!request) throw Object.assign(new Error('Không tìm thấy PYC của webhook phòng thử.'), { statusCode: 404 });
        if (request.sampleRouteId !== route.id || request.sampleLotId !== lot.id || request.dossierId !== lot.dossierId) {
          throw Object.assign(new Error('PYC của webhook không liên kết đúng với tuyến/lô/hồ sơ.'), { statusCode: 409 });
        }
        if (request.integration?.externalRequestId && request.integration.externalRequestId !== eventInput.externalRequestId) {
          throw Object.assign(new Error('externalRequestId của webhook không khớp PYC đã ACK.'), { statusCode: 409 });
        }
        if (request.integration?.targetSystemCode && request.integration.targetSystemCode !== sourceSystemCode) {
          throw Object.assign(new Error('Webhook đến từ app khác với app đã nhận PYC.'), { statusCode: 409 });
        }
      }
      if (lot.dossierId !== (request?.dossierId || lot.dossierId)) {
        throw Object.assign(new Error('Dữ liệu lô mẫu và PYC webhook không cùng hồ sơ.'), { statusCode: 409 });
      }

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [lot.dossierId],
      );
      if (!dossierResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ của webhook phòng thử.'), { statusCode: 404 });
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;

      const currentSequence =
        eventSampleItemIds.length > 0
          ? Math.max(
              ...eventSampleItemIds.map((itemId) => Number(route.itemSnapshots?.[itemId]?.execution?.lastExternalSequence || 0)),
            )
          : Math.max(Number(route.execution?.lastExternalSequence || 0), Number(request?.integration?.lastExternalSequence || 0));

      const now = new Date().toISOString();
      if (eventInput.externalSequence <= currentSequence) {
        const staleEvent = buildPcnSampleFlowEvent(
          {
            id: eventId,
            sampleLotId: lot.id,
            routeId: route.id,
            ...(request ? { labRequestId: request.id } : {}),
            idempotencyFingerprint: buildPcnLabBodySha256(body),
            sourceSystemCode,
            externalEventId: eventInput.externalEventId,
            externalRequestId: eventInput.externalRequestId,
            externalSequence: eventInput.externalSequence,
            ...(eventSampleItemIds.length ? { sampleItemIds: eventSampleItemIds } : {}),
            ...(mapped.sampleFeedback?.length ? { sampleFeedback: mapped.sampleFeedback } : {}),
            type: mapped.internalEventType,
            fromStatus: route.status,
            toStatus: route.status,
            location: lot.currentLocation,
            note: `Bỏ qua event đến trễ sequence ${eventInput.externalSequence}; snapshot hiện tại là ${currentSequence}.`,
            actorUsername: `integration:${sourceSystemCode}`,
          },
          eventInput.occurredAt,
        );
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [staleEvent.id, JSON.stringify(getDocumentPayload(staleEvent))],
        );
        return { event: staleEvent, route, lot, dossier, ...(request ? { request } : {}), idempotent: true, stale: true };
      }

      let nextRoute = route;
      if (eventSampleItemIds.length > 0) {
        const itemSnapshots = { ...(route.itemSnapshots || {}) };
        for (const sampleItemId of eventSampleItemIds) {
          const currentItem = itemSnapshots[sampleItemId] || {};
          const itemRoute: PcnSampleRoute = {
            ...route,
            status: currentItem.status || route.status,
            ...(currentItem.execution ? { execution: currentItem.execution } : {}),
            ...(currentItem.sentAt ? { sentAt: currentItem.sentAt } : {}),
            ...(currentItem.receivedAt ? { receivedAt: currentItem.receivedAt } : {}),
            ...(currentItem.resultReturnedAt ? { resultReturnedAt: currentItem.resultReturnedAt } : {}),
            ...(currentItem.returnedAt ? { returnedAt: currentItem.returnedAt } : {}),
          };
          const nextItemRoute = mapped.routeStatus ? applyPcnRemoteRouteStatus(itemRoute, mapped.routeStatus, now) : itemRoute;
          const nextItemSnapshot: PcnSampleRouteItemSnapshot = {
            ...(currentItem || {}),
            status: nextItemRoute.status,
            execution: buildPcnRemoteExecutionSnapshot(currentItem.execution || route.execution, mapped.execution),
            ...(nextItemRoute.sentAt ? { sentAt: nextItemRoute.sentAt } : {}),
            ...(nextItemRoute.receivedAt ? { receivedAt: nextItemRoute.receivedAt } : {}),
            ...(nextItemRoute.resultReturnedAt ? { resultReturnedAt: nextItemRoute.resultReturnedAt } : {}),
            ...(nextItemRoute.returnedAt ? { returnedAt: nextItemRoute.returnedAt } : {}),
            ...(mapped.note ? { note: mapped.note } : {}),
          };
          const feedback = mapped.sampleFeedback?.find((entry) => entry.pcnSampleItemId === sampleItemId);
          if (feedback) {
            Object.assign(nextItemSnapshot, {
              ...(feedback.labSampleCode ? { labSampleCode: feedback.labSampleCode } : {}),
              ...(feedback.sampleConditionCode ? { sampleConditionCode: feedback.sampleConditionCode } : {}),
              ...(feedback.sampleConditionNote ? { sampleConditionNote: feedback.sampleConditionNote } : {}),
              ...(feedback.receivedQuantity !== undefined ? { receivedQuantity: feedback.receivedQuantity } : {}),
              ...(feedback.receivedUnit ? { receivedUnit: feedback.receivedUnit } : {}),
              ...(feedback.receivedAt ? { receivedAt: feedback.receivedAt } : {}),
              ...(feedback.receivedBy ? { receivedBy: feedback.receivedBy } : {}),
            });
          }
          itemSnapshots[sampleItemId] = nextItemSnapshot;
        }
        nextRoute = projectPcnSampleRouteFromItemSnapshots({ ...route, itemSnapshots, updatedAt: now }, sampleItems);
      } else {
        if (mapped.routeStatus) nextRoute = applyPcnRemoteRouteStatus(nextRoute, mapped.routeStatus, now);
        const nextExecution = buildPcnRemoteExecutionSnapshot(route.execution, mapped.execution);
        nextRoute = {
          ...nextRoute,
          execution: nextExecution,
          ...(mapped.note ? { note: mapped.note } : {}),
          updatedAt: now,
        };
      }

      const siblingRoutesResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1
         ORDER BY document_id FOR UPDATE`,
        [lot.id],
      );
      const siblingRoutes = siblingRoutesResult.rows
        .map(mapDocumentRow)
        .map((item: PcnSampleRoute) => (item.id === nextRoute.id ? nextRoute : item)) as PcnSampleRoute[];
      const nextLot: PcnSampleLot = { ...lot, ...derivePcnSampleLotStatus(siblingRoutes, sampleItems), updatedAt: now };

      let nextRequest = request;
      if (request) {
        const targetPycStatus = mapped.routeStatus ? getPcnLabRequestStatusForSampleRoute(mapped.routeStatus) : null;
        if (targetPycStatus && request.status !== targetPycStatus) {
          nextRequest = applyPcnRemoteLabRequestStatus(request, targetPycStatus, now);
        }
        nextRequest = {
          ...nextRequest,
          integration: {
            ...(request.integration || {}),
            targetSystemCode: sourceSystemCode,
            syncStatus: 'ACKNOWLEDGED',
            externalRequestId: eventInput.externalRequestId,
            ...(eventInput.externalRequestCode ? { externalRequestCode: eventInput.externalRequestCode } : {}),
            lastExternalSequence: Math.max(Number(request.integration?.lastExternalSequence || 0), eventInput.externalSequence),
            lastSyncedAt: now,
            lastErrorCode: undefined,
            lastErrorMessage: undefined,
          },
          updatedAt: now,
        };
      }

      const event = buildPcnSampleFlowEvent(
        {
          id: eventId,
          sampleLotId: lot.id,
          routeId: nextRoute.id,
          ...(nextRequest ? { labRequestId: nextRequest.id } : {}),
          idempotencyFingerprint: buildPcnLabBodySha256(body),
          sourceSystemCode,
          externalEventId: eventInput.externalEventId,
          externalRequestId: eventInput.externalRequestId,
          externalSequence: eventInput.externalSequence,
          ...(eventSampleItemIds.length ? { sampleItemIds: eventSampleItemIds } : {}),
          ...(mapped.sampleFeedback?.length ? { sampleFeedback: mapped.sampleFeedback } : {}),
          type: mapped.internalEventType,
          fromStatus: route.status,
          toStatus: nextRoute.status,
          location: nextLot.currentLocation,
          note: mapped.note || (mapped.issueCode ? `Sự cố ${mapped.issueCode}` : undefined),
          actorUsername: `integration:${sourceSystemCode}`,
        },
        eventInput.occurredAt,
      );

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [event.id, JSON.stringify(getDocumentPayload(event))],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1`,
        [nextRoute.id, JSON.stringify(getDocumentPayload(nextRoute))],
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'pcnSampleLots' AND document_id = $1`,
        [nextLot.id, JSON.stringify(getDocumentPayload(nextLot))],
      );
      if (nextRequest) {
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'labRequests' AND document_id = $1`,
          [nextRequest.id, JSON.stringify(getDocumentPayload(nextRequest))],
        );
        await updatePcnSampleRequestBundleDispatch(client, nextRequest.id, {
          status: mapped.issueCode ? 'RECONCILE_REQUIRED' : 'ACKNOWLEDGED',
          request: nextRequest,
          now,
        });
      }
      const nextDossier: CertificationDossier = {
        ...dossier,
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
      );

      const activity = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-lab-webhook', eventId),
        action: 'STATUS_CHANGED',
        entityType: 'PCN_SAMPLE_LOT',
        entityId: lot.id,
        entityLabel: lot.lotCode,
        actorUsername: `integration:${sourceSystemCode}`,
        actorName: `App phòng thử ${sourceSystemCode}`,
        summary: `Nhận webhook ${eventInput.eventType} cho tuyến ${route.labName}`,
        source: 'SYSTEM',
        groupId: lot.id,
        idempotencyKey: eventInput.externalEventId,
        idempotencyFingerprint: buildPcnLabBodySha256(body),
        changes: diffActivityFields(route, nextRoute, ['status', 'execution', 'note']),
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))],
      );

      return {
        event,
        route: nextRoute,
        lot: nextLot,
        dossier: nextDossier,
        ...(nextRequest ? { request: nextRequest } : {}),
        activityLogs: [activity],
        idempotent: false,
      };
    });

    return jsonOk(result);
  } catch (error: any) {
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode) || (message.includes('Không tìm thấy') ? 404 : 400);
    return jsonBadRequest(message, { status: statusCode });
  }
}
