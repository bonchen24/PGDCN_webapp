import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonConflict,
  jsonNotFound,
  jsonOk,
} from '@/lib/server/response';
import { requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { PcnSampleRequestBundle } from '@/types';
import { isSafePcnSampleKey } from '@/lib/server/pcn-signer-delegations';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bundleId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Gửi PYC tổng PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const { bundleId: rawBundleId } = await params;
  const bundleId = String(rawBundleId || '').trim();
  if (!isSafePcnSampleKey(bundleId)) {
    return jsonBadRequest('Mã PYC tổng không hợp lệ.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const bundleResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRequestBundles' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [bundleId]
      );
      if (!bundleResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC tổng để gửi.'), { statusCode: 404 });
      }
      const bundle = mapDocumentRow(bundleResult.rows[0]) as PcnSampleRequestBundle;
      if (bundle.status === 'SENT' || bundle.status === 'PARTIALLY_SENT') {
        return {
          bundle,
          dispatches: bundle.dispatches,
          labRequests: [],
          lots: [],
          items: [],
          routes: [],
          activityLogs: [],
          idempotent: true,
        };
      }
      if (bundle.status === 'CANCELLED') {
        throw Object.assign(new Error('PYC tổng đã hủy.'), { statusCode: 409 });
      }
      const now = new Date().toISOString();
      const nextDispatches = bundle.dispatches.map((dispatch) =>
        dispatch.status === 'ACKNOWLEDGED'
          ? dispatch
          : {
              ...dispatch,
              status: 'SENDING' as const,
              lastAttemptAt: now,
              lastErrorCode: undefined,
              lastErrorMessage: undefined,
            }
      );
      const nextBundle: PcnSampleRequestBundle = {
        ...bundle,
        status: 'SENDING',
        dispatches: nextDispatches,
        updatedAt: now,
      };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'pcnSampleRequestBundles' AND document_id = $1`,
        [bundle.id, JSON.stringify(getDocumentPayload(nextBundle))]
      );
      const requestIds = Array.from(new Set(nextDispatches.flatMap((dispatch) => dispatch.labRequestIds)));
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = ANY($1::text[]) ORDER BY document_id`,
        [requestIds]
      );
      const [lotResult, itemResult, routeResult] = await Promise.all([
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND document_id = ANY($1::text[]) ORDER BY document_id`,
          [bundle.sampleLotIds]
        ),
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleItems' AND document_id = ANY($1::text[]) ORDER BY document_id`,
          [bundle.sampleItemIds]
        ),
        client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = ANY($1::text[]) ORDER BY document_id`,
          [bundle.sampleLotIds]
        ),
      ]);
      return {
        bundle: nextBundle,
        dispatches: nextDispatches,
        labRequests: requestResult.rows.map(mapDocumentRow),
        lots: lotResult.rows.map(mapDocumentRow),
        items: itemResult.rows.map(mapDocumentRow),
        routes: routeResult.rows.map(mapDocumentRow),
        activityLogs: [],
        idempotent: false,
      };
    });

    return jsonOk(result);
  } catch (error: any) {
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 409) return jsonConflict(message);
    return jsonBadRequest(message);
  }
}
