'use client';

import type { PgdStationPanelProps } from './PgdStationFormsPanel';
import { PgdPreparationPanel } from './PgdStationFormsPanel';

export type PgdPreparationStationPanelProps = Omit<PgdStationPanelProps, 'editable'> & { canMutate: boolean };

export default function PgdPreparationStationPanel({ canMutate, ...props }: PgdPreparationStationPanelProps) {
  return <div aria-label="Kế hoạch & phân công"><PgdPreparationPanel {...props} editable={canMutate} /></div>;
}

