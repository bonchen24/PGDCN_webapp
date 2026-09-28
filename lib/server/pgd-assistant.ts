// Author: Gemini
// OS support: Web/Node
// Description: PGD Assistant data loading, OCR and document text extraction, and semantic review

import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import * as xlsx from 'xlsx';
import { pool } from './postgres';
import { mapDocumentRow } from './collections';
import { getPgdStorageBucket, getPgdStorageClient } from './pgd-files';
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
import {
  PgdCaseEvent,
  PgdDossierIndex,
  PgdFieldActivityLog,
  PgdInspectionPlan,
  PgdLabResultReview,
} from '@/utils/pgdArtifacts';
import {
  PgdAssistantCriterion,
  PgdAssistantEvidence,
  PgdAssistantReviewInput,
  PgdAssistantTextEvidence,
  PgdAssistantUnreadableFile,
} from '@/utils/pgdAssistant';
import { PgdOperationalStationKey } from '@/utils/pgdWorkflow';
import {
  PgdDossierDocument,
  getCurrentPgdDossierDocuments,
  getPgdDossierRequirementStationKey,
} from '@/utils/pgdDossier';
import { extractPcnDocxEmbeddedImages } from '@/utils/pcnDocxOcr';
import { PcnPaddleOcrUnavailableError } from '@/utils/pcnApprovalReviewOcr';
import { fetchApprovalAssistantPaddlePage } from './pcn-approval-assistant';
import {
  Type,
  generateContentWithRetryAndFallback,
  getPersonalGeminiClient,
  getPersonalGeminiModel,
} from './gemini';

export type PgdAssistantAssetReference = {
  assetId: string;
  documentId: string;
  documentType: 'DOSSIER' | 'GENERATED';
  fileName: string;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceJsonPath: string;
  checksum: string;
  criterionId: PgdAssistantCriterion['id'];
  tab: PgdAssistantEvidence['tab'];
};

export type PgdAssistantLoadedInput = {
  input: PgdAssistantReviewInput;
  dossierDocuments: PgdDossierDocument[];
};

export const pgdAssistantTabByStation: Record<PgdOperationalStationKey, PgdAssistantEvidence['tab']> = {
  INTAKE_CAPABILITY: 'overview',
  PREPARATION: 'overview',
  FIELD_SAMPLING: 'sampling',
  LAB_RESULTS: 'results',
  REPORT_APPROVAL_RETURN: 'approval',
};

export const pgdAssistantCriterionByStation: Record<PgdOperationalStationKey, PgdAssistantCriterion['id']> = {
  INTAKE_CAPABILITY: 'DOSSIER_DOCUMENTS',
  PREPARATION: 'INSPECTION_PLAN',
  FIELD_SAMPLING: 'FIELD_EVIDENCE',
  LAB_RESULTS: 'LAB_RESULTS_REVIEW',
  REPORT_APPROVAL_RETURN: 'REPORT_APPROVAL_RETURN',
};

