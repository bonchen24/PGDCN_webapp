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
  ReturnedTestResult,
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
  updatePcnSampleRequestBundleResultState,
  samePcnReturnedResult,
  normalizePcnReturnedResultIssue,
  getPcnSampleRouteStatusForLabRequest,
} from '@/lib/server/pcn-samples';
import {
  buildPcnReturnedResult,
  markOfficialPcnResults,
} from '@/utils/pcnResultPolicy';
import { normalizePcnOcrEvidence } from '@/utils/pcnOcrPolicy';
import {
  buildPcnSampleFlowEvent,
  derivePcnSampleLotStatus,
  transitionPcnSampleRoute,
} from '@/utils/pcnSampleFlow';
import { transitionPcnLabRequest } from '@/utils/pcnLabRouting';
import { isPcnDossierPostApprovalLocked } from '@/utils/pcnDossierStepAccess';
import { isPcnDossierTransitionAllowed } from '@/utils/pcnWorkflow';
import { getPcnDossierStageGateDenial } from '@/utils/pcnDossierStageGate';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Ghi nhận KQTN PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const rawResult = body.result;
  if (!rawResult || typeof rawResult !== 'object' || Array.isArray(rawResult)) {
    return jsonBadRequest('Thiếu dữ liệu KQTN trả về.');
  }

  const resultId = String(rawResult.id || '').trim();
  const dossierId = String(rawResult.dossierId || '').trim();
  const labRequestId = String(rawResult.labRequestId || '').trim();
  const idempotencyKey = String(body.idempotencyKey || resultId).trim();

  if (!isSafePcnSampleKey(resultId) || !dossierId || !labRequestId || !isSafePcnSampleKey(idempotencyKey)) {
    return jsonBadRequest('KQTN phải có mã kết quả, hồ sơ, PYC và idempotencyKey hợp lệ.');
  }

  const actor = getPcnSessionUser(req)!;

  try {
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [idempotencyKey]);
      const now = new Date().toISOString();
      const sampleIssue = normalizePcnReturnedResultIssue(rawResult.sampleIssue, now);
      const ocrEvidence = normalizePcnOcrEvidence(rawResult.ocrEvidence, {
        confirmedAt: now,
        confirmedBy: actor.username,
      });
      const returnedResult = buildPcnReturnedResult(
        {
          id: resultId,
          dossierId,
          labRequestId,
          round: rawResult.round,
          outcome: rawResult.outcome,
          receivedAt: rawResult.receivedAt,
          reportNumber: rawResult.reportNumber,
          notes: rawResult.notes,
          ...(sampleIssue ? { sampleIssue } : {}),
          ocrEvidence,
        },
        now
      );
      const resultFingerprint = createHash('sha256')
        .update(
          JSON.stringify({
            id: returnedResult.id,
            dossierId: returnedResult.dossierId,
            labRequestId: returnedResult.labRequestId,
            round: returnedResult.round,
            outcome: returnedResult.outcome,
            receivedAt: returnedResult.receivedAt,
            reportNumber: returnedResult.reportNumber || '',
            notes: returnedResult.notes || '',
            sampleIssue: returnedResult.sampleIssue || null,
            ocrEvidence: returnedResult.ocrEvidence
              ? {
                  provider: returnedResult.ocrEvidence.provider,
                  sourceFileName: returnedResult.ocrEvidence.sourceFileName,
                  sourcePage: returnedResult.ocrEvidence.sourcePage || null,
                  confidence: returnedResult.ocrEvidence.confidence,
                }
              : null,
          })
        )
        .digest('hex');

      const requestProbeResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1`,
        [labRequestId]
      );
      if (!requestProbeResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC gửi PTN.'), { statusCode: 404 });
      }
      const requestProbe = mapDocumentRow(requestProbeResult.rows[0]) as OutboundLabRequest;
      if (requestProbe.dossierId !== dossierId) {
        throw Object.assign(new Error('KQTN và PYC không cùng hồ sơ.'), { statusCode: 409 });
      }

      let lot: PcnSampleLot | undefined;
      let route: PcnSampleRoute | undefined;
      if (requestProbe.sampleLotId || requestProbe.sampleRouteId) {
        if (!requestProbe.sampleLotId || !requestProbe.sampleRouteId) {
          throw Object.assign(new Error('PYC có liên kết mẫu không đầy đủ.'), { statusCode: 409 });
        }
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
      }

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      if (!dossierResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ nhận KQTN.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (isPcnDossierPostApprovalLocked(dossier.status)) {
        throw Object.assign(
          new Error('Hồ sơ đã duyệt/phát hành; phải thu hồi có lý do trước khi ghi nhận KQTN.'),
          { statusCode: 409 }
        );
      }
      assertPcnDossierOperator(dossier, actor);
      if (!(dossier.labRequestIds || []).includes(labRequestId)) {
        throw Object.assign(new Error('Hồ sơ chưa có backlink tới PYC nhận KQTN.'), { statusCode: 409 });
      }

      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'labRequests' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [labRequestId]
      );
      if (!requestResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC nhận KQTN.'), { statusCode: 404 });
      }
      const request = mapDocumentRow(requestResult.rows[0]) as OutboundLabRequest;
      if (request.dossierId !== dossier.id) {
        throw Object.assign(new Error('PYC nhận KQTN không thuộc hồ sơ.'), { statusCode: 409 });
      }
      if (route && (route.labRequestId !== request.id || lot?.dossierId !== dossier.id)) {
        throw Object.assign(new Error('Liên kết PYC–lô–tuyến không nhất quán.'), { statusCode: 409 });
      }

      const existingResultQuery = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'returnedResults' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [returnedResult.id]
      );
      if (existingResultQuery.rows[0]) {
        const existingResult = mapDocumentRow(existingResultQuery.rows[0]) as ReturnedTestResult;
        if (!samePcnReturnedResult(existingResult, returnedResult)) {
          throw Object.assign(new Error('Mã KQTN đã tồn tại nhưng payload không giống yêu cầu retry.'), {
            statusCode: 409,
          });
        }
        const relatedResultsQuery = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'returnedResults' AND data->>'labRequestId' = $1
           ORDER BY COALESCE((data->>'round')::int, 999), document_id`,
          [request.id]
        );
        return {
          results: relatedResultsQuery.rows.map(mapDocumentRow) as ReturnedTestResult[],
          request,
          dossier,
          ...(lot ? { lot } : {}),
          ...(route ? { route } : {}),
          events: [],
          activityLogs: [],
          idempotent: true,
        };
      }

      if (!['SENT', 'RECEIVED', 'RESULT_RETURNED'].includes(request.status)) {
        throw Object.assign(new Error('PYC chưa ở trạng thái có thể tiếp nhận KQTN.'), { statusCode: 409 });
      }
      if (route) {
        const expectedRouteStatus = getPcnSampleRouteStatusForLabRequest(request.status);
        if (expectedRouteStatus && route.status !== expectedRouteStatus) {
          throw Object.assign(
            new Error(`Snapshot tuyến ${route.labName} không đồng bộ với trạng thái PYC ${request.status}.`),
            { statusCode: 409 }
          );
        }
      }

      const relatedResultsQuery = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'returnedResults' AND data->>'labRequestId' = $1
         ORDER BY COALESCE((data->>'round')::int, 999), document_id
         FOR UPDATE`,
        [request.id]
      );
      const previousResults = relatedResultsQuery.rows.map(mapDocumentRow) as ReturnedTestResult[];
      const officialResults = markOfficialPcnResults([...previousResults, returnedResult]);
      const nextResults = officialResults.map((item) => {
        const previous = previousResults.find((candidate) => candidate.id === item.id);
        return previous && previous.isOfficial === item.isOfficial ? item : { ...item, updatedAt: now };
      });

      let nextRequest: OutboundLabRequest = {
        ...request,
        status: 'RESULT_RETURNED',
        returnedResultId: returnedResult.id,
        updatedAt: now,
      };
      if (request.status === 'SENT' && !nextRequest.receivedAt) nextRequest.receivedAt = now;
      if (request.status !== 'RESULT_RETURNED') {
        try {
          if (request.status === 'SENT') transitionPcnLabRequest(request.status, 'RECEIVED');
          transitionPcnLabRequest(request.status === 'SENT' ? 'RECEIVED' : request.status, 'RESULT_RETURNED');
        } catch (error) {
          throw Object.assign(error instanceof Error ? error : new Error(String(error)), { statusCode: 409 });
        }
      }

      let nextRoute = route;
      const sampleEvents: Array<ReturnType<typeof buildPcnSampleFlowEvent>> = [];
      let intermediateRoutes: PcnSampleRoute[] | undefined;
      if (route && lot) {
        if (route.status === 'SENT') {
          const receivedRoute = transitionPcnSampleRoute(route, 'RECEIVED', {}, now);
          intermediateRoutes = [receivedRoute];
          nextRoute = transitionPcnSampleRoute(receivedRoute, 'RESULT_RETURNED', {}, now);
        } else if (route.status === 'RECEIVED') {
          nextRoute = transitionPcnSampleRoute(route, 'RESULT_RETURNED', {}, now);
        } else if (route.status === 'RESULT_RETURNED') {
          nextRoute = { ...route, labRequestId: request.id, updatedAt: now };
        } else {
          throw Object.assign(new Error(`Tuyến mẫu ${route.labName} chưa ở trạng thái có thể tiếp nhận KQTN.`), {
            statusCode: 409,
          });
        }
        const siblingRoutesResult = await client.query(
          `SELECT document_id, data FROM app_documents
           WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = $1
           ORDER BY document_id FOR UPDATE`,
          [lot.id]
        );
        const siblingRoutes = siblingRoutesResult.rows
          .map(mapDocumentRow)
          .map((item: PcnSampleRoute) => (item.id === nextRoute!.id ? nextRoute! : item)) as PcnSampleRoute[];
        const nextLot: PcnSampleLot = { ...lot, ...derivePcnSampleLotStatus(siblingRoutes), updatedAt: now };
        const receivedLot = intermediateRoutes
          ? {
              ...lot,
              ...derivePcnSampleLotStatus(
                intermediateRoutes.concat(siblingRoutes.filter((item) => item.id !== nextRoute!.id))
              ),
              updatedAt: now,
            }
          : nextLot;
        if (route.status === 'SENT') {
          sampleEvents.push(
            buildPcnSampleFlowEvent(
              {
                id: stablePcnMutationId('pcn-sample-event-result-received', returnedResult.id),
                sampleLotId: lot.id,
                routeId: route.id,
                labRequestId: request.id,
                idempotencyFingerprint: resultFingerprint,
                type: 'LAB_RECEIVED',
                fromStatus: route.status,
                toStatus: 'RECEIVED',
                location: receivedLot.currentLocation,
                note: `Tiếp nhận KQTN ${returnedResult.reportNumber || returnedResult.id}`,
                actorUsername: actor.username,
              },
              now
            )
          );
        }
        if (route.status !== 'RESULT_RETURNED') {
          sampleEvents.push(
            buildPcnSampleFlowEvent(
              {
                id: stablePcnMutationId('pcn-sample-event-result-returned', returnedResult.id),
                sampleLotId: lot.id,
                routeId: nextRoute.id,
                labRequestId: request.id,
                idempotencyFingerprint: resultFingerprint,
                type: 'RESULT_RETURNED',
                fromStatus: route.status === 'SENT' ? 'RECEIVED' : route.status,
                toStatus: nextRoute.status,
                location: nextLot.currentLocation,
                note: `KQTN ${returnedResult.reportNumber || returnedResult.id} đã trả về PCN`,
                actorUsername: actor.username,
              },
              now
            )
          );
        }
        for (const event of sampleEvents) {
          await client.query(
            `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
             VALUES ('pcnSampleFlowEvents', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
            [event.id, JSON.stringify(getDocumentPayload(event))]
          );
        }
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
        lot = nextLot;
      }

      const nextDossierStatus: CertificationDossier['status'] =
        returnedResult.outcome === 'PENDING'
          ? 'AWAITING_RESULTS'
          : returnedResult.outcome === 'FAIL'
          ? 'CORRECTIVE_ACTION'
          : 'TECHNICAL_REVIEW';
      let nextDossier = dossier;
      if (
        dossier.status !== nextDossierStatus &&
        !isPcnDossierTransitionAllowed(dossier.status, nextDossierStatus)
      ) {
        throw Object.assign(
          new Error(`Không thể cập nhật KQTN khi hồ sơ đang ở ${dossier.status}.`),
          { statusCode: 409 }
        );
      }
      if (dossier.status !== nextDossierStatus) {
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
          nextStatus: nextDossierStatus,
          requirements: configuredRequirements.length > 0 ? configuredRequirements : undefined,
          documents: documentResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument),
          documentWaivers: dossier.documentWaivers,
        });
        if (stageGateDenial) throw Object.assign(new Error(stageGateDenial), { statusCode: 409 });
      }
      nextDossier = {
        ...dossier,
        ...(dossier.status !== nextDossierStatus ? { status: nextDossierStatus } : {}),
        returnedResultIds: Array.from(new Set([...(dossier.returnedResultIds || []), returnedResult.id])),
        updatedAt: now,
      };

      for (const persistedResult of nextResults) {
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('returnedResults', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
          [persistedResult.id, JSON.stringify(getDocumentPayload(persistedResult))]
        );
      }
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'labRequests' AND document_id = $1`,
        [nextRequest.id, JSON.stringify(getDocumentPayload(nextRequest))]
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [nextDossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
      );

      const activityLogs: Array<ReturnType<typeof buildActivityLog>> = [];
      const addActivity = async (activity: ReturnType<typeof buildActivityLog>) => {
        const validationError = validateActivityLogPayload(activity);
        if (validationError) throw new Error(validationError);
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)`,
          [activity.id, JSON.stringify(getDocumentPayload(activity))]
        );
        activityLogs.push(activity);
      };
      await addActivity(
        buildActivityLog({
          id: stablePcnMutationId('activity-pcn-result', returnedResult.id),
          action: 'CREATED',
          entityType: 'PCN_RESULT',
          entityId: returnedResult.id,
          entityLabel: returnedResult.reportNumber || returnedResult.id,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: (actor.systemRole || actor.role) as any,
          summary: `Ghi nhận KQTN vòng ${returnedResult.round} từ PYC ${request.pycNumber}`,
          source: 'UI',
          groupId: dossier.id,
          changes: diffActivityFields({}, returnedResult, [
            'dossierId',
            'labRequestId',
            'round',
            'outcome',
            'receivedAt',
            'reportNumber',
            'notes',
            'sampleIssue',
            'ocrEvidence',
          ]),
          createdAt: now,
        })
      );
      await addActivity({
        ...buildActivityLog({
          id: stablePcnMutationId('activity-pcn-lab-request-result', returnedResult.id),
          action: request.status === nextRequest.status ? 'UPDATED' : 'STATUS_CHANGED',
          entityType: 'PCN_LAB_REQUEST',
          entityId: request.id,
          entityLabel: request.pycNumber,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: (actor.systemRole || actor.role) as any,
          summary: `PYC ${request.pycNumber} đã nhận KQTN và chuyển sang ${nextRequest.status}`,
          source: 'UI',
          groupId: dossier.id,
          changes: diffActivityFields(request, nextRequest, ['status', 'receivedAt', 'returnedResultId']),
          createdAt: now,
        }),
        resultId: returnedResult.id,
        idempotencyKey,
        idempotencyFingerprint: resultFingerprint,
      } as ReturnType<typeof buildActivityLog>);
      if (route && nextRoute && route.status !== nextRoute.status) {
        await addActivity(
          buildActivityLog({
            id: stablePcnMutationId('activity-pcn-sample-result', returnedResult.id),
            action: 'STATUS_CHANGED',
            entityType: 'PCN_SAMPLE_LOT',
            entityId: lot!.id,
            entityLabel: lot!.lotCode,
            actorUsername: actor.username,
            actorName: actor.name,
            actorRole: (actor.systemRole || actor.role) as any,
            summary: `Tuyến ${route.labName} đã nhận KQTN và chuyển sang ${nextRoute.status}`,
            source: 'UI',
            groupId: lot!.id,
            changes: diffActivityFields(route, nextRoute, ['status', 'receivedAt', 'resultReturnedAt']),
            createdAt: now,
          })
        );
      }
      await addActivity(
        buildActivityLog({
          id: stablePcnMutationId('activity-pcn-dossier-result', returnedResult.id),
          action: dossier.status === nextDossier.status ? 'UPDATED' : 'STATUS_CHANGED',
          entityType: 'PCN_DOSSIER',
          entityId: dossier.id,
          entityLabel: dossier.dossierCode,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: (actor.systemRole || actor.role) as any,
          summary: `Cập nhật hồ sơ theo KQTN vòng ${returnedResult.round}`,
          source: 'UI',
          groupId: dossier.id,
          changes: diffActivityFields(dossier, nextDossier, ['status', 'returnedResultIds']),
          createdAt: now,
        })
      );
      await updatePcnSampleRequestBundleResultState(client, nextRequest.id, now);
      return {
        results: nextResults,
        request: nextRequest,
        dossier: nextDossier,
        ...(lot ? { lot } : {}),
        ...(nextRoute ? { route: nextRoute } : {}),
        events: sampleEvents,
        activityLogs,
        idempotent: false,
      };
    });

    return result.idempotent ? jsonOk(result) : jsonCreated(result);
  } catch (error: any) {
    console.error('PCN returned result error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403) return jsonForbidden(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
