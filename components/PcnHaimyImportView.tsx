'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Loader2, RefreshCw, ShieldCheck, UploadCloud } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnHaimyExportRecord, PcnHaimyStagingRecord, PcnHaimyStagingStatus, UserAccount } from '../types';
import { buildPcnHaimyImportPlan } from '../utils/pcnIntegration';
import { fetchPcnHaimyStaging, importPcnHaimyStaging, promotePcnHaimyStaging, type PcnHaimyPromotionResponse } from '../utils/pcnHaimyApi';
import type { PcnHaimyPromotionInput } from '../utils/pcnHaimyPromotion';
import { buildPcnHaimyStagingCsv } from '../utils/pcnHaimyExport';
import { parsePcnHaimyExportFile, PCN_HAIMY_IMPORT_MAX_ROWS } from '../utils/pcnHaimyImportFile';

const STATUS_LABELS: Record<PcnHaimyStagingStatus, string> = {
  READY_FOR_REVIEW: 'Sẵn sàng rà soát',
  NEEDS_REVIEW: 'Cần rà soát',
  DUPLICATE_NOOP: 'Trùng, bỏ qua',
  CONFLICT: 'Xung đột',
  PROMOTED: 'Đã tạo hồ sơ PCN',
};

const STATUS_CLASSES: Record<PcnHaimyStagingStatus, string> = {
  READY_FOR_REVIEW: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  NEEDS_REVIEW: 'border-amber-200 bg-amber-50 text-amber-700',
  DUPLICATE_NOOP: 'border-slate-200 bg-slate-50 text-slate-600',
  CONFLICT: 'border-rose-200 bg-rose-50 text-rose-700',
  PROMOTED: 'border-indigo-200 bg-indigo-50 text-indigo-700',
};

function isEditable(user: UserAccount | null): boolean {
  return Boolean(user && user.systemRole !== 'viewer' && user.role !== 'viewer');
}

