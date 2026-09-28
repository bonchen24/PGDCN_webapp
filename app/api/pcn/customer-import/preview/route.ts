import { NextRequest } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser, isSessionAdmin } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import {
  buildPcnCustomerImportPreviewData,
  buildPcnCustomerMigrationPreview,
  loadPcnCustomersForImport,
  readPcnCustomerImportRequest,
} from '@/lib/server/pcn-customers';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!isSessionAdmin(actor)) {
    return jsonForbidden('Chỉ Admin mới có quyền thực hiện thao tác này.');
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  try {
    const request = readPcnCustomerImportRequest(body);
    const existing = await loadPcnCustomersForImport(pool);
    const preview = buildPcnCustomerMigrationPreview(request.customers, existing, {
      sourceLabel: request.sourceLabel,
    });
    return jsonOk({ preview: buildPcnCustomerImportPreviewData(preview, existing) });
  } catch (error: any) {
    console.error('PCN customer import preview error:', error);
    const status = Number(error?.statusCode) || 400;
    return jsonError(String(error?.message || error), status);
  }
}
