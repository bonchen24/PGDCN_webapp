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
  PcnSampleRequestBundle,
  PcnSampleRequestBundleDraft,
  PcnSampleLot,
  PcnSampleItem,
  PcnSampleRoute,
  OutboundLabRequest,
  PcnCertificationFieldCode,
  PcnSampleLabCode,
} from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossiers';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import {
  customerKey,
  normalizePcnSampleList,
  normalizePcnSampleLabCodes,
} from '@/lib/server/pcn-samples';
import {
  buildPcnSampleLot,
  buildPcnSampleFlowEvent,
  type PcnSampleLotDraft,
} from '@/utils/pcnSampleFlow';
import { buildPcnLabRequest } from '@/utils/pcnLabRouting';
import {
  buildSampleRequestBundleDraft,
  PCN_SAMPLE_REQUEST_BUNDLE_MAPPING_VERSION,
} from '@/utils/pcnSampleRequestBundle';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { canCreatePcnLabRequest } from '@/utils/pcnWorkflowStages';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Sổ quản lý mẫu PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const rawBundle = body.bundle;
  if (!rawBundle || typeof rawBundle !== 'object' || Array.isArray(rawBundle)) {
    return jsonBadRequest('Thiếu dữ liệu PYC tổng.');
  }

  const bundleId = String(rawBundle.id || '').trim();
  const parentPycNumber = String(rawBundle.parentPycNumber || '').trim();
  const rawLines = Array.isArray(rawBundle.lines) ? rawBundle.lines : [];
  const rawCustomer =
    rawBundle.customerSnapshot &&
    typeof rawBundle.customerSnapshot === 'object' &&
    !Array.isArray(rawBundle.customerSnapshot)
      ? rawBundle.customerSnapshot
      : null;

  if (!isSafePcnSampleKey(bundleId) || !parentPycNumber || !rawCustomer || rawLines.length === 0) {
    return jsonBadRequest('PYC tổng phải có mã định danh, số PYC, khách hàng và ít nhất một mẫu.');
  }

  const actor = getPcnSessionUser(req)!;
  const bundleCustomerKey = customerKey(rawCustomer);
  if (!bundleCustomerKey) {
    return jsonBadRequest('PYC tổng phải có thông tin khách hàng để khóa phạm vi cùng khách hàng.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const existingBundleResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'pcnSampleRequestBundles' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [bundleId]
      );
      if (existingBundleResult.rows[0]) {
        const existingBundle = mapDocumentRow(existingBundleResult.rows[0]) as PcnSampleRequestBundle;
        if (existingBundle.status !== 'DRAFT') {
          throw Object.assign(
            new Error('PYC tổng đã gửi; không được ghi đè snapshot đã liên thông.'),
            { statusCode: 409 }
          );
        }
        const requestIds = Array.from(
          new Set(existingBundle.dispatches.flatMap((dispatch) => dispatch.labRequestIds))
        );
        const [lotResult, itemResult, routeResult, requestResult] = await Promise.all([
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = ANY($1::text[]) ORDER BY document_id`,
            [existingBundle.sampleLotIds]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleItems' AND document_id = ANY($1::text[]) ORDER BY document_id`,
            [existingBundle.sampleItemIds]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = ANY($1::text[]) ORDER BY document_id`,
            [existingBundle.sampleLotIds]
          ),
          client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = ANY($1::text[]) ORDER BY document_id`,
            [requestIds]
          ),
        ]);
        return {
          bundle: existingBundle,
          lots: lotResult.rows.map(mapDocumentRow),
          items: itemResult.rows.map(mapDocumentRow),
          routes: routeResult.rows.map(mapDocumentRow),
          dispatches: existingBundle.dispatches,
          labRequests: requestResult.rows.map(mapDocumentRow),
          activityLogs: [],
          idempotent: true,
        };
      }

      const bundleFieldCodes = normalizePcnSampleList(rawBundle.fieldCodes);
      if (bundleFieldCodes.length === 0) {
        throw Object.assign(new Error('PYC tổng phải có ít nhất một Lĩnh vực.'), { statusCode: 400 });
      }

      const seenLotCodes = new Set<string>();
      const seenSampleCodes = new Set<string>();
      const normalizedLines: PcnSampleRequestBundleDraft['lines'] = [];
      const lots: PcnSampleLot[] = [];
      const items: PcnSampleItem[] = [];
      const routes: PcnSampleRoute[] = [];
      const flowEvents: Array<ReturnType<typeof buildPcnSampleFlowEvent>> = [];
      const labRequestIdsByLab = new Map<PcnSampleLabCode, string[]>();
      const dossierById = new Map<string, CertificationDossier>();
      const dossierLotIds = new Map<string, Set<string>>();
      const dossierRequestIds = new Map<string, Set<string>>();

      const loadDossier = async (dossierId: string): Promise<CertificationDossier> => {
        const cached = dossierById.get(dossierId);
        if (cached) return cached;
        const dossierResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'certificationDossiers' AND document_id = $1
           LIMIT 1 FOR UPDATE`,
          [dossierId]
        );
        if (!dossierResult.rows[0]) {
          throw Object.assign(new Error(`Không tìm thấy hồ sơ PCN ${dossierId}.`), { statusCode: 404 });
        }
        const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
        if (isPcnDossierPostApprovalLocked(dossier.status)) {
          throw Object.assign(
            new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi tạo PYC tổng.'),
            { statusCode: 409 }
          );
        }
        assertPcnDossierOperator(dossier, actor);
        if (!canCreatePcnLabRequest(dossier)) {
          throw Object.assign(
            new Error('Hồ sơ chưa đến bước lấy mẫu & gửi PTN để tạo PYC tổng.'),
            { statusCode: 409 }
          );
        }
        const dossierCustomerKey = customerKey(dossier.customerSnapshot || rawCustomer);
        if (dossierCustomerKey !== bundleCustomerKey) {
          throw Object.assign(
            new Error('Các mẫu trong PYC tổng phải thuộc cùng một khách hàng.'),
            { statusCode: 400 }
          );
        }
        dossierById.set(dossierId, dossier);
        dossierLotIds.set(dossierId, new Set(dossier.sampleLotIds || []));
        dossierRequestIds.set(dossierId, new Set(dossier.labRequestIds || []));
        return dossier;
      };

      for (let index = 0; index < rawLines.length; index += 1) {
        const rawLine = rawLines[index];
        if (!rawLine || typeof rawLine !== 'object' || Array.isArray(rawLine)) {
          throw Object.assign(new Error(`Mẫu thứ ${index + 1} không hợp lệ.`), { statusCode: 400 });
        }
        const dossierId = String(rawLine.dossierId || '').trim();
        const lotCode = String(rawLine.lotCode || '').trim();
        const sampleCode = String(rawLine.sampleCode || '').trim();
        const sampleType = String(rawLine.sampleType || '').trim();
        const model = String(rawLine.model || '').trim();
        const quantity = Number(rawLine.quantity);
        if (
          !isSafePcnSampleKey(dossierId) ||
          !lotCode ||
          !sampleCode ||
          !sampleType ||
          !model ||
          !Number.isInteger(quantity) ||
          quantity < 1
        ) {
          throw Object.assign(
            new Error(`Mẫu thứ ${index + 1} thiếu dữ liệu bắt buộc hoặc có số lượng không hợp lệ.`),
            { statusCode: 400 }
          );
        }
        const normalizedLotKey = lotCode.toLocaleLowerCase('vi-VN');
        const normalizedSampleKey = sampleCode.toLocaleLowerCase('vi-VN');
        if (seenLotCodes.has(normalizedLotKey)) {
          throw Object.assign(new Error(`Mã lô ${lotCode} bị trùng trong PYC tổng.`), { statusCode: 400 });
        }
        if (seenSampleCodes.has(normalizedSampleKey)) {
          throw Object.assign(new Error(`Mã mẫu ${sampleCode} bị trùng trong PYC tổng.`), { statusCode: 400 });
        }
        seenLotCodes.add(normalizedLotKey);
        seenSampleCodes.add(normalizedSampleKey);
        const labCodes = normalizePcnSampleLabCodes(rawLine.labCodes);
        if (labCodes.length === 0) {
          throw Object.assign(new Error(`Mẫu ${sampleCode} phải được gán ít nhất một PTN.`), { statusCode: 400 });
        }
        const dossier = await loadDossier(dossierId);
        if (rawLine.customerSnapshot && customerKey(rawLine.customerSnapshot) !== bundleCustomerKey) {
          throw Object.assign(
            new Error('CUSTOMER_MISMATCH: Các mẫu trong PYC tổng phải thuộc cùng một khách hàng.'),
            { statusCode: 400 }
          );
        }
        const lineFieldCodes = bundleFieldCodes.filter((code) => (dossier.fieldCodes || []).includes(code as any));
        if (lineFieldCodes.length === 0) {
          throw Object.assign(
            new Error(`Mẫu ${sampleCode} không có Lĩnh vực hợp lệ trong hồ sơ ${dossier.dossierCode}.`),
            { statusCode: 400 }
          );
        }

        let lot: PcnSampleLot;
        let item: PcnSampleItem;
        let lineRoutes: PcnSampleRoute[];
        const requestedItemId = String(rawLine.sampleItemId || '').trim();
        const requestedLotId = String(rawLine.sampleLotId || '').trim();
        if (requestedItemId) {
          const itemResult = await client.query(
            `SELECT document_id, data FROM app_documents
             WHERE collection_name = 'pcnSampleItems' AND document_id = $1
             LIMIT 1 FOR UPDATE`,
            [requestedItemId]
          );
          if (!itemResult.rows[0]) {
            throw Object.assign(new Error(`Không tìm thấy mẫu nguồn ${requestedItemId}.`), { statusCode: 404 });
          }
          item = mapDocumentRow(itemResult.rows[0]) as PcnSampleItem;
          const lotId = requestedLotId || item.sampleLotId;
          const lotResult = await client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = $1 LIMIT 1 FOR UPDATE`,
            [lotId]
          );
          if (!lotResult.rows[0]) {
            throw Object.assign(new Error(`Không tìm thấy lô mẫu của ${item.sampleCode}.`), { statusCode: 404 });
          }
          lot = mapDocumentRow(lotResult.rows[0]) as PcnSampleLot;
          if (lot.dossierId !== dossierId || item.sampleLotId !== lot.id) {
            throw Object.assign(new Error('Mẫu nguồn không thuộc đúng hồ sơ/lô đã chọn.'), { statusCode: 400 });
          }
          const routeResult = await client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1 ORDER BY document_id FOR UPDATE`,
            [lot.id]
          );
          const allRoutes = routeResult.rows.map(mapDocumentRow) as PcnSampleRoute[];
          const requestedRouteIds =
            rawLine.routeIdsByLab && typeof rawLine.routeIdsByLab === 'object' ? rawLine.routeIdsByLab : {};
          lineRoutes = labCodes.map((labCode) => {
            const requestedIds = Array.isArray(requestedRouteIds[labCode])
              ? requestedRouteIds[labCode].map((value: unknown) => String(value).trim())
              : [];
            const candidate = allRoutes.find(
              (r) =>
                (requestedIds.length > 0 ? requestedIds.includes(r.id) : r.labCode === labCode) &&
                r.labCode === labCode &&
                (!r.sampleItemIds?.length || r.sampleItemIds.includes(item.id))
            );
            if (!candidate) {
              throw Object.assign(new Error(`Không tìm thấy tuyến ${labCode} cho mẫu ${item.sampleCode}.`), {
                statusCode: 409,
              });
            }
            return candidate;
          });
        } else {
          const lotId = requestedLotId || `${bundleId}-lot-${index + 1}`;
          const itemId = `${lotId}-item-1`;
          if (!isSafePcnSampleKey(lotId) || !isSafePcnSampleKey(itemId)) {
            throw Object.assign(new Error('Mã định danh lô/mẫu không an toàn.'), { statusCode: 400 });
          }
          const duplicateLotResult = await client.query(
            `SELECT document_id FROM app_documents WHERE collection_name = 'pcnSampleLots' AND LOWER(data->>'lotCode') = LOWER($1) LIMIT 1 FOR UPDATE`,
            [lotCode]
          );
          if (duplicateLotResult.rows[0]) {
            throw Object.assign(new Error(`DUPLICATE_LOT_CODE: Mã lô ${lotCode} đã tồn tại.`), { statusCode: 409 });
          }
          const duplicateItemResult = await client.query(
            `SELECT document_id FROM app_documents WHERE collection_name = 'pcnSampleItems' AND LOWER(data->>'sampleCode') = LOWER($1) LIMIT 1 FOR UPDATE`,
            [sampleCode]
          );
          if (duplicateItemResult.rows[0]) {
            throw Object.assign(new Error(`DUPLICATE_SAMPLE_CODE: Mã mẫu ${sampleCode} đã tồn tại.`), {
              statusCode: 409,
            });
          }
          const built = buildPcnSampleLot(
            {
              id: lotId,
              dossierId,
              lotCode,
              sampleItems: [
                {
                  id: itemId,
                  sampleCode,
                  sampleType,
                  model,
                  brand: rawLine.brand,
                  quantity,
                  unit: rawLine.unit,
                  testLabCodes: labCodes,
                  notes: rawLine.notes,
                },
              ],
              quantity,
              fieldCodes: lineFieldCodes,
              labCodes,
              notes: rawLine.notes,
            } as PcnSampleLotDraft,
            new Date().toISOString()
          );
          lot = built.lot;
          item = built.items[0];
          lineRoutes = built.routes;
          for (const candidate of built.items) {
            await client.query(
              `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('pcnSampleItems', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
              [candidate.id, JSON.stringify(getDocumentPayload(candidate))]
            );
            items.push(candidate);
          }
          for (const candidate of built.routes) {
            await client.query(
              `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('pcnSampleRoutes', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
              [candidate.id, JSON.stringify(getDocumentPayload(candidate))]
            );
            routes.push(candidate);
          }
          await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('pcnSampleLots', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
            [lot.id, JSON.stringify(getDocumentPayload(lot))]
          );
          const event = buildPcnSampleFlowEvent(
            {
              id: stablePcnMutationId('pcn-sample-event-bundle-created', lot.id),
              sampleLotId: lot.id,
              type: 'LOT_CREATED',
              location: lot.currentLocation,
              note: `Tạo lô ${lot.lotCode} từ modal PYC tổng`,
              actorUsername: actor.username,
            },
            lot.createdAt || new Date().toISOString()
          );
          await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP) ON CONFLICT (collection_name, document_id) DO NOTHING`,
            [event.id, JSON.stringify(getDocumentPayload(event))]
          );
          flowEvents.push(event);
          lots.push(lot);
        }

        if (!items.some((candidate) => candidate.id === item.id)) items.push(item);
        if (!lots.some((candidate) => candidate.id === lot.id)) lots.push(lot);
        for (const route of lineRoutes) if (!routes.some((candidate) => candidate.id === route.id)) routes.push(route);
        const routeIdsByLab = Object.fromEntries(
          lineRoutes.map((route) => [route.labCode, [route.id]])
        ) as PcnSampleRequestBundleDraft['lines'][number]['routeIdsByLab'];
        normalizedLines.push({
          sampleItemId: item.id,
          sampleLotId: lot.id,
          dossierId,
          lotCode: lot.lotCode,
          sampleCode: item.sampleCode,
          sampleType: item.sampleType,
          model: item.model,
          ...(item.brand ? { brand: item.brand } : {}),
          quantity: item.quantity,
          ...(item.unit ? { unit: item.unit } : {}),
          labCodes,
          routeIdsByLab,
          customerSnapshot: dossier.customerSnapshot || rawCustomer,
          ...(item.notes ? { notes: item.notes } : {}),
        });
        const lotIds = dossierLotIds.get(dossierId)!;
        lotIds.add(lot.id);

        for (const route of lineRoutes) {
          const requestId = stablePcnMutationId('pcn-lab-request-bundle', `${bundleId}:${route.id}`);
          const existingRequestResult = await client.query(
            `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = $1 LIMIT 1 FOR UPDATE`,
            [requestId]
          );
          let request: OutboundLabRequest;
          if (existingRequestResult.rows[0]) {
            request = mapDocumentRow(existingRequestResult.rows[0]) as OutboundLabRequest;
            if (request.bundleId !== bundleId || request.sampleRouteId !== route.id) {
              throw Object.assign(new Error('PYC con đã tồn tại nhưng không khớp bundle/tuyến mẫu.'), {
                statusCode: 409,
              });
            }
          } else {
            const pycNumber = `${parentPycNumber}-${route.labCode}-${String(index + 1).padStart(2, '0')}`;
            request = {
              ...buildPcnLabRequest(
                {
                  id: requestId,
                  dossierId,
                  fieldCode: lineFieldCodes[0] as PcnCertificationFieldCode,
                  laboratoryName: route.labName,
                  sampleLotId: lot.id,
                  sampleRouteId: route.id,
                  pycNumber,
                  targetDate: rawBundle.targetDate,
                  criteria: rawBundle.criteria,
                },
                new Date().toISOString()
              ),
              bundleId,
              parentPycNumber,
              sampleItemIds: [...(route.sampleItemIds || [item.id])],
              mappingVersion: PCN_SAMPLE_REQUEST_BUNDLE_MAPPING_VERSION,
            };
            await client.query(
              `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('labRequests', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
              [request.id, JSON.stringify(getDocumentPayload(request))]
            );
          }
          if (route.labRequestId && route.labRequestId !== request.id) {
            throw Object.assign(new Error('Tuyến mẫu đã được gắn với PYC khác.'), { statusCode: 409 });
          }
          if (route.labRequestId !== request.id) {
            const linkedRoute = { ...route, labRequestId: request.id, updatedAt: new Date().toISOString() };
            await client.query(
              `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'pcnSampleRoutes' AND document_id = $1`,
              [route.id, JSON.stringify(getDocumentPayload(linkedRoute))]
            );
            const routeIndex = routes.findIndex((candidate) => candidate.id === route.id);
            if (routeIndex >= 0) routes[routeIndex] = linkedRoute;
          }
          const requestIds = labRequestIdsByLab.get(route.labCode) || [];
          requestIds.push(request.id);
          labRequestIdsByLab.set(route.labCode, requestIds);
          const requestDossierIds = dossierRequestIds.get(dossierId)!;
          requestDossierIds.add(request.id);
        }
      }

      const draft: PcnSampleRequestBundleDraft = {
        id: bundleId,
        parentPycNumber,
        customerSnapshot: rawCustomer,
        sourceRefs: Array.isArray(rawBundle.sourceRefs) ? rawBundle.sourceRefs : [],
        fieldCodes: bundleFieldCodes as PcnCertificationFieldCode[],
        lines: normalizedLines,
        ...(String(rawBundle.targetDate || '').trim() ? { targetDate: String(rawBundle.targetDate).trim() } : {}),
        ...(String(rawBundle.criteria || '').trim() ? { criteria: String(rawBundle.criteria).trim() } : {}),
      };
      const bundle = buildSampleRequestBundleDraft(draft, new Date().toISOString());
      const dispatches = bundle.dispatches.map((dispatch) => ({
        ...dispatch,
        labRequestIds: Array.from(new Set(labRequestIdsByLab.get(dispatch.labCode) || [])),
      }));
      const persistedBundle: PcnSampleRequestBundle = { ...bundle, dispatches };
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('pcnSampleRequestBundles', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [bundle.id, JSON.stringify(getDocumentPayload(persistedBundle))]
      );
      for (const [dossierId, dossier] of dossierById.entries()) {
        const nextDossier: CertificationDossier = {
          ...dossier,
          sampleLotIds: Array.from(dossierLotIds.get(dossierId) || []),
          labRequestIds: Array.from(dossierRequestIds.get(dossierId) || []),
          updatedAt: persistedBundle.updatedAt,
        };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [dossierId, JSON.stringify(getDocumentPayload(nextDossier))]
        );
      }
      const activity = buildActivityLog({
        id: stablePcnMutationId('activity-pcn-sample-request-bundle', bundle.id),
        action: 'CREATED',
        entityType: 'PCN_LAB_REQUEST',
        entityId: bundle.id,
        entityLabel: bundle.parentPycNumber,
        actorUsername: actor.username,
        actorName: actor.name,
        actorRole: (actor.systemRole || actor.role) as any,
        summary: 'Lưu PYC tổng và chuẩn bị các PYC con theo từng phòng thử',
        source: 'UI',
        groupId: bundle.id,
        changes: diffActivityFields({}, persistedBundle, [
          'parentPycNumber',
          'customerSnapshot',
          'sampleItemIds',
          'sampleLotIds',
          'dispatches',
          'status',
        ]),
        createdAt: persistedBundle.createdAt,
      });
      const validationError = validateActivityLogPayload(activity);
      if (validationError) throw new Error(validationError);
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
        [activity.id, JSON.stringify(getDocumentPayload(activity))]
      );
      const requestIds = Array.from(new Set(dispatches.flatMap((dispatch) => dispatch.labRequestIds)));
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = ANY($1::text[]) ORDER BY document_id`,
        [requestIds]
      );
      return {
        bundle: persistedBundle,
        lots,
        items,
        routes,
        dispatches,
        labRequests: requestResult.rows.map(mapDocumentRow),
        events: flowEvents,
        activityLogs: [activity],
        idempotent: false,
      };
    });

    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN sample request bundle save error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
