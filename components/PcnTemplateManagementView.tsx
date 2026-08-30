'use client';

import React, { useMemo, useState } from 'react';
import { Archive, CheckCircle2, FileText, FolderOpen, LockKeyhole, Search, ShieldCheck, Tag, Upload } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnDocumentRequirement, PcnGeneratedDocumentKind, PcnOfficialDocumentKind, PcnTemplateAnnotationMapping, PcnTemplateDefinition, PcnTemplateReviewAction, PcnTemplateStatus, UserAccount } from '../types';
import { preflightPcnTemplateSourcesOnServer } from '../utils/pcnTemplateApi';
import type { PcnTemplateImportInput, PcnTemplateImportResponse } from '../utils/pcnTemplateApi';
import type { PcnTemplateSourceCoverageReport } from '../utils/pcnTemplateSourceCoverage';
import { usePcnStore } from '../store-pcn';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { getPcnTemplateAnnotationSuggestionCoverage, getPcnTemplateAnnotationSuggestions } from '../utils/pcnTemplateAnnotationSuggestions';
import { getPcnDossierTemplateProfiles } from '../utils/pcnDossierTemplateCatalog';
import { getPcnOfficialDocumentKindLabel, getPcnTemplateApprovalReadiness, getPcnTemplateRequiredPlaceholderKeys } from '../utils/pcnTemplateCatalog';

const STATUS_LABELS: Record<PcnTemplateStatus, string> = {
  DISCOVERED: 'Đã phát hiện',
  NEEDS_ANNOTATION: 'Cần chú thích',
  APPROVED: 'Đã phê duyệt',
  RETIRED: 'Ngừng sử dụng',
};

const STATUS_CLASSES: Record<PcnTemplateStatus, string> = {
  DISCOVERED: 'border-blue-200 bg-blue-50 text-blue-700',
  NEEDS_ANNOTATION: 'border-amber-200 bg-amber-50 text-amber-700',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  RETIRED: 'border-slate-200 bg-slate-100 text-slate-600',
};

function canManageTemplates(user: UserAccount | null): boolean {
  return user?.systemRole === 'admin' || user?.role === 'admin';
}

function reasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    STATUS_NOT_APPROVED: 'Chưa ở trạng thái phê duyệt',
    LEGACY_FORMAT: 'Định dạng DOC legacy',
    MISSING_PRIVATE_ASSET: 'Chưa có asset private',
    MISSING_REQUIRED_PLACEHOLDERS: 'Thiếu placeholder bắt buộc',
  };
  return labels[reason] || reason;
}

function privateAssetVerificationLabel(issue: string): string {
  const labels: Record<string, string> = {
    MISSING_ASSET: 'Chưa có file mẫu trong kho riêng',
    ASSET_NOT_FOUND: 'Không tìm thấy file mẫu trong kho riêng',
    BUCKET_MISMATCH: 'File không nằm trong kho PCN',
    SOURCE_COLLECTION_MISMATCH: 'File liên kết sai nguồn dữ liệu',
    SOURCE_DOCUMENT_MISMATCH: 'File liên kết sai mã biểu mẫu',
    SOURCE_JSON_PATH_MISMATCH: 'File liên kết sai trường dữ liệu',
    MIME_TYPE_MISMATCH: 'Định dạng asset không đúng',
    BYTE_SIZE_MISMATCH: 'Kích thước file không khớp',
    SHA256_MISMATCH: 'Fingerprint SHA-256 không khớp',
    UNVERIFIED: 'Chưa có kết quả xác minh asset',
  };
  return labels[issue] || 'Asset chưa được xác minh';
}

function sourceCoverageStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    FOUND: 'Đã có trong kho',
    MISSING: 'Thiếu nguồn',
    FINGERPRINT_MISMATCH: 'Sai fingerprint',
    NEEDS_ANNOTATION: 'Cần chú thích',
    READY_TO_APPLY: 'Sẵn sàng Apply',
  };
  return labels[status] || status;
}

const GENERATED_KIND_LABELS: Record<PcnGeneratedDocumentKind, string> = {
  DOSSIER_COVER: 'Bìa hồ sơ',
  PROPOSAL_SUMMARY: 'Tóm tắt đề nghị',
  PROPOSAL_FORM: 'Phiếu đề nghị',
  ASSIGNMENT_FORM: 'Phiếu phân công chứng nhận',
  EVALUATION_PLAN: 'Kế hoạch đánh giá CNSP',
  FIELD_INSPECTION: 'Biên bản kiểm tra hiện trường',
  SAMPLE_TAKING: 'Biên bản lấy mẫu',
  SAMPLE_CODING: 'Biên bản mã hóa mẫu',
  EVALUATION_REPORT: 'Biên bản đánh giá',
  SAMPLE_HANDOVER: 'Biên bản giao nhận mẫu',
  SAMPLE_RETURN: 'Biên bản trả mẫu',
  LAB_REQUEST: 'Phiếu yêu cầu PTN',
};