export async function readPgdAssistantRows(collectionName: string, requestId: string) {
  const result = await pool.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = $1 AND data->>'requestId' = $2 AND data->>'domain' = 'pgd'
     ORDER BY updated_at DESC, document_id ASC`,
    [collectionName, requestId],
  );
  return result.rows.map(mapDocumentRow);
}

export async function loadPgdAssistantInput(requestId: string): Promise<PgdAssistantLoadedInput> {
  const requestResult = await pool.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = $1 AND document_id = $2 AND data->>'domain' = 'pgd' LIMIT 1`,
    [PGD_COLLECTIONS.requests, requestId],
  );
  const request = requestResult.rows[0] ? (mapDocumentRow(requestResult.rows[0]) as PgdInspectionRequest) : undefined;
  if (!request) throw Object.assign(new Error('Không tìm thấy hồ sơ PGD.'), { statusCode: 404 });

  const [
    assignments,
    inspectionPlans,
    caseEvents,
    fieldActivityLogs,
    fieldInspections,
    samples,
    labRequests,
    labResults,
    labResultReviews,
    reports,
    certificates,
    approvals,
    dossierIndexes,
    dossierDocuments,
  ] = await Promise.all([
    readPgdAssistantRows(PGD_COLLECTIONS.assignments, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.inspectionPlans, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.caseEvents, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.fieldActivityLogs, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.fieldInspections, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.samples, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.labRequests, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.labResults, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.labResultReviews, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.reports, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.certificates, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.approvals, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.dossierIndexes, request.id),
    readPgdAssistantRows(PGD_COLLECTIONS.dossierDocuments, request.id),
  ]);

  return {
    input: {
      request,
      assignments: assignments as PgdInspectionAssignment[],
      inspectionPlans: inspectionPlans as PgdInspectionPlan[],
      caseEvents: caseEvents as PgdCaseEvent[],
      fieldActivityLogs: fieldActivityLogs as PgdFieldActivityLog[],
      fieldInspections: fieldInspections as PgdFieldInspection[],
      samples: samples as PgdSample[],
      labRequests: labRequests as PgdLabRequest[],
      labResults: labResults as PgdLabResult[],
      labResultReviews: labResultReviews as PgdLabResultReview[],
      reports: reports as PgdInspectionReport[],
      certificates: certificates as PgdInspectionCertificate[],
      approvals: approvals as PgdApprovalStep[],
      dossierIndexes: dossierIndexes as PgdDossierIndex[],
    },
    dossierDocuments: dossierDocuments as PgdDossierDocument[],
  };
}

