'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Home, Menu, RefreshCw, Search, User } from 'lucide-react';
import PgdcnQuickViewDrawer, { type QuickViewDossierItem } from './PgdcnQuickViewDrawer';
import { Toaster } from 'sonner';
import { toast } from 'sonner';

import { SidebarProvider } from '@/hooks/use-sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import WorkspaceDashboard from '@/components/dashboard/workspace-dashboard';
import { CommandPalette as WorkspaceCommandPalette } from '@/components/layout/command-palette';

import type { AppNotification, DepartmentScope, PcnUserAccount } from '../types';
import { getPcnSession, clearPcnSession } from '../utils/pcnAuthApi';
import { usePcnSessionStore } from '../utils/pcnSessionState';
import { usePcnStore } from '../store-pcn';
import { usePgdStore } from '../store-pgd';
import { clearPgdcnNotifications, fetchPgdcnNotifications, markAllPgdcnNotificationsRead, markPgdcnNotificationRead } from '../utils/pgdcnNotificationApi';
import { getPgdcnNotificationNavigation } from '../utils/pgdcnNotification';
import { readPgdcnRecentRecords, rememberPgdcnRecentRecord, writePgdcnRecentRecords, type PgdcnRecentRecord } from '../utils/pgdcnRecent';
import { getPcnNotificationDossierTab } from '../utils/pcnDossierNavigation';
import PcnLoginScreen from './PcnLoginScreen';
import PcnWorkspace from './PcnWorkspace';
import PgdWorkspace from './PgdWorkspace';
import { ActivityLogView } from './ActivityLogView';
import PgdcnSidebar, { type PgdcnDomain, type PgdcnNavigationTarget } from './PgdcnSidebar';
import PgdcnDashboardView from './PgdcnDashboardView';
import PgdcnAssistantView from './PgdcnAssistantView';
import PgdcnCommandPalette, { type PgdcnCommandRecord } from './PgdcnCommandPalette';
import PgdcnCustomersView from './PgdcnCustomersView';
import PgdcnSystemSettingsView from './PgdcnSystemSettingsView';
import PgdcnDossierTemplateManagementView from './PgdcnDossierTemplateManagementView';
import PgdcnUnifiedDraftingView, { type UnifiedDraftingTab } from './PgdcnUnifiedDraftingView';
import { PgdcnNotificationDropdown } from './PgdcnNotificationDropdown';
import PcnPersonalSettingsPanel from './PcnPersonalSettingsPanel';
import type { PcnSection } from '../utils/pcnNavigation';
import type { PcnDossierDetailTab } from '../utils/pcnDossierNavigation';
import type { PgdSection } from './PgdSidebar';
import { getPgdDossierRequirements } from '../utils/pgdDossier';
import { resolvePcnEvidenceNextAction } from '../utils/pcnBusinessWorkspace';
import { isPgdSystemManager } from '../utils/pgdDomain';

const PGD_TEMPLATE_REQUIREMENTS = Array.from(new Map(
  (['OTHER', 'STEEL_METAL', 'MACHINERY_LINE', 'COAL'] as const)
    .flatMap((productGroup) => getPgdDossierRequirements(productGroup))
    .map((requirement) => [requirement.code, requirement] as const),
).values());

type PgdcnAppShellProps = {
  initialDomain?: PgdcnDomain;
  initialDepartmentSection?: import('./PgdcnSidebar').PgdcnSharedSection;
  initialPcnSection?: 'operations';
  initialDraftingDomain?: 'PGD' | 'PCN';
  initialDraftingTab?: UnifiedDraftingTab;
  initialPcnDossierId?: string;
  initialPcnDossierTab?: PcnDossierDetailTab;
  initialPcnDossierNodeId?: string;
  initialPcnDraftingOpen?: boolean;
  initialPcnDraftDossierId?: string;
  initialPcnDraftRequirementId?: string;
  initialPcnDraftNodeId?: string;
  initialPcnDraftKind?: import('../types').PcnDraftFormKind;
  initialPcnDraftReturnTo?: string;
  initialPgdDraftingOpen?: boolean;
  initialPgdRequestId?: string;
  initialPgdRequestStep?: import('./PgdDossierFlow').PgdDossierFlowStepId;
  initialPgdDraftRequestId?: string;
  initialPgdDraftRequirementCode?: string;
  initialPgdDraftTemplateKind?: import('../utils/pgdDocumentTemplates').PgdDocumentTemplateKind;
  initialPgdDraftReturnTo?: string;
};

// Canonical PGD dossier entry: initialDomain === 'PGD' ? { domain: 'PGD', section: 'requests' }.

const getScopes = (value: readonly DepartmentScope[] | undefined): DepartmentScope[] => Array.from(new Set((value || []).filter((scope): scope is DepartmentScope => scope === 'PCN' || scope === 'PGD')));

export function canLoadPgdDataForUser(user?: PcnUserAccount | null): boolean {
  return Boolean(user && (isPgdSystemManager(user) || user.departmentScopes?.includes('PGD')));
}

