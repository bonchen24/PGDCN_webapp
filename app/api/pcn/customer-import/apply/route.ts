import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, isSessionAdmin } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import {
  PcnCustomerImportApplyInput,
  applyPcnCustomerImport,
  buildPcnCustomerMigrationPreview,
  getPcnCustomerImportTargetHash,
  loadPcnCustomersForImport,
  readPcnCustomerImportRequest,
  requirePcnImportBackup,
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
    const expectedSourceHash = String(body?.expectedSourceHash || '').trim().toLowerCase();
    const expectedTargetHashBefore = String(body?.expectedTargetHashBefore || '').trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expectedSourceHash) || !/^[a-f0-9]{64}$/.test(expectedTargetHashBefore)) {
      return jsonError('Preview import đã hết hạn hoặc thiếu fingerprint đối soát.', 409);
    }
    if (String((body as PcnCustomerImportApplyInput)?.confirmation || '') !== 'KHOI_TAO_DANH_MUC_PCN') {
      return jsonError('Thiếu xác nhận chính xác: KHOI_TAO_DANH_MUC_PCN.', 400);
    }

    const migrationStartedAt = new Date();
    const backupCheckpoint = await requirePcnImportBackup(migrationStartedAt);
    const result = await withPgTransaction(async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', ['pcn-customer-import']);
      const existing = await loadPcnCustomersForImport(client, true);
      const currentTargetHash = getPcnCustomerImportTargetHash(existing);
      if (currentTargetHash !== expectedTargetHashBefore) {
        throw Object.assign(
          new Error('Danh mục khách hàng đã thay đổi sau preview; hãy tải lại preview trước khi apply.'),
          { statusCode: 409 }
        );
      }
      const preview = buildPcnCustomerMigrationPreview(request.customers, existing, {
        sourceLabel: request.sourceLabel,
      });
      if (preview.sourceHash !== expectedSourceHash) {
        throw Object.assign(
          new Error('Nguồn khách hàng đã thay đổi sau preview; hãy chọn lại file và lập preview mới.'),
          { statusCode: 409 }
        );
      }
      if (preview.rejected.length > 0) {
        throw Object.assign(new Error('Không thể apply khi nguồn còn dòng không hợp lệ.'), { statusCode: 400 });
      }
      if (preview.duplicateKeys.length > 0) {
        throw Object.assign(new Error('Không thể apply khi nguồn còn khóa khách hàng trùng.'), { statusCode: 400 });
      }
      return await applyPcnCustomerImport(
        preview,
        existing,
        backupCheckpoint,
        {
          username: actor.username,
          name: actor.name,
          role: (actor as any).systemRole || actor.role,
        },
        client,
        request.aliasDecisions
      );
    });
    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN customer import apply error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(String(error?.message || error), status);
  }
}
