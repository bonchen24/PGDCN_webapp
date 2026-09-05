'use client';

import { useEffect, useState } from 'react';
import type { PgdStationPanelProps } from './PgdStationFormsPanel';
import { PgdReportApprovalPanel } from './PgdStationFormsPanel';
import { usePgdStore } from '../store-pgd';
import { PGD_DOMAIN } from '../utils/pgdDomain';
import type { PgdLabReviewConformity } from '../utils/pgdArtifacts';

export type PgdResultsStationPanelProps = Omit<PgdStationPanelProps, 'editable'> & { canMutate: boolean };

export default function PgdResultsStationPanel({ canMutate, ...props }: PgdResultsStationPanelProps) {
  const pgd = usePgdStore();
  const labResults = pgd.labResults.filter((item) => item.requestId === props.request.id);
  const hasLabResult = labResults.length > 0;
  const review = pgd.labResultReviews.find((item) => item.requestId === props.request.id);
  const [conformity, setConformity] = useState<PgdLabReviewConformity>(review?.conformity || 'CONFORMING');
  const [conclusion, setConclusion] = useState(review?.conclusion || '');
  const [retestReason, setRetestReason] = useState(review?.retestReason || '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setConformity(review?.conformity || 'CONFORMING');
    setConclusion(review?.conclusion || '');
    setRetestReason(review?.retestReason || '');
  }, [review?.id]);
  const saveReview = async () => {
    setSaving(true);
    try {
      await pgd.saveLabResultReview({
        id: review?.id || `pgd-lab-review-${props.request.id}`,
        domain: PGD_DOMAIN,
        requestId: props.request.id,
        labResultIds: labResults.map((item) => item.id),
        completeness: 'COMPLETE',
        conformity,
        conclusion: conclusion.trim(),
        ...(conformity === 'NON_CONFORMING' ? { retestRequired: true, retestReason: retestReason.trim() } : {}),
        reviewerUsername: props.currentUser.username,
        reviewedAt: new Date().toISOString(),
        status: 'FINAL',
        createdAt: review?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    } finally {
      setSaving(false);
    }
  };
  const reviewBlocked = conformity === 'NON_CONFORMING' && !retestReason.trim();
  return <div aria-label="Báo cáo giám định · Đánh giá KQTN · Chứng thư giám định · Hoàn thiện báo cáo · Phê duyệt hai cấp · Bìa hồ sơ">{!hasLabResult && <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">Chưa có kết quả PTN liên kết; báo cáo, chứng thư và phê duyệt đang khóa.</p>}<section className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><h2 className="text-xs font-black text-slate-800">Đánh giá KQTN</h2><div className="mt-2 grid gap-2 md:grid-cols-3"><label className="block"><span className="mb-1 block text-[10px] font-black text-slate-500">Tình trạng kết quả</span><select className="min-h-9 w-full rounded-lg border border-slate-200 px-2 py-2 text-[10px]" disabled={!canMutate || saving || !hasLabResult} value={conformity} onChange={(event) => setConformity(event.target.value as PgdLabReviewConformity)}><option value="CONFORMING">Phù hợp</option><option value="NON_CONFORMING">Không phù hợp · cần thử lại</option></select></label><label className="block md:col-span-2"><span className="mb-1 block text-[10px] font-black text-slate-500">Kết luận KQTN *</span><input className="min-h-9 w-full rounded-lg border border-slate-200 px-2 py-2 text-[10px]" disabled={!canMutate || saving || !hasLabResult} value={conclusion} onChange={(event) => setConclusion(event.target.value)} /></label>{conformity === 'NON_CONFORMING' && <label className="block md:col-span-3"><span className="mb-1 block text-[10px] font-black text-amber-700">Lý do kiểm tra / thử lại *</span><input className="min-h-9 w-full rounded-lg border border-amber-200 bg-amber-50 px-2 py-2 text-[10px]" disabled={!canMutate || saving || !hasLabResult} value={retestReason} onChange={(event) => setRetestReason(event.target.value)} placeholder="Nêu mẫu/phép thử cần đối chiếu lại" /></label>}</div><div className="mt-2 flex items-center justify-between gap-2"><p className="text-[9px] text-slate-500">{review ? `Đã đánh giá lúc ${review.reviewedAt || review.updatedAt}` : 'Chưa có bản đánh giá KQTN.'}</p><button type="button" disabled={!canMutate || saving || !hasLabResult || !conclusion.trim() || reviewBlocked} onClick={() => void saveReview()} className="min-h-9 rounded-lg bg-blue-600 px-3 text-[10px] font-black text-white disabled:opacity-50">{saving ? 'Đang lưu...' : 'Lưu đánh giá KQTN'}</button></div></section><PgdReportApprovalPanel {...props} editable={canMutate && review?.status === 'FINAL' && review.retestRequired !== true} /></div>;
}
