// Author: Gemini
// OS support: Web/Node
// Description: Bulk KQTN PDF assignment with single-file and combined-PDF review flows.

import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Scissors,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';
import { toast } from 'sonner';
import type { KqtnPdfMetadata } from '../types';
import { matchKqtnBulkFile, type KqtnBulkCandidate } from '../utils/kqtnBulkMatching';
import { normalizeKqtnSampleKey } from '../utils/kqtnIdentity';
import KqtnCandidateCombobox from './KqtnCandidateCombobox';
import {
  buildKqtnBulkSegments,
  buildKqtnFooterCandidateSegments,
  normalizeKqtnBulkSegmentRange,
  validateKqtnBulkFooterPageCounts,
  validateKqtnBulkSegments,
  type KqtnBulkSegmentDraft,
  type KqtnBulkFooterPage,
  type KqtnBulkStructurePage,
} from '../utils/kqtnBulkSplit';
import { buildKqtnBulkUploadPlan } from '../utils/kqtnBulkWorkflow';
import {
  extractKqtnBulkFooter,
  extractKqtnPdfMetadata,
  extractKqtnPageTextWithPaddle,
  getKqtnFooterJob,
  startKqtnFooterJob,
  type KqtnPdfAiMetadata,
  uploadKqtnPdf,
} from '../utils/kqtnPdfClient';
import { extractKqtnModelFromProbeTexts, getKqtnModelProbePageNumbers } from '../utils/kqtnBulkModelProbe';
import { parseKqtnOcrMetadata } from '../utils/kqtnOcrMetadata';
import { isUsableOcrCandidate } from '../utils/ocrPipeline';

const KQTN_PDF_MAX_BYTES = 25 * 1024 * 1024;

type BulkItemStatus = 'needs-review' | 'ready' | 'uploading' | 'uploaded' | 'skipped' | 'failed';
type CombinedPhase = 'idle' | 'detecting' | 'review' | 'uploading';
type UploadMode = 'single-files' | 'combined';

interface BulkItem {
  file: File;
  candidateId?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  needsManualSelection: boolean;
  resultPdf?: KqtnPdfMetadata;
  manualSelection?: boolean;
  aiSource?: boolean;
  status: BulkItemStatus;
  error?: string;
}

interface CombinedSegment extends KqtnBulkSegmentDraft {
  id: string;
  candidateId?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  needsManualSelection: boolean;
  manualSelection: boolean;
  status: 'needs-review' | 'ready' | 'uploading' | 'uploaded' | 'skipped' | 'failed';
  splitFile?: File;
  splitFileReady: boolean;
  resultPdf?: KqtnPdfMetadata;
  error?: string;
}

type CombinedRangeField = 'pageStart' | 'pageEnd';
type CombinedRangeInputValues = Record<string, Partial<Record<CombinedRangeField, string>>>;

export interface KqtnBulkUploadSummary {
  groupId: string;
  sourceFileName: string;
  mode: UploadMode;
  uploaded: number;
  failed: number;
  skipped: number;
}

