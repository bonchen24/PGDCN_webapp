'use client';

import { formatDateDdMmYyyy } from '../utils/formatter';

import React, { useMemo, useState } from 'react';
import { CalendarClock, Plus, UserCheck } from 'lucide-react';
import { toast } from 'sonner';

import type { PcnCertificationField, PcnSignerDelegation, PcnUserAccount, UserAccount } from '../types';
import type { PcnSignerDelegationInput } from '../utils/pcnSignerDelegationApi';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import { isOrganizationLeader } from '../utils/pcnRbac';
import PcnCatalogCombobox from './PcnCatalogCombobox';
import { PgdcnDateInput } from './PgdcnDateInput';

function dateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  return formatDateDdMmYyyy(value) || 'Không hợp lệ';
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return <>{children} <span aria-hidden="true" className="ml-0.5 text-rose-600">*</span></>;
}

export function PcnSignerDelegationPanel({
  currentUser,
  users,
  fields,
  delegations,
  onCreate,
  onRevoke,
}: {
  currentUser: UserAccount | null;
  users: PcnUserAccount[];
  fields: PcnCertificationField[];
  delegations: PcnSignerDelegation[];
  onCreate: (input: PcnSignerDelegationInput) => Promise<void>;
  onRevoke: (id: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    grantorUsername: '',
    delegateUsername: '',
    approvedByUsername: currentUser?.username || '',
    fieldCodes: [] as string[],
    effectiveFrom: dateInput(new Date()),
    effectiveUntil: dateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    reason: '',
  }));
  const grantors = useMemo(() => users.filter((user) => user.active && isOrganizationLeader(user)), [users]);
  const delegates = useMemo(() => users.filter((user) => user.active && user.systemRole !== 'viewer' && user.role !== 'viewer' && user.username !== form.grantorUsername), [users, form.grantorUsername]);
  const approvers = useMemo(() => users.filter((user) => user.active && user.systemRole === 'admin'), [users]);
  const activeDelegations = delegations.filter((delegation) => delegation.status === 'ACTIVE');
  const userOptions = (items: PcnUserAccount[]) => items.map((user) => ({
    value: user.username,
    label: getPcnUserDisplayName(user.username, users),
    searchText: [user.username, user.name, user.position, user.departmentRoleCode].filter(Boolean).join(' '),
    description: user.username,
  }));

  if (!currentUser || (currentUser.systemRole || currentUser.role) !== 'admin') return null;

  const reset = () => setForm({
    grantorUsername: grantors[0]?.username || '',
    delegateUsername: delegates[0]?.username || '',
    approvedByUsername: currentUser.username,
    fieldCodes: [],
    effectiveFrom: dateInput(new Date()),
    effectiveUntil: dateInput(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    reason: '',
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (form.fieldCodes.length === 0 || !form.grantorUsername || !form.delegateUsername || !form.approvedByUsername || !form.reason.trim()) {
      toast.error('Cần chọn đủ người, Lĩnh vực và lý do ủy quyền.');
      return;
    }
    setSaving(true);
    try {
      await onCreate({
        grantorUsername: form.grantorUsername,
        delegateUsername: form.delegateUsername,
        approvedByUsername: form.approvedByUsername,
        fieldCodes: form.fieldCodes,
        effectiveFrom: form.effectiveFrom + 'T00:00:00.000Z',
        effectiveUntil: form.effectiveUntil + 'T23:59:59.999Z',
        reason: form.reason.trim(),
      });
      toast.success('Đã tạo ủy quyền người ký.');
      setOpen(false);
      reset();
    } catch (error: any) {
      toast.error(error?.message || 'Không thể tạo ủy quyền người ký.');
    } finally {
      setSaving(false);
    }
  };

  const revoke = async (delegation: PcnSignerDelegation) => {
    if (saving) return;
    setSaving(true);
    try {
      await onRevoke(delegation.id);
      toast.success('Đã thu hồi ủy quyền người ký.');
    } catch (error: any) {
      toast.error(error?.message || 'Không thể thu hồi ủy quyền người ký.');
    } finally {
      setSaving(false);
    }
  };

  return <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><div className="flex items-center gap-1.5 text-xs font-black text-indigo-900"><UserCheck size={15} /> Ủy quyền người ký</div><p className="mt-1 text-[10px] text-indigo-700">Chỉ Quản trị viên được tạo/thu hồi. Cấp số chỉ dùng ủy quyền còn hạn và đúng lĩnh vực.</p></div>
      <button type="button" onClick={() => { reset(); setOpen(true); }} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2.5 py-1.5 text-[10px] font-black text-white"><Plus size={12} /> Tạo ủy quyền</button>
    </div>
    {activeDelegations.length > 0 && <div className="mt-3 overflow-x-auto rounded-lg border border-indigo-100 bg-white"><table className="min-w-[760px] w-full text-left text-[10px]"><thead className="bg-indigo-50 text-[9px] font-black uppercase tracking-wider text-indigo-700"><tr><th className="px-2.5 py-2">Người ủy quyền</th><th className="px-2.5 py-2">Người được ủy quyền</th><th className="px-2.5 py-2">Lĩnh vực</th><th className="px-2.5 py-2">Thời hạn</th><th className="px-2.5 py-2">Lý do</th><th className="px-2.5 py-2" /></tr></thead><tbody className="divide-y divide-indigo-50">{activeDelegations.map((delegation) => <tr key={delegation.id}><td className="px-2.5 py-2 font-bold text-slate-700">{getPcnUserDisplayName(delegation.grantorUsername, users)}</td><td className="px-2.5 py-2 font-bold text-slate-700">{getPcnUserDisplayName(delegation.delegateUsername, users)}</td><td className="px-2.5 py-2">{delegation.fieldCodes.join(', ')}</td><td className="whitespace-nowrap px-2.5 py-2 text-slate-500">{formatDate(delegation.effectiveFrom)} – {formatDate(delegation.effectiveUntil)}</td><td className="max-w-[190px] px-2.5 py-2 text-slate-500">{delegation.reason}</td><td className="px-2.5 py-2 text-right"><button type="button" disabled={saving} onClick={() => void revoke(delegation)} className="rounded border border-rose-200 px-2 py-1 text-[9px] font-bold text-rose-700 disabled:opacity-50">Thu hồi</button></td></tr>)}</tbody></table></div>}
    {activeDelegations.length === 0 && <div className="mt-3 rounded-lg border border-dashed border-indigo-200 bg-white/70 p-3 text-[10px] text-indigo-700">Chưa có ủy quyền đang hoạt động.</div>}
    {open && (
      <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4">
        <form onSubmit={(event) => void submit(event)} className="flex min-h-0 max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
          <header className="shrink-0 border-b border-slate-200 px-4 py-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-black text-slate-900">Tạo ủy quyền người ký</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng tạo ủy quyền người ký" className="mobile-touch-target text-slate-400">×</button>
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Bản ghi có audit và chỉ có hiệu lực trong khoảng thời gian đã chọn.</p>
          </header>
          <div className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto px-4 pb-4">
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <label className="text-[10px] font-black text-slate-500"><RequiredLabel>Người ủy quyền</RequiredLabel><PcnCatalogCombobox id="pcn-delegation-grantor" label="Người ủy quyền" hideLabel required value={form.grantorUsername} onChange={(value) => setForm({ ...form, grantorUsername: value })} options={userOptions(grantors)} /></label>
              <label className="text-[10px] font-black text-slate-500"><RequiredLabel>Người được ủy quyền</RequiredLabel><PcnCatalogCombobox id="pcn-delegation-delegate" label="Người được ủy quyền" hideLabel required value={form.delegateUsername} onChange={(value) => setForm({ ...form, delegateUsername: value })} options={userOptions(delegates)} /></label>
              <label className="text-[10px] font-black text-slate-500"><RequiredLabel>Người phê duyệt</RequiredLabel><PcnCatalogCombobox id="pcn-delegation-approver" label="Người phê duyệt" hideLabel required value={form.approvedByUsername} onChange={(value) => setForm({ ...form, approvedByUsername: value })} options={userOptions(approvers)} /></label>
              <div className="text-[10px] font-black text-slate-500"><div><RequiredLabel>Thời hạn</RequiredLabel></div><div className="mt-1 grid grid-cols-2 gap-1.5"><PgdcnDateInput required aria-required="true" aria-label="Thời hạn từ ngày" value={form.effectiveFrom} onChange={(value) => setForm({ ...form, effectiveFrom: value })} className="rounded-md border border-slate-200 px-2 py-2 text-[11px] outline-none focus:border-indigo-400" /><PgdcnDateInput required aria-required="true" aria-label="Thời hạn đến ngày" value={form.effectiveUntil} onChange={(value) => setForm({ ...form, effectiveUntil: value })} className="rounded-md border border-slate-200 px-2 py-2 text-[11px] outline-none focus:border-indigo-400" /></div></div>
            </div>
            <div className="mt-3 text-[10px] font-black text-slate-500" aria-required="true"><div><RequiredLabel>Lĩnh vực được phép</RequiredLabel> <span className="font-normal text-slate-500">(chọn ít nhất một)</span></div><div className="mt-1 flex flex-wrap gap-2">{fields.filter((field) => field.active).map((field) => <label key={field.code} className="inline-flex items-center gap-1 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-bold text-slate-600"><input type="checkbox" checked={form.fieldCodes.includes(field.code)} onChange={(event) => setForm({ ...form, fieldCodes: event.target.checked ? [...form.fieldCodes, field.code] : form.fieldCodes.filter((code) => code !== field.code) })} />{field.name}</label>)}</div></div>
            <label className="mt-3 block text-[10px] font-black text-slate-500"><RequiredLabel>Lý do</RequiredLabel><textarea required rows={2} value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} className="mt-1 w-full rounded-md border border-slate-200 px-2 py-2 text-[11px]" /></label>
          </div>
          <footer className="shrink-0 border-t border-slate-200 px-4 py-3"><div className="flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded-md border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-600">Hủy</button><button type="submit" disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-[10px] font-black text-white disabled:opacity-50"><CalendarClock size={12} /> {saving ? 'Đang lưu…' : 'Lưu ủy quyền'}</button></div></footer>
        </form>
      </div>
    )}
  </section>;
}

export default PcnSignerDelegationPanel;
