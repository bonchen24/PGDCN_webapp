'use client';

import React from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, X } from 'lucide-react';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnCertificationField,
  ReturnedTestResult,
} from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import type { PcnDataIntegrityIssue } from '../utils/pcnDataIntegrity';

function formatDate(value?: string): string {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định' : date.toLocaleDateString('vi-VN');
}

function outcomeLabel(outcome: ReturnedTestResult['outcome']): string {
  return outcome === 'PASS' ? 'Đạt' : outcome === 'FAIL' ? 'Không đạt' : 'Đang chờ';
}

function Detail({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
      <div className="text-[9px] font-black uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-1 break-words text-[11px] font-bold text-slate-700">{value || 'Chưa có'}</div>
    </div>
  );
}

export default function PcnResultDetailModal({
  result,
  request,
  dossier,
  proposal,
  field,
  integrityIssues,
  onClose,
}: {
  result: ReturnedTestResult;
  request?: OutboundLabRequest;
  dossier?: CertificationDossier;
  proposal?: CertificationProposal;
  field?: PcnCertificationField;
  integrityIssues: PcnDataIntegrityIssue[];
  onClose: () => void;
}) {
  const customer = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal) : undefined;
  const hasIssues = integrityIssues.length > 0;
  const Icon = hasIssues ? AlertTriangle : result.outcome === 'PASS' ? CheckCircle2 : result.outcome === 'FAIL' ? AlertTriangle : Clock3;
  const tone = hasIssues ? 'text-rose-700 bg-rose-50 border-rose-200' : result.outcome === 'PASS' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' : result.outcome === 'FAIL' ? 'text-rose-700 bg-rose-50 border-rose-200' : 'text-amber-700 bg-amber-50 border-amber-200';

  return (
    <div className="fixed inset-0 z-[84] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="pcn-result-detail-title" className="flex min-h-0 max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-emerald-200 bg-white shadow-md sm:rounded-2xl">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Icon size={16} className={tone.split(' ')[0]} />
              <h2 id="pcn-result-detail-title" className="text-sm font-black text-slate-800">Chi tiết KQTN</h2>
              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-black ${tone}`}>{hasIssues ? 'Cần rà soát' : outcomeLabel(result.outcome)}</span>
              {result.isOfficial && !hasIssues && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Kết quả chính thức</span>}
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Bản ghi KQTN gắn với PYC, mẫu và bộ hồ sơ đang mở.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng chi tiết KQTN" className="mobile-touch-target rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1"><X size={16} /></button>
        </header>

        <div className="min-h-0 flex-1 mobile-scroll-y space-y-4 overflow-y-auto p-4">
          {hasIssues && <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800"><p className="font-black">Thông tin cần người có quyền rà soát</p><ul className="mt-1 list-disc space-y-0.5 pl-4">{integrityIssues.map((issue) => <li key={`${issue.entityId}-${issue.code}`}>{issue.message}</li>)}</ul></div>}

          <div className="grid gap-2 md:grid-cols-4">
            <Detail label="Số báo cáo" value={result.reportNumber || `KQTN vòng ${result.round}`} />
            <Detail label="Vòng thử" value={result.round} />
            <Detail label="Ngày nhận" value={formatDate(result.receivedAt)} />
            <Detail label="Kết quả" value={outcomeLabel(result.outcome)} />
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] font-black text-slate-700"><FileCheck2 size={14} className="text-emerald-600" /> Ngữ cảnh hồ sơ</div>
            <div className="grid gap-2 md:grid-cols-2">
              <Detail label="Hồ sơ" value={dossier?.dossierCode || result.dossierId} />
              <Detail label="Khách hàng" value={customer?.name} />
              <Detail label="PYC" value={request?.pycNumber || result.labRequestId} />
              <Detail label="Phòng thử nghiệm" value={request?.laboratoryName} />
              <Detail label="Lĩnh vực" value={field?.name || request?.fieldCode} />
              <Detail label="Chỉ tiêu / tiêu chuẩn" value={request?.criteria} />
            </div>
          </div>

          {result.sampleIssue && <div className="rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-[10px] text-rose-800"><p className="font-black">Vấn đề mẫu: {result.sampleIssue.type}</p><p className="mt-1">{result.sampleIssue.description}</p><p className="mt-1 text-rose-600">Ghi nhận: {formatDate(result.sampleIssue.reportedAt)}</p></div>}
          {result.notes && <div><div className="mb-1 text-[10px] font-black text-slate-500">Ghi chú</div><p className="whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-700">{result.notes}</p></div>}

          <div className="rounded-lg border border-indigo-200 bg-indigo-50/60 px-3 py-2">
            <div className="text-[10px] font-black text-indigo-800">Bằng chứng OCR KQTN</div>
            {result.ocrEvidence ? <div className="mt-2 grid gap-2 md:grid-cols-4">
              <Detail label="Nhà cung cấp" value={result.ocrEvidence.provider} />
              <Detail label="File scan" value={result.ocrEvidence.sourceFileName} />
              <Detail label="Trang đọc" value={result.ocrEvidence.sourcePage || 'Toàn file'} />
              <Detail label="Độ tin cậy" value={`${Math.round(result.ocrEvidence.confidence * 100)}%`} />
              <Detail label="Thời điểm xác nhận" value={formatDate(result.ocrEvidence.confirmedAt)} />
              <Detail label="Người xác nhận" value={result.ocrEvidence.confirmedBy} />
            </div> : <p className="mt-1 text-[10px] font-bold text-amber-700">Bản ghi chưa có bằng chứng OCR; không dùng bản ghi này làm KQTN mới đã xác nhận.</p>}
          </div>

          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-[10px]">
            {result.fileAssetId ? <a href={getPcnFileUrl(result.fileAssetId)} target="_blank" rel="noreferrer" className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 font-black text-indigo-700 underline underline-offset-2">Mở file KQTN</a> : <span className="font-bold text-slate-500">Chưa gắn file báo cáo KQTN</span>}
            {hasIssues && <span className="font-bold text-rose-700">Không cho ghi đè file khi còn lỗi integrity.</span>}
          </div>
        </div>

        <footer className="flex shrink-0 justify-end border-t border-slate-200 bg-white px-4 py-3"><button type="button" onClick={onClose} className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-1">Đóng</button></footer>
      </section>
    </div>
  );
}
