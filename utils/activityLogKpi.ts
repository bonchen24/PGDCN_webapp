// Author: Gemini
// OS support: Web/Node
// Description: Pure selection and chart-segment helpers for employee activity KPIs

import type { ActivityKpiSummary } from '../types';

export interface ActivityKpiSegment {
  label: string;
  value: number;
  color: string;
}

export const selectActivityKpiRows = (
  rows: ActivityKpiSummary[],
  selectedActors: string[],
  displayLimit: number,
): ActivityKpiSummary[] => {
  const selected = selectedActors.length > 0
    ? rows.filter(row => selectedActors.includes(row.actorUsername))
    : rows;
  if (!displayLimit || displayLimit < 1) return selected;
  return selected.slice(0, displayLimit);
};

export const getActivityKpiSegments = (row: ActivityKpiSummary): ActivityKpiSegment[] => [
  { label: 'Phiếu', value: Math.max(0, row.requestActions), color: '#059669' },
  { label: 'KQTN', value: Math.max(0, row.kqtnActions), color: '#2563eb' },
  { label: 'Biên bản', value: Math.max(0, row.handoverActions), color: '#d97706' },
  { label: 'Lịch', value: Math.max(0, row.scheduleActions), color: '#7c3aed' },
  { label: 'Khác', value: Math.max(0, row.otherActions), color: '#94a3b8' },
];

// --- End of activityLogKpi.ts ---
