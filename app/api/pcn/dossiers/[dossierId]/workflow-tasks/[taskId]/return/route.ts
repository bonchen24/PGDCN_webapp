import { NextRequest } from 'next/server';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { executePcnWorkflowTaskMutation } from '@/lib/server/workflow-tasks';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ dossierId: string; taskId: string }> }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const dossierId = String(resolvedParams.dossierId || '').trim();
  const taskId = String(resolvedParams.taskId || '').trim();

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // optional body
  }

  try {
    const result = await executePcnWorkflowTaskMutation(actor, dossierId, taskId, 'return', body);
    return jsonOk(result);
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
