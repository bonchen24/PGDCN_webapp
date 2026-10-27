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
  if (!code || code === 'NONE') return '';
  return ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.find((role) => role.code === code)?.name || code;
}

function professionalRoleNames(codes?: ProfessionalRoleCode[]): string {
  const names = (codes || []).map((code) => PROFESSIONAL_ROLE_OPTIONS.find((role) => role.code === code)?.name || code);
  return names.length ? names.join(', ') : '';
}

function getUserInitials(name: string): string {
  const parts = name.trim().split(/\\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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
  return <label className="block"><span className="mb-1 block text-[11px] font-black text-slate-500">{normalizedLabel}{required && <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span>}</span>{children}</label>;
}

const inputClass = 'mobile-touch-target min-h-11 w-full rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] outline-none focus:border-emerald-400';

export function PcnUserManagementView({
  users,
  roles,
  fields,
  currentUser,
  onCreate,
  onUpdate,
  onDelete,
  onResetPassword,
  embedded = false,
}: {
  users: PcnUserAccount[];
  roles: PcnDepartmentRole[];
  fields: PcnCertificationField[];
  currentUser: UserAccount | null;
  onCreate: (input: PcnUserInput) => Promise<void>;
  onUpdate: (username: string, input: Omit<PcnUserInput, 'username'>) => Promise<void>;
  onDelete: (username: string) => Promise<void>;
  onResetPassword: (username: string, password: string) => Promise<void>;
  embedded?: boolean;
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
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<PcnUserAccount | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [resetPasswordUser, setResetPasswordUser] = useState<PcnUserAccount | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pageSize, setPageSize] = useState<number | 'ALL'>(20);
  const [currentPage, setCurrentPage] = useState(1);

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

  const totalPages = pageSize === 'ALL' ? 1 : Math.max(1, Math.ceil(visibleUsers.length / pageSize));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const paginatedUsers = useMemo(() => {
    if (pageSize === 'ALL') return visibleUsers;
    const start = (safeCurrentPage - 1) * pageSize;
    return visibleUsers.slice(start, start + pageSize);
  }, [pageSize, safeCurrentPage, visibleUsers]);

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

  const executeDeleteUser = async () => {
    if (
      !deleteConfirmUser
      || deletingUsername
      || deleteConfirmationText !== 'XAC NHAN'
      || deleteConfirmUser.username === currentUser?.username
    ) return;
    setDeletingUsername(deleteConfirmUser.username);
    try {
      await onDelete(deleteConfirmUser.username);
      toast.success(`Đã xóa tài khoản ${deleteConfirmUser.name}.`);
      setDeleteConfirmUser(null);
      setDeleteConfirmationText('');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể xóa tài khoản PGDCN.');
    } finally {
      setDeletingUsername(undefined);
    }
  };

  const executeResetPassword = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!resetPasswordUser || resettingUsername === resetPasswordUser.username) return;
    if (newPassword.length < 8) {
      toast.error('Mật khẩu phải có ít nhất 8 ký tự.');
      return;
    }
    setResettingUsername(resetPasswordUser.username);
    try {
      await onResetPassword(resetPasswordUser.username, newPassword);
      toast.success(`Đã reset mật khẩu cho ${resetPasswordUser.name}.`);
      setResetPasswordUser(null);
      setNewPassword('');
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

  const openDeleteConfirmation = (user: PcnUserAccount) => {
    setDeleteConfirmationText('');
    setDeleteConfirmUser(user);
  };

  const closeDeleteConfirmation = () => {
    if (deletingUsername === deleteConfirmUser?.username) return;
    setDeleteConfirmUser(null);
    setDeleteConfirmationText('');
  };

  return (
    <div
      data-testid="pcn-user-management-surface"
      className={`pcn-page-surface min-w-0 mobile-safe-bottom [&_*:focus-visible]:outline-none [&_*:focus-visible]:ring-2 [&_*:focus-visible]:ring-offset-2 [&_*:focus-visible]:ring-emerald-500 ${
        embedded ? 'space-y-3' : 'bg-slate-50/60 p-3 md:p-5 space-y-4'
      }`}
    >
      {!embedded && (
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị nội bộ PGDCN</p>
            <h1 className="mt-1 text-xl font-black text-slate-900">Nhân sự &amp; tài khoản</h1>
            <p className="mt-1 text-[11px] text-slate-500">Tài khoản, phạm vi phòng ban và chức vụ được gán trực tiếp trên từng người.</p>
          </div>
          {editable && (
            <button
              onClick={openCreate}
              className="mobile-touch-target inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[11px] font-black text-white shadow-sm hover:bg-emerald-500 transition-colors"
            >
              <Plus size={14} /> Thêm nhân sự
            </button>
          )}
        </div>
      )}

      {!editable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-800">
          <Shield size={14} className="mt-0.5 shrink-0" />
          Bạn có thể xem danh sách nhân sự, nhưng chỉ Quản trị viên hoặc Quản lý được sửa vai trò, phòng ban, chức vụ hoặc đặt lại mật khẩu.
        </div>
      )}

      {editable && formOpen && (
        <form onSubmit={submit} className="rounded-xl border border-emerald-200 bg-white p-3 shadow-sm md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-800">{editingUsername ? 'Cập nhật nhân sự' : 'Thêm tài khoản PGDCN'}</h2>
              <p className="mt-0.5 text-[11px] text-slate-500">Mật khẩu được thao tác riêng bằng nút reset, không hiển thị trong hồ sơ.</p>
            </div>
            <button type="button" onClick={closeForm} aria-label="Đóng biểu mẫu nhân sự" className="mobile-touch-target min-h-11 min-w-11 text-slate-400 hover:text-slate-700">
              <X size={16} />
            </button>
          </div>
          <div className="grid gap-2 md:grid-cols-3">
            <FormField label="Tên đăng nhập *"><input className={`${inputClass} ${editingUsername ? 'bg-slate-50 text-slate-500' : ''}`} value={form.username} disabled={Boolean(editingUsername)} onChange={(event) => setForm({ ...form, username: event.target.value })} /></FormField>
            <FormField label="Họ và tên *"><input required aria-required="true" className={inputClass} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></FormField>
            <FormField label="Thông tin chức danh (tuỳ chọn)"><input className={inputClass} value={form.position} onChange={(event) => setForm({ ...form, position: event.target.value })} /></FormField>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <FormField label="Vai trò hệ thống"><select className={inputClass} value={form.systemRole} onChange={(event) => setForm({ ...form, systemRole: event.target.value as PcnSystemRole })}>{Object.entries(SYSTEM_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}</select></FormField>
            <FormField label="Chức danh quản lý"><select className={inputClass} value={form.managementRoleCode} onChange={(event) => setForm({ ...form, managementRoleCode: event.target.value as OrganizationManagementRoleCode })}>{ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}</select></FormField>
            <label className="mobile-touch-target flex min-h-11 items-center gap-2 text-[11px] font-bold text-slate-600"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Tài khoản đang hoạt động</label>
          </div>
          <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50/50 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-slate-600">Vai trò chuyên môn (có thể chọn nhiều):</span>
              {PROFESSIONAL_ROLE_OPTIONS.map((role) => (
                <label key={role.code} className={`mobile-touch-target inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-black ${form.professionalRoleCodes.includes(role.code) ? 'border-violet-300 bg-white text-violet-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                  <input type="checkbox" checked={form.professionalRoleCodes.includes(role.code)} onChange={() => toggleProfessionalRole(role.code)} />
                  {role.name}
                </label>
              ))}
            </div>
            <p className="mt-1 text-[11px] leading-4 text-violet-700">Chức danh quản lý và vai trò chuyên môn độc lập; lãnh đạo có thể đồng thời là chuyên gia.</p>
          </div>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <FormField label="Số điện thoại"><input className={inputClass} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></FormField>
            <FormField label="Email"><input type="email" className={inputClass} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></FormField>
          </div>
          <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50/50 p-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] font-black text-slate-600">Phạm vi phòng:</span>
              {(['PCN', 'PGD'] as DepartmentScope[]).map((scope) => (
                <label key={scope} className={`mobile-touch-target inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-black ${form.departmentScopes.includes(scope) ? 'border-blue-300 bg-white text-blue-700' : 'border-slate-200 bg-white text-slate-500'}`}>
                  <input type="checkbox" checked={form.departmentScopes.includes(scope)} onChange={() => toggleDepartmentScope(scope)} />
                  {scope}
                </label>
              ))}
              {form.departmentScopes.includes('PGD') && (
                <select className={`${inputClass} max-w-xs`} aria-label="Vai trò nghiệp vụ PGD" value={form.pgdRole || 'PGD_FIELD_INSPECTOR'} onChange={(event) => setForm({ ...form, pgdRole: event.target.value as PgdDepartmentRoleCode })}>
                  {Object.entries(PGD_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                </select>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-4 text-blue-700">Cùng một tài khoản có thể có cả PCN và PGD; mỗi workspace vẫn kiểm tra quyền theo đúng miền.</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-slate-500">Phạm vi lĩnh vực:</span>
            {fields.map((field) => (
              <label key={field.code} className={`mobile-touch-target inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${form.fieldCodes.includes(field.code) ? 'border-emerald-300 bg-emerald-50 text-emerald-700' : 'border-slate-200 text-slate-500'}`}>
                <input type="checkbox" checked={form.fieldCodes.includes(field.code)} onChange={() => toggleField(field.code)} />
                {field.name}
              </label>
            ))}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button type="button" onClick={closeForm} className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600">Hủy</button>
            <button type="submit" disabled={saving} className="mobile-touch-target min-h-11 rounded-lg bg-emerald-600 px-3 py-1.5 text-[11px] font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : editingUsername ? 'Lưu thay đổi' : 'Thêm nhân sự'}</button>
          </div>
        </form>
      )}

      {/* Toolbar lọc và tìm kiếm */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative flex-1 block">
            <Search size={14} className="absolute left-2.5 top-3 text-slate-400" />
            <input
              placeholder="Tìm theo họ tên, tên đăng nhập..."
              className={`${inputClass} pl-8`}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <select className={`${inputClass} sm:w-44`} value={systemRoleFilter} onChange={(event) => setSystemRoleFilter(event.target.value as 'ALL' | PcnSystemRole)}>
            <option value="ALL">Tất cả vai trò hệ thống</option>
            {Object.entries(SYSTEM_ROLE_LABELS).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
          </select>
          <select className={`${inputClass} sm:w-52`} value={managementRoleFilter} onChange={(event) => setManagementRoleFilter(event.target.value as 'ALL' | OrganizationManagementRoleCode)}>
            <option value="ALL">Tất cả chức danh quản lý</option>
            {ORGANIZATION_MANAGEMENT_ROLE_OPTIONS.map((role) => <option key={role.code} value={role.code}>{role.name}</option>)}
          </select>
        </div>
        {embedded && editable && (
          <button
            onClick={openCreate}
            className="mobile-touch-target inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[11px] font-black text-white shadow-sm hover:bg-emerald-500 transition-colors"
          >
            <Plus size={14} /> Thêm nhân sự
          </button>
        )}
      </div>

      {/* Danh sách nhân sự dạng Data Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <UserCog size={15} className="text-emerald-600" />
            <span className="text-xs font-black text-slate-800">Danh sách nhân sự</span>
          </div>
          <span className="text-[10px] font-bold text-slate-400">
            {visibleUsers.length}/{users.length} tài khoản
          </span>
        </div>

        {visibleUsers.length === 0 ? (
          <div className="p-8 text-center text-[11px] text-slate-400">Không có nhân sự phù hợp bộ lọc.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[11px]">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th scope="col" className="px-3.5 py-2.5">Nhân sự</th>
                  <th scope="col" className="px-3 py-2.5">Chức danh &amp; Hệ thống</th>
                  <th scope="col" className="px-3 py-2.5">Phạm vi &amp; Chuyên môn</th>
                  <th scope="col" className="px-3 py-2.5 text-center">Trạng thái</th>
                  {editable && <th scope="col" className="px-3.5 py-2.5 text-right">Thao tác</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedUsers.map((user) => {
                  const mRole = managementRoleName(user.managementRoleCode);
                  const pRoles = professionalRoleNames(user.professionalRoleCodes);
                  return (
                    <tr key={user.username} className="hover:bg-slate-50/70 transition-colors">
                      {/* Cột 1: Nhân sự */}
                      <td className="px-3.5 py-3 align-middle">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-800">
                            {getUserInitials(user.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs font-black text-slate-900">{user.name}</div>
                            <div className="font-mono text-[10px] text-slate-400">@{user.username}</div>
                            {(user.phone || user.email) && (
                              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                                {user.phone && <span>☎ {user.phone}</span>}
                                {user.email && <span>{user.email}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột 2: Chức danh & Hệ thống */}
                      <td className="px-3 py-3 align-middle">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <UserBadge role={user.systemRole} />
                            {mRole && (
                              <span className="inline-flex rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[9px] font-bold text-indigo-700">
                                {mRole}
                              </span>
                            )}
                          </div>
                          {user.position && (
                            <div className="text-[10px] text-slate-500">{user.position}</div>
                          )}
                          {!mRole && !user.position && (
                            <span className="text-slate-300">—</span>
                          )}
                        </div>
                      </td>

                      {/* Cột 3: Phạm vi & Chuyên môn */}
                      <td className="px-3 py-3 align-middle">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">
                              {user.departmentScopes?.join(' + ') || 'PCN'}
                            </span>
                            {user.pgdRole && (
                              <span className="inline-flex rounded border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[9px] font-bold text-blue-700">
                                {PGD_ROLE_LABELS[user.pgdRole]}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {pRoles ? (
                              <span className="text-[10px] font-bold text-violet-700">{pRoles}</span>
                            ) : null}
                            {user.fieldCodes.length > 0 && (
                              <span className="text-[10px] text-slate-400">
                                {pRoles ? '• ' : ''}Lĩnh vực: <b className="text-slate-600">{user.fieldCodes.join(', ')}</b>
                              </span>
                            )}
                            {!pRoles && user.fieldCodes.length === 0 && (
                              <span className="text-slate-300">—</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Cột 4: Trạng thái */}
                      <td className="px-3 py-3 align-middle text-center whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold ${user.active ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-100 text-slate-500'}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${user.active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {user.active ? 'Đang hoạt động' : 'Đã khóa'}
                        </span>
                      </td>

                      {/* Cột 5: Thao tác */}
                      {editable && (
                        <td className="px-3.5 py-3 align-middle text-right whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => openEdit(user)}
                              disabled={saving || resettingUsername !== undefined || deletingUsername !== undefined}
                              className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-600 hover:border-emerald-300 disabled:opacity-50 transition-colors"
                            >
                              <Pencil size={12} /> Sửa
                            </button>
                            <button
                              onClick={() => {
                                setResetPasswordUser(user);
                                setNewPassword('');
                              }}
                              disabled={resettingUsername !== undefined || saving || deletingUsername !== undefined}
                              aria-busy={resettingUsername === user.username}
                              className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-700 hover:bg-amber-100 disabled:cursor-wait disabled:opacity-50 transition-colors"
                            >
                              {/* Reset mật khẩu */}<KeyRound size={12} /> Đặt lại mật khẩu
                            </button>
                            {user.username !== currentUser?.username && (
                              <button
                                onClick={() => openDeleteConfirmation(user)}
                                disabled={deletingUsername !== undefined || saving || resettingUsername !== undefined}
                                aria-busy={deletingUsername === user.username}
                                className="mobile-touch-target inline-flex min-h-11 items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-50 transition-colors"
                              >
                                <Trash2 size={12} /> Xóa
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Thanh phân trang Pagination */}
        {visibleUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-[11px]">
            <div className="flex items-center gap-2 text-slate-500">
              <span>Hiển thị:</span>
              <select
                aria-label="Số bản ghi trên mỗi trang"
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value === 'ALL' ? 'ALL' : Number(e.target.value);
                  setPageSize(val);
                  setCurrentPage(1);
                }}
                className="mobile-touch-target min-h-9 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 outline-none focus:border-emerald-400"
              >
                <option value={20}>20 / trang</option>
                <option value={50}>50 / trang</option>
                <option value={100}>100 / trang</option>
                <option value="ALL">Tất cả</option>
              </select>
              <span>(Tổng {visibleUsers.length} tài khoản)</span>
            </div>

            {pageSize !== 'ALL' && totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={safeCurrentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="mobile-touch-target min-h-9 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Trước
                </button>
                <span className="px-2 text-xs font-bold text-slate-700">
                  Trang {safeCurrentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safeCurrentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="mobile-touch-target min-h-9 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600 hover:border-emerald-300 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Sau
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Xác nhận Xóa Nhân sự */}
      {deleteConfirmUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-user-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape' && deletingUsername !== deleteConfirmUser.username) {
              setDeleteConfirmUser(null);
              setDeleteConfirmationText('');
            }
          }}
        >
          <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="delete-user-modal-title" className="text-sm font-black text-rose-700">
                Xác nhận xóa tài khoản
              </h3>
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deletingUsername === deleteConfirmUser.username}
                className="mobile-touch-target min-h-11 min-w-11 text-slate-400 hover:text-slate-700"
                aria-label="Đóng hộp thoại"
              >
                <X size={16} />
              </button>
            </div>
            <div className="py-4 text-xs text-slate-600 leading-relaxed">
              Bạn có chắc chắn muốn xóa tài khoản <b className="text-slate-800">{deleteConfirmUser.name}</b> (<code>@{deleteConfirmUser.username}</code>)?
              <p className="mt-2 text-slate-500">Sau khi xóa, người này không thể đăng nhập. Thao tác chỉ gỡ tài khoản khỏi danh mục đăng nhập (systemUsers); không xóa hồ sơ nghiệp vụ, tệp, nhiệm vụ hoặc nhật ký lịch sử.</p>
              <p className="mt-2 text-amber-700">Hệ thống có thể từ chối nếu tài khoản còn tham chiếu đang hoạt động.</p>
            </div>
            <label htmlFor="delete-user-confirmation" className="mb-1 block text-[11px] font-bold text-slate-700">
              Nhập chính xác <code className="rounded bg-slate-100 px-1 py-0.5 font-black">XAC NHAN</code> để xác nhận
            </label>
            <input
              id="delete-user-confirmation"
              type="text"
              required
              autoComplete="off"
              autoFocus
              value={deleteConfirmationText}
              onChange={(e) => setDeleteConfirmationText(e.target.value)}
              disabled={deletingUsername === deleteConfirmUser.username}
              placeholder="XAC NHAN"
              className={inputClass}
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={closeDeleteConfirmation}
                disabled={deletingUsername === deleteConfirmUser.username}
                className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={deletingUsername === deleteConfirmUser.username || deleteConfirmationText !== 'XAC NHAN'}
                onClick={() => void executeDeleteUser()}
                className="mobile-touch-target min-h-11 rounded-lg bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-500 disabled:opacity-50"
                aria-busy={deletingUsername === deleteConfirmUser.username}
              >
                {deletingUsername === deleteConfirmUser.username ? 'Đang xóa…' : 'Xóa tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Mật khẩu */}
      {resetPasswordUser && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setResetPasswordUser(null);
          }}
        >
          <form
            onSubmit={executeResetPassword}
            className="w-full max-w-md rounded-xl border border-amber-200 bg-white p-5 shadow-xl"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 id="reset-password-modal-title" className="text-sm font-black text-amber-800">
                Đặt lại mật khẩu nhân sự
              </h3>
              <button
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="mobile-touch-target min-h-11 min-w-11 text-slate-400 hover:text-slate-700"
                aria-label="Đóng hộp thoại"
              >
                <X size={16} />
              </button>
            </div>
            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-600">
                Nhập mật khẩu mới cho <b className="text-slate-800">{resetPasswordUser.name}</b> (<code>@{resetPasswordUser.username}</code>):
              </p>
              <label className="block">
                <span className="mb-1 block text-[11px] font-black text-slate-500">Mật khẩu mới (tối thiểu 8 ký tự) *</span>
                <input
                  type="password"
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nhập mật khẩu mới..."
                  className={inputClass}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetPasswordUser(null)}
                className="mobile-touch-target min-h-11 rounded-lg border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={resettingUsername === resetPasswordUser.username || newPassword.length < 8}
                className="mobile-touch-target min-h-11 rounded-lg bg-amber-600 px-4 py-2 text-xs font-black text-white hover:bg-amber-500 disabled:opacity-50"
              >
                {resettingUsername === resetPasswordUser.username ? 'Đang lưu…' : 'Lưu mật khẩu'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default PcnUserManagementView;
