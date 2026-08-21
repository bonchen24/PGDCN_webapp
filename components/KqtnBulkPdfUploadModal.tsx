// Author: Gemini
// OS support: Web/Node
// Description: Bulk PDF assignment modal with deterministic code/model matching and manual fallback.

import React, { useMemo, useState } from 'react';
import { CheckCircle2, FileText, Loader2, Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import type { KqtnPdfMetadata } from '../types';
import { matchKqtnBulkFile, type KqtnBulkCandidate } from '../utils/kqtnBulkMatching';
import { normalizeKqtnSampleKey } from '../utils/kqtnIdentity';
import { extractKqtnPdfMetadata, uploadKqtnPdf } from '../utils/kqtnPdfClient';

interface BulkItem {
  file: File;
  candidateId?: string;
  reason: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  needsManualSelection: boolean;
  resultPdf?: KqtnPdfMetadata;
  manualSelection?: boolean;
  aiSource?: boolean;
}

interface KqtnBulkPdfUploadModalProps {
  isOpen: boolean;
  candidates: KqtnBulkCandidate[];
  onClose: () => void;
  onUploaded: (recordId: string, resultPdf: KqtnPdfMetadata) => Promise<void>;
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function inspectFile(file: File, candidates: KqtnBulkCandidate[]) {
  const normalizedName = normalizeKqtnSampleKey(file.name);
  const codeCandidate = candidates.find((candidate) => normalizedName.includes(candidate.sampleKey));
  const modelCandidate = candidates.find((candidate) => {
    const modelKey = normalizeKqtnSampleKey(candidate.model);
    return modelKey.length > 2 && normalizedName.includes(modelKey);
  });
  const match = matchKqtnBulkFile({
    fileName: file.name,
    sampleCode: codeCandidate?.sampleCode,
    model: modelCandidate?.model,
  }, candidates);
  return {
    file,
    candidateId: match.candidateId,
    reason: match.reason,
    confidence: match.confidence,
    needsManualSelection: match.needsManualSelection,
    manualSelection: false,
    aiSource: false,
  } satisfies BulkItem;
}

export default function KqtnBulkPdfUploadModal({ isOpen, candidates, onClose, onUploaded }: KqtnBulkPdfUploadModalProps) {
  const [items, setItems] = useState<BulkItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isInspectingAi, setIsInspectingAi] = useState(false);

  const candidateMap = useMemo(() => new Map(candidates.map((candidate) => [candidate.id, candidate])), [candidates]);

  if (!isOpen) return null;

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []).filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
    const initialItems = files.map((file) => inspectFile(file, candidates));
    setItems(initialItems);
    event.target.value = '';
    if (files.length === 0) return;

    setIsInspectingAi(true);
    let aiMatches = 0;
    for (const [index, file] of files.entries()) {
      try {
        const base64Data = await fileToBase64(file);
        const metadata = await extractKqtnPdfMetadata(base64Data, file.type || 'application/pdf');
        const match = matchKqtnBulkFile({ fileName: file.name, sampleCode: metadata.sampleCode, model: metadata.model }, candidates);
        setItems((current) => current.map((item, itemIndex) => itemIndex === index && !item.manualSelection
          ? { ...item, candidateId: match.candidateId, reason: 'AI: ' + match.reason, confidence: match.confidence, needsManualSelection: match.needsManualSelection, aiSource: true }
          : item));
        aiMatches += 1;
      } catch (error) {
        console.warn('KQTN PDF AI metadata extraction failed; keeping deterministic match.', error);
      }
    }
    setIsInspectingAi(false);
    if (aiMatches > 0) toast.success('AI metadata analysis completed; please review the mapping.');
  };

  const setCandidate = (index: number, candidateId: string) => {
    setItems((current) => current.map((item, itemIndex) => itemIndex === index
      ? { ...item, candidateId: candidateId || undefined, needsManualSelection: !candidateId, manualSelection: true, reason: candidateId ? 'Manually selected sample head.' : 'Sample head is not selected.' }
      : item));
  };

  const uploadAll = async () => {
    const unresolved = items.find((item) => !item.candidateId);
    if (unresolved) {
      toast.warning('Vui lòng chọn đầu mẫu cho tất cả file chưa ghép được.');
      return;
    }
    const assignedIds = items.map((item) => item.candidateId).filter(Boolean) as string[];
    const duplicateTarget = assignedIds.find((candidateId, index) => assignedIds.indexOf(candidateId) !== index);
    if (duplicateTarget) {
      toast.warning('Multiple PDF files target the same sample head. Keep only one file per sample.');
      return;
    }

    const pendingRows = items
      .map((item) => candidateMap.get(item.candidateId || ''))
      .filter((candidate) => !candidate || candidate.id.startsWith('sample-head:'));
    if (pendingRows.length > 0) {
      toast.warning('Cần lưu kết quả KQTN trước khi nhận PDF cho đầu mẫu đó.');
      return;
    }

    setIsUploading(true);
    try {
      for (const item of items) {
        const candidate = candidateMap.get(item.candidateId || '');
        if (!candidate) continue;
        if (candidate.hasPdf && !window.confirm(`File PDF của ${candidate.sampleCode} đã tồn tại. Ghi đè file cũ?`)) continue;
        const resultPdf = await uploadKqtnPdf(candidate.id, item.file);
        await onUploaded(candidate.id, resultPdf);
      }
      toast.success(`Đã xử lý ${items.length} file PDF KQTN.`);
      setItems([]);
      onClose();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể upload PDF KQTN.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-black text-slate-900"><Upload className="h-4 w-4 text-emerald-600" /> Bulk Upload PDF KQTN</h2>
            <p className="mt-1 text-xs text-slate-500">Ghép theo mã hóa trước, model sau; trường hợp chưa chắc chắn có thể chọn đầu mẫu thủ công.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-200" aria-label="Đóng"><X size={17} /></button>
        </div>

        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-sm bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
            <Upload size={14} /> Chọn nhiều file PDF
            <input type="file" accept="application/pdf,.pdf" multiple className="hidden" disabled={isInspectingAi} onChange={handleFiles} />
          </label>
          {isInspectingAi && <span className="flex items-center gap-1 text-xs font-semibold text-blue-600"><Loader2 size={12} className="animate-spin" /> AI is reading PDF metadata...</span>}
          <span className="text-xs font-semibold text-slate-500">{items.length} file đã chọn</span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {items.length === 0 ? (
            <div className="rounded-sm border border-dashed border-slate-300 p-12 text-center text-xs text-slate-500">
              <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              Chọn các file PDF kết quả thử nghiệm để bắt đầu ghép.
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item, index) => {
                const candidate = item.candidateId ? candidateMap.get(item.candidateId) : undefined;
                return (
                  <div key={`${item.file.name}-${index}`} className="grid grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)_auto] items-center gap-3 rounded-sm border border-slate-200 p-3 text-xs">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 font-bold text-slate-800"><FileText size={14} className="shrink-0 text-red-500" /><span className="truncate" title={item.file.name}>{item.file.name}</span></div>
                      <div className="mt-1 text-[11px] text-slate-500">{item.reason}</div>
                    </div>
                    <select value={item.candidateId || ''} onChange={(event) => setCandidate(index, event.target.value)} className="w-full rounded-sm border border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-700">
                      <option value="">-- Chọn đầu mẫu --</option>
                      {candidates.map((option) => <option key={option.id} value={option.id}>{option.sampleCode} · {option.model}{option.hasPdf ? ' · đã có PDF' : ''}</option>)}
                    </select>
                    {candidate ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <span className="text-[10px] font-bold text-amber-600">Cần chọn</span>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-3">
          <button onClick={onClose} className="rounded-sm border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600">Hủy</button>
          <button disabled={isUploading || isInspectingAi || items.length === 0} onClick={uploadAll} className="flex items-center gap-2 rounded-sm bg-emerald-600 px-4 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
            {isUploading && <Loader2 size={14} className="animate-spin" />} Upload và lưu PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// --- End of KqtnBulkPdfUploadModal.tsx ---
