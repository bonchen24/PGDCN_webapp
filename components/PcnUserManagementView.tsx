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
  DepartmentScope,
  PgdDepartmentRoleCode,
  OrganizationManagementRoleCode,
  ProfessionalRoleCode,
} from '../types';
import { ORGANIZATION_MANAGEMENT_ROLE_OPTIONS, PROFESSIONAL_ROLE_OPTIONS, PCN_DEPARTMENT_ROLE_OPTIONS } from '../types';
import type { PcnDepartmentRole, PcnUserInput } from '../utils/pcnUserApi';
import { canManageSystemUsers } from '../utils/systemSettingsPolicy';

const SYSTEM_ROLE_LABELS: Record<PcnSystemRole, string> = {
  admin: 'Quản trị viên hệ thống',
  staff: 'Nhân sự PGDCN',
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
  managementRoleCode: OrganizationManagementRoleCode;
  professionalRoleCodes: ProfessionalRoleCode[];
  departmentRoleCode: PcnDepartmentRoleCode;
  fieldCodes: string[];
  active: boolean;
  position: string;
  phone: string;
  email: string;
  departmentScopes: DepartmentScope[];
  pgdRole?: PgdDepartmentRoleCode;
}

const EMPTY_FORM: UserFormState = {
  username: '',
  name: '',
  systemRole: 'staff',
  managementRoleCode: 'NONE',
  professionalRoleCodes: [],
  departmentRoleCode: 'UNASSIGNED',
  fieldCodes: [],
  active: true,
  position: '',
  phone: '',
  email: '',
  departmentScopes: ['PCN'],
  pgdRole: undefined,
};

const PGD_ROLE_LABELS: Record<PgdDepartmentRoleCode, string> = {
  PGD_ADMIN: 'Quản trị viên PGD',
  PGD_MANAGER: 'Quản lý PGD',
  PGD_TECHNICAL: 'Kỹ thuật PGD',
  PGD_FIELD_INSPECTOR: 'Giám định viên hiện trường',
  PGD_DOCUMENT_CLERK: 'Văn thư PGD',
  PGD_VIEWER: 'Chỉ xem PGD',
};

function roleName(roles: PcnDepartmentRole[], code: PcnDepartmentRoleCode): string {
  return roles.find((role) => role.code === code)?.name
    || PCN_DEPARTMENT_ROLE_OPTIONS.find((role) => role.code === code)?.name
    || code;
}

