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
import { getPcnOperationalTemplates, type PcnOperationalTemplateDefinition } from '../utils/pcnOperationalTemplateCatalog';
import { getPgdDocumentTemplates, type PgdDocumentTemplate, type PgdDocumentTemplateKind } from '../utils/pgdDocumentTemplates';
import type { PgdDraftWorkspace, PgdGeneratedDocument, PgdInspectionRequest } from '../utils/pgdDomain';
import PcnDraftingWorkspaceView from './PcnDraftingWorkspaceView';
import PgdDraftingWorkspaceView from './PgdDraftingWorkspaceView';

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
  initialPgdReturnTo?: string;
};

type UnifiedDocxItem = {
  id: string;
  code: string;
  name: string;
  domain: 'PGD' | 'PCN' | 'SHARED';
  scopeLabel: string;
  version: string;
  updatedAt: string;
  status: string;
  statusClass: string;
  pgdKind?: PgdDocumentTemplateKind;
  pcnKind?: PcnDraftFormKind;
  downloadUrl?: string;
  fileAssetId?: string;
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
  const [selectedPcnDossierId, setSelectedPcnDossierId] = useState<string | undefined>(initialPcnDossierId);
  const [selectedPcnRequirementId, setSelectedPcnRequirementId] = useState<string | undefined>(initialPcnRequirementId);
  const [selectedPcnKind, setSelectedPcnKind] = useState<PcnDraftFormKind | undefined>(initialPcnKind);

  const [selectedPgdRequestId, setSelectedPgdRequestId] = useState<string | undefined>(initialPgdRequestId);
  const [selectedPgdRequirementCode, setSelectedPgdRequirementCode] = useState<string | undefined>(initialPgdRequirementCode);
  const [selectedPgdTemplateKind, setSelectedPgdTemplateKind] = useState<PgdDocumentTemplateKind | undefined>(initialPgdTemplateKind);

  // Tab DOCX: Filters
  const [docxSearch, setDocxSearch] = useState('');
  const [docxDomainFilter, setDocxDomainFilter] = useState<'ALL' | 'PGD' | 'PCN'>('ALL');
  const [docxStatusFilter, setDocxStatusFilter] = useState<string>('ALL');

  // Tab Drafts: Data & Filters
  const [draftsLoading, setDraftsLoading] = useState(false);
  const [pcnDrafts, setPcnDrafts] = useState<PcnDraftWorkspace[]>([]);
  const [pgdDrafts, setPgdDrafts] = useState<PgdDraftWorkspace[]>([]);
  const [draftSearch, setDraftSearch] = useState('');
  const [draftDomainFilter, setDraftDomainFilter] = useState<'ALL' | 'PGD' | 'PCN'>('ALL');

  // Fetch drafts
  const loadDrafts = useCallback(async () => {
    setDraftsLoading(true);
    try {
      const promises: [Promise<PcnDraftWorkspace[]>, Promise<PgdDraftWorkspace[]>] = [
        hasPcn ? fetchPcnDraftWorkspaces().catch(() => []) : Promise.resolve([]),
        hasPgd ? fetchPgdDraftWorkspaces().catch(() => []) : Promise.resolve([]),
      ];
      const [pcnResult, pgdResult] = await Promise.all(promises);
      setPcnDrafts(pcnResult);
      setPgdDrafts(pgdResult);
    } catch {
      toast.error('Không thể nạp danh sách bản nháp');
    } finally {
      setDraftsLoading(false);
    }
  }, [hasPcn, hasPgd]);

  useEffect(() => {
    void loadDrafts();
  }, [loadDrafts]);

  // Unified DOCX items
  const unifiedDocxList = useMemo<UnifiedDocxItem[]>(() => {
    const items: UnifiedDocxItem[] = [];

    // PGD Templates
    if (hasPgd) {
      const pgdSource = (pgdTemplates && pgdTemplates.length > 0) ? pgdTemplates : getPgdDocumentTemplates();
      for (const t of pgdSource) {
        items.push({
          id: `pgd-${t.id || t.code}`,
          code: t.code,
          name: t.name || t.sourceFormLabel || t.code,
          domain: 'PGD',
          scopeLabel: (t.productGroups || []).join(', ') || 'Chung',
          version: t.version ? `v${t.version}` : 'v1.0',
          updatedAt: 'Đang áp dụng',
          status: t.status === 'PUBLISHED' ? 'Đã ban hành' : t.status === 'RETIRED' ? 'Hết hiệu lực' : 'Bản nháp',
          statusClass: t.status === 'PUBLISHED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
          pgdKind: t.kind,
          downloadUrl: `/api/pgd/document-templates/${encodeURIComponent(t.id)}/source`,
        });
      }
    }

    // PCN Templates
    if (hasPcn) {
      const pcnOperational = getPcnOperationalTemplates();
      const pcnSource = (pcnTemplates && pcnTemplates.length > 0) ? pcnTemplates : [];
      // Combine unique by generationKind or id
      const seenKinds = new Set<string>();

      for (const t of pcnOperational) {
        seenKinds.add(t.generationKind);
        items.push({
          id: `pcn-${t.id}`,
          code: t.id,
          name: t.displayName || t.id,
          domain: 'PCN',
          scopeLabel: (t.fieldCodes || []).join(', ') || 'Chung',
          version: 'v1.0',
          updatedAt: 'Đang áp dụng',
          status: t.status === 'OFFICIAL_CANDIDATE' ? 'Đã ban hành' : 'Bản nháp',
          statusClass: t.status === 'OFFICIAL_CANDIDATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
          pcnKind: t.generationKind as unknown as PcnDraftFormKind,
        });
      }

      for (const t of pcnSource) {
        if (t.id && !seenKinds.has(t.id)) {
          items.push({
            id: `pcn-db-${t.id}`,
            code: t.id,
            name: t.displayName || t.id,
            domain: 'PCN',
            scopeLabel: t.fieldCode || 'Chung',
            version: t.variant ? `v${t.variant}` : 'v1.0',
            updatedAt: t.importedAt ? formatDateTimeDdMmYyyy(t.importedAt) : 'Đang áp dụng',
            status: t.status === 'APPROVED' ? 'Đã duyệt' : 'Bản nháp',
            statusClass: t.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200',
            fileAssetId: t.fileAssetId,
            downloadUrl: t.fileAssetId ? getPcnFileUrl(t.fileAssetId) : undefined,
          });
        }
      }
    }

    return items;
  }, [hasPgd, hasPcn, pgdTemplates, pcnTemplates]);

  // Filtered DOCX items
  const filteredDocxList = useMemo(() => {
    return unifiedDocxList.filter((item) => {
      if (docxDomainFilter !== 'ALL' && item.domain !== docxDomainFilter && item.domain !== 'SHARED') {
        return false;
      }
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
  }, [unifiedDocxList, docxDomainFilter, docxStatusFilter, docxSearch]);

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
          url: out.fileAssetId ? getPcnFileUrl(out.fileAssetId) : undefined,
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

  // Filtered Draft items
  const filteredDraftList = useMemo(() => {
    return unifiedDraftList.filter((item) => {
      if (draftDomainFilter !== 'ALL' && item.domain !== draftDomainFilter) {
        return false;
      }
      if (draftSearch.trim()) {
        const q = draftSearch.toLowerCase();
        const match = item.title.toLowerCase().includes(q) ||
          item.relatedRecordLabel.toLowerCase().includes(q) ||
          item.templateLabel.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [unifiedDraftList, draftDomainFilter, draftSearch]);

  // Handler: "Sử dụng để soạn thảo" from DOCX Tab
  const handleUseTemplate = (item: UnifiedDocxItem) => {
    if (item.domain === 'PCN' || (item.domain === 'SHARED' && activeDomain === 'PCN')) {
      setActiveDomain('PCN');
      if (item.pcnKind) setSelectedPcnKind(item.pcnKind);
    } else {
      setActiveDomain('PGD');
      if (item.pgdKind) setSelectedPgdTemplateKind(item.pgdKind);
    }
    setActiveTab('drafting');
    toast.success(`Đã chọn biểu mẫu ${item.code}`);
  };

  // Handler: "Tiếp tục soạn" from Drafts Tab
  const handleContinueDraft = (item: UnifiedDraftItem) => {
    if (item.domain === 'PCN' && item.rawPcnDraft) {
      setActiveDomain('PCN');
      if (item.rawPcnDraft.sourceDossierId) {
        setSelectedPcnDossierId(item.rawPcnDraft.sourceDossierId);
      }
      if (item.rawPcnDraft.formKind) {
        setSelectedPcnKind(item.rawPcnDraft.formKind);
      }
    } else if (item.domain === 'PGD' && item.rawPgdDraft) {
      setActiveDomain('PGD');
      if (item.rawPgdDraft.requestId) {
        setSelectedPgdRequestId(item.rawPgdDraft.requestId);
      }
      if (item.rawPgdDraft.requirementCode) {
        setSelectedPgdRequirementCode(item.rawPgdDraft.requirementCode);
      }
    }
    setActiveTab('drafting');
    toast.success(`Đã nạp bản nháp "${item.title}"`);
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
                onClick={() => setActiveDomain('PGD')}
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
                onClick={() => setActiveDomain('PCN')}
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
              {unifiedDocxList.length}
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
              {unifiedDraftList.length}
            </span>
          </button>
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-x-hidden overflow-y-auto">
        {/* TAB 1: SOẠN THẢO (Kept mounted to preserve in-progress user input) */}
        <div className={activeTab === 'drafting' ? 'block' : 'hidden'}>
          {activeDomain === 'PCN' && hasPcn ? (
            <div className="p-3 lg:p-4">
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
                initialDossierId={selectedPcnDossierId || initialPcnDossierId}
                initialRequirementId={selectedPcnRequirementId || initialPcnRequirementId}
                initialNodeId={initialPcnNodeId}
                initialKind={selectedPcnKind || initialPcnKind}
                initialReturnTo={initialPcnReturnTo}
                onToast={(message, type) => (type === 'error' ? toast.error(message) : toast.success(message))}
              />
            </div>
          ) : activeDomain === 'PGD' && hasPgd ? (
            <div className="p-3 lg:p-4">
              <PgdDraftingWorkspaceView
                templates={pgdTemplates}
                documents={pgdDocuments}
                canMutate={canMutatePgd}
                initialRequestId={selectedPgdRequestId || initialPgdRequestId}
                initialRequirementCode={selectedPgdRequirementCode || initialPgdRequirementCode}
                initialTemplateKind={selectedPgdTemplateKind || initialPgdTemplateKind}
                initialReturnTo={initialPgdReturnTo}
                onOpenSettings={onOpenPgdSettings}
              />
            </div>
          ) : (
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
                {hasPcn && hasPgd && (
                  <select
                    value={docxDomainFilter}
                    onChange={(e) => setDocxDomainFilter(e.target.value as 'ALL' | 'PGD' | 'PCN')}
                    className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                    aria-label="Lọc theo phân hệ"
                  >
                    <option value="ALL">Tất cả nghiệp vụ</option>
                    <option value="PGD">Giám định (PGD)</option>
                    <option value="PCN">Chứng nhận (PCN)</option>
                  </select>
                )}

                <select
                  value={docxStatusFilter}
                  onChange={(e) => setDocxStatusFilter(e.target.value)}
                  className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                  aria-label="Lọc theo trạng thái"
                >
                  <option value="ALL">Tất cả trạng thái</option>
                  <option value="Đã ban hành">Đã ban hành</option>
                  <option value="Bản nháp">Bản nháp</option>
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
                      <th className="px-4 py-3">Tên biểu mẫu</th>
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
                          <td className="px-4 py-3 font-medium text-slate-800">
                            {item.name}
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
                            <div className="inline-flex items-center gap-1.5">
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
                              <button
                                type="button"
                                onClick={() => handleUseTemplate(item)}
                                className="inline-flex min-h-8 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-blue-700 shadow-3xs"
                                title={`Sử dụng biểu mẫu ${item.code}`}
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
                {hasPcn && hasPgd && (
                  <select
                    value={draftDomainFilter}
                    onChange={(e) => setDraftDomainFilter(e.target.value as 'ALL' | 'PGD' | 'PCN')}
                    className="min-h-10 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 focus:border-blue-500 focus:outline-none"
                    aria-label="Lọc theo phân hệ bản nháp"
                  >
                    <option value="ALL">Tất cả nghiệp vụ</option>
                    <option value="PGD">Giám định (PGD)</option>
                    <option value="PCN">Chứng nhận (PCN)</option>
                  </select>
                )}

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
                                {item.outputs.map((out) => (
                                  <a
                                    key={out.id}
                                    href={out.url || '#'}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-0.5 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50"
                                  >
                                    <Download size={10} />
                                    <span>{out.format}</span>
                                  </a>
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
    </div>
  );
}
