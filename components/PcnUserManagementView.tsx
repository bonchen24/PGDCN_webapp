'use client';

import React, { useMemo, useState } from 'react';
import { KeyRound, Pencil, Plus, Search, Shield, Trash2, UserCog, X } from 'lucide-react';
import { toast } from 'sonner';

import type {
  PcnCertificationField,
  PcnDepartmentRoleCode,
  PcnSystemRole,
  PcnUserAccount,
  UserAccount,
} from '../types';
import { PCN_DEPARTMENT_ROLE_OPTIONS } from '../types';
import type { PcnDepartmentRole, PcnUserInput } from '../utils/pcnUserApi';

const SYSTEM_ROLE_LABELS: Record<PcnSystemRole, string> = {
  admin: 'Admin PCN',
  staff: 'Nhân viên PCN',
  viewer: 'Chỉ xem',
};

const SYSTEM_ROLE_CLASSES: Record<PcnSystemRole, string> = {
  admin: 'border-rose-200 bg-rose-50 text-rose-700',
  staff: 'border-blue-200 bg-blue-50 text-blue-700',
  viewer: 'border-slate-200 bg-slate-100 text-slate-600',
};

interface UserFormState {
  username: string;
  name: string;
  systemRole: PcnSystemRole;
  departmentRoleCode: PcnDepartmentRoleCode;
  fieldCodes: string[];
  active: boolean;
  position: string;
  phone: string;
  email: string;
}

const EMPTY_FORM: UserFormState = {
  username: '',
  name: '',
  systemRole: 'staff',
  departmentRoleCode: 'UNASSIGNED',
  fieldCodes: [],
  active: true,
  position: '',
  phone: '',
  email: '',
};

function roleName(roles: PcnDepartmentRole[], code: PcnDepartmentRoleCode): string {
  return roles.find((role) => role.code === code)?.name
    || PCN_DEPARTMENT_ROLE_OPTIONS.find((role) => role.code === code)?.name
    || code;
}

function canManageUsers(user: UserAccount | null): boolean {
  return user?.systemRole === 'admin' || user?.role === 'admin';
}

