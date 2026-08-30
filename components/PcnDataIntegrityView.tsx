'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2, ExternalLink } from 'lucide-react';

import type { PcnDataIntegrityCollection, PcnDataIntegrityIssue, PcnDataIntegritySnapshot } from '../utils/pcnDataIntegrity';
import { getPcnDataIntegrityReport, PCN_DATA_INTEGRITY_COLLECTION_LABELS } from '../utils/pcnDataIntegrity';

const collectionOrder: PcnDataIntegrityCollection[] = [
  'customers',
  'certificationProposals',
  'certificationDossiers',
  'pcnSampleLots',
  'pcnSampleRoutes',
  'labRequests',
  'returnedResults',
  'issuancePackages',
  'pcnTemplateDefinitions',
];

export function PcnDataIntegrityView({ snapshot, onOpenIssue }: { snapshot: PcnDataIntegritySnapshot; onOpenIssue: (collection: PcnDataIntegrityCollection, entityId: string) => void }) {
  const report = useMemo(() => getPcnDataIntegrityReport(snapshot), [snapshot]);
  const groupedIssues = useMemo(() => {
    const groups = new Map<PcnDataIntegrityCollection, PcnDataIntegrityIssue[]>();
    for (const issue of report.issues) groups.set(issue.collection, [...(groups.get(issue.collection) || []), issue]);
    return collectionOrder.filter((collection) => groups.has(collection)).map((collection) => ({ collection, issues: groups.get(collection) || [] }));
  }, [report.issues]);

  return (
    <div className="h-full overflow-y-auto bg-slate-50/60 p-3 pb-20 md:p-5">
      <div className="mx-auto max-w-5xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600">Quản trị dữ liệu PCN</p>
            <h1 className="mt-1 text-xl font-black tracking-tight text-slate-900">Cảnh báo toàn vẹn dữ liệu</h1>
            <p className="mt-1 max-w-3xl text-[11px] leading-5 text-slate-500">Báo cáo read-only từ snapshot runtime hiện tại. Dùng để rà soát <span className="font-bold text-slate-700">Danh sách khách hàng</span>, <span className="font-bold text-slate-700">Biểu mẫu PCN</span> và các liên kết giữa Đề nghị, hồ sơ, lô mẫu, PYC, KQTN và phát hành.</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-bold text-slate-500">Chỉ đọc • không mutation</span>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <Metric label="Cảnh báo" value={report.issueCount} tone={report.issueCount > 0 ? 'text-amber-700' : 'text-emerald-700'} />
          <Metric label="Bản ghi bị ảnh hưởng" value={report.affectedRecordCount} tone={report.affectedRecordCount > 0 ? 'text-amber-700' : 'text-emerald-700'} />
          <Metric label="Nhóm collection" value={groupedIssues.length} tone="text-indigo-700" />
        </div>

        {report.issueCount === 0 ? (
          <section className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
            <div><h2 className="text-sm font-black text-emerald-900">Không phát hiện cảnh báo</h2><p className="mt-1 text-[10px] leading-4 text-emerald-800">Các khóa và liên kết PCN trong snapshot hiện tại đã qua kiểm tra. Đây là kiểm tra read-only, không thay thế các boundary nghiệp vụ.</p></div>
          </section>
        ) : (
          <div className="space-y-3">
            {groupedIssues.map(({ collection, issues }) => (
              <section key={collection} className="rounded-xl border border-amber-200 bg-white p-3 shadow-sm md:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-2"><AlertTriangle size={16} className="text-amber-600" /><h2 className="text-sm font-black text-slate-800">{PCN_DATA_INTEGRITY_COLLECTION_LABELS[collection]}</h2></div><span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-black text-amber-800">{issues.length} cảnh báo</span></div>
                <div className="mt-3 space-y-2">{issues.map((issue, index) => <IssueCard key={`${issue.entityId}-${issue.code}-${index}`} issue={issue} onOpen={() => onOpenIssue(issue.collection, issue.entityId)} />)}</div>
              </section>
            ))}
          </div>
        )}

        <p className="text-[10px] leading-4 text-slate-400">Bản ghi lỗi được giữ nguyên để truy vết. Việc chỉnh sửa phải thực hiện trong module nghiệp vụ tương ứng và qua quyền/boundary hiện hành.</p>
      </div>
    </div>
  );
}

function IssueCard({ issue, onOpen }: { issue: PcnDataIntegrityIssue; onOpen: () => void }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2.5"><div className="min-w-0"><p className="truncate text-[10px] font-black text-slate-700">ID: <span className="font-mono">{issue.entityId}</span></p><p className="mt-0.5 text-[10px] text-amber-900">{issue.message}</p><p className="mt-0.5 font-mono text-[9px] text-slate-400">{issue.code}</p></div><button type="button" onClick={onOpen} className="inline-flex shrink-0 items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[10px] font-black text-amber-800 hover:bg-amber-100">Mở module <ExternalLink size={11} /></button></div>;
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><div className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</div><div className={`mt-1 text-2xl font-black ${tone}`}>{value}</div></div>;
}

export default PcnDataIntegrityView;
