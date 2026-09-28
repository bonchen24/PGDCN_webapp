// Author: Gemini
// OS support: Web/Node
// Description: OCR orchestration, PaddleOCR client, PDF footer extraction, and background job queue

import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';
import { NextRequest, NextResponse } from 'next/server';
import { jsonError, jsonOk } from './response';
import { extractPcnDocxEmbeddedImages } from '@/utils/pcnDocxOcr';
import { buildPcnPaddleOcrRequest } from '@/utils/pcnApprovalReviewOcr';
import { readOcrLabelValue } from '@/utils/ocrLabelParser';
import { normalizePcnOcrDraft } from '@/utils/pcnOcrPolicy';
import { extractKqtnFooterKey, extractKqtnFooterPageNumber } from '@/utils/kqtnOcrMetadata';
import { OcrCandidate } from '@/utils/ocrPipeline';

export const KQTN_FOOTER_RATIO = 0.08;
export const KQTN_FOOTER_WINDOW_SIZE = 32;
export const KQTN_FOOTER_WINDOW_OVERLAP = 3;
export const KQTN_FOOTER_BOUNDARY_PROBE_RADIUS = 2;
export const KQTN_OCR_TIMEOUT_MS = 120_000;
export const KQTN_FOOTER_JOB_TTL_MS = 60 * 60 * 1000;
export const KQTN_FOOTER_JOB_TIMEOUT_MS = 15 * 60 * 1000;
export const KQTN_FOOTER_JOB_MAX_ACTIVE = 1;

export function getKqtnOcrServiceUrl(): string {
  const configuredUrl = String(process.env.OCR_SERVICE_URL || '').trim().replace(/\/+$/, '');
  if (configuredUrl) return configuredUrl;
  return process.env.NODE_ENV === 'production' ? 'http://tvci_ocr_service:8100' : 'http://127.0.0.1:8100';
}

export type ServerOcrCandidate = OcrCandidate & { source?: 'paddle' | 'text-layer'; pages?: ServerOcrCandidate[] };

export interface KqtnFooterJobPage {
  pageNumber: number;
  isBlank: boolean;
  footerKey: string | null;
  text: string;
  confidence: number;
  candidateScore?: number;
  isCandidate?: boolean;
  footerCurrentPage?: number;
  footerTotalPages?: number;
}

export interface KqtnFooterJobRecord {
  jobId: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  strategy?: string;
  totalPages: number;
  processedPages: number;
  pages: KqtnFooterJobPage[];
  createdAt: number;
  error?: string;
}

export interface KqtnFooterPdfWindow {
  startPage: number;
  endPage: number;
  bytes: Buffer;
}

// Global in-memory storage for KQTN footer OCR background jobs
export const kqtnFooterJobs = new Map<string, KqtnFooterJobRecord>();

export function getOcrErrorStatus(error: any): number {
  if (error?.message?.includes('API key')) return 503;
  if (Number(error?.statusCode) === 503 || error?.name === 'AbortError') return 503;
  return Number(error?.statusCode) || 500;
}

export function cropKqtnPageToFooter(page: ReturnType<PDFDocument['addPage']>): void {
  const width = page.getWidth();
  const height = page.getHeight();
  const rotation = ((page.getRotation().angle % 360) + 360) % 360;
  const footerExtent = Math.max(1, (rotation === 90 || rotation === 270 ? width : height) * KQTN_FOOTER_RATIO);
  let x = 0;
  let y = 0;
  let cropWidth = width;
  let cropHeight = footerExtent;
  if (rotation === 90) {
    x = Math.max(0, width - footerExtent);
    cropWidth = footerExtent;
    cropHeight = height;
  } else if (rotation === 270) {
    cropWidth = Math.min(width, footerExtent);
    cropHeight = height;
  } else if (rotation === 180) {
    y = Math.max(0, height - footerExtent);
  }
  page.setMediaBox(x, y, cropWidth, cropHeight);
  page.setCropBox(x, y, cropWidth, cropHeight);
}

