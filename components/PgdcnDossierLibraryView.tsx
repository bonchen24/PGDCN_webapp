'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';

import type { DepartmentScope, PcnUserAccount, CertificationDossier } from '../types.ts';
import type { PgdInspectionRequest } from '../utils/pgdDomain.ts';
import { filterPgdcnDossierLibrary, type PgdcnDossierLibraryEntry, type PgdcnDossierLibraryView } from '../utils/pgdcnDossierLibrary.ts';

type Props = {
  scopes: DepartmentScope[];
  currentUser: PcnUserAccount;
  pcnDossiers: CertificationDossier[];
  pcnProposals: Array<{ id: string; productName: string }>;
  pgdRequests: PgdInspectionRequest[];
  onOpenPcn: (dossierId: string) => void;
  onOpenPgd: (requestId: string) => void;
};

const VIEW_OPTIONS: Array<{ value: PgdcnDossierLibraryView; label: string }> = [
  { value: 'ALL', label: 'Tất cả hồ sơ' },
  { value: 'PCN', label: 'PCN · Chứng nhận' },
  { value: 'PGD', label: 'PGD · Giám định' },
  { value: 'MINE', label: 'Tôi phụ trách' },
  { value: 'REVIEW', label: 'Chờ duyệt' },
];

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Bản nháp', INTAKE_REVIEW: 'Tiếp nhận', AWAITING_DOCUMENTS: 'Chờ tài liệu', ASSIGNED: 'Đã phân công',
  PLAN_PENDING_APPROVAL: 'Chờ duyệt kế hoạch', FIELD_EVALUATION: 'Đánh giá hiện trường', AWAITING_SAMPLING: 'Chờ lấy mẫu',
  SENT_TO_LAB: 'Đã gửi PTN', AWAITING_RESULTS: 'Chờ kết quả', CORRECTIVE_ACTION: 'Khắc phục', TECHNICAL_REVIEW: 'Rà soát kỹ thuật',
  WAITING_APPROVAL: 'Chờ phê duyệt', APPROVED: 'Đã phê duyệt', ISSUED: 'Đã phát hành', DELIVERED: 'Đã trả khách', ARCHIVED: 'Đã lưu trữ',
  CAPABILITY_REVIEW: 'Rà soát năng lực', READY_TO_EXECUTE: 'Sẵn sàng thực hiện', PREPARING: 'Chuẩn bị', FIELD_INSPECTION: 'Giám định hiện trường',
  WAITING_LAB_RESULTS: 'Chờ kết quả PTN', RESULTS_REVIEW: 'Rà soát kết quả', LEADERSHIP_APPROVAL: 'Chờ lãnh đạo duyệt', SIGNED: 'Đã ký',
  RESULT_RETURNED: 'Đã trả kết quả', REJECTED: 'Từ chối', CANCELLED: 'Đã hủy', ON_HOLD: 'Tạm dừng',
};

function savedViewKey(username: string) { return `pgdcn:dossier-library:view:${username.toLocaleLowerCase()}`; }

function readSavedView(username: string): { view: PgdcnDossierLibraryView; query: string } {
  if (typeof window === 'undefined') return { view: 'ALL', query: '' };
  try {
    const raw = window.localStorage.getItem(savedViewKey(username));
    if (!raw) return { view: 'ALL', query: '' };
    const saved = JSON.parse(raw) as { view?: PgdcnDossierLibraryView; query?: string };
    return { view: VIEW_OPTIONS.some((option) => option.value === saved.view) ? saved.view! : 'ALL', query: String(saved.query || '') };
  } catch { return { view: 'ALL', query: '' }; }
}

