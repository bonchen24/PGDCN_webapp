// Author: Gemini
// OS support: Web/Node
// Description: PCN Approval Assistant data loading, OCR extraction, semantic evaluation, and run storage

import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import { pool } from './postgres';
import { mapDocumentRow } from './collections';
import { getPcnSessionUser } from './auth';
import { getPcnStorageBucket, getPcnStorageClient } from './pcn-files';
import {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnCertificationFieldCode,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleItem,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '@/types';
import {
  PcnPaddleOcrUnavailableError,
  buildPcnPaddleOcrRequest,
  normalizePcnPaddleOcrPage,
} from '@/utils/pcnApprovalReviewOcr';
import {
  PCN_APPROVAL_REVIEW_CRITERIA,
  PcnApprovalCriterionResult,
  PcnApprovalReviewFinding,
  PcnApprovalReviewInput,
  PcnApprovalReviewTextEvidence,
  PcnApprovalReviewUnreadableFile,
  buildPcnApprovalReview,
  getPcnApprovalReviewCandidates,
} from '@/utils/pcnApprovalReview';
import { mergePcnDocumentRequirements } from '@/utils/pcnDossierDocuments';
import { extractPcnDocxEmbeddedImages } from '@/utils/pcnDocxOcr';
import { KQTN_OCR_TIMEOUT_MS, getKqtnOcrServiceUrl } from './ocr';
import {
  Type,
  generateContentWithRetryAndFallback,
  getPersonalGeminiClient,
  getPersonalGeminiModel,
} from './gemini';

export const PCN_APPROVAL_REVIEW_TTL_MS = 60 * 60 * 1000;
export const approvalAssistantFields = new Set(['QC4', 'QC9']);
export const approvalAssistantDossierStatus = new Set(['TECHNICAL_REVIEW', 'WAITING_APPROVAL']);

export interface PcnApprovalReviewRunRecord {
  runId: string;
  username: string;
  dossierId: string;
  dossierCode: string;
  fieldCode: PcnCertificationFieldCode;
  report: ReturnType<typeof buildPcnApprovalReview>;
  expiresAt: number;
}

export const pcnApprovalReviewRuns = new Map<string, PcnApprovalReviewRunRecord>();

export function pruneApprovalAssistantRuns() {
  const now = Date.now();
  for (const [runId, run] of pcnApprovalReviewRuns) {
    if (run.expiresAt <= now) pcnApprovalReviewRuns.delete(runId);
  }
}

export interface ApprovalAssistantAssetReference {
  assetId: string;
  fileName: string;
  sourceCollection: string;
  sourceDocumentId: string;
  sourceJsonPath: string;
  tab: 'documents' | 'results';
}

export function assertApprovalAssistantField(value: unknown): PcnCertificationFieldCode {
  const fieldCode = String(value || '').trim().toUpperCase();
  if (!approvalAssistantFields.has(fieldCode)) {
    throw Object.assign(new Error('Trợ lý kiểm duyệt v1 chỉ hỗ trợ Lĩnh vực QC4 hoặc QC9.'), { statusCode: 400 });
  }
  return fieldCode as PcnCertificationFieldCode;
}

export function normalizeApprovalAssistantRequirements(rows: unknown[]): PcnDocumentRequirement[] {
  return mergePcnDocumentRequirements(rows as PcnDocumentRequirement[]);
}

export function canUseApprovalAssistant(req: NextRequest | Request, fieldCode: PcnCertificationFieldCode): boolean {
  const actor = getPcnSessionUser(req);
  if (!actor) return false;
  const role = actor.systemRole || actor.role;
  return role === 'admin' || (Array.isArray(actor.fieldCodes) && actor.fieldCodes.map((c) => String(c).toUpperCase()).includes(fieldCode));
}

export async function readApprovalAssistantRows(collectionName: string, condition = '', params: unknown[] = []) {
  const result = await pool.query(
    `SELECT document_id, data FROM app_documents WHERE collection_name = $1 ${condition} ORDER BY updated_at DESC, document_id ASC`,
    [collectionName, ...params],
  );
  return result.rows.map(mapDocumentRow);
}

export async function loadApprovalAssistantInput(
  dossierId: string,
  fieldCode: PcnCertificationFieldCode,
): Promise<PcnApprovalReviewInput> {
  const dossierResult = await pool.query(
    `SELECT document_id, data FROM app_documents
     WHERE collection_name = 'certificationDossiers' AND document_id = $1 LIMIT 1`,
    [dossierId],
  );
  const dossier = dossierResult.rows[0] ? (mapDocumentRow(dossierResult.rows[0]) as CertificationDossier) : undefined;
  if (!dossier) throw Object.assign(new Error('Không tìm thấy hồ sơ PCN.'), { statusCode: 404 });

  const lotIds = Array.isArray(dossier.sampleLotIds) ? dossier.sampleLotIds.map(String).filter(Boolean) : [];
  const [proposalResult, requirementsResult, documentsResult, requestsResult, lotsResult, itemsResult, routesResult, resultsResult] =
    await Promise.all([
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationProposals' AND document_id = $1 LIMIT 1`, [dossier.proposalId]),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDocumentRequirements' AND COALESCE((data->>'active')::boolean, false) = true ORDER BY COALESCE((data->>'sortOrder')::int, 0), document_id`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' AND data->>'dossierId' = $1 ORDER BY document_id`, [dossier.id]),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' AND data->>'dossierId' = $1 ORDER BY document_id`, [dossier.id]),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' AND data->>'dossierId' = $1 ORDER BY document_id`, [dossier.id]),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleItems' AND data->>'sampleLotId' = ANY($1::text[]) ORDER BY document_id`, [lotIds]),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' AND data->>'sampleLotId' = ANY($1::text[]) ORDER BY document_id`, [lotIds]),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'returnedResults' AND data->>'dossierId' = $1 ORDER BY document_id`, [dossier.id]),
    ]);

  return {
    fieldCode,
    dossier,
    ...(proposalResult.rows[0] ? { proposal: mapDocumentRow(proposalResult.rows[0]) as CertificationProposal } : {}),
    requirements: normalizeApprovalAssistantRequirements(requirementsResult.rows.map(mapDocumentRow)),
    documents: documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[],
    labRequests: requestsResult.rows.map(mapDocumentRow) as OutboundLabRequest[],
    sampleLots: lotsResult.rows.map(mapDocumentRow) as PcnSampleLot[],
    sampleItems: itemsResult.rows.map(mapDocumentRow) as PcnSampleItem[],
    sampleRoutes: routesResult.rows.map(mapDocumentRow) as PcnSampleRoute[],
    returnedResults: resultsResult.rows.map(mapDocumentRow) as ReturnedTestResult[],
  };
}

