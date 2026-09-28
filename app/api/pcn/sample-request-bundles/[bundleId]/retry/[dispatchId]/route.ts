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
  { params }: { params: Promise<{ bundleId: string; dispatchId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Retry PYC tổng PCN chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const { bundleId: rawBundleId, dispatchId: rawDispatchId } = await params;
  const bundleId = String(rawBundleId || '').trim();
  const dispatchId = String(rawDispatchId || '').trim();

  if (!isSafePcnSampleKey(bundleId) || !isSafePcnSampleKey(dispatchId)) {
    return jsonBadRequest('Mã bundle hoặc dispatch không hợp lệ.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const bundleResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRequestBundles' AND document_id = $1 LIMIT 1 FOR UPDATE`,
        [bundleId]
      );
      if (!bundleResult.rows[0]) {
        throw Object.assign(new Error('Không tìm thấy PYC tổng để retry.'), { statusCode: 404 });
      }
      const bundle = mapDocumentRow(bundleResult.rows[0]) as PcnSampleRequestBundle;
      const dispatch = bundle.dispatches.find((item) => item.id === dispatchId);
      if (!dispatch) {
        throw Object.assign(new Error('Không tìm thấy PTN cần retry trong PYC tổng.'), { statusCode: 404 });
      }
      const now = new Date().toISOString();
      const dispatches = bundle.dispatches.map((item) =>
        item.id === dispatchId
          ? {
              ...item,
              status: 'SENDING' as const,
              lastAttemptAt: now,
              lastErrorCode: undefined,
              lastErrorMessage: undefined,
            }
          : item
      );
      const nextBundle: PcnSampleRequestBundle = { ...bundle, status: 'SENDING', dispatches, updatedAt: now };
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = 'pcnSampleRequestBundles' AND document_id = $1`,
        [bundle.id, JSON.stringify(getDocumentPayload(nextBundle))]
      );
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND document_id = ANY($1::text[]) ORDER BY document_id`,
        [dispatch.labRequestIds]
      );
      return {
        bundle: nextBundle,
        dispatches,
        labRequests: requestResult.rows.map(mapDocumentRow),
        lots: [],
        items: [],
        routes: [],
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
