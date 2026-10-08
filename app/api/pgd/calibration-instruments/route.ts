import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload } from '@/lib/server/collections';
import { jsonBadRequest, jsonForbidden, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdCalibrationInstrument,
  getPgdCalibrationStatus,
} from '@/utils/pgdDomain';
import { writePgdActivity } from '@/lib/server/pgd-operations';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.calibrationInstruments, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const input = (await req.json().catch(() => ({}))) as Partial<PgdCalibrationInstrument>;
  const id = String(input?.id || '').trim();
  const code = String(input?.code || '').trim();
  const name = String(input?.name || '').trim();
  const expiresAt = String(input?.expiresAt || '').trim();
  if (!id || !code || !name || !expiresAt || Number.isNaN(new Date(expiresAt).getTime())) {
    return jsonBadRequest('Thiết bị hiệu chuẩn PGD cần mã, tên và ngày hết hạn hợp lệ.');
  }

  try {
    const instrument: PgdCalibrationInstrument = {
      id,
      domain: 'pgd',
      code,
      name,
      ...(String(input.serialNumber || '').trim() ? { serialNumber: String(input.serialNumber).trim() } : {}),
      ...(String(input.calibrationStandard || '').trim() ? { calibrationStandard: String(input.calibrationStandard).trim() } : {}),
      ...(String(input.calibratedAt || '').trim() ? { calibratedAt: String(input.calibratedAt).trim() } : {}),
      expiresAt,
      status: getPgdCalibrationStatus({ expiresAt, active: input.active !== false }),
      active: input.active !== false,
      ...(String(input.note || '').trim() ? { note: String(input.note).trim() } : {}),
    };

    await withPgTransaction(async (client) => {
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.calibrationInstruments, instrument.id, JSON.stringify(getDocumentPayload(instrument))],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: instrument.id,
        entityLabel: instrument.code,
        summary: `Cập nhật thiết bị hiệu chuẩn PGD ${instrument.code}`,
        idSuffix: `calibration-${instrument.id}`,
      });
    });

    return jsonOk({ instrument });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 403) return jsonForbidden(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
