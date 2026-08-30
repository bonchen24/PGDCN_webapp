'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Database, Download, Loader2, RefreshCw, ShieldAlert } from 'lucide-react';

import type { CustomerRef, UserAccount } from '../types';
import { fetchPcnCutoverStatus, type PcnCutoverStatusResponse } from '../utils/pcnCutoverApi';
import { buildPcnCustomerReconciliation, inspectPcnCustomerImport, parsePcnCustomerCsv } from '../utils/pcnCustomerReconciliation';
import { applyPcnCustomerImport, previewPcnCustomerImport } from '../utils/pcnCustomerImportApi';
import type { PcnCustomerImportPreviewData } from '../utils/pcnCustomerImportContract';
import { PCN_ALIAS_KEEP_SOURCE_KEY, PCN_ALIAS_MAP_TO_TARGET, type PcnCustomerAliasDecision } from '../utils/pcnCustomerImportAlias';

function isPcnAdmin(user: UserAccount | null): boolean {
  return user?.systemRole === 'admin' || user?.role === 'admin';
}

function Count({ value }: { value: number | undefined }) {
  return <span className="font-black text-slate-800">{Number.isFinite(value) ? value : '—'}</span>;
}

function csvCell(value: unknown): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

export function PcnCutoverVerificationView({ currentUser, customers, onImported }: { currentUser: UserAccount | null; customers: CustomerRef[]; onImported?: () => Promise<void> }) {
  const admin = isPcnAdmin(currentUser);
  const username = currentUser?.username;
  const [status, setStatus] = useState<PcnCutoverStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [sourceError, setSourceError] = useState('');
  const [sourceCheck, setSourceCheck] = useState<{
    sourceLabel: string;
    inspection: ReturnType<typeof inspectPcnCustomerImport>;
    report: ReturnType<typeof buildPcnCustomerReconciliation>;
  } | null>(null);
  const [sourceRows, setSourceRows] = useState<unknown[] | null>(null);
  const [importPreview, setImportPreview] = useState<PcnCustomerImportPreviewData | null>(null);
  const [importError, setImportError] = useState('');
  const [isImportPreviewing, setIsImportPreviewing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importConfirmation, setImportConfirmation] = useState('');
  const [aliasChoiceBySource, setAliasChoiceBySource] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<{ importedCount: number; idempotent: boolean; filename: string } | null>(null);

  const loadStatus = useCallback(async () => {
    if (!admin || !username) return;
    setIsLoading(true);
    setError('');
    try {
      setStatus(await fetchPcnCutoverStatus(username));
    } catch (cause: any) {
      setError(cause?.message || 'Không thể tải snapshot đối soát cutover');
    } finally {
      setIsLoading(false);
    }
  }, [admin, username]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleCustomerSource = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setSourceError('');
    setImportError('');
    setImportPreview(null);
    setImportResult(null);
    setImportConfirmation('');
    setAliasChoiceBySource({});
    try {
      const text = await file.text();
      let incoming: unknown[];
      if (file.name.toLowerCase().endsWith('.json')) {
        const payload = JSON.parse(text) as unknown;
        if (Array.isArray(payload)) incoming = payload;
        else if (payload && typeof payload === 'object' && Array.isArray((payload as { customers?: unknown[] }).customers)) incoming = (payload as { customers: unknown[] }).customers;
        else throw new Error('File JSON phải là mảng khách hàng hoặc object có trường customers.');
      } else {
        incoming = parsePcnCustomerCsv(text);
      }
      setSourceRows(incoming);
      const inspection = inspectPcnCustomerImport(incoming);
      setSourceCheck({ sourceLabel: file.name, inspection, report: buildPcnCustomerReconciliation(inspection.acceptedCustomers, customers) });
    } catch (cause: any) {
      setSourceCheck(null);
      setSourceError(cause?.message || 'Không thể đọc file nguồn đối soát');
    }
  };

  const handleImportPreview = async () => {
    if (!sourceCheck || !sourceRows || isImportPreviewing) return;
    setIsImportPreviewing(true);
    setImportError('');
    setImportResult(null);
    try {
      const response = await previewPcnCustomerImport(sourceCheck.sourceLabel, sourceRows);
      setImportPreview(response.preview);
      setAliasChoiceBySource({});
    } catch (cause: any) {
      setImportPreview(null);
      setImportError(cause?.message || 'Không thể lập preview import trên server');
    } finally {
      setIsImportPreviewing(false);
    }
  };

  const handleImportApply = async () => {
    if (!importPreview || !sourceRows || isImporting) return;
    if (importConfirmation !== 'KHOI_TAO_DANH_MUC_PCN') {
      setImportError('Vui lòng gõ đúng KHOI_TAO_DANH_MUC_PCN để xác nhận.');
      return;
    }
    const aliasCandidates = importPreview.reconciliation.possibleAliasMatches;
    const aliasDecisions = aliasCandidates.flatMap((candidate): PcnCustomerAliasDecision[] => {
      const choice = aliasChoiceBySource[candidate.sourceKey];
      if (choice === PCN_ALIAS_KEEP_SOURCE_KEY) return [{ sourceKey: candidate.sourceKey, mode: PCN_ALIAS_KEEP_SOURCE_KEY }];
      if (choice) return [{ sourceKey: candidate.sourceKey, mode: PCN_ALIAS_MAP_TO_TARGET, targetKey: choice }];
      return [];
    });
    if (aliasDecisions.length !== aliasCandidates.length) {
      setImportError('Vui lòng quyết định rõ từng ứng viên alias trước khi apply.');
      return;
    }
    setIsImporting(true);
    setImportError('');
    try {
      const response = await applyPcnCustomerImport({
        sourceLabel: importPreview.sourceLabel,
        customers: sourceRows,
        expectedSourceHash: importPreview.sourceHash,
        expectedTargetHashBefore: importPreview.targetHashBefore,
        confirmation: importConfirmation,
        aliasDecisions,
      });
      setImportResult({ importedCount: response.importedCount, idempotent: response.idempotent, filename: response.backupCheckpoint.filename });
      setImportConfirmation('');
      if (onImported) await onImported();
      await loadStatus();
    } catch (cause: any) {
      setImportError(cause?.message || 'Không thể apply danh mục khách hàng');
    } finally {
      setIsImporting(false);
    }
  };

  if (!admin || !username) return null;

  const snapshot = status?.snapshot;
  const reconciliation = snapshot?.reconciliation;
  const backup = snapshot?.backupVerification;
  const importCheckpoint = snapshot?.latestCustomerImportCheckpoint;
  const importCheckpointBackup = snapshot?.customerImportBackupVerification;
  const legacyPlans = snapshot?.legacyCollectionReconciliation || [];
  const ddtCollectionNames = snapshot?.ddtCollectionNames || [];
  const emptyCustomerCount = snapshot?.customerDataIntegrity?.emptyTargetRecordCount || 0;
  const importAliasCandidates = importPreview?.reconciliation.possibleAliasMatches || [];

  const exportEvidence = () => {
    if (!status || !snapshot) return;
    const rows: unknown[][] = [
      ['Loại', 'Mục', 'Giá trị'],
      ['Snapshot', 'checkedAt', status.checkedAt],
      ['Snapshot', 'profile', snapshot.profile],
      ['Snapshot', 'database', snapshot.database],
      ['Snapshot', 'customerCount', snapshot.customerCount],
      ['Snapshot', 'emptyCustomerCount', emptyCustomerCount],
      ['Snapshot', 'fieldCount', snapshot.fieldCodes.length],
      ['Boundary', 'ddtCollectionCount', ddtCollectionNames.length],
      ...ddtCollectionNames.map((name) => ['Boundary', 'ddtCollection', name]),
      ['Reconciliation', 'proposalCount', reconciliation?.proposalCount],
      ['Reconciliation', 'dossierCount', reconciliation?.dossierCount],
      ['Reconciliation', 'fileAssetCount', reconciliation?.fileAssetCount],
      ['Reconciliation', 'notificationCount', reconciliation?.notificationCount],
      ['Reconciliation', 'activityLogCount', reconciliation?.activityLogCount],
      ['Backup', 'status', backup?.status || 'NOT_CHECKED'],
      ['Backup', 'verifiedObjectCount', backup?.verifiedObjectCount],
      ['Backup', 'manifestObjectCount', backup?.manifestObjectCount],
      ['Import checkpoint', 'filename', importCheckpoint?.filename || 'NOT_FOUND'],
      ['Import checkpoint', 'createdAt', importCheckpoint?.createdAt || 'NOT_FOUND'],
      ['Import checkpoint', 'status', importCheckpoint?.status || 'NOT_FOUND'],
      ['Import checkpoint', 'archiveVerification', importCheckpointBackup?.status || 'NOT_CHECKED'],
      ['Import checkpoint', 'sourceFingerprint', importCheckpoint?.sourceFingerprint || 'NOT_FOUND'],
      ...status.errors.map((item, index) => ['Error', String(index + 1), item]),
    ];
    if (sourceCheck) {
      rows.push(
        ['Customer source', 'sourceLabel', sourceCheck.sourceLabel],
        ['Customer source', 'sourceCount', sourceCheck.report.sourceCount],
        ['Customer source', 'targetCount', sourceCheck.report.targetCount],
        ['Customer source', 'missingKeyCount', sourceCheck.report.missingKeys.length],
        ['Customer source', 'extraKeyCount', sourceCheck.report.extraKeys.length],
        ['Customer source', 'changedKeyCount', sourceCheck.report.changedKeys.length],
        ['Customer source', 'possibleAliasMatchCount', sourceCheck.report.possibleAliasMatches.length],
        ['Customer source', 'rejectedRowCount', sourceCheck.inspection.rejected.length],
        ['Customer source', 'duplicateKeyCount', sourceCheck.inspection.duplicateKeys.length],
        ...Object.entries(sourceCheck.report.fieldDifferenceCounts).map(([field, count]) => ['Customer field difference', field, count]),
      );
    }
    const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pcn-cutover-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 p-3 pb-20 md:p-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị dữ liệu PCN</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Đối soát cutover</h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Snapshot read-only lấy trực tiếp từ database PCN và archive mới nhất. Màn hình chỉ cung cấp bằng chứng để nghiệm thu, không tự thay đổi dữ liệu.</p>
          </div>
          <div className="flex items-center gap-1"><button type="button" onClick={exportEvidence} disabled={!status || !snapshot} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-50" title="Xuất báo cáo CSV"><Download size={16} /></button><button type="button" onClick={() => void loadStatus()} disabled={isLoading} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-white hover:text-emerald-600 disabled:opacity-50" title="Làm mới snapshot">
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button></div>
        </div>

        {isLoading && !status ? (
          <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-12 text-xs text-slate-400"><Loader2 size={15} className="animate-spin text-emerald-500" /> Đang đọc snapshot PCN...</div>
        ) : error ? (
          <section className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800"><AlertTriangle size={18} className="mt-0.5 shrink-0" /><div><h2 className="text-sm font-black">Không đọc được snapshot</h2><p className="mt-1 text-[11px] leading-5">{error}</p></div></section>
        ) : status && snapshot ? (
          <>
            <section className={`flex items-start gap-3 rounded-xl border p-4 shadow-sm ${status.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              {status.ok ? <CheckCircle2 size={19} className="mt-0.5 shrink-0 text-emerald-600" /> : <ShieldAlert size={19} className="mt-0.5 shrink-0 text-amber-600" />}
              <div className="min-w-0"><div className={`text-sm font-black ${status.ok ? 'text-emerald-900' : 'text-amber-900'}`}>{status.ok ? 'Snapshot đạt cổng kiểm chứng' : 'Snapshot chưa đạt cổng kiểm chứng'}</div><p className={`mt-1 text-[10px] leading-5 ${status.ok ? 'text-emerald-800' : 'text-amber-800'}`}>Kiểm tra lúc {new Date(status.checkedAt).toLocaleString('vi-VN')}. Kết quả chỉ dùng để rà soát và truy vết.</p></div>
            </section>

            <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Profile" value={snapshot.profile || '—'} />
              <Metric label="Database" value={snapshot.database || '—'} />
              <Metric label="Khách hàng" value={<Count value={snapshot.customerCount} />} />
              <Metric label="Lĩnh vực" value={<Count value={snapshot.fieldCodes.length} />} />
              <Metric label="Đề nghị" value={<Count value={reconciliation?.proposalCount} />} />
              <Metric label="Hồ sơ" value={<Count value={reconciliation?.dossierCount} />} />
              <Metric label="Bản ghi khách hàng trống" value={<Count value={emptyCustomerCount} />} />
              <Metric label="File pointer" value={<Count value={reconciliation?.fileAssetCount} />} />
              <Metric label="Nhật ký" value={<Count value={reconciliation?.activityLogCount} />} />
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-sm font-black text-slate-800">Đối chiếu file nguồn khách hàng</h2><p className="mt-1 text-[10px] leading-4 text-slate-500">Chọn CSV/JSON từ máy này để rà soát cục bộ. File chỉ được gửi lên máy chủ khi bấm “Lập preview import”.</p></div><label className="inline-flex cursor-pointer items-center rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-[10px] font-black text-indigo-700 hover:bg-indigo-100"><input type="file" accept=".csv,.json,text/csv,application/json" onChange={(event) => void handleCustomerSource(event)} className="sr-only" />Chọn file nguồn</label></div>
              {sourceError && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{sourceError}</p>}
              {sourceCheck && <div className="mt-3 space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3"><div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-700"><span className="font-mono font-black">{sourceCheck.sourceLabel}</span><span>Nguồn: <b>{sourceCheck.report.sourceCount}</b></span><span>Đích: <b>{sourceCheck.report.targetCount}</b></span><span>Hợp lệ: <b>{sourceCheck.inspection.validCount}</b></span><span>Dòng lỗi: <b>{sourceCheck.inspection.rejected.length}</b></span><span>Trùng khóa: <b>{sourceCheck.inspection.duplicateKeys.length}</b></span></div><div className="grid gap-2 text-[10px] sm:grid-cols-3"><CompareMetric label="Khóa nguồn thiếu ở đích" value={sourceCheck.report.missingKeys.length} /><CompareMetric label="Khóa đích thừa" value={sourceCheck.report.extraKeys.length} /><CompareMetric label="Khóa khác trường" value={sourceCheck.report.changedKeys.length} /></div><div className="grid gap-3 text-[10px] text-slate-600 md:grid-cols-2"><KeyList label="Khóa thiếu" values={sourceCheck.report.missingKeys} /><KeyList label="Khóa thừa" values={sourceCheck.report.extraKeys} /></div>{sourceCheck.report.possibleAliasMatches.length > 0 && <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2 text-amber-900"><p className="font-black">Ứng viên alias cần xác nhận</p><div className="mt-1 flex flex-wrap gap-1">{sourceCheck.report.possibleAliasMatches.slice(0, 20).map((item) => <span key={`${item.sourceKey}-${item.targetKey}`} className="rounded-full border border-amber-200 bg-white px-2 py-0.5 font-mono text-[9px]">{item.sourceKey} → {item.targetKey}</span>)}</div><p className="mt-1 text-[9px] text-amber-800/80">Chỉ là gợi ý read-only; chưa đổi khóa, merge hoặc ghi DB.</p></div>}{sourceCheck.report.changedFieldsByKey.length > 0 && <div><p className="font-black text-[10px] text-slate-700">Trường lệch theo khóa</p><div className="mt-1 flex flex-wrap gap-1">{sourceCheck.report.changedFieldsByKey.slice(0, 20).map((item) => <span key={item.key} className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 font-mono text-[9px] text-amber-800">{item.key}: {item.fields.join(', ')}</span>)}</div></div>}<div><p className="font-black text-[10px] text-slate-700">Số trường lệch</p><div className="mt-1 flex flex-wrap gap-2 text-[9px] text-slate-500">{Object.entries(sourceCheck.report.fieldDifferenceCounts).filter(([, value]) => value > 0).map(([field, value]) => <span key={field}>{field}: <b className="text-slate-700">{value}</b></span>)}{Object.values(sourceCheck.report.fieldDifferenceCounts).every((value) => value === 0) && <span>Không có khác biệt trường trên khóa giao nhau.</span>}</div></div></div>}
              {sourceCheck && sourceCheck.inspection.rejected.length > 0 && <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2.5 text-[10px] text-rose-800"><p className="font-black">Dòng lỗi</p><ul className="mt-1 list-disc space-y-0.5 pl-4">{sourceCheck.inspection.rejected.slice(0, 20).map((item) => <li key={`${item.sourceIndex}-${item.reason}`}>Dòng {item.sourceIndex}: {item.reason}</li>)}</ul></div>}
              {sourceCheck && sourceCheck.inspection.duplicateKeys.length > 0 && <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5 text-[10px] text-amber-800"><p className="font-black">Khóa trùng trong file nguồn</p><div className="mt-1 flex flex-wrap gap-1">{sourceCheck.inspection.duplicateKeys.slice(0, 20).map((key) => <span key={key} className="rounded-full border border-amber-200 bg-white px-2 py-0.5 font-mono text-[9px]">{key}</span>)}</div></div>}
            </section>

            <section className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 shadow-sm md:p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black text-slate-800">Nhập danh mục khách hàng PCN</h2>
                  <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-600">Preview trên máy chủ là bước rà soát cuối. Apply sẽ kiểm tra lại nguồn, hash đích, checkpoint backup và quyền Admin trong transaction; không tự gộp ứng viên alias.</p>
                </div>
                {sourceCheck && sourceRows && <button type="button" onClick={() => void handleImportPreview()} disabled={isImportPreviewing || isImporting || sourceCheck.inspection.rejected.length > 0 || sourceCheck.inspection.duplicateKeys.length > 0} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-[10px] font-black text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50">{isImportPreviewing && <Loader2 size={13} className="animate-spin" />}{isImportPreviewing ? 'Đang lập preview...' : 'Lập preview import'}</button>}
              </div>
              {importError && <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[10px] text-rose-800">{importError}</p>}
              {importResult && <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-2.5 text-[10px] text-emerald-900"><p className="font-black">Đã apply danh mục khách hàng</p><p className="mt-1">{importResult.idempotent ? 'Không có thay đổi mới.' : `Đã cập nhật ${importResult.importedCount} bản ghi.`} · Checkpoint: <span className="font-mono">{importResult.filename}</span></p></div>}
              {importPreview && <div className="mt-3 space-y-3 rounded-lg border border-indigo-100 bg-white p-3"><div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-700"><span className="font-mono font-black">{importPreview.sourceLabel}</span><span>Nguồn: <b>{importPreview.sourceCount}</b></span><span>Hợp lệ: <b>{importPreview.validCount}</b></span><span>Nhận: <b>{importPreview.acceptedCount}</b></span><span>Đang có: <b>{importPreview.existingConflictCount}</b></span></div><div className="grid gap-2 text-[10px] sm:grid-cols-3"><CompareMetric label="Khóa thiếu ở đích" value={importPreview.reconciliation.missingKeys.length} /><CompareMetric label="Khóa thừa ở đích" value={importPreview.reconciliation.extraKeys.length} /><CompareMetric label="Khóa lệch trường" value={importPreview.reconciliation.changedKeys.length} /></div><div className="rounded-lg border border-slate-100 bg-slate-50 p-2 text-[9px] text-slate-500"><p>Fingerprint nguồn: <span className="font-mono text-slate-700">{importPreview.sourceHash}</span></p><p className="mt-1">Fingerprint đích trước apply: <span className="font-mono text-slate-700">{importPreview.targetHashBefore}</span></p><p className="mt-1">Checkpoint phải được tạo trước khi bấm Apply.</p></div><div className="flex flex-col gap-2 sm:flex-row sm:items-end"><label className="min-w-0 flex-1 text-[10px] font-black text-slate-600">Xác nhận apply<input value={importConfirmation} onChange={(event) => setImportConfirmation(event.target.value)} disabled={isImporting} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 font-mono text-[10px] outline-none focus:border-indigo-400 disabled:bg-slate-100" placeholder="KHOI_TAO_DANH_MUC_PCN" aria-label="Chuỗi xác nhận import khách hàng" /></label><button type="button" onClick={() => void handleImportApply()} disabled={isImporting || importConfirmation !== 'KHOI_TAO_DANH_MUC_PCN' || importPreview.rejected.length > 0 || importPreview.duplicateKeys.length > 0 || importAliasCandidates.some((candidate) => !aliasChoiceBySource[candidate.sourceKey])} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">{isImporting && <Loader2 size={13} className="animate-spin" />}{isImporting ? 'Đang apply...' : 'Apply danh mục khách hàng'}</button></div></div>}
            </section>

            {importPreview && importAliasCandidates.length > 0 && (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm md:p-4">
                <div className="flex items-start gap-2">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <div className="min-w-0">
                    <h2 className="text-sm font-black text-amber-950">Quyết định alias trước khi apply</h2>
                    <p className="mt-1 text-[10px] leading-4 text-amber-900/80">Chọn rõ từng ứng viên. Hệ thống không tự đổi mã và không tự merge dữ liệu.</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {importAliasCandidates.map((candidate) => (
                    <label key={candidate.sourceKey + '-' + candidate.targetKey} className="grid gap-1 rounded-lg border border-amber-200 bg-white p-2">
                      <span className="font-mono text-[10px] font-black text-slate-700">{candidate.sourceKey} → {candidate.targetKey}</span>
                      <select
                        value={aliasChoiceBySource[candidate.sourceKey] || ''}
                        onChange={(event) => setAliasChoiceBySource((current) => ({ ...current, [candidate.sourceKey]: event.target.value }))}
                        disabled={isImporting}
                        className="rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-700 outline-none focus:border-indigo-400 disabled:bg-slate-100"
                      >
                        <option value="">Chọn quyết định</option>
                        <option value={PCN_ALIAS_KEEP_SOURCE_KEY}>Giữ khóa nguồn (bản ghi riêng)</option>
                        <option value={candidate.targetKey}>Map vào khóa đích hiện có</option>
                      </select>
                    </label>
                  ))}
                </div>
                <p className="mt-3 text-[10px] font-semibold text-amber-900">Chỉ khi đã quyết định đủ tất cả ứng viên, nút Apply mới hợp lệ.</p>
              </section>
            )}

            <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
              <div className="flex items-center gap-2"><Database size={16} className="text-indigo-600" /><h2 className="text-sm font-black text-slate-800">Bằng chứng ranh giới PCN</h2></div>
              <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2">
                <Evidence label="Có trigger activity log append-only" ok={snapshot.hasActivityLogAppendOnlyTrigger} />
                <Evidence label="Có bảng file_assets" ok={snapshot.hasFileAssetsTable} />
                <Evidence label="Không có collection nghiệp vụ DDT" ok={ddtCollectionNames.length === 0} detail={String(ddtCollectionNames.length)} />
                <Evidence label="Archive database đọc được" ok={Boolean(backup?.dumpReadable)} />
                <Evidence label="Object archive qua kiểm tra" ok={Boolean(backup?.ok)} detail={backup ? `${backup.verifiedObjectCount}/${backup.manifestObjectCount}` : undefined} />
              </div>
            </section>

            <section className={`rounded-xl border p-3 shadow-sm md:p-4 ${importCheckpoint && importCheckpointBackup?.ok ? 'border-emerald-200 bg-emerald-50/60' : 'border-amber-200 bg-amber-50/70'}`}>
              <div className="flex items-start gap-2"><ShieldAlert size={16} className={importCheckpoint && importCheckpointBackup?.ok ? 'text-emerald-600' : 'text-amber-600'} /><div><h2 className="text-sm font-black text-slate-800">Checkpoint backup → import khách hàng</h2><p className="mt-1 text-[10px] leading-4 text-slate-600">Bằng chứng được đọc từ audit append-only và kiểm chứng lại đúng archive được tham chiếu; audit cũ thiếu đủ tuple hoặc archive không còn hợp lệ sẽ không được suy diễn là đã đạt.</p></div></div>
              {importCheckpoint ? <div className="mt-3 grid gap-2 text-[10px] sm:grid-cols-2"><Evidence label="Archive" ok detail={importCheckpoint.filename} /><Evidence label="Trạng thái trong audit" ok={importCheckpoint.status === 'VALID'} detail={importCheckpoint.status} /><Evidence label="Archive kiểm chứng lại" ok={Boolean(importCheckpointBackup?.ok && importCheckpointBackup.filename === importCheckpoint.filename)} detail={importCheckpointBackup?.status || 'Chưa kiểm chứng'} /><Evidence label="Tạo archive" ok detail={new Date(importCheckpoint.createdAt).toLocaleString('vi-VN')} /><Evidence label="Fingerprint nguồn" ok detail={importCheckpoint.sourceFingerprint.slice(0, 16) + '…'} /></div> : <p className="mt-3 rounded-lg border border-amber-200 bg-white/70 p-2.5 text-[10px] font-bold text-amber-900">Chưa có audit import khách hàng chứa checkpoint đầy đủ. Cần thực hiện lần import tiếp theo qua job mới để tạo bằng chứng truy vết.</p>}
            </section>

            {legacyPlans.length > 0 && <section className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm md:p-4"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /><h2 className="text-sm font-black text-slate-800">Collection cần nghiệm thu</h2></div><div className="mt-3 space-y-2">{legacyPlans.map((plan) => <div key={`${plan.legacyCollection}-${plan.canonicalCollection}`} className="rounded-lg border border-amber-100 bg-amber-50/60 p-2.5 text-[10px] text-amber-900"><div className="font-mono font-black">{plan.legacyCollection} → {plan.canonicalCollection}</div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-amber-800"><span>Bản ghi: <b>{plan.legacyCount}</b></span><span>Trùng: <b>{plan.matchingCount}</b></span><span>Thiếu canonical: <b>{plan.missingCanonicalCount}</b></span><span>Xung đột: <b>{plan.conflictingCount}</b></span><span>{plan.safeToRemove ? 'Có thể dọn sau nghiệm thu' : 'Chưa đủ điều kiện dọn'}</span></div></div>)}</div></section>}

            {status.errors.length > 0 && <section className="rounded-xl border border-rose-200 bg-white p-3 shadow-sm md:p-4"><h2 className="text-sm font-black text-rose-900">Các điểm cần rà soát</h2><ul className="mt-2 list-disc space-y-1 pl-4 text-[10px] leading-5 text-rose-800">{status.errors.map((item) => <li key={item}>{item}</li>)}</ul></section>}
          </>
        ) : null}

        <p className="text-[10px] leading-4 text-slate-400">Đối soát này không ghi audit, không khôi phục, không xóa và không sửa dữ liệu. Thao tác xử lý sai lệch phải được quyết định riêng rồi thực hiện trong boundary nghiệp vụ phù hợp.</p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className="mt-1 truncate text-sm font-black text-slate-800">{value}</div></div>;
}

function Evidence({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return <div className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${ok ? 'border-emerald-100 bg-emerald-50/60' : 'border-amber-100 bg-amber-50/60'}`}><span className="font-semibold text-slate-700">{label}</span><span className={`shrink-0 font-black ${ok ? 'text-emerald-700' : 'text-amber-700'}`}>{detail || (ok ? 'Đạt' : 'Chưa đạt')}</span></div>;
}

function CompareMetric({ label, value }: { label: string; value: number }) {
  return <div className={`rounded-lg border p-2 ${value > 0 ? 'border-amber-200 bg-amber-50' : 'border-emerald-100 bg-emerald-50/60'}`}><div className="text-[9px] font-semibold text-slate-500">{label}</div><div className={`mt-0.5 text-lg font-black ${value > 0 ? 'text-amber-800' : 'text-emerald-700'}`}>{value}</div></div>;
}

function KeyList({ label, values }: { label: string; values: string[] }) {
  return <div><p className="font-black text-[10px] text-slate-700">{label}</p>{values.length === 0 ? <p className="mt-1 text-[9px] text-emerald-700">Không có</p> : <div className="mt-1 flex flex-wrap gap-1">{values.slice(0, 20).map((value) => <span key={value} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-mono text-[9px] text-slate-600">{value}</span>)}</div>}</div>;
}

export default PcnCutoverVerificationView;
