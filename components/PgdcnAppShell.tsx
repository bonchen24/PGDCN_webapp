'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Menu, RefreshCw, User } from 'lucide-react';
import { Toaster } from 'sonner';
import { toast } from 'sonner';

import type { AppNotification, DepartmentScope } from '../types';
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
import { PgdcnNotificationDropdown } from './PgdcnNotificationDropdown';
import PcnPersonalSettingsPanel from './PcnPersonalSettingsPanel';
import type { PcnSection } from '../utils/pcnNavigation';
import type { PcnDossierDetailTab } from '../utils/pcnDossierNavigation';
import type { PgdSection } from './PgdSidebar';
import { getPgdDossierRequirements } from '../utils/pgdDossier';
import { resolvePcnEvidenceNextAction } from '../utils/pcnBusinessWorkspace';

const PGD_TEMPLATE_REQUIREMENTS = Array.from(new Map(
  (['OTHER', 'STEEL_METAL', 'MACHINERY_LINE', 'COAL'] as const)
    .flatMap((productGroup) => getPgdDossierRequirements(productGroup))
    .map((requirement) => [requirement.code, requirement] as const),
).values());

type PgdcnAppShellProps = {
  initialDomain?: PgdcnDomain;
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

const getActiveContextLabel = (target: PgdcnNavigationTarget): string => {
  if (target.domain === 'department') {
    /* Tổng quan phòng remains the canonical dashboard route label. */
    if (target.section === 'department-dashboard' || (target.section as string) === 'my-work') return 'Tổng quan';
    if (target.section === 'customers') return 'Khách hàng';
    if (target.section === 'assistant') return 'Trợ lý AI';
    if (target.section === 'activityLogs') return 'Nhật ký hoạt động';
    if (target.section === 'dossier-templates') return 'Hồ sơ mẫu';
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

export default function PgdcnAppShell({ initialDomain = 'department', initialPcnDossierId, initialPcnDossierTab, initialPcnDossierNodeId, initialPcnDraftingOpen, initialPcnDraftDossierId, initialPcnDraftRequirementId, initialPcnDraftNodeId, initialPcnDraftKind, initialPcnDraftReturnTo, initialPgdDraftingOpen, initialPgdRequestId, initialPgdRequestStep, initialPgdDraftRequestId, initialPgdDraftRequirementCode, initialPgdDraftTemplateKind, initialPgdDraftReturnTo }: PgdcnAppShellProps) {
  const router = useRouter();
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
  const [activeTarget, setActiveTarget] = useState<PgdcnNavigationTarget>(() => initialDomain === 'PCN'
    ? { domain: 'PCN', section: initialPcnDraftingOpen || initialPcnDraftDossierId ? 'drafting' : 'proposals' }
    : initialDomain === 'PGD' ? { domain: 'PGD', section: initialPgdDraftingOpen ? 'templates' : 'requests' } : { domain: 'department', section: 'department-dashboard' });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [personalSettingsOpen, setPersonalSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [assistantContext, setAssistantContext] = useState<{ domain: 'PCN' | 'PGD'; recordId: string }>();
  const [commandOpen, setCommandOpen] = useState(false);
  const [recentRecords, setRecentRecords] = useState<PgdcnRecentRecord[]>([]);
  const [focusedPgdRequestId, setFocusedPgdRequestId] = useState<string | undefined>(initialPgdRequestId);

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
    if (initialDomain === 'PCN') setActiveTarget({ domain: 'PCN', section: initialPcnDraftingOpen || initialPcnDraftDossierId ? 'drafting' : 'proposals' });
    else if (initialDomain === 'PGD') setActiveTarget({ domain: 'PGD', section: initialPgdDraftingOpen ? 'templates' : 'requests' });
  }, [initialDomain, initialPcnDraftingOpen, initialPcnDraftDossierId, initialPgdDraftingOpen]);

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
  useEffect(() => {
    if (!sessionChecked || !currentUser) return;
    if (scopes.includes('PCN')) void pcn.load().catch(() => undefined);
    if (scopes.includes('PGD')) void pgd.load().catch(() => undefined);
  }, [currentUser, pgd.load, pcn.load, scopes.join('|'), sessionChecked]);

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
      toast.error(error?.message || 'Không thể tải notification phòng.');
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
    setAssistantContext(undefined);
    setActiveTarget(target);
    setMobileOpen(false);
    if (initialPcnDossierId || initialPgdRequestId) {
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
      toast.error(error?.message || 'Không thể đánh dấu notification đã đọc.');
    }
  };
  const handleMarkAllNotificationsRead = async () => {
    try {
      await markAllPgdcnNotificationsRead();
      setNotifications((items) => items.map((item) => ({ ...item, read: true })));
    } catch (error: any) {
      toast.error(error?.message || 'Không thể đánh dấu tất cả notification đã đọc.');
    }
  };
  const handleClearNotifications = async () => {
    try {
      await clearPgdcnNotifications();
      setNotifications([]);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa notification.');
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
    setAssistantContext(undefined);
    setFocusedPgdRequestId(undefined);
    setMobileOpen(false);
    if (!dossierId) return;
    const query = initialTab ? `?tab=${encodeURIComponent(initialTab)}` : '';
    router.push(`/pgdcn/pcn/dossiers/${encodeURIComponent(dossierId)}${query}`);
  };
  const openPgdRequest = (requestId: string) => {
    setAssistantContext(undefined);
    setActiveTarget({ domain: 'PGD', section: 'requests' });
    setMobileOpen(false);
    if (!requestId) return;
    router.push(`/pgdcn/pgd/dossiers/${encodeURIComponent(requestId)}`);
  };
  const openPcnWorkspace = () => {
    setFocusedPgdRequestId(undefined);
    setActiveTarget({ domain: 'PCN', section: 'proposals' });
    setMobileOpen(false);
  };
  const openPgdWorkspace = () => {
    setActiveTarget({ domain: 'PGD', section: 'requests' });
    setMobileOpen(false);
  };

  const openPcnContextualAssistant = (dossierId: string) => {
    if (!dossierId) return;
    setAssistantContext({ domain: 'PCN', recordId: dossierId });
    setActiveTarget({ domain: 'department', section: 'assistant' });
    setMobileOpen(false);
  };
  const openPgdContextualAssistant = (requestId: string) => {
    if (!requestId) return;
    setAssistantContext({ domain: 'PGD', recordId: requestId });
    setActiveTarget({ domain: 'department', section: 'assistant' });
    setMobileOpen(false);
  };

  const openPcnSection = (section: PcnSection) => {
    setActiveTarget(getSharedTargetForPcnSection(section) || { domain: 'PCN', section });
  };

  const openPgdSection = (section: PgdSection) => {
    setFocusedPgdRequestId(undefined);
    setActiveTarget(getSharedTargetForPgdSection(section) || { domain: 'PGD', section });
  };

  const content = activeTarget.domain === 'department' && (activeTarget.section === 'department-dashboard' || activeTarget.section === 'my-work') ? (
    <PgdcnDashboardView scopes={scopes} pcnDossiers={pcn.dossiers} pcnProposals={pcn.proposals} pcnWorkflowTasks={pcn.workflowTasks} pgdRequests={pgd.requests} pgdAssignments={pgd.assignments} pcnEvidenceActions={pcnEvidenceActions} currentUser={currentUser} notifications={notifications} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} onOpenPcnWorkspace={openPcnWorkspace} onOpenPgdWorkspace={openPgdWorkspace} onOpenNotifications={handleOpenNotifications} onSelectNotification={handleDashboardNotificationSelect} recentRecords={recentRecords} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'customers' ? (
    <PgdcnCustomersView scopes={scopes} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'dossier-templates' ? (
    <PgdcnDossierTemplateManagementView currentUser={currentUser} pcnTemplates={pcn.workflowTemplates} pcnRequirements={pcn.documentRequirements} pgdTemplates={pgd.workflowTemplates} pgdRequirements={PGD_TEMPLATE_REQUIREMENTS} onCreatePcnWorkflowTemplate={pcn.createWorkflowTemplate} onUpdatePcnWorkflowTemplate={pcn.updateWorkflowTemplate} onCreatePcnWorkflowRevision={pcn.createWorkflowRevision} onPublishPcnWorkflowTemplate={pcn.publishWorkflowTemplate} onRetirePcnWorkflowTemplate={pcn.retireWorkflowTemplate} onCreatePgdWorkflowTemplate={pgd.createWorkflowTemplate} onUpdatePgdWorkflowTemplate={pgd.updateWorkflowTemplate} onCreatePgdWorkflowRevision={pgd.createWorkflowRevision} onPublishPgdWorkflowTemplate={pgd.publishWorkflowTemplate} onRetirePgdWorkflowTemplate={pgd.retireWorkflowTemplate} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'system-settings' ? (
    <PgdcnSystemSettingsView currentUser={currentUser} users={systemUsers} roles={pcn.departmentRoles} fields={pcn.fields} onCreate={pcn.addPcnUser} onUpdate={pcn.updatePcnUser} onDelete={pcn.deletePcnUser} onResetPassword={pcn.resetPcnUserPassword} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'activityLogs' ? (
    <ActivityLogView currentUser={currentUser} systemUsers={systemUsers} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'assistant' ? (
    <PgdcnAssistantView currentUser={currentUser} pcnDossiers={pcn.dossiers} pcnProposals={pcn.proposals} pcnRequirements={pcn.documentRequirements} pcnDocuments={pcn.dossierDocuments} pcnLabRequests={pcn.labRequests} pcnSampleLots={pcn.sampleLots} pcnSampleItems={pcn.sampleItems} pcnSampleRoutes={pcn.sampleRoutes} pcnReturnedResults={pcn.returnedResults} pgdRequests={pgd.requests} pgdAssignments={pgd.assignments} pgdFieldInspections={pgd.fieldInspections} pgdSamples={pgd.samples} pgdLabRequests={pgd.labRequests} pgdLabResults={pgd.labResults} pgdReports={pgd.reports} pgdCertificates={pgd.certificates} pgdApprovals={pgd.approvals} pgdInspectionPlans={pgd.inspectionPlans} pgdCaseEvents={pgd.caseEvents} pgdFieldActivityLogs={pgd.fieldActivityLogs} pgdLabResultReviews={pgd.labResultReviews} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} initialDomain={assistantContext?.domain} initialPcnDossierId={assistantContext?.domain === 'PCN' ? assistantContext.recordId : undefined} initialPgdRequestId={assistantContext?.domain === 'PGD' ? assistantContext.recordId : undefined} />
  ) : activeTarget.domain === 'PCN' ? (
    <PcnWorkspace embedded initialSection={activeTarget.section as PcnSection} initialDossierId={initialPcnDossierId} initialDossierTab={initialPcnDossierTab} initialDossierNodeId={initialPcnDossierNodeId} initialDraftDossierId={initialPcnDraftDossierId} initialDraftRequirementId={initialPcnDraftRequirementId} initialDraftNodeId={initialPcnDraftNodeId} initialDraftKind={initialPcnDraftKind} initialDraftReturnTo={initialPcnDraftReturnTo} standaloneDossier={Boolean(initialPcnDossierId)} onActiveSectionChange={openPcnSection} onOpenContextualAssistant={openPcnContextualAssistant} />
  ) : (
    <PgdWorkspace embedded initialSection={activeTarget.section as PgdSection} initialRequestId={focusedPgdRequestId} initialRequestStep={initialPgdRequestStep} initialDraftingOpen={Boolean(initialPgdDraftingOpen)} initialDraftRequestId={initialPgdDraftRequestId} initialDraftRequirementCode={initialPgdDraftRequirementCode} initialDraftTemplateKind={initialPgdDraftTemplateKind} initialDraftReturnTo={initialPgdDraftReturnTo} onRequestClose={() => { setFocusedPgdRequestId(undefined); if (initialPgdRequestId) router.replace('/pgdcn/pgd'); }} onActiveSectionChange={openPgdSection} onOpenContextualAssistant={openPgdContextualAssistant} />
  );

  return <div className="app-compact flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800">
    <Toaster position="top-right" richColors />
    <a href="#pgdcn-main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500">Bỏ qua điều hướng đến nội dung chính</a>
    <PgdcnSidebar currentUser={currentUser} activeTarget={activeTarget} collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setCollapsed((value) => !value)} onNavigate={navigate} onCloseMobile={() => setMobileOpen(false)} onOpenPersonalSettings={() => setPersonalSettingsOpen(true)} onLogout={handleLogout} />
    <div className="flex min-w-0 flex-1 flex-col">
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
              Phòng Giám định - Chứng nhận và Phát triển thị trường · TVCI
            </div>
            <div data-testid="pgdcn-mobile-context" className="truncate text-[11px] font-semibold text-slate-600 lg:hidden">
              {getActiveContextLabel(activeTarget)}
            </div>
            <div className="hidden truncate text-[11px] font-medium text-slate-500 lg:block">
              Hệ thống điều hành & Mở hồ sơ kiểm định - chứng nhận chuyên ngành
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (scopes.includes('PCN')) void pcn.load(true);
              if (scopes.includes('PGD')) void pgd.load(true);
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
      <main id="pgdcn-main-content" tabIndex={-1} aria-label="Không gian làm việc PCN và PGD" className="mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">{content}</main>
    </div>
<PgdcnCommandPalette open={commandOpen} scopes={scopes} records={commandRecords} onClose={() => setCommandOpen(false)} onNavigate={navigate} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} onOpenPcnWorkspace={openPcnWorkspace} onOpenPgdWorkspace={openPgdWorkspace} />
    <span className="sr-only" aria-live="polite" aria-atomic="true">{getActiveContextLabel(activeTarget)}</span>
    <nav className="sr-only" aria-label="Điều hướng PGDCN">{activeTarget.domain}</nav>
    {personalSettingsOpen && <PcnPersonalSettingsPanel currentUser={currentUser} onClose={() => setPersonalSettingsOpen(false)} />}
  </div>;
}
