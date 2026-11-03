'use client';

import React, { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'sonner';

import { SidebarProvider } from '@/hooks/use-sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { CommandPalette } from '@/components/layout/command-palette';
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
      <div className="flex min-h-screen w-full items-center justify-center bg-slate-900 text-slate-300">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <p className="text-xs font-semibold tracking-wide">Đang xác thực phiên làm việc PGDCN...</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden bg-slate-50 text-slate-800 antialiased font-sans">
        <Toaster position="top-right" richColors />

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
          <main id="main-content" className="flex-1 overflow-x-hidden overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Global Search Command Palette */}
        <CommandPalette
          open={commandOpen}
          onClose={() => setCommandOpen(false)}
          currentUser={currentUser}
        />
      </div>
    </SidebarProvider>
  );
}
