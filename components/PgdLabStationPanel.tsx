'use client';

import type { PgdStationPanelProps } from './PgdStationFormsPanel';
import { PgdLabResultsPanel } from './PgdStationFormsPanel';

export type PgdLabStationPanelProps = Omit<PgdStationPanelProps, 'editable'> & { canMutate: boolean };

export default function PgdLabStationPanel({ canMutate, ...props }: PgdLabStationPanelProps) {
  return <div aria-label="Phiếu yêu cầu PTN · Tiếp nhận KQTN · Đánh giá KQTN"><PgdLabResultsPanel {...props} editable={canMutate} /></div>;
}

