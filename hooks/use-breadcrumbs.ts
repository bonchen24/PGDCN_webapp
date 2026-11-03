'use client';

import { useMemo } from 'react';
import { usePathname } from 'next/navigation';
import { create } from 'zustand';

export interface BreadcrumbItem {
  label: string;
  href?: string;
  isCurrent?: boolean;
}

interface BreadcrumbOverrideState {
  overrides: Record<string, string>; // path -> custom label (e.g. dossierId -> dossierCode)
  setOverride: (path: string, label: string) => void;
  clearOverride: (path: string) => void;
}

export const useBreadcrumbOverrideStore = create<BreadcrumbOverrideState>((set) => ({
  overrides: {},
  setOverride: (path, label) =>
    set((state) => ({ overrides: { ...state.overrides, [path]: label } })),
  clearOverride: (path) =>
    set((state) => {
      const next = { ...state.overrides };
      delete next[path];
      return { overrides: next };
    }),
}));

const STATIC_SEGMENT_LABELS: Record<string, string> = {
  pcn: 'Chứng nhận (PCN)',
  pgd: 'Giám định (PGD)',
  dossiers: 'Hồ sơ',
  templates: 'Bộ mẫu & Quy trình',
  drafting: 'Soạn thảo văn bản',
  customers: 'Khách hàng',
  'activity-logs': 'Nhật ký hoạt động',
  settings: 'Cài đặt hệ thống',
  rbac: 'Phân quyền RBAC',
};

export function useBreadcrumbs(): BreadcrumbItem[] {
  const pathname = usePathname();
  const overrides = useBreadcrumbOverrideStore((state) => state.overrides);

  return useMemo(() => {
    if (!pathname || pathname === '/') {
      return [{ label: 'Tổng quan', isCurrent: true }];
    }

    const segments = pathname.split('/').filter(Boolean);
    const crumbs: BreadcrumbItem[] = [
      { label: 'Trang chủ', href: '/' }
    ];

    let accumulatedPath = '';
    segments.forEach((segment, index) => {
      accumulatedPath += `/${segment}`;
      const isLast = index === segments.length - 1;

      // 1. Check override first (for dynamic dossier code, customer name, template code)
      const overrideLabel = overrides[accumulatedPath] || overrides[segment];

      // 2. Fall back to static mapped label or capitalized segment
      const label = overrideLabel || STATIC_SEGMENT_LABELS[segment.toLowerCase()] || decodeURIComponent(segment);

      crumbs.push({
        label,
        href: isLast ? undefined : accumulatedPath,
        isCurrent: isLast,
      });
    });

    return crumbs;
  }, [pathname, overrides]);
}
