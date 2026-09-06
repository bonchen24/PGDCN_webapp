'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';
import { toast } from 'sonner';

import type { AppNotification, DepartmentScope } from '../types';
import { getPcnSession, clearPcnSession } from '../utils/pcnAuthApi';
import { usePcnSessionStore } from '../utils/pcnSessionState';
import { usePcnStore } from '../store-pcn';
import { usePgdStore } from '../store-pgd';
import { clearPgdcnNotifications, fetchPgdcnNotifications, markAllPgdcnNotificationsRead, markPgdcnNotificationRead } from '../utils/pgdcnNotificationApi';
import { getPgdcnNotificationNavigation } from '../utils/pgdcnNotification';
import { getPcnNotificationDossierTab } from '../utils/pcnDossierNavigation';
import PcnLoginScreen from './PcnLoginScreen';
import PcnWorkspace from './PcnWorkspace';
import PgdWorkspace from './PgdWorkspace';
import { ActivityLogView } from './ActivityLogView';
import PgdcnSidebar, { type PgdcnDomain, type PgdcnNavigationTarget } from './PgdcnSidebar';
import PgdcnDashboardView from './PgdcnDashboardView';
import PgdcnAssistantView from './PgdcnAssistantView';
import PgdcnCustomersView from './PgdcnCustomersView';
import PgdcnSystemSettingsView from './PgdcnSystemSettingsView';
import { PgdcnNotificationDropdown } from './PgdcnNotificationDropdown';
import PcnPersonalSettingsPanel from './PcnPersonalSettingsPanel';
import type { PcnSection } from '../utils/pcnNavigation';
import type { PcnDossierDetailTab } from '../utils/pcnDossierNavigation';
import type { PgdSection } from './PgdSidebar';

type PgdcnAppShellProps = {
  initialDomain?: PgdcnDomain;
  initialPcnDossierId?: string;
  initialPcnDossierTab?: PcnDossierDetailTab;
  initialPcnDossierNodeId?: string;
};

const getScopes = (value: readonly DepartmentScope[] | undefined): DepartmentScope[] => Array.from(new Set((value || []).filter((scope): scope is DepartmentScope => scope === 'PCN' || scope === 'PGD')));

