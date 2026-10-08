import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { getPcnSessionUser } from '@/lib/server/auth';
import { jsonError, jsonNotFound, jsonUnauthorized } from '@/lib/server/response';
import { mapDocumentRow } from '@/lib/server/collections';
import { isSafePcnSampleKey } from '@/lib/server/workflow-templates';
import { ARCHIFY_DIAGRAM_TYPES, ArchifyDiagramType } from '@/utils/archifyDiagram';
import { getPcnWorkflowForDossier } from '@/utils/pcnWorkflowTemplate';
import { buildPcnArchifyDiagramSuite } from '@/utils/pcnArchifyWorkflow';
import { renderArchifyDiagram } from '@/utils/pcnArchifyRenderer';
import {
  ActivityLog,
  CertificationDossier,
  PcnApprovalStep,
  PcnDossierDocument,
  PcnDossierWorkflowTask,
  ReturnedTestResult,
} from '@/types';

export const dynamic = 'force-dynamic';

function parseArchifyDiagramType(value: unknown): ArchifyDiagramType {
  const diagram = String(value ?? '').trim().toLowerCase() || 'workflow';
  if (!ARCHIFY_DIAGRAM_TYPES.includes(diagram as ArchifyDiagramType)) {
    throw Object.assign(new Error('Loại sơ đồ Archify không hợp lệ.'), { statusCode: 400 });
  }
  return diagram as ArchifyDiagramType;
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ dossierId: string }> }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const dossierId = String(resolvedParams.dossierId || '').trim();
  if (!isSafePcnSampleKey(dossierId)) {
    return jsonError('Mã hồ sơ không hợp lệ.', 400);
  }

  const url = new URL(req.url);
  let diagramType: ArchifyDiagramType;
  try {
    diagramType = parseArchifyDiagramType(url.searchParams.get('diagram'));
  } catch (error: any) {
    return jsonError('Loại sơ đồ Archify không hợp lệ.', 400);
  }

  try {
    const [
      dossierResult,
      documentResult,
      resultResult,
      approvalResult,
      taskResult,
      activityResult,
    ] = await Promise.all([
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
        [dossierId]
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1 ORDER BY document_id`,
        [dossierId]
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'returnedResults' AND data->>'dossierId' = $1 ORDER BY document_id`,
        [dossierId]
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'approvalSteps' AND data->>'dossierId' = $1 ORDER BY document_id`,
        [dossierId]
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDossierWorkflowTasks' AND data->>'dossierId' = $1 ORDER BY document_id`,
        [dossierId]
      ),
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = 'activityLogs' AND (data->>'entityId' = $1 OR data->>'requestCode' = $1) ORDER BY data->>'createdAt', document_id`,
        [dossierId]
      ),
    ]);

    const dossier = dossierResult.rows[0]
      ? (mapDocumentRow(dossierResult.rows[0]) as CertificationDossier)
      : undefined;
    if (!dossier) {
      return jsonNotFound('Không tìm thấy hồ sơ PCN.');
    }

    const workflow = getPcnWorkflowForDossier(dossier);
    const suite = buildPcnArchifyDiagramSuite({
      dossier,
      workflow,
      tasks: taskResult.rows.map((row: any) => mapDocumentRow(row)) as PcnDossierWorkflowTask[],
      documents: documentResult.rows.map((row: any) => mapDocumentRow(row)) as PcnDossierDocument[],
      documentWaivers: dossier.documentWaivers,
      results: resultResult.rows.map((row: any) => mapDocumentRow(row)) as ReturnedTestResult[],
      approvalSteps: approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PcnApprovalStep[],
      activityLogs: activityResult.rows.map((row: any) => mapDocumentRow(row)) as ActivityLog[],
    });

    let document: unknown;
    if (diagramType === 'workflow') {
      document = suite.workflow;
    } else {
      const unavailable = suite[diagramType];
      if (unavailable.available === false) {
        return jsonError('Biểu đồ Archify hiện chưa khả dụng.', 409, {
          diagram: diagramType,
          reason: unavailable.reason,
        });
      }
      document = unavailable.document;
    }

    const rendered = await renderArchifyDiagram(diagramType, document, {
      domain: 'pcn',
      recordId: dossier.id,
    });
    if (rendered.available === false) {
      return jsonError('Biểu đồ Archify hiện chưa khả dụng.', 409, {
        diagram: diagramType,
        reason: rendered.reason,
      });
    }

    return new NextResponse(rendered.html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (error: any) {
    const status =
      Number(error?.statusCode) === 404
        ? 404
        : Number(error?.statusCode) === 422
        ? 422
        : 500;
    return jsonError(
      status === 422 ? 'Không thể render biểu đồ Archify.' : 'Không thể mở biểu đồ Archify.',
      status,
      { diagram: diagramType }
    );
  }
}