export async function createKqtnFooterOnlyPdfWindows(sourceBytes: Buffer): Promise<KqtnFooterPdfWindow[]> {
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const totalPages = sourcePdf.getPageCount();
  const windows: KqtnFooterPdfWindow[] = [];
  const step = Math.max(1, KQTN_FOOTER_WINDOW_SIZE - KQTN_FOOTER_WINDOW_OVERLAP);
  for (let startPage = 1; startPage <= totalPages; startPage += step) {
    const endPage = Math.min(totalPages, startPage + KQTN_FOOTER_WINDOW_SIZE - 1);
    const windowPdf = await PDFDocument.create();
    const pages = await windowPdf.copyPages(
      sourcePdf,
      Array.from({ length: endPage - startPage + 1 }, (_, offset) => startPage - 1 + offset),
    );
    for (const page of pages) {
      cropKqtnPageToFooter(page);
      windowPdf.addPage(page);
    }
    windows.push({
      startPage,
      endPage,
      bytes: Buffer.from(await windowPdf.save({ useObjectStreams: false })),
    });
    if (endPage === totalPages) break;
  }
  return windows;
}

export async function createKqtnFooterOnlyPdfPages(sourceBytes: Buffer, pageNumbers: number[]): Promise<Buffer> {
  const sourcePdf = await PDFDocument.load(sourceBytes);
  const probePdf = await PDFDocument.create();
  const pages = await probePdf.copyPages(sourcePdf, pageNumbers.map((pageNumber) => pageNumber - 1));
  for (const page of pages) {
    cropKqtnPageToFooter(page);
    probePdf.addPage(page);
  }
  return Buffer.from(await probePdf.save({ useObjectStreams: false }));
}

export function getKqtnFooterBoundaryProbePages(pages: KqtnFooterJobPage[], totalPages: number): number[] {
  const entries = pages
    .filter((page) => page.pageNumber >= 1 && page.pageNumber <= totalPages && page.footerKey)
    .sort((left, right) => left.pageNumber - right.pageNumber);
  const groups: KqtnFooterJobPage[][] = [];
  for (const page of entries) {
    const previousGroup = groups.at(-1);
    if (previousGroup?.[0]?.footerKey === page.footerKey) previousGroup.push(page);
    else groups.push([page]);
  }
  const probePages = new Set<number>();
  for (let index = 1; index < groups.length; index += 1) {
    const first = groups[index][0];
    const currentPage = first.footerCurrentPage;
    const estimatedStart = Number.isFinite(currentPage) && (currentPage || 0) >= 1
      ? first.pageNumber - (currentPage || 1) + 1
      : first.pageNumber;
    for (let offset = -KQTN_FOOTER_BOUNDARY_PROBE_RADIUS; offset <= KQTN_FOOTER_BOUNDARY_PROBE_RADIUS; offset += 1) {
      const pageNumber = estimatedStart + offset;
      if (pageNumber >= 1 && pageNumber <= totalPages) probePages.add(pageNumber);
    }
  }
  return [...probePages].sort((left, right) => left - right);
}

export function parseKqtnFooterJobPage(page: any, pageNumber: number): KqtnFooterJobPage {
  const text = String(page?.text || '').trim();
  const confidence = Number(page?.confidence || 0);
  const footerPageNumber = extractKqtnFooterPageNumber(text);
  return {
    pageNumber,
    isBlank: !text && confidence <= 0,
    footerKey: extractKqtnFooterKey(text),
    text,
    confidence,
    candidateScore: Number(page?.candidate_score || 0),
    isCandidate: true,
    footerCurrentPage: footerPageNumber?.currentPage,
    footerTotalPages: footerPageNumber?.totalPages,
  };
}

