'use client';

import { formatDateDdMmYyyy } from '../utils/formatter';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock3, FileCheck2, Plus, Upload, X } from 'lucide-react';
import { toast } from 'sonner';

import type {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnSampleIssueType,
  PcnCertificationField,
  PcnOcrDraft,
  ReturnedTestResult,
} from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnDataIntegrityReport, type PcnDataIntegrityIssue } from '../utils/pcnDataIntegrity';
import { getPcnDossierCustomerSnapshot } from '../utils/pcnDossierPolicy';
import { isPcnInternalSampleRequest } from '../utils/pcnLabOperations';
import { buildPcnReturnedResult } from '../utils/pcnResultPolicy';
import PcnCatalogCombobox from './PcnCatalogCombobox';
import PcnOcrPanel from './PcnOcrPanel';
import PcnResultDetailModal from './PcnResultDetailModal';
import { PgdcnDateInput } from './PgdcnDateInput';

function makeId(): string {
  return `result-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`}`;
}

function formatDate(value?: string): string {
  return formatDateDdMmYyyy(value) || 'Chưa xác định';
}

function outcomeLabel(outcome: ReturnedTestResult['outcome']): string {
  return outcome === 'PASS' ? 'Đạt' : outcome === 'FAIL' ? 'Không đạt' : 'Đang chờ';
}

type PcnResultReturnViewProps = {
  fields: PcnCertificationField[];
  dossiers: CertificationDossier[];
  proposals: CertificationProposal[];
  requests: OutboundLabRequest[];
  results: ReturnedTestResult[];
  initialDossierId?: string;
  canEdit: boolean;
  onSave: (result: ReturnedTestResult) => Promise<void>;
  onAttachFile: (resultId: string, file: File) => Promise<void>;
};

export function PcnResultReturnView({
  fields,
  dossiers,
  proposals,
  requests,
  results,
  initialDossierId,
  canEdit,
  onSave,
  onAttachFile,
}: PcnResultReturnViewProps) {
  const [openForm, setOpenForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    labRequestId: '',
    round: '1',
    outcome: 'PENDING' as ReturnedTestResult['outcome'],
    receivedAt: new Date().toISOString().slice(0, 10),
    reportNumber: '',
    notes: '',
    sampleIssueType: '' as PcnSampleIssueType | '',
    sampleIssueDescription: '',
  });
  const [resultFile, setResultFile] = useState<File>();
  const [ocrConfirmed, setOcrConfirmed] = useState(false);
  const [ocrDraft, setOcrDraft] = useState<PcnOcrDraft>();
  const [uploadingResultId, setUploadingResultId] = useState<string>();
  const [selectedResultId, setSelectedResultId] = useState<string>();
  const internalRequests = requests.filter((request) => isPcnInternalSampleRequest(request));
  const internalRequestIds = new Set(internalRequests.map((request) => request.id));
  const eligibleRequests = internalRequests.filter((request) =>
    ['SENT', 'RECEIVED', 'RESULT_RETURNED'].includes(request.status)
    && dossiers.some((dossier) => dossier.id === request.dossierId)
    && (!initialDossierId || request.dossierId === initialDossierId),
  );
  const requestOptions = eligibleRequests.map((request) => {
    const dossier = dossiers.find((item) => item.id === request.dossierId);
    const proposal = proposals.find((item) => item.id === dossier?.proposalId);
    const customerName = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal)?.name : undefined;
    return {
      value: request.id,
      label: `${request.pycNumber} — ${request.laboratoryName} — ${request.status} — ${customerName || dossier?.dossierCode || 'Hồ sơ PCN'}`,
      searchText: [request.id, request.pycNumber, request.laboratoryName, request.status, request.fieldCode, customerName, dossier?.dossierCode, proposal?.proposalCode].filter(Boolean).join(' '),
      description: [dossier?.dossierCode, customerName].filter(Boolean).join(' · '),
    };
  });
  const visibleResults = initialDossierId
    ? results.filter((result) => result.dossierId === initialDossierId && internalRequestIds.has(result.labRequestId))
    : results.filter((result) => internalRequestIds.has(result.labRequestId));
  const selectedRequest = eligibleRequests.find((request) => request.id === form.labRequestId);
  const selectedResult = visibleResults.find((result) => result.id === selectedResultId);
  const selectedResultRequest = selectedResult ? internalRequests.find((request) => request.id === selectedResult.labRequestId) : undefined;
  const selectedResultDossier = selectedResult ? dossiers.find((dossier) => dossier.id === selectedResult.dossierId) : undefined;
  const selectedResultProposal = selectedResultDossier ? proposals.find((proposal) => proposal.id === selectedResultDossier.proposalId) : undefined;
  const selectedResultField = fields.find((field) => field.code === selectedResultRequest?.fieldCode);
  const resultIntegrityIssues = useMemo(() => {
    const issues = getPcnDataIntegrityReport({
      proposals,
      dossiers,
      sampleLots: [],
      sampleRoutes: [],
      labRequests: internalRequests,
      returnedResults: results,
      issuancePackages: [],
    }).issues.filter((issue) => issue.collection === 'returnedResults');
    return issues.reduce((map, issue) => {
      const current = map.get(issue.entityId) || [];
      map.set(issue.entityId, [...current, issue]);
      return map;
    }, new Map<string, PcnDataIntegrityIssue[]>());
  }, [dossiers, proposals, requests, results]);

  const reset = () => {
    setForm({
      labRequestId: '',
      round: '1',
      outcome: 'PENDING',
      receivedAt: new Date().toISOString().slice(0, 10),
      reportNumber: '',
      notes: '',
      sampleIssueType: '',
      sampleIssueDescription: '',
    });
    setResultFile(undefined);
    setOcrConfirmed(false);
    setOcrDraft(undefined);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!canEdit) return;
    if (!selectedRequest) {
      toast.error('Vui lòng chọn PYC cần trả KQTN.');
      return;
    }
    if (!resultFile) {
      toast.error('Vui lòng đính kèm bản scan KQTN do phòng thử nghiệm cấp.');
      return;
    }
    if (!ocrConfirmed || !ocrDraft?.provider) {
      toast.error('Vui lòng chạy OCR và xác nhận bản nháp KQTN trước khi lưu.');
      return;
    }
    setSaving(true);
    try {
      const result = buildPcnReturnedResult({
        id: makeId(),
        dossierId: selectedRequest.dossierId,
        labRequestId: selectedRequest.id,
        round: form.round,
        outcome: form.outcome,
        receivedAt: `${form.receivedAt}T00:00:00.000Z`,
        reportNumber: form.reportNumber,
        notes: form.notes,
        ...(form.sampleIssueType && form.sampleIssueDescription.trim()
          ? {
              sampleIssue: {
                type: form.sampleIssueType,
                description: form.sampleIssueDescription.trim(),
                reportedAt: `${form.receivedAt}T00:00:00.000Z`,
              },
            }
          : {}),
        ocrEvidence: {
          provider: ocrDraft.provider,
          sourceFileName: resultFile.name,
          ...(ocrDraft.sourcePage ? { sourcePage: ocrDraft.sourcePage } : {}),
          confidence: ocrDraft.confidence,
          confirmedAt: new Date().toISOString(),
        },
      });
      await onSave(result);
      if (resultFile) {
        try {
          await onAttachFile(result.id, resultFile);
        } catch (error: any) {
          toast.error(error?.message || 'KQTN đã lưu nhưng chưa gắn được tệp quét; hãy mở card để gắn lại.');
          reset();
          setOpenForm(false);
          return;
        }
      }
      reset();
      setOpenForm(false);
      toast.success('Đã ghi nhận KQTN trả về và cập nhật trạng thái hồ sơ.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu KQTN trả về');
    } finally {
      setSaving(false);
    }
  };

  const attachResultFile = async (event: React.ChangeEvent<HTMLInputElement>, resultId: string) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!canEdit || !file) return;
    setUploadingResultId(resultId);
    try {
      await onAttachFile(resultId, file);
      toast.success('Đã gắn tệp KQTN vào vùng lưu trữ riêng của PCN.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể gắn tệp KQTN');
    } finally {
      setUploadingResultId(undefined);
    }
  };

  const applyResultOcr = (ocrFields: Record<string, string>, draft: PcnOcrDraft) => {
    const outcomeText = String(ocrFields.outcome || '').toLocaleLowerCase();
    const outcome = outcomeText.includes('không đạt') || outcomeText.includes('khong dat') || outcomeText.includes('fail')
      ? 'FAIL'
      : outcomeText.includes('đạt') || outcomeText.includes('dat') || outcomeText.includes('pass')
        ? 'PASS'
        : undefined;
    setForm((previous) => ({
      ...previous,
      ...(ocrFields.reportNumber ? { reportNumber: ocrFields.reportNumber } : {}),
      ...(ocrFields.notes ? { notes: ocrFields.notes } : {}),
      ...(outcome ? { outcome } : {}),
    }));
    setOcrDraft(draft);
    setOcrConfirmed(true);
    toast.success('Đã điền bản nháp OCR vào biểu mẫu KQTN; hãy kiểm tra trước khi lưu.');
  };

  const selectResultFile = (file?: File) => {
    if (!file) return;
    setResultFile(file);
    setOcrConfirmed(false);
    setOcrDraft(undefined);
  };

  return (
    <div className="pcn-page-surface min-w-0 bg-slate-50/60 p-3 pb-20 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">KQTN trả về</h1>
          <p className="mt-1 text-[11px] text-slate-500">Tiếp nhận kết quả từ PTN theo từng PYC và vòng thử; không tạo lịch thử nghiệm.</p>
          {initialDossierId && <p className="mt-2 text-[10px] font-black text-emerald-700">Đang tập trung hồ sơ: {dossiers.find((dossier) => dossier.id === initialDossierId)?.dossierCode || initialDossierId}</p>}
        </div>
        {!openForm && canEdit && <button onClick={() => setOpenForm(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white"><Plus size={14} /> Tiếp nhận KQTN</button>}
      </div>

      {openForm && (
        <div className="fixed inset-0 z-[82] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="presentation">
          <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="pcn-result-form-title" className="flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-emerald-200 bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3">
              <div><h2 id="pcn-result-form-title" className="text-sm font-black text-slate-800">KQTN từ PTN</h2><p className="mt-1 text-[10px] text-slate-500">Tiếp nhận kết quả theo PYC, vòng thử và tình trạng mẫu.</p></div>
              <button type="button" onClick={() => { reset(); setOpenForm(false); }} disabled={saving} aria-label="Đóng biểu mẫu KQTN" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 disabled:opacity-40"><X size={16} /></button>
            </div>
            <div className="min-h-0 flex-1 mobile-scroll-y space-y-3 overflow-y-auto p-3 md:p-4">
          <PcnOcrPanel context="result" onApply={applyResultOcr} onFileSelected={selectResultFile} disabled={saving} />
          <div className="grid gap-2 md:grid-cols-3">
            <label className="block md:col-span-2"><span className="mb-1 block text-[10px] font-black text-slate-500">PYC gửi PTN <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><PcnCatalogCombobox id="pcn-result-return-request" label="PYC gửi PTN" hideLabel required value={form.labRequestId} onChange={(value) => setForm({ ...form, labRequestId: value })} options={requestOptions} /></label>
            <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Vòng KQTN <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><input type="number" min="1" required value={form.round} onChange={(event) => setForm({ ...form, round: event.target.value })} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" /></label>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Kết quả <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><select value={form.outcome} onChange={(event) => setForm({ ...form, outcome: event.target.value as ReturnedTestResult['outcome'] })} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="PASS">Đạt</option><option value="FAIL">Không đạt</option><option value="PENDING">Chưa xác định / chờ OCR</option></select></label>
            <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Ngày nhận <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><PgdcnDateInput required aria-required="true" value={form.receivedAt} onChange={(value) => setForm({ ...form, receivedAt: value })} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" /></label>
            <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Số báo cáo KQTN</span><input value={form.reportNumber} onChange={(event) => setForm({ ...form, reportNumber: event.target.value })} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" /></label>
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Tình trạng mẫu</span><select value={form.sampleIssueType} onChange={(event) => setForm({ ...form, sampleIssueType: event.target.value as PcnSampleIssueType | '' })} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="">Không có vấn đề</option><option value="MISMATCH">Không khớp Đề nghị</option><option value="DAMAGED">Hư hỏng</option><option value="INSUFFICIENT">Không đủ mẫu</option><option value="MISSING_DOCUMENT">Thiếu hồ sơ/mẫu</option><option value="OTHER">Khác</option></select></label>
            <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Mô tả vấn đề mẫu</span><input value={form.sampleIssueDescription} onChange={(event) => setForm({ ...form, sampleIssueDescription: event.target.value })} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" /></label>
          </div>
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Ghi chú</span><textarea rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[11px]" /></label>
          <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Bản scan KQTN do PTN cấp <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></span><input required type="file" accept=".pdf,.docx,.png,.jpg,.jpeg,image/*" onChange={(event) => selectResultFile(event.currentTarget.files?.[0])} className="mt-1 w-full text-[10px] text-slate-500" /><span className="mt-1 block text-[10px] text-slate-400">Bản scan sẽ được lưu trong vùng lưu trữ riêng và là nguồn đối chứng; OCR chỉ trích xuất dữ liệu nháp cần xác nhận.</span></label>
            </div>
            <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3"><button type="button" onClick={() => { reset(); setOpenForm(false); }} disabled={saving} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40">Hủy</button><button type="submit" disabled={!canEdit || saving} aria-busy={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:cursor-wait disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu tiếp nhận KQTN'}</button></div>
          </form>
        </div>
      )}

      <div className="mt-4 space-y-2">
        {visibleResults.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/70 p-8 text-center"><FileCheck2 size={18} className="mx-auto text-slate-400" /><p className="mt-2 text-xs font-black text-slate-600">Chưa có KQTN trả về</p><p className="mt-1 text-[10px] text-slate-400">Kết quả được ghi nhận theo PYC và vòng thử lại.</p></div>
        ) : visibleResults.map((result) => {
          const integrityIssues = resultIntegrityIssues.get(result.id) || [];
          const hasIntegrityIssues = integrityIssues.length > 0;
          const dossier = dossiers.find((item) => item.id === result.dossierId);
          const request = internalRequests.find((item) => item.id === result.labRequestId);
          const proposal = proposals.find((item) => item.id === dossier?.proposalId);
          const customerSnapshot = dossier ? getPcnDossierCustomerSnapshot(dossier, proposal) : undefined;
          const field = fields.find((item) => item.code === request?.fieldCode);
          const tone = hasIntegrityIssues
            ? 'text-rose-700 bg-rose-50 border-rose-200'
            : result.outcome === 'PASS'
            ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
            : result.outcome === 'FAIL'
              ? 'text-rose-700 bg-rose-50 border-rose-200'
              : 'text-amber-700 bg-amber-50 border-amber-200';
          const Icon = hasIntegrityIssues ? AlertTriangle : result.outcome === 'PASS' ? CheckCircle2 : result.outcome === 'FAIL' ? AlertTriangle : Clock3;
          return (
            <div key={result.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
              <div className="flex flex-col justify-between gap-2 md:flex-row md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><Icon size={14} className={tone.split(' ')[0]} /><span className="font-mono text-xs font-black text-slate-800">{hasIntegrityIssues ? 'Bản ghi cần rà soát' : result.reportNumber || `KQTN vòng ${result.round}`}</span>{hasIntegrityIssues ? <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700">Cần rà soát</span> : <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>{outcomeLabel(result.outcome)}</span>}{result.isOfficial && !hasIntegrityIssues && <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-700">Kết quả chính thức</span>}</div>
                  <p className="mt-1 text-[11px] font-bold text-slate-700">{customerSnapshot?.name || dossier?.dossierCode || 'Hồ sơ PCN'} <span className="font-normal text-slate-400">• {request?.pycNumber || 'PYC'}</span></p>
                  <p className="text-[10px] text-slate-500">{request?.laboratoryName || 'PTN'}{field ? ` • ${field.name}` : ''} • Vòng {result.round}</p>
                  {result.sampleIssue && <p className="mt-1 text-[10px] font-bold text-rose-600">Vấn đề mẫu: {result.sampleIssue.description}</p>}
                  {result.notes && <p className="mt-1 text-[10px] text-slate-500">{result.notes}</p>}
                  {hasIntegrityIssues && <div role="alert" className="mt-2 rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 py-2 text-[10px] text-rose-800"><p className="font-black">Thông tin cần người có quyền rà soát</p><p className="mt-1">{integrityIssues.map((issue) => issue.message).join(' ')}</p><p className="mt-1 font-bold">Giữ nguyên bản ghi để truy vết; tạm thời không cho gắn hoặc ghi đè tệp.</p></div>}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2 text-right text-[10px] text-slate-400"><span>Ngày nhận<br /><b className="text-slate-600">{formatDate(result.receivedAt)}</b></span><button type="button" onClick={() => setSelectedResultId(result.id)} className="rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 font-bold text-indigo-700 hover:bg-indigo-100">Chi tiết KQTN</button>{hasIntegrityIssues ? <span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 font-bold text-rose-700">Không gắn tệp</span> : result.fileAssetId ? <a href={getPcnFileUrl(result.fileAssetId)} target="_blank" rel="noreferrer" className="font-bold text-indigo-600 underline underline-offset-2">Mở tệp KQTN</a> : canEdit && !hasIntegrityIssues ? <label className={`inline-flex cursor-pointer items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 font-bold text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 ${uploadingResultId === result.id ? 'pointer-events-none opacity-50' : ''}`}><Upload size={12} /> {uploadingResultId === result.id ? 'Đang tải...' : 'Gắn tệp'}<input type="file" className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" disabled={!canEdit || uploadingResultId === result.id} onChange={(event) => void attachResultFile(event, result.id)} /></label> : null}</div>
              </div>
            </div>
          );
        })}
      </div>
      {selectedResult && <PcnResultDetailModal
        result={selectedResult}
        request={selectedResultRequest}
        dossier={selectedResultDossier}
        proposal={selectedResultProposal}
        field={selectedResultField}
        integrityIssues={resultIntegrityIssues.get(selectedResult.id) || []}
        onClose={() => setSelectedResultId(undefined)}
      />}
    </div>
  );
}

export default PcnResultReturnView;