function UserBadge({ role }: { role: PcnSystemRole }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-black ${SYSTEM_ROLE_CLASSES[role]}`}>{SYSTEM_ROLE_LABELS[role]}</span>;
}

function managementRoleName(code?: OrganizationManagementRoleCode): string {
  return ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((role) => role.code === code)?.name || 'Chưa phân công chức danh quản lý';
}

function professionalRoleNames(codes?: ProfessionalRoleCode[]): string {
  const names = (codes || []).map((code) => PROFESSIONAL_ROLE_OPTIONS.find((role) => role.code === code)?.name || code);
  return names.length ? names.join(', ') : 'Chưa gán vai trò chuyên môn';
}

function legacyDepartmentRoleCode(
  managementRoleCode: OrganizationManagementRoleCode,
  professionalRoleCodes: ProfessionalRoleCode[],
): PcnDepartmentRoleCode {
  if (professionalRoleCodes.includes('CERTIFICATION_EXPERT')) return 'CERTIFICATION_EXPERT';
  if (professionalRoleCodes.includes('DOCUMENT_CLERK')) return 'DOCUMENT_CLERK';
  if (managementRoleCode !== 'NONE') return 'LEADERSHIP';
  return 'UNASSIGNED';
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  const normalizedLabel = label.replace(/\s*\*\s*$/, '').trim();
  const required = normalizedLabel !== label;
  return <label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">{normalizedLabel}{required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{children}</label>;
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
  const [managementRoleFilter, setManagementRoleFilter] = useState<'ALL' | OrganizationManagementRoleCode>('ALL');
  const [form, setForm] = useState<UserFormState>(EMPTY_FORM);
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [resettingUsername, setResettingUsername] = useState<string>();
  const [deletingUsername, setDeletingUsername] = useState<string>();

  const editable = canManageSystemUsers(currentUser);
  const visibleUsers = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('vi-VN');
    return users.filter((user) => {
      const matchesQuery = !normalizedQuery || `${user.username} ${user.name}`.toLocaleLowerCase('vi-VN').includes(normalizedQuery);
      const matchesSystemRole = systemRoleFilter === 'ALL' || user.systemRole === systemRoleFilter;
      const matchesManagementRole = managementRoleFilter === 'ALL' || (user.managementRoleCode || 'NONE') === managementRoleFilter;
      return matchesQuery && matchesSystemRole && matchesManagementRole;
    });
  }, [managementRoleFilter, query, systemRoleFilter, users]);

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
      managementRoleCode: user.managementRoleCode || 'NONE',
      professionalRoleCodes: [...(user.professionalRoleCodes || [])],
      departmentRoleCode: user.departmentRoleCode,
      fieldCodes: [...user.fieldCodes],
      active: user.active,
      position: user.position || '',
      phone: user.phone || '',
      email: user.email || '',
      departmentScopes: user.departmentScopes?.length ? [...user.departmentScopes] : ['PCN'],
      pgdRole: user.pgdRole,
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
      managementRoleCode: form.managementRoleCode,
      professionalRoleCodes: form.professionalRoleCodes,
      departmentRoleCode: legacyDepartmentRoleCode(form.managementRoleCode, form.professionalRoleCodes),
      fieldCodes: form.fieldCodes as PcnUserInput['fieldCodes'],
      active: form.active,
      ...(form.position.trim() ? { position: form.position.trim() } : {}),
      ...(form.phone.trim() ? { phone: form.phone.trim() } : {}),
      ...(form.email.trim() ? { email: form.email.trim() } : {}),
      departmentScopes: form.departmentScopes,
      ...(form.departmentScopes.includes('PGD') && form.pgdRole ? { pgdRole: form.pgdRole } : {}),
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
      toast.error(error?.message || 'Không thể lưu nhân sự PGDCN.');
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (user: PcnUserAccount) => {
    if (deletingUsername || user.username === currentUser?.username) return;
    if (typeof window === 'undefined' || !window.confirm(`Xóa tài khoản PGDCN ${user.name} (${user.username})? Dữ liệu hồ sơ nghiệp vụ vẫn được giữ nguyên.`)) return;
    setDeletingUsername(user.username);
    try {
      await onDelete(user.username);
      toast.success(`Đã xóa tài khoản ${user.name}.`);
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa tài khoản PGDCN.');
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

  const toggleProfessionalRole = (code: ProfessionalRoleCode) => {
    setForm((previous) => ({
      ...previous,
      professionalRoleCodes: previous.professionalRoleCodes.includes(code)
        ? previous.professionalRoleCodes.filter((item) => item !== code)
        : [...previous.professionalRoleCodes, code],
    }));
  };

  const toggleDepartmentScope = (scope: DepartmentScope) => {
    setForm((previous) => {
      const nextScopes = previous.departmentScopes.includes(scope)
        ? previous.departmentScopes.filter((item) => item !== scope)
        : [...previous.departmentScopes, scope];
      return {
        ...previous,
        departmentScopes: nextScopes.length ? nextScopes : ['PCN'],
        pgdRole: nextScopes.includes('PGD') ? (previous.pgdRole || 'PGD_FIELD_INSPECTOR') : undefined,
      };
    });
  };

  return (
    <div className="pcn-page-surface min-w-0 bg-slate-50/60 p-3 md:p-5 mobile-safe-bottom">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị nội bộ PGDCN</p>
          <h1 className="mt-1 text-xl font-black text-slate-900">Nhân sự &amp; tài khoản</h1>
          <p className="mt-1 text-[11px] text-slate-500">Tài khoản, phạm vi phòng ban và chức vụ được gán trực tiếp trên từng người. Đây không phải danh sách khách hàng.</p>
        </div>
        {editable && <button onClick={openCreate} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-[10px] font-black text-white shadow-sm hover:bg-emerald-500"><Plus size={14} /> Thêm nhân sự</button>}
      </div>

      {!editable && <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[10px] text-amber-800"><Shield size={14} className="mt-0.5 shrink-0" />Bạn có thể xem danh sách nhân sự, nhưng chỉ Quản trị viên hoặc Quản lý được sửa vai trò, phòng ban, chức vụ hoặc đặt lại mật khẩu.</div>}

      {editable && formOpen && <form onSubmit={submit} className="mb-4 rounded-xl border border-emerald-200 bg-white p-3 shadow-sm md:p-4">
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-black text-slate-800">{editingUsername ? 'Cập nhật nhân sự' : 'Thêm tài khoản PGDCN'}</h2><p className="mt-0.5 text-[10px] text-slate-400">Mật khẩu được thao tác riêng bằng nút reset, không hiển thị trong hồ sơ.</p></div><button type="button" onClick={closeForm} aria-label="Đóng biểu mẫu nhân sự" className="text-slate-400 hover:text-slate-700"><X size={16} /></button></div>
        <div className="grid gap-2 md:grid-cols-3">
          <FormField label="Tên đăng nhập *"><input className={`${inputClass} ${editingUsername ? 'bg-slate-50 text-slate-500' : ''}`} value={form.username} disabled={Boolean(editingUsername)} onChange={(event) => setForm({ ...form, username: event.target.value })} /></FormField>
          <FormField label="Họ và tên *"><input required aria-required="true" className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
          <FormField label="Thông tin chức danh (tuỳ chọn)"><input className={inputClass} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></FormField>
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          <FormField label="Role hệ thống"><select className={inputClass} value={form.systemRole} onChange={(event) => setForm({ ...form, systemRole: event.target.value as PcnSystemRole })}>{Object.entries(SYSTEM_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></FormField>
          <FormField label="Chức danh quản lý"><select className={inputClass} value={form.managementRoleCode} onChange={(event) => setForm({ ...form, managementRoleCode: event.target.value as OrganizationManagementRoleCode })}>{ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></FormField>
          <label className="flex items-end gap-2 pb-1.5 text-[10px] font-bold text-slate-600"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Tài khoản đang hoạt động</label>
        </div>
        <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2.5"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black text-slate-600">Vai trò chuyên môn (có thể chọn nhiều):</span>{PROFESSIONAL_ROLE_OPTIONS.map((role) => <label key={role.code} className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black ${form.professionalRoleCodes.includes(role.code) ? 'border-violet-300 bg-white text-violet-700' : 'border-slate-200 bg-white text-slate-500'}`}><input type="checkbox" checked={form.professionalRoleCodes.includes(role.code)} onChange={() => toggleProfessionalRole(role.code)} />{role.name}</label>)}</div><p className="mt-1 text-[9px] leading-4 text-violet-700">Chức danh quản lý và vai trò chuyên môn độc lập; lãnh đạo có thể đồng thời là chuyên gia.</p></div>
        <div className="mt-2 grid gap-2 md:grid-cols-3"><FormField label="Số điện thoại"><input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField><FormField label="Email"><input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField></div>
        <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
          <div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-black text-slate-600">Phạm vi phòng:</span>{(['PCN', 'PGD'] as DepartmentScope[]).map((scope) => <label key={scope} className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[10px] font-black ${form.departmentScopes.includes(scope) ? 'border-blue-300 bg-white text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}><input type="checkbox" checked={form.departmentScopes.includes(scope)} onChange={() => toggleDepartmentScope(scope)} />{scope}</label>)}{form.departmentScopes.includes('PGD') && <select className={`${inputClass} max-w-xs`} aria-label="Role nghiệp vụ PGD" value={form.pgdRole || 'PGD_FIELD_INSPECTOR'} onChange={(event) => setForm({ ...form, pgdRole: event.target.value as PgdDepartmentRoleCode })}>{Object.entries(PGD_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>}</div>
          <p className="mt-1 text-[9px] leading-4 text-blue-700">Cùng một tài khoản có thể có cả PCN và PGD; mỗi workspace vẫn kiểm tra quyền theo đúng miền.</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2"><span className="text-[10px] font-black text-slate-500">Phạm vi lĩnh vực:</span>{fields.map((field) => <label key={field.code} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[10px] font-bold ${form.fieldCodes.includes(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}><input type="checkbox" checked={form.fieldCodes.includes(field.code)} onChange={() => toggleField(field.code)} />{field.name}</label>)}</div>
        <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={closeForm} className="rounded-lg border border-slate-200 px-3 py-1.5 text-[10px] font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-[10px] font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : editingUsername ? 'Lưu thay đổi' : 'Thêm nhân sự'}</button></div>
      </form>}

      <div className="mb-3 grid gap-2 md:grid-cols-[minmax(0,1fr)_180px_220px]">
        <label className="relative block"><Search size={14} className="absolute left-2.5 top-2 text-slate-400" /><input className={`${inputClass} pl-8`} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select className={inputClass} value={systemRoleFilter} onChange={(event) => setSystemRoleFilter(event.target.value as 'ALL' | PcnSystemRole)}><option value="ALL">Tất cả role hệ thống</option>{Object.entries(SYSTEM_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select>
        <select className={inputClass} value={managementRoleFilter} onChange={(event) => setManagementRoleFilter(event.target.value as 'ALL' | OrganizationManagementRoleCode)}><option value="ALL">Tất cả chức danh quản lý</option>{ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5"><div className="flex items-center gap-2"><UserCog size={15} className="text-emerald-600" /><span className="text-xs font-black text-slate-800">Tài khoản PGDCN</span></div><span className="text-[10px] font-bold text-slate-400">{visibleUsers.length}/{users.length}</span></div>
        {visibleUsers.length === 0 ? <div className="p-8 text-center text-[11px] text-slate-400">Không có nhân sự phù hợp bộ lọc.</div> : <div className="divide-y divide-slate-100">
          {visibleUsers.map((user) => <div key={user.username} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-xs font-black text-slate-800">{user.name}</span><UserBadge role={user.systemRole} /><span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${user.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>{user.active ? 'Đang hoạt động' : 'Đã khóa'}</span></div><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500"><span className="font-mono">{user.username}</span><span>Chức danh: <b className="text-slate-700">{managementRoleName(user.managementRoleCode)}</b></span><span>Vai trò chuyên môn: <b className="text-violet-700">{professionalRoleNames(user.professionalRoleCodes)}</b></span><span>Phạm vi phòng: <b className="text-slate-700">{user.departmentScopes?.join(' + ') || 'PCN'}</b></span>{user.pgdRole && <span>Role PGD: <b className="text-blue-700">{PGD_ROLE_LABELS[user.pgdRole]}</b></span>}<span>Phạm vi Lĩnh vực: <b className="text-slate-700">{user.fieldCodes.length ? user.fieldCodes.join(', ') : 'Chưa gán'}</b></span>{user.phone && <span>☎ {user.phone}</span>}{user.email && <span>{user.email}</span>}</div></div>
            {editable && <div className="flex shrink-0 gap-1.5"><button onClick={() => openEdit(user)} disabled={saving || resettingUsername !== undefined || deletingUsername !== undefined} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[10px] font-bold text-slate-600 hover:border-emerald-300 disabled:opacity-50"><Pencil size={12} /> Sửa</button><button onClick={() => void resetPassword(user)} disabled={resettingUsername !== undefined || saving || deletingUsername !== undefined} aria-busy={resettingUsername === user.username} className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[10px] font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50"><KeyRound size={12} /> {resettingUsername === user.username ? 'Đang reset…' : 'Reset mật khẩu'}</button>{user.username !== currentUser?.username && <button onClick={() => void removeUser(user)} disabled={deletingUsername !== undefined || saving || resettingUsername !== undefined} aria-busy={deletingUsername === user.username} className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[10px] font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50"><Trash2 size={12} /> {deletingUsername === user.username ? 'Đang xóa…' : 'Xóa'}</button>}</div>}
          </div>)}
        </div>}
      </div>
    </div>
  );
}

export default PcnUserManagementView;
