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
  PcnSampleLot,
  PcnSampleItem,
  PcnSampleRoute,
  PcnSampleLabCode,
} from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossiers';
import { isSafePcnSampleKey } from '@/lib/server/pcn-signer-delegations';
import { sanitizePcnPathSegment } from '@/lib/server/storage';
import { getPcnVietnamYearKey, formatPcnSampleLotCode } from '@/utils/pcnIdentifier';
import {
  buildPcnSampleLot,
  buildPcnSampleFlowEvent,
  type PcnSampleLotDraft,
} from '@/utils/pcnSampleFlow';
import {
  normalizePcnSampleLabCodes,
  normalizePcnSampleList,
  samePcnSampleLotCreation,
} from '@/lib/server/pcn-samples';
import { canCreatePcnLabRequest } from '@/utils/pcnWorkflowStages';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Tạo lô mẫu PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const draft = body.draft;
  if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
    return jsonBadRequest('Thiếu dữ liệu lô mẫu PCN.');
  }

  const draftId = String(draft.id || '').trim();
  const dossierId = String(draft.dossierId || '').trim();
  if (!isSafePcnSampleKey(draftId) || !dossierId) {
    return jsonBadRequest('Lô mẫu phải có định danh an toàn và mã hồ sơ.');
  }

  let requestedLabCodes: PcnSampleLabCode[];
  try {
    requestedLabCodes = normalizePcnSampleLabCodes(draft.labCodes);
  } catch (error: any) {
    return jsonBadRequest(String(error?.message || error));
  }
  if (requestedLabCodes.length === 0) {
    return jsonBadRequest('Lô mẫu phải có ít nhất một phòng thử nghiệm nhận mẫu.');
  }

  const actor = getPcnSessionUser(req)!;

  try {
    const result = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      if (dossierResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ PCN để tạo lô mẫu.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(
          new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi tạo lô mẫu.'),
          { statusCode: 409 }
        );
      }
      assertPcnDossierOperator(dossier, actor);
      const dossierFieldCodes = normalizePcnSampleList(dossier.fieldCodes);
      if (dossierFieldCodes.length === 0) {
        throw Object.assign(new Error('Hồ sơ PCN chưa có Lĩnh vực để kiểm tra lô mẫu.'), { statusCode: 409 });
      }
      const requestedFieldCodes = normalizePcnSampleList(draft.fieldCodes);
      if (requestedFieldCodes.length === 0) {
        throw Object.assign(new Error('Lô mẫu phải có ít nhất một Lĩnh vực thuộc hồ sơ PCN.'), { statusCode: 400 });
      }
      if (requestedFieldCodes.some((code) => !dossierFieldCodes.includes(code))) {
        throw Object.assign(new Error('Lĩnh vực của lô mẫu phải thuộc hồ sơ PCN.'), { statusCode: 400 });
      }

      const existingLotResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleLots' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [draftId]
      );
      if (existingLotResult.rows.length > 0) {
        const existingLot = mapDocumentRow(existingLotResult.rows[0]) as PcnSampleLot;
        const now = new Date().toISOString();
        const { lot: requestedLot, items: requestedItems, routes: requestedRoutes } = buildPcnSampleLot(
          {
            ...draft,
            id: draftId,
            dossierId,
            lotCode: existingLot.lotCode,
            fieldCodes: requestedFieldCodes,
            labCodes: requestedLabCodes,
          } as PcnSampleLotDraft,
          now
        );
        if (!samePcnSampleLotCreation(existingLot, requestedLot)) {
          throw Object.assign(
            new Error(`Mã lô ${existingLot.lotCode} đã tồn tại nhưng payload không giống yêu cầu retry.`),
            { statusCode: 409 }
          );
        }
        const lot = existingLot;
        const items = requestedItems;
        const routes = requestedRoutes;
        const existingRoutesResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1
           ORDER BY document_id`,
          [lot.id]
        );
        const existingRoutes = existingRoutesResult.rows.map(mapDocumentRow) as PcnSampleRoute[];
        if (
          existingRoutes.length !== routes.length ||
          routes.some((route) => !existingRoutes.some((item) => item.id === route.id))
        ) {
          throw Object.assign(
            new Error(`Lô ${lot.lotCode} đã tồn tại nhưng thiếu tuyến mẫu để trả kết quả idempotent.`),
            { statusCode: 409 }
          );
        }
        const existingItemsResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleItems' AND data->>'sampleLotId' = $1
           ORDER BY document_id`,
          [lot.id]
        );
        const existingItems = existingItemsResult.rows.map(mapDocumentRow) as PcnSampleItem[];
        const responseItems = existingItems.length > 0 ? existingItems : items;
        const eventResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleFlowEvents' AND data->>'sampleLotId' = $1 AND data->>'type' = 'LOT_CREATED'
           ORDER BY data->>'occurredAt' DESC, document_id DESC LIMIT 1`,
          [lot.id]
        );
        if (!eventResult.rows[0]) {
          throw Object.assign(
            new Error(`Lô ${lot.lotCode} đã tồn tại nhưng thiếu sự kiện LOT_CREATED để trả kết quả idempotent.`),
            { statusCode: 409 }
          );
        }
        const event = mapDocumentRow(eventResult.rows[0]);
        return { lot: existingLot, items: responseItems, routes: existingRoutes, dossier, event, activityLogs: [], idempotent: true };
      }

      if (!canCreatePcnLabRequest(dossier)) {
        throw Object.assign(new Error('Hồ sơ chưa đến bước lấy mẫu & gửi PTN để tạo lô mẫu.'), { statusCode: 409 });
      }

      const now = new Date().toISOString();
      const lotYearKey = getPcnVietnamYearKey(now);
      const lotYearSuffix = lotYearKey.slice(-2);
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`pcn-lot-sequence:${lotYearKey}`]);
      const lotSerialResult = await client.query(
        `SELECT COALESCE(MAX(CAST(substring(data->>'lotCode' FROM '^CN ([0-9]{4})-[0-9]{2}$') AS INTEGER)), 0) AS last_serial
           FROM app_documents
          WHERE collection_name = $1
            AND data->>'lotCode' ~ $2`,
        ['pcnSampleLots', `^CN [0-9]{4}-${lotYearSuffix}$`]
      );
      const nextLotSerial = Number(lotSerialResult.rows[0]?.last_serial || 0) + 1;
      if (nextLotSerial > 9999) {
        throw Object.assign(new Error(`Đã hết dãy mã hóa lô PCN cho năm ${lotYearKey}.`), { statusCode: 409 });
      }
      const lotCode = formatPcnSampleLotCode(nextLotSerial, now);
      const { lot, items, routes } = buildPcnSampleLot(
        {
          ...draft,
          id: draftId,
          dossierId,
          lotCode,
          fieldCodes: requestedFieldCodes,
          labCodes: requestedLabCodes,
        } as PcnSampleLotDraft,
        now
      );

      const duplicateCodeResult = await client.query(
        `SELECT document_id FROM app_documents
         WHERE collection_name = 'pcnSampleLots'
           AND LOWER(data->>'lotCode') = LOWER($1)
           AND document_id <> $2
         LIMIT 1`,
        [lot.lotCode, lot.id]
      );
      if (duplicateCodeResult.rows.length > 0) {
        throw Object.assign(new Error(`Mã hóa lô mẫu ${lot.lotCode} đã tồn tại.`), { statusCode: 409 });
      }

      for (const item of items) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('pcnSampleItems', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [item.id, JSON.stringify(getDocumentPayload(item))]
        );
      }
      for (const route of routes) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('pcnSampleRoutes', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [route.id, JSON.stringify(getDocumentPayload(route))]
        );
      }
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnSampleLots', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [lot.id, JSON.stringify(getDocumentPayload(lot))]
      );
      const event = buildPcnSampleFlowEvent(
        {
          id: `pcn-sample-event-${sanitizePcnPathSegment(lot.id)}-created`,
          sampleLotId: lot.id,
          type: 'LOT_CREATED',
          location: lot.currentLocation,
          note: `Tạo lô ${lot.lotCode} và chuẩn bị chuyển mẫu`,
          actorUsername: actor.username,
        },
        now
      );
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [event.id, JSON.stringify(getDocumentPayload(event))]
      );
      const nextDossier: CertificationDossier = {
        ...dossier,
        sampleLotIds: Array.from(new Set([...(dossier.sampleLotIds || []), lot.id])),
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
      );
      const activity = buildActivityLog({
        id: `activity-pcn-sample-${sanitizePcnPathSegment(lot.id)}-created`,
        action: 'CREATED',
        entityType: 'PCN_SAMPLE_LOT',
        entityId: lot.id,
        entityLabel: lot.lotCode,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: (actor.systemRole || actor.role) as any,
        summary: 'Tạo lô mẫu PCN và các tuyến phòng thử',
        source: 'UI',
        groupId: lot.id,
        createdAt: now,
      });
      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))]
      );
      return { lot, items, routes, dossier: nextDossier, event, activityLogs: [activity], idempotent: false };
    });

    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN sample lot creation error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