function displayDate(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function statusTone(status: string) {
  return ['WAITING_APPROVAL', 'LEADERSHIP_APPROVAL', 'TECHNICAL_REVIEW', 'RESULTS_REVIEW'].includes(status)
    ? 'border-violet-200 bg-violet-50 text-violet-800'
    : ['ISSUED', 'DELIVERED', 'SIGNED', 'ARCHIVED', 'APPROVED'].includes(status)
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : 'border-slate-200 bg-slate-50 text-slate-700';
}

export default function PgdcnDossierLibraryView(props: Props) {
  const username = props.currentUser.username;
  const [savedState, setSavedState] = useState(() => ({ username, ...readSavedView(username) }));
  const saved = savedState.username === username ? savedState : { username, ...readSavedView(username) };
  useEffect(() => {
    if (savedState.username !== username) setSavedState({ username, ...readSavedView(username) });
  }, [savedState.username, username]);
  useEffect(() => {
    if (savedState.username !== username) return;
    try { window.localStorage.setItem(savedViewKey(username), JSON.stringify({ view: savedState.view, query: savedState.query })); } catch { /* storage is optional */ }
  }, [savedState, username]);
  const updateSaved = (changes: Partial<Pick<typeof saved, 'view' | 'query'>>) => setSavedState((current) => ({
    ...(current.username === username ? current : { username, ...readSavedView(username) }),
    ...changes,
    username,
  }));

  const entries = useMemo<PgdcnDossierLibraryEntry[]>(() => {
    const result: PgdcnDossierLibraryEntry[] = [];
    if (props.scopes.includes('PCN')) {
      for (const dossier of props.pcnDossiers) {
        result.push({
          domain: 'PCN', id: dossier.id, code: dossier.dossierCode, customerName: dossier.customerSnapshot?.name || 'Chưa có khách hàng',
          productName: props.pcnProposals.find((proposal) => proposal.id === dossier.proposalId)?.productName,
          status: dossier.status, ownerUsername: dossier.ownerUsername,
          responsibleUsernames: [dossier.evaluatorUsername, dossier.reviewerUsername].filter((username): username is string => Boolean(username)),
          updatedAt: dossier.updatedAt || dossier.createdAt,
        });
      }
    }
    if (props.scopes.includes('PGD')) {
      for (const request of props.pgdRequests) {
        if (request.deletedAt) continue;
        result.push({
          domain: 'PGD', id: request.id, code: request.requestCode, customerName: request.customerSnapshot.name || 'Chưa có khách hàng',
          productName: request.productName, status: request.status, ownerUsername: request.ownerUsername,
          responsibleUsernames: [request.receivedByUsername].filter((username): username is string => Boolean(username)), updatedAt: request.updatedAt,
        });
      }
    }
    return result;
  }, [props.pcnDossiers, props.pcnProposals, props.pgdRequests, props.scopes]);

  const visible = useMemo(() => filterPgdcnDossierLibrary(entries, { ...saved, username: props.currentUser.username }), [entries, props.currentUser.username, saved]);
  const open = (entry: PgdcnDossierLibraryEntry) => entry.domain === 'PCN' ? props.onOpenPcn(entry.id) : props.onOpenPgd(entry.id);

  return <section data-testid="pgdcn-dossier-library" className="min-w-0 space-y-4 p-3 md:p-5">
    <header className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Không gian hồ sơ PGDCN</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Hồ sơ</h1><p className="mt-1 text-sm text-slate-600">Danh sách này mở hồ sơ PCN và PYC giám định hiện hữu; mỗi mã chỉ có một hồ sơ nghiệp vụ chính.</p>
      <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-[minmax(0,1fr),minmax(12rem,18rem)]"><label className="block min-w-0 text-xs font-semibold text-slate-600">Tìm theo mã, khách hàng hoặc sản phẩm<div className="relative mt-1"><Search aria-hidden="true" size={16} className="absolute left-3 top-3.5 text-slate-400" /><input aria-label="Tìm hồ sơ" value={saved.query} onChange={(event) => updateSaved({ query: event.target.value })} className="min-h-11 w-full min-w-0 rounded-lg border border-slate-300 pl-10 pr-3 text-sm font-normal text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600" /></div></label><label className="block min-w-0 text-xs font-semibold text-slate-600">Góc nhìn đã lưu<select aria-label="Chọn góc nhìn hồ sơ" value={saved.view} onChange={(event) => updateSaved({ view: event.target.value as PgdcnDossierLibraryView })} className="mt-1 min-h-11 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 text-sm font-normal text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{VIEW_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label></div>
      <p className="mt-3 text-xs text-slate-500">Góc nhìn và từ khóa được lưu trên thiết bị này cho tài khoản {props.currentUser.username}.</p>
    </header>

    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-800">{visible.length} hồ sơ</h2><span className="text-xs text-slate-500">Sắp xếp theo cập nhật gần nhất</span></div>
      <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] border-collapse text-left"><thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3 font-semibold">Mã hồ sơ</th><th className="px-4 py-3 font-semibold">Khách hàng / sản phẩm</th><th className="px-4 py-3 font-semibold">Miền</th><th className="px-4 py-3 font-semibold">Trạng thái</th><th className="px-4 py-3 font-semibold">Phụ trách</th><th className="px-4 py-3 font-semibold">Cập nhật</th><th className="px-4 py-3"><span className="sr-only">Mở hồ sơ</span></th></tr></thead><tbody className="divide-y divide-slate-100">{visible.map((entry) => <tr key={`${entry.domain}-${entry.id}`} className="hover:bg-slate-50"><td className="px-4 py-3"><button type="button" onClick={() => open(entry)} className="font-mono text-sm font-semibold text-blue-700 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">{entry.code}</button></td><td className="max-w-64 px-4 py-3"><div className="truncate text-sm font-medium text-slate-800">{entry.customerName}</div><div className="truncate text-xs text-slate-500">{entry.productName || '—'}</div></td><td className="px-4 py-3 text-xs font-semibold text-slate-600">{entry.domain}</td><td className="px-4 py-3"><span className={`inline-flex max-w-48 rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(entry.status)}`}>{STATUS_LABELS[entry.status] || entry.status}</span></td><td className="max-w-40 truncate px-4 py-3 text-xs text-slate-600">{entry.ownerUsername || 'Chưa phân công'}</td><td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">{displayDate(entry.updatedAt)}</td><td className="px-4 py-3"><button type="button" aria-label={`Mở hồ sơ ${entry.code}`} onClick={() => open(entry)} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"><ArrowUpRight size={16} /></button></td></tr>)}</tbody></table></div>
      <div className="space-y-2 p-3 md:hidden">{visible.map((entry) => <article key={`${entry.domain}-${entry.id}`} className="min-w-0 rounded-xl border border-slate-200 p-3"><div className="flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><button type="button" onClick={() => open(entry)} className="break-all text-left font-mono text-sm font-semibold text-blue-700 underline-offset-2 hover:underline">{entry.code}</button><p className="mt-1 break-words text-sm font-semibold text-slate-800">{entry.customerName}</p><p className="mt-0.5 break-words text-xs text-slate-600">{entry.productName || '—'}</p></div><span className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-600">{entry.domain}</span></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className={`max-w-full break-words rounded-full border px-2.5 py-1 text-xs font-medium ${statusTone(entry.status)}`}>{STATUS_LABELS[entry.status] || entry.status}</span><span className="text-xs text-slate-500">{displayDate(entry.updatedAt)}</span></div><p className="mt-2 break-all text-xs text-slate-500">Phụ trách: {entry.ownerUsername || 'Chưa phân công'}</p><button type="button" onClick={() => open(entry)} className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">Mở hồ sơ</button></article>)}</div>
      {visible.length === 0 && <div className="p-8 text-center"><p className="text-sm font-semibold text-slate-700">Không có hồ sơ phù hợp.</p><p className="mt-1 text-xs text-slate-500">Thử đổi góc nhìn hoặc từ khóa tìm kiếm.</p></div>}
    </div>
  </section>;
}