const OFFICIAL_OUTPUT_LABELS: Record<PcnOfficialDocumentKind, string> = {
  PROPOSAL: 'Đề nghị',
  CERTIFICATE: 'Giấy chứng nhận',
  DECISION: 'Quyết định',
  SAMPLE_HANDOVER: 'Biên bản giao nhận mẫu',
  EVALUATION_REPORT: 'Biên bản đánh giá',
};

function BlankDossierPackCatalog({ documentRequirements }: { documentRequirements?: PcnDocumentRequirement[] }) {
  const profiles = useMemo(
    () => getPcnDossierTemplateProfiles(documentRequirements?.length ? documentRequirements : undefined),
    [documentRequirements],
  );
  const [expandedProfileId, setExpandedProfileId] = useState('QC4_BLANK_PACK');

  return <section className="mb-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3" aria-labelledby="pcn-blank-pack-title">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700"><FolderOpen size={13} /> Bộ hồ sơ mẫu trống</div>
        <h2 id="pcn-blank-pack-title" className="mt-1 text-sm font-black text-slate-900">Khung hồ sơ QC4/QC9 theo từng bước</h2>
        <p className="mt-1 max-w-3xl text-[10px] leading-4 text-slate-600">Catalog chỉ đọc, được chuẩn hóa từ các bộ hồ sơ hoàn tất khoảng 06–07/2026 và đối chiếu checklist hiện hành. Không chứa khách hàng, ảnh, số chứng thư hoặc file hồ sơ thật.</p>
      </div>
      <span className="rounded-md border border-emerald-200 bg-white px-2 py-1 text-[9px] font-black text-emerald-700">Mẫu trống • Chỉ đọc</span>
    </div>

    <div className="mt-3 grid gap-2 lg:grid-cols-2">
      {profiles.map((profile) => {
        const requirements = [...new Map(profile.stationGroups.flatMap((group) => group.requirements).map((requirement) => [requirement.id, requirement])).values()];
        const sourceMappingsByCode = new Map(profile.sourceMappings.map((mapping) => [mapping.requirementCode, mapping]));
        const requiredCount = requirements.filter((requirement) => requirement.required).length;
        const firstStationByRequirement = new Map<string, { number?: number; label: string }>();
        const expanded = expandedProfileId === profile.id;
        return <article key={profile.id} className="rounded-xl border border-white bg-white p-3 shadow-sm">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5"><h3 className="text-xs font-black text-slate-900">{profile.title}</h3><span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[9px] font-black text-emerald-700">{profile.fieldCode}</span></div>
              <p className="mt-1 text-[10px] leading-4 text-slate-500">{profile.description}</p>
            </div>
            <button type="button" aria-expanded={expanded} aria-controls={`${profile.id}-stations`} onClick={() => setExpandedProfileId((current) => current === profile.id ? '' : profile.id)} className="shrink-0 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-black text-emerald-700 hover:bg-emerald-100">{expanded ? 'Thu gọn' : 'Xem cấu trúc'}</button>
          </div>

          <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] font-bold text-slate-500"><span className="rounded bg-slate-50 px-1.5 py-1">{profile.stationGroups.length} bước</span><span className="rounded bg-slate-50 px-1.5 py-1">{requirements.length} mục</span><span className="rounded bg-emerald-50 px-1.5 py-1 text-emerald-700">{requiredCount} bắt buộc</span><span className="rounded bg-amber-50 px-1.5 py-1 text-amber-700">{requirements.length - requiredCount} khi phát sinh</span></div>

          {expanded && <div id={`${profile.id}-stations`} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {profile.stationGroups.map((group) => <div key={group.key} className="rounded-lg border border-slate-100 bg-slate-50/70 p-2">
              <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black text-slate-700">Bước {group.number || '—'} · {group.label}</p><span className="font-mono text-[9px] text-slate-400">{group.key}</span></div>
              <div className="mt-1.5 grid gap-1 sm:grid-cols-2">{group.requirements.map((requirement) => {
                const firstStation = firstStationByRequirement.get(requirement.id);
                if (firstStation) {
                  return <div key={requirement.id} className="rounded-md border border-dashed border-slate-200 bg-white/70 px-2 py-1.5" aria-label={`${requirement.name} dùng lại tại bước ${firstStation.number || '—'}`}>
                    <div className="flex items-start gap-1.5"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-1.5"><p className="text-[10px] font-bold leading-4 text-slate-600">{requirement.name}</p><span className="rounded bg-slate-100 px-1 py-0.5 text-[8px] font-black text-slate-500">Dùng lại</span></div><p className="mt-0.5 font-mono text-[8px] text-slate-400">{requirement.code} • {requirement.required ? 'Bắt buộc' : 'Điều kiện'}</p><p className="mt-1 text-[9px] leading-4 text-slate-500">Cùng yêu cầu với Bước {firstStation.number || '—'} · {firstStation.label}; không tạo hoặc tải lên tài liệu mới.</p></div></div>
                  </div>;
                }
                firstStationByRequirement.set(requirement.id, { number: group.number, label: group.label });
                const mapping = sourceMappingsByCode.get(requirement.code);
                return <div key={requirement.id} className="rounded-md border border-white bg-white px-2 py-1.5"><div className="flex items-start gap-1.5"><span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${requirement.required ? 'bg-emerald-500' : 'bg-amber-400'}`} /><div className="min-w-0"><p className="text-[10px] font-bold leading-4 text-slate-700">{requirement.name}</p><p className="font-mono text-[8px] text-slate-400">{requirement.code} • {requirement.required ? 'Bắt buộc' : 'Điều kiện'}</p><p className="mt-1 text-[9px] leading-4 text-cyan-800"><span className="font-black">PCN nguồn:</span> {mapping?.references.join(' • ') || 'Chưa có nguồn đối chiếu'}</p>{mapping?.note && <p className="mt-0.5 text-[8px] leading-3 text-slate-500">{mapping.note}</p>}</div></div></div>;
              })}</div>
            </div>)}
            <div className="grid gap-2 text-[9px] text-slate-500 sm:grid-cols-2"><div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-2"><p className="font-black text-indigo-700">Sinh nội bộ</p><p className="mt-1 leading-4">{profile.generatedKinds.map((kind) => GENERATED_KIND_LABELS[kind]).join(' • ')}</p></div><div className="rounded-lg border border-violet-100 bg-violet-50/60 p-2"><p className="font-black text-violet-700">Đầu ra chính thức</p><p className="mt-1 leading-4">{profile.officialOutputs.map((kind) => OFFICIAL_OUTPUT_LABELS[kind]).join(' • ')}</p></div></div>
            <div className="rounded-lg border border-amber-100 bg-amber-50/60 p-2 text-[9px] text-amber-900"><p className="font-black">Tên biểu mẫu nguồn đã đối chiếu</p><p className="mt-1 leading-4">{profile.sourceFormReferences.join(' • ')}</p><p className="mt-1 text-amber-700">Tên nguồn chỉ dùng để đối chiếu; file chính thức vẫn phải được Admin nhập, chú thích và phê duyệt riêng.</p></div>
            <p className="text-[9px] leading-4 text-slate-400">Nguồn cấu trúc: {profile.sourceBasis}</p>
          </div>}
        </article>;
      })}
    </div>
  </section>;
}

export function PcnTemplateManagementView({
  templates,
  currentUser,
  onReview,
  onAnnotate,
  onImport,
  onPreflightSources,
  documentRequirements,
}: {
  templates: PcnTemplateDefinition[];
  currentUser: UserAccount | null;
  onReview: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown>;
  onAnnotate: (templateId: string, mappings: PcnTemplateAnnotationMapping[]) => Promise<unknown>;
  onImport?: (input: PcnTemplateImportInput) => Promise<PcnTemplateImportResponse>;
  onPreflightSources?: (sourceRoot: string) => Promise<PcnTemplateSourceCoverageReport>;
  documentRequirements?: PcnDocumentRequirement[];
}) {
  const [query, setQuery] = useState('');
  const [fieldFilter, setFieldFilter] = useState<'ALL' | 'QC4' | 'QC9'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | PcnTemplateStatus>('ALL');
  const [assetFilter, setAssetFilter] = useState<'ALL' | 'VERIFIED' | 'NEEDS_REVIEW'>('ALL');
  const [busyId, setBusyId] = useState<string>();
  const [annotationTemplate, setAnnotationTemplate] = useState<PcnTemplateDefinition>();
  const [annotationMappings, setAnnotationMappings] = useState<PcnTemplateAnnotationMapping[]>([]);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [sourceRoot, setSourceRoot] = useState('');
  const [importReport, setImportReport] = useState<PcnTemplateImportResponse>();
  const [isImporting, setIsImporting] = useState(false);
  const [sourceCoverage, setSourceCoverage] = useState<PcnTemplateSourceCoverageReport>();
  const [isPreflighting, setIsPreflighting] = useState(false);
  const [allowAnnotationOnApply, setAllowAnnotationOnApply] = useState(false);
  const runtimeDocumentRequirements = usePcnStore((state) => state.documentRequirements);
  const editable = canManageTemplates(currentUser);

  const visibleTemplates = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi-VN');
    return templates.filter((template) => {
      const haystack = `${template.id} ${template.displayName} ${template.sourceLabel} ${template.sourceFingerprint.sourceRelativePath}`.toLocaleLowerCase('vi-VN');
      return (!normalized || haystack.includes(normalized))
        && (fieldFilter === 'ALL' || template.fieldCode === fieldFilter)
        && (statusFilter === 'ALL' || template.status === statusFilter)
        && (assetFilter === 'ALL' || (assetFilter === 'VERIFIED' ? template.privateAssetVerified === true : template.privateAssetVerified !== true));
    });
  }, [assetFilter, fieldFilter, query, statusFilter, templates]);

  const review = async (template: PcnTemplateDefinition, action: PcnTemplateReviewAction) => {
    if (!editable || busyId === template.id) return;
    const actionLabel = action === 'APPROVE' ? 'phê duyệt' : action === 'RETIRE' ? 'ngừng sử dụng' : 'yêu cầu chú thích';
    if (typeof window !== 'undefined' && !window.confirm(`Xác nhận ${actionLabel} template “${template.displayName}”?`)) return;
    const reason = action === 'APPROVE'
      ? ''
      : typeof window !== 'undefined' ? window.prompt('Lý do review (tuỳ chọn):', '') || '' : '';
    setBusyId(template.id);
    try {
      await onReview(template.id, action, reason);
      toast.success(`Đã ${actionLabel} template ${template.displayName}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể cập nhật trạng thái template.');
    } finally {
      setBusyId(undefined);
    }
  };

  const openAnnotation = (template: PcnTemplateDefinition) => {
    const requiredKeys = getPcnTemplateRequiredPlaceholderKeys(template);
    const missingKeys = requiredKeys.filter((key) => !template.placeholderKeys.includes(key));
    if (template.format !== 'DOCX' || missingKeys.length === 0) {
      toast.info('Template không còn placeholder bắt buộc nào cần chú thích.');
      return;
    }
    setAnnotationTemplate(template);
    const suggestions = getPcnTemplateAnnotationSuggestions(template);
    setAnnotationMappings(missingKeys.map((key) => ({ key, sourceText: suggestions[key] || '' })));
  };

  const submitAnnotation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isAnnotating) return;
    if (!annotationTemplate) return;
    if (annotationMappings.some((mapping) => !mapping.sourceText.trim())) {
      toast.error('Hãy nhập nhãn nguồn cho tất cả placeholder bắt buộc.');
      return;
    }
    setIsAnnotating(true);
    try {
      await onAnnotate(annotationTemplate.id, annotationMappings);
      toast.success(`Đã tạo bản DOCX chú thích cho ${annotationTemplate.displayName}. Mẫu vẫn chờ Admin phê duyệt.`);
      setAnnotationTemplate(undefined);
      setAnnotationMappings([]);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể chú thích template DOCX.');
    } finally {
      setIsAnnotating(false);
    }
  };

  const importTemplate = async (template: PcnTemplateDefinition, mode: PcnTemplateImportInput['mode']) => {
    if (!editable || isImporting) return;
    if (!sourceRoot.trim()) {
      toast.error('Hãy nhập thư mục gốc chứa bộ hồ sơ PCN trên máy chạy server.');
      return;
    }
    if (mode === 'APPLY' && importReport?.templateId !== template.id) {
      toast.error('Hãy chạy Dry-run đúng template này trước khi Apply.');
      return;
    }
    if (mode === 'APPLY' && importReport?.requiresAnnotation && !allowAnnotationOnApply) {
      toast.error('Template còn cảnh báo; hãy bật “Lưu tham chiếu cần chú thích” để Apply.');
      return;
    }
    setIsImporting(true);
    try {
      const runImport = onImport || usePcnStore.getState().importPcnTemplate;
      const report = await runImport({
        templateId: template.id,
        sourceRoot: sourceRoot.trim(),
        mode,
        ...(mode === 'APPLY' && allowAnnotationOnApply ? { allowAnnotation: true } : {}),
      });
      setImportReport(report);
      if (mode === 'APPLY') {
        setAllowAnnotationOnApply(false);
        toast.success(report.message);
      } else {
        toast.success('Dry-run template hoàn tất; chưa ghi DB/Storage.');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Không thể kiểm tra/import template PCN.');
    } finally {
      setIsImporting(false);
    }
  };

  const preflightAllSources = async () => {
    if (!editable || isPreflighting) return;
    if (!sourceRoot.trim()) {
      toast.error('Hãy nhập thư mục gốc chứa bộ hồ sơ PCN trên máy chạy server.');
      return;
    }
    setIsPreflighting(true);
    try {
      const runPreflight = onPreflightSources || ((root: string) => preflightPcnTemplateSourcesOnServer({ sourceRoot: root }));
      const report = await runPreflight(sourceRoot.trim());
      setSourceCoverage(report);
      toast.success(`Đã kiểm tra ${report.summary.total} nguồn mẫu: ${report.summary.readyToApply} sẵn sàng Apply, ${report.summary.needsAnnotation} cần chú thích.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể kiểm tra toàn bộ nguồn mẫu PCN.');
    } finally {
      setIsPreflighting(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 p-3 pb-20 md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị tài liệu PCN</p>
          <h1 className="mt-1 text-xl font-black text-slate-900">Biểu mẫu PCN</h1>
          <p className="mt-1 text-[11px] text-slate-500">Catalog QC4/QC9, fingerprint, placeholder và trạng thái sẵn sàng phát hành. Không dùng template DDT.</p>
        </div>
        <div className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[10px] font-bold text-slate-500 sm:flex"><LockKeyhole size={13} /> Asset private</div>
      </div>

      {!editable && <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800"><ShieldCheck size={14} className="mt-0.5 shrink-0" />Bạn có thể xem readiness; chỉ Admin PCN được phê duyệt, yêu cầu chú thích hoặc ngừng sử dụng template.</div>}

      <BlankDossierPackCatalog documentRequirements={documentRequirements?.length ? documentRequirements : runtimeDocumentRequirements} />

      <div className="mb-3 rounded-xl border border-indigo-200 bg-indigo-50/60 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.12em] text-indigo-700"><FolderOpen size={13} /> Nguồn mẫu thực tế</div>
            <p className="mt-1 text-[10px] leading-4 text-indigo-900/70">Nhập thư mục gốc PCN trên máy chạy server. Đường dẫn chỉ dùng cho Dry-run/Apply trong phiên này; server tự lấy đường dẫn tương đối từ catalog và không lưu đường dẫn tuyệt đối.</p>
          </div>
          <span className="rounded-md border border-indigo-200 bg-white px-2 py-1 text-[9px] font-bold text-indigo-700">Admin • Dry-run trước</span>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <label className="relative block min-w-0 flex-1"><FolderOpen size={14} className="absolute left-2.5 top-2 text-slate-400" /><input aria-label="Thư mục gốc nguồn mẫu PCN" value={sourceRoot} onChange={(event) => { setSourceRoot(event.target.value); setImportReport(undefined); setSourceCoverage(undefined); }} className="w-full rounded-md border border-indigo-200 bg-white px-2.5 py-1.5 pl-8 text-[11px] outline-none focus:border-indigo-400" placeholder="C:\\Users\\...\\Desktop\\PCN" /></label>
          {editable && <button type="button" disabled={isPreflighting || isImporting} onClick={() => void preflightAllSources()} className="inline-flex items-center justify-center gap-1 rounded-md border border-indigo-300 bg-indigo-600 px-3 py-1.5 text-[10px] font-black text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-50"><Search size={12} />{isPreflighting ? 'Đang kiểm tra...' : 'Kiểm tra toàn bộ nguồn'}</button>}
          {importReport && <div className="rounded-md border border-white bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-600">Đã kiểm tra: <span className="font-mono text-indigo-700">{importReport.templateId}</span></div>}
        </div>
        {importReport && <div className={`mt-2 rounded-lg border p-2 text-[10px] ${importReport.requiresAnnotation ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}><div className="flex flex-wrap items-center gap-2 font-bold"><span>{importReport.message}</span><span className="font-mono">{importReport.inspection.byteSize.toLocaleString('vi-VN')} bytes</span><span className="font-mono">SHA {importReport.inspection.sha256.slice(0, 16)}…</span></div><div className="mt-1 break-all font-mono text-[9px] opacity-80">{importReport.sourceRelativePath}</div>{importReport.inspection.placeholderKeys.length > 0 && <div className="mt-1">Placeholder: {importReport.inspection.placeholderKeys.join(', ')}</div>}</div>}
        {sourceCoverage && <div className="mt-2 rounded-lg border border-indigo-200 bg-white p-2.5 text-[10px] text-slate-700"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-indigo-800">Độ phủ nguồn mẫu • chỉ đọc</p><div className="flex flex-wrap gap-1 text-[9px] font-bold"><span className="rounded bg-emerald-50 px-1.5 py-1 text-emerald-700">{sourceCoverage.summary.readyToApply} sẵn sàng Apply</span><span className="rounded bg-blue-50 px-1.5 py-1 text-blue-700">{sourceCoverage.summary.found} đã có</span><span className="rounded bg-amber-50 px-1.5 py-1 text-amber-700">{sourceCoverage.summary.needsAnnotation} cần chú thích</span><span className="rounded bg-rose-50 px-1.5 py-1 text-rose-700">{sourceCoverage.summary.missing + sourceCoverage.summary.fingerprintMismatch} cần xử lý</span></div></div><div className="mt-2 grid gap-1.5 sm:grid-cols-2"><div className="rounded-md border border-emerald-100 bg-emerald-50/50 px-2 py-1.5"><p className="font-black text-emerald-800">QC4</p><p className="mt-0.5 text-[9px] text-emerald-700">{sourceCoverage.summary.byField.QC4.total - sourceCoverage.summary.byField.QC4.missing - sourceCoverage.summary.byField.QC4.fingerprintMismatch}/{sourceCoverage.summary.byField.QC4.total} nguồn khớp đường dẫn/fingerprint</p></div><div className="rounded-md border border-violet-100 bg-violet-50/50 px-2 py-1.5"><p className="font-black text-violet-800">QC9</p><p className="mt-0.5 text-[9px] text-violet-700">{sourceCoverage.summary.byField.QC9.total - sourceCoverage.summary.byField.QC9.missing - sourceCoverage.summary.byField.QC9.fingerprintMismatch}/{sourceCoverage.summary.byField.QC9.total} nguồn khớp đường dẫn/fingerprint</p></div></div><div className="mt-2 grid gap-1.5 md:grid-cols-2">{sourceCoverage.rows.map((row) => <a key={row.templateId} href={`#pcn-template-${row.templateId}`} className="rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 hover:border-indigo-200 hover:bg-indigo-50"><div className="flex items-start justify-between gap-2"><span className="min-w-0 truncate font-bold text-slate-700">{row.displayName}</span><span title={row.status} className={`shrink-0 rounded px-1.5 py-0.5 text-[8px] font-black ${row.status === 'READY_TO_APPLY' || row.status === 'FOUND' ? 'bg-emerald-100 text-emerald-700' : row.status === 'NEEDS_ANNOTATION' ? 'bg-amber-100 text-amber-700' : row.status === 'MISSING' ? 'bg-slate-200 text-slate-600' : 'bg-rose-100 text-rose-700'}`}>{sourceCoverageStatusLabel(row.status)}</span></div><p className="mt-0.5 truncate font-mono text-[8px] text-slate-400">{row.sourceRelativePath}</p><p className="mt-0.5 text-[9px] leading-3 text-slate-500">{row.message}{row.missingRequiredKeys.length > 0 ? ` • Thiếu: ${row.missingRequiredKeys.join(', ')}` : ''}</p></a>)}</div></div>}
      </div>

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_130px_180px_180px]">
        <label className="relative block"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 pl-8 text-[11px] outline-none focus:border-emerald-400" placeholder="Tìm mã, tên hoặc đường dẫn nguồn..." /></label>
        <select value={fieldFilter} onChange={(event) => setFieldFilter(event.target.value as typeof fieldFilter)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="ALL">QC4 + QC9</option><option value="QC4">Quy chuẩn 4</option><option value="QC9">Quy chuẩn 9</option></select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="ALL">Tất cả trạng thái</option>{Object.entries(STATUS_LABELS).map(([status, label]) => <option key={status} value={status}>{label}</option>)}</select>
        <select aria-label="Lọc trạng thái xác minh asset" value={assetFilter} onChange={(event) => setAssetFilter(event.target.value as typeof assetFilter)} className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"><option value="ALL">Tất cả asset</option><option value="VERIFIED">Asset đã xác minh</option><option value="NEEDS_REVIEW">Asset cần rà soát</option></select>
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-500"><span className="rounded-md border border-slate-200 bg-white px-2 py-1">{visibleTemplates.length}/{templates.length} biểu mẫu</span><span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-emerald-700">{templates.filter((template) => template.status === 'APPROVED').length} đã duyệt</span><span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-amber-700">{templates.filter((template) => template.status === 'NEEDS_ANNOTATION').length} cần chú thích</span><span className="rounded-md border border-cyan-200 bg-cyan-50 px-2 py-1 text-cyan-700">{templates.filter((template) => template.privateAssetVerified === true).length} asset đã xác minh</span><span className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-rose-700">{templates.filter((template) => template.privateAssetVerified !== true).length} asset cần rà soát</span></div>

      <div className="space-y-2">
        {visibleTemplates.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-[11px] text-slate-400">Không có template phù hợp bộ lọc.</div> : visibleTemplates.map((template) => {
          const approvalReadiness = getPcnTemplateApprovalReadiness(template, { availablePlaceholderKeys: template.placeholderKeys, requireVerifiedPrivateAsset: true });
          const requiredKeys = getPcnTemplateRequiredPlaceholderKeys(template);
          const missingRequiredKeys = requiredKeys.filter((key) => !template.placeholderKeys.includes(key));
          const annotationCoverage = getPcnTemplateAnnotationSuggestionCoverage(template, requiredKeys);
          const canApprove = approvalReadiness.ready;
          const annotationComplete = template.status === 'NEEDS_ANNOTATION' && template.format === 'DOCX' && missingRequiredKeys.length === 0 && Boolean(template.annotation?.mappings?.length);
          const assetVerificationIssue = template.privateAssetVerificationIssue || (!template.fileAssetId ? 'MISSING_ASSET' : 'UNVERIFIED');
          return <article id={`pcn-template-${template.id}`} key={template.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><FileText size={15} className="text-indigo-600" /><h2 className="text-xs font-black text-slate-800">{template.displayName}</h2><span className={`rounded-full border px-2 py-0.5 text-[9px] font-black ${STATUS_CLASSES[template.status]}`}>{STATUS_LABELS[template.status]}</span><span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-bold text-slate-500">{template.fieldCode}</span></div>
                <p className="mt-1 text-[10px] text-slate-500">{getPcnOfficialDocumentKindLabel(template.documentKind)}{template.method ? ` • ${template.method.replace('METHOD_', 'Phương thức ')}` : ''} • {template.format}</p>
                <p className="mt-1 break-all font-mono text-[9px] text-slate-400">{template.sourceFingerprint.sourceRelativePath}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-500"><span className="inline-flex items-center gap-1 rounded bg-slate-50 px-1.5 py-1"><Tag size={10} />{template.placeholderKeys.length}/{requiredKeys.length || '—'} placeholder</span><span className="rounded bg-slate-50 px-1.5 py-1">SHA {template.sourceFingerprint.sha256?.slice(0, 16) || 'chưa có'}…</span><span className="rounded bg-slate-50 px-1.5 py-1">{template.sourceFingerprint.byteSize.toLocaleString('vi-VN')} bytes</span></div>
                <div className={`mt-2 inline-flex flex-wrap items-center gap-1.5 rounded-md border px-2 py-1 text-[9px] font-bold ${template.privateAssetVerified === true ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`}><ShieldCheck size={11} />{template.privateAssetVerified === true ? 'Asset private đã xác minh' : <>{privateAssetVerificationLabel(assetVerificationIssue)} • Mã kiểm tra asset: <span className="font-mono">{assetVerificationIssue}</span></>}</div>
                <div className="mt-2 flex flex-wrap gap-1">{template.placeholderKeys.map((key) => <span key={key} className={`rounded border px-1.5 py-0.5 font-mono text-[8px] ${requiredKeys.includes(key) ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-slate-50 text-slate-500'}`}>{key}</span>)}</div>
                {!approvalReadiness.ready && <div className="mt-2 flex flex-wrap gap-1">{approvalReadiness.reasons.map((reason) => <span key={reason} className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">{reasonLabel(reason)}</span>)}</div>}
                {canApprove && template.status !== 'APPROVED' && <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 py-2 text-[9px] font-bold text-emerald-800">Đủ điều kiện để Admin phê duyệt riêng • không tự phê duyệt khi Apply.</div>}
                {template.status === 'NEEDS_ANNOTATION' && template.format === 'DOCX' && annotationCoverage.requiredKeys.length > 0 && <div className={`mt-2 rounded-lg border px-2.5 py-2 text-[9px] ${annotationCoverage.missingSuggestionKeys.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
                  <p className="font-bold">Gợi ý nhãn nguồn đã xác minh: {annotationCoverage.suggestedKeys.length}/{annotationCoverage.requiredKeys.length}</p>
                  {annotationCoverage.missingSuggestionKeys.length > 0 && <p className="mt-1 leading-4">Chưa có nhãn nguồn khảo sát: <span className="font-mono">{annotationCoverage.missingSuggestionKeys.join(', ')}</span>. Cần đối chiếu trực tiếp trong file trước khi chú thích.</p>}
                </div>}
                {annotationComplete && <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50/60 px-2.5 py-2 text-[9px] font-bold text-indigo-800">
                  <p>Đã chú thích đủ placeholder • chờ Admin khác phê duyệt.</p>
                  <p className="mt-1 font-normal text-indigo-700">Đã nối: {template.annotation?.mappings?.map((mapping) => mapping.sourceText).join(' • ')}</p>
                </div>}
              </div>
              <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {template.fileAssetId && <a href={getPcnFileUrl(template.fileAssetId)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[10px] font-bold text-indigo-700">Mở mẫu</a>}
                {editable && <><button type="button" disabled={isImporting} onClick={() => void importTemplate(template, 'DRY_RUN')} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-white px-2 py-1.5 text-[10px] font-black text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"><Search size={12} /> Dry-run</button>{importReport?.templateId === template.id && <button type="button" disabled={isImporting} onClick={() => void importTemplate(template, 'APPLY')} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><Upload size={12} /> Apply</button>}</>}
              </div>
              {editable && <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                {importReport?.templateId === template.id && importReport.canApprove && <span className="inline-flex items-center gap-1 rounded-md border border-emerald-100 bg-emerald-50/60 px-2 py-1.5 text-[9px] font-bold text-emerald-800">Apply xong, Admin khác phê duyệt</span>}
                {importReport?.templateId === template.id && importReport.requiresAnnotation && <label className="inline-flex items-center gap-1 rounded-md border border-amber-100 bg-amber-50/60 px-2 py-1.5 text-[9px] font-bold text-amber-800"><input type="checkbox" checked={allowAnnotationOnApply} onChange={(event) => setAllowAnnotationOnApply(event.target.checked)} className="accent-amber-600" /> Lưu tham chiếu cần chú thích</label>}
                {template.status === 'NEEDS_ANNOTATION' && template.format === 'DOCX' && missingRequiredKeys.length > 0 && <button type="button" disabled={busyId === template.id || isAnnotating} onClick={() => openAnnotation(template)} className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[10px] font-black text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40">Chú thích DOCX</button>}
                {template.status !== 'APPROVED' && template.status !== 'RETIRED' && <button type="button" disabled={!canApprove || busyId === template.id} onClick={() => void review(template, 'APPROVE')} className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[10px] font-black text-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"><CheckCircle2 size={12} /> Phê duyệt</button>}
                {template.status === 'APPROVED' && <button type="button" disabled={busyId === template.id} onClick={() => void review(template, 'REQUEST_ANNOTATION')} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700 disabled:opacity-40">Yêu cầu chú thích</button>}
                {template.status !== 'RETIRED' && <button type="button" disabled={busyId === template.id} onClick={() => void review(template, 'RETIRE')} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-bold text-slate-600 disabled:opacity-40"><Archive size={12} /> Ngừng dùng</button>}
              </div>}
            </div>
          </article>;
        })}
      </div>

      {annotationTemplate && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3" role="dialog" aria-modal="true" aria-label="Chú thích template DOCX">
        <div className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:p-5">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.16em] text-indigo-600">Chú thích có kiểm soát</p><h2 className="mt-1 text-base font-black text-slate-900">{annotationTemplate.displayName}</h2><p className="mt-1 text-[11px] leading-relaxed text-slate-500">Nhãn khảo sát được điền gợi ý nếu đã biết từ bộ mẫu PCN. Hãy đối chiếu lại với file nguồn; server sẽ tìm nhãn duy nhất và chèn placeholder vào vùng giá trị đang trống.</p></div>
            <button type="button" onClick={() => { if (!isAnnotating) { setAnnotationTemplate(undefined); setAnnotationMappings([]); } }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Đóng"><span className="text-lg leading-none">×</span></button>
          </div>
          <form onSubmit={submitAnnotation} className="mt-4 space-y-3">
            {annotationMappings.map((mapping, index) => <div key={mapping.key} className="grid gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[140px_minmax(0,1fr)_90px] md:items-end">
              <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Placeholder</span><code className="block rounded-md border border-indigo-100 bg-indigo-50 px-2.5 py-2 text-[10px] font-bold text-indigo-700">[[{mapping.key}]]</code></label>
              <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Nhãn nguồn trong mẫu</span><input required value={mapping.sourceText} onChange={(event) => setAnnotationMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, sourceText: event.target.value } : item))} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" placeholder="Ví dụ: Kiểu loại" /></label>
              <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Lần xuất hiện</span><input type="number" min={1} value={mapping.occurrence ?? ''} onChange={(event) => { const value = event.target.value; setAnnotationMappings((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...(value ? { occurrence: Number(value) } : { occurrence: undefined }) } : item)); }} className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-2 text-[11px] outline-none focus:border-indigo-400" placeholder="Tự tìm duy nhất" /></label>
            </div>)}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
              <button type="button" onClick={() => { setAnnotationTemplate(undefined); setAnnotationMappings([]); }} disabled={isAnnotating} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[10px] font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-50">Hủy</button>
              <button type="submit" disabled={isAnnotating} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-[10px] font-black text-white hover:bg-indigo-700 disabled:cursor-wait disabled:bg-slate-300">{isAnnotating && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />} {isAnnotating ? 'Đang tạo DOCX...' : 'Tạo bản DOCX chú thích'}</button>
            </div>
          </form>
        </div>
      </div>}
    </div>
  );
}

export default PcnTemplateManagementView;
