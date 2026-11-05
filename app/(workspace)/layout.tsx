'use client';

import React, { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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

  const [sessionChecked, setSessionChecked] = useState(false);
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
  useEffect(() => {
    let active = true;

    getPcnSession()
      .then((session) => {
        if (!active) return;
        if (session && session.authenticated && session.user) {
          setCurrentUser(session.user);
          setSessionChecked(true);

          // Bootstrap subsystem stores based on user scope
          const scopes = session.user.departmentScopes || [];
          if (scopes.length === 0 || scopes.includes('PCN') || session.user.systemRole === 'admin') {
            void pcn.load().catch(() => {});
          }
          if (scopes.length === 0 || scopes.includes('PGD') || session.user.systemRole === 'admin') {
            void pgd.load().catch(() => {});
          }
        } else {
          clearCurrentUser();
          router.replace('/login');
        }
      })
      .catch(() => {
        if (!active) return;
        clearCurrentUser();
        router.replace('/login');
      });

    return () => {
      active = false;
    };
  }, [clearCurrentUser, pcn.load, pgd.load, router, setCurrentUser]);

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