export async function requestPaddleOcr(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  page: number,
): Promise<ServerOcrCandidate> {
  const request = buildPcnPaddleOcrRequest(getKqtnOcrServiceUrl(), { fileName, mimeType, page, dpi: 150 });
  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(fileBuffer)], { type: mimeType }), fileName);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KQTN_OCR_TIMEOUT_MS);
  try {
    const response = await fetch(request.url, { method: request.method, body: formData, signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw Object.assign(new Error(payload.detail || payload.error || `PaddleOCR request failed (${response.status}).`), { statusCode: 503 });
    }
    const text = getPcnOcrText(payload).replace(/\u0000/g, '').trim();
    const confidenceValue = Number(payload.confidence ?? payload.score ?? payload.meanConfidence);
    return {
      text,
      confidence: Number.isFinite(confidenceValue) ? confidenceValue : text ? 0.82 : 0,
      source: 'paddle',
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function collectPaddleOcr(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
  pageNumber?: number,
): Promise<ServerOcrCandidate> {
  const extension = fileName.toLowerCase().split('.').pop() || '';
  const isDocx = extension === 'docx' || mimeType.includes('wordprocessingml.document');
  if (isDocx) {
    const docxResult = await mammoth.extractRawText({ buffer: fileBuffer });
    if (docxResult.value.trim()) return { text: docxResult.value.trim(), confidence: 0.95, source: 'text-layer' };
    const embeddedImages = extractPcnDocxEmbeddedImages(fileBuffer);
    const pages: ServerOcrCandidate[] = [];
    for (const image of embeddedImages) {
      pages.push(await requestPaddleOcr(image.bytes, image.fileName, image.mimeType, 1));
    }
    return {
      text: pages.map((page) => page.text).filter(Boolean).join('\n\n'),
      confidence: pages.length > 0 ? pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length : 0,
      source: 'paddle',
      pages,
    };
  }

  const isPdf = extension === 'pdf' || mimeType === 'application/pdf';
  if (!isPdf) return requestPaddleOcr(fileBuffer, fileName, mimeType || 'image/jpeg', 1);

  const pdf = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
  const firstPage = Math.max(1, Math.floor(Number(pageNumber) || 1));
  const lastPage = pageNumber ? firstPage : Math.min(pdf.getPageCount(), 40);
  const pages: ServerOcrCandidate[] = [];
  for (let page = firstPage; page <= lastPage; page += 1) {
    pages.push(await requestPaddleOcr(fileBuffer, fileName, 'application/pdf', page));
  }
  return {
    text: pages.map((page) => page.text).filter(Boolean).join('\n\n'),
    confidence: pages.length > 0 ? pages.reduce((sum, page) => sum + page.confidence, 0) / pages.length : 0,
    source: 'paddle',
    pages,
  };
}

export async function proxyKqtnOcr(
  req: NextRequest,
  mode: 'footer' | 'page',
): Promise<NextResponse> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }
  const sourcePage = Math.max(1, Math.floor(Number(body?.sourcePage) || 1));
  const base64Data = String(body?.base64Data || '').replace(/^data:[^;]+;base64,/i, '');
  if (!base64Data) {
    return jsonError('Missing PDF data.', 400);
  }

  const ocrServiceUrl = getKqtnOcrServiceUrl();
  const pdfBuffer = Buffer.from(base64Data, 'base64');
  if (pdfBuffer.length === 0 || pdfBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return jsonError('Only valid PDF data is accepted.', 415);
  }

  const ocrUrl = new URL(`${ocrServiceUrl}/ocr/pdf/${mode}`);
  ocrUrl.searchParams.set('page', '1');
  ocrUrl.searchParams.set('dpi', mode === 'footer' ? '120' : '150');
  if (mode === 'footer') ocrUrl.searchParams.set('footer_ratio', '0.2');

  const formData = new FormData();
  formData.append('file', new Blob([new Uint8Array(pdfBuffer)], { type: 'application/pdf' }), `kqtn-page-${sourcePage}.pdf`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), KQTN_OCR_TIMEOUT_MS);

  try {
    const response = await fetch(ocrUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json(
        {
          code: 'KQTN_OCR_UNAVAILABLE',
          error: payload.detail || payload.error || `PaddleOCR request failed (${response.status}).`,
        },
        { status: response.status >= 500 ? 503 : response.status },
      );
    }
    return jsonOk({ ...payload, sourcePage, mode });
  } catch (error: any) {
    console.error(`KQTN PaddleOCR ${mode} error:`, error?.message || String(error));
    return NextResponse.json(
      {
        code: 'KQTN_OCR_UNAVAILABLE',
        error: error?.name === 'AbortError' ? 'PaddleOCR request timed out.' : 'PaddleOCR service unavailable.',
      },
      { status: 503 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function expireKqtnFooterJob(jobId: string) {
  setTimeout(() => {
    kqtnFooterJobs.delete(jobId);
  }, KQTN_FOOTER_JOB_TTL_MS);
}

export async function runKqtnFooterJob(jobId: string, sourceBytes: Buffer) {
  const job = kqtnFooterJobs.get(jobId);
  if (!job) return;

  job.status = 'running';
  let sourceBuffer = sourceBytes;
  let footerWindows: KqtnFooterPdfWindow[] = [];
  let controller: AbortController | undefined;
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const ocrServiceUrl = getKqtnOcrServiceUrl();
    const ocrUrl = new URL(ocrServiceUrl + '/ocr/pdf/footer-fast');
    ocrUrl.searchParams.set('thumbnail_dpi', '90');
    ocrUrl.searchParams.set('ocr_dpi', '150');
    ocrUrl.searchParams.set('chunk_size', '8');
    ocrUrl.searchParams.set('max_candidates', '32');
    footerWindows = await createKqtnFooterOnlyPdfWindows(sourceBuffer);
    if (footerWindows.length === 0) throw new Error('Không tạo được cửa sổ footer từ PDF nguồn.');
    controller = new AbortController();
    timeout = setTimeout(() => controller?.abort(), KQTN_FOOTER_JOB_TIMEOUT_MS);

    job.strategy = 'footer-batch';
    const pagesByNumber = new Map<number, KqtnFooterJobPage>();
    for (const footerWindow of footerWindows) {
      const windowUrl = new URL(ocrUrl);
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(footerWindow.bytes)], { type: 'application/pdf' }),
        `kqtn-combined-footer-${footerWindow.startPage}-${footerWindow.endPage}.pdf`,
      );
      const response = await fetch(windowUrl, {
        method: 'POST',
        body: formData,
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || 'PaddleOCR footer scan failed (' + response.status + ').');
      }
      const rawPages = Array.isArray(payload.pages) ? payload.pages : [];
      for (const [index, page] of rawPages.entries()) {
        const localPageNumber = Math.max(1, Math.floor(Number(page?.page) || index + 1));
        const pageNumber = footerWindow.startPage + localPageNumber - 1;
        if (pageNumber > footerWindow.endPage) continue;
        const candidatePage = parseKqtnFooterJobPage(page, pageNumber);
        const existing = pagesByNumber.get(pageNumber);
        if (!existing || (candidatePage.footerKey && !existing.footerKey) || candidatePage.confidence > Number(existing.confidence || 0)) {
          pagesByNumber.set(pageNumber, candidatePage);
        }
      }
      job.processedPages = Math.min(job.totalPages || footerWindows.at(-1)?.endPage || footerWindow.endPage, footerWindow.endPage);
      job.pages = [...pagesByNumber.values()].sort((left, right) => left.pageNumber - right.pageNumber);
    }
    job.totalPages = Math.max(job.totalPages, footerWindows.at(-1)?.endPage || 0);
    const boundaryProbePages = getKqtnFooterBoundaryProbePages([...pagesByNumber.values()], job.totalPages);
    if (boundaryProbePages.length > 0) {
      const boundaryProbeBytes = await createKqtnFooterOnlyPdfPages(sourceBuffer, boundaryProbePages);
      const boundaryUrl = new URL(ocrServiceUrl + '/ocr/pdf/footer-batch');
      boundaryUrl.searchParams.set('dpi', '150');
      boundaryUrl.searchParams.set('chunk_size', '4');
      const boundaryFormData = new FormData();
      boundaryFormData.append(
        'file',
        new Blob([new Uint8Array(boundaryProbeBytes)], { type: 'application/pdf' }),
        'kqtn-combined-footer-boundary-probe.pdf',
      );
      const boundaryResponse = await fetch(boundaryUrl, {
        method: 'POST',
        body: boundaryFormData,
        signal: controller.signal,
      });
      const boundaryPayload = await boundaryResponse.json().catch(() => ({}));
      if (!boundaryResponse.ok) {
        throw new Error(boundaryPayload.detail || boundaryPayload.error || 'PaddleOCR footer boundary probe failed (' + boundaryResponse.status + ').');
      }
      const boundaryPages = Array.isArray(boundaryPayload.pages) ? boundaryPayload.pages : [];
      for (const [index, page] of boundaryPages.entries()) {
        const pageNumber = boundaryProbePages[index];
        if (!pageNumber) continue;
        const probePage = parseKqtnFooterJobPage(page, pageNumber);
        const existing = pagesByNumber.get(pageNumber);
        if (!existing || (probePage.footerKey && !existing.footerKey) || (probePage.footerKey && probePage.footerKey !== existing.footerKey) || probePage.confidence >= Number(existing.confidence || 0)) {
          pagesByNumber.set(pageNumber, probePage);
        }
      }
      job.pages = [...pagesByNumber.values()].sort((left, right) => left.pageNumber - right.pageNumber);
    }
    job.processedPages = job.totalPages;
    job.pages = [...pagesByNumber.values()].sort((left, right) => left.pageNumber - right.pageNumber);
    if (job.pages.length === 0) {
      throw new Error('PaddleOCR không trả về trang ứng viên footer nào.');
    }
    job.status = 'completed';
  } catch (error: any) {
    job.status = 'failed';
    job.pages = [];
    job.error = error?.name === 'AbortError' ? 'PaddleOCR footer scan timed out.' : error?.message || String(error);
  } finally {
    if (timeout) clearTimeout(timeout);
    controller = undefined;
    sourceBuffer = Buffer.alloc(0);
    footerWindows = [];
    expireKqtnFooterJob(jobId);
  }
}