const getActiveContextLabel = (target: PgdcnNavigationTarget): string => {
  if (target.domain === 'department') {
    if (target.section === 'department-dashboard') return 'Tổng quan phòng';
    if (target.section === 'customers') return 'Khách hàng';
    if (target.section === 'assistant') return 'Trợ lý AI';
    if (target.section === 'activityLogs') return 'Nhật ký hoạt động';
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
  return 'Soạn thảo tài liệu';
};

const getSharedTargetForPcnSection = (section: PcnSection): PgdcnNavigationTarget | undefined => {
  if (section === 'dashboard') return { domain: 'department', section: 'department-dashboard' };
  if (section === 'customers') return { domain: 'department', section: 'customers' };
  if (section === 'users' || section === 'settings') return { domain: 'department', section: 'system-settings' };
  return undefined;
};

const getSharedTargetForPgdSection = (section: PgdSection): PgdcnNavigationTarget | undefined => {
  if (section === 'dashboard') return { domain: 'department', section: 'department-dashboard' };
  return undefined;
};

export default function PgdcnAppShell({ initialDomain = 'department', initialPcnDossierId, initialPcnDossierTab, initialPcnDossierNodeId }: PgdcnAppShellProps) {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const setCurrentUser = usePcnSessionStore((state) => state.setCurrentUser);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);
  const pcn = usePcnStore();
  const pgd = usePgdStore();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [activeTarget, setActiveTarget] = useState<PgdcnNavigationTarget>(() => initialDomain === 'PCN'
    ? { domain: 'PCN', section: 'proposals' }
    : initialDomain === 'PGD' ? { domain: 'PGD', section: 'requests' } : { domain: 'department', section: 'department-dashboard' });
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [personalSettingsOpen, setPersonalSettingsOpen] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);

  useEffect(() => {
    if (initialDomain === 'PCN') setActiveTarget({ domain: 'PCN', section: 'proposals' });
    else if (initialDomain === 'PGD') setActiveTarget({ domain: 'PGD', section: 'requests' });
  }, [initialDomain]);

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

  if (!sessionChecked) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-50 text-xs font-bold text-slate-700">Đang xác thực phiên PGDCN...</div>;
  if (!currentUser) return <PcnLoginScreen />;

  const navigate = (target: PgdcnNavigationTarget) => {
    setActiveTarget(target);
    setMobileOpen(false);
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
      setActiveTarget({ domain: 'PCN', section: target.section });
    } else if (target.domain === 'PGD') {
      setActiveTarget({ domain: 'PGD', section: target.section });
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
    setMobileOpen(false);
    if (!dossierId) return;
    const query = initialTab ? `?tab=${encodeURIComponent(initialTab)}` : '';
    router.push(`/pgdcn/pcn/dossiers/${encodeURIComponent(dossierId)}${query}`);
  };
  const openPgdRequest = (requestId: string) => {
    setActiveTarget({ domain: 'PGD', section: 'requests' });
    setMobileOpen(false);
    if (!requestId) return;
  };
  const openPcnWorkspace = () => {
    setActiveTarget({ domain: 'PCN', section: 'proposals' });
    setMobileOpen(false);
  };
  const openPgdWorkspace = () => {
    setActiveTarget({ domain: 'PGD', section: 'requests' });
    setMobileOpen(false);
  };

  const openPcnSection = (section: PcnSection) => {
    setActiveTarget(getSharedTargetForPcnSection(section) || { domain: 'PCN', section });
  };

  const openPgdSection = (section: PgdSection) => {
    setActiveTarget(getSharedTargetForPgdSection(section) || { domain: 'PGD', section });
  };

  const content = activeTarget.domain === 'department' && activeTarget.section === 'department-dashboard' ? (
    <PgdcnDashboardView scopes={scopes} pcnDossiers={pcn.dossiers} pgdRequests={pgd.requests} notifications={notifications} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} onOpenPcnWorkspace={openPcnWorkspace} onOpenPgdWorkspace={openPgdWorkspace} onOpenNotifications={handleOpenNotifications} onSelectNotification={handleDashboardNotificationSelect} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'customers' ? (
    <PgdcnCustomersView scopes={scopes} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'system-settings' ? (
    <PgdcnSystemSettingsView currentUser={currentUser} users={systemUsers} roles={pcn.departmentRoles} fields={pcn.fields} pcnTemplates={pcn.templates} onUploadPcnTemplate={pcn.uploadPcnTemplate} onReviewPcnTemplate={pcn.reviewPcnTemplate} onCreate={pcn.addPcnUser} onUpdate={pcn.updatePcnUser} onDelete={pcn.deletePcnUser} onResetPassword={pcn.resetPcnUserPassword} workflowTemplates={pcn.workflowTemplates} onCreateWorkflowRevision={pcn.createWorkflowRevision} onPublishWorkflowTemplate={pcn.publishWorkflowTemplate} onRetireWorkflowTemplate={pcn.retireWorkflowTemplate} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'activityLogs' ? (
    <ActivityLogView currentUser={currentUser} systemUsers={systemUsers} />
  ) : activeTarget.domain === 'department' && activeTarget.section === 'assistant' ? (
    <PgdcnAssistantView currentUser={currentUser} pcnDossiers={pcn.dossiers} pcnProposals={pcn.proposals} pcnRequirements={pcn.documentRequirements} pcnDocuments={pcn.dossierDocuments} pcnLabRequests={pcn.labRequests} pcnSampleLots={pcn.sampleLots} pcnSampleRoutes={pcn.sampleRoutes} pcnReturnedResults={pcn.returnedResults} pgdRequests={pgd.requests} pgdAssignments={pgd.assignments} pgdFieldInspections={pgd.fieldInspections} pgdSamples={pgd.samples} pgdLabRequests={pgd.labRequests} pgdLabResults={pgd.labResults} pgdReports={pgd.reports} pgdCertificates={pgd.certificates} pgdApprovals={pgd.approvals} onOpenPcn={openPcnDossier} onOpenPgd={openPgdRequest} />
  ) : activeTarget.domain === 'PCN' ? (
    <PcnWorkspace embedded initialSection={activeTarget.section as PcnSection} initialDossierId={initialPcnDossierId} initialDossierTab={initialPcnDossierTab} initialDossierNodeId={initialPcnDossierNodeId} standaloneDossier={Boolean(initialPcnDossierId)} onActiveSectionChange={openPcnSection} />
  ) : (
    <PgdWorkspace embedded initialSection={activeTarget.section as PgdSection} onActiveSectionChange={openPgdSection} />
  );

  return <div className="flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800">
    <Toaster position="top-right" richColors />
    <PgdcnSidebar currentUser={currentUser} activeTarget={activeTarget} collapsed={collapsed} mobileOpen={mobileOpen} onToggle={() => setCollapsed((value) => !value)} onNavigate={navigate} onCloseMobile={() => setMobileOpen(false)} onOpenPersonalSettings={() => setPersonalSettingsOpen(true)} onLogout={handleLogout} />
    <div className="flex min-w-0 flex-1 flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-3 shadow-sm md:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Mở menu phòng" className="mobile-touch-target rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden">☰</button>
          <div className="min-w-0"><div className="truncate text-[10px] font-black uppercase tracking-wider text-slate-700">IEMM • TVCI · {getActiveContextLabel(activeTarget)}</div><div className="truncate text-xs font-bold text-slate-500">Phòng Giám định - Chứng nhận · một phiên, hai lĩnh vực</div></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <PgdcnNotificationDropdown isOpen={notificationOpen} onToggle={handleToggleNotifications} onClose={() => setNotificationOpen(false)} notifications={notifications} currentUser={currentUser} onMarkRead={handleMarkNotificationRead} onMarkAllRead={handleMarkAllNotificationsRead} onClear={handleClearNotifications} onSelect={handleNotificationSelect} />
          <div className="hidden text-[10px] font-bold text-slate-400 sm:block">{currentUser.username}</div>
        </div>
      </header>
      <main className="mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">{content}</main>
    </div>
    <nav className="sr-only" aria-label="Điều hướng PGDCN">{activeTarget.domain}</nav>
    {personalSettingsOpen && <PcnPersonalSettingsPanel currentUser={currentUser} onClose={() => setPersonalSettingsOpen(false)} />}
  </div>;
}
