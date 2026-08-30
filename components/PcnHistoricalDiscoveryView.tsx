'use client';

import React, { useMemo, useState } from 'react';
import { AlertTriangle, Check, FileSearch, FolderSearch, HardDrive, History, RefreshCw, Search } from 'lucide-react';

import { applyPcnHistoricalBatchOnServer, createPcnHistoricalDryRunOnServer, discoverPcnHistoricalFoldersOnServer } from '../utils/pcnHistoricalDiscoveryApi';
import type { PcnHistoricalApplyResponse, PcnHistoricalDiscoveryResponse, PcnHistoricalDryRunResponse } from '../utils/pcnHistoricalDiscoveryApi';
import { filterPcnHistoricalCandidates, filterPcnHistoricalIgnoredFolders, getPcnHistoricalCandidateKey, paginatePcnHistoricalCandidates, paginatePcnHistoricalIgnoredFolders } from '../utils/pcnHistoricalDiscoveryView';
import type { PcnHistoricalSourceAreaRole, PcnHistoricalSourceCandidate } from '../utils/pcnHistoricalSourceDiscovery';
import { buildPcnHistoricalBatchSummaries } from '../utils/pcnHistoricalBatchView';
import type { PcnHistoricalBatchSummary } from '../utils/pcnHistoricalBatchView';
import type { ActivityLog, CertificationDossier, PcnDossierAttachment, UserAccount } from '../types';
import { getPcnHistoricalScopeNotice } from '../utils/pcnHistoricalScope';