function UserBadge({ role }: { role: PcnSystemRole }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${SYSTEM_ROLE_CLASSES[role]}`}>{SYSTEM_ROLE_LABELS[role]}</span>;
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">{label}</span>{children}</label>;
}

const inputClass = 'w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400';

export function PcnUserManagementView({
  users,
  roles,
  fields,
  currentUser,
  onCreate,
  onUpdate,
  onDelete,
  onResetPassword,
}: {
  users: PcnUserAccount[];
  roles: PcnDepartmentRole[];
  fields: PcnCertificationField[];
  currentUser: UserAccount | null;
  onCreate: (input: PcnUserInput) => Promise<void>;
  onUpdate: (username: string, input: Omit<PcnUserInput, 'username'>) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  onResetPassword: (username: string, password: string) => Promise<void>;
}) {
  const [query, setQuery] = useState('');
  const [systemRoleFilter, setSystemRoleFilter] = useState<'ALL' | PcnSystemRole>('ALL');
  const [departmentRoleFilter, setDepartmentRoleFilter] = useState<'ALL' | PcnDepartmentRoleCode>('ALL');
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingUsername, setResettingUsername] = useState<string>();
  const [deletingUsername, setDeletingUsername] = useState<string>();

  const editable = canManageUsers(currentUser);
  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return users.filter((user) => {
      const matchesQuery = !normalizedQuery || `${user.username} ${user.name}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery);
      const matchesSystemRole = systemRoleFilter === 'ALL' || user.systemRole === systemRoleFilter;
      const matchesDepartmentRole = departmentRoleFilter === 'ALL' || user.departmentRoleCode === departmentRoleFilter;
      return matchesQuery && matchesSystemRole && matchesDepartmentRole;
    });
  }, [departmentRoleFilter, query, systemRoleFilter, users]);

  const openCreate = () => {
    setEditingUsername(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  };

  const openEdit = (user: PcnUserAccount) => {
    setEditingUsername(user.username);
    setFormOpen(true);
    setForm({
      username: user.username,
      name: user.name,
      systemRole: user.systemRole,
      departmentRoleCode: user.departmentRoleCode,
      fieldCodes: [...user.fieldCodes],
      active: user.active,
      position: user.position || '',
      phone: user.phone || '',
      email: user.email || '',
    });
  };

  const closeForm = () => {
    setEditingUsername(null);
    setForm(EMPTY_FORM);
    setFormOpen(false);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!form.username.trim() || !form.name.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập và họ tên.');
      return;
    }
    const input: PcnUserInput = {
      username: form.username.trim().toLowerCase(),
      name: form.name.trim(),
      systemRole: form.systemRole,
      departmentRoleCode: form.departmentRoleCode,
      fieldCodes: form.fieldCodes as PcnUserInput['fieldCodes'],
      active: form.active,
      ...(form.position.trim() ? { position: form.position.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
    };
    setSaving(true);
    try {
      if (editingUsername) {
        const { username: _username, ...updates } = input;
        await onUpdate(editingUsername, updates);
        toast.success(`Đã cập nhật nhân sự ${input.name}.`);
      } else {
        await onCreate(input);
        toast.success(`Đã thêm nhân sự ${input.name}.`);
      }
      closeForm();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể lưu nhân sự PCN.');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user: PcnUserAccount) => {
    if (deletingUsername || user.username === currentUser?.username) return;
    if (typeof window === 'undefined' || !window.confirm(`Xóa tài khoản PCN ${user.name} (${user.username})? Dữ liệu hồ sơ nghiệp vụ vẫn được giữ nguyên.`)) return;
    setDeletingUsername(user.username);
    try {
      await onDelete(user.username);
      toast.success(`Đã xóa tài khoản ${user.name}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa tài khoản PCN.');
    } finally {
      setDeletingUsername(undefined);
    }
  };

  const resetPassword = async (user: PcnUserAccount) => {
    if (resettingUsername === user.username) return;
    const password = typeof window !== 'undefined'
      ? window.prompt(`Nhập mật khẩu mới cho ${user.name} (ít nhất 8 ký tự):`, '')
      : null;
    if (password === null) return;
    if (password.length < 8) {
      toast.error('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    setResettingUsername(user.username);
    try {
      await onResetPassword(user.username, password);
      toast.success(`Đã reset mật khẩu cho ${user.name}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể reset mật khẩu.');
    } finally {
      setResettingUsername(undefined);
    }
  };

  const toggleField = (code: string) => {
    setForm((previous) => ({
      ...previous,
      fieldCodes: previous.fieldCodes.includes(code)
        ? previous.fieldCodes.filter((item) => item !== code)
        : [...previous.fieldCodes, code],
    }));
  };

  return (
    <div className="pcn-page-surface min-w-0 bg-slate-50/60 p-3 md:p-5 mobile-safe-bottom">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị nội bộ PCN</p>
          <h1 className="mt-1 text-xl font-black text-slate-900">Nhân sự PCN</h1>
          <p className="mt-1 text-[11px] text-slate-500">Tài khoản hệ thống và chức vụ phòng ban được quản lý tách biệt. Đây không phải danh sách khách hàng.</p>
        </div>
        {editable && <button onClick={openCreate} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500"><Plus size={14} /> Thêm nhân sự</button>}
      </div>

      {!editable && <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800"><Shield size={14} className="mt-0.5 shrink-0" />Bạn có thể xem danh sách nhân sự, nhưng chỉ Admin PCN được sửa role, chức vụ hoặc reset mật khẩu.</div>}

      {editable && formOpen && <form onSubmit={submit} className="mb-4 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm md:p-4">
        <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-800">{editingUsername ? 'Cập nhật nhân sự' : 'Thêm nhân sự PCN'}</h2><p className="mt-0.5 text-[10px] text-slate-400">Mật khẩu được thao tác riêng bằng nút reset, không hiển thị trong hồ sơ.</p></div><button type="button" onClick={closeForm} aria-label="Đóng biểu mẫu nhân sự" className="text-slate-400 hover:text-slate-700"><X size={16} /></button></div>
        <div className="grid gap-2 md:grid-cols-3">
          <FormField label="Tên đăng nhập *"><input className={`${inputClass} ${editingUsername ? 'bg-slate-50 text-slate-500' : ''}`} value={form.username} disabled={Boolean(editingUsername)} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="vd: nguyenvana" /></FormField>
          <FormField label="Họ và tên *"><input className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="Thông tin chức danh (tuỳ chọn)"><input className={inputClass} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} placeholder="Chỉ để hiển thị" /></FormField>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <FormField label="Role hệ thống"><select className={inputClass} value={form.systemRole} onChange={(event) => setForm({ ...form, systemRole: event.target.value as PcnSystemRole })}>{Object.entries(SYSTEM_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></FormField>
          <FormField label="Role chức vụ phòng ban"><select className={inputClass} value={form.departmentRoleCode} onChange={(event) => setForm({ ...form, departmentRoleCode: event.target.value as PcnDepartmentRoleCode })}>{(roles.length ? roles : PCN_DEPARTMENT_ROLE_OPTIONS).map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></FormField>
          <label className="flex items-end gap-2 pb-1.5 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Tài khoản đang hoạt động</label>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-3"><FormField label="Số điện thoại"><input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField><FormField label="Email"><input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField></div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[10px] font-black text-slate-500">Phạm vi lĩnh vực:</span>{fields.map((field) => <label key={field.code} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${form.fieldCodes.includes(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={form.fieldCodes.includes(field.code)} onChange={() => toggleField(field.code)} />{field.name}</label>)}</div>
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : editingUsername ? 'Lưu thay đổi' : 'Thêm nhân sự'}</button></div>
      </form>}

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_220px]">
        <label className="relative block"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input className={`${inputClass} pl-8`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc username..." /></label>
        <select className={inputClass} value={systemRoleFilter} onChange={(event) => setSystemRoleFilter(event.target.value as 'ALL' | PcnSystemRole)}><option value="ALL">Tất cả role hệ thống</option>{Object.entries(SYSTEM_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
        <select className={inputClass} value={departmentRoleFilter} onChange={(event) => setDepartmentRoleFilter(event.target.value as 'ALL' | PcnDepartmentRoleCode)}><option value="ALL">Tất cả role chức vụ</option>{(roles.length ? roles : PCN_DEPARTMENT_ROLE_OPTIONS).map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5"><div className="flex items-center gap-2"><UserCog size={15} className="text-emerald-600" /><span className="text-xs font-black text-slate-800">Danh sách tài khoản PCN</span></div><span className="text-[10px] font-bold text-slate-400">{visibleUsers.length}/{users.length}</span></div>
        {visibleUsers.length === 0 ? <div className="p-8 text-center text-[11px] text-slate-400">Không có nhân sự phù hợp bộ lọc.</div> : <div className="divide-y divide-slate-100">
          {visibleUsers.map((user) => <div key={user.username} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-800">{user.name}</span><UserBadge role={user.systemRole} /><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${user.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{user.active ? 'Đang hoạt động' : 'Đã khóa'}</span></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span className="font-mono">{user.username}</span><span>Chức vụ: <b className="text-slate-700">{roleName(roles, user.departmentRoleCode)}</b></span><span>Phạm vi: <b className="text-slate-700">{user.fieldCodes.length ? user.fieldCodes.join(', ') : 'Chưa gán'}</b></span>{user.phone && <span>☎ {user.phone}</span>}{user.email && <span>{user.email}</span>}</div></div>
            {editable && <div className="flex shrink-0 gap-1.5"><button onClick={() => openEdit(user)} disabled={saving || resettingUsername !== undefined || deletingUsername !== undefined} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 disabled:opacity-50"><Pencil size={12} /> Sửa</button><button onClick={() => void resetPassword(user)} disabled={resettingUsername !== undefined || saving || deletingUsername !== undefined} aria-busy={resettingUsername === user.username} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50"><KeyRound size={12} /> {resettingUsername === user.username ? 'Đang reset…' : 'Reset mật khẩu'}</button>{user.username !== currentUser?.username && <button onClick={() => void removeUser(user)} disabled={deletingUsername !== undefined || saving || resettingUsername !== undefined} aria-busy={deletingUsername === user.username} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"><Trash2 size={12} /> {deletingUsername === user.username ? 'Đang xóa…' : 'Xóa'}</button>}</div>}
          </div>)}
        </div>}
      </div>
    </div>
  );
}

export default PcnUserManagementView;