export function getCurrentApprovalAssistantAssets(input: PcnApprovalReviewInput): ApprovalAssistantAssetReference[] {
  const references: ApprovalAssistantAssetReference[] = [];
  for (const document of input.documents) {
    if (document.status !== 'PRESENT') continue;
    const versions = Array.isArray(document.versions) ? document.versions : [];
    const current = versions.find((version) => version.assetId === document.currentVersionId) || versions.at(-1);
    if (current?.assetId) {
      references.push({
        assetId: current.assetId,
        fileName: current.fileName || `${current.assetId}.bin`,
        sourceCollection: 'dossierDocuments',
        sourceDocumentId: document.id,
        sourceJsonPath: document.requirementId,
        tab: 'documents',
      });
    }
  }
  for (const result of input.returnedResults) {
    if (result.fileAssetId) {
      references.push({
        assetId: result.fileAssetId,
        fileName: result.reportNumber ? `${result.reportNumber}.pdf` : `${result.fileAssetId}.pdf`,
        sourceCollection: 'returnedResults',
        sourceDocumentId: result.id,
        sourceJsonPath: 'fileAssetId',
        tab: 'results',
      });
    }
  }
  return [...new Map(references.map((r) => [r.assetId, r])).values()];
}

export async function fetchApprovalAssistantPaddlePage(
  reference: ApprovalAssistantAssetReference,
  bytes: Buffer,
  mimeType: string,
  page: number,
): Promise<PcnApprovalReviewTextEvidence> {
  const request = buildPcnPaddleOcrRequest(getKqtnOcrServiceUrl(), { fileName: reference.fileName, mimeType, page, dpi: 150 });
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(bytes)], { type: mimeType }), reference.fileName);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KQTN_OCR_TIMEOUT_MS);
  try {
    const response = await fetch(request.url, { method: request.method, body: formData, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `PaddleOCR không sẵn sàng cho ${reference.fileName}, trang ${page} (HTTP ${response.status}).`);
    }
    const normalized = normalizePcnPaddleOcrPage(payload, { assetId: reference.assetId, fileName: reference.fileName, page });
    return { ...normalized, tab: reference.tab };
  } catch (error: any) {
    if (error instanceof PcnPaddleOcrUnavailableError) throw error;
    throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Dừng phiên trợ lý AI: không thể đọc ${reference.fileName}, trang ${page} bằng PaddleOCR.`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchApprovalAssistantGeminiPage(
  req: NextRequest | Request,
  reference: ApprovalAssistantAssetReference,
  bytes: Buffer,
  mimeType: string,
  page: number,
): Promise<PcnApprovalReviewTextEvidence> {
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
  if (!text) throw Object.assign(new Error(`Gemini không đọc được ${reference.fileName}, trang ${page}.`), { statusCode: 422 });
  return { assetId: reference.assetId, fileName: reference.fileName, text, page, confidence: 0.78, tab: reference.tab };
}

export async function fetchApprovalAssistantOcrPage(
  req: NextRequest | Request,
  reference: ApprovalAssistantAssetReference,
  bytes: Buffer,
  mimeType: string,
  page: number,
): Promise<PcnApprovalReviewTextEvidence> {
  try {
    return await fetchApprovalAssistantPaddlePage(reference, bytes, mimeType, page);
  } catch (error) {
    if (!(error instanceof PcnPaddleOcrUnavailableError)) throw error;
    return fetchApprovalAssistantGeminiPage(req, reference, bytes, mimeType, page);
  }
}

export async function extractApprovalAssistantTexts(
  req: NextRequest | Request,
  input: PcnApprovalReviewInput,
): Promise<{ documentTexts: PcnApprovalReviewTextEvidence[]; unreadableFiles: PcnApprovalReviewUnreadableFile[] }> {
  const references = getCurrentApprovalAssistantAssets(input);
  if (references.length === 0) return { documentTexts: [], unreadableFiles: [] };
  const assetResult = await pool.query(
    `SELECT id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type
     FROM file_assets WHERE id = ANY($1::text[])`,
    [references.map((r) => r.assetId)],
  );
  const assetById = new Map(assetResult.rows.map((asset: any) => [String(asset.id), asset]));
  const storage = getPcnStorageClient();
  const evidence: PcnApprovalReviewTextEvidence[] = [];
  const unreadableFiles: PcnApprovalReviewUnreadableFile[] = [];

  for (const reference of references) {
    const asset = assetById.get(reference.assetId);
    if (!asset) throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Không tìm thấy private asset ${reference.assetId} để đọc hồ sơ.`);
    if (
      String(asset.bucket_name) !== getPcnStorageBucket() ||
      String(asset.source_collection) !== reference.sourceCollection ||
      String(asset.source_document_id) !== reference.sourceDocumentId ||
      String(asset.source_json_path) !== reference.sourceJsonPath
    ) {
      throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Private asset ${reference.assetId} không trỏ đúng về hồ sơ đang kiểm duyệt.`);
    }

    const downloaded = await storage.downloadObject({ bucketName: String(asset.bucket_name), objectPath: String(asset.object_path) });
    const mimeType = String(asset.mime_type || downloaded.contentType || 'application/octet-stream').toLowerCase();
    const extension = reference.fileName.toLowerCase().split('.').pop() || '';
    const isDocx = extension === 'docx' || mimeType.includes('wordprocessingml.document');
    const isPdf = extension === 'pdf' || mimeType.includes('pdf');
    const isImage = mimeType.startsWith('image/') || /^(png|jpe?g|webp|tiff?)$/.test(extension);

    if (isDocx) {
      const docxResult = await mammoth.extractRawText({ buffer: downloaded.body });
      const text = String(docxResult.value || '').trim();
      if (text) {
        evidence.push({ assetId: reference.assetId, fileName: reference.fileName, text, confidence: 0.95, tab: reference.tab });
        continue;
      }
      const embeddedImages = extractPcnDocxEmbeddedImages(downloaded.body);
      if (embeddedImages.length === 0) {
        evidence.push(await fetchApprovalAssistantOcrPage(req, reference, downloaded.body, mimeType, 1));
        continue;
      }
      const evidenceBeforeDocx = evidence.length;
      for (const [index, image] of embeddedImages.entries()) {
        const imageReference = { ...reference, fileName: `${reference.fileName} · ${image.fileName}` };
        try {
          evidence.push(await fetchApprovalAssistantOcrPage(req, imageReference, image.bytes, image.mimeType, index + 1));
        } catch (error) {
          if (error instanceof PcnPaddleOcrUnavailableError && (error.code === 'PADDLE_OCR_EMPTY' || error.code === 'PADDLE_OCR_LOW_CONFIDENCE')) continue;
          throw error;
        }
      }
      if (evidence.length === evidenceBeforeDocx) throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_EMPTY', `PaddleOCR và Gemini không đọc được ảnh nhúng trong ${reference.fileName}.`);
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
        evidence.push(await fetchApprovalAssistantOcrPage(req, reference, downloaded.body, 'application/pdf', page));
      }
      continue;
    }

    if (isImage) {
      evidence.push(await fetchApprovalAssistantOcrPage(req, reference, downloaded.body, mimeType, 1));
      continue;
    }

    if (extension === 'doc' || mimeType.includes('application/msword')) {
      unreadableFiles.push({
        assetId: reference.assetId,
        fileName: reference.fileName,
        reason: 'Định dạng Word cũ .doc chưa có bộ chuyển đổi an toàn trong phiên này.',
        tab: reference.tab,
      });
      continue;
    }

    throw new PcnPaddleOcrUnavailableError('PADDLE_OCR_UNAVAILABLE', `Định dạng ${reference.fileName} chưa được hỗ trợ trong phiên kiểm duyệt.`);
  }

  return { documentTexts: evidence, unreadableFiles };
}

export async function semanticReviewCriterion(
  req: NextRequest | Request,
  criterion: PcnApprovalCriterionResult,
  texts: PcnApprovalReviewTextEvidence[],
): Promise<PcnApprovalCriterionResult> {
  if (texts.length === 0 || ['ENTRY_GATE', 'COMPLETENESS', 'SAMPLE_PYC', 'LAB_RESULTS'].includes(criterion.id)) return criterion;
  try {
    const ai = await getPersonalGeminiClient(req, 30000);
    const context = texts.map((e) => `[${e.assetId}|${e.fileName}${e.page ? `|trang ${e.page}` : ''}]\n${e.text.slice(0, 6000)}`).join('\n\n').slice(0, 24000);
    const response = await generateContentWithRetryAndFallback(
      ai,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Bạn là lớp phân tích ngữ nghĩa hỗ trợ kiểm duyệt hồ sơ PCN. Chỉ kiểm tra tiêu chí "${criterion.title}" từ các trích đoạn có mã bằng chứng bên dưới. Không quyết định phê duyệt, không đề xuất chuyển trạng thái, không bịa thông tin. Chỉ trả JSON: {"hasIssue": boolean, "severity": "ATTENTION" hoặc "CRITICAL", "message": string, "assetIds": string[]}. Nếu không đủ căn cứ, hasIssue=false. assetIds chỉ được chọn từ mã đã cung cấp.\n\n${context}`,
              },
            ],
          },
        ],
        config: { responseMimeType: 'application/json', temperature: 0.1 },
      },
      await getPersonalGeminiModel(req),
      { attemptsPerModel: 1 },
    );

    const parsed = JSON.parse(String(response.text || '{}').replace(/```json|```/g, '').trim()) as Record<string, unknown>;
    if (parsed.hasIssue !== true || typeof parsed.message !== 'string') return criterion;
    const assetIds = Array.isArray(parsed.assetIds) ? parsed.assetIds.map(String) : [];
    const selected = texts.filter((e) => assetIds.includes(e.assetId));
    if (selected.length === 0) return criterion;

    const severity = parsed.severity === 'CRITICAL' ? 'CRITICAL' : 'ATTENTION';
    const finding: PcnApprovalReviewFinding = {
      id: `${criterion.id}:AI_SEMANTIC_REVIEW`,
      code: 'AI_SEMANTIC_REVIEW',
      message: String(parsed.message).slice(0, 1000),
      severity,
      confidence: 0.7,
      suggestedAction: 'Mở bằng chứng được nêu và đối chiếu với hồ sơ gốc.',
      evidence: selected.slice(0, 6).map((e) => ({
        assetId: e.assetId,
        fileName: e.fileName,
        ...(e.page ? { page: e.page } : {}),
        excerpt: e.text.slice(0, 300),
        tab: 'documents',
      })),
    };

    criterion.findings = [...criterion.findings, finding];
    criterion.source = criterion.findings.length > 1 ? 'RULE_AND_AI' : 'AI';
    if (severity === 'CRITICAL' || criterion.status === 'PASS') {
      criterion.status = severity === 'CRITICAL' ? 'ERROR' : 'WARNING';
      criterion.severity = severity;
      criterion.summary = 'Lớp ngữ nghĩa AI phát hiện điểm cần người dùng đối chiếu với bằng chứng.';
    }
    return criterion;
  } catch {
    return criterion;
  }
}
