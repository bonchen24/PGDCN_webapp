'use client';

import { Settings2, ShieldCheck, Users } from 'lucide-react';

import type { PcnCertificationField, PcnUserAccount, UserAccount } from '../types';
import type { PcnDepartmentRole, PcnUserInput } from '../utils/pcnUserApi';
import { canManageSystemUsers, canViewSystemSettings } from '../utils/systemSettingsPolicy';
import PcnUserManagementView from './PcnUserManagementView';

type PgdcnSystemSettingsViewProps = {
  currentUser: PcnUserAccount;
  users: PcnUserAccount[];
  roles: PcnDepartmentRole[];
  fields: PcnCertificationField[];
  onCreate: (input: PcnUserInput) => Promise<void>;
  onUpdate: (username: string, input: Omit<PcnUserInput, 'username'>) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  onResetPassword: (username: string, password: string) => Promise<void>;
};

export default function PgdcnSystemSettingsView({ currentUser, users, roles, fields, onCreate, onUpdate, onDelete, onResetPassword }: PgdcnSystemSettingsViewProps) {
  const canView = canViewSystemSettings(currentUser);
  const canManage = canManageSystemUsers(currentUser);

  if (!canView) return <div className="pcn-page-surface min-w-0 p-5 text-sm font-bold text-rose-700">Tài khoản hiện tại không có quyền xem Cài đặt hệ thống.</div>;

  return <div className="pcn-page-surface min-w-0 mobile-safe-bottom space-y-3 bg-slate-50/60 p-3 md:p-5">
    <header className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4"><div className="flex items-start gap-2"><div className="rounded-lg bg-slate-900 p-2 text-white"><Settings2 size={16} /></div><div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">PGDCN • Quản trị chung</p><h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Cài đặt hệ thống</h1><p className="mt-1 max-w-3xl text-[11px] leading-4 text-slate-500">Nhân sự &amp; tài khoản dùng chung cho hai miền. Admin hoặc Quản lý gán trực tiếp <code>departmentScopes</code>, <code>position</code>, vai trò nghiệp vụ và phạm vi Lĩnh vực cho từng người; Nút Reset mật khẩu chỉ tạo mật khẩu mới, không hiển thị mật khẩu hiện tại.</p></div></div><div className="mt-3 flex flex-wrap gap-2 text-[10px] font-bold text-slate-600"><span className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1"><Users size={13} className="text-emerald-600" /> Nhân sự &amp; tài khoản</span><span className="inline-flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1"><ShieldCheck size={13} className="text-blue-600" /> {canManage ? 'Có quyền quản trị tài khoản' : 'Chỉ xem theo quyền được cấp'}</span></div></header>
    <PcnUserManagementView users={users} roles={roles} fields={fields} currentUser={currentUser as UserAccount} onCreate={onCreate} onUpdate={onUpdate} onDelete={onDelete} onResetPassword={onResetPassword} />
  </div>;
}