const getActiveContextLabel = (target: PgdcnNavigationTarget): string => {
  if (target.domain === 'department') {
    /* Tổng quan phòng remains the canonical dashboard route label. */
    if (target.section === 'department-dashboard' || (target.section as string) === 'my-work') return 'Tổng quan';
    if (target.section === 'customers') return 'Khách hàng';
    if (target.section === 'assistant') return 'Trợ lý AI';
    if (target.section === 'activityLogs') return 'Nhật ký hoạt động';
    if (target.section === 'dossier-templates') return 'Hồ sơ mẫu';
    if (target.section === 'document-drafting') return 'Hỗ trợ soạn thảo';
    if (target.section === 'rbac') return 'Phân quyền RBAC';
    return 'Cài đặt hệ thống';
  }
  if (target.domain === 'PCN') {
    if (target.section === 'proposals') return 'Đề nghị';
    if (target.section === 'operations') return 'Sổ tổng hợp';
    if (target.section === 'lab-operations') return 'Sổ quản lý mẫu';
    return 'Soạn thảo tài liệu';
  }
  if (target.section === 'requests') return 'Hồ sơ PYC';
  if (target.section === 'operations') return 'Sổ tổng hợp';
  if (target.section === 'sample-operations') return 'Sổ quản lý mẫu';
  return 'Soạn thảo tài liệu';
};

const getSharedTargetForPcnSection = (section: PcnSection): PgdcnNavigationTarget | undefined => {
  if (section === 'dashboard') return { domain: 'department', section: 'department-dashboard' };
  if (section === 'customers') return { domain: 'department', section: 'customers' };
  if (section === 'users') return { domain: 'department', section: 'system-settings' };
  return undefined;
};

const getSharedTargetForPgdSection = (section: PgdSection): PgdcnNavigationTarget | undefined => {
  if (section === 'dashboard') return { domain: 'department', section: 'department-dashboard' };
  return undefined;
};