export function getPgdAssistantAssetReferences(
  input: PgdAssistantReviewInput,
  documents: PgdDossierDocument[],
): PgdAssistantAssetReference[] {
  const references: PgdAssistantAssetReference[] = [];
  const seenAssetIds = new Set<string>();
  const append = (reference: PgdAssistantAssetReference) => {
    if (seenAssetIds.has(reference.assetId)) return;
    seenAssetIds.add(reference.assetId);
    references.push(reference);
  };

  for (const document of getCurrentPgdDossierDocuments(documents).filter((item) => Boolean(item.fileAssetId))) {
    const station = getPgdDossierRequirementStationKey(document.requirementCode);
    const criterionId = pgdAssistantCriterionByStation[station];
    const generated = document.originCollection === PGD_COLLECTIONS.documents && Boolean(document.originDocumentId);
    append({
      assetId: document.fileAssetId!,
      documentId: generated ? document.originDocumentId! : document.id,
      documentType: generated ? 'GENERATED' : 'DOSSIER',
      fileName: document.fileName,
      sourceCollection: generated ? PGD_COLLECTIONS.documents : PGD_COLLECTIONS.dossierDocuments,
      sourceDocumentId: generated ? document.originDocumentId! : document.id,
      sourceJsonPath: generated ? 'output' : 'fileAssetId',
      checksum: document.checksum,
      criterionId,
      tab: pgdAssistantTabByStation[station],
    });
  }

  for (const pointer of input.request.documentPointers || []) {
    if (!pointer.assetId || !pointer.sourceCollection || !pointer.sourceDocumentId) continue;
    if (pointer.sourceCollection !== PGD_COLLECTIONS.documents) {
      throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Pointer tài liệu ${pointer.fileName} không thuộc collection PGD được phép.`);
    }
    const station = getPgdDossierRequirementStationKey(pointer.requirementCode || 'REQUEST_PYC');
    const criterionId = pgdAssistantCriterionByStation[station];
    const generated = pointer.sourceCollection === PGD_COLLECTIONS.documents;
    append({
      assetId: pointer.assetId,
      documentId: pointer.sourceDocumentId,
      documentType: generated ? 'GENERATED' : 'DOSSIER',
      fileName: pointer.fileName,
      sourceCollection: pointer.sourceCollection,
      sourceDocumentId: pointer.sourceDocumentId,
      sourceJsonPath: generated ? 'output' : 'fileAssetId',
      checksum: pointer.checksum,
      criterionId,
      tab: pgdAssistantTabByStation[station],
    });
  }

  for (const inspection of input.fieldInspections || []) {
    for (const assetId of inspection.evidenceAssetIds || []) {
      append({
        assetId,
        documentId: inspection.id,
        documentType: 'DOSSIER',
        fileName: assetId,
        sourceCollection: PGD_COLLECTIONS.fieldInspections,
        sourceDocumentId: inspection.id,
        sourceJsonPath: 'evidenceAssetIds',
        checksum: '',
        criterionId: 'FIELD_EVIDENCE',
        tab: 'sampling',
      });
    }
  }

  return references;
}

export async function fetchPgdAssistantPaddlePage(
  reference: PgdAssistantAssetReference,
  bytes: Buffer,
  mimeType: string,
  page: number,
): Promise<PgdAssistantTextEvidence> {
  const normalized = await fetchApprovalAssistantPaddlePage(
    {
      assetId: reference.assetId,
      fileName: reference.fileName,
      sourceCollection: 'dossierDocuments',
      sourceDocumentId: reference.documentId,
      sourceJsonPath: 'fileAssetId',
      tab: 'documents' as const,
    },
    bytes,
    mimeType,
    page,
  );
  return { ...normalized, documentId: reference.documentId, documentType: reference.documentType, tab: reference.tab };
}

export async function fetchPgdAssistantGeminiPage(
  req: NextRequest | Request,
  reference: PgdAssistantAssetReference,
  bytes: Buffer,
  mimeType: string,
  page: number,
): Promise<PgdAssistantTextEvidence> {
  const ai = await getPersonalGeminiClient(req);
  const response = await generateContentWithRetryAndFallback(
    ai,
    {
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType || 'application/pdf', data: bytes.toString('base64') } },
          { text: `Đọc riêng trang ${page} của tài liệu ${reference.fileName}. Chỉ chép lại chữ nhìn thấy, không suy đoán. Trả JSON có trường text chứa toàn bộ nội dung đọc được theo dòng.` },
        ],
      },
      config: { responseMimeType: 'application/json', responseSchema: { type: Type.OBJECT, properties: { text: { type: Type.STRING } } } },
    },
    await getPersonalGeminiModel(req),
  );
  const raw = String(response.text || '').replace(/```json|```/g, '').trim();
  const text = String(JSON.parse(raw)?.text || '').replace(/\u0000/g, '').trim();
  if (!text) throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_EMPTY', `Gemini không đọc được ${reference.fileName}, trang ${page}.`);
  return { assetId: reference.assetId, fileName: reference.fileName, text, page, confidence: 0.78, documentId: reference.documentId, documentType: reference.documentType, tab: reference.tab };
}

export async function fetchPgdAssistantOcrPage(
  req: NextRequest | Request,
  reference: PgdAssistantAssetReference,
  bytes: Buffer,
  mimeType: string,
  page: number,
): Promise<PgdAssistantTextEvidence> {
  try {
    return await fetchPgdAssistantPaddlePage(reference, bytes, mimeType, page);
  } catch (error) {
    if (!(error instanceof PcnPaddleOcrUnavailableError)) throw error;
    return fetchPgdAssistantGeminiPage(req, reference, bytes, mimeType, page);
  }
}

export async function extractPgdAssistantTexts(
  req: NextRequest | Request,
  input: PgdAssistantReviewInput,
  documents: PgdDossierDocument[],
): Promise<{ documentTexts: PgdAssistantTextEvidence[]; unreadableFiles: PgdAssistantUnreadableFile[] }> {
  const references = getPgdAssistantAssetReferences(input, documents);
  if (references.length === 0) return { documentTexts: [], unreadableFiles: [] };

  const assetResult = await pool.query(
    `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, sha256
     FROM file_assets WHERE id = ANY($1::text[])`,
    [references.map((r) => r.assetId)],
  );
  const assetById = new Map(assetResult.rows.map((asset: any) => [String(asset.id), asset]));
  const storage = getPgdStorageClient();
  const documentTexts: PgdAssistantTextEvidence[] = [];
  const unreadableFiles: PgdAssistantUnreadableFile[] = [];

  for (const reference of references) {
    const asset = assetById.get(reference.assetId);
    if (!asset) throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Không tìm thấy private asset ${reference.assetId} để đọc hồ sơ PGD.`);
    if (
      String(asset.bucket_name) !== getPgdStorageBucket() ||
      String(asset.source_collection) !== reference.sourceCollection ||
      String(asset.source_document_id) !== reference.sourceDocumentId ||
      String(asset.source_json_path) !== reference.sourceJsonPath ||
      (reference.checksum && String(asset.sha256 || '').toLowerCase() !== reference.checksum.toLowerCase())
    ) {
      throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Private asset ${reference.assetId} không trỏ đúng về hồ sơ PGD đang kiểm tra.`);
    }

    const downloaded = await storage.downloadObject({ bucketName: String(asset.bucket_name), objectPath: String(asset.object_path) });
    const mimeType = String(asset.mime_type || downloaded.contentType || 'application/octet-stream').toLowerCase();
    const extension = reference.fileName.toLowerCase().split('.').pop() || '';
    const isDocx = extension === 'docx' || mimeType.includes('wordprocessingml.document');
    const isPdf = extension === 'pdf' || mimeType.includes('pdf');
    const isImage = mimeType.startsWith('image/') || /^(png|jpe?g|webp|tiff?)$/.test(extension);
    const isSpreadsheet = ['xls', 'xlsx'].includes(extension) || mimeType.includes('spreadsheetml') || mimeType.includes('ms-excel');

    if (isDocx) {
      const docxResult = await mammoth.extractRawText({ buffer: downloaded.body });
      const text = String(docxResult.value || '').trim();
      if (text) {
        documentTexts.push({ assetId: reference.assetId, fileName: reference.fileName, documentId: reference.documentId, documentType: reference.documentType, text, confidence: 0.95, tab: reference.tab });
        continue;
      }
      const embeddedImages = extractPcnDocxEmbeddedImages(downloaded.body);
      if (embeddedImages.length === 0) {
        documentTexts.push(await fetchPgdAssistantOcrPage(req, reference, downloaded.body, mimeType, 1));
        continue;
      }
      const evidenceBeforeDocx = documentTexts.length;
      for (const [index, image] of embeddedImages.entries()) {
        const imageReference = { ...reference, fileName: `${reference.fileName} · ${image.fileName}` };
        try {
          documentTexts.push(await fetchPgdAssistantOcrPage(req, imageReference, image.bytes, image.mimeType, index + 1));
        } catch (error) {
          if (error instanceof PcnPaddleOcrUnavailableError && (error.code === 'PADDLE_OCR_EMPTY' || error.code === 'PADDLE_OCR_LOW_CONFIDENCE')) continue;
          throw error;
        }
      }
      if (documentTexts.length === evidenceBeforeDocx) throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_EMPTY', `PaddleOCR không đọc được ảnh nhúng trong ${reference.fileName}.`);
      continue;
    }

    if (isPdf) {
      let pdf: PDFDocument;
      try {
        pdf = await PDFDocument.load(downloaded.body, { ignoreEncryption: true });
      } catch {
        throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Không mở được PDF ${reference.fileName} để chạy PaddleOCR.`);
      }
      const pageCount = pdf.getPageCount();
      if (pageCount < 1) throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_EMPTY', `PDF ${reference.fileName} không có trang để đọc.`);
      for (let page = 1; page <= pageCount; page += 1) {
        documentTexts.push(await fetchPgdAssistantOcrPage(req, reference, downloaded.body, 'application/pdf', page));
      }
      continue;
    }

    if (isImage) {
      documentTexts.push(await fetchPgdAssistantOcrPage(req, reference, downloaded.body, mimeType, 1));
      continue;
    }

    if (isSpreadsheet) {
      const workbook = xlsx.read(downloaded.body, { type: 'buffer', cellDates: true });
      const text = workbook.SheetNames.map((sheetName) => {
        const sheet = workbook.Sheets[sheetName];
        return `[${sheetName}]\n${xlsx.utils.sheet_to_csv(sheet)}`;
      }).join('\n\n').replace(/\s+/g, ' ').trim();
      if (text) {
        documentTexts.push({ assetId: reference.assetId, fileName: reference.fileName, documentId: reference.documentId, documentType: reference.documentType, text, confidence: 0.9, tab: reference.tab });
        continue;
      }
      unreadableFiles.push({ assetId: reference.assetId, fileName: reference.fileName, reason: 'Bảng tính không có nội dung đọc được.', criterionId: reference.criterionId, tab: reference.tab, documentId: reference.documentId, documentType: reference.documentType });
      continue;
    }

    if (extension === 'doc' || mimeType.includes('application/msword')) {
      unreadableFiles.push({ assetId: reference.assetId, fileName: reference.fileName, reason: 'Định dạng Word cũ .doc chưa có bộ chuyển đổi an toàn trong phiên này.', criterionId: reference.criterionId, tab: reference.tab, documentId: reference.documentId, documentType: reference.documentType });
      continue;
    }

    throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Định dạng ${reference.fileName} chưa được hỗ trợ trong phiên kiểm tra PGD.`);
  }

  return { documentTexts, unreadableFiles };
}

export async function semanticReviewPgdCriterion(
  req: NextRequest | Request,
  criterion: PgdAssistantCriterion,
  texts: PgdAssistantTextEvidence[],
): Promise<PgdAssistantCriterion> {
  if (texts.length === 0) return criterion;
  const ai = await getPersonalGeminiClient(req, 30000);
  const context = texts.map((entry) => `[${entry.assetId}|${entry.fileName}${entry.page ? `|trang ${entry.page}` : ''}]\n${entry.text.slice(0, 6000)}`).join('\n\n').slice(0, 24000);
  const response = await generateContentWithRetryAndFallback(
    ai,
    {
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Bạn là lớp phân tích ngữ nghĩa hỗ trợ kiểm tra hồ sơ PGD. Chỉ kiểm tra tiêu chí "${criterion.title}" từ toàn bộ các trích đoạn có mã bằng chứng bên dưới. Không quyết định phê duyệt, không đề xuất chuyển trạng thái, không bịa thông tin. Nếu phát hiện thiếu/sai/mâu thuẫn, phải nêu rõ điểm cần sửa và chọn ít nhất một assetId làm dẫn chứng. Chỉ trả JSON: {"hasIssue": boolean, "severity": "ATTENTION" hoặc "CRITICAL", "message": string, "detail": string, "suggestedAction": string, "assetIds": string[]}. Nếu không đủ căn cứ, hasIssue=false. assetIds chỉ được chọn từ mã đã cung cấp.\n\n${context}`,
            },
          ],
        },
      ],
    },
    await getPersonalGeminiModel(req),
    { attemptsPerModel: 1 },
  );

  const parsed = JSON.parse(String(response.text || '{}').replace(/```json|```/g, '').trim()) as Record<string, unknown>;
  criterion.source = 'RULES_AND_AI';
  if (parsed.hasIssue !== true || typeof parsed.message !== 'string') return criterion;
  const assetIds = Array.isArray(parsed.assetIds) ? parsed.assetIds.map(String) : [];
  const selected = texts.filter((entry) => assetIds.includes(entry.assetId));
  if (selected.length === 0) return criterion;

  const severity = parsed.severity === 'CRITICAL' ? 'CRITICAL' : 'ATTENTION';
  criterion.findings = [
    ...criterion.findings,
    {
      id: `${criterion.id}:AI_SEMANTIC_REVIEW`,
      message: String(parsed.message).slice(0, 1000),
      detail: typeof parsed.detail === 'string' ? parsed.detail.slice(0, 1200) : 'Điểm này do lớp AI ngữ nghĩa gợi ý; người phụ trách phải đối chiếu file gốc.',
      suggestedAction: typeof parsed.suggestedAction === 'string' ? parsed.suggestedAction.slice(0, 1000) : 'Mở bằng chứng được nêu và đối chiếu với hồ sơ PGD chuẩn.',
      evidence: selected.slice(0, 6).map((entry) => ({
        assetId: entry.assetId,
        fileName: entry.fileName,
        ...(entry.documentId ? { documentId: entry.documentId } : {}),
        ...(entry.documentType ? { documentType: entry.documentType } : {}),
        ...(entry.page ? { page: entry.page } : {}),
        excerpt: entry.text.slice(0, 300),
        tab: entry.tab,
      })),
    },
  ];

  if (severity === 'CRITICAL' || criterion.status === 'PASS') {
    criterion.status = severity === 'CRITICAL' ? 'ERROR' : 'WARNING';
    criterion.summary = 'Lớp ngữ nghĩa AI phát hiện điểm cần người dùng đối chiếu với bằng chứng.';
  }
  return criterion;
}