interface KqtnBulkPdfUploadModalProps {
  isOpen: boolean;
  candidates: KqtnBulkCandidate[];
  onClose: () => void;
  onEnsureUploadTarget: (candidate: KqtnBulkCandidate) => Promise<string>;
  onUploaded: (recordId: string, resultPdf: KqtnPdfMetadata) => Promise<void>;
  onBulkCompleted?: (summary: KqtnBulkUploadSummary) => Promise<void> | void;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

async function fileToBase64(file: File): Promise<string> {
  return bytesToBase64(new Uint8Array(await file.arrayBuffer()));
}

async function createPdfSegmentFile(sourceDoc: PDFDocument, pageStart: number, pageEnd: number, fileName: string): Promise<File> {
  const segmentDoc = await PDFDocument.create();
  const pageIndexes = Array.from({ length: pageEnd - pageStart + 1 }, (_, index) => pageStart - 1 + index);
  const pages = await segmentDoc.copyPages(sourceDoc, pageIndexes);
  pages.forEach((page) => segmentDoc.addPage(page));
  const bytes = await segmentDoc.save();
  return new File([bytes as unknown as BlobPart], fileName, { type: 'application/pdf' });
}

function fileStem(fileName: string): string {
  return fileName.replace(/\.pdf$/i, '').trim() || 'kqtn-result';
}

function makeSegmentFileName(sourceFileName: string, pageStart: number, pageEnd: number): string {
  return `${fileStem(sourceFileName)}__p${pageStart}-${pageEnd}.pdf`;
}

function makeManualPages(totalPages: number): KqtnBulkStructurePage[] {
  return Array.from({ length: totalPages }, (_, index) => ({ pageNumber: index + 1, isReportCover: false, isBlank: false }));
}

function makeSegmentId(index: number, draft: KqtnBulkSegmentDraft): string {
  return `${draft.sourceFileName}:${draft.pageStart}-${draft.pageEnd}:${index}`;
}

function inspectFile(file: File, candidates: KqtnBulkCandidate[]): BulkItem {
  const normalizedName = normalizeKqtnSampleKey(file.name);
  const codeCandidate = candidates.find((candidate) => [candidate.sampleKey, candidate.sampleCode, candidate.reportNo]
    .map((value) => normalizeKqtnSampleKey(value))
    .some((value) => value.length > 2 && normalizedName.includes(value)));
  const modelCandidate = candidates.find((candidate) => {
    const modelKey = normalizeKqtnSampleKey(candidate.model);
    return modelKey.length > 2 && normalizedName.includes(modelKey);
  });
  const match = matchKqtnBulkFile({
    fileName: file.name,
    sampleCode: codeCandidate?.sampleCode,
    reportNo: codeCandidate?.reportNo,
    model: modelCandidate?.model,
    brand: modelCandidate?.brand,
    sealStamp: modelCandidate?.sealStamp,
  }, candidates);
  return {
    file,
    candidateId: match.candidateId,
    reason: match.reason,
    confidence: match.confidence,
    needsManualSelection: match.needsManualSelection,
    manualSelection: false,
    aiSource: false,
    status: match.candidateId && !match.needsManualSelection ? 'ready' : 'needs-review',
  };
}

function buildCombinedSegment(draft: KqtnBulkSegmentDraft, index: number, candidates: KqtnBulkCandidate[]): CombinedSegment {
  const metadata = draft.metadata;
  const match = matchKqtnBulkFile({
    fileName: draft.sourceFileName,
    sampleCode: metadata.sampleCode || metadata.footerKey,
    reportNo: metadata.reportNo || metadata.footerKey,
    model: metadata.model,
    brand: metadata.brand,
    sealStamp: metadata.sealStamp,
  }, candidates);
  return {
    ...draft,
    id: makeSegmentId(index, draft),
    candidateId: match.candidateId,
    reason: metadata.model ? `OCR Paddle model ${metadata.model}: ${match.reason}` : match.reason,
    confidence: match.confidence,
    needsManualSelection: match.needsManualSelection,
    manualSelection: false,
    status: match.candidateId && !match.needsManualSelection ? 'ready' : 'needs-review',
    splitFileReady: false,
  };
}

function statusLabel(status: CombinedSegment['status'] | BulkItemStatus): string {
  switch (status) {
    case 'ready': return 'Sẵn sàng';
    case 'uploading': return 'Đang upload';
    case 'uploaded': return 'Đã upload';
    case 'skipped': return 'Đã bỏ qua';
    case 'failed': return 'Lỗi - có thể retry';
    default: return 'Cần rà soát';
  }
}

function confidenceLabel(confidence: CombinedSegment['confidence'] | BulkItem['confidence']): string {
  return confidence === 'high' ? 'Tin cậy cao' : confidence === 'medium' ? 'Tin cậy vừa' : confidence === 'low' ? 'Tin cậy thấp' : 'Chưa xác định';
}

export default function KqtnBulkPdfUploadModal({ isOpen, candidates, onClose, onEnsureUploadTarget, onUploaded, onBulkCompleted }: KqtnBulkPdfUploadModalProps) {
  const [mode, setMode] = useState<UploadMode>('single-files');
  const [items, setItems] = useState<BulkItem[]>([]);
  const [pendingSingleFiles, setPendingSingleFiles] = useState<File[]>([]);
  const [pendingCombinedFile, setPendingCombinedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isInspectingAi, setIsInspectingAi] = useState(false);
  const [combinedFile, setCombinedFile] = useState<File | null>(null);
  const [combinedTotalPages, setCombinedTotalPages] = useState(0);
  const [combinedSegments, setCombinedSegments] = useState<CombinedSegment[]>([]);
  const [rangeInputValues, setRangeInputValues] = useState<CombinedRangeInputValues>({});
  const [combinedPhase, setCombinedPhase] = useState<CombinedPhase>('idle');
  const [combinedProgress, setCombinedProgress] = useState('');
  const sourcePdfRef = useRef<PDFDocument | null>(null);
  const combinedGroupIdRef = useRef<string | null>(null);

  const candidateMap = useMemo(() => new Map(candidates.map((candidate) => [candidate.id, candidate])), [candidates]);
  const ensureKqtnUploadTarget = (candidate: KqtnBulkCandidate): Promise<string> => onEnsureUploadTarget(candidate);
  const rangeErrors = useMemo(() => validateKqtnBulkSegments(combinedSegments, combinedTotalPages), [combinedSegments, combinedTotalPages]);
  const footerPageCountErrors = useMemo(() => validateKqtnBulkFooterPageCounts(combinedSegments), [combinedSegments]);
  const duplicateCombinedTargets = useMemo(() => {
    const counts = new Map<string, number>();
    combinedSegments.filter((segment) => segment.status !== 'skipped' && segment.status !== 'uploaded').forEach((segment) => {
      if (segment.candidateId) counts.set(segment.candidateId, (counts.get(segment.candidateId) || 0) + 1);
    });
    return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  }, [combinedSegments]);
  const hasDraft = items.length > 0 || combinedFile !== null || combinedSegments.length > 0 || pendingSingleFiles.length > 0 || pendingCombinedFile !== null;

  if (!isOpen) return null;

  const resetState = () => {
    setItems([]);
    setPendingSingleFiles([]);
    setPendingCombinedFile(null);
    setCombinedFile(null);
    setCombinedTotalPages(0);
    setCombinedSegments([]);
    setRangeInputValues({});
    setCombinedPhase('idle');
    setCombinedProgress('');
    sourcePdfRef.current = null;
    combinedGroupIdRef.current = null;
  };

  const createBulkGroupId = () => `kqtn-bulk-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const clearSession = () => {
    if (isUploading || isInspectingAi || combinedPhase === 'detecting') return;
    if (!hasDraft) return;
    if (!window.confirm('Xóa phiên Bulk Upload hiện tại?')) return;
    resetState();
    toast.success('Đã xóa phiên Bulk Upload.');
  };

  const handleClose = () => {
    if (isUploading || isInspectingAi || combinedPhase === 'detecting') return;
    onClose();
  };

  const selectMode = (nextMode: UploadMode) => {
    if (isUploading || isInspectingAi || combinedPhase === 'detecting') return;
    setMode(nextMode);
  };

  const handleSingleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    event.target.value = '';
    if (files.length === 0) return;
    setPendingSingleFiles(files);
  };

  const analyzeSingleFiles = async (files: File[]) => {
    setItems(files.map((file) => inspectFile(file, candidates)));
    setIsInspectingAi(true);
    for (const [index, file] of files.entries()) {
      try {
        const firstPageDoc = await PDFDocument.load(await file.arrayBuffer());
        const firstPageOnly = firstPageDoc.getPageCount() > 1 ? await createPdfSegmentFile(firstPageDoc, 1, 1, `${fileStem(file.name)}-cover.pdf`) : file;
        const firstPageBase64 = await fileToBase64(firstPageOnly);
        let metadata: KqtnPdfAiMetadata = parseKqtnOcrMetadata('');
        let metadataProvider: 'PADDLEOCR' | 'GEMINI' = 'PADDLEOCR';
        try {
          const paddlePage = await extractKqtnPageTextWithPaddle(firstPageBase64, 1);
          if (!isUsableOcrCandidate(paddlePage, 0.75)) throw new Error('PaddleOCR first page is empty or below the confidence threshold.');
          metadata = parseKqtnOcrMetadata(paddlePage.text);
          if (!metadata.sampleCode && !metadata.model && !metadata.brand) {
            metadata = await extractKqtnPdfMetadata(firstPageBase64, 'application/pdf');
            metadataProvider = 'GEMINI';
          }
        } catch (paddleError) {
          console.warn('KQTN first-page PaddleOCR failed; trying Gemini fallback.', paddleError);
          try {
            metadata = await extractKqtnPdfMetadata(firstPageBase64, 'application/pdf');
            metadataProvider = 'GEMINI';
          } catch (geminiError) {
            console.warn('KQTN first-page Gemini fallback failed; keeping manual mapping.', geminiError);
          }
        }
        const hasOcrMetadata = Boolean(metadata.sampleCode || metadata.model || metadata.brand);
        const match = matchKqtnBulkFile({ fileName: file.name, ...metadata }, candidates);
        setItems((current) => current.map((item, itemIndex) => itemIndex === index && !item.manualSelection
          ? {
            ...item,
            candidateId: hasOcrMetadata ? match.candidateId : undefined,
            reason: hasOcrMetadata ? `OCR ${metadataProvider}: ${match.reason}` : `OCR ${metadataProvider} chưa đủ metadata; cần chọn mẫu thủ công. ${match.reason}`,
            confidence: hasOcrMetadata ? match.confidence : 'none',
            needsManualSelection: hasOcrMetadata ? match.needsManualSelection : true,
            aiSource: false,
            status: hasOcrMetadata && match.candidateId && !match.needsManualSelection ? 'ready' : 'needs-review',
          }
          : item));
      } catch (error) {
        console.warn('KQTN PDF OCR metadata extraction failed; keeping manual mapping.', error);
      }
    }
    setIsInspectingAi(false);
    toast.success('Đã quét OCR Paddle trang đầu, fallback Gemini khi cần; hãy rà soát mapping.');
  };

  const analyzeCombinedFile = async (file: File) => {
    combinedGroupIdRef.current = null;
    setCombinedFile(file);
    setCombinedSegments([]);
    setRangeInputValues({});
    setCombinedPhase('detecting');
    setCombinedProgress('Đang đọc số trang PDF...');
    try {
      const sourceDoc = await PDFDocument.load(await file.arrayBuffer());
      const totalPages = sourceDoc.getPageCount();
      sourcePdfRef.current = sourceDoc;
      setCombinedTotalPages(totalPages);
      const detectedFooterPages: KqtnBulkFooterPage[] = [];
      let footerStrategy: 'footer-batch' | undefined;
      let structureFailed = false;
      let sourceBase64: string | undefined;

      try {
        let footerJobStatus = await startKqtnFooterJob(file, totalPages);
        while (footerJobStatus.status === 'queued' || footerJobStatus.status === 'running') {
          const processedPages = footerJobStatus.processedPages;
          const jobTotalPages = footerJobStatus.totalPages || totalPages;
          const strategyLabel = footerJobStatus.strategy === 'footer-batch' ? 'Đang đọc footer ' : 'Đang đọc footer ';
          setCombinedProgress(strategyLabel + processedPages + '/' + jobTotalPages + ' trang...');
          await new Promise((resolve) => window.setTimeout(resolve, 700));
          footerJobStatus = await getKqtnFooterJob(footerJobStatus.jobId);
        }
        if (footerJobStatus.status === 'failed') {
          console.warn('KQTN footer OCR job failed; switching to manual split.', footerJobStatus.error);
          structureFailed = true;
        } else {
          footerStrategy = footerJobStatus.strategy;
          detectedFooterPages.push(...footerJobStatus.pages);
        }
      } catch (error) {
        console.warn('KQTN footer OCR job unavailable; switching to manual split.', error);
        structureFailed = true;
      }

      const paddleFooterUsable = detectedFooterPages.length > 0 && detectedFooterPages.some((page) => Boolean(page.footerKey) && !(page.confidence > 0 && page.confidence < 0.75));
      if (structureFailed || !paddleFooterUsable) {
        try {
          sourceBase64 ||= await fileToBase64(file);
          const fallbackPages = await extractKqtnBulkFooter(sourceBase64, 0);
          if (fallbackPages.length > 0 && fallbackPages.some((page) => Boolean(page.footerKey))) {
            detectedFooterPages.splice(0, detectedFooterPages.length, ...fallbackPages);
            footerStrategy = 'footer-batch';
            structureFailed = false;
            setCombinedProgress('PaddleOCR chưa đủ dữ liệu; đã dùng Gemini fallback cho footer, đang rà soát...');
          }
        } catch (error) {
          console.warn('KQTN Gemini footer fallback failed; switching to manual split.', error);
        }
      }

      const footerKeys = detectedFooterPages.map((page) => page.footerKey).filter(Boolean);
      const hasFooterPages = !structureFailed
        && footerStrategy === 'footer-batch'
        && detectedFooterPages.length > 0
        && footerKeys.length > 0
        && detectedFooterPages.some((page) => page.pageNumber === 1);
      const drafts = !hasFooterPages
        ? buildKqtnBulkSegments(makeManualPages(totalPages), totalPages, file.name)
        : buildKqtnFooterCandidateSegments(detectedFooterPages, totalPages, file.name);
      setCombinedProgress(`Đã phân nhóm ${drafts.length} nhóm; đang đọc model ở tối đa 3 trang đầu mỗi nhóm...`);
      const modelProbedDrafts: KqtnBulkSegmentDraft[] = [];
      for (let batchStart = 0; batchStart < drafts.length; batchStart += 3) {
        const batch = drafts.slice(batchStart, batchStart + 3);
        const probedBatch = await Promise.all(batch.map(async (draft) => {
          const probeTexts: string[] = [];
          for (const pageNumber of getKqtnModelProbePageNumbers(draft.pageStart, draft.pageEnd)) {
            try {
              const probeFile = await createPdfSegmentFile(sourceDoc, pageNumber, pageNumber, `${fileStem(file.name)}-probe-p${pageNumber}.pdf`);
              const paddlePage = await extractKqtnPageTextWithPaddle(await fileToBase64(probeFile), 1);
              if (!isUsableOcrCandidate(paddlePage, 0.75)) throw new Error('PaddleOCR model probe is empty or below the confidence threshold.');
              probeTexts.push(paddlePage.text);
              if (extractKqtnModelFromProbeTexts([paddlePage.text])) break;
            } catch (error) {
              try {
                const probeFile = await createPdfSegmentFile(sourceDoc, pageNumber, pageNumber, `${fileStem(file.name)}-gemini-probe-p${pageNumber}.pdf`);
                const fallback = await extractKqtnPdfMetadata(await fileToBase64(probeFile), 'application/pdf');
                probeTexts.push(`Model: ${fallback.model || ''}`);
                if (fallback.model) break;
              } catch (geminiError) {
                console.warn(`KQTN model probe failed on source page ${pageNumber}; trying the next page.`, error, geminiError);
              }
            }
          }
          const model = extractKqtnModelFromProbeTexts(probeTexts);
          return model ? { ...draft, metadata: { ...draft.metadata, model } } : draft;
        }));
        modelProbedDrafts.push(...probedBatch);
        setCombinedProgress(`Đã đọc model ${modelProbedDrafts.length}/${drafts.length} nhóm; đang chuẩn bị mapping...`);
      }
      const segments = modelProbedDrafts.map((draft, index) => buildCombinedSegment(draft, index, candidates));
      setCombinedSegments(segments);

      setCombinedPhase('review');
      const manualFallback = structureFailed || !hasFooterPages || drafts.some((draft) => draft.detection === 'manual');
      setCombinedProgress(manualFallback ? 'Footer OCR chưa đủ khóa ổn định; hãy nhập mốc trang và chọn mẫu thủ công.' : 'Đã đọc footer và phân nhóm; hãy rà soát cảnh báo trước khi upload.');
      if (manualFallback) toast.warning('Không đủ khóa footer để tự động tách. Đã chuyển sang chế độ tách thủ công.');
    } catch (error: any) {
      sourcePdfRef.current = null;
      setCombinedFile(null);
      setCombinedTotalPages(0);
      setCombinedPhase('idle');
      toast.error(error?.message || 'Không thể đọc PDF nguồn.');
    }
  };

  const handleCombinedFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = Array.from(event.target.files || []).find((candidate) => candidate.type === 'application/pdf' || candidate.name.toLowerCase().endsWith('.pdf'));
    event.target.value = '';
    if (file) setPendingCombinedFile(file);
  };

  const confirmPendingAnalysis = () => {
    if (isUploading || isInspectingAi || combinedPhase === 'detecting') return;
    if (mode === 'single-files' && pendingSingleFiles.length > 0) {
      const files = pendingSingleFiles;
      setPendingSingleFiles([]);
      void analyzeSingleFiles(files);
      return;
    }
    if (mode === 'combined' && pendingCombinedFile) {
      const file = pendingCombinedFile;
      setPendingCombinedFile(null);
      void analyzeCombinedFile(file);
    }
  };

  const clearPendingAnalysis = () => {
    if (isUploading || isInspectingAi || combinedPhase === 'detecting') return;
    if (mode === 'single-files') setPendingSingleFiles([]);
    else setPendingCombinedFile(null);
  };

  const setSingleCandidate = (index: number, candidateId: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, candidateId: candidateId || undefined, needsManualSelection: false, manualSelection: true, status: candidateId ? 'ready' : 'needs-review', reason: candidateId ? 'Đã chọn đầu mẫu thủ công.' : 'Chưa chọn đầu mẫu.' } : item));
  };

  const updateCombinedSegment = (index: number, updates: Partial<CombinedSegment>) => {
    setCombinedSegments((current) => current.map((segment, segmentIndex) => segmentIndex === index ? { ...segment, ...updates } : segment));
  };

  const updateCombinedRange = (index: number, field: 'pageStart' | 'pageEnd', value: number) => {
    setCombinedSegments((current) => current.map((segment, segmentIndex) => {
      if (segmentIndex !== index) return segment;
      const next = normalizeKqtnBulkSegmentRange(field === 'pageStart' ? value : segment.pageStart, field === 'pageEnd' ? value : segment.pageEnd, combinedTotalPages);
      return {
        ...segment,
        ...next,
        detection: 'manual',
        splitFile: undefined,
        splitFileReady: false,
        error: undefined,
        status: segment.status === 'uploaded' ? segment.status : segment.candidateId && segment.manualSelection ? 'ready' : 'needs-review',
      };
    }));
  };

  const handleCombinedRangeInput = (index: number, field: CombinedRangeField, rawValue: string) => {
    const segment = combinedSegments[index];
    if (!segment) return;
    setRangeInputValues((current) => ({
      ...current,
      [segment.id]: { ...current[segment.id], [field]: rawValue },
    }));
    if (rawValue.trim() === '') return;
    const numericValue = Number(rawValue);
    if (Number.isFinite(numericValue)) updateCombinedRange(index, field, numericValue);
  };

  const commitCombinedRangeInput = (index: number, field: CombinedRangeField) => {
    const segment = combinedSegments[index];
    if (!segment) return;
    const rawValue = rangeInputValues[segment.id]?.[field];
    if (rawValue === undefined) return;
    setRangeInputValues((current) => {
      const next = { ...current };
      const values = { ...next[segment.id] };
      delete values[field];
      if (Object.keys(values).length === 0) delete next[segment.id];
      else next[segment.id] = values;
      return next;
    });
  };

  const setCombinedCandidate = (index: number, candidateId: string) => {
    const candidate = candidateMap.get(candidateId);
    updateCombinedSegment(index, { candidateId: candidateId || undefined, manualSelection: true, needsManualSelection: false, reason: candidate ? 'Đã chọn đầu mẫu thủ công.' : 'Chưa chọn đầu mẫu.', confidence: candidate ? 'high' : 'none', status: candidate ? 'ready' : 'needs-review', error: undefined });
  };

  const addManualSegment = () => {
    if (!combinedFile || combinedTotalPages === 0) return;
    const nextStart = Math.min(combinedTotalPages, Math.max(1, combinedSegments.reduce((max, segment) => Math.max(max, segment.pageEnd), 0) + 1));
    const draft: KqtnBulkSegmentDraft = { sourceFileName: combinedFile.name, pageStart: nextStart, pageEnd: nextStart, metadata: { pageNumber: nextStart, isReportCover: false, isBlank: false }, detection: 'manual' };
    setCombinedSegments((current) => [...current, buildCombinedSegment(draft, current.length, candidates)]);
  };

  const removeCombinedSegment = (index: number) => {
    const segment = combinedSegments[index];
    setCombinedSegments((current) => current.filter((_, segmentIndex) => segmentIndex !== index));
    if (segment) {
      setRangeInputValues((current) => {
        const next = { ...current };
        delete next[segment.id];
        return next;
      });
    }
  };

  const previewCombinedSegment = async (segment: CombinedSegment) => {
    if (!sourcePdfRef.current) return;
    const popup = window.open('', '_blank');
    try {
      const file = await createPdfSegmentFile(sourcePdfRef.current, segment.pageStart, segment.pageEnd, makeSegmentFileName(segment.sourceFileName, segment.pageStart, segment.pageEnd));
      const url = URL.createObjectURL(file);
      if (popup) {
        popup.location.href = url;
        window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } else {
        URL.revokeObjectURL(url);
        toast.warning('Trình duyệt đã chặn cửa sổ preview PDF.');
      }
    } catch (error: any) {
      popup?.close();
      toast.error(error?.message || 'Không thể tạo PDF con để preview.');
    }
  };

  const splitCombinedSegments = async () => {
    if (!sourcePdfRef.current || !combinedFile) return;
    if (rangeErrors.length > 0) { toast.warning(rangeErrors[0]); return; }
    if (footerPageCountErrors.length > 0) { toast.warning(footerPageCountErrors[0]); }
    const segmentsToSplit = combinedSegments.filter((segment) => segment.status !== 'uploaded' && segment.status !== 'skipped');
    if (segmentsToSplit.length === 0) return;

    setIsUploading(true);
    setCombinedPhase('uploading');
    let failed = 0;
    for (const segment of segmentsToSplit) {
      if (segment.splitFileReady && segment.splitFile) continue;
      const segmentIndex = combinedSegments.indexOf(segment);
      try {
        setCombinedProgress(`Đang tạo PDF con trang ${segment.pageStart}-${segment.pageEnd}...`);
        const splitFile = await createPdfSegmentFile(sourcePdfRef.current, segment.pageStart, segment.pageEnd, makeSegmentFileName(segment.sourceFileName, segment.pageStart, segment.pageEnd));
        if (splitFile.size > KQTN_PDF_MAX_BYTES) throw new Error(`PDF con vượt giới hạn ${Math.round(KQTN_PDF_MAX_BYTES / 1024 / 1024)} MB.`);
        updateCombinedSegment(segmentIndex, {
          splitFile,
          splitFileReady: true,
          error: undefined,
          status: segment.candidateId && (!segment.needsManualSelection || segment.manualSelection) ? 'ready' : 'needs-review',
        });
      } catch (error: any) {
        failed += 1;
        updateCombinedSegment(segmentIndex, { splitFile: undefined, splitFileReady: false, status: 'failed', error: error?.message || 'Không thể tạo PDF con.' });
      }
    }
    setIsUploading(false);
    setCombinedPhase('review');
    setCombinedProgress(failed > 0 ? `${failed} nhóm chưa tách được; có thể retry.` : 'Đã tách PDF con. Hãy chọn mẫu đích cho từng nhóm rồi lưu.');
    if (failed > 0) toast.error(`${failed} nhóm chưa tạo được PDF con.`);
    else toast.success('Đã tách xong PDF con; hãy rà soát mapping mẫu đích.');
  };

  const validateSingleItems = (): boolean => {
    if (items.some((item) => !item.candidateId || (item.needsManualSelection && !item.manualSelection))) {
      toast.warning('Vui lòng rà soát và chọn đầu mẫu cho mọi file chưa chắc chắn.');
      return false;
    }
    const assignedIds = items.map((item) => item.candidateId).filter(Boolean) as string[];
    if (assignedIds.some((id, index) => assignedIds.indexOf(id) !== index)) {
      toast.warning('Không thể gán nhiều PDF vào cùng một đầu mẫu trong một batch.');
      return false;
    }
    return true;
  };

  const uploadSingleItems = async () => {
    if (!validateSingleItems()) return;
    setIsUploading(true);
    let failed = 0;
    let uploaded = 0;
    let skipped = 0;
    const groupId = createBulkGroupId();
    for (const [index, item] of items.entries()) {
      const candidate = candidateMap.get(item.candidateId || '');
      if (!candidate || item.status === 'uploaded' || item.status === 'skipped') continue;
      if (candidate.isPending) toast.warning(`Mẫu ${candidate.sampleCode} chưa có KQTN; hệ thống sẽ tạo bản ghi trước khi gắn PDF.`);
      if (candidate.hasPdf && !window.confirm(`File PDF của ${candidate.sampleCode} đã tồn tại. Ghi đè file cũ?`)) {
        skipped += 1;
        setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: 'skipped' } : row));
        continue;
      }
      setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: 'uploading', error: undefined } : row));
      try {
        const targetId = await ensureKqtnUploadTarget(candidate);
        const resultPdf = await uploadKqtnPdf(targetId, item.file);
        await onUploaded(targetId, resultPdf);
        uploaded += 1;
        setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: 'uploaded', resultPdf } : row));
      } catch (error: any) {
        failed += 1;
        setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, status: 'failed', error: error?.message || 'Upload thất bại.' } : row));
      }
    }
    setIsUploading(false);
    if (uploaded > 0 || failed > 0 || skipped > 0) {
      await onBulkCompleted?.({ groupId, sourceFileName: `${items.length} file PDF`, mode: 'single-files', uploaded, failed, skipped });
    }
    if (failed > 0) toast.error(`${failed} file upload lỗi; hãy kiểm tra và retry.`);
    else { toast.success(`Đã xử lý ${items.length} file PDF KQTN.`); resetState(); onClose(); }
  };

  const uploadCombinedSegments = async (retryOnlyFailed = false) => {
    if (!sourcePdfRef.current || !combinedFile) return;
    if (rangeErrors.length > 0) { toast.warning(rangeErrors[0]); return; }
    if (footerPageCountErrors.length > 0) { toast.warning(footerPageCountErrors[0]); }
    const uploadPlan = buildKqtnBulkUploadPlan(combinedSegments, candidates, retryOnlyFailed);
    const pending = uploadPlan.queue.map(({ segment }) => segment);
    if (uploadPlan.unsplitSegmentIds.length > 0) { toast.warning('Hãy bấm “Tách PDF con” trước khi lưu vào mẫu đích.'); return; }
    if (uploadPlan.missingSegmentIds.length > 0) { toast.warning('Còn nhóm chưa được gán mẫu đích.'); return; }
    if (uploadPlan.duplicateTargetIds.length > 0) { toast.warning('Có nhiều nhóm đang gán vào cùng một mẫu đích.'); return; }

    if (pending.some((segment) => !segment.candidateId || (segment.needsManualSelection && !segment.manualSelection))) { toast.warning('Còn nhóm cần rà soát hoặc chọn đầu mẫu thủ công.'); return; }
    if (duplicateCombinedTargets.length > 0) { toast.warning('Có nhiều nhóm đang gán vào cùng một đầu mẫu.'); return; }
    const pendingTargets = pending
      .map((segment) => candidateMap.get(segment.candidateId || ''))
      .filter((candidate): candidate is KqtnBulkCandidate => Boolean(candidate?.isPending));
    if (pendingTargets.length > 0) {
      toast.warning(`${pendingTargets.length} mẫu đích chưa có KQTN; hệ thống sẽ tạo bản ghi trước khi gắn PDF.`);
    }

    setIsUploading(true);
    setCombinedPhase('uploading');
    let failed = 0;
    let uploaded = 0;
    let skipped = 0;
    const groupId = combinedGroupIdRef.current || createBulkGroupId();
    combinedGroupIdRef.current = groupId;
    for (const segment of pending) {
      const candidate = candidateMap.get(segment.candidateId || '');
      if (!candidate) continue;
      const segmentIndex = combinedSegments.indexOf(segment);
      if (candidate.hasPdf && !window.confirm(`PDF của ${candidate.sampleCode} đã tồn tại (trang ${segment.pageStart}-${segment.pageEnd}). Ghi đè?`)) { skipped += 1; updateCombinedSegment(segmentIndex, { status: 'skipped' }); continue; }
      updateCombinedSegment(segmentIndex, { status: 'uploading', error: undefined });
      try {
        if (!segment.splitFileReady || !segment.splitFile) throw new Error('PDF con chưa được tạo.');
        setCombinedProgress(`Đang upload ${segment.pageStart}-${segment.pageEnd}...`);
        const targetId = await ensureKqtnUploadTarget(candidate);
        const resultPdf = await uploadKqtnPdf(targetId, segment.splitFile);
        await onUploaded(targetId, resultPdf);
        uploaded += 1;
        updateCombinedSegment(segmentIndex, { status: 'uploaded', resultPdf });
      } catch (error: any) {
        failed += 1;
        updateCombinedSegment(segmentIndex, { status: 'failed', error: error?.message || 'Upload thất bại.' });
      }
    }
    setIsUploading(false);
    setCombinedPhase('review');
    setCombinedProgress(failed > 0 ? `${failed} nhóm lỗi; có thể retry riêng.` : 'Đã xử lý xong các nhóm hợp lệ.');
    if (uploaded > 0 || failed > 0 || skipped > 0) {
      await onBulkCompleted?.({ groupId, sourceFileName: combinedFile.name, mode: 'combined', uploaded, failed, skipped });
    }
    if (failed > 0) toast.error(`${failed} nhóm upload lỗi; hãy bấm Retry nhóm lỗi.`);
    else if (pending.length > 0) { toast.success('Đã tách và upload xong PDF ghép.'); resetState(); onClose(); }
  };

  const renderCandidateCombobox = (value: string | undefined, onChange: (value: string) => void, disabled = false) => (
    <KqtnCandidateCombobox value={value} candidates={candidates} onChange={onChange} disabled={disabled} />
  );
  const renderCandidateSelect = renderCandidateCombobox;

  const hasUnsplitSegments = combinedSegments.some((segment) => segment.status !== 'uploaded' && segment.status !== 'skipped' && !segment.splitFileReady);

  const pendingAnalysisCard = (mode === 'single-files' ? pendingSingleFiles.length > 0 : Boolean(pendingCombinedFile)) ? (
    <div className="mb-4 rounded-sm border border-blue-200 bg-blue-50 p-4 text-xs text-blue-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-black">Đã chọn file, chưa bắt đầu phân tích</div>
          <div className="mt-1 text-[11px] text-blue-700">{mode === 'single-files' ? 'Đã chọn ' + pendingSingleFiles.length + ' PDF đơn.' : 'Đã chọn PDF ghép: ' + (pendingCombinedFile?.name || '')}</div>
        </div>
        <span className="font-semibold text-blue-700">Bước tiếp theo: xác nhận tiến hành</span>
      </div>
      <div className="mt-2 max-h-20 overflow-y-auto rounded-sm border border-blue-100 bg-white/70 px-3 py-2 text-[11px] text-slate-600">
        {mode === 'single-files' ? pendingSingleFiles.map((file, index) => <div key={index + '-' + file.name} className="truncate">{file.name}</div>) : pendingCombinedFile?.name}
      </div>
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={clearPendingAnalysis} disabled={isUploading || isInspectingAi || combinedPhase === 'detecting'} className="rounded-sm border border-blue-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-50">Bỏ chọn</button>
        <button type="button" onClick={confirmPendingAnalysis} disabled={isUploading || isInspectingAi || combinedPhase === 'detecting'} className="flex items-center gap-2 rounded-sm bg-blue-600 px-3 py-2 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"><Upload size={13} /> Xác nhận và bắt đầu phân tích</button>
      </div>
    </div>
  ) : null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4"><div><h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Upload className="h-4 w-4 text-emerald-600" /> Bulk Upload PDF KQTN</h2><p className="mt-1 text-xs text-slate-500">Chọn PDF đơn hoặc PDF ghép nhiều kết quả; luôn rà soát mapping trước khi lưu.</p></div><button onClick={handleClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200" aria-label="Đóng"><X size={17} /></button></div>
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-3">          <div className="flex flex-wrap items-stretch gap-2" role="tablist" aria-label="Chọn loại PDF">            <button type="button" onClick={() => selectMode('single-files')} disabled={isUploading || isInspectingAi} className={`flex min-w-[220px] flex-col items-start rounded-sm border px-3 py-2 text-left text-xs ${mode === 'single-files' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><span className="font-black">PDF đơn (nhiều file)</span><span className={`mt-1 text-[11px] ${mode === 'single-files' ? 'text-emerald-50' : 'text-slate-500'}`}>Mỗi file PDF là một kết quả, không tách</span></button>            <button type="button" onClick={() => selectMode('combined')} disabled={isUploading || isInspectingAi} className={`flex min-w-[260px] items-start gap-2 rounded-sm border px-3 py-2 text-left text-xs ${mode === 'combined' ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-slate-200 bg-white text-slate-700'}`}><Scissors size={14} className="mt-0.5 shrink-0" /><span><span className="block font-black">PDF ghép (1 file, nhiều kết quả)</span><span className={`mt-1 block text-[11px] ${mode === 'combined' ? 'text-emerald-50' : 'text-slate-500'}`}>Cắt theo nhóm trang rồi gán mẫu đích</span></span></button>            {mode === 'single-files' ? <label className="ml-auto flex cursor-pointer items-center gap-2 self-center rounded-sm bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><Upload size={14} /> Chọn nhiều file PDF<input type="file" accept="application/pdf,.pdf" multiple className="hidden" disabled={isInspectingAi || isUploading} onChange={handleSingleFiles} /></label> : <label className="ml-auto flex cursor-pointer items-center gap-2 self-center rounded-sm bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"><Upload size={14} /> Chọn PDF ghép<input type="file" accept="application/pdf,.pdf" className="hidden" disabled={combinedPhase === 'detecting' || isUploading} onChange={handleCombinedFile} /></label>}          </div>          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500"><span className="font-bold text-slate-700">Quy trình:</span><span>1. Chọn nguồn</span><span>→</span><span>2. Rà soát mapping</span><span>→</span><span>3. {mode === 'combined' ? 'Tách PDF con' : 'Upload PDF đơn'}</span><span>→</span><span>4. {mode === 'combined' ? 'Lưu các PDF con vào mẫu đích' : 'Hoàn tất'}</span>{(isInspectingAi || combinedPhase === 'detecting') && <span className="ml-auto flex items-center gap-1 font-semibold text-blue-600"><Loader2 size={12} className="animate-spin" /> {combinedProgress || 'Đang phân tích PDF...'}</span>}</div>        </div>
          {pendingAnalysisCard}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {mode === 'single-files' ? items.length === 0 ? <div className="rounded-sm border border-dashed border-slate-300 p-12 text-center text-xs text-slate-500"><FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />Chọn các file PDF kết quả thử nghiệm để bắt đầu upload.</div> : <div className="space-y-2">{items.map((item, index) => { const candidate = item.candidateId ? candidateMap.get(item.candidateId) : undefined; return <div key={`${item.file.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] items-center gap-3 rounded-sm border border-slate-200 p-3 text-xs"><div className="min-w-0"><div className="flex items-center gap-2 font-bold text-slate-800"><FileText size={14} className="shrink-0 text-red-500" /><span className="truncate" title={item.file.name}>{item.file.name}</span></div><div className="mt-1 text-[11px] text-slate-500">{item.reason} · {confidenceLabel(item.confidence)}</div>{item.error && <div className="mt-1 text-[11px] text-red-600">{item.error}</div>}</div>{renderCandidateSelect(item.candidateId, (value) => setSingleCandidate(index, value), isUploading)}{item.status === 'uploaded' || candidate && item.status === 'ready' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-[10px] font-bold text-amber-600">{statusLabel(item.status)}</span>}</div>; })}</div> : combinedFile ? <div className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-slate-200 bg-slate-50 p-3 text-xs"><div className="flex min-w-0 items-center gap-2 font-bold text-slate-800"><FileText size={15} className="text-red-500" /><span className="truncate">{combinedFile.name}</span></div><span className="font-semibold text-slate-500">{combinedTotalPages} trang · {combinedSegments.length} nhóm · {combinedProgress}</span></div>{rangeErrors.length > 0 && <div className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-700"><AlertCircle size={14} className="mt-0.5 shrink-0" /><div>{rangeErrors.map((error) => <div key={error}>{error}</div>)}</div></div>}{footerPageCountErrors.length > 0 && <div className="flex items-start gap-2 rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800"><AlertCircle size={14} className="mt-0.5 shrink-0" /><div>{footerPageCountErrors.map((error) => <div key={error}>{error}</div>)}</div></div>}{duplicateCombinedTargets.length > 0 && <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">Có nhóm trùng đầu mẫu: {duplicateCombinedTargets.map((id) => candidateMap.get(id)?.sampleCode || id).join(', ')}.</div>}{combinedSegments.map((segment, index) => { const candidate = segment.candidateId ? candidateMap.get(segment.candidateId) : undefined; return <div key={segment.id} className={`rounded-sm border p-3 text-xs ${segment.status === 'failed' ? 'border-red-200 bg-red-50/30' : segment.status === 'needs-review' ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200'}`}><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="font-bold text-slate-800">Nhóm {index + 1} · trang {segment.pageStart}-{segment.pageEnd}</div><div className="mt-1 text-[11px] text-slate-500">{segment.reason} · {confidenceLabel(segment.confidence)} · {segment.detection === 'ai' ? 'AI đề xuất' : segment.detection === 'footer' ? 'Footer OCR' : 'Thủ công'}</div>{segment.error && <div className="mt-1 text-[11px] text-red-700">{segment.error}</div>}</div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${segment.status === 'uploaded' ? 'bg-emerald-100 text-emerald-700' : segment.status === 'failed' ? 'bg-red-100 text-red-700' : segment.status === 'needs-review' ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{statusLabel(segment.status)}</span></div><div className="mt-3 grid gap-2 md:grid-cols-[120px_120px_minmax(0,1fr)_auto_auto] md:items-end"><label className="text-[11px] font-semibold text-slate-600">Trang bắt đầu<input type="number" min={1} max={combinedTotalPages} value={rangeInputValues[segment.id]?.pageStart ?? segment.pageStart} disabled={isUploading || segment.status === 'uploaded'} onChange={(event) => handleCombinedRangeInput(index, 'pageStart', event.target.value)} onBlur={() => commitCombinedRangeInput(index, 'pageStart')} className="mt-1 w-full rounded-sm border border-slate-200 px-2 py-2 text-xs" /></label><label className="text-[11px] font-semibold text-slate-600">Trang kết thúc<input type="number" min={1} max={combinedTotalPages} value={rangeInputValues[segment.id]?.pageEnd ?? segment.pageEnd} disabled={isUploading || segment.status === 'uploaded'} onChange={(event) => handleCombinedRangeInput(index, 'pageEnd', event.target.value)} onBlur={() => commitCombinedRangeInput(index, 'pageEnd')} className="mt-1 w-full rounded-sm border border-slate-200 px-2 py-2 text-xs" /></label><div>{renderCandidateSelect(segment.candidateId, (value) => setCombinedCandidate(index, value), isUploading || segment.status === 'uploaded')}</div><button onClick={() => void previewCombinedSegment(segment)} disabled={segment.status === 'uploaded' || !sourcePdfRef.current} className="flex items-center justify-center gap-1 rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-600 disabled:opacity-50"><Eye size={13} /> Xem PDF con</button><button onClick={() => removeCombinedSegment(index)} disabled={isUploading || segment.status === 'uploaded'} className="flex items-center justify-center gap-1 rounded-sm border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 disabled:opacity-50"><Trash2 size={13} /> Xóa nhóm</button></div>{candidate && <div className="mt-2 text-[11px] text-slate-500">{candidate.sampleCode} · {candidate.sampleName || candidate.model}{candidate.hasPdf ? ' · sẽ hỏi xác nhận ghi đè' : ''}</div>}{segment.splitFileReady && segment.splitFile && <div className="mt-1 text-[11px] font-semibold text-emerald-700">Đã tách PDF con: {segment.splitFile.name} · {(segment.splitFile.size / 1024 / 1024).toFixed(2)} MB</div>}</div>; })}<button onClick={addManualSegment} disabled={combinedPhase === 'uploading' || combinedTotalPages === 0} className="flex items-center gap-1 rounded-sm border border-dashed border-slate-300 px-3 py-2 text-xs font-bold text-slate-600"><Plus size={13} /> Thêm nhóm thủ công</button></div> : <div className="rounded-sm border border-dashed border-slate-300 p-12 text-center text-xs text-slate-500"><Scissors className="mx-auto mb-2 h-8 w-8 text-slate-300" />Chọn một PDF lớn chứa nhiều kết quả để phân tích và tách theo nhóm trang.</div>}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">{hasDraft && <button onClick={clearSession} disabled={isUploading || isInspectingAi || combinedPhase === 'detecting'} className="mr-auto rounded-sm border border-amber-200 bg-white px-4 py-2 text-xs font-bold text-amber-700 disabled:opacity-50">Xóa phiên</button>}<button onClick={handleClose} disabled={isUploading || isInspectingAi || combinedPhase === 'detecting'} className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 disabled:opacity-50">Hủy</button>{mode === 'combined' && combinedSegments.some((segment) => segment.status === 'failed') && <button onClick={() => void (hasUnsplitSegments ? splitCombinedSegments() : uploadCombinedSegments(true))} disabled={combinedPhase === 'uploading' || combinedPhase === 'detecting'} className="flex items-center gap-1 rounded-sm border border-red-200 bg-white px-4 py-2 text-[11px] font-bold text-red-700 disabled:opacity-50"><RotateCcw size={13} /> Retry nhóm lỗi</button>}{mode === 'single-files' ? <button disabled={isUploading || isInspectingAi || items.length === 0} onClick={() => void uploadSingleItems()} className="flex items-center gap-2 rounded-sm bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{isUploading && <Loader2 size={14} className="animate-spin" />} Upload và lưu PDF</button> : <button disabled={combinedPhase === 'uploading' || combinedPhase === 'detecting' || combinedSegments.length === 0} onClick={() => void (hasUnsplitSegments ? splitCombinedSegments() : uploadCombinedSegments(false))} title="Tách PDF con và lưu vào mẫu đích" className="flex items-center gap-2 rounded-sm bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{combinedPhase === 'uploading' && <Loader2 size={14} className="animate-spin" />} {hasUnsplitSegments ? 'Tách PDF con và lưu vào mẫu đích' : 'Lưu các PDF con vào mẫu đích'}</button>}</div>
      </div>
    </div>
  );
}

// --- End of KqtnBulkPdfUploadModal.tsx ---
