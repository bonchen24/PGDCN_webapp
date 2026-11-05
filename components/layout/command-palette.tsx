'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Award,
  ClipboardCheck,
  Building2,
  FileEdit,
  GitBranch,
  Settings,
  Activity,
  ArrowRight,
  Clock,
  X,
} from 'lucide-react';

import type { PcnUserAccount } from '@/types';
import { usePcnStore } from '@/store-pcn';
import { usePgdStore } from '@/store-pgd';
import { getPgdcnDashboardStatusLabel } from '@/utils/pgdcnDashboard';

export interface CommandItem {
  id: string;
  category: 'quick-nav' | 'recent' | 'dossier';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  badge?: string;
  action: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  currentUser: PcnUserAccount;
}

const RECENT_SEARCHES_KEY = 'pgdcn_recent_command_searches';

export function CommandPalette({ open, onClose, currentUser }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const pcnDossiers = usePcnStore((state) => state.dossiers);
  const pgdRequests = usePgdStore((state) => state.requests);

  // Global Ctrl+K / Cmd+K listener
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setSelectedIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  // Read / write recent dossier visits
  const [recentVisits, setRecentVisits] = useState<Array<{ id: string; domain: 'PCN' | 'PGD'; code: string; name: string }>>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (raw) setRecentVisits(JSON.parse(raw));
    } catch {}
  }, [open]);

  const recordRecentVisit = (item: { id: string; domain: 'PCN' | 'PGD'; code: string; name: string }) => {
    try {
      const next = [item, ...recentVisits.filter((r) => r.id !== item.id)].slice(0, 5);
      setRecentVisits(next);
      localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
    } catch {}
  };

  const navShortcuts: CommandItem[] = [
    {
      id: 'nav-dashboard',
      category: 'quick-nav',
      title: 'Bàn làm việc tổng quan',
      subtitle: 'Xem việc của tôi, KPI và mốc hạn hồ sơ',
      icon: ArrowRight,
      action: () => router.push('/'),
    },
    {
      id: 'nav-pcn',
      category: 'quick-nav',
      title: 'Hàng đợi hồ sơ Chứng nhận (PCN)',
      subtitle: 'Quản lý danh sách hồ sơ chứng nhận 7 giai đoạn',
      icon: Award,
      badge: 'PCN',
      action: () => router.push('/pcn'),
    },
    {
      id: 'nav-pgd',
      category: 'quick-nav',
      title: 'Hàng đợi hồ sơ Giám định (PGD)',
      subtitle: 'Quản lý yêu cầu giám định và quy trình QC20',
      icon: ClipboardCheck,
      badge: 'PGD',
      action: () => router.push('/pgd'),
    },
    {
      id: 'nav-templates',
      category: 'quick-nav',
      title: 'Quản lý Hồ sơ mẫu & Quy trình',
      subtitle: 'Thiết kế cấu trúc 7 giai đoạn và tài liệu mẫu',
      icon: GitBranch,
      action: () => router.push('/templates'),
    },
    {
      id: 'nav-drafting',
      category: 'quick-nav',
      title: 'Studio Soạn thảo văn bản DOCX',
      subtitle: 'Điền biểu mẫu và xuất DOCX/PDF từ catalog template',
      icon: FileEdit,
      action: () => router.push('/drafting'),
    },
    {
      id: 'nav-customers',
      category: 'quick-nav',
      title: 'Danh bạ Khách hàng',
      subtitle: 'Tra cứu thông tin doanh nghiệp và liên hệ',
      icon: Building2,
      action: () => router.push('/customers'),
    },
    {
      id: 'nav-activity-logs',
      category: 'quick-nav',
      title: 'Nhật ký hoạt động hệ thống',
      subtitle: 'Tra cứu audit logs và lịch sử thao tác',
      icon: Activity,
      action: () => router.push('/activity-logs'),
    },
    {
      id: 'nav-settings',
      category: 'quick-nav',
      title: 'Cài đặt hệ thống & RBAC',
      subtitle: 'Phân quyền tài khoản và cấu hình vận hành',
      icon: Settings,
      action: () => router.push('/settings'),
    },
  ];

  // Search filtered items
  const filteredItems = useMemo<CommandItem[]>(() => {
    const q = query.trim().toLowerCase();

    // 1. If empty query, show recent visits then shortcuts
    if (!q) {
      const recentItems: CommandItem[] = recentVisits.map((visit) => ({
        id: `recent-${visit.id}`,
        category: 'recent',
        title: `${visit.code} · ${visit.name}`,
        subtitle: `Hồ sơ ${visit.domain} vừa truy cập gần đây`,
        icon: Clock,
        badge: visit.domain,
        action: () => {
          router.push(visit.domain === 'PCN' ? `/pcn/dossiers/${visit.id}` : `/pgd/dossiers/${visit.id}`);
        },
      }));
      return [...recentItems, ...navShortcuts];
    }

    // 2. Query matching: Search across dossiers
    const matchedDossiers: CommandItem[] = [];

    // PCN matches
    pcnDossiers.forEach((dossier) => {
      const code = (dossier.dossierCode || '').toLowerCase();
      const customer = (dossier.customerSnapshot?.name || '').toLowerCase();
      if (code.includes(q) || customer.includes(q)) {
        matchedDossiers.push({
          id: `pcn-${dossier.id}`,
          category: 'dossier',
          title: `${dossier.dossierCode || 'Chưa có mã'} · ${dossier.customerSnapshot?.name || 'Khách hàng'}`,
          subtitle: `Chứng nhận PCN · Trạng thái: ${getPgdcnDashboardStatusLabel('PCN', dossier.status)}`,
          icon: Award,
          badge: 'PCN',
          action: () => {
            recordRecentVisit({
              id: dossier.id,
              domain: 'PCN',
              code: dossier.dossierCode || dossier.id,
              name: dossier.customerSnapshot?.name || 'PCN',
            });
            router.push(`/pcn/dossiers/${dossier.id}`);
          },
        });
      }
    });

    // PGD matches
    pgdRequests.forEach((req) => {
      const code = (req.requestCode || '').toLowerCase();
      const customer = (req.customerSnapshot?.name || '').toLowerCase();
      if (code.includes(q) || customer.includes(q)) {
        matchedDossiers.push({
          id: `pgd-${req.id}`,
          category: 'dossier',
          title: `${req.requestCode || 'Chưa có mã'} · ${req.customerSnapshot?.name || 'Khách hàng'}`,
          subtitle: `Giám định PGD · Trạng thái: ${getPgdcnDashboardStatusLabel('PGD', req.status)}`,
          icon: ClipboardCheck,
          badge: 'PGD',
          action: () => {
            recordRecentVisit({
              id: req.id,
              domain: 'PGD',
              code: req.requestCode || req.id,
              name: req.customerSnapshot?.name || 'PGD',
            });
            router.push(`/pgd/dossiers/${req.id}`);
          },
        });
      }
    });

    // Nav shortcut matches
    const matchedNav = navShortcuts.filter(
      (item) => item.title.toLowerCase().includes(q) || (item.subtitle && item.subtitle.toLowerCase().includes(q))
    );

    return [...matchedDossiers.slice(0, 15), ...matchedNav];
  }, [query, recentVisits, pcnDossiers, pgdRequests, router]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Palette Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Tìm kiếm toàn hệ thống"
        className="relative z-50 w-full max-w-xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Search Input Bar */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/70 px-3 py-2.5">
          <Search size={16} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm kiếm mã hồ sơ, khách hàng, hoặc lối tắt (Ctrl+K)..."
            className="ml-2.5 flex-1 bg-transparent text-xs font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 cursor-pointer"
            aria-label="Đóng bảng tìm kiếm"
          >
            <X size={15} />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-1.5" role="listbox">
          {filteredItems.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Không tìm thấy hồ sơ hoặc lối tắt phù hợp với &quot;{query}&quot;
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              const Icon = item.icon;

              return (
                <div
                  key={item.id}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    isSelected ? 'bg-emerald-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <Icon size={15} className={`shrink-0 ${isSelected ? 'text-white' : 'text-slate-400'}`} />
                    <div className="min-w-0">
                      <p className={`truncate font-semibold ${isSelected ? 'text-white' : 'text-slate-900'}`}>{item.title}</p>
                      {item.subtitle && (
                        <p className={`truncate text-[10px] ${isSelected ? 'text-emerald-100' : 'text-slate-500'}`}>
                          {item.subtitle}
                        </p>
                      )}
                    </div>
                  </div>
                  {item.badge && (
                    <span
                      className={`ml-2 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${
                        isSelected
                          ? 'bg-white/20 text-white'
                          : item.badge === 'PCN'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : item.badge === 'PGD'
                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Hints */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-500">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[9px] text-slate-600">↑↓</kbd> Di chuyển
            </span>
            <span>
              <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[9px] text-slate-600">Enter</kbd> Chọn
            </span>
            <span>
              <kbd className="rounded border border-slate-300 bg-white px-1 font-mono text-[9px] text-slate-600">Esc</kbd> Đóng
            </span>
          </div>
          <span>Tìm kiếm nhanh PGDCN</span>
        </div>
      </div>
    </div>
  );
}
