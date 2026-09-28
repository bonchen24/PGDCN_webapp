import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import {
  jsonBadRequest,
  jsonForbidden,
  jsonNotFound,
  jsonOk,
} from '@/lib/server/response';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { CertificationDossier } from '@/types';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { buildPcnRetentionMetadata, updatePcnLegalHold } from '@/utils/pcnRetention';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> }
) {
  const isPcnProfile = (process.env.DATABASE_PROFILE || 'pcn').trim() === 'pcn';
  if (!isPcnProfile) {
    return jsonNotFound('Retention hồ sơ chỉ khả dụng trong profile PCN.');
  }

  const authError = requirePcnMutation(req);
  if (authError) return authError;

  const actor = getPcnSessionUser(req)!;
  const actorRole = actor.systemRole || actor.role;

  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();

  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const legalHold = body.legalHold;
  const reason = String(body.reason || '').trim();

  if (!dossierId || typeof legalHold !== 'boolean') {
    return jsonBadRequest('Thiếu mã hồ sơ hoặc trạng thái giữ pháp lý.');
  }

  if (legalHold && !reason) {
    return jsonBadRequest('Đặt giữ pháp lý phải có lý do.');
  }

  try {
    const result = await withPgTransaction(async (client) => {
      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      if (dossierResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy hồ sơ cần cập nhật retention.'), { statusCode: 404 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (dossier.status !== 'ARCHIVED') {
        throw Object.assign(new Error('Chỉ hồ sơ đã lưu trữ mới được đặt giữ pháp lý.'), { statusCode: 400 });
      }

      let retention = dossier.retention;
      if (!retention) {
        const issuanceResult = await client.query(
          `SELECT data FROM app_documents
           WHERE collection_name = 'issuancePackages'
             AND data->>'dossierId' = $1
             AND data->>'status' = 'ARCHIVED'
           ORDER BY data->>'archivedAt' DESC
           LIMIT 1`,
          [dossierId]
        );
        const archivedAt = String(issuanceResult.rows[0]?.data?.archivedAt || dossier.updatedAt || new Date().toISOString());
        retention = buildPcnRetentionMetadata(archivedAt);
      }

      const changedAt = new Date().toISOString();
      const nextRetention = updatePcnLegalHold(retention, {
        legalHold,
        reason,
        actorUsername: actor.username,
        at: changedAt,
      });

      const retentionChanged = !dossier.retention || nextRetention !== retention;
      const nextDossier = retentionChanged
        ? { ...dossier, retention: nextRetention, updatedAt: changedAt }
        : dossier;

      let activityLog: ReturnType<typeof buildActivityLog> | undefined;
      if (retentionChanged) {
        activityLog = buildActivityLog({
          action: 'UPDATED',
          entityType: 'PCN_DOSSIER',
          entityId: dossier.id,
          entityLabel: dossier.dossierCode,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actorRole as any,
          summary: legalHold ? 'Đặt giữ pháp lý cho hồ sơ PCN' : 'Gỡ giữ pháp lý cho hồ sơ PCN',
          changes: diffActivityFields(dossier, nextDossier, ['retention']),
          source: 'USER_REVIEW',
          createdAt: changedAt,
        });

        const validationError = validateActivityLogPayload(activityLog);
        if (validationError) throw new Error(validationError);

        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [dossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
        );

        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [activityLog.id, JSON.stringify(getDocumentPayload(activityLog))]
        );
      }

      return { dossier: nextDossier, ...(activityLog ? { activityLog } : {}) };
    });

    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN retention update error:', error);
    const message = String(error?.message || error);
    const statusCode = Number(error?.statusCode);
    if (statusCode === 404 || message.includes('Không tìm thấy')) return jsonNotFound(message);
    if (statusCode === 403 || message.includes('không được')) return jsonForbidden(message);
    return jsonBadRequest(message);
  }
}
