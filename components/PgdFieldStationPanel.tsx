'use client';

import type { PgdStationPanelProps } from './PgdStationFormsPanel';
import { PgdFieldSamplingPanel } from './PgdStationFormsPanel';

export type PgdFieldStationPanelProps = Omit<PgdStationPanelProps, 'editable'> & { canMutate: boolean };

export default function PgdFieldStationPanel({ canMutate, ...props }: PgdFieldStationPanelProps) {
  return <div aria-label="Biên bản kiểm tra tại hiện trường · Diễn biến vụ giám định · Tách LAB · Mẫu lưu"><PgdFieldSamplingPanel {...props} editable={canMutate} /></div>;
}

