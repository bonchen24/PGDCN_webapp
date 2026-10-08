import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPgdSessionUser, requirePgdCollectionMutation } from '@/lib/server/pgd';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonConflict, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  PGD_COLLECTIONS,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdResultTemplate,
  snapshotPgdResultTemplate,
} from '@/utils/pgdDomain';
import { validatePgdResultValues } from '@/utils/pgdWorkflow';
import {
  assertPgdRequestEvidenceMutationAllowed,
  assertPgdRequestStationMutationAllowed,
  writePgdActivity,
} from '@/lib/server/pgd-operations';
import { buildPgdNotificationDraft } from '@/utils/pgdcnNotification';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const mutationError = requirePgdCollectionMutation(req, PGD_COLLECTIONS.reports, 'write');
  if (mutationError) return mutationError;

  const actor = getPgdSessionUser(req)!;
  const report = (await req.json().catch(() => ({}))) as PgdInspectionReport;
  if (!report?.id || report.domain !== 'pgd' || !report.requestId || !report.title || !Array.isArray(report.values)) {
    return jsonBadRequest('Báo cáo giám định PGD thiếu thông tin hồ sơ, tiêu đề hoặc giá trị kết quả.');
  }

  let persistedReport: PgdInspectionReport | undefined;
  try {
    await withPgTransaction(async (client) => {
      const requestResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1 FOR UPDATE`,
        [PGD_COLLECTIONS.requests, report.requestId],
      );
      if (!requestResult.rows[0]) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD của báo cáo.'), { statusCode: 404 });
      const currentRequest = mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest;
      assertPgdRequestEvidenceMutationAllowed(currentRequest);
      assertPgdRequestStationMutationAllowed(currentRequest, 'REPORT_APPROVAL_RETURN');

      const templateId = String(report.templateSnapshot?.templateId || '').trim();
      if (!templateId) throw Object.assign(new Error('Báo cáo PGD phải liên kết template kết quả đã snapshot.'), { statusCode: 400 });

      const templateResult = await client.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
        [PGD_COLLECTIONS.resultTemplates, templateId],
      );
      if (!templateResult.rows[0]) throw Object.assign(new Error('Không tìm thấy template kết quả PGD để kiểm tra báo cáo.'), { statusCode: 409 });
      const template = mapDocumentRow(templateResult.rows[0]) as PgdResultTemplate;
      if (template.active !== true) throw Object.assign(new Error('Template kết quả PGD đã ngừng hoạt động.'), { statusCode: 409 });
      if (template.productGroup !== currentRequest.productGroup) {
        throw Object.assign(new Error('Template kết quả PGD không khớp nhóm sản phẩm của hồ sơ.'), { statusCode: 409 });
      }

      const normalizedValues = template.fields.map((field) => {
        const incoming = report.values.find((value) => value.key === field.key);
        return {
          key: field.key,
          label: field.label,
          value: incoming?.value ?? null,
          ...(field.unit ? { unit: field.unit } : {}),
          ...(incoming?.conclusion ? { conclusion: incoming.conclusion } : {}),
        };
      });

      const valueIssues = validatePgdResultValues(template, normalizedValues);
      if (valueIssues.length > 0) {
        throw Object.assign(new Error(`Báo cáo PGD chưa đủ dữ liệu: ${valueIssues.map((issue) => issue.message).join(' ')}`), { statusCode: 400 });
      }

      const conclusion = String(report.conclusion || '').trim();
      if (!conclusion) throw Object.assign(new Error('Báo cáo PGD phải có kết luận.'), { statusCode: 400 });

      const now = new Date().toISOString();
      const nextReport: PgdInspectionReport = {
        ...report,
        domain: 'pgd',
        standardSnapshot: [...currentRequest.standards],
        templateSnapshot: snapshotPgdResultTemplate(template, now),
        values: normalizedValues,
        conclusion,
        status: 'DRAFT',
        createdAt: report.createdAt || now,
        updatedAt: now,
      };

      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at) VALUES ($1, $2, $3::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id) DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [PGD_COLLECTIONS.reports, nextReport.id, JSON.stringify(getDocumentPayload(nextReport))],
      );
      await writePgdActivity(client, actor, {
        action: 'UPDATED',
        entityId: nextReport.id,
        entityLabel: nextReport.title,
        requestCode: currentRequest.requestCode,
        summary: `Lập/cập nhật báo cáo giám định PGD cho ${currentRequest.requestCode}`,
        idSuffix: `report-${report.requestId}`,
        notify: buildPgdNotificationDraft({
          entityType: 'PGD_REPORT',
          action: 'UPDATED',
          entityId: nextReport.id,
          entityLabel: currentRequest.requestCode,
          requestCode: currentRequest.requestCode,
          actorName: actor.name || actor.username,
        }),
      });
      persistedReport = nextReport;
    });

    return jsonOk({ report: persistedReport || report });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 400;
    if (status === 404) return jsonNotFound(error.message);
    if (status === 403) return jsonForbidden(error.message);
    if (status === 409) return jsonConflict(error.message);
    return jsonBadRequest(error?.message || String(error));
  }
}
