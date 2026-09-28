import { NextRequest } from 'next/server';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { isPcnWorkflowManager } from '@/lib/server/workflow-templates';
import { validateDossierTemplateEditorModel } from '@/utils/pgdcnDossierTemplate';
import { buildPcnArchifyWorkflowTemplate } from '@/utils/pcnArchifyWorkflowTemplate';
import { renderArchifyWorkflowDocument } from '@/utils/pcnArchifyRenderer';
import { PcnUserAccount } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const actor = getPcnSessionUser(req) as PcnUserAccount | null;
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!isPcnWorkflowManager(actor)) {
    return jsonForbidden('Chỉ Admin hoặc Quản lý PCN được thay đổi bộ hồ sơ mẫu.');
  }

  let model: any;
  try {
    model = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  if (model?.domain !== 'PCN') {
    return jsonError('Preview PCN cần model domain PCN.', 400);
  }

  const validation = validateDossierTemplateEditorModel(model);
  if (!validation.valid) {
    return jsonError(validation.errors.join(' '), 400, { issues: validation.errors });
  }

  try {
    const html = await renderArchifyWorkflowDocument(buildPcnArchifyWorkflowTemplate(model), {
      domain: 'pcn',
      recordId: `template-preview-${String(model.id).trim()}`,
    });
    return jsonOk({ html });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 422;
    return jsonError(error?.message || 'Không thể tạo preview Archify PCN.', status);
  }
}
