import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonServerError,
  jsonUnauthorized,
} from '@/lib/server/response';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnSampleLot,
  PcnSampleRoute,
  PcnSampleItem,
} from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields, isValidActivityTimestamp } from '@/utils/activityLog';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { sanitizePcnPathSegment } from '@/lib/server/storage';
import {
  buildPcnSampleFlowEvent,
  derivePcnSampleLotStatus,
  getPcnSampleRouteStartDenial,
  transitionPcnSampleRoute,
} from '@/utils/pcnSampleFlow';
import {
  buildPcnLabDispatchPayload,
  canonicalizePcnLabIntegrationPayload,
  type PcnLabDispatchPayload,
} from '@/utils/pcnLabIntegration';
import {
  buildPcnLabBodySha256,
  buildPcnLabHmacSignature,
  getPcnLabIntegrationConfig,
  getPcnLabIntegrationSecret,
  getPcnLabIntegrationTimeoutMs,
  updatePcnSampleRequestBundleDispatch,
  type PcnLabIntegrationConfig,
} from '@/lib/server/pcn-samples';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Gửi PYC sang app phòng thử chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const sessionActor = getPcnSessionUser(req);
  if (!sessionActor) {
    return jsonUnauthorized('Phiên PCN không còn hợp lệ.');
  }

  const { requestId: rawRequestId } = await params;
  const requestId = String(rawRequestId || '').trim();
  if (!isSafePcnSampleKey(requestId)) {
    return jsonBadRequest('Mã PYC không hợp lệ.');
  }

  let dispatchContext: {
    request: OutboundLabRequest;
    route: PcnSampleRoute;
    lot: PcnSampleLot;
    sampleItems: PcnSampleItem[];
    dossier: CertificationDossier;
    proposal?: CertificationProposal;
    payload: PcnLabDispatchPayload;
    config: PcnLabIntegrationConfig;
    secret: string;
    bodySha256: string;
  } | null = null;

  try {
    dispatchContext = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [requestId]
      );
      if (!requestResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC cần gửi sang app phòng thử.'), { statusCode: 404 });
      }
      const request = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
      if (!request.sampleRouteId || !request.sampleLotId) {
        throw Object.assign(new Error('PYC phải liên kết đủ với một tuyến và lô mẫu trước khi gửi.'), {
          statusCode: 409,
        });
      }
      if (request.integration?.syncStatus === 'ACKNOWLEDGED' && request.integration.externalRequestId) {
        const [routeResult, lotResult, sampleItemsResult, dossierResult] = await Promise.all([
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 LIMIT 1`,
            [request.sampleRouteId]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = $1 LIMIT 1`,
            [request.sampleLotId]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleItems' AND data->>'sampleLotId' = $1 ORDER BY document_id`,
            [request.sampleLotId]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
            [request.dossierId]
          ),
        ]);
        if (!routeResult.rows[0] || !lotResult.rows[0] || !dossierResult.rows[0]) {
          throw Object.assign(new Error('PYC đã ACK nhưng thiếu snapshot liên kết để trả kết quả.'), {
            statusCode: 409,
          });
        }
        return {
          request,
          route: mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute,
          lot: mapDocumentRow(lotResult.rows[0]) as PcnSampleLot,
          sampleItems: sampleItemsResult.rows.map(mapDocumentRow) as PcnSampleItem[],
          dossier: mapDocumentRow(dossierResult.rows[0]) as CertificationDossier,
          payload: null as unknown as PcnLabDispatchPayload,
          config: null as unknown as PcnLabIntegrationConfig,
          secret: '',
          bodySha256: '',
        };
      }

      const lotResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleLots' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [request.sampleLotId]
      );
      const routeResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 AND data->>'sampleLotId' = $2
         LIMIT 1 FOR UPDATE`,
        [request.sampleRouteId, request.sampleLotId]
      );
      if (!lotResult.rows[0] || !routeResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy tuyến/lô mẫu liên kết với PYC.'), { statusCode: 404 });
      }
      const lot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;
      const route = mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute;
      const sampleItemsResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleItems' AND data->>'sampleLotId' = $1
         ORDER BY document_id`,
        [request.sampleLotId]
      );
      const sampleItems = sampleItemsResult.rows.map(mapDocumentRow) as PcnSampleItem[];
      if (
        lot.dossierId !== request.dossierId ||
        route.sampleLotId !== lot.id ||
        route.labRequestId !== request.id
      ) {
        throw Object.assign(new Error('Liên kết PYC, tuyến, lô mẫu và hồ sơ không nhất quán.'), {
          statusCode: 409,
        });
      }
      if (!['DRAFT', 'SENT'].includes(request.status) || !['PENDING', 'SENT'].includes(route.status)) {
        throw Object.assign(new Error('Chỉ PYC/tuyến đang nháp hoặc chờ gửi mới được dispatch.'), {
          statusCode: 409,
        });
      }

      const siblingRoutesResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1
         ORDER BY document_id FOR UPDATE`,
        [lot.id]
      );
      const siblingRoutes = siblingRoutesResult.rows.map(mapDocumentRow) as PcnSampleRoute[];
      const routeStartDenial = getPcnSampleRouteStartDenial(route, siblingRoutes, sampleItems);
      if (routeStartDenial) throw Object.assign(new Error(routeStartDenial), { statusCode: 409 });

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [request.dossierId]
      );
      if (!dossierResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ của PYC cần gửi.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      const proposalResult = dossier.proposalId
        ? await client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationProposals' AND document_id = $1 LIMIT 1`,
            [dossier.proposalId]
          )
        : { rows: [] };
      const proposal = proposalResult.rows[0]
        ? (mapDocumentRow(proposalResult.rows[0]) as CertificationProposal)
        : undefined;

      const config = getPcnLabIntegrationConfig(route.labCode);
      if (!config) {
        throw Object.assign(new Error(`Chưa cấu hình app phòng thử ${route.labCode}.`), { statusCode: 503 });
      }
      const secret = getPcnLabIntegrationSecret(config);
      const idempotencyKey = `PCN:${route.id}:${request.id}:v1`;
      const messageId = `pcn-dispatch-${sanitizePcnPathSegment(route.id)}-${sanitizePcnPathSegment(request.id)}-v1`;
      const sentAt = request.integration?.lastAttemptAt || new Date().toISOString();
      const payload = buildPcnLabDispatchPayload({
        request,
        lot,
        sampleItems,
        route,
        dossier,
        proposal,
        targetSystemCode: config.systemCode,
        messageId,
        idempotencyKey,
        sentAt,
        initiatedBy: {
          username: sessionActor.username,
          name: sessionActor.name,
          role: sessionActor.role,
          position: sessionActor.position,
          sourceSystem: 'PCN',
        },
      });
      const bodySha256 = buildPcnLabBodySha256(payload);
      const now = new Date().toISOString();
      const pendingRequest: OutboundLabRequest = {
        ...request,
        integration: {
          ...(request.integration || {}),
          targetSystemCode: config.systemCode,
          syncStatus: 'PENDING',
          idempotencyKey,
          payloadFingerprint: bodySha256,
          lastAttemptAt: sentAt,
          lastErrorCode: undefined,
          lastErrorMessage: undefined,
        },
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'labRequests' AND document_id = $1`,
        [request.id, JSON.stringify(getDocumentPayload(pendingRequest))]
      );
      return {
        request: pendingRequest,
        route,
        lot,
        sampleItems,
        dossier,
        ...(proposal ? { proposal } : {}),
        payload,
        config,
        secret,
        bodySha256,
      };
    });

    if (!dispatchContext.payload) {
      return jsonOk({ ...dispatchContext, activityLogs: [], idempotent: true });
    }

    const remotePath = dispatchContext.config.requestPath || '/api/integrations/v1/lab-requests';
    const timestamp = String(Math.floor(Date.now() / 1000));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getPcnLabIntegrationTimeoutMs());
    let ack: any;
    try {
      const response = await fetch(new URL(remotePath, `${dispatchContext.config.baseUrl}/`), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-pcn-timestamp': timestamp,
          'x-pcn-message-id': dispatchContext.payload.messageId,
          'x-pcn-signature': `sha256=${buildPcnLabHmacSignature({
            secret: dispatchContext.secret,
            method: 'POST',
            path: remotePath,
            timestamp,
            messageId: dispatchContext.payload.messageId,
            bodySha256: dispatchContext.bodySha256,
          })}`,
        },
        body: canonicalizePcnLabIntegrationPayload(dispatchContext.payload),
      });
      if (!response.ok) {
        throw Object.assign(new Error(`REMOTE_HTTP_${response.status}`), { code: `REMOTE_HTTP_${response.status}` });
      }
      try {
        ack = await response.json();
      } catch {
        throw Object.assign(new Error('REMOTE_INVALID_ACK'), { code: 'REMOTE_INVALID_ACK' });
      }
      const accepted =
        ack &&
        ack.accepted === true &&
        String(ack.contractVersion || '') === '1' &&
        String(ack.sourceSystem || '').toUpperCase() === 'PCN' &&
        String(ack.targetSystem || '').toUpperCase() === dispatchContext.config.systemCode &&
        String(ack.messageId || '') === dispatchContext.payload.messageId &&
        String(ack.idempotencyKey || '') === dispatchContext.payload.idempotencyKey &&
        String(ack.externalRequestId || '').trim() &&
        String(ack.externalRequestCode || '').trim() &&
        ['RECEIVED', 'SCHEDULED', 'IN_PROGRESS'].includes(String(ack.status || '').toUpperCase()) &&
        isValidActivityTimestamp(ack.acceptedAt);
      if (!accepted) {
        throw Object.assign(new Error('REMOTE_ACK_REJECTED'), { code: 'REMOTE_ACK_REJECTED' });
      }
    } finally {
      clearTimeout(timeout);
    }

    const result = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [requestId]
      );
      if (!requestResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC sau khi app phòng thử ACK.'), { statusCode: 404 });
      }
      const currentRequest = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
      if (currentRequest.integration?.payloadFingerprint !== dispatchContext!.bodySha256) {
        throw Object.assign(
          new Error('Payload PYC đã thay đổi trong lúc chờ app phòng thử ACK; cần đồng bộ lại.'),
          { statusCode: 409 }
        );
      }
      const routeResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [currentRequest.sampleRouteId]
      );
      const lotResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [currentRequest.sampleLotId]
      );
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
        [currentRequest.dossierId]
      );
      if (!routeResult.rows[0] || !lotResult.rows[0] || !dossierResult.rows[0]) {
        throw Object.assign(new Error('Thiếu snapshot PYC sau khi ACK.'), { statusCode: 409 });
      }
      const route = mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute;
      const lot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      const now = new Date().toISOString();
      const nextRoute = route.status === 'PENDING' ? transitionPcnSampleRoute(route, 'SENT', {}, now) : route;
      const nextRequest: OutboundLabRequest = {
        ...currentRequest,
        status: currentRequest.status === 'DRAFT' ? 'SENT' : currentRequest.status,
        integration: {
          ...(currentRequest.integration || {}),
          targetSystemCode: dispatchContext!.config.systemCode,
          syncStatus: 'ACKNOWLEDGED',
          externalRequestId: String(ack.externalRequestId).trim(),
          externalRequestCode: String(ack.externalRequestCode).trim(),
          ...(String(ack.externalLotCode || '').trim()
            ? { externalLotCode: String(ack.externalLotCode).trim() }
            : {}),
          acknowledgedAt: String(ack.acceptedAt).trim(),
          lastSyncedAt: now,
          lastErrorCode: undefined,
          lastErrorMessage: undefined,
        },
        updatedAt: now,
      };
      const siblingRoutesResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1
         ORDER BY document_id FOR UPDATE`,
        [lot.id]
      );
      const siblingRoutes = siblingRoutesResult.rows
        .map(mapDocumentRow)
        .map((item: PcnSampleRoute) => (item.id === nextRoute.id ? nextRoute : item)) as PcnSampleRoute[];
      const nextLot: PcnSampleLot = { ...lot, ...derivePcnSampleLotStatus(siblingRoutes), updatedAt: now };
      const event = buildPcnSampleFlowEvent(
        {
          id: stablePcnMutationId('pcn-sample-event-dispatch', currentRequest.id),
          sampleLotId: lot.id,
          routeId: nextRoute.id,
          labRequestId: currentRequest.id,
          idempotencyFingerprint: dispatchContext!.bodySha256,
          type: 'SENT_TO_LAB',
          fromStatus: route.status,
          toStatus: nextRoute.status,
          location: nextLot.currentLocation,
          note: `Đã gửi PYC ${currentRequest.pycNumber} sang app ${dispatchContext!.config.systemCode}`,
          actorUsername: sessionActor.username,
        },
        now
      );
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO NOTHING`,
        [event.id, JSON.stringify(getDocumentPayload(event))]
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1`,
        [nextRoute.id, JSON.stringify(getDocumentPayload(nextRoute))]
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'pcnSampleLots' AND document_id = $1`,
        [nextLot.id, JSON.stringify(getDocumentPayload(nextLot))]
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'labRequests' AND document_id = $1`,
        [nextRequest.id, JSON.stringify(getDocumentPayload(nextRequest))]
      );
      const activity = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-lab-dispatch', currentRequest.id),
        action: 'STATUS_CHANGED',
        entityType: 'PCN_LAB_REQUEST',
        entityId: currentRequest.id,
        entityLabel: currentRequest.pycNumber,
        actorUsername: sessionActor.username,
        actorName: sessionActor.name,
        actorRole: (sessionActor.systemRole || sessionActor.role) as any,
        summary: `Gửi PYC sang app phòng thử ${dispatchContext!.config.systemCode} và nhận ACK`,
        source: 'UI',
        groupId: dossier.id,
        changes: diffActivityFields(currentRequest, nextRequest, ['status', 'integration']),
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))]
      );
      await updatePcnSampleRequestBundleDispatch(client, currentRequest.id, {
        status: 'ACKNOWLEDGED',
        request: nextRequest,
        now,
      });
      return {
        request: nextRequest,
        dossier,
        lot: nextLot,
        route: nextRoute,
        activityLogs: [activity],
        idempotent: false,
      };
    });

    return jsonOk(result);
  } catch (error: any) {
    const errorCode = String(error?.code || (error?.name === 'AbortError' ? 'REMOTE_TIMEOUT' : 'REMOTE_UNAVAILABLE'));
    try {
      await withPgTransaction(async (client) => {
        const requestResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = $1 LIMIT 1 FOR UPDATE`,
          [requestId]
        );
        if (!requestResult.rows[0]) return;
        const request = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
        const nextRequest: OutboundLabRequest = {
          ...request,
          integration: {
            ...(request.integration || {}),
            targetSystemCode: request.integration?.targetSystemCode || '',
            syncStatus: 'ERROR',
            lastErrorCode: errorCode,
            lastErrorMessage:
              errorCode === 'REMOTE_TIMEOUT'
                ? 'App phòng thử không phản hồi trong thời hạn.'
                : 'Không thể nhận ACK hợp lệ từ app phòng thử.',
            lastSyncedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'labRequests' AND document_id = $1`,
          [request.id, JSON.stringify(getDocumentPayload(nextRequest))]
        );
        await updatePcnSampleRequestBundleDispatch(client, request.id, {
          status: 'ERROR',
          request: nextRequest,
          errorCode,
          errorMessage: nextRequest.integration?.lastErrorMessage,
          now: nextRequest.updatedAt,
        });
      });
    } catch (persistError) {
      console.error('PCN lab dispatch error-state persistence failed:', persistError);
    }
    console.error('PCN lab dispatch error:', error);
    const statusCode = Number(error?.statusCode) || 502;
    const errorMessage =
      errorCode === 'REMOTE_TIMEOUT'
        ? 'App phòng thử không phản hồi trong thời hạn.'
        : 'Gửi PYC sang app phòng thử không thành công.';
    return Response.json({ error: errorMessage, code: errorCode }, { status: statusCode });
  }
}