export function getPcnOcrText(payload: any): string {
  if (typeof payload === 'string') return payload;
  if (!payload || typeof payload !== 'object') return '';
  const direct = [payload.text, payload.rawText, payload.ocrText, payload.result].find((value) => typeof value === 'string' && value.trim());
  if (direct) return String(direct);
  if (Array.isArray(payload.lines)) return payload.lines.map((line: any) => typeof line === 'string' ? line : line?.text || line?.value || '').filter(Boolean).join('\n');
  if (Array.isArray(payload.results)) return payload.results.map((item: any) => typeof item === 'string' ? item : item?.text || item?.value || '').filter(Boolean).join('\n');
  return '';
}

export function buildPcnOcrDraftFromText(text: string, context: 'proposal' | 'result', fileName: string, sourcePage: number, confidence: number) {
  const fields: Record<string, string> = {};
  const put = (key: string, labels: string[]) => {
    const value = readOcrLabelValue(text, labels);
    if (value) fields[key] = value;
  };
  if (context === 'proposal') {
    put('proposalCode', ['mã đề nghị', 'mã hồ sơ', 'mã đăng ký', 'số đăng ký', 'registration no']);
    put('customerName', ['khách hàng', 'tên khách hàng', 'tên đơn vị', 'đơn vị yêu cầu', 'customer']);
    put('address', ['địa chỉ khách hàng', 'địa chỉ đơn vị', 'address']);
    put('contactPerson', ['người liên hệ', 'người đại diện', 'contact person']);
    put('taxId', ['mã số thuế', 'tax code', 'tax id']);
    put('phone', ['điện thoại', 'số điện thoại', 'phone']);
    put('email', ['email', 'e-mail']);
    put('warehouseAddress', ['địa chỉ kho', 'địa điểm', 'nơi lấy mẫu', 'kho liên quan']);
    put('productName', ['hạng mục chứng nhận', 'hang myc chứng nhận', 'hang myc chung nhan', 'hạng mục', 'tên sản phẩm', 'tên hàng hóa', 'product name']);
    put('productType', ['kiểu loại', 'loại sản phẩm', 'type']);
    put('model', ['model', 'kiểu máy', 'model/ký hiệu']);
    put('brand', ['nhãn hiệu', 'hãng', 'brand']);
    put('specifications', ['thông số kỹ thuật', 'specifications', 'mô tả']);
    put('manufacturer', ['nhà sản xuất', 'manufacturer']);
    put('manufacturerAddress', ['địa chỉ nhà sản xuất', 'manufacturer address']);
    put('quantity', ['số lượng', 'quantity']);
    put('receivedAt', ['thời gian thực hiện', 'ngày tiếp nhận', 'ngày nhận hồ sơ']);
    const fieldsFromText = ['QC4', 'QC9'].filter((code) => new RegExp(`(?:${code}|QCVN\\s*${code.slice(2)})`, 'i').test(text));
    if (fieldsFromText.length > 0) fields.fieldCodes = fieldsFromText.join(',');
  } else {
    put('reportNumber', ['số báo cáo', 'số phiếu', 'report no', 'report number']);
    put('outcome', ['kết quả', 'kết luận', 'result', 'conclusion']);
    put('notes', ['ghi chú', 'notes', 'remark']);
  }
  return normalizePcnOcrDraft({ fields, confidence, sourcePage, sourceFileName: fileName });
}
