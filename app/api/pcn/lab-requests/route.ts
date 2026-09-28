import { NextRequest } from 'next/server';
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
  PcnSampleLot,
  PcnSampleRoute,
} from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossiers';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { buildPcnLabRequest, type PcnLabRequestDraft } from '@/utils/pcnLabRouting';
import { samePcnLabRequestCreation, normalizePcnSampleList } from '@/lib/server/pcn-samples';
import { buildPcnSampleFlowEvent } from '@/utils/pcnSampleFlow';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canCreatePcnLabRequest } from '@/utils/pcnWorkflowStages';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Tạo PYC PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const rawRequest = body.request;
  if (!rawRequest || typeof rawRequest !== 'object' || Array.isArray(rawRequest)) {
    return jsonBadRequest('Thiếu dữ liệu PYC gửi PTN.');
  }

  const requestId = String(rawRequest.id || '').trim();
  const dossierId = String(rawRequest.dossierId || '').trim();
  const fieldCode = String(rawRequest.fieldCode || '').trim().toUpperCase();
  const incomingStatus = String(rawRequest.status || 'DRAFT').trim().toUpperCase();

  if (!isSafePcnSampleKey(requestId) || !dossierId || !fieldCode || !['DRAFT', ''].includes(incomingStatus)) {
    return jsonBadRequest('PYC phải có định danh, hồ sơ, Lĩnh vực hợp lệ và trạng thái Bản nháp.');
  }

  const actor = getPcnSessionUser(req)!;

  try {
    const result = await withPgTransaction(async (client) => {
      const now = new Date().toISOString();
      const request = buildPcnLabRequest(
        {
          ...rawRequest,
          id: requestId,
          dossierId,
          fieldCode,
          status: 'DRAFT',
        } as PcnLabRequestDraft,
        now
      );

      const sampleLotId = String(request.sampleLotId || '').trim();
      const sampleRouteId = String(request.sampleRouteId || '').trim();
      if (Boolean(sampleLotId) !== Boolean(sampleRouteId)) {
        throw Object.assign(new Error('PYC chỉ được gắn lô mẫu khi có đủ cả mã lô và tuyến phòng thử.'), {
          statusCode: 400,
        });
      }
      if (!sampleLotId || !sampleRouteId) {
        throw Object.assign(new Error('Mỗi PYC mới phải tương ứng đúng một lô mẫu và một tuyến phòng thử.'), {
          statusCode: 400,
        });
      }

      let linkedLot: PcnSampleLot | undefined;
      let linkedRoute: PcnSampleRoute | undefined;
      if (sampleRouteId) {
        const lotResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleLots' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [sampleLotId]
        );
        if (!lotResult.rows[0]) {
          throw Object.assign(new Error('Không tìm thấy lô mẫu để gắn vào PYC.'), { statusCode: 404 });
        }
        linkedLot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;
        if (linkedLot.dossierId !== dossierId) {
          throw Object.assign(new Error('Lô mẫu gắn vào PYC không thuộc hồ sơ.'), { statusCode: 400 });
        }
        const routeResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1 AND data->>'sampleLotId' = $2
           LIMIT 1 FOR UPDATE`,
          [sampleRouteId, sampleLotId]
        );
        if (!routeResult.rows[0]) {
          throw Object.assign(new Error('Không tìm thấy tuyến mẫu để gắn vào PYC.'), { statusCode: 404 });
        }
        linkedRoute = mapDocumentRow(routeResult.rows[0]) as PcnSampleRoute;
        if (!linkedRoute.sampleItemIds?.length) {
          throw Object.assign(new Error('PYC nội bộ chỉ được gắn vào tuyến đã xác định rõ mẫu thử.'), {
            statusCode: 409,
          });
        }
        if (
          linkedRoute.labName.trim().toLocaleLowerCase('vi-VN') !==
          request.laboratoryName.trim().toLocaleLowerCase('vi-VN')
        ) {
          throw Object.assign(new Error('Phòng thử nghiệm của PYC phải khớp với tuyến mẫu được chọn.'), {
            statusCode: 400,
          });
        }
      }

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      if (!dossierResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ PCN để tạo PYC.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi tạo PYC.'), {
          statusCode: 409,
        });
      }
      assertPcnDossierOperator(dossier, actor);
      const dossierFieldCodes = normalizePcnSampleList(dossier.fieldCodes);
      if (!dossierFieldCodes.includes(fieldCode)) {
        throw Object.assign(new Error('Lĩnh vực PYC phải thuộc hồ sơ PCN.'), { statusCode: 400 });
      }
      if (!canCreatePcnLabRequest(dossier)) {
        throw Object.assign(new Error('Hồ sơ chưa đến bước lấy mẫu & gửi PTN để tạo PYC.'), { statusCode: 409 });
      }

      const existingResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [request.id]
      );
      if (existingResult.rows[0]) {
        const existingRequest = mapDocumentRow(existingResult.rows[0]) as OutboundLabRequest;
        if (!samePcnLabRequestCreation(existingRequest, request)) {
          throw Object.assign(
            new Error(`PYC ${request.pycNumber} đã tồn tại nhưng payload không giống yêu cầu retry.`),
            { statusCode: 409 }
          );
        }
        if (!(dossier.labRequestIds || []).includes(request.id)) {
          throw Object.assign(
            new Error(`PYC ${request.pycNumber} đã tồn tại nhưng thiếu backlink trong hồ sơ.`),
            { statusCode: 409 }
          );
        }
        if (linkedRoute && linkedRoute.labRequestId && linkedRoute.labRequestId !== request.id) {
          throw Object.assign(new Error('Tuyến mẫu đã được gắn với PYC khác.'), { statusCode: 409 });
        }
        return {
          request: existingRequest,
          dossier,
          ...(linkedLot ? { lot: linkedLot } : {}),
          ...(linkedRoute ? { route: linkedRoute } : {}),
          activityLogs: [],
          idempotent: true,
        };
      }

      if (!request.pycNumber.trim() || !request.laboratoryName.trim()) {
        throw Object.assign(new Error('PYC phải có số PYC và phòng thử nghiệm nhận.'), { statusCode: 400 });
      }

      const duplicatePycResult = await client.query(
        `SELECT document_id FROM app_documents
         WHERE collection_name = 'labRequests' AND LOWER(data->>'pycNumber') = LOWER($1)
         LIMIT 1`,
        [request.pycNumber]
      );
      if (duplicatePycResult.rows[0]) {
        throw Object.assign(new Error(`Số PYC ${request.pycNumber} đã tồn tại.`), { statusCode: 409 });
      }
      if (linkedRoute) {
        if (linkedRoute.status !== 'PENDING') {
          throw Object.assign(new Error('Chỉ được gắn PYC mới vào tuyến mẫu đang chờ gửi.'), { statusCode: 409 });
        }
        if (linkedRoute.labRequestId) {
          throw Object.assign(new Error('Tuyến mẫu đã có PYC liên kết.'), { statusCode: 409 });
        }
      }

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('labRequests', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [request.id, JSON.stringify(getDocumentPayload(request))]
      );

      let nextRoute = linkedRoute;
      if (linkedRoute && linkedLot) {
        nextRoute = { ...linkedRoute, labRequestId: request.id, updatedAt: now };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1`,
          [nextRoute.id, JSON.stringify(getDocumentPayload(nextRoute))]
        );
        const linkEvent = buildPcnSampleFlowEvent(
          {
            id: stablePcnMutationId('pcn-sample-event-pyc-link', request.id),
            sampleLotId: linkedLot.id,
            routeId: nextRoute.id,
            labRequestId: request.id,
            type: 'UPDATED',
            location: linkedLot.currentLocation,
            note: `Liên kết PYC ${request.pycNumber} với tuyến ${nextRoute.labName}`,
            actorUsername: actor.username,
          },
          now
        );
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [linkEvent.id, JSON.stringify(getDocumentPayload(linkEvent))]
        );
      }

      const nextDossier: CertificationDossier = {
        ...dossier,
        labRequestIds: Array.from(new Set([...(dossier.labRequestIds || []), request.id])),
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
      );

      const activity = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-lab-request', request.id),
        action: 'CREATED',
        entityType: 'PCN_LAB_REQUEST',
        entityId: request.id,
        entityLabel: request.pycNumber,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: (actor.systemRole || actor.role) as any,
        summary: 'Tạo PYC gửi PTN và liên kết hồ sơ PCN',
        source: 'UI',
        groupId: request.dossierId,
        changes: diffActivityFields({}, request, [
          'pycNumber',
          'dossierId',
          'fieldCode',
          'laboratoryName',
          'sampleLotId',
          'sampleRouteId',
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

      return {
        request,
        dossier: nextDossier,
        ...(linkedLot ? { lot: linkedLot } : {}),
        ...(nextRoute ? { route: nextRoute } : {}),
        activityLogs: [activity],
        idempotent: false,
      };
    });

    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN lab request creation error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