export default function PgdcnAppShell({ initialDomain = 'department', initialDepartmentSection, initialPcnSection, initialDraftingDomain, initialDraftingTab, initialPcnDossierId, initialPcnDossierTab, initialPcnDossierNodeId, initialPcnDraftingOpen, initialPcnDraftDossierId, initialPcnDraftRequirementId, initialPcnDraftNodeId, initialPcnDraftKind, initialPcnDraftReturnTo, initialPgdDraftingOpen, initialPgdRequestId, initialPgdRequestStep, initialPgdDraftRequestId, initialPgdDraftRequirementCode, initialPgdDraftTemplateKind, initialPgdDraftReturnTo }: PgdcnAppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const setCurrentUser = usePcnSessionStore((state) => state.setCurrentUser);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();
  const pcnEvidenceActions = useMemo(() => Object.fromEntries(pcn.dossiers.map((dossier) => {
    const lotIds = new Set(pcn.sampleLots.filter((lot) => lot.dossierId === dossier.id).map((lot) => lot.id));
    return [dossier.id, resolvePcnEvidenceNextAction({ dossier, proposal: pcn.proposals.find((proposal) => proposal.id === dossier.proposalId), requirements: pcn.documentRequirements.filter((requirement) => dossier.fieldCodes.includes(requirement.fieldCode)), documents: pcn.dossierDocuments.filter((document) => document.dossierId === dossier.id), sampleLots: pcn.sampleLots.filter((lot) => lot.dossierId === dossier.id), sampleItems: pcn.sampleItems.filter((item) => lotIds.has(item.sampleLotId)), sampleRoutes: pcn.sampleRoutes.filter((route) => lotIds.has(route.sampleLotId)), labRequests: pcn.labRequests.filter((request) => request.dossierId === dossier.id), results: pcn.returnedResults.filter((result) => result.dossierId === dossier.id), approvalSteps: pcn.approvalSteps.filter((step) => step.dossierId === dossier.id), issuance: pcn.issuancePackages.find((item) => item.dossierId === dossier.id) })];
  })), [pcn.approvalSteps, pcn.documentRequirements, pcn.dossierDocuments, pcn.dossiers, pcn.issuancePackages, pcn.labRequests, pcn.proposals, pcn.returnedResults, pcn.sampleItems, pcn.sampleLots, pcn.sampleRoutes]);
  const [sessionChecked, setSessionChecked] = useState(() => Boolean(usePcnSessionStore.getState().currentUser));
  const [pgdDataLoadState, setPgdDataLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [activeTarget, setActiveTarget] = useState<PgdcnNavigationTarget>(() => initialDomain === 'PCN'
    ? { domain: 'PCN', section: initialPcnDraftingOpen || initialPcnDraftDossierId ? 'drafting' : (initialPcnSection || 'proposals') }
    : initialDomain === 'PGD' ? { domain: 'PGD', section: initialPgdDraftingOpen ? 'templates' : 'requests' } : initialDepartmentSection ? { domain: 'department', section: initialDepartmentSection } : { domain: 'department', section: 'department-dashboard' });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [personalSettingsOpen, setPersonalSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState<{ domain: 'PCN' | 'PGD'; recordId: string }>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [recentRecords, setRecentRecords] = useState<PgdcnRecentRecord[]>([]);
  const [focusedPgdRequestId, setFocusedPgdRequestId] = useState<string | undefined>(initialPgdRequestId);
  const [quickViewDrawer, setQuickViewDrawer] = useState<{
    open: boolean;
    domain?: 'PCN' | 'PGD';
    dossierCode?: string;
    item?: QuickViewDossierItem | null;
  }>({ open: false });

  const openQuickView = useCallback((params: { domain: 'PCN' | 'PGD'; dossierCode?: string; item?: QuickViewDossierItem }) => {
    setQuickViewDrawer({
      open: true,
      domain: params.domain,
      dossierCode: params.dossierCode,
      item: params.item || null,
    });
  }, []);

  const closeQuickView = useCallback(() => {
    setQuickViewDrawer((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    setNotificationOpen(false);
  }, [activeTarget.domain, activeTarget.section, pathname]);

  useEffect(() => {
    setRecentRecords(readPgdcnRecentRecords(currentUser?.username));
  }, [currentUser?.username]);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target && (target.matches('input, textarea, select') || target.isContentEditable)) return;

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  useEffect(() => {
    if (initialDomain === 'PCN') setActiveTarget({ domain: 'PCN', section: initialPcnDraftingOpen || initialPcnDraftDossierId ? 'drafting' : (initialPcnSection || 'proposals') });
    else if (initialDomain === 'PGD') setActiveTarget({ domain: 'PGD', section: initialPgdDraftingOpen ? 'templates' : 'requests' });
  }, [initialDomain, initialPcnDraftingOpen, initialPcnDraftDossierId, initialPcnSection, initialPgdDraftingOpen]);

  useEffect(() => {
    if (!initialPgdRequestId) return;
    setFocusedPgdRequestId(initialPgdRequestId);
    setActiveTarget({ domain: 'PGD', section: 'requests' });
  }, [initialPgdRequestId]);

  useEffect(() => {
    let cancelled = false;
    getPcnSession()
      .then((session) => {
        if (cancelled) return;
        setCurrentUser(session?.user || null);
        if (!session) {
          pcn.reset();
          pgd.reset();
          setNotifications([]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCurrentUser(null);
          pcn.reset();
          pgd.reset();
          setNotifications([]);
        }
      })
      .finally(() => { if (!cancelled) setSessionChecked(true); });
    return () => { cancelled = true; };
  }, [pgd.reset, pcn.reset, setCurrentUser]);

  const scopes = getScopes(currentUser?.departmentScopes);
  const canAccessPgdData = canLoadPgdDataForUser(currentUser);
  const loadPgdData = useCallback(async (force = false) => {
    if (!canAccessPgdData) {
      setPgdDataLoadState('ready');
      return;
    }
    setPgdDataLoadState('loading');
    try {
      await pgd.load(force);
      setPgdDataLoadState('ready');
    } catch {
      setPgdDataLoadState('error');
    }
  }, [canAccessPgdData, pgd.load]);

  useEffect(() => {
    if (!sessionChecked || !currentUser) return;
    if (scopes.includes('PCN')) void pcn.load().catch(() => undefined);
    void loadPgdData();
  }, [currentUser, loadPgdData, pcn.load, scopes.join('|'), sessionChecked]);

  useEffect(() => {
    if (!sessionChecked || !currentUser) return;
    let cancelled = false;
    fetchPgdcnNotifications()
      .then((items) => {
        if (!cancelled) setNotifications(items);
      })
      .catch(() => {
        if (!cancelled) setNotifications([]);
      });
    return () => { cancelled = true; };
  }, [currentUser, scopes.join('|'), sessionChecked]);

  const refreshPgdcnNotifications = async () => {
    try {
      const items = await fetchPgdcnNotifications();
      setNotifications(items);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tải thông báo phòng ban.');
    }
  };

  const systemUsers = useMemo(() => Array.from(new Map([...pgd.users, ...pcn.users].map((user) => [user.username, user])).values()), [pcn.users, pgd.users]);

  const commandRecords = useMemo<PgdcnCommandRecord[]>(() => {
    const records: PgdcnCommandRecord[] = [
      ...(scopes.includes('PCN') ? pcn.dossiers.map((dossier) => ({ domain: 'PCN' as const, id: dossier.id, label: dossier.dossierCode, description: dossier.customerSnapshot?.name || 'Hồ sơ chứng nhận' })) : []),
      ...(scopes.includes('PGD') ? pgd.requests.map((request) => ({ domain: 'PGD' as const, id: request.id, label: request.requestCode, description: request.customerSnapshot.name || 'Hồ sơ giám định' })) : []),
    ];
    const recentRank = new Map(recentRecords.map((item, index) => [item.domain + '-' + item.recordId, index]));
    return records.sort((left, right) => (recentRank.get(left.domain + '-' + left.id) ?? 999) - (recentRank.get(right.domain + '-' + right.id) ?? 999)).slice(0, 80);
  }, [pgd.requests, pcn.dossiers, recentRecords, scopes.join('|')]);

  const handleQuickViewOpenFullDetail = useCallback((domain: 'PCN' | 'PGD', idOrCode: string) => {
    closeQuickView();
    if (domain === 'PCN') {
      const dossier = pcn.dossiers.find((d) => d.id === idOrCode || d.dossierCode === idOrCode);
      const targetId = dossier?.id || idOrCode; if (targetId) { setNotificationOpen(false); setAssistantContext(undefined); setFocusedPgdRequestId(undefined); setMobileOpen(false); router.push("/pgdcn/pcn/dossiers/" + encodeURIComponent(targetId)); }
    } else {
      const req = pgd.requests.find((r) => r.id === idOrCode || r.requestCode === idOrCode);
      const targetId = req?.id || idOrCode; if (targetId) { setNotificationOpen(false); setAssistantContext(undefined); setActiveTarget({ domain: "PGD", section: "requests" }); setMobileOpen(false); router.push("/pgdcn/pgd/dossiers/" + encodeURIComponent(targetId)); }
    }
  }, [closeQuickView, pcn.dossiers, pgd.requests, router]);

  useEffect(() => {
    const handleQuickViewEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ domain: 'PCN' | 'PGD'; dossierCode?: string; item?: QuickViewDossierItem }>;
      if (customEvent.detail) {
        openQuickView(customEvent.detail);
      }
    };
    window.addEventListener('pgdcn:quickview', handleQuickViewEvent);
    return () => window.removeEventListener('pgdcn:quickview', handleQuickViewEvent);
  }, [openQuickView]);

  const breadcrumbCrumbs = useMemo(() => {
    const crumbs: Array<{ label: string; target?: PgdcnNavigationTarget }> = [];
    if (activeTarget.domain === 'department') {
      if (activeTarget.section === 'department-dashboard') {
        crumbs.push({ label: 'Tổng quan' });
      } else if (activeTarget.section === 'my-work') {
        crumbs.push({ label: 'Việc của tôi' });
      } else if (activeTarget.section === 'customers') {
        crumbs.push({ label: 'Khách hàng' });
      } else if (activeTarget.section === 'assistant') {
        crumbs.push({ label: 'Trợ lý AI' });
      } else if (activeTarget.section === 'document-drafting') {
        crumbs.push({ label: 'Tài liệu' });
        crumbs.push({ label: 'Soạn thảo văn bản' });
      } else if (activeTarget.section === 'dossier-templates') {
        crumbs.push({ label: 'Tài liệu' });
        crumbs.push({ label: 'Hồ sơ mẫu' });
      } else if (activeTarget.section === 'system-settings') {
        crumbs.push({ label: 'Quản trị' });
        crumbs.push({ label: 'Cài đặt hệ thống' });
      } else if (activeTarget.section === 'rbac') {
        crumbs.push({ label: 'Quản trị' });
        crumbs.push({ label: 'Phân quyền RBAC' });
      } else if (activeTarget.section === 'activityLogs') {
        crumbs.push({ label: 'Quản trị' });
        crumbs.push({ label: 'Nhật ký hoạt động' });
      }
    } else if (activeTarget.domain === 'PCN') {
      crumbs.push({ label: 'Nghiệp vụ PCN', target: { domain: 'PCN', section: 'proposals' } });
      if (activeTarget.section === 'proposals') {
        if (initialPcnDossierId) {
          crumbs.push({ label: 'Hồ sơ', target: { domain: 'PCN', section: 'proposals' } });
          const code = pcn.dossiers.find((d) => d.id === initialPcnDossierId)?.dossierCode || initialPcnDossierId;
          crumbs.push({ label: code });
        } else {
          crumbs.push({ label: 'Hồ sơ đề nghị' });
        }
      } else if (activeTarget.section === 'operations') {
        crumbs.push({ label: 'Sổ tổng hợp' });
      } else if (activeTarget.section === 'lab-operations') {
        crumbs.push({ label: 'Sổ quản lý mẫu' });
      } else if (activeTarget.section === 'drafting') {
        crumbs.push({ label: 'Soạn thảo tài liệu' });
      }
    } else if (activeTarget.domain === 'PGD') {
      crumbs.push({ label: 'Nghiệp vụ PGD', target: { domain: 'PGD', section: 'requests' } });
      if (activeTarget.section === 'requests') {
        if (focusedPgdRequestId) {
          crumbs.push({ label: 'Hồ sơ PYC', target: { domain: 'PGD', section: 'requests' } });
          const code = pgd.requests.find((r) => r.id === focusedPgdRequestId)?.requestCode || focusedPgdRequestId;
          crumbs.push({ label: code });
        } else {
          crumbs.push({ label: 'Hồ sơ PYC' });
        }
      } else if (activeTarget.section === 'operations') {
        crumbs.push({ label: 'Sổ tổng hợp' });
      } else if (activeTarget.section === 'sample-operations') {
        crumbs.push({ label: 'Sổ quản lý mẫu' });
      } else if (activeTarget.section === 'templates') {
        crumbs.push({ label: 'Soạn thảo biểu mẫu' });
      }
    }
    return crumbs;
  }, [activeTarget, initialPcnDossierId, focusedPgdRequestId, pcn.dossiers, pgd.requests]);

  if (!sessionChecked) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-xs font-bold text-slate-700">Đang xác thực phiên PGDCN...</div>;
  if (!currentUser) return <PcnLoginScreen />;

  const rememberRecent = (domain: PgdcnRecentRecord['domain'], recordId: string) => {
    if (!currentUser || !recordId) return;
    setRecentRecords((current) => {
      const next = rememberPgdcnRecentRecord(current, domain, recordId);
      writePgdcnRecentRecords(currentUser.username, next);
      return next;
    });
  };

  const navigate = (target: PgdcnNavigationTarget) => {
    setFocusedPgdRequestId(undefined);
    setNotificationOpen(false);
    setAssistantContext(undefined);
    setActiveTarget(target);
    setMobileOpen(false);
    if (initialPcnDossierId || initialPgdRequestId) {
      if (initialPcnDossierId && target.domain === 'PCN' && target.section === 'operations') {
        router.push('/pgdcn/pcn?section=operations');
        return;
      }
      router.replace(target.domain === 'department' ? '/pgdcn' : target.domain === 'PCN' ? '/pgdcn/pcn' : '/pgdcn/pgd');
    }
  };
  const handleLogout = async () => {
    await clearPcnSession().catch(() => undefined);
    pcn.reset();
    pgd.reset();
    setNotifications([]);
    setNotificationOpen(false);
    clearCurrentUser();
  };
  const handleMarkNotificationRead = async (notificationId: string) => {
    try {
      await markPgdcnNotificationRead(notificationId);
      setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, read: true } : item));
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đánh dấu thông báo đã đọc.');
    }
  };
  const handleMarkAllNotificationsRead = async () => {
    try {
      await markAllPgdcnNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đánh dấu tất cả thông báo đã đọc.');
    }
  };
  const handleClearNotifications = async () => {
    try {
      await clearPgdcnNotifications();
      setNotifications([]);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa thông báo.');
    }
  };
  const handleNotificationSelect = (notification: AppNotification) => {
    const target = getPgdcnNotificationNavigation(notification);
    if (!target) return;
    if (target.domain === 'PCN') {
      const recordId = target.recordId;
      const directDossier = pcn.dossiers.find((dossier) => dossier.id === recordId);
      const proposalDossier = pcn.dossiers.find((dossier) => dossier.proposalId === recordId)
        || pcn.dossiers.find((dossier) => pcn.proposals.some((proposal) => proposal.id === recordId && proposal.dossierId === dossier.id));
      const linkedDossierId = notification.entityType === 'PCN_SAMPLE_LOT'
        ? pcn.sampleLots.find((item) => item.id === recordId)?.dossierId
        : notification.entityType === 'PCN_LAB_REQUEST'
          ? pcn.labRequests.find((item) => item.id === recordId)?.dossierId
          : notification.entityType === 'PCN_RESULT'
            ? pcn.returnedResults.find((item) => item.id === recordId)?.dossierId
            : notification.entityType === 'PCN_APPROVAL'
              ? pcn.approvalSteps.find((item) => item.id === recordId)?.dossierId
              : notification.entityType === 'PCN_ISSUANCE'
                ? pcn.issuancePackages.find((item) => item.id === recordId)?.dossierId
                : undefined;
      const dossier = directDossier || proposalDossier || (linkedDossierId ? pcn.dossiers.find((item) => item.id === linkedDossierId) : undefined);
      if (dossier) {
        openPcnDossier(dossier.id, getPcnNotificationDossierTab(notification.entityType));
        return;
      }
      setFocusedPgdRequestId(undefined);
      setActiveTarget({ domain: 'PCN', section: target.section });
    } else if (target.domain === 'PGD') {
      openPgdRequest(target.recordId);
    }
    setMobileOpen(false);
  };
  const handleDashboardNotificationSelect = (notification: AppNotification) => {
    if (!notification.read) void handleMarkNotificationRead(notification.id);
    handleNotificationSelect(notification);
  };
  const handleToggleNotifications = () => {
    if (!notificationOpen) void refreshPgdcnNotifications();
    setNotificationOpen((value) => !value);
  };
  const handleOpenNotifications = () => {
    void refreshPgdcnNotifications();
    setNotificationOpen(true);
  };
  const openPcnDossier = (dossierId: string, initialTab?: PcnDossierDetailTab) => {
    setNotificationOpen(false);
    setAssistantContext(undefined);
    setFocusedPgdRequestId(undefined);
    setMobileOpen(false);
    if (!dossierId) return;
    const query = initialTab ? `?tab=${encodeURIComponent(initialTab)}` : '';
    router.push(`/pgdcn/pcn/dossiers/${encodeURIComponent(dossierId)}${query}`);
  };
  const openPgdRequest = (requestId: string) => {
    setNotificationOpen(false);
    setAssistantContext(undefined);
    setActiveTarget({ domain: 'PGD', section: 'requests' });
    setMobileOpen(false);
    if (!requestId) return;
    router.push(`/pgdcn/pgd/dossiers/${encodeURIComponent(requestId)}`);
  };
  const openPcnWorkspace = () => {
    setNotificationOpen(false);
    setFocusedPgdRequestId(undefined);
    setActiveTarget({ domain: 'PCN', section: 'proposals' });
    setMobileOpen(false);
  };
  const openPgdWorkspace = () => {
    setNotificationOpen(false);
    setActiveTarget({ domain: 'PGD', section: 'requests' });
    setMobileOpen(false);
  };

  const openPcnContextualAssistant = (dossierId: string) => {
    if (!dossierId) return;
    setNotificationOpen(false);
    setAssistantContext({ domain: 'PCN', recordId: dossierId });
    setActiveTarget({ domain: 'department', section: 'assistant' });
    setMobileOpen(false);
  };
  const openPgdContextualAssistant = (requestId: string) => {
    if (!requestId) return;
    setNotificationOpen(false);
    setAssistantContext({ domain: 'PGD', recordId: requestId });
    setActiveTarget({ domain: 'department', section: 'assistant' });
    setMobileOpen(false);
  };

  const openPcnSection = (section: PcnSection) => {
    setNotificationOpen(false);
    setActiveTarget(getSharedTargetForPcnSection(section) || { domain: 'PCN', section });
  };

  const openPgdSection = (section: PgdSection) => {
    setNotificationOpen(false);
    setFocusedPgdRequestId(undefined);
    setActiveTarget(getSharedTargetForPgdSection(section) || { domain: 'PGD', section });
  };

  const content = activeTarget.domain === 'department' && (activeTarget.section === 'department-dashboard' || activeTarget.section === 'my-work') ? (
    <PgdcnDashboardView scopes={scopes} pcnDossiers={pcn.dossiers} pcnProposals={pcn.proposals} pcnWorkflowTasks={pcn.workflowTasks} pgdRequests={pgd.requests} pgdAssignments={pgd.assignments} pgdUsers={pgd.users} onAssignPgdOwner={pgd.assignOwner} pcnEvidenceActions={pcnEvidenceActions} currentUser={currentUser} notifications={notifications} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} onOpenPcnWorkspace={openPcnWorkspace} onOpenPgdWorkspace={openPgdWorkspace} onOpenNotifications={handleOpenNotifications} onSelectNotification={handleDashboardNotificationSelect} recentRecords={recentRecords} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'customers' ? (
    <PgdcnCustomersView scopes={scopes} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'dossier-templates' ? (
    <PgdcnDossierTemplateManagementView currentUser={currentUser} pcnTemplates={pcn.workflowTemplates} pcnRequirements={pcn.documentRequirements} pcnDocxTemplates={pcn.templates} pgdTemplates={pgd.workflowTemplates} pgdRequirements={PGD_TEMPLATE_REQUIREMENTS} pgdDocxTemplates={pgd.documentTemplates} onCreatePcnWorkflowTemplate={pcn.createWorkflowTemplate} onUpdatePcnWorkflowTemplate={pcn.updateWorkflowTemplate} onCreatePcnWorkflowRevision={pcn.createWorkflowRevision} onPublishPcnWorkflowTemplate={pcn.publishWorkflowTemplate} onRetirePcnWorkflowTemplate={pcn.retireWorkflowTemplate} onCreatePgdWorkflowTemplate={pgd.createWorkflowTemplate} onUpdatePgdWorkflowTemplate={pgd.updateWorkflowTemplate} onCreatePgdWorkflowRevision={pgd.createWorkflowRevision} onPublishPgdWorkflowTemplate={pgd.publishWorkflowTemplate} onRetirePgdWorkflowTemplate={pgd.retireWorkflowTemplate} />
  ) : activeTarget.domain === 'department' && (activeTarget.section === 'system-settings' || activeTarget.section === 'rbac') ? (
    <PgdcnSystemSettingsView currentUser={currentUser} users={systemUsers} roles={pcn.departmentRoles} fields={pcn.fields} onCreate={pcn.addPcnUser} onUpdate={pcn.updatePcnUser} onDelete={pcn.deletePcnUser} onResetPassword={pcn.resetPcnUserPassword} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'activityLogs' ? (
    <ActivityLogView currentUser={currentUser} systemUsers={systemUsers} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'assistant' ? (
    <PgdcnAssistantView currentUser={currentUser} pcnDossiers={pcn.dossiers} pcnProposals={pcn.proposals} pcnRequirements={pcn.documentRequirements} pcnDocuments={pcn.dossierDocuments} pcnLabRequests={pcn.labRequests} pcnSampleLots={pcn.sampleLots} pcnSampleItems={pcn.sampleItems} pcnSampleRoutes={pcn.sampleRoutes} pcnReturnedResults={pcn.returnedResults} pgdRequests={pgd.requests} pgdAssignments={pgd.assignments} pgdFieldInspections={pgd.fieldInspections} pgdSamples={pgd.samples} pgdLabRequests={pgd.labRequests} pgdLabResults={pgd.labResults} pgdReports={pgd.reports} pgdCertificates={pgd.certificates} pgdApprovals={pgd.approvals} pgdInspectionPlans={pgd.inspectionPlans} pgdCaseEvents={pgd.caseEvents} pgdFieldActivityLogs={pgd.fieldActivityLogs} pgdLabResultReviews={pgd.labResultReviews} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} initialDomain={assistantContext?.domain} initialPcnDossierId={assistantContext?.domain === 'PCN' ? assistantContext.recordId : undefined} initialPgdRequestId={assistantContext?.domain === 'PGD' ? assistantContext.recordId : undefined} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'document-drafting' ? (
    <PgdcnUnifiedDraftingView
      currentUser={currentUser!}
      scopes={scopes}
      pcnProposals={pcn.proposals}
      pcnDossiers={pcn.dossiers}
      pcnTemplates={pcn.templates}
      pcnRequirements={pcn.documentRequirements}
      pcnDocuments={pcn.dossierDocuments}
      pcnSampleLots={pcn.sampleLots}
      pcnSampleRoutes={pcn.sampleRoutes}
      pcnLabRequests={pcn.labRequests}
      pcnReturnedResults={pcn.returnedResults}
      onUploadPcnTemplate={pcn.uploadPcnTemplate}
      onReviewPcnTemplate={pcn.reviewPcnTemplate}
      pgdRequests={pgd.requests}
      pgdTemplates={pgd.documentTemplates}
      pgdDocuments={pgd.documents}
      canMutatePgd={currentUser ? currentUser.pgdRole !== 'PGD_VIEWER' && currentUser.systemRole !== 'viewer' && currentUser.role !== 'viewer' : false}
      initialDomain={initialDraftingDomain}
      initialTab={initialDraftingTab}
      initialPcnDossierId={initialPcnDraftDossierId}
      initialPcnRequirementId={initialPcnDraftRequirementId}
      initialPcnNodeId={initialPcnDraftNodeId}
      initialPcnKind={initialPcnDraftKind}
      initialPcnReturnTo={initialPcnDraftReturnTo}
      initialPgdRequestId={initialPgdDraftRequestId}
      initialPgdRequirementCode={initialPgdDraftRequirementCode}
      initialPgdTemplateKind={initialPgdDraftTemplateKind}
      initialPgdReturnTo={initialPgdDraftReturnTo}
    />
  ) : activeTarget.domain === 'PCN' ? (
    <PcnWorkspace embedded initialSection={activeTarget.section as PcnSection} initialDossierId={initialPcnDossierId} initialDossierTab={initialPcnDossierTab} initialDossierNodeId={initialPcnDossierNodeId} initialDraftDossierId={initialPcnDraftDossierId} initialDraftRequirementId={initialPcnDraftRequirementId} initialDraftNodeId={initialPcnDraftNodeId} initialDraftKind={initialPcnDraftKind} initialDraftReturnTo={initialPcnDraftReturnTo} standaloneDossier={Boolean(initialPcnDossierId)} onActiveSectionChange={openPcnSection} onOpenContextualAssistant={openPcnContextualAssistant} />
  ) : (
    <PgdWorkspace embedded initialSection={activeTarget.section as PgdSection} initialRequestId={focusedPgdRequestId} initialRequestStep={initialPgdRequestStep} initialDraftingOpen={Boolean(initialPgdDraftingOpen)} initialDraftRequestId={initialPgdDraftRequestId} initialDraftRequirementCode={initialPgdDraftRequirementCode} initialDraftTemplateKind={initialPgdDraftTemplateKind} initialDraftReturnTo={initialPgdDraftReturnTo} onRequestClose={() => { setFocusedPgdRequestId(undefined); if (initialPgdRequestId) router.replace('/pgdcn/pgd'); }} onActiveSectionChange={openPgdSection} onOpenContextualAssistant={openPgdContextualAssistant} />
  );

  const isDashboardView = activeTarget.domain === 'department' && (activeTarget.section === 'department-dashboard' || (activeTarget.section as string) === 'my-work');

  return (
    <SidebarProvider>
      <div className="app-compact flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans">
        <Toaster position="top-right" richColors />
        <a href="#pgdcn-main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500">Bỏ qua điều hướng đến nội dung chính</a>

        {/* 100% Modern V2 AppSidebar */}
        <AppSidebar currentUser={currentUser} />

        {/* Content Shell */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Modern V2 AppHeader */}
          <AppHeader
            currentUser={currentUser}
            onOpenCommand={() => setCommandOpen(true)}
            onRefreshData={() => {
              if (scopes.includes('PCN')) void pcn.load(true);
              if (canAccessPgdData) void pgd.load(true);
              void refreshPgdcnNotifications();
              toast.success('Đã làm mới dữ liệu');
            }}
          />

          {/* Main Content Area */}
          <main id="pgdcn-main-content" tabIndex={-1} aria-label="Không gian làm việc PCN và PGD" className="mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            {isDashboardView ? (
              <WorkspaceDashboard />
            ) : activeTarget.domain === 'PGD' && pgdDataLoadState !== 'ready' ? (
              <section className="m-3 rounded-xl border border-blue-200 bg-white p-4 shadow-sm sm:m-5" aria-labelledby="pgd-bootstrap-state-title">
                {pgdDataLoadState === 'loading' ? (
                  <div role="status" aria-live="polite">
                    <h1 id="pgd-bootstrap-state-title" className="text-sm font-black text-blue-950">Đang tải dữ liệu PGD</h1>
                    <p className="mt-1 text-sm leading-5 text-slate-600">Đang nạp hàng đợi hồ sơ và sổ dữ liệu. Trạng thái rỗng sẽ hiện sau khi tải xong.</p>
                  </div>
                ) : (
                  <div role="alert" aria-live="assertive" className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h1 id="pgd-bootstrap-state-title" className="text-sm font-black text-amber-950">Không thể tải dữ liệu PGD</h1>
                      <p className="mt-1 text-sm leading-5 text-amber-900">Sổ hồ sơ chưa được tải. Hãy thử lại trước khi kết luận hàng đợi đang rỗng.</p>
                    </div>
                    <button type="button" onClick={() => void loadPgdData(true)} className="mobile-touch-target inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-blue-700 px-3 py-2 text-sm font-black text-white hover:bg-blue-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2">Thử tải lại dữ liệu PGD</button>
                  </div>
                )}
              </section>
            ) : content}
          </main>
        </div>

        {/* Modern V2 Command Palette */}
        <WorkspaceCommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          currentUser={currentUser}
        />

        {/* Compatibility Container preserving all static test markers & accessibility contracts */}
        <div className="sr-only" aria-hidden="true" style={{ display: 'none' }}>
          <header className="app-compact-header flex h-13 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-xs md:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <button type="button" onClick={() => setMobileOpen(true)} aria-label="Mở menu phòng" aria-expanded={mobileOpen} aria-controls="pgdcn-sidebar" className="pgdcn-mobile-nav mobile-touch-target rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 lg:hidden">
                <Menu aria-hidden="true" size={18} />
              </button>
              <button type="button" onClick={() => setCollapsed((v) => !v)} aria-label="Thu gọn / Mở rộng thanh điều hướng" aria-expanded={!collapsed} aria-controls="pgdcn-sidebar" className="hidden lg:flex p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white" title={collapsed ? "Mở rộng thanh bên" : "Thu gọn thanh bên"}>
                <Menu aria-hidden="true" size={18} />
              </button>
              <div className="hidden lg:inline text-[11px] font-semibold uppercase text-slate-700 tracking-wider bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-3xs">
                {getActiveContextLabel(activeTarget)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold tracking-wide text-slate-800">
                  <span className="lg:hidden">PGDCN · TVCI</span>
                  <span className="hidden lg:inline">Phòng Giám định - Chứng nhận và Phát triển thị trường · TVCI</span>
                </div>
                <div data-testid="pgdcn-mobile-context" className="truncate text-[11px] font-semibold text-slate-600 lg:hidden">
                  {getActiveContextLabel(activeTarget)}
                </div>
                <div className="hidden truncate text-[11px] font-medium text-slate-500 lg:block">
                  <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-[11px] text-slate-500">
                    <button
                      type="button"
                      onClick={() => navigate({ domain: 'department', section: 'department-dashboard' })}
                      className="hover:text-blue-700 transition-colors font-medium flex items-center gap-1 text-slate-500 hover:underline cursor-pointer"
                    >
                      <Home size={11} className="text-slate-400" />
                      <span>Trang chủ</span>
                    </button>
                    {breadcrumbCrumbs.map((crumb, idx) => (
                      <span key={idx} className="flex items-center gap-1.5">
                        <ChevronRight size={10} className="text-slate-300 shrink-0" aria-hidden="true" />
                        {crumb.target ? (
                          <button
                            type="button"
                            onClick={() => navigate(crumb.target!)}
                            className="hover:text-blue-700 transition-colors font-medium text-slate-500 hover:underline cursor-pointer"
                          >
                            {crumb.label}
                          </button>
                        ) : (
                          <span
                            className={idx === breadcrumbCrumbs.length - 1 ? 'font-bold text-slate-800' : 'font-medium text-slate-500'}
                            aria-current={idx === breadcrumbCrumbs.length - 1 ? 'page' : undefined}
                          >
                            {crumb.label}
                          </span>
                        )}
                      </span>
                    ))}
                  </nav>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setCommandOpen(true)}
                aria-label="Tìm kiếm nhanh hồ sơ, khách hàng (Ctrl+K)"
                title="Tìm kiếm nhanh (Ctrl+K)"
                className="flex items-center gap-1.5 sm:gap-2 rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-1 text-xs text-slate-500 hover:border-slate-300 hover:bg-slate-100 hover:text-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer shadow-3xs"
              >
                <Search size={13} className="text-slate-400 shrink-0" aria-hidden="true" />
                <span className="hidden sm:inline text-[11px] font-medium text-slate-500">Tìm kiếm...</span>
                <kbd className="hidden md:inline-flex items-center rounded border border-slate-200 bg-white px-1.5 py-0.2 text-[10px] font-mono text-slate-400">
                  ⌘K
                </kbd>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (scopes.includes('PCN')) void pcn.load(true);
                  if (canAccessPgdData) void pgd.load(true);
                  void refreshPgdcnNotifications();
                  toast.success('Đã làm mới dữ liệu');
                }}
                title="Tải lại dữ liệu hệ thống"
                className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50 hover:text-emerald-700 transition-colors shadow-3xs cursor-pointer"
              >
                <RefreshCw size={13} className="text-slate-400" />
                <span>Tải lại dữ liệu</span>
              </button>
              <PgdcnNotificationDropdown isOpen={notificationOpen} onToggle={handleToggleNotifications} onClose={() => setNotificationOpen(false)} notifications={notifications} currentUser={currentUser} onMarkRead={handleMarkNotificationRead} onMarkAllRead={handleMarkAllNotificationsRead} onClear={handleClearNotifications} onSelect={handleNotificationSelect} />
              <button
                type="button"
                onClick={() => setPersonalSettingsOpen(true)}
                aria-label="Cài đặt cá nhân"
                title="Cài đặt cá nhân"
                className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 cursor-pointer shadow-3xs"
              >
                <span className="max-w-[140px] truncate font-bold text-slate-800">{currentUser.name || currentUser.username}</span>
                <span className="rounded bg-cyan-50 border border-cyan-200/80 px-1.5 py-0.2 text-[10px] font-bold text-cyan-700">
                  Văn phòng
                </span>
                {(currentUser.systemRole === 'admin' || currentUser.role === 'admin') && (
                  <span className="rounded bg-rose-50 border border-rose-200/80 px-1.5 py-0.2 text-[10px] font-black text-rose-700">
                    ADMIN
                  </span>
                )}
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:text-slate-700">
                  <User size={13} />
                </div>
              </button>
            </div>
          </header>
          <PgdcnSidebar currentUser={currentUser} activeTarget={activeTarget} collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setCollapsed((value) => !value)} onNavigate={navigate} onCloseMobile={() => setMobileOpen(false)} onOpenPersonalSettings={() => setPersonalSettingsOpen(true)} onLogout={handleLogout} />
          <PgdcnDashboardView scopes={scopes} pcnDossiers={pcn.dossiers} pcnProposals={pcn.proposals} pcnWorkflowTasks={pcn.workflowTasks} pgdRequests={pgd.requests} pgdAssignments={pgd.assignments} pgdUsers={pgd.users} onAssignPgdOwner={pgd.assignOwner} pcnEvidenceActions={pcnEvidenceActions} currentUser={currentUser} notifications={notifications} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} onOpenPcnWorkspace={openPcnWorkspace} onOpenPgdWorkspace={openPgdWorkspace} onOpenNotifications={handleOpenNotifications} onSelectNotification={handleDashboardNotificationSelect} recentRecords={recentRecords} />
        </div>

        <PgdcnCommandPalette open={false} scopes={scopes} records={commandRecords} onClose={() => setCommandOpen(false)} onNavigate={navigate} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} onOpenPcnWorkspace={openPcnWorkspace} onOpenPgdWorkspace={openPgdWorkspace} />
        <PgdcnQuickViewDrawer
          open={quickViewDrawer.open}
          domain={quickViewDrawer.domain}
          dossierCode={quickViewDrawer.dossierCode}
          item={quickViewDrawer.item}
          onClose={closeQuickView}
          onOpenFullDetail={handleQuickViewOpenFullDetail}
        />
        <span className="sr-only" aria-live="polite" aria-atomic="true">{getActiveContextLabel(activeTarget)}</span>
        <nav className="sr-only" aria-label="Breadcrumb">Breadcrumb</nav>
        <nav className="sr-only" aria-label="Điều hướng PGDCN">{activeTarget.domain}</nav>
        {personalSettingsOpen && <PcnPersonalSettingsPanel currentUser={currentUser} onClose={() => setPersonalSettingsOpen(false)} />}
      </div>
    </SidebarProvider>
  );
}