type FieldFilter = '' | 'QC4' | 'QC9';

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  if (value < 1024 * 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(value?: string): string {
  if (!value) return 'Chưa xác định';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Chưa xác định' : date.toLocaleString('vi-VN');
}

function fieldLabel(fieldCode: string): string {
  return fieldCode === 'QC4' ? 'Quy chuẩn 4' : 'Quy chuẩn 9';
}

function sourceAreaRoleLabel(role: PcnHistoricalSourceAreaRole): string {
  if (role === 'TEMPLATE') return 'Biểu mẫu / template';
  if (role === 'CERTIFICATE_ARCHIVE') return 'Bản scan GCN';
  if (role === 'LAB_RESULT') return 'Báo cáo / KQTN';
  if (role === 'SAMPLE_HANDOVER') return 'Biên bản / giao nhận mẫu';
  if (role === 'DOCUMENT_HANDOVER') return 'Giao nhận hồ sơ';
  if (role === 'LAB_REQUEST') return 'PYC thử nghiệm';
  if (role === 'COMMERCIAL') return 'Thương mại / hợp đồng';
  if (role === 'MIXED_REFERENCE') return 'Tài liệu tham chiếu hỗn hợp';
  if (role === 'CORRECTIVE_ACTION') return 'Khắc phục mẫu';
  if (role === 'EVALUATION_RECORD') return 'Biên bản đánh giá';
  if (role === 'CORRESPONDENCE') return 'Công văn';
  if (role === 'ACCREDITATION') return 'Giấy phép / chỉ định';
  if (role === 'VISUAL_EVIDENCE') return 'Ảnh / bằng chứng hình ảnh';
  if (role === 'STANDARD_REFERENCE') return 'Tiêu chuẩn tham chiếu';
  if (role === 'ADMIN_NOTE') return 'Ghi chú văn thư';
  return 'Hồ sơ lưu';
}

type PcnHistoricalSourceDestination = 'templates' | 'samples' | 'labRequests' | 'results' | 'qualityDocuments' | 'archive';

function sourceAreaDestination(role: PcnHistoricalSourceAreaRole): { section: PcnHistoricalSourceDestination; label: string } | undefined {
  if (role === 'TEMPLATE') return { section: 'templates', label: 'Biểu mẫu PCN' };
  if (role === 'CERTIFICATE_ARCHIVE' || role === 'DOCUMENT_HANDOVER' || role === 'ARCHIVE' || role === 'ADMIN_NOTE') return { section: 'archive', label: 'Kho hồ sơ' };
  if (role === 'LAB_RESULT' || role === 'CORRECTIVE_ACTION') return { section: 'results', label: 'KQTN trả về' };
  if (role === 'SAMPLE_HANDOVER' || role === 'VISUAL_EVIDENCE') return { section: 'samples', label: 'Mẫu theo lô' };
  if (role === 'LAB_REQUEST') return { section: 'labRequests', label: 'PYC gửi PTN' };
  if (role === 'ACCREDITATION' || role === 'STANDARD_REFERENCE') return { section: 'qualityDocuments', label: 'Tài liệu chất lượng' };
  return undefined;
}

export function PcnHistoricalDiscoveryView({ currentUser, onImported, onOpenSection, dossiers = [], attachments = [], activityLogs = [] }: {
  currentUser: UserAccount;
  onImported?: () => Promise<void> | void;
  onOpenSection?: (section: PcnHistoricalSourceDestination) => void;
  dossiers?: CertificationDossier[];
  attachments?: PcnDossierAttachment[];
  activityLogs?: ActivityLog[];
}) {
  const isPcnAdmin = currentUser.systemRole === 'admin' || currentUser.role === 'admin';
  const [sourceRoot, setSourceRoot] = useState('');
  const [discoveredSourceRoot, setDiscoveredSourceRoot] = useState('');
  const [fieldCode, setFieldCode] = useState<FieldFilter>('');
  const [batchId, setBatchId] = useState('pcn-history-ui-v1');
  const [result, setResult] = useState<PcnHistoricalDiscoveryResponse | null>(null);
  const [dryRunReport, setDryRunReport] = useState<PcnHistoricalDryRunResponse | null>(null);
  const [applyReport, setApplyReport] = useState<PcnHistoricalApplyResponse | null>(null);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [candidatePage, setCandidatePage] = useState(1);
  const [ignoredQuery, setIgnoredQuery] = useState('');
  const [ignoredPage, setIgnoredPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isDryRunLoading, setIsDryRunLoading] = useState(false);
  const [isApplyLoading, setIsApplyLoading] = useState(false);
  const [error, setError] = useState('');
  const [dryRunConfirmed, setDryRunConfirmed] = useState(false);
  const [confirmBatchId, setConfirmBatchId] = useState('');

  const duplicateKeys = useMemo(() => {
    const counts = new Map<string, number>();
    for (const candidate of result?.candidates || []) {
      const key = getPcnHistoricalCandidateKey(candidate);
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return new Set([...counts.entries()].filter(([, count]) => count > 1).map(([key]) => key));
  }, [result]);

  const allCandidates = result?.candidates || [];
  const selectableCandidates = allCandidates.filter((candidate) => !duplicateKeys.has(getPcnHistoricalCandidateKey(candidate)));
  const selectedCandidates = selectableCandidates.filter((candidate) => selectedKeys.includes(getPcnHistoricalCandidateKey(candidate)));
  const filteredCandidates = useMemo(() => filterPcnHistoricalCandidates(allCandidates, candidateQuery), [allCandidates, candidateQuery]);
  const candidatePageResult = useMemo(() => paginatePcnHistoricalCandidates(filteredCandidates, candidatePage), [candidatePage, filteredCandidates]);
  const pageSelectableCandidates = candidatePageResult.items.filter((candidate) => !duplicateKeys.has(getPcnHistoricalCandidateKey(candidate)));
  const ignoredFolders = result?.ignoredFolders || [];
  const filteredIgnoredFolders = useMemo(() => filterPcnHistoricalIgnoredFolders(ignoredFolders, ignoredQuery), [ignoredFolders, ignoredQuery]);
  const ignoredPageResult = useMemo(() => paginatePcnHistoricalIgnoredFolders(filteredIgnoredFolders, ignoredPage), [ignoredPage, filteredIgnoredFolders]);
  const importedBatches = useMemo<PcnHistoricalBatchSummary[]>(
    () => buildPcnHistoricalBatchSummaries(dossiers, attachments, activityLogs),
    [activityLogs, attachments, dossiers],
  );

  const runDiscovery = async () => {
    if (isLoading) return;
    const trimmedRoot = sourceRoot.trim();
    if (!trimmedRoot) {
      setError('Hãy nhập đường dẫn thư mục nguồn PCN trên máy chạy server.');
      return;
    }
    setIsLoading(true);
    setError('');
    setDryRunConfirmed(false);
    setDryRunReport(null);
    setApplyReport(null);
    setDiscoveredSourceRoot('');
    setConfirmBatchId('');
    setSelectedKeys([]);
    setCandidateQuery('');
    setCandidatePage(1);
    setIgnoredQuery('');
    setIgnoredPage(1);
    setResult(null);
    try {
      const nextResult = await discoverPcnHistoricalFoldersOnServer({
        sourceRoot: trimmedRoot,
        ...(fieldCode ? { fieldCode } : {}),
      });
      setResult(nextResult);
      setDiscoveredSourceRoot(trimmedRoot);
    } catch (discoveryError: any) {
      setResult(null);
      setError(discoveryError?.message || 'Không thể kiểm kê nguồn lịch sử PCN.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleCandidate = (candidate: PcnHistoricalSourceCandidate) => {
    const key = getPcnHistoricalCandidateKey(candidate);
    if (duplicateKeys.has(key)) return;
    setDryRunConfirmed(false);
    setDryRunReport(null);
    setApplyReport(null);
    setConfirmBatchId('');
    setSelectedKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  };

  const toggleVisibleCandidates = () => {
    setDryRunConfirmed(false);
    setDryRunReport(null);
    setApplyReport(null);
    setConfirmBatchId('');
    const pageKeys = new Set(pageSelectableCandidates.map(getPcnHistoricalCandidateKey));
    const allPageSelected = pageSelectableCandidates.length > 0 && pageSelectableCandidates.every((candidate) => selectedKeys.includes(getPcnHistoricalCandidateKey(candidate)));
    setSelectedKeys((current) => allPageSelected
      ? current.filter((key) => !pageKeys.has(key))
      : [...new Set([...current, ...pageKeys])]);
  };

  const runDryRun = async () => {
    if (isDryRunLoading) return;
    if (!result || selectedCandidates.length === 0) {
      setError('Hãy chọn ít nhất một candidate hợp lệ trước khi lập dry-run.');
      return;
    }
    const trimmedBatchId = batchId.trim();
    if (!trimmedBatchId) {
      setError('Hãy nhập batchId ổn định cho lần dry-run.');
      return;
    }
    const activeSourceRoot = discoveredSourceRoot.trim();
    if (!activeSourceRoot) {
      setError('Nguồn đã thay đổi hoặc chưa có bản kiểm kê; hãy chạy lại kiểm kê trước khi lập dry-run.');
      return;
    }
    setIsDryRunLoading(true);
    setError('');
    setDryRunConfirmed(false);
    try {
      const report = await createPcnHistoricalDryRunOnServer({
        sourceRoot: activeSourceRoot,
        candidateSelectors: selectedCandidates.map(getPcnHistoricalCandidateKey),
        batchId: trimmedBatchId,
      });
      setDryRunReport(report);
      setDryRunConfirmed(true);
    } catch (dryRunError: any) {
      setDryRunReport(null);
      setError(dryRunError?.message || 'Không thể lập báo cáo dry-run.');
    } finally {
      setIsDryRunLoading(false);
    }
  };

  const applyBatch = async () => {
    if (isApplyLoading) return;
    if (!isPcnAdmin || !dryRunReport) return;
    if (confirmBatchId.trim() !== dryRunReport.batchId) {
      setError('Hãy nhập chính xác batchId trong báo cáo dry-run để xác nhận nhập.');
      return;
    }
    setIsApplyLoading(true);
    setError('');
    try {
      const report = await applyPcnHistoricalBatchOnServer({
        sourceRoot: discoveredSourceRoot.trim(),
        candidateSelectors: dryRunReport.selectedCandidates.map((candidate) => `${candidate.fieldCode}:${candidate.businessCode}`),
        batchId: dryRunReport.batchId,
        confirmBatchId: confirmBatchId.trim(),
      });
      setApplyReport(report);
      if (onImported) await onImported();
    } catch (applyError: any) {
      setApplyReport(null);
      setError(applyError?.message || 'Không thể nhập batch hồ sơ lịch sử.');
    } finally {
      setIsApplyLoading(false);
    }
  };

  return (
    <section className="h-full overflow-y-auto bg-slate-50/60 p-3 md:p-5 mobile-safe-bottom">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Nguồn PCN tham chiếu</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Kiểm kê nguồn lịch sử</h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Quét read-only thư mục PCN để chọn phạm vi hồ sơ cần lập kế hoạch nhập có kiểm soát. Bước này không theo dõi Desktop liên tục và không tự tạo hồ sơ.</p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[10px] font-bold text-emerald-700"><HardDrive size={13} /> Chỉ đọc • không ghi DB/Storage</div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_auto] md:items-end">
            <label className="block">
              <span className="mb-1 block text-[10px] font-black text-slate-600">Đường dẫn nguồn</span>
              <input value={sourceRoot} onChange={(event) => { setSourceRoot(event.target.value); setDiscoveredSourceRoot(''); setResult(null); setDryRunReport(null); setApplyReport(null); setSelectedKeys([]); }} placeholder="C:\\Users\\...\\Desktop\\PCN" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[11px] outline-none focus:border-emerald-400" />
              <span className="mt-1 block text-[10px] text-slate-400">Đường dẫn phải tồn tại trên máy đang chạy server PCN.</span>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black text-slate-600">Lọc lĩnh vực</span>
              <select value={fieldCode} onChange={(event) => setFieldCode(event.target.value as FieldFilter)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] outline-none focus:border-emerald-400">
                <option value="">QC4 + QC9</option>
                <option value="QC4">Chỉ Quy chuẩn 4</option>
                <option value="QC9">Chỉ Quy chuẩn 9</option>
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black text-slate-600">Batch ID dry-run</span>
              <input value={batchId} onChange={(event) => { setBatchId(event.target.value); setDryRunReport(null); setApplyReport(null); setDryRunConfirmed(false); setConfirmBatchId(''); }} className="w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-[11px] outline-none focus:border-emerald-400" />
              <span className="mt-1 block text-[10px] text-slate-400">3–120 ký tự ổn định.</span>
            </label>
            <button type="button" onClick={() => void runDiscovery()} disabled={isLoading} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[11px] font-black text-white shadow-sm hover:bg-emerald-500 disabled:cursor-wait disabled:opacity-60"><Search size={14} />{isLoading ? 'Đang kiểm kê...' : 'Kiểm kê nguồn'}</button>
          </div>
          {error && <div role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-700">{error}</div>}
        </div>

        {importedBatches.length > 0 && <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2"><History size={16} className="mt-0.5 text-indigo-600" /><div><h2 className="text-xs font-black text-slate-800">Batch đã nhập</h2><p className="mt-1 text-[10px] text-slate-500">Sổ truy vết read-only dẫn xuất từ hồ sơ lịch sử, tệp đính kèm và nhật ký IMPORT.</p></div></div>
            <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-[9px] font-black text-indigo-700">{importedBatches.length} batch</span>
          </div>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {importedBatches.slice(0, 12).map((batch) => <article key={batch.batchId} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-[11px] font-black text-slate-800">{batch.batchId}</span><span className="text-[9px] text-slate-500">{formatDate(batch.importedAt)}</span></div>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">{batch.sourceFamilies.map((family) => <span key={family} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-black text-slate-600">{family}</span>)}<span className="text-[10px] text-slate-600"><b className="font-black text-slate-800">{batch.dossierCount}</b> hồ sơ</span><span className="text-[10px] text-slate-600"><b className="font-black text-slate-800">{batch.attachmentCount}</b> tệp</span><span className="text-[10px] text-slate-600"><b className="font-black text-slate-800">{formatBytes(batch.importedBytes)}</b></span></div>
              {batch.pendingReviewCount > 0 && <p className="mt-2 text-[10px] font-bold text-amber-700">Còn {batch.pendingReviewCount} hồ sơ PENDING_REVIEW</p>}
            </article>)}
          </div>
          {importedBatches.length > 12 && <p className="mt-2 text-[10px] text-slate-400">Đang hiển thị 12 batch gần nhất.</p>}
        </section>}

        {!result ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center"><FolderSearch size={28} className="mx-auto text-slate-300" /><p className="mt-2 text-xs font-black text-slate-600">Chưa có bản kiểm kê</p><p className="mt-1 text-[10px] text-slate-400">Nhập đường dẫn thư mục PCN rồi bắt đầu quét read-only.</p></div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Candidate</div><div className="mt-1 text-2xl font-black text-slate-900">{result.candidates.length}</div><div className="text-[10px] text-slate-500">{selectedCandidates.length} đã chọn</div></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Thư mục quét</div><div className="mt-1 text-2xl font-black text-slate-900">{result.inspectedRoots.filter((root) => root.status === 'SCANNED').length}</div><div className="text-[10px] text-slate-500">{result.inspectedRoots.filter((root) => root.status === 'MISSING').length} root không tồn tại</div></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Bị bỏ qua</div><div className="mt-1 text-2xl font-black text-amber-600">{result.ignoredFolders.length}</div><div className="text-[10px] text-slate-500">Không khớp tên thư mục</div></div>
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Nguồn (tạm thời trên phiên)</div><div className="mt-1 truncate text-[11px] font-bold text-slate-700" title={sourceRoot}>{sourceRoot || 'Chưa chọn nguồn'}</div><div className="text-[10px] text-slate-500">Quét lúc {formatDate(result.inspectedAt)}</div></div>
            </div>

            {result.referenceSources.length > 0 && <section className="rounded-xl border border-cyan-200 bg-cyan-50/40 p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-start gap-2"><HardDrive size={16} className="mt-0.5 text-cyan-700" /><div><h2 className="text-xs font-black text-cyan-950">Độ phủ nguồn tham chiếu</h2><p className="mt-1 text-[10px] leading-4 text-cyan-900/75">Các nhánh dưới đây được thống kê để định tuyến biểu mẫu, bản scan, kết quả và hồ sơ lưu. Không thuộc candidate, không có checkbox nhập và không tự upload.</p></div></div>
                <span className="rounded-full border border-cyan-200 bg-white px-2 py-1 text-[9px] font-black text-cyan-800">{result.referenceSources.filter((source) => source.status === 'SCANNED').length}/{result.referenceSources.length} nhánh có trong nguồn</span>
              </div>
              <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {result.referenceSources.map((source) => { const destination = sourceAreaDestination(source.role); return <article key={`${source.fieldCode}:${source.sourceRelativePath}`} className={`rounded-lg border bg-white p-3 ${source.status === 'SCANNED' ? 'border-cyan-100' : 'border-amber-200'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-1.5"><span className="rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-black text-slate-600">{fieldLabel(source.fieldCode)}</span><span className="text-[9px] font-black text-cyan-800">{sourceAreaRoleLabel(source.role)}</span><span className={`rounded-full px-1.5 py-0.5 text-[8px] font-black ${source.status === 'SCANNED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{source.status === 'SCANNED' ? 'Đã thống kê' : 'Thiếu nhánh'}</span></div>
                  <div className="mt-1.5 break-words font-mono text-[9px] text-slate-500">{source.sourceRelativePath}</div>
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[9px] text-slate-500"><span><b className="text-slate-700">{source.fileCount}</b> tệp</span><span><b className="text-slate-700">{formatBytes(source.totalBytes)}</b></span>{source.lastModifiedAt && <span>Sửa gần nhất: {formatDate(source.lastModifiedAt)}</span>}</div>
                  <div className="mt-1 break-words text-[9px] text-slate-400">{Object.entries(source.byExtension).map(([extension, count]) => `${extension} × ${count}`).join(' • ') || 'Chưa có phần mở rộng'}</div>
                  {source.sampleFileNames.length > 0 && <div className="mt-1.5 truncate text-[9px] text-slate-400" title={source.sampleFileNames.join(' • ')}>Ví dụ: {source.sampleFileNames.join(' • ')}</div>}
                  {destination && onOpenSection ? <button type="button" onClick={() => onOpenSection(destination.section)} className="mt-2 inline-flex items-center rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-[9px] font-black text-cyan-800 hover:bg-cyan-100">Mở module {destination.label}</button> : <div className="mt-2 text-[9px] font-bold text-slate-400">Chỉ tra cứu — chưa có module đích riêng</div>}
                </article>; })}
              </div>
            </section>}

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)]">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2"><h2 className="text-xs font-black text-slate-800">Root đã kiểm tra</h2><RefreshCw size={14} className="text-slate-400" /></div>
                <div className="mt-3 space-y-2">{result.inspectedRoots.map((root) => <div key={`${root.fieldCode}:${root.sourceRelativePath}`} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5"><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-black text-slate-700">{fieldLabel(root.fieldCode)}</span><span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${root.status === 'SCANNED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{root.status === 'SCANNED' ? 'Đã quét' : 'Thiếu root'}</span></div><div className="mt-1 break-words font-mono text-[9px] text-slate-500">{root.sourceRelativePath}</div></div>)}</div>
                {result.ignoredFolders.length > 0 && <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1.5 text-[10px] font-black text-amber-800"><AlertTriangle size={13} /> Thư mục cần rà soát ({result.ignoredFolders.length})</div><span className="text-[9px] font-bold text-amber-700">Không có checkbox nhập</span></div>
                  <p className="mt-1 text-[10px] leading-4 text-amber-700">Các thư mục chưa khớp quy tắc nhận diện được giữ lại để tra cứu, không tự suy diễn thành hồ sơ.</p>
                  <label className="relative mt-3 block"><Search size={12} className="absolute left-2.5 top-2.5 text-amber-500" /><input aria-label="Lọc thư mục bỏ qua" value={ignoredQuery} onChange={(event) => { setIgnoredQuery(event.target.value); setIgnoredPage(1); }} placeholder="Lọc tên thư mục hoặc đường dẫn tương đối..." className="w-full rounded-lg border border-amber-200 bg-white px-3 py-2 pl-8 text-[10px] outline-none focus:border-amber-400" /></label>
                  {ignoredPageResult.items.length === 0 ? <div className="mt-2 rounded-lg border border-dashed border-amber-200 bg-white/70 p-4 text-center text-[10px] text-amber-700">Không tìm thấy thư mục cần rà soát.</div> : <div className="mt-2 space-y-1.5">{ignoredPageResult.items.map((folder) => <div key={`${folder.fieldCode}:${folder.sourceRelativePath}`} className="rounded-lg border border-amber-200/80 bg-white/80 px-2.5 py-2"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full border border-amber-200 bg-amber-100 px-1.5 py-0.5 text-[9px] font-black text-amber-800">{fieldLabel(folder.fieldCode)}</span><span className="text-[10px] font-black text-slate-700">{folder.folderName}</span><span className="font-mono text-[8px] text-amber-700">{folder.reason}</span></div><div className="mt-1 break-words font-mono text-[9px] text-slate-500">{folder.sourceRelativePath}</div></div>)}</div>}
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[9px] text-amber-700"><span>Trang {ignoredPageResult.page}/{ignoredPageResult.pageCount} • {ignoredPageResult.items.length}/{ignoredPageResult.total} thư mục</span><div className="flex gap-1.5"><button type="button" onClick={() => setIgnoredPage((page) => Math.max(1, page - 1))} disabled={ignoredPageResult.page <= 1} className="rounded-md border border-amber-200 bg-white px-2 py-1 font-bold disabled:opacity-40">Trước</button><button type="button" onClick={() => setIgnoredPage((page) => Math.min(ignoredPageResult.pageCount, page + 1))} disabled={ignoredPageResult.page >= ignoredPageResult.pageCount} className="rounded-md border border-amber-200 bg-white px-2 py-1 font-bold disabled:opacity-40">Sau</button></div></div>
                </div>}
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="text-xs font-black text-slate-800">Chọn candidate nhập lịch sử</h2><p className="mt-1 text-[10px] text-slate-500">Khóa chọn: <span className="font-mono font-bold">FIELD:BUSINESS_CODE</span> • {filteredCandidates.length}/{allCandidates.length} kết quả • {selectedCandidates.length} đã chọn</p></div><button type="button" onClick={toggleVisibleCandidates} disabled={pageSelectableCandidates.length === 0} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-black text-slate-600 hover:border-emerald-300 disabled:opacity-50">{pageSelectableCandidates.length > 0 && pageSelectableCandidates.every((candidate) => selectedKeys.includes(getPcnHistoricalCandidateKey(candidate))) ? 'Bỏ chọn trang này' : 'Chọn trang này'}</button></div>
                <label className="relative mt-3 block"><Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" /><input aria-label="Lọc candidate lịch sử" value={candidateQuery} onChange={(event) => { setCandidateQuery(event.target.value); setCandidatePage(1); }} placeholder="Lọc mã, khách hàng, sản phẩm hoặc đường dẫn..." className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 pl-8 text-[10px] outline-none focus:border-emerald-400" /></label>
                <div className="mt-3 space-y-2">{candidatePageResult.items.length === 0 ? <div className="rounded-lg border border-dashed border-slate-200 p-8 text-center"><FileSearch size={23} className="mx-auto text-slate-300" /><p className="mt-2 text-[11px] font-bold text-slate-500">Không tìm thấy candidate phù hợp.</p></div> : candidatePageResult.items.map((candidate) => { const key = getPcnHistoricalCandidateKey(candidate); const duplicate = duplicateKeys.has(key); const selected = selectedKeys.includes(key); const scopeNotice = getPcnHistoricalScopeNotice(candidate); return <div key={`${key}:${candidate.sourceRelativePath}`} className={`rounded-lg border p-3 transition-colors ${selected ? 'border-emerald-300 bg-emerald-50/50' : 'border-slate-200 bg-white'} ${duplicate ? 'border-amber-300 bg-amber-50/40' : ''}`}><div className="flex items-start gap-2.5"><input type="checkbox" checked={selected} disabled={duplicate} onChange={() => toggleCandidate(candidate)} aria-label={`Chọn ${key}`} className="mt-0.5 h-4 w-4 accent-emerald-600" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="font-mono text-[11px] font-black text-slate-800">{key}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500">{fieldLabel(candidate.fieldCode)}</span><span title={scopeNotice.message} className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${scopeNotice.kind === 'FULL_TEST_SCOPE' || scopeNotice.kind === 'REDUCED_TEST_SCOPE' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>{scopeNotice.label}</span>{duplicate && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black text-amber-800">Mã trùng — không chọn</span>}</div><div className="mt-1 text-[11px] font-bold text-slate-700">{candidate.customerName} <span className="font-normal text-slate-500">• {candidate.productName}</span></div><div className="mt-1 break-words font-mono text-[9px] text-slate-400">{candidate.sourceRelativePath}</div><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span><b className="text-slate-700">{candidate.fileCount}</b> tệp</span><span><b className="text-slate-700">{formatBytes(candidate.totalBytes)}</b></span><span>{Object.entries(candidate.byExtension).map(([extension, count]) => `${extension} × ${count}`).join(' • ') || 'Chưa có phần mở rộng'}</span></div>{(scopeNotice.kind === 'FULL_TEST_SCOPE' || scopeNotice.kind === 'REDUCED_TEST_SCOPE') && <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{scopeNotice.message}</span></div>}{candidate.unresolvedFields.length > 0 && <div className="mt-2 flex items-start gap-1.5 text-[10px] text-amber-700"><AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>Cần rà soát: {candidate.unresolvedFields.join(', ')}</span></div>}{candidate.sampleFileNames.length > 0 && <div className="mt-2 truncate text-[9px] text-slate-400" title={candidate.sampleFileNames.join(' • ')}>Ví dụ tệp: {candidate.sampleFileNames.join(' • ')}</div>}</div></div></div>; })}</div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500"><span>Trang {candidatePageResult.page}/{candidatePageResult.pageCount} • Hiển thị {candidatePageResult.items.length} candidate</span><div className="flex gap-1.5"><button type="button" onClick={() => setCandidatePage((page) => Math.max(1, page - 1))} disabled={candidatePageResult.page <= 1} className="rounded-md border border-slate-200 bg-white px-2 py-1 font-bold disabled:opacity-40">Trước</button><button type="button" onClick={() => setCandidatePage((page) => Math.min(candidatePageResult.pageCount, page + 1))} disabled={candidatePageResult.page >= candidatePageResult.pageCount} className="rounded-md border border-slate-200 bg-white px-2 py-1 font-bold disabled:opacity-40">Sau</button></div></div>
                <div className="mt-4 border-t border-slate-100 pt-3"><button type="button" onClick={() => void runDryRun()} disabled={selectedCandidates.length === 0 || isDryRunLoading} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"><Check size={13} /> {isDryRunLoading ? 'Đang lập dry-run...' : 'Lập báo cáo dry-run'}</button>{dryRunConfirmed && dryRunReport && <div role="status" className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-bold leading-4 text-indigo-800">Batch <span className="font-mono">{dryRunReport.batchId}</span>: đã đọc/hash và phân loại {dryRunReport.summary.importedFiles} tệp ({formatBytes(dryRunReport.summary.importedBytes)}), bỏ qua {dryRunReport.summary.skippedFiles} tệp. Chưa upload và chưa ghi database/Storage.</div>}</div>
                {dryRunReport && <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[11px] font-black text-slate-800">Báo cáo hash và phân loại</h3><span className="text-[10px] font-bold text-slate-500">{dryRunReport.summary.autoMappedFiles} tự nối • {dryRunReport.summary.unmappedFiles} cần nối</span></div><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(dryRunReport.summary.byKind).map(([kind, count]) => <div key={kind} className="rounded-md border border-slate-200 bg-white px-2 py-1.5"><div className="truncate text-[9px] font-black text-slate-500">{kind}</div><div className="text-[12px] font-black text-slate-800">{count}</div></div>)}</div><div className="mt-3 space-y-2">{dryRunReport.dossiers.map((dossier) => <details key={dossier.dossierCode} className="rounded-md border border-slate-200 bg-white p-2"><summary className="cursor-pointer text-[10px] font-black text-slate-700">{dossier.dossierCode} • {dossier.files.length} tệp • {dossier.skippedFiles.length} bỏ qua</summary><div className="mt-2 space-y-1">{dossier.files.map((file) => <div key={`${dossier.dossierCode}:${file.relativePath}`} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5 text-[9px] text-slate-600"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-slate-800">{file.kind}</span><span>{formatBytes(file.byteSize)}</span>{file.mappingStatus && <span>{file.mappingStatus}</span>}</div><div className="mt-0.5 break-all font-mono text-slate-500">{file.relativePath}</div><div className="mt-0.5 break-all font-mono text-[8px] text-slate-400">SHA-256: {file.sha256}</div></div>)}{dossier.skippedFiles.length > 0 && <div className="text-[9px] text-amber-700">Skipped: {dossier.skippedFiles.map((file) => `${file.fileName} (${file.reason})`).join(' • ')}</div>}</div></details>)}</div></div>}
              </div>
            </div>
            {isPcnAdmin && dryRunReport && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 shadow-sm"><div className="flex items-start gap-2"><AlertTriangle size={16} className="mt-0.5 shrink-0 text-rose-600" /><div><h3 className="text-xs font-black text-rose-900">Apply batch vào PCN (chỉ Admin)</h3><p className="mt-1 text-[10px] leading-4 text-rose-800">Thao tác này sẽ ghi hồ sơ, checklist, file pointer, Storage private và audit. Hệ thống sẽ scan/resolve lại candidate ngay trước khi ghi.</p></div></div><div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"><label className="block min-w-0 flex-1"><span className="mb-1 block text-[10px] font-black text-rose-900">Nhập lại batchId để xác nhận</span><input aria-label="Nhập lại batchId" value={confirmBatchId} onChange={(event) => { setConfirmBatchId(event.target.value); setApplyReport(null); }} placeholder={dryRunReport.batchId} className="w-full rounded-lg border border-rose-200 bg-white px-3 py-2 font-mono text-[11px] outline-none focus:border-rose-400" /></label><button type="button" onClick={() => void applyBatch()} disabled={isApplyLoading || confirmBatchId.trim() !== dryRunReport.batchId} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-[10px] font-black text-white hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-50">{isApplyLoading ? 'Đang nhập...' : 'Xác nhận nhập batch'}</button></div>{applyReport && <div role="status" className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[10px] font-bold leading-4 text-emerald-800">{applyReport.message} {applyReport.summary.dossierCount} hồ sơ • {applyReport.summary.importedFiles} tệp • {applyReport.idempotent ? 'idempotent' : 'đã apply lần đầu'}.</div>}</div>}
          </>
        )}
      </div>
    </section>
  );
}

export default PcnHistoricalDiscoveryView;

// --- End of PcnHistoricalDiscoveryView.tsx ---
