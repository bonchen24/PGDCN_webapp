'use client';

import { type ElementType } from 'react';
import {
  ClipboardCheck,
  ClipboardList,
  FilePlus2,
  FileText,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Menu,
  ShieldCheck,
  X,
} from 'lucide-react';

import type { PcnUserAccount } from '../types';

export type PgdSection = 'dashboard' | 'requests' | 'operations' | 'sample-operations' | 'preparation' | 'field' | 'labs' | 'results' | 'templates';
export type PgdEntrySection = PgdSection | 'intake';

export const PGD_SECTION_LABELS: Record<PgdSection, string> = {
  dashboard: 'Tổng quan PGD',
  requests: 'Hồ sơ PYC',
  operations: 'Sổ tổng hợp',
  'sample-operations': 'Sổ quản lý mẫu',
  preparation: 'Chuẩn bị & Phân công',
  field: 'Hiện trường & Lấy mẫu',
  labs: 'PTN & Kết quả',
  results: 'Báo cáo, Chứng thư & Lưu trữ',
  templates: 'Soạn thảo tài liệu',
};

export const PGD_SECTION_ICONS: Record<PgdSection, ElementType> = {
  dashboard: LayoutDashboard,
  requests: ClipboardList,
  operations: ClipboardCheck,
  'sample-operations': FlaskConical,
  preparation: FilePlus2,
  field: ClipboardCheck,
  labs: FlaskConical,
  results: FileText,
  templates: FileText,
};

type PgdSidebarProps = {
  currentUser: PcnUserAccount;
  activeSection: PgdSection;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  onNavigate: (section: PgdSection) => void;
  onCloseMobile: () => void;
  onLogout: () => void;
};

export default function PgdSidebar({
  currentUser,
  activeSection,
  collapsed,
  mobileOpen,
  onToggle,
  onNavigate,
  onCloseMobile,
  onLogout,
}: PgdSidebarProps) {
  const expanded = !collapsed || mobileOpen;
  const mainSections: PgdSection[] = ['dashboard', 'requests', 'operations', 'sample-operations', 'templates'];
  const renderButton = (section: PgdSection) => {
    const Icon = PGD_SECTION_ICONS[section];
    const isActive = activeSection === section;
    return (
      <button
        type="button"
        key={section}
        onClick={() => onNavigate(section)}
        aria-label={PGD_SECTION_LABELS[section]}
        aria-current={isActive ? 'page' : undefined}
        title={PGD_SECTION_LABELS[section]}
        className={`group flex min-h-9 w-full items-center rounded-lg text-left transition-colors ${expanded ? 'gap-2 px-2.5' : 'justify-center px-1'} ${isActive ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-100'}`}
      >
        <Icon size={16} className={isActive ? 'text-white' : 'text-slate-400'} />
        {expanded && <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{PGD_SECTION_LABELS[section]}</span>}
      </button>
    );
  };

  return (
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-950 text-slate-200 shadow-2xl transition-all duration-300 lg:static lg:translate-x-0 ${collapsed ? 'lg:w-16' : 'lg:w-64'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className={`flex h-16 items-center border-b border-slate-800 p-4 ${expanded ? 'gap-3' : 'justify-center'}`}>
        <img src="/icons/iemm-logo-32.png" alt="IEMM • TVCI" className="h-8 w-8 shrink-0 rounded-lg bg-white object-contain p-0.5" />
        {expanded && <div className="min-w-0"><div className="truncate text-xs font-black uppercase tracking-wide text-white">IEMM • TVCI</div><div className="mt-1 truncate text-[9px] font-bold leading-none tracking-widest text-blue-300">PHÒNG GIÁM ĐỊNH, CHỨNG NHẬN, PHÁT TRIỂN THỊ TRƯỜNG</div></div>}
        <button type="button" onClick={onCloseMobile} aria-label="Đóng menu PGD" className="ml-auto text-slate-400 lg:hidden"><X size={18} /></button>
      </div>

      <nav className="mobile-scroll-y flex-1 space-y-0.5 overflow-y-auto px-2 py-3" aria-label="Menu Phòng Giám định">
        {mainSections.map(renderButton)}
      </nav>

      <div className={`shrink-0 border-t border-slate-800 p-3 ${expanded ? 'space-y-2' : ''}`}>
        <button type="button" onClick={onToggle} className={`hidden min-h-10 w-full items-center rounded-lg text-left text-[10px] font-bold text-slate-400 hover:bg-slate-800 lg:flex ${expanded ? 'gap-2 px-2' : 'justify-center'}`} title={expanded ? 'Thu gọn menu' : 'Mở rộng menu'}><Menu size={15} />{expanded && 'Thu gọn menu'}</button>
        <div className={`flex items-center ${expanded ? 'gap-2' : 'justify-center'}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-blue-500/30 bg-blue-500/10 text-xs font-black uppercase text-blue-300">{currentUser.name.split(' ').pop()?.slice(0, 2) || 'PG'}</span>
          {expanded && <div className="min-w-0 flex-1"><div className="truncate text-xs font-black text-slate-200">{currentUser.name}</div><div className="mt-1 flex items-center gap-1 truncate text-[9px] text-slate-500"><ShieldCheck size={11} />{currentUser.pgdRole || 'PGD user'}</div></div>}
        </div>
        {expanded && <button type="button" onClick={onLogout} className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-[10px] font-bold text-slate-400 hover:bg-rose-500/10 hover:text-rose-300"><LogOut size={14} /> Đăng xuất</button>}
      </div>
    </aside>
  );
}
