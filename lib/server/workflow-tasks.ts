import { PoolClient } from 'pg';
import {
  PcnUserAccount,
  CertificationDossier,
  PcnDossierWorkflowTask,
  PcnDossierDocument,
  ReturnedTestResult,
  PcnApprovalStep,
  PcnDocumentRequirement,
  PcnSampleLot,
  PcnSampleRoute,
  OutboundLabRequest,
  IssuancePackage,
} from '@/types';
import { withPgTransaction } from '@/lib/server/db';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { isSafePcnSampleKey, writePcnWorkflowActivity } from '@/lib/server/workflow-templates';
import { getPcnWorkflowForDossier } from '@/utils/pcnWorkflowTemplate';
import {
  applyPcnWorkflowReturn,
  buildPcnWorkflowConditionContext,
  getPcnDossierStatusAfterWorkflowTaskComplete,
  projectPcnWorkflowRuntime,
} from '@/utils/pcnWorkflowRuntime';
import {
  buildPcnDossierNodeBusinessFacts,
  buildPcnDossierNodeWorkProjection,
} from '@/utils/pcnDossierNodeWork';
import { isPcnDossierTransitionAllowed } from '@/utils/pcnWorkflow';

export async function executePcnWorkflowTaskMutation(
  actor: PcnUserAccount,
  dossierId: string,
  taskId: string,
  action: 'start' | 'complete' | 'return',
  body: any
) {
  if (!isSafePcnSampleKey(dossierId) || !isSafePcnSampleKey(taskId)) {
    throw Object.assign(new Error('Mã hồ sơ hoặc task workflow không hợp lệ.'), { statusCode: 400 });
  }

  const expectedCycleNo = body?.expectedCycleNo === undefined ? undefined : Number(body.expectedCycleNo);
  if (action === 'complete' && expectedCycleNo !== undefined && (!Number.isInteger(expectedCycleNo) || expectedCycleNo < 1)) {
    throw Object.assign(new Error('expectedCycleNo không hợp lệ.'), { statusCode: 400 });
  }

  const now = new Date().toISOString();
  return await withPgTransaction(async (client) => {
    const dossierResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'certificationDossiers' AND document_id = $1
       LIMIT 1 FOR UPDATE`,
      [dossierId],
    );
    if (!dossierResult.rows[0]) {
      throw Object.assign(new Error('Không tìm thấy hồ sơ PCN.'), { statusCode: 404 });
    }
    const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
    if (!dossier.workflowSnapshot) {
      throw Object.assign(new Error('Hồ sơ legacy chưa có snapshot workflow để xử lý task.'), { statusCode: 409 });
    }

    const taskResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'pcnDossierWorkflowTasks'
         AND document_id = $1 AND data->>'dossierId' = $2
       LIMIT 1 FOR UPDATE`,
      [taskId, dossierId],
    );
    if (!taskResult.rows[0]) {
      throw Object.assign(new Error('Không tìm thấy task workflow trong hồ sơ.'), { statusCode: 404 });
    }
    const task = mapDocumentRow(taskResult.rows[0]) as PcnDossierWorkflowTask;

    if (action === 'complete' && expectedCycleNo !== undefined && Number(task.cycleNo || 1) !== expectedCycleNo) {
      throw Object.assign(new Error('Task đã thay đổi vòng xử lý; hãy tải lại node trước khi tiếp tục.'), { statusCode: 409 });
    }

    if (
      !isPcnSystemManager(actor) &&
      ((dossier.ownerUsername && dossier.ownerUsername !== actor.username) ||
        (task.assignedUsername && task.assignedUsername !== actor.username))
    ) {
      throw Object.assign(new Error('Bạn không được phân công task workflow này.'), { statusCode: 403 });
    }

    const workflow = getPcnWorkflowForDossier(dossier);
    const documentsResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1`,
      [dossierId],
    );
    const resultsResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'returnedResults' AND data->>'dossierId' = $1
       ORDER BY COALESCE(data->>'receivedAt', data->>'updatedAt', data->>'createdAt', '') DESC, document_id`,
      [dossierId],
    );
    const approvalStepsResult = await client.query(
      `SELECT document_id, data FROM app_documents
       WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1
       ORDER BY COALESCE((data->>'sequence')::int, 999), document_id`,
      [dossierId],
    );
    const currentTasksResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDossierWorkflowTasks' AND data->>'dossierId' = $1 ORDER BY document_id`,
      [dossierId],
    );
    const requirementDefinitionsResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDocumentRequirements' ORDER BY document_id`
    );
    const sampleLotsResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND data->>'dossierId' = $1`,
      [dossierId]
    );
    const sampleRoutesResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes'`,
      []
    );
    const labRequestsResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND data->>'dossierId' = $1`,
      [dossierId]
    );
    const issuancePackagesResult = await client.query(
      `SELECT document_id, data FROM app_documents WHERE collection_name = 'issuancePackages' AND data->>'dossierId' = $1`,
      [dossierId]
    );

    const dossierDocuments = documentsResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierDocument);
    const dossierResults = resultsResult.rows.map((row: any) => mapDocumentRow(row) as ReturnedTestResult);
    const dossierApprovalSteps = approvalStepsResult.rows.map((row: any) => mapDocumentRow(row) as PcnApprovalStep);
    const currentTasks = currentTasksResult.rows.map((row: any) => mapDocumentRow(row) as PcnDossierWorkflowTask);
    const requirementDefinitions = requirementDefinitionsResult.rows.map((row: any) => mapDocumentRow(row) as PcnDocumentRequirement);
    const sampleLots = sampleLotsResult.rows.map((row: any) => mapDocumentRow(row) as PcnSampleLot);
    const sampleRoutes = sampleRoutesResult.rows.map((row: any) => mapDocumentRow(row) as PcnSampleRoute);
    const labRequests = labRequestsResult.rows.map((row: any) => mapDocumentRow(row) as OutboundLabRequest);
    const issuancePackages = issuancePackagesResult.rows.map((row: any) => mapDocumentRow(row) as IssuancePackage);

    const conditionContext = buildPcnWorkflowConditionContext({
      workflow,
      documents: dossierDocuments,
      documentWaivers: dossier.documentWaivers,
      results: dossierResults,
      approvalSteps: dossierApprovalSteps,
      fieldCodes: dossier.fieldCodes,
      method: dossier.method,
    });

    let nextTasks = currentTasks;
    if (action === 'start') {
      const projected = projectPcnWorkflowRuntime({
        workflow,
        tasks: currentTasks,
        documents: dossierDocuments,
        documentWaivers: dossier.documentWaivers,
        conditionContext,
      });
      const projectedNode = projected.byNodeId[task.nodeId];
      const conditionActivatedTask = task.status === 'LOCKED' && projectedNode?.status === 'READY';
      if (!['READY', 'RETURNED'].includes(task.status) && !conditionActivatedTask) {
        throw Object.assign(new Error('Task chỉ được bắt đầu khi đang READY hoặc RETURNED.'), { statusCode: 409 });
      }
      nextTasks = currentTasks.map((item) =>
        item.id === task.id
          ? { ...item, status: 'IN_PROGRESS' as const, startedAt: item.startedAt || now, updatedAt: now, updatedBy: actor.username }
          : item
      );
    } else if (action === 'complete') {
      const projected = projectPcnWorkflowRuntime({
        workflow,
        tasks: currentTasks,
        documents: dossierDocuments,
        documentWaivers: dossier.documentWaivers,
        conditionContext,
      });
      const projectedNode = projected.byNodeId[task.nodeId];
      const conditionActivatedTask = task.status === 'LOCKED' && projectedNode?.status === 'READY';
      if ((!['READY', 'IN_PROGRESS'].includes(task.status) && !conditionActivatedTask) || !projectedNode || projectedNode.blockedReason) {
        throw Object.assign(new Error('Task chưa đủ điều kiện hoặc còn tài liệu bắt buộc.'), { statusCode: 409 });
      }
      const workProjection = buildPcnDossierNodeWorkProjection({
        node: projectedNode,
        runtimeNode: projectedNode,
        requirements: requirementDefinitions,
        documents: dossierDocuments,
        documentWaivers: dossier.documentWaivers,
        businessFacts: buildPcnDossierNodeBusinessFacts({
          actionKey: projectedNode.actionKey,
          dossierId: dossier.id,
          dossierStatus: dossier.status,
          ownerUsername: dossier.ownerUsername,
          sampleLots,
          sampleRoutes,
          labRequests,
          results: dossierResults,
          approvalSteps: dossierApprovalSteps,
          issuancePackages,
        }),
      });
      if (!workProjection.canContinue) {
        throw Object.assign(
          new Error(`Node chưa đủ điều kiện để tiếp tục${workProjection.suggestions.length ? `: ${workProjection.suggestions.join('; ')}` : '.'}`),
          { statusCode: 409 }
        );
      }
      nextTasks = currentTasks.map((item) =>
        item.id === task.id
          ? { ...item, status: 'COMPLETED' as const, completedAt: now, updatedAt: now, updatedBy: actor.username }
          : item
      );
      const after = projectPcnWorkflowRuntime({
        workflow,
        tasks: nextTasks,
        documents: dossierDocuments,
        documentWaivers: dossier.documentWaivers,
        conditionContext,
      });
      nextTasks = nextTasks.map((item) =>
        after.byNodeId[item.nodeId]?.status === 'READY' && item.status === 'LOCKED'
          ? { ...item, status: 'READY' as const, updatedAt: now, updatedBy: actor.username }
          : item
      );
    } else {
      const targetNodeId = String(body?.targetNodeId || '').trim();
      const reason = String(body?.reason || '').trim();
      const returned = applyPcnWorkflowReturn({
        workflow,
        tasks: currentTasks,
        sourceNodeId: task.nodeId,
        targetNodeId,
        reason,
        actor: actor.username,
        now,
      });
      nextTasks = returned.tasks;
    }

    let nextDossier = dossier;
    if (action === 'complete') {
      const targetStatus = getPcnDossierStatusAfterWorkflowTaskComplete(
        workflow.nodes.find((node) => node.id === task.nodeId) || { id: task.nodeId },
        dossier.status,
      );
      if (targetStatus && targetStatus !== dossier.status) {
        if (!isPcnDossierTransitionAllowed(dossier.status, targetStatus)) {
          throw Object.assign(new Error(`Không thể đồng bộ trạng thái hồ sơ từ ${dossier.status} sang ${targetStatus}.`), { statusCode: 409 });
        }
        nextDossier = { ...dossier, status: targetStatus, updatedAt: now };
        await client.query(
          `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
           WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
          [dossier.id, JSON.stringify(getDocumentPayload(nextDossier))],
        );
      }
    }

    for (const nextTask of nextTasks) {
      await client.query(
        `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
         VALUES ('pcnDossierWorkflowTasks', $1, $2::jsonb, CURRENT_TIMESTAMP)
         ON CONFLICT (collection_name, document_id)
         DO UPDATE SET data = EXCLUDED.data, updated_at = CURRENT_TIMESTAMP`,
        [nextTask.id, JSON.stringify(getDocumentPayload(nextTask))],
      );
    }

    const updatedTask = nextTasks.find((item) => item.id === task.id)!;
    const actionLabel = action === 'start' ? 'bắt đầu' : action === 'complete' ? 'hoàn tất' : 'trả lại';
    const activityLog = await writePcnWorkflowActivity(client, {
      action: action === 'return' ? 'STATUS_CHANGED' : 'UPDATED',
      entityId: task.id,
      entityLabel: dossier.dossierCode,
      summary: `Task ${task.nodeId} đã ${actionLabel}.`,
      actor,
      createdAt: now,
    });

    return { task: updatedTask, tasks: nextTasks, dossier: nextDossier, activityLog };
  });
}
