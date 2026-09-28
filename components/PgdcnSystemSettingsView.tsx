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

  return (
    <div className="pcn-page-surface min-w-0 mobile-safe-bottom space-y-3 bg-slate-50/60 p-3 md:p-5">
      <header className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-slate-900 p-2 text-white">
              <Settings2 size={16} />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">PGDCN • Quản trị chung Trung tâm/Phòng</p>
              <h1 className="mt-0.5 text-lg font-bold tracking-tight text-slate-900">Cài đặt hệ thống</h1>
              <p className="text-[11px] text-slate-500">Quản trị nhân sự, tài khoản, chức danh, vai trò chuyên môn và phạm vi làm việc dùng chung cho hai miền.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold text-slate-600">
            <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-600">
              <Users size={12} className="text-slate-500" /> {users.length} nhân sự
            </span>
            <span className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 ${canManage ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-600'}`}>
              <ShieldCheck size={12} className={canManage ? 'text-emerald-600' : 'text-slate-400'} />
              {canManage ? 'Có quyền quản trị tài khoản' : 'Chỉ xem theo quyền được cấp'}
            </span>
          </div>
        </div>
      </header>
      <section aria-labelledby="system-personnel-heading">
        <h2 id="system-personnel-heading" className="sr-only">Nhân sự &amp; tài khoản dùng chung</h2>
        <PcnUserManagementView
          users={users}
          roles={roles}
          fields={fields}
          currentUser={currentUser as UserAccount}
          onCreate={onCreate}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onResetPassword={onResetPassword}
          embedded
        />
      </section>
    </div>
  );
}
