import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/server/db';
import { requirePgdSession } from '@/lib/server/pgd';
import { jsonError, jsonNotFound } from '@/lib/server/response';
import { mapDocumentRow } from '@/lib/server/collections';
import { ARCHIFY_DIAGRAM_TYPES, ArchifyDiagramType } from '@/utils/archifyDiagram';
import { buildPgdArchifyDiagramSuite } from '@/utils/pgdArchifyWorkflow';
import { renderArchifyDiagram } from '@/utils/pcnArchifyRenderer';
import {
  PGD_COLLECTIONS,
  PgdApprovalStep,
  PgdFieldInspection,
  PgdInspectionAssignment,
  PgdInspectionCertificate,
  PgdInspectionReport,
  PgdInspectionRequest,
  PgdLabRequest,
  PgdLabResult,
  PgdSample,
} from '@/utils/pgdDomain';
import { PgdDossierDocument } from '@/utils/pgdDossier';
import { PgdLabResultReview } from '@/utils/pgdArtifacts';

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
  { params }: { params: Promise<{ requestId: string }> }
) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  const { requestId: rawRequestId } = await params;
  const requestId = decodeURIComponent(String(rawRequestId || '')).trim();
  if (!requestId || requestId.length > 240 || /[\\/]/.test(requestId)) {
    return jsonError('Mã hồ sơ PGD không hợp lệ.', 400);
  }

  const url = new URL(req.url);
  let diagramType: ArchifyDiagramType;
  try {
    diagramType = parseArchifyDiagramType(url.searchParams.get('diagram'));
  } catch (error: any) {
    return jsonError('Loại sơ đồ Archify không hợp lệ.', 400);
  }

  try {
    const readRows = (collectionName: string, order = 'updated_at DESC, document_id ASC') =>
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd' ORDER BY ${order}`,
        [collectionName, requestId],
      );

    const [
      requestResult,
      assignmentResult,
      fieldResult,
      sampleResult,
      labRequestResult,
      labResultResult,
      reportResult,
      certificateResult,
      labReviewResult,
      documentResult,
      approvalResult,
      activityResult,
    ] = await Promise.all([
      pool.query(
        `SELECT document_id, data FROM app_documents WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
        [PGD_COLLECTIONS.requests, requestId],
      ),
      readRows(PGD_COLLECTIONS.assignments),
      readRows(PGD_COLLECTIONS.fieldInspections),
      readRows(PGD_COLLECTIONS.samples, 'document_id ASC'),
      readRows(PGD_COLLECTIONS.labRequests, 'document_id ASC'),
      readRows(PGD_COLLECTIONS.labResults, 'document_id ASC'),
      readRows(PGD_COLLECTIONS.reports),
      readRows(PGD_COLLECTIONS.certificates),
      readRows(PGD_COLLECTIONS.labResultReviews),
      readRows(PGD_COLLECTIONS.dossierDocuments, "COALESCE((data->>'version')::int, 0) DESC, updated_at DESC, document_id DESC"),
      readRows(PGD_COLLECTIONS.approvals, "COALESCE((data->>'sequence')::int, 0), document_id ASC"),
      readRows(PGD_COLLECTIONS.activityLogs, "data->>'createdAt' ASC, document_id ASC"),
    ]);

    const request = requestResult.rows[0] ? (mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest) : undefined;
    if (!request) return jsonNotFound('Không tìm thấy hồ sơ PGD.');

    const suite = buildPgdArchifyDiagramSuite({
      request,
      assignment: assignmentResult.rows[0] ? (mapDocumentRow(assignmentResult.rows[0]) as PgdInspectionAssignment) : undefined,
      fieldInspection: fieldResult.rows[0] ? (mapDocumentRow(fieldResult.rows[0]) as PgdFieldInspection) : undefined,
      samples: sampleResult.rows.map((row: any) => mapDocumentRow(row)) as PgdSample[],
      labRequests: labRequestResult.rows.map((row: any) => mapDocumentRow(row)) as PgdLabRequest[],
      labResults: labResultResult.rows.map((row: any) => mapDocumentRow(row)) as PgdLabResult[],
      report: reportResult.rows[0] ? (mapDocumentRow(reportResult.rows[0]) as PgdInspectionReport) : undefined,
      certificate: certificateResult.rows[0] ? (mapDocumentRow(certificateResult.rows[0]) as PgdInspectionCertificate) : undefined,
      labResultReview: labReviewResult.rows[0] ? (mapDocumentRow(labReviewResult.rows[0]) as PgdLabResultReview) : undefined,
      dossierDocuments: documentResult.rows.map((row: any) => mapDocumentRow(row)) as PgdDossierDocument[],
      approvals: approvalResult.rows.map((row: any) => mapDocumentRow(row)) as PgdApprovalStep[],
      activityLogs: activityResult.rows.map((row: any) => mapDocumentRow(row)) as Array<Record<string, unknown>>,
    });

    let document: unknown;
    if (diagramType === 'workflow') {
      document = suite.workflow;
    } else {
      const unavailable = (suite as any)[diagramType];
      if (unavailable.available === false) {
        return jsonError('Biểu đồ Archify hiện chưa khả dụng.', 409, {
          diagram: diagramType,
          reason: unavailable.reason,
        });
      }
      document = unavailable.document;
    }

    const rendered = await renderArchifyDiagram(diagramType, document, { domain: 'pgd', recordId: request.id });
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
    const status = Number(error?.statusCode) === 404 ? 404 : Number(error?.statusCode) === 422 ? 422 : 500;
    return jsonError(
      status === 422 ? 'Không thể render biểu đồ Archify.' : 'Không thể mở biểu đồ Archify.',
      status,
      { diagram: diagramType },
    );
  }
}
