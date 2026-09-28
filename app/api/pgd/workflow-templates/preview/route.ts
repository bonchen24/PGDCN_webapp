import { NextRequest } from 'next/server';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { isPgdWorkflowManager } from '@/lib/server/workflow-templates';
import { validateDossierTemplateEditorModel } from '@/utils/pgdcnDossierTemplate';
import { buildPgdArchifyWorkflowTemplate } from '@/utils/pgdArchifyWorkflowTemplate';
import { renderArchifyWorkflowDocument } from '@/utils/pcnArchifyRenderer';
import { PcnUserAccount } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req) as PcnUserAccount | null;
  if (!actor) {
    return jsonUnauthorized('Phiên PGD không hợp lệ hoặc đã hết hạn.');
  }
  if (!isPgdWorkflowManager(actor)) {
    return jsonForbidden('Chỉ Admin hoặc Quản lý PGD được thay đổi bộ hồ sơ mẫu.');
  }

  let model: any;
  try {
    model = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  if (model?.domain !== 'PGD') {
    return jsonError('Preview PGD cần model domain PGD.', 400);
  }

  const validation = validateDossierTemplateEditorModel(model);
  if (!validation.valid) {
    return jsonError(validation.errors.join(' '), 400, { issues: validation.errors });
  }

  try {
    const html = await renderArchifyWorkflowDocument(buildPgdArchifyWorkflowTemplate(model), {
      domain: 'pgd',
      recordId: `template-preview-${String(model.id).trim()}`,
    });
    return jsonOk({ html });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 422;
    return jsonError(error?.message || 'Không thể tạo preview Archify PGD.', status);
  }
}
