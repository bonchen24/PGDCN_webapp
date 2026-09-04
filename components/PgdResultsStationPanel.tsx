'use client';

import type { PgdStationPanelProps } from './PgdStationFormsPanel';
import { PgdReportApprovalPanel } from './PgdStationFormsPanel';
import { usePgdStore } from '../store-pgd';

export type PgdResultsStationPanelProps = Omit<PgdStationPanelProps, 'editable'> & { canMutate: boolean };

export default function PgdResultsStationPanel({ canMutate, ...props }: PgdResultsStationPanelProps) {
  const hasLabResult = usePgdStore((state) => state.labResults.some((item) => item.requestId === props.request.id));
  return <div aria-label="Báo cáo giám định · Đánh giá KQTN · Chứng thư giám định · Duyệt kỹ thuật · Bìa hồ sơ">{!hasLabResult && <p role="alert" className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] font-bold text-amber-800">Chưa có kết quả PTN liên kết; báo cáo, chứng thư và phê duyệt đang khóa.</p>}<PgdReportApprovalPanel {...props} editable={canMutate} /></div>;
}