function defaultBatchId(): string {
  return `haimy-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
}

function statusSummary(items: PcnHaimyStagingRecord[]): string {
  const needsReview = items.filter((item) => item.status === 'NEEDS_REVIEW').length;
  const conflicts = items.filter((item) => item.status === 'CONFLICT').length;
  const promoted = items.filter((item) => item.status === 'PROMOTED').length;
  return `${items.length} dòng · ${needsReview} cần rà soát · ${conflicts} xung đột · ${promoted} đã tạo hồ sơ`;
}

function initialPromotionInput(item: PcnHaimyStagingRecord): PcnHaimyPromotionInput {
  return {
    proposalCode: item.registrationCode || item.externalRegistrationId || '',
    channel: 'OTHER',
    customerAddress: '',
    contactPerson: '',
    taxId: '',
    phone: '',
    email: '',
    warehouseAddress: '',
    productType: '',
    specifications: '',
    manufacturer: '',
    manufacturerAddress: '',
    method: 'METHOD_1',
  };
}

export function PcnHaimyImportView({ currentUser, onPromoted, onOpenDossier }: { currentUser: UserAccount | null; onPromoted?: (response: PcnHaimyPromotionResponse) => void | Promise<void>; onOpenDossier?: (dossierId: string) => void }) {
  const editable = isEditable(currentUser);
  const [batchId, setBatchId] = useState(defaultBatchId);
  const [fileName, setFileName] = useState('');
  const [parsedRecords, setParsedRecords] = useState<PcnHaimyExportRecord[]>([]);
  const [preview, setPreview] = useState<PcnHaimyStagingRecord[]>([]);
  const [parseError, setParseError] = useState('');
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PcnHaimyStagingStatus>('ALL');
  const [staged, setStaged] = useState<PcnHaimyStagingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [selectedForPromotion, setSelectedForPromotion] = useState<PcnHaimyStagingRecord | null>(null);
  const [promotionInput, setPromotionInput] = useState<PcnHaimyPromotionInput>({});
  const [promoting, setPromoting] = useState(false);

  const reload = async () => {
    if (loading) return;
    setLoading(true);
    try {
      setStaged(await fetchPcnHaimyStaging());
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải dữ liệu staging Haimy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void reload(); }, []);

  const filteredStaged = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return staged.filter((item) => {
      const haystack = [item.batchId, item.externalRegistrationId, item.externalBatchId, item.customerName, item.productName, item.model, item.brand, item.fieldCode, item.idempotencyKey]
        .filter(Boolean).join(' ').toLocaleLowerCase('vi-VN');
      return (statusFilter === 'ALL' || item.status === statusFilter) && (!normalized || haystack.includes(normalized));
    });
  }, [query, staged, statusFilter]);

  const exportFilteredStaging = () => {
    if (filteredStaged.length === 0) return;
    const blob = new Blob([buildPcnHaimyStagingCsv(filteredStaged)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pcn-haimy-staging-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    toast.success(`Đã xuất ${filteredStaged.length} dòng staging đang lọc.`);
  };

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setParseError('');
    setParsedRecords([]);
    setPreview([]);
    try {
      const records = await parsePcnHaimyExportFile(file);
      const plan = buildPcnHaimyImportPlan({ batchId: batchId.trim(), records });
      setParsedRecords(records);
      setPreview(plan.items);
    } catch (error: any) {
      setParseError(error?.message || 'Không thể đọc file Haimy.');
    }
  };

  const submit = async () => {
    if (importing) return;
    if (!editable || parsedRecords.length === 0 || preview.length === 0 || !batchId.trim()) return;
    setImporting(true);
    try {
      const response = await importPcnHaimyStaging(batchId.trim(), parsedRecords);
      setStaged(await fetchPcnHaimyStaging());
      setPreview(response.items);
      toast.success(`Đã staging ${response.summary.created} dòng Haimy; không ghi hồ sơ pháp lý.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể staging file Haimy.');
    } finally {
      setImporting(false);
    }
  };

  const openPromotion = (item: PcnHaimyStagingRecord) => {
    if (!editable || item.status !== 'READY_FOR_REVIEW') return;
    setSelectedForPromotion(item);
    setPromotionInput(initialPromotionInput(item));
  };

  const setPromotionField = (field: keyof PcnHaimyPromotionInput, value: string) => {
    setPromotionInput((current) => ({ ...current, [field]: value }));
  };

  const promote = async () => {
    if (promoting) return;
    if (!editable || !selectedForPromotion || selectedForPromotion.status !== 'READY_FOR_REVIEW') return;
    setPromoting(true);
    try {
      const response = await promotePcnHaimyStaging(selectedForPromotion.idempotencyKey, promotionInput);
      setStaged((current) => current.map((item) => item.idempotencyKey === response.staging.idempotencyKey ? response.staging : item));
      setSelectedForPromotion(response.staging);
      toast.success(response.idempotent ? 'Bản ghi đã được duyệt trước đó; đã tải lại hồ sơ PCN.' : 'Đã tạo Đề nghị và hồ sơ PCN từ staging Haimy.');
      await onPromoted?.(response);
      onOpenDossier?.(response.dossier.id);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể duyệt staging Haimy vào PCN.');
    } finally {
      setPromoting(false);
    }
  };

  return <div className="h-full overflow-y-auto bg-slate-50/60 p-3 pb-20 md:p-5">
    {staged.some((item) => item.status === 'PROMOTED' && item.promotion?.dossierId) && <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[10px] text-indigo-800"><CheckCircle2 size={14} className="shrink-0" /><b>Hồ sơ đã tạo:</b>{staged.filter((item) => item.status === 'PROMOTED' && item.promotion?.dossierId).slice(0, 12).map((item) => <button key={item.idempotencyKey} type="button" onClick={() => onOpenDossier?.(item.promotion!.dossierId)} className="rounded-md border border-indigo-200 bg-white px-2 py-1 font-bold text-indigo-700 hover:border-indigo-400">Mở hồ sơ PCN · {item.externalRegistrationId || item.batchId}</button>)}</div>}
    <div className="mb-4 flex items-start justify-between gap-3">
      <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Tích hợp nội bộ PCN</p><h1 className="mt-1 text-xl font-black text-slate-900">Haimy · Import staging</h1><p className="mt-1 max-w-3xl text-[11px] text-slate-500">Nhận export do người vận hành chọn, chuẩn hóa để rà soát và giữ trong database PCN. Chưa có API upstream nên hệ thống không tự kết nối, không ghi ngược và không tạo hồ sơ pháp lý.</p></div>
      <button type="button" onClick={() => void reload()} disabled={loading} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:border-emerald-300 disabled:opacity-50"><RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Làm mới</button>
    </div>

    <div className="mb-4 flex items-start gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[10px] leading-relaxed text-indigo-800"><ShieldCheck size={15} className="mt-0.5 shrink-0" /><span><b>Ranh giới an toàn:</b> staging không tự chuyển thành dữ liệu pháp lý. Chỉ thao tác tường minh của người dùng PCN mới tạo Đề nghị + hồ sơ; không đồng bộ ngược Haimy, không tự tạo lô mẫu/PYC/KQTN/GCN/QĐ.</span></div>

    {editable ? <section className="mb-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"><div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto] md:items-end"><label className="text-[10px] font-black text-slate-600">Batch ID *<input value={batchId} onChange={(event) => { setBatchId(event.target.value); setParsedRecords([]); setPreview([]); }} maxLength={120} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px] outline-none focus:border-emerald-400" placeholder="haimy-20260829-01" /></label><label className="text-[10px] font-black text-slate-600">File export JSON / CSV / XLSX<input type="file" accept=".json,.csv,.xlsx" onChange={(event) => void onFileChange(event)} className="mt-1 block w-full rounded-md border border-dashed border-slate-300 bg-slate-50 px-2.5 py-2 text-[10px]" /></label><button type="button" onClick={() => void submit()} disabled={importing || parsedRecords.length === 0 || preview.length === 0 || !batchId.trim()} className="inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-3 py-2 text-[10px] font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300">{importing ? <Loader2 size={13} className="animate-spin" /> : <UploadCloud size={13} />} Lưu staging</button></div>{fileName && <p className="mt-2 text-[10px] text-slate-500">Đã đọc: <b>{fileName}</b> · giới hạn {PCN_HAIMY_IMPORT_MAX_ROWS.toLocaleString('vi-VN')} dòng · {statusSummary(preview)}</p>}{parseError && <p className="mt-2 flex items-center gap-1 text-[10px] font-bold text-rose-600"><AlertTriangle size={12} /> {parseError}</p>}{preview.length > 0 && <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200"><table className="w-full min-w-[760px] text-left text-[10px]"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-500"><tr><th className="px-2 py-2">Định danh ngoài</th><th className="px-2 py-2">Khách hàng / sản phẩm</th><th className="px-2 py-2">Lĩnh vực</th><th className="px-2 py-2">Trạng thái</th><th className="px-2 py-2">Lỗi rà soát</th></tr></thead><tbody>{preview.slice(0, 100).map((item, index) => <tr key={`${item.idempotencyKey}-${index}`} className="border-t border-slate-100"><td className="px-2 py-2 font-mono">{item.externalRegistrationId || 'Thiếu mã'}</td><td className="px-2 py-2">{item.customerName || 'Thiếu khách hàng'}<br /><span className="text-slate-500">{item.productName || 'Thiếu sản phẩm'}{item.model ? ` · ${item.model}` : ''}</span></td><td className="px-2 py-2">{item.fieldCode || 'Chưa có'}</td><td className="px-2 py-2"><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${STATUS_CLASSES[item.status]}`}>{STATUS_LABELS[item.status]}</span></td><td className="max-w-[300px] px-2 py-2 text-rose-600">{item.issues.map((issue) => issue.message).join(' · ') || 'Không có'}</td></tr>)}</tbody></table>{preview.length > 100 && <p className="border-t border-slate-100 px-2 py-2 text-[10px] text-slate-500">Đang hiển thị 100/{preview.length} dòng preview.</p>}</div>}</section> : <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Viewer chỉ được xem staging; không được nhập export mới.</div>}

    {selectedForPromotion && <section className="mb-4 rounded-xl border border-indigo-200 bg-white p-3 shadow-sm md:p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">Duyệt tường minh vào PCN</p><h2 className="mt-1 text-sm font-black text-slate-900">Tạo Đề nghị + hồ sơ PCN</h2><p className="mt-1 text-[10px] text-slate-500">Bản ghi chuẩn hóa được giữ nguyên từ staging; các trường dưới đây là phần người vận hành phải xác nhận/bổ sung trước khi tạo hồ sơ.</p></div><button type="button" onClick={() => setSelectedForPromotion(null)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 hover:border-slate-300">Đóng</button></div><div className="mt-3 grid gap-2 rounded-lg bg-slate-50 p-3 text-[10px] md:grid-cols-3"><div><span className="text-slate-400">Mã ngoài</span><b className="ml-1 font-mono">{selectedForPromotion.externalRegistrationId || 'Thiếu mã'}</b></div><div><span className="text-slate-400">Khách hàng</span><b className="ml-1">{selectedForPromotion.customerName || '—'}</b></div><div><span className="text-slate-400">Sản phẩm</span><b className="ml-1">{selectedForPromotion.productName || '—'} · {selectedForPromotion.model || '—'} · {selectedForPromotion.brand || '—'}</b></div></div><div className="mt-3 grid gap-3 md:grid-cols-2"><label className="text-[10px] font-bold text-slate-600">Mã Đề nghị<input value={promotionInput.proposalCode || ''} onChange={(event) => setPromotionField('proposalCode', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" placeholder="Để trống để dùng mã staging" /></label><label className="text-[10px] font-bold text-slate-600">Kênh tiếp nhận<select value={promotionInput.channel || 'OTHER'} onChange={(event) => setPromotionField('channel', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px]"><option value="DIRECT">Trực tiếp</option><option value="EMAIL">Email</option><option value="ONLINE_ZALO">Online/Zalo</option><option value="OTHER">Khác</option></select></label><label className="text-[10px] font-bold text-slate-600">Địa chỉ khách hàng *<input value={promotionInput.customerAddress || ''} onChange={(event) => setPromotionField('customerAddress', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Người liên hệ<input value={promotionInput.contactPerson || ''} onChange={(event) => setPromotionField('contactPerson', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" placeholder="Hoặc nhập mã số thuế" /></label><label className="text-[10px] font-bold text-slate-600">Mã số thuế<input value={promotionInput.taxId || ''} onChange={(event) => setPromotionField('taxId', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Điện thoại<input value={promotionInput.phone || ''} onChange={(event) => setPromotionField('phone', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Email<input type="email" value={promotionInput.email || ''} onChange={(event) => setPromotionField('email', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Địa chỉ/kho liên quan *<input value={promotionInput.warehouseAddress || ''} onChange={(event) => setPromotionField('warehouseAddress', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Kiểu/loại sản phẩm *<input value={promotionInput.productType || ''} onChange={(event) => setPromotionField('productType', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Thông số kỹ thuật *<textarea value={promotionInput.specifications || ''} onChange={(event) => setPromotionField('specifications', event.target.value)} className="mt-1 min-h-20 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Nhà sản xuất *<input value={promotionInput.manufacturer || ''} onChange={(event) => setPromotionField('manufacturer', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label><label className="text-[10px] font-bold text-slate-600">Địa chỉ nhà sản xuất<input value={promotionInput.manufacturerAddress || ''} onChange={(event) => setPromotionField('manufacturerAddress', event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 text-[11px]" /></label></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><label className="text-[10px] font-bold text-slate-600">Phương thức chứng nhận<select value={promotionInput.method || 'METHOD_1'} onChange={(event) => setPromotionField('method', event.target.value)} className="ml-2 rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px]"><option value="METHOD_1">Phương thức 1</option><option value="METHOD_5">Phương thức 5</option><option value="METHOD_7">Phương thức 7</option></select></label><button type="button" onClick={() => void promote()} disabled={promoting || selectedForPromotion.status !== 'READY_FOR_REVIEW'} className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">{promoting ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Duyệt và tạo hồ sơ</button></div></section>}

    <section className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><FileSpreadsheet size={16} className="text-indigo-600" /><h2 className="text-sm font-black text-slate-800">Bản ghi đã staging</h2><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[9px] font-bold text-slate-500">{filteredStaged.length}/{staged.length}</span></div><div className="flex flex-wrap gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} className="rounded-md border border-slate-200 px-2.5 py-1.5 text-[10px] outline-none focus:border-emerald-400" placeholder="Tìm batch, mã ngoài, khách hàng..." /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px]"><option value="ALL">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select><button type="button" onClick={exportFilteredStaging} disabled={filteredStaged.length === 0} className="inline-flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-bold text-indigo-700 hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-50" title="Xuất đúng snapshot staging đang lọc"><Download size={13} /> Xuất CSV</button></div></div>{filteredStaged.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 p-10 text-center text-[11px] text-slate-400">Chưa có bản ghi staging phù hợp.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-left text-[10px]"><thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-500"><tr><th className="px-2 py-2">Batch</th><th className="px-2 py-2">Định danh ngoài</th><th className="px-2 py-2">Khách hàng / sản phẩm</th><th className="px-2 py-2">QC</th><th className="px-2 py-2">Trạng thái</th><th className="px-2 py-2">Lý do</th><th className="px-2 py-2">Fingerprint</th><th className="px-2 py-2">Thao tác</th></tr></thead><tbody>{filteredStaged.slice(0, 250).map((item) => <tr key={item.idempotencyKey} className="border-t border-slate-100"><td className="px-2 py-2 font-mono">{item.batchId}</td><td className="px-2 py-2 font-mono">{item.externalRegistrationId || 'Thiếu mã'}<br /><span className="text-slate-400">{item.externalBatchId || ''}</span></td><td className="px-2 py-2">{item.customerName || '—'}<br /><span className="text-slate-500">{item.productName || '—'}{item.model ? ` · ${item.model}` : ''}</span></td><td className="px-2 py-2">{item.fieldCode || '—'}</td><td className="px-2 py-2"><span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${STATUS_CLASSES[item.status]}`}>{STATUS_LABELS[item.status]}</span></td><td className="max-w-[280px] px-2 py-2 text-slate-500">{item.issues.map((issue) => issue.message).join(' · ') || 'Không có'}</td><td className="px-2 py-2 font-mono text-[9px] text-slate-400" title={item.sourcePayloadFingerprint}>{item.sourcePayloadFingerprint.slice(0, 16)}…</td><td className="px-2 py-2">{item.status === 'READY_FOR_REVIEW' && editable ? <button type="button" onClick={() => openPromotion(item)} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1.5 text-[9px] font-black text-white hover:bg-indigo-700">Tạo Đề nghị + hồ sơ PCN</button> : item.status === 'PROMOTED' ? <span className="text-[9px] font-bold text-indigo-700">Đã tạo · mở từ danh sách hồ sơ</span> : <span className="text-[9px] text-slate-400">Chỉ READY_FOR_REVIEW mới được duyệt</span>}</td></tr>)}</tbody></table>{filteredStaged.length > 250 && <p className="border-t border-slate-100 px-2 py-2 text-[10px] text-slate-500">Đang hiển thị 250/{filteredStaged.length} dòng.</p>}</div>}</section>
  </div>;
}

export default PcnHaimyImportView;
