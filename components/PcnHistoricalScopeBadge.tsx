'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

import type { PcnHistoricalImportMetadata } from '../types';
import { getPcnHistoricalScopeNotice } from '../utils/pcnHistoricalScope';

export function PcnHistoricalScopeBadge({ historicalImport, compact = false }: { historicalImport?: PcnHistoricalImportMetadata; compact?: boolean }) {
  if (!historicalImport) return null;
  const scopeNotice = getPcnHistoricalScopeNotice(historicalImport);
  const isTestScope = scopeNotice.kind === 'FULL_TEST_SCOPE' || scopeNotice.kind === 'REDUCED_TEST_SCOPE';
  return (
    <span
      data-testid="pcn-historical-scope-badge"
      title={scopeNotice.message}
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[9px] font-black ${isTestScope ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}
    >
      {isTestScope && <AlertTriangle size={10} />}
      {scopeNotice.label}
      {!compact && isTestScope && <span className="font-normal">· chưa kết luận đủ thủ tục</span>}
    </span>
  );
}

// --- End of PcnHistoricalScopeBadge.tsx ---
