'use client';

import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export interface SidebarContextType {
  collapsed: boolean;
  mobileOpen: boolean;
  toggleCollapse: () => void;
  setCollapsed: (value: boolean) => void;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
}

export const SidebarContext = createContext<SidebarContextType | null>(null);

const SIDEBAR_STORAGE_KEY = 'pgdcn_sidebar_collapsed';

export function SidebarProvider({ children, defaultCollapsed = false }: { children: ReactNode; defaultCollapsed?: boolean }) {
  const [collapsed, setCollapsedState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return defaultCollapsed;
    try {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored !== null ? stored === 'true' : defaultCollapsed;
    } catch {
      return defaultCollapsed;
    }
  });

  const [mobileOpen, setMobileOpen] = useState(false);

  const setCollapsed = (val: boolean) => {
    setCollapsedState(val);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(val));
    } catch {}
  };

  const toggleCollapse = () => setCollapsed(!collapsed);
  const openMobile = () => setMobileOpen(true);
  const closeMobile = () => setMobileOpen(false);
  const toggleMobile = () => setMobileOpen((prev) => !prev);

  // Close mobile drawer on resize to desktop
  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const handleMediaChange = (e: MediaQueryListEvent) => {
      if (e.matches) setMobileOpen(false);
    };
    mediaQuery.addEventListener('change', handleMediaChange);
    return () => mediaQuery.removeEventListener('change', handleMediaChange);
  }, []);

  return React.createElement(
    SidebarContext.Provider,
    {
      value: {
        collapsed,
        mobileOpen,
        toggleCollapse,
        setCollapsed,
        openMobile,
        closeMobile,
        toggleMobile,
      },
    },
    children
  );
}

export function useSidebar(): SidebarContextType {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
