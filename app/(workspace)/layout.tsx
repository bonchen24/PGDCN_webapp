'use client';

import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Toaster } from 'sonner';

import { SidebarProvider } from '@/hooks/use-sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { CommandPalette } from '@/components/layout/command-palette';
import PgdcnQuickViewDrawer, { type QuickViewDossierItem } from '@/components/PgdcnQuickViewDrawer';
import { getPcnSession } from '@/utils/pcnAuthApi';
import { usePcnSessionStore } from '@/utils/pcnSessionState';
import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const currentUser = usePcnSessionStore((state) => state.currentUser);
  const setCurrentUser = usePcnSessionStore((state) => state.setCurrentUser);
  const clearCurrentUser = usePcnSessionStore((state) => state.clearCurrentUser);

  const pcn = usePcnStore();
  const pgd = usePgdStore();
  const loadPcn = usePcnStore((state) => state.load);
  const loadPgd = usePgdStore((state) => state.load);

  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<'checking' | 'authenticated' | 'expired' | 'error'>('checking');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [quickViewDrawer, setQuickViewDrawer] = useState<{
    open: boolean;
    domain?: 'PCN' | 'PGD';
    dossierCode?: string;
    item?: QuickViewDossierItem | null;
  }>({ open: false });

  const closeQuickView = useCallback(() => {
    setQuickViewDrawer((prev) => ({ ...prev, open: false }));
  }, []);

  useEffect(() => {
    const handleQuickViewEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{ domain: 'PCN' | 'PGD'; dossierCode?: string; item?: QuickViewDossierItem }>;
      if (customEvent.detail) {
        setQuickViewDrawer({
          open: true,
          domain: customEvent.detail.domain,
          dossierCode: customEvent.detail.dossierCode,
          item: customEvent.detail.item || null,
        });
      }
    };
    window.addEventListener('pgdcn:quickview', handleQuickViewEvent);
    return () => window.removeEventListener('pgdcn:quickview', handleQuickViewEvent);
  }, []);

  const handleQuickViewOpenFullDetail = useCallback((domain: 'PCN' | 'PGD', idOrCode: string) => {
    closeQuickView();
    if (domain === 'PCN') {
      const dossier = pcn.dossiers.find((d) => d.id === idOrCode || d.dossierCode === idOrCode);
      const targetId = dossier?.id || idOrCode;
      if (targetId) router.push(`/pcn/dossiers/${encodeURIComponent(targetId)}`);
    } else {
      const req = pgd.requests.find((r) => r.id === idOrCode || r.requestCode === idOrCode);
      const targetId = req?.id || idOrCode;
      if (targetId) router.push(`/pgd/dossiers/${encodeURIComponent(targetId)}`);
    }
  }, [closeQuickView, pcn.dossiers, pgd.requests, router]);

  // Check session on initial workspace load
  const loadSession = useCallback(async () => {
    setSessionStatus('checking');
    setErrorMessage(null);

    try {
      const session = await getPcnSession();
      if (session && session.authenticated && session.user) {
        setCurrentUser(session.user);
        setSessionChecked(true);
        setSessionStatus('authenticated');

        // Bootstrap subsystem stores based on user scope
        const scopes = session.user.departmentScopes || [];
        if (scopes.length === 0 || scopes.includes('PCN') || session.user.systemRole === 'admin') {
          void loadPcn().catch(() => {});
        }
        if (scopes.length === 0 || scopes.includes('PGD') || session.user.systemRole === 'admin') {
          void loadPgd().catch(() => {});
        }
      } else {
        clearCurrentUser();
        setSessionStatus('expired');
        const currentPath = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '/';
        const safeReturn = currentPath.startsWith('/') && !currentPath.startsWith('//') && !currentPath.startsWith('/\\') ? currentPath : '/';
        router.replace(`/login?reason=session-expired&returnTo=${encodeURIComponent(safeReturn)}`);
      }
    } catch (err: any) {
      clearCurrentUser();
      setSessionStatus('error');
      setErrorMessage(err?.message || 'Lỗi kết nối máy chủ khi kiểm tra phiên đăng nhập.');
    }
  }, [clearCurrentUser, loadPcn, loadPgd, router, setCurrentUser]);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (sessionStatus === 'expired') {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-amber-600 border-t-transparent" />
          <p className="text-sm font-bold text-slate-800">Phiên đăng nhập đã hết hạn.</p>
          <p className="text-xs text-slate-500">Đang chuyển hướng đến trang đăng nhập...</p>
        </div>
      </div>
    );
  }

  if (sessionStatus === 'error') {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-50 p-4 text-slate-700">
        <div className="max-w-md w-full rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle size={20} />
          </div>
          <h2 className="text-sm font-bold text-slate-900">Không thể xác thực phiên làm việc</h2>
          <p className="mt-1 text-xs text-slate-600">{errorMessage || 'Lỗi kết nối máy chủ khi kiểm tra phiên đăng nhập.'}</p>
          <button
            type="button"
            onClick={() => void loadSession()}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-500 active:bg-emerald-700 cursor-pointer"
          >
            <RefreshCw size={14} />
            <span>Thử lại</span>
          </button>
        </div>
      </div>
    );
  }

  // Display minimal loading indicator while validating session
  if (!sessionChecked || !currentUser) {
    return (
      <div className="flex min-h-[100dvh] w-full items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
          <p className="text-xs font-bold">Đang xác thực phiên PGDCN...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="app-compact flex h-[100dvh] w-full overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans">
        <Toaster position="top-right" richColors />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-xs focus:font-semibold focus:text-slate-900 focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          Bỏ qua điều hướng đến nội dung chính
        </a>

        {/* Persistent Collapsible Sidebar */}
        <AppSidebar currentUser={currentUser} />

        {/* Content Shell */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Header */}
          <AppHeader
            currentUser={currentUser}
            onOpenCommand={() => setCommandOpen(true)}
            onRefreshData={() => {
              void pcn.load(true);
              void pgd.load(true);
            }}
          />

          {/* Main Content Area */}
          <main id="main-content" tabIndex={-1} className="mobile-scroll-y min-h-0 min-w-0 flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Global Search Command Palette */}
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          currentUser={currentUser}
        />

        <PgdcnQuickViewDrawer
          open={quickViewDrawer.open}
          domain={quickViewDrawer.domain}
          dossierCode={quickViewDrawer.dossierCode}
          item={quickViewDrawer.item}
          onClose={closeQuickView}
          onOpenFullDetail={handleQuickViewOpenFullDetail}
        />
      </div>
    </SidebarProvider>
  );
}
