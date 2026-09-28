import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
  jsonServerError,
} from '@/lib/server/response';
import { requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { OutboundLabRequest, PcnSampleRoute, PcnSampleLot } from '@/types';
import { isSafePcnSampleKey } from '@/lib/server/pcn-signer-delegations';
import { sanitizePcnPathSegment } from '@/lib/server/storage';
import {
  PCN_LAB_INTEGRATION_CONTRACT_VERSION,
  canonicalizePcnLabIntegrationPayload,
} from '@/utils/pcnLabIntegration';
import {
  buildPcnLabBodySha256,
  buildPcnLabHmacSignature,
  getPcnLabIntegrationConfig,
  getPcnLabIntegrationSecret,
  getPcnLabIntegrationTimeoutMs,
  type PcnLabIntegrationConfig,
} from '@/lib/server/pcn-samples';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ requestId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Đồng bộ PYC chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const { requestId: rawRequestId } = await params;
  const requestId = String(rawRequestId || '').trim();
  if (!isSafePcnSampleKey(requestId)) {
    return jsonBadRequest('Mã PYC không hợp lệ.');
  }

  let request: OutboundLabRequest | undefined;
  let route: PcnSampleRoute | undefined;
  let lot: PcnSampleLot | undefined;
  let config: PcnLabIntegrationConfig | null = null;
  let secret = '';

  try {
    const context = await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [requestId]
      );
      if (!requestResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC cần đồng bộ.'), { statusCode: 404 });
      }
      const lockedRequest = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
      if (!lockedRequest.sampleRouteId || !lockedRequest.sampleLotId || !lockedRequest.integration?.externalRequestId) {
        throw Object.assign(
          new Error('PYC chưa có mã liên kết tại app phòng thử để đồng bộ.'),
          { statusCode: 409 }
        );
      }
      const [routeResult, lotResult] = await Promise.all([
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 LIMIT 1 FOR UPDATE`,
          [lockedRequest.sampleRouteId]
        ),
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = $1 LIMIT 1 FOR UPDATE`,
          [lockedRequest.sampleLotId]
        ),
      ]);
      if (!routeResult.rows[0] || !lotResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy tuyến hoặc lô mẫu của PYC.'), { statusCode: 404 });
      }
      const lockedRoute = mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute;
      const lockedLot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;
      if (
        lockedRoute.sampleLotId !== lockedLot.id ||
        lockedRoute.labRequestId !== lockedRequest.id ||
        lockedLot.dossierId !== lockedRequest.dossierId
      ) {
        throw Object.assign(new Error('Liên kết PYC, tuyến, lô mẫu và hồ sơ không nhất quán.'), {
          statusCode: 409,
        });
      }
      const resolvedConfig = getPcnLabIntegrationConfig(lockedRoute.labCode);
      if (!resolvedConfig) {
        throw Object.assign(new Error(`Chưa cấu hình app phòng thử ${lockedRoute.labCode}.`), { statusCode: 503 });
      }
      const resolvedSecret = getPcnLabIntegrationSecret(resolvedConfig);
      return {
        request: lockedRequest,
        route: lockedRoute,
        lot: lockedLot,
        config: resolvedConfig,
        secret: resolvedSecret,
      };
    });

    request = context.request;
    route = context.route;
    lot = context.lot;
    config = context.config;
    secret = context.secret;

    const externalRequestId = request.integration!.externalRequestId!;
    const remotePath =
      config.reconcilePath ||
      `/api/integrations/v1/lab-requests/${encodeURIComponent(externalRequestId)}/reconcile`;
    const messageId = `pcn-reconcile-${sanitizePcnPathSegment(route.id)}-${sanitizePcnPathSegment(request.id)}-v1`;
    const idempotencyKey = `PCN:${route.id}:${request.id}:reconcile:v1`;
    const reconcilePayload = {
      contractVersion: PCN_LAB_INTEGRATION_CONTRACT_VERSION,
      sourceSystem: 'PCN',
      targetSystem: config.systemCode,
      messageId,
      idempotencyKey,
      requestedAt: new Date().toISOString(),
      request: {
        pcnLabRequestId: request.id,
        pcnNumber: request.pycNumber,
        pcnRouteId: route.id,
        pcnLotId: lot.id,
        externalRequestId,
        sampleItemIds: route.sampleItemIds || lot.sampleItemIds || [],
      },
    };
    const bodySha256 = buildPcnLabBodySha256(reconcilePayload);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), getPcnLabIntegrationTimeoutMs());
    let remoteResponse: any;
    try {
      const response = await fetch(new URL(remotePath, `${config.baseUrl}/`), {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-pcn-timestamp': timestamp,
          'x-pcn-message-id': messageId,
          'x-pcn-signature': `sha256=${buildPcnLabHmacSignature({
            secret,
            method: 'POST',
            path: remotePath,
            timestamp,
            messageId,
            bodySha256,
          })}`,
        },
        body: canonicalizePcnLabIntegrationPayload(reconcilePayload),
      });
      if (!response.ok) {
        throw Object.assign(new Error(`REMOTE_HTTP_${response.status}`), { code: `REMOTE_HTTP_${response.status}` });
      }
      try {
        remoteResponse = await response.json();
      } catch {
        throw Object.assign(new Error('REMOTE_INVALID_RECONCILE_RESPONSE'), {
          code: 'REMOTE_INVALID_RECONCILE_RESPONSE',
        });
      }
    } finally {
      clearTimeout(timeout);
    }

    const remoteEvents = Array.isArray(remoteResponse?.statusEvents)
      ? remoteResponse.statusEvents
      : [remoteResponse?.statusEvent || remoteResponse?.event || remoteResponse?.latestEvent].filter(Boolean);
    const remoteSource = String(remoteResponse?.sourceSystem || config.systemCode).trim().toUpperCase();
    const remoteTarget = String(remoteResponse?.targetSystem || 'PCN').trim().toUpperCase();

    if (
      remoteResponse?.accepted !== true ||
      String(remoteResponse.contractVersion || '') !== PCN_LAB_INTEGRATION_CONTRACT_VERSION ||
      remoteSource !== config.systemCode ||
      remoteTarget !== 'PCN' ||
      String(remoteResponse.messageId || '') !== messageId ||
      String(remoteResponse.externalRequestId || externalRequestId).trim() !== externalRequestId ||
      !String(remoteResponse.externalRequestCode || request.integration?.externalRequestCode || '').trim() ||
      remoteEvents.length === 0 ||
      remoteEvents.some((event: unknown) => !event || typeof event !== 'object' || Array.isArray(event))
    ) {
      throw Object.assign(new Error('REMOTE_RECONCILE_REJECTED'), { code: 'REMOTE_RECONCILE_REJECTED' });
    }

    const eventBodies = remoteEvents.map((remoteEvent: Record<string, unknown>, index: number) => {
      const externalEventId = String(
        remoteEvent.externalEventId ||
          `${externalRequestId}:reconcile:${index + 1}:${String(remoteEvent.externalSequence || 'latest')}`
      ).trim();
      const externalRequestIdFromEvent = String(remoteEvent.externalRequestId || externalRequestId).trim();
      if (externalRequestIdFromEvent !== externalRequestId) {
        throw Object.assign(new Error('REMOTE_RECONCILE_EVENT_REQUEST_MISMATCH'), {
          code: 'REMOTE_RECONCILE_EVENT_REQUEST_MISMATCH',
        });
      }
      const externalSequence = Number(remoteEvent.externalSequence);
      if (!Number.isInteger(externalSequence) || externalSequence < 1) {
        throw Object.assign(new Error('REMOTE_RECONCILE_EVENT_SEQUENCE_INVALID'), {
          code: 'REMOTE_RECONCILE_EVENT_SEQUENCE_INVALID',
        });
      }
      return {
        ...remoteEvent,
        sourceSystemCode: config!.systemCode,
        externalEventId,
        externalRequestId,
        externalRequestCode:
          String(remoteResponse.externalRequestCode || request!.integration?.externalRequestCode || '').trim() ||
          undefined,
        pcnRouteId: route!.id,
        pcnLabRequestId: request!.id,
        pcnSampleItemIds: Array.isArray(remoteEvent.pcnSampleItemIds)
          ? remoteEvent.pcnSampleItemIds.map((v: unknown) => String(v).trim()).filter(Boolean)
          : undefined,
      };
    });

    const localWebhookUrl = new URL('/api/pcn/integrations/lab-status-events', req.url).toString();
    const localPayloads: any[] = [];
    for (const eventBody of eventBodies) {
      const eventMessageId = `pcn-reconcile-event-${sanitizePcnPathSegment(route.id)}-${sanitizePcnPathSegment(
        request.id
      )}-${sanitizePcnPathSegment(String(eventBody.externalEventId))}`.slice(0, 180);
      const eventTimestamp = String(Math.floor(Date.now() / 1000));
      const eventBodySha256 = buildPcnLabBodySha256(eventBody);
      const localWebhookResponse = await fetch(localWebhookUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-pcn-timestamp': eventTimestamp,
          'x-pcn-message-id': eventMessageId,
          'x-pcn-signature': `sha256=${buildPcnLabHmacSignature({
            secret,
            method: 'POST',
            path: '/api/pcn/integrations/lab-status-events',
            timestamp: eventTimestamp,
            messageId: eventMessageId,
            bodySha256: eventBodySha256,
          })}`,
        },
        body: canonicalizePcnLabIntegrationPayload(eventBody),
      });
      const localPayload = await localWebhookResponse.json().catch(() => ({}));
      if (!localWebhookResponse.ok) {
        throw Object.assign(
          new Error(String(localPayload?.error || 'RECONCILE_WEBHOOK_APPLY_FAILED')),
          { code: String(localPayload?.code || 'RECONCILE_WEBHOOK_APPLY_FAILED'), statusCode: localWebhookResponse.status }
        );
      }
      localPayloads.push(localPayload);
    }

    const lastPayload = localPayloads.at(-1) || {};
    return jsonOk({
      ...lastPayload,
      reconciled: true,
      reconciledEvents: localPayloads.length,
      externalRequestCode: String(
        remoteResponse.externalRequestCode || request.integration?.externalRequestCode
      ).trim(),
    });
  } catch (error: any) {
    const errorCode = String(error?.code || (error?.name === 'AbortError' ? 'REMOTE_TIMEOUT' : 'REMOTE_UNAVAILABLE'));
    try {
      await withPgTransaction(async (client) => {
        const requestResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = $1 LIMIT 1 FOR UPDATE`,
          [requestId]
        );
        if (!requestResult.rows[0]) return;
        const currentRequest = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
        const nextRequest: OutboundLabRequest = {
          ...currentRequest,
          integration: {
            ...(currentRequest.integration || {}),
            targetSystemCode: currentRequest.integration?.targetSystemCode || config?.systemCode || '',
            syncStatus: 'ERROR',
            lastErrorCode: errorCode,
            lastErrorMessage:
              errorCode === 'REMOTE_TIMEOUT'
                ? 'App phòng thử không phản hồi trong thời hạn.'
                : 'Không thể đồng bộ trạng thái từ app phòng thử.',
            lastSyncedAt: new Date().toISOString(),
          },
          updatedAt: new Date().toISOString(),
        };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'labRequests' AND document_id = $1`,
          [requestId, JSON.stringify(getDocumentPayload(nextRequest))]
        );
      });
    } catch (persistError) {
      console.error('PCN lab reconcile error-state persistence failed:', persistError);
    }
    console.error('PCN lab reconcile error:', error);
    const statusCode = Number(error?.statusCode) || 502;
    const errorMessage =
      errorCode === 'REMOTE_TIMEOUT'
        ? 'App phòng thử không phản hồi trong thời hạn.'
        : 'Đồng bộ trạng thái PYC không thành công.';
    return Response.json({ error: errorMessage, code: errorCode }, { status: statusCode });
  }
}
