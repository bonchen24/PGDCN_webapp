'use client';

import { Download, FileOutput, Save, Settings2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type { PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import {
  normalizePgdCellValues,
  validatePgdCellValues,
  type PgdDocumentTemplate,
  type PgdDocumentTemplateFormat,
  type PgdDocumentTemplateKind,
  type PgdTemplateCell,
} from '../utils/pgdDocumentTemplates';
import { getPgdDocumentDownloadUrl, getPgdTemplateSourceUrl } from '../utils/pgdApi';
import { usePgdStore } from '../store-pgd';
import PgdTableFieldEditor from './PgdTableFieldEditor';

type PgdDocumentGenerationPanelProps = {
  request: PgdInspectionRequest;
  templates: PgdDocumentTemplate[];
  documents: PgdGeneratedDocument[];
  canMutate: boolean;
  onOpenSettings?: () => void;
};

const TEMPLATE_KIND_LABELS: Record<PgdDocumentTemplateKind, string> = {
  INTAKE_REQUEST: 'Phiếu tiếp nhận PYC',
  ASSIGNMENT: 'Phiếu phân công',
  INSPECTION_PLAN: 'Kế hoạch giám định',
  FIELD_INSPECTION: 'Biên bản hiện trường',
  SAMPLE_TAKING: 'Biên bản lấy mẫu',
  LAB_REQUEST: 'Phiếu giao nhận / yêu cầu PTN',
  INSPECTION_REPORT: 'Báo cáo giám định',
  DECISION: 'Quyết định PGD',
  INSPECTION_CERTIFICATE: 'Chứng thư giám định',
};

function initialValue(cell: PgdTemplateCell, request: PgdInspectionRequest): unknown {
  const byKey: Record<string, unknown> = {
    requestCode: request.requestCode,
    customerName: request.customerSnapshot.name,
    customerAddress: request.customerSnapshot.address,
    productName: request.productName,
    lotCode: request.lotCode || '',
    quantity: request.quantity,
    inspectionScope: request.inspectionScope,
    inspectionLocation: request.inspectionLocation,
    intakeChannel: request.intakeChannel,
    standards: request.standards.map((standard) => ({ standard })),
    certificateScope: request.inspectionScope,
    inspectionDate: request.inspectionScheduledAt || '',
    inspectionDateTime: request.inspectionScheduledAt || '',
    inspectionLocationText: request.inspectionLocation,
    samplingLocation: request.inspectionLocation,
    samplingMethod: request.method || '',
    assessmentMethod: request.assessmentMethod || (request.method === 'TT58' ? 'METHOD_7' : ''),
    purpose: request.inspectionScope,
    productForm: request.productDetails?.productForm || '',
    grade: request.productDetails?.grade || request.brand || '',
    dimensions: request.productDetails?.dimensions || '',
    productStandard: request.productDetails?.productStandard || '',
    origin: request.productDetails?.origin || '',
    countryOfOrigin: request.productDetails?.countryOfOrigin || request.productDetails?.origin || '',
    manufacturer: request.productDetails?.manufacturer || '',
    manufacturerLotCode: request.productDetails?.manufacturerLotCode || '',
    importer: request.productDetails?.importer || '',
    hsCode: request.productDetails?.hsCode || '',
    lotDefinition: request.productDetails?.lotDefinition || '',
    customsDocuments: request.productDetails?.customsDocuments || [],
    steelLotSize: request.productDetails?.steelLotSize,
    steelSameGradeMultiProduct: request.productDetails?.steelSameGradeMultiProduct,
    steelManualSamplingPlanNote: request.productDetails?.steelManualSamplingPlanNote || '',
  };
  return Object.prototype.hasOwnProperty.call(byKey, cell.key) ? byKey[cell.key] : cell.type === 'TABLE' ? [] : '';
}

function scalarInputValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function decodeBase64(value: string): Uint8Array {
  const binary = window.atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export default function PgdDocumentGenerationPanel({ request, templates, documents, canMutate, onOpenSettings }: PgdDocumentGenerationPanelProps) {
  const generateDocument = usePgdStore((state) => state.generateDocument);
  const [templateId, setTemplateId] = useState('');
  const [format, setFormat] = useState<PgdDocumentTemplateFormat>('DOCX');
  const [cellValues, setCellValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [issue, setIssue] = useState('');
  const availableTemplates = useMemo(() => templates.filter((template) => template.active && template.status !== 'RETIRED' && template.productGroups.includes(request.productGroup)), [templates, request.productGroup]);
  const selectedTemplate = availableTemplates.find((item) => item.id === templateId) || availableTemplates[0];
  const template = useMemo(() => {
    if (!selectedTemplate) return undefined;
    const placeholderKeys = new Set(selectedTemplate.placeholderKeys || selectedTemplate.cells.map((cell) => cell.key));
    return { ...selectedTemplate, cells: selectedTemplate.cells.filter((cell) => placeholderKeys.has(cell.key) && cell.active !== false) };
  }, [selectedTemplate]);
  const formCells = useMemo(() => {
    if (!template) return [];
    const placeholderKeys = new Set(template.placeholderKeys || template.cells.map((cell) => cell.key));
    return template.cells.filter((cell) => placeholderKeys.has(cell.key) && cell.active !== false);
  }, [template]);
  const requestDocuments = documents.filter((document) => document.requestId === request.id);

  useEffect(() => {
    if (!template) return;
    setTemplateId((current) => current || template.id);
    setCellValues((current) => {
      const next: Record<string, unknown> = {};
      for (const cell of formCells) next[cell.key] = current[cell.key] ?? initialValue(cell, request);
      return next;
    });
  }, [formCells, template?.id, request.id]);

  const updateCell = (cell: PgdTemplateCell, value: unknown) => {
    setCellValues((current) => ({ ...current, [cell.key]: value }));
  };

  const generate = async () => {
    if (!template) return;
    setBusy(true);
    try {
      const normalized = normalizePgdCellValues(template.cells, cellValues);
      const issues = validatePgdCellValues(template.cells, normalized);
      if (issues.length > 0) throw new Error(issues.map((item) => item.message).join(' '));
      const result = await generateDocument({ requestId: request.id, kind: template.kind, format, templateId: template.id, cellValues: normalized });
      const blob = new Blob([decodeBase64(result.contentBase64)], { type: result.document.mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.document.fileName;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Đã sinh ${result.document.fileName}`);
      setIssue('');
    } catch (error: any) {
      setIssue(error?.message || 'Không thể sinh tài liệu PGD.');
      toast.error(error?.message || 'Không thể sinh tài liệu PGD.');
    } finally {
      setBusy(false);
    }
  };

  return <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-3" aria-label="Sinh tài liệu PGD">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="flex items-center gap-2 text-xs font-black text-blue-950"><FileOutput size={15} className="text-blue-600" /> Sinh tài liệu PGD</h3><p className="mt-1 text-[10px] text-blue-800/70">Nhập dữ liệu theo form, sau đó sinh tài liệu từ template DOCX của phòng.</p></div><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-full border border-blue-200 bg-white px-2 py-1 text-[9px] font-black text-blue-700">PGD · {request.productGroup}</span>{onOpenSettings && <button type="button" onClick={onOpenSettings} className="inline-flex min-h-8 items-center gap-1 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[9px] font-black text-blue-700 hover:bg-blue-100"><Settings2 size={12} /> Cài đặt DOCX</button>}</div></div>
    <div className="mt-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_8rem_auto]"><label><span className="mb-1 block text-[9px] font-black text-slate-500">Loại biểu mẫu</span><select aria-label="Loại template tài liệu PGD" value={template?.id || ''} onChange={(event) => { setTemplateId(event.target.value); setCellValues({}); }} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400">{availableTemplates.map((item) => <option key={item.id} value={item.id}>{TEMPLATE_KIND_LABELS[item.kind]} · {item.code} · v{item.version}</option>)}</select></label><label><span className="mb-1 block text-[9px] font-black text-slate-500">Định dạng</span><select aria-label="Định dạng tài liệu PGD" value={format} onChange={(event) => setFormat(event.target.value as PgdDocumentTemplateFormat)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400">{(template?.formats || ['DOCX', 'PDF']).map((item) => <option key={item} value={item}>{item}</option>)}</select></label><div className="flex items-end"><button type="button" disabled={!canMutate || busy || !template} onClick={() => void generate()} className="inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"><Sparkles size={14} />{busy ? 'Đang sinh...' : 'Sinh DOCX/PDF & tải file'}</button></div></div>
    {template && <div className="mt-3 grid gap-2 md:grid-cols-2">{formCells.map((cell) => <label key={cell.key} className={cell.type === 'TABLE' ? 'block md:col-span-2' : 'block'}><span className="mb-1 block text-[9px] font-black text-slate-600">{cell.label}{cell.required ? ' *' : ''}{cell.unit ? ` · ${cell.unit}` : ''}<span className="ml-1 font-mono font-normal text-slate-400">[[{cell.key}]]</span></span>{cell.type === 'TABLE' ? <PgdTableFieldEditor cell={cell} value={cellValues[cell.key]} onChange={(value) => { setIssue(''); updateCell(cell, value); }} /> : cell.type === 'BOOLEAN' ? <select aria-label={`Giá trị ${cell.key}`} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-blue-400"><option value="">Chọn...</option><option value="true">Có</option><option value="false">Không</option></select> : cell.validation?.options?.length ? <select aria-label={`Giá trị ${cell.key}`} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] outline-none focus:border-blue-400"><option value="">Chọn...</option>{cell.validation.options.map((option) => <option key={option} value={option}>{option === 'METHOD_7' ? 'Phương thức 7' : option}</option>)}</select> : <input aria-label={`Giá trị ${cell.key}`} type={cell.type === 'NUMBER' ? 'number' : cell.type === 'DATE' ? 'date' : 'text'} value={scalarInputValue(cellValues[cell.key])} onChange={(event) => updateCell(cell, event.target.value)} className="min-h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-[10px] outline-none focus:border-blue-400" />}</label>)}</div>}
    {issue && <p role="alert" className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-bold text-amber-800">{issue}</p>}
    <div className="mt-3 border-t border-blue-100 pt-2"><div className="mb-1 text-[9px] font-black uppercase tracking-wide text-blue-800/60">Lịch sử file đã sinh</div>{requestDocuments.length === 0 ? <p className="text-[10px] text-slate-400">Chưa có tài liệu được sinh từ hồ sơ này.</p> : <div className="space-y-1">{requestDocuments.slice(0, 5).map((document) => <div key={document.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2 py-1.5 text-[10px]"><div className="min-w-0"><div className="break-all font-bold text-slate-700">{document.fileName}</div><div className="font-mono text-[9px] text-slate-400">{document.contextHash.slice(0, 12)} · {document.status}</div></div>{document.fileAssetId ? <a href={getPgdDocumentDownloadUrl(document.id)} download={document.fileName} className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-blue-200 px-2 text-[10px] font-black text-blue-700 hover:bg-blue-50"><Download size={12} /> Tải lại</a> : <span className="shrink-0 text-[9px] text-slate-400" title="Môi trường chưa cấu hình PGD Storage">File trực tiếp ở lần sinh</span>}</div>)}</div>}</div>
  </section>;
}

export function PgdTemplateManagementPanel({ templates, canMutate }: { templates: PgdDocumentTemplate[]; canMutate: boolean }) {
  const saveDocumentTemplate = usePgdStore((state) => state.saveDocumentTemplate);
  const [selectedId, setSelectedId] = useState(templates[0]?.id || '');
  const [draft, setDraft] = useState<PgdDocumentTemplate | undefined>(templates[0]);
  const [busy, setBusy] = useState(false);
  const selected = templates.find((template) => template.id === selectedId) || templates[0];
  const placeholderKeys = draft?.placeholderKeys || draft?.cells.map((cell) => cell.key) || [];

  useEffect(() => { setDraft(selected); }, [selected?.id]);
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try { await saveDocumentTemplate({ ...draft, status: 'DRAFT' }); toast.success('Đã lưu cấu hình template DOCX PGD.'); } catch (error: any) { toast.error(error?.message || 'Không thể lưu template PGD.'); } finally { setBusy(false); }
  };
  const sourceInspection = draft?.sourceInspection;
  const sourceStatusLabel = sourceInspection?.status === 'READY' ? 'File nguồn hợp lệ' : sourceInspection?.status === 'PLACEHOLDER_MISMATCH' ? 'Placeholder chưa khớp file nguồn' : sourceInspection?.status === 'MISSING' ? 'Thiếu file nguồn' : 'Chưa kiểm tra được file nguồn';
  const sourceStatusClass = sourceInspection?.status === 'READY' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800';
  return <div className="space-y-3 p-3 md:p-5"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Cài đặt DOCX</div><h1 className="mt-1 text-xl font-black text-slate-900">Cài đặt template DOCX PGD</h1><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Quản lý các template DOCX và placeholder của Phòng Giám định. Template được dùng cho form nhập liệu và sinh tài liệu theo đúng bố cục DOCX.</p></div><section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto]"><label><span className="mb-1 block text-[9px] font-black text-slate-500">Chọn template DOCX</span><select value={selected?.id || ''} onChange={(event) => setSelectedId(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400">{templates.map((template) => <option key={template.id} value={template.id}>{template.code} · {template.name} · v{template.version}</option>)}</select></label><div className="flex items-end"><button type="button" disabled={!canMutate || busy || !draft} onClick={() => void save()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:opacity-50"><Save size={13} />{busy ? 'Đang lưu...' : 'Lưu cấu hình template'}</button></div></div></section>{draft && <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-[10px] font-black text-blue-950">File DOCX nguồn và placeholder</div><p className="mt-1 break-all text-[9px] font-mono text-blue-800/70">{draft.fileName}{sourceInspection?.byteSize ? ` · ${sourceInspection.byteSize.toLocaleString('vi-VN')} bytes` : ''}</p></div><a href={getPgdTemplateSourceUrl(draft.id)} download={draft.fileName} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-2.5 py-1.5 text-[9px] font-black text-blue-700 hover:bg-blue-100">Tải DOCX nguồn</a></div><div className={`mt-2 inline-flex rounded-full border px-2 py-1 text-[9px] font-black ${sourceStatusClass}`}>{sourceStatusLabel}</div>{sourceInspection?.status !== 'READY' && sourceInspection?.message && <p role="alert" className="mt-2 text-[9px] font-bold text-amber-800">{sourceInspection.message}</p>}{sourceInspection?.missingPlaceholderKeys?.length > 0 && <p className="mt-1 break-all text-[9px] font-bold text-amber-800">Thiếu placeholder: {sourceInspection.missingPlaceholderKeys.map((key) => `[[${key}]]`).join(', ')}</p>}{sourceInspection?.extraPlaceholderKeys?.length > 0 && <p className="mt-1 break-all text-[9px] font-bold text-amber-800">Thừa placeholder: {sourceInspection.extraPlaceholderKeys.map((key) => `[[${key}]]`).join(', ')}</p>}<p className="mt-2 text-[9px] leading-4 text-blue-800/70">Placeholder được kiểm tra trực tiếp từ file DOCX; bố cục biểu mẫu nằm trong file nguồn.</p><div className="mt-2 flex flex-wrap gap-1.5">{draft.cells.filter((cell) => placeholderKeys.includes(cell.key)).map((cell) => <span key={cell.key} className="rounded-md border border-blue-200 bg-white px-2 py-1 font-mono text-[9px] text-blue-800">[[{cell.key}]]</span>)}</div></div>}</div>;
}

export function PgdTemplateSettingsWorkspace({ templates, canMutate }: { templates: PgdDocumentTemplate[]; canMutate: boolean }) {
  return <PgdTemplateManagementPanel templates={templates} canMutate={canMutate} />;
}

export function PgdTemplateWorkspace({ templates, documents, canMutate, onOpenSettings }: { templates: PgdDocumentTemplate[]; documents: PgdGeneratedDocument[]; canMutate: boolean; onOpenSettings?: () => void }) {
  const requests = usePgdStore((state) => state.requests);
  const [requestId, setRequestId] = useState(requests[0]?.id || '');
  const request = requests.find((item) => item.id === requestId) || requests[0];
  useEffect(() => { if (!request && requests[0]) setRequestId(requests[0].id); }, [request, requests]);
  return <div className="space-y-3 p-3 md:p-5"><header className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">PGD · Workspace tài liệu</div><h1 className="mt-1 text-xl font-black text-slate-900">Tạo tài liệu PGD</h1><p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Chọn hồ sơ, nhập dữ liệu theo placeholder và sinh DOCX/PDF từ template của Phòng Giám định.</p></div>{onOpenSettings && <button type="button" onClick={onOpenSettings} className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-2 text-[10px] font-black text-blue-700 shadow-sm hover:bg-blue-50"><Settings2 size={14} /> Cài đặt DOCX</button>}</header><section className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><label className="block max-w-2xl"><span className="mb-1 block text-[9px] font-black text-slate-500">Chọn hồ sơ để sinh tài liệu</span><select aria-label="Hồ sơ PGD cần sinh tài liệu" value={request?.id || ''} onChange={(event) => setRequestId(event.target.value)} className="min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-[10px] font-bold outline-none focus:border-blue-400"><option value="">Chưa có hồ sơ PGD</option>{requests.map((item) => <option key={item.id} value={item.id}>{item.requestCode} · {item.productName}</option>)}</select></label></section>{request ? <div><PgdDocumentGenerationPanel request={request} templates={templates} documents={documents} canMutate={canMutate} onOpenSettings={onOpenSettings} /></div> : <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center text-[11px] text-slate-400">Tạo PYC PGD trước khi sinh tài liệu.</div>}</div>;
}
