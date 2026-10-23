'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  FileEdit,
  FileText,
  Filter,
  FolderOpen,
  Layers,
  PenTool,
  RefreshCw,
  Search,
  Sparkles,
  Upload,
} from 'lucide-react';
import { toast } from 'sonner';

import type {
  CertificationDossier,
  CertificationProposal,
  DepartmentScope,
  OutboundLabRequest,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnDraftFormKind,
  PcnDraftWorkspace,
  PcnSampleLot,
  PcnSampleRoute,
  PcnTemplateDefinition,
  PcnTemplateReviewAction,
  PcnUserAccount,
  ReturnedTestResult,
} from '../types';
import { getPcnFileUrl } from '../utils/pcnFileApi';
import { fetchPcnDraftWorkspaces } from '../utils/pcnDraftApi';
import { fetchPgdDraftWorkspaces } from '../utils/pgdApi';
import { formatDateTimeDdMmYyyy } from '../utils/formatter';
import { getPcnOperationalTemplates } from '../utils/pcnOperationalTemplateCatalog';
import { getPgdDocumentTemplates, type PgdDocumentTemplate, type PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import type { PgdDraftWorkspace, PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import PcnDraftingWorkspaceView from './PcnDraftingWorkspaceView';
import PgdDraftingWorkspaceView from './PgdDraftingWorkspaceView';
import { PcnTemplateSettingsModal } from './PcnTemplateSettingsModal';

export type UnifiedDraftingTab = 'drafting' | 'docx' | 'drafts';

export type PgdcnUnifiedDraftingViewProps = {
  currentUser: PcnUserAccount;
  scopes: DepartmentScope[];
  // PCN store data & actions
  pcnProposals: CertificationProposal[];
  pcnDossiers: CertificationDossier[];
  pcnTemplates: PcnTemplateDefinition[];
  pcnRequirements?: PcnDocumentRequirement[];
  pcnDocuments?: PcnDossierDocument[];
  pcnSampleLots?: PcnSampleLot[];
  pcnSampleRoutes?: PcnSampleRoute[];
  pcnLabRequests?: OutboundLabRequest[];
  pcnReturnedResults?: ReturnedTestResult[];
  onUploadPcnTemplate: (templateId: string, file: File) => Promise<unknown>;
  onReviewPcnTemplate: (templateId: string, action: PcnTemplateReviewAction, reason?: string) => Promise<unknown>;
  // PGD store data & actions
  pgdRequests: PgdInspectionRequest[];
  pgdTemplates: PgdDocumentTemplate[];
  pgdDocuments: PgdGeneratedDocument[];
  canMutatePgd: boolean;
  onOpenPgdSettings?: () => void;
  // Initial navigation params
  initialDomain?: 'PGD' | 'PCN';
  initialTab?: UnifiedDraftingTab;
  initialPcnDossierId?: string;
  initialPcnRequirementId?: string;
  initialPcnNodeId?: string;
  initialPcnKind?: PcnDraftFormKind;
  initialPcnReturnTo?: string;
  initialPgdRequestId?: string;
  initialPgdRequirementCode?: string;
  initialPgdTemplateKind?: PgdDocumentTemplateKind;
  initialPgdTemplateId?: string;
  initialPgdReturnTo?: string;
};

type UnifiedDocxItem = {
  id: string;
  code: string;
  name: string;
  domain: 'PGD' | 'PCN' | 'SHARED';
  sourceType: 'CATALOG' | 'DATABASE';
  sourceLabel: string;
  scopeLabel: string;
  version: string;
  updatedAt: string;
  status: string;
  statusClass: string;
  canDraft: boolean;
  canDraftReason?: string;
  pgdKind?: PgdDocumentTemplateKind;
  pgdTemplateId?: string;
  pcnKind?: PcnDraftFormKind;
  downloadUrl?: string;
  fileAssetId?: string;
  rawPcnTemplate?: PcnTemplateDefinition;
};

type UnifiedDraftItem = {
  id: string;
  title: string;
  domain: 'PGD' | 'PCN';
  relatedRecordLabel: string;
  relatedRecordId: string;
  templateLabel: string;
  updatedAt: string;
  rawPcnDraft?: PcnDraftWorkspace;
  rawPgdDraft?: PgdDraftWorkspace;
  outputs?: Array<{ id: string; format: string; url?: string; fileName?: string }>;
};

export default function PgdcnUnifiedDraftingView({
  currentUser,
  scopes,
  pcnProposals,
  pcnDossiers,
  pcnTemplates,
  pcnRequirements,
  pcnDocuments,
  pcnSampleLots,
  pcnSampleRoutes,
  pcnLabRequests,
  pcnReturnedResults,
  onUploadPcnTemplate,
  onReviewPcnTemplate,
  pgdRequests,
  pgdTemplates,
  pgdDocuments,
  canMutatePgd,
  onOpenPgdSettings,
  initialDomain,
  initialTab = 'drafting',
  initialPcnDossierId,
  initialPcnRequirementId,
  initialPcnNodeId,
  initialPcnKind,
  initialPcnReturnTo,
  initialPgdRequestId,
  initialPgdRequirementCode,
  initialPgdTemplateKind,
  initialPgdTemplateId,
  initialPgdReturnTo,
}: PgdcnUnifiedDraftingViewProps) {
  const hasPcn = scopes.includes('PCN');
  const hasPgd = scopes.includes('PGD');

  // Determine initial domain based on props / context / scopes
  const defaultDomain: 'PGD' | 'PCN' = useMemo(() => {
    if (initialDomain && (initialDomain === 'PGD' ? hasPgd : hasPcn)) return initialDomain;
    if (initialPcnDossierId || initialPcnKind) return 'PCN';
    if (initialPgdRequestId || initialPgdRequirementCode || initialPgdTemplateKind) return 'PGD';
    if (hasPgd && !hasPcn) return 'PGD';
    if (hasPcn && !hasPgd) return 'PCN';
    return hasPgd ? 'PGD' : 'PCN';
  }, [hasPcn, hasPgd, initialDomain, initialPcnDossierId, initialPcnKind, initialPgdRequestId, initialPgdRequirementCode, initialPgdTemplateKind]);

  const [activeDomain, setActiveDomain] = useState<'PGD' | 'PCN'>(defaultDomain);
  const [activeTab, setActiveTab] = useState<UnifiedDraftingTab>(initialTab);

  // Selection states for switching from templates / drafts to drafting workspace
  const [selectedPcnDraftId, setSelectedPcnDraftId] = useState<string | undefined>();
  const [selectedPcnDossierId, setSelectedPcnDossierId] = useState<string | undefined>(initialPcnDossierId);
  const [selectedPcnRequirementId, setSelectedPcnRequirementId] = useState<string | undefined>(initialPcnRequirementId);
  const [selectedPcnKind, setSelectedPcnKind] = useState<PcnDraftFormKind | undefined>(initialPcnKind);

  const [selectedPgdDraftId, setSelectedPgdDraftId] = useState<string | undefined>();
  const [selectedPgdRequestId, setSelectedPgdRequestId] = useState<string | undefined>(initialPgdRequestId);
  const [selectedPgdRequirementCode, setSelectedPgdRequirementCode] = useState<string | undefined>(initialPgdRequirementCode);
  const [selectedPgdTemplateKind, setSelectedPgdTemplateKind] = useState<PgdDocumentTemplateKind | undefined>(initialPgdTemplateKind);
  const [selectedPgdTemplateId, setSelectedPgdTemplateId] = useState<string | undefined>(initialPgdTemplateId);

  // Tab DOCX: Search & Status Filters (domain strictly follows activeDomain)
  const [docxSearch, setDocxSearch] = useState('');
  const [docxStatusFilter, setDocxStatusFilter] = useState<string>('ALL');

  // Tab Drafts: Data & Search (domain strictly follows activeDomain)
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [pcnDrafts, setPcnDrafts] = useState<PcnDraftWorkspace[]>([]);
  const [pgdDrafts, setPgdDrafts] = useState<PgdDraftWorkspace[]>([]);
  const [draftSearch, setDraftSearch] = useState('');

  // Modal for editing/uploading PCN template revision
  const [editingPcnTemplate, setEditingPcnTemplate] = useState<PcnTemplateDefinition | null>(null);

  // Switch domain handler
  const handleDomainChange = (nextDomain: 'PGD' | 'PCN') => {
    setActiveDomain(nextDomain);
  };

  // Fetch drafts with mineOnly opt-in and strict error reporting
  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const [pcnResult, pgdResult] = await Promise.all([
        hasPcn ? fetchPcnDraftWorkspaces({ mineOnly: true }) : Promise.resolve([]),
        hasPgd ? fetchPgdDraftWorkspaces(undefined, { mineOnly: true }) : Promise.resolve([]),
      ]);
      setPcnDrafts(pcnResult);
      setPgdDrafts(pgdResult);
    } catch (error: any) {
      toast.error(error?.message ? `Không thể nạp danh sách bản nháp: ${error.message}` : 'Không thể nạp danh sách bản nháp');
    } finally {
      setDraftsLoading(false);
    }
  }, [hasPcn, hasPgd]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  // Unified DOCX items with real metadata and proper source distinction
  const unifiedDocxList = useMemo<UnifiedDocxItem[]>(() => {
    const items: UnifiedDocxItem[] = [];

    // PGD Templates
    if (hasPgd) {
      const pgdSource = (pgdTemplates && pgdTemplates.length > 0) ? pgdTemplates : getPgdDocumentTemplates();
      for (const t of pgdSource) {
        const isDb = Boolean((t as any).isPersisted || (t as any).storageScope);
        const versionStr = t.version ? `v${t.version}` : 'Chưa xác định';
        const isRetired = t.status === 'RETIRED';
        const canDraft = Boolean(t.kind && t.active && !isRetired);
        items.push({
          id: `pgd-${t.id || t.code}`,
          code: t.code,
          name: t.name || t.sourceFormLabel || t.code,
          domain: 'PGD',
          sourceType: isDb ? 'DATABASE' : 'CATALOG',
          sourceLabel: isDb ? 'Mẫu tải lên (CSDL)' : 'Catalog hệ thống',
          scopeLabel: (t.productGroups || []).join(', ') || 'Chung',
          version: versionStr,
          updatedAt: (t as any).updatedAt ? formatDateTimeDdMmYyyy((t as any).updatedAt) : 'Chưa xác định',
          status: t.status === 'PUBLISHED' ? 'Đã ban hành' : isRetired ? 'Hết hiệu lực' : 'Bản nháp',
          statusClass: t.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isRetired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200',
          canDraft,
          canDraftReason: canDraft ? undefined : isRetired ? 'Biểu mẫu đã ngừng áp dụng' : 'Biểu mẫu chưa được kích hoạt',
          pgdKind: t.kind,
          pgdTemplateId: t.id,
          downloadUrl: t.id ? `/api/pgd/document-templates/${encodeURIComponent(t.id)}/source` : undefined,
        });
      }
    }

    // PCN Templates
    if (hasPcn) {
      const pcnOperational = getPcnOperationalTemplates();
      const pcnSource = (pcnTemplates && pcnTemplates.length > 0) ? pcnTemplates : [];
      const seenKinds = new Set<string>();

      for (const t of pcnOperational) {
        seenKinds.add(t.generationKind);
        items.push({
          id: `pcn-cat-${t.id}`,
          code: t.id,
          name: t.displayName || t.id,
          domain: 'PCN',
          sourceType: 'CATALOG',
          sourceLabel: 'Catalog hệ thống',
          scopeLabel: (t.fieldCodes || []).join(', ') || 'Chung',
          version: 'Chưa xác định',
          updatedAt: 'Chưa xác định',
          status: t.status === 'OFFICIAL_CANDIDATE' ? 'Đã ban hành' : 'Bản nháp',
          statusClass: t.status === 'OFFICIAL_CANDIDATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
          canDraft: true,
          pcnKind: t.generationKind as unknown as PcnDraftFormKind,
        });
      }

      for (const t of pcnSource) {
        if (t.id && !seenKinds.has(t.id)) {
          const isRetired = t.status === 'RETIRED';
          const versionStr = t.variant ? `v${t.variant}` : 'Chưa xác định';
          const updatedDateStr = t.importedAt ? formatDateTimeDdMmYyyy(t.importedAt) : 'Chưa xác định';

          items.push({
            id: `pcn-db-${t.id}`,
            code: t.id,
            name: t.displayName || t.id,
            domain: 'PCN',
            sourceType: 'DATABASE',
            sourceLabel: 'Mẫu tải lên (CSDL)',
            scopeLabel: t.fieldCode || 'Chung',
            version: versionStr,
            updatedAt: updatedDateStr,
            status: t.status === 'APPROVED' ? 'Đã duyệt' : isRetired ? 'Ngừng dùng' : 'Bản nháp',
            statusClass: t.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : isRetired ? 'bg-red-50 text-red-700 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200',
            canDraft: false,
            canDraftReason: 'Mẫu tải lên (CSDL) phục vụ lưu trữ và xuất văn bản qua pipeline DOCX, chưa hỗ trợ soạn thảo trực tiếp trên trình soạn thảo web.',
            pcnKind: undefined,
            fileAssetId: t.fileAssetId,
            downloadUrl: t.fileAssetId ? getPcnFileUrl(t.fileAssetId, { download: true }) : undefined,
            rawPcnTemplate: t,
          });
        }
      }
    }

    return items;
  }, [hasPgd, hasPcn, pgdTemplates, pcnTemplates]);

  // DOCX items scoped to activeDomain (plus any truly SHARED templates)
  const currentDomainDocxList = useMemo(() => {
    return unifiedDocxList.filter((item) => item.domain === activeDomain || item.domain === 'SHARED');
  }, [unifiedDocxList, activeDomain]);

  // Filtered DOCX items matching search and status filter
  const filteredDocxList = useMemo(() => {
    return currentDomainDocxList.filter((item) => {
      if (docxStatusFilter !== 'ALL' && item.status !== docxStatusFilter) {
        return false;
      }
      if (docxSearch.trim()) {
        const q = docxSearch.toLowerCase();
        const match = item.code.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          item.scopeLabel.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [currentDomainDocxList, docxStatusFilter, docxSearch]);

  // Unified Draft items
  const unifiedDraftList = useMemo<UnifiedDraftItem[]>(() => {
    const items: UnifiedDraftItem[] = [];

    // PCN Drafts
    for (const d of pcnDrafts) {
      const dossier = pcnDossiers.find((item) => item.id === d.sourceDossierId);
      const proposal = pcnProposals.find((item) => item.id === d.sourceProposalId);
      const relatedLabel = dossier?.dossierCode || proposal?.proposalCode || d.sourceDossierId || 'Chưa liên kết hồ sơ';

      items.push({
        id: `pcn-${d.id}`,
        title: d.title || `Bản nháp ${d.formKind || 'PCN'}`,
        domain: 'PCN',
        relatedRecordLabel: relatedLabel,
        relatedRecordId: d.sourceDossierId || '',
        templateLabel: d.formKind || 'Biểu mẫu PCN',
        updatedAt: d.updatedAt ? formatDateTimeDdMmYyyy(d.updatedAt) : 'Chưa lưu',
        rawPcnDraft: d,
        outputs: (d.outputs || []).map((out) => ({
          id: out.id,
          format: out.format,
          url: out.fileAssetId ? getPcnFileUrl(out.fileAssetId, { download: true }) : undefined,
          fileName: out.fileName,
        })),
      });
    }

    // PGD Drafts
    for (const d of pgdDrafts) {
      const request = pgdRequests.find((item) => item.id === d.requestId);
      const relatedLabel = request?.requestCode || d.requestId || 'Chưa liên kết PYC';

      items.push({
        id: `pgd-${d.id}`,
        title: d.title || `Bản nháp ${d.templateId || 'PGD'}`,
        domain: 'PGD',
        relatedRecordLabel: relatedLabel,
        relatedRecordId: d.requestId || '',
        templateLabel: d.templateId || d.requirementCode || 'Biểu mẫu PGD',
        updatedAt: d.updatedAt ? formatDateTimeDdMmYyyy(d.updatedAt) : 'Chưa lưu',
        rawPgdDraft: d,
      });
    }

    return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [pcnDrafts, pgdDrafts, pcnDossiers, pcnProposals, pgdRequests]);

  // Draft items scoped to activeDomain
  const currentDomainDraftList = useMemo(() => {
    return unifiedDraftList.filter((item) => item.domain === activeDomain);
  }, [unifiedDraftList, activeDomain]);

  // Filtered Draft items matching search
  const filteredDraftList = useMemo(() => {
    return currentDomainDraftList.filter((item) => {
      if (draftSearch.trim()) {
        const q = draftSearch.toLowerCase();
        const match = item.title.toLowerCase().includes(q) ||
          item.relatedRecordLabel.toLowerCase().includes(q) ||
          item.templateLabel.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [currentDomainDraftList, draftSearch]);

  // Handler: "Sử dụng để soạn thảo" from DOCX Tab
  const handleUseTemplate = (item: UnifiedDocxItem) => {
    if (!item.canDraft) {
      toast.error(item.canDraftReason || `Biểu mẫu ${item.code} chưa hỗ trợ soạn thảo trực tiếp.`);
      return;
    }
    if (item.domain === 'PCN' || (item.domain === 'SHARED' && activeDomain === 'PCN')) {
      setActiveDomain('PCN');
      if (item.pcnKind) setSelectedPcnKind(item.pcnKind);
    } else {
      setActiveDomain('PGD');
      if (item.pgdKind) setSelectedPgdTemplateKind(item.pgdKind);
      if (item.pgdTemplateId) setSelectedPgdTemplateId(item.pgdTemplateId);
    }
    setActiveTab('drafting');
    toast.info(`Đang chuyển sang biểu mẫu "${item.name || item.code}"...`);
  };

  // Handler: "Tiếp tục soạn" from Drafts Tab - opens specific draft by ID
  const handleContinueDraft = (item: UnifiedDraftItem) => {
    if (item.domain === 'PCN') {
      if (!item.rawPcnDraft || !item.rawPcnDraft.id) {
        toast.error('Không tìm thấy dữ liệu bản nháp Chứng nhận để mở.');
        return;
      }
      setActiveDomain('PCN');
      setSelectedPcnDraftId(item.rawPcnDraft.id);
      if (item.rawPcnDraft.sourceDossierId) {
        setSelectedPcnDossierId(item.rawPcnDraft.sourceDossierId);
      }
      if (item.rawPcnDraft.formKind) {
        setSelectedPcnKind(item.rawPcnDraft.formKind);
      }
      setActiveTab('drafting');
      toast.info(`Đang mở bản nháp "${item.title}"...`);
    } else if (item.domain === 'PGD') {
      if (!item.rawPgdDraft || !item.rawPgdDraft.id) {
        toast.error('Không tìm thấy dữ liệu bản nháp Giám định để mở.');
        return;
      }
      setActiveDomain('PGD');
      setSelectedPgdDraftId(item.rawPgdDraft.id);
      if (item.rawPgdDraft.requestId) {
        setSelectedPgdRequestId(item.rawPgdDraft.requestId);
      }
      if (item.rawPgdDraft.requirementCode) {
        setSelectedPgdRequirementCode(item.rawPgdDraft.requirementCode);
      }
      if (item.rawPgdDraft.templateKind) {
        setSelectedPgdTemplateKind(item.rawPgdDraft.templateKind as PgdDocumentTemplateKind);
      }
      if (item.rawPgdDraft.templateId) {
        setSelectedPgdTemplateId(item.rawPgdDraft.templateId);
      }
      setActiveTab('drafting');
      toast.info(`Đang mở bản nháp "${item.title}"...`);
    } else {
      toast.error('Không xác định được phân hệ của bản nháp.');
    }
  };

  return (
    <div
      data-testid="pgdcn-unified-drafting-workspace"
      className="flex min-h-full flex-col bg-slate-50 text-slate-800"
    >
      {/* Top Banner & Controls Header */}
      <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 shadow-3xs lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
                <FileEdit size={18} />
              </span>
              <div>
                <h1 className="truncate text-base font-bold text-slate-900">
                  Hỗ trợ soạn thảo văn bản
                </h1>
                <p className="text-xs text-slate-500">
                  Môi trường tạo lập tài liệu, quản lý biểu mẫu DOCX và lưu trữ bản nháp dùng chung
                </p>
              </div>
            </div>
          </div>

          {/* Segmented Control: Giám định (PGD) | Chứng nhận (PCN) */}
          {hasPcn && hasPgd && (
            <div
              role="radiogroup"
              aria-label="Chọn phân hệ nghiệp vụ"
              className="inline-flex shrink-0 items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5"
            >
              <button
                type="button"
                role="radio"
                aria-checked={activeDomain === 'PGD'}
                onClick={() => handleDomainChange('PGD')}
                className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all ${
                  activeDomain === 'PGD'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-blue-400" />
                <span>Giám định (PGD)</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={activeDomain === 'PCN'}
                onClick={() => handleDomainChange('PCN')}
                className={`flex min-h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-all ${
                  activeDomain === 'PCN'
                    ? 'bg-emerald-700 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                <span>Chứng nhận (PCN)</span>
              </button>
            </div>
          )}
        </div>

        {/* 3 Main Tabs: Soạn thảo | Danh sách biểu mẫu DOCX | Bản nháp của tôi */}
        <nav
          aria-label="Phân loại tác vụ soạn thảo"
          className="mt-3 flex gap-2 border-t border-slate-100 pt-2"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'drafting'}
            onClick={() => setActiveTab('drafting')}
            className={`flex min-h-10 items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
              activeTab === 'drafting'
                ? activeDomain === 'PGD'
                  ? 'border-b-2 border-blue-600 bg-blue-50/70 text-blue-800'
                  : 'border-b-2 border-emerald-700 bg-emerald-50/70 text-emerald-800'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <PenTool size={14} />
            <span>Soạn thảo</span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'docx'}
            onClick={() => setActiveTab('docx')}
            className={`flex min-h-10 items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
              activeTab === 'docx'
                ? activeDomain === 'PGD'
                  ? 'border-b-2 border-blue-600 bg-blue-50/70 text-blue-800'
                  : 'border-b-2 border-emerald-700 bg-emerald-50/70 text-emerald-800'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <BookOpen size={14} />
            <span>Danh sách biểu mẫu DOCX</span>
            <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
              {currentDomainDocxList.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'drafts'}
            onClick={() => setActiveTab('drafts')}
            className={`flex min-h-10 items-center gap-2 rounded-md px-3.5 text-xs font-semibold transition-colors ${
              activeTab === 'drafts'
                ? activeDomain === 'PGD'
                  ? 'border-b-2 border-blue-600 bg-blue-50/70 text-blue-800'
                  : 'border-b-2 border-emerald-700 bg-emerald-50/70 text-emerald-800'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Clock size={14} />
            <span>Bản nháp của tôi</span>
            <span className="ml-1 rounded-full bg-slate-200 px-1.5 py-0.2 text-[10px] font-bold text-slate-700">
              {currentDomainDraftList.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {/* TAB 1: SOẠN THẢO (Both child workspaces kept permanently mounted to preserve unsaved state across tab & domain switches) */}
        <div className={activeTab === 'drafting' ? 'block' : 'hidden'}>
          {hasPcn && (
            <div className={activeDomain === 'PCN' ? 'p-3 lg:p-4' : 'hidden'}>
              <PcnDraftingWorkspaceView
                proposals={pcnProposals}
                dossiers={pcnDossiers}
                templates={pcnTemplates}
                documentRequirements={pcnRequirements}
                dossierDocuments={pcnDocuments}
                onUploadTemplate={onUploadPcnTemplate}
                onReviewTemplate={onReviewPcnTemplate}
                sampleLots={pcnSampleLots}
                sampleRoutes={pcnSampleRoutes}
                labRequests={pcnLabRequests}
                returnedResults={pcnReturnedResults}
                initialDraftId={selectedPcnDraftId}
                initialDossierId={selectedPcnDossierId || initialPcnDossierId}
                initialRequirementId={selectedPcnRequirementId || initialPcnRequirementId}
                initialNodeId={initialPcnNodeId}
                initialKind={selectedPcnKind || initialPcnKind}
                initialReturnTo={initialPcnReturnTo}
                onToast={(message, type) => (type === 'error' ? toast.error(message) : toast.success(message))}
              />
            </div>
          )}

          {hasPgd && (
            <div className={activeDomain === 'PGD' ? 'p-3 lg:p-4' : 'hidden'}>
              <PgdDraftingWorkspaceView
                templates={pgdTemplates}
                documents={pgdDocuments}
                canMutate={canMutatePgd}
                initialDraftId={selectedPgdDraftId}
                initialRequestId={selectedPgdRequestId || initialPgdRequestId}
                initialRequirementCode={selectedPgdRequirementCode || initialPgdRequirementCode}
                initialTemplateKind={selectedPgdTemplateKind || initialPgdTemplateKind}
                initialTemplateId={selectedPgdTemplateId}
                initialReturnTo={initialPgdReturnTo}
                onOpenSettings={onOpenPgdSettings}
                onToast={(message, type) => (type === 'error' ? toast.error(message) : toast.success(message))}
              />
            </div>
          )}

          {!hasPcn && !hasPgd && (
            <div className="p-8 text-center text-sm text-slate-500">
              Bạn không có quyền truy cập nghiệp vụ này.
            </div>
          )}
        </div>

        {/* TAB 2: DANH SÁCH BIỂU MẪU DOCX */}
        <div className={activeTab === 'docx' ? 'block' : 'hidden'}>
          <div className="space-y-4 p-4 lg:p-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-3xs sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={docxSearch}
                  onChange={(e) => setDocxSearch(e.target.value)}
                  placeholder="Tìm kiếm biểu mẫu theo mã, tên hoặc nhóm sản phẩm..."
                  className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={docxStatusFilter}
                  onChange={(e) => setDocxStatusFilter(e.target.value)}
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Đã ban hành">Đã ban hành</option>
                  <option value="Đã duyệt">Đã duyệt</option>
                  <option value="Bản nháp">Bản nháp</option>
                  <option value="Hết hiệu lực">Hết hiệu lực / Ngừng dùng</option>
                </select>
              </div>
            </div>

            {/* Template List Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-3xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Mã biểu mẫu</th>
                      <th className="px-4 py-3">Tên biểu mẫu & Nguồn</th>
                      <th className="px-4 py-3">Nghiệp vụ</th>
                      <th className="px-4 py-3">Nhóm / Lĩnh vực</th>
                      <th className="px-4 py-3">Phiên bản</th>
                      <th className="px-4 py-3">Trạng thái</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDocxList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          Không tìm thấy biểu mẫu DOCX nào phù hợp với bộ lọc.
                        </td>
                      </tr>
                    ) : (
                      filteredDocxList.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-mono font-bold text-slate-800">
                            {item.code}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{item.name}</div>
                            <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-slate-400">
                              <span className="font-semibold text-slate-500">{item.sourceLabel}</span>
                              {item.updatedAt !== 'Chưa xác định' && (
                                <>
                                  <span>·</span>
                                  <span>Cập nhật: {item.updatedAt}</span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                item.domain === 'PGD'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : item.domain === 'PCN'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {item.domain === 'PGD' ? 'Giám định' : item.domain === 'PCN' ? 'Chứng nhận' : 'Dùng chung'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.scopeLabel}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            {item.version}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-bold ${item.statusClass}`}
                            >
                              {item.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              {item.downloadUrl && (
                                <a
                                  href={item.downloadUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition-colors hover:bg-slate-50"
                                  title="Tải về biểu mẫu"
                                >
                                  <Download size={12} />
                                  <span className="hidden sm:inline">Tải về</span>
                                </a>
                              )}
                              {item.rawPcnTemplate && hasPcn && (
                                <button
                                  type="button"
                                  onClick={() => setEditingPcnTemplate(item.rawPcnTemplate || null)}
                                  className="inline-flex min-h-8 items-center gap-1 rounded-md border border-emerald-200 bg-white px-2 py-1 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                                  title="Tải bản mới / Cập nhật mẫu này"
                                >
                                  <Upload size={12} />
                                  <span className="hidden sm:inline">Cập nhật</span>
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={!item.canDraft}
                                onClick={() => handleUseTemplate(item)}
                                className={`inline-flex min-h-8 items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors shadow-3xs ${
                                  item.canDraft
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'cursor-not-allowed bg-slate-100 text-slate-400'
                                }`}
                                title={item.canDraft ? `Sử dụng biểu mẫu ${item.code}` : item.canDraftReason || 'Biểu mẫu chưa hỗ trợ soạn trực tiếp'}
                              >
                                <PenTool size={12} />
                                <span>Sử dụng</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 3: BẢN NHÁP CỦA TÔI */}
        <div className={activeTab === 'drafts' ? 'block' : 'hidden'}>
          <div className="space-y-4 p-4 lg:p-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-3xs sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={draftSearch}
                  onChange={(e) => setDraftSearch(e.target.value)}
                  placeholder="Tìm kiếm bản nháp theo tiêu đề, mã hồ sơ hoặc biểu mẫu..."
                  className="min-h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void loadDrafts()}
                  disabled={draftsLoading}
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                  title="Tải lại danh sách bản nháp"
                >
                  <RefreshCw size={13} className={draftsLoading ? 'animate-spin' : ''} />
                  <span>Làm mới</span>
                </button>
              </div>
            </div>

            {/* Drafts List Table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-3xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Tiêu đề bản nháp</th>
                      <th className="px-4 py-3">Nghiệp vụ</th>
                      <th className="px-4 py-3">Hồ sơ liên quan</th>
                      <th className="px-4 py-3">Loại tài liệu</th>
                      <th className="px-4 py-3">Thời gian lưu</th>
                      <th className="px-4 py-3">Tệp đã sinh</th>
                      <th className="px-4 py-3 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDraftList.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                          {draftsLoading ? 'Đang tải danh sách bản nháp...' : 'Chưa có bản nháp nào được lưu.'}
                        </td>
                      </tr>
                    ) : (
                      filteredDraftList.map((item) => (
                        <tr key={item.id} className="transition-colors hover:bg-slate-50/80">
                          <td className="px-4 py-3 font-bold text-slate-900">
                            {item.title}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold ${
                                item.domain === 'PGD'
                                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              }`}
                            >
                              {item.domain === 'PGD' ? 'Giám định' : 'Chứng nhận'}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-700">
                            {item.relatedRecordLabel}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {item.templateLabel}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {item.updatedAt}
                          </td>
                          <td className="px-4 py-3">
                            {item.outputs && item.outputs.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {item.outputs.map((out) => out.url ? (
                                  <a
                                    key={out.id}
                                    href={out.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50"
                                  >
                                    <Download size={10} />
                                    <span>{out.format}</span>
                                  </a>
                                ) : (
                                  <span
                                    key={out.id}
                                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400"
                                    title="Tệp chưa có liên kết tải trực tiếp"
                                  >
                                    {out.format}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">Chưa sinh file</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleContinueDraft(item)}
                              className="inline-flex min-h-8 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 shadow-3xs"
                              title="Tiếp tục chỉnh sửa bản nháp này"
                            >
                              <FolderOpen size={12} />
                              <span>Tiếp tục soạn</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PCN Template Revision / Upload Modal */}
      {editingPcnTemplate && (
        <PcnTemplateSettingsModal
          template={editingPcnTemplate}
          onUploadTemplate={onUploadPcnTemplate}
          onClose={() => setEditingPcnTemplate(null)}
        />
      )}
    </div>
  );
}
