'use client';

import React from 'react';
import { FileText, X } from 'lucide-react';

import type {
  CertificationDossier,
  OutboundLabRequest,
  PcnDocumentRequirement,
  PcnGeneratedDocument,
  PcnGeneratedDocumentFormat,
  PcnGeneratedDocumentKind,
  PcnSampleLot,
  PcnSampleRoute,
  PcnTemplateDefinition,
  PcnUserAccount,
} from '../types';
import type { PcnDossierDocumentContext } from '../utils/pcnDocumentGeneration';
import { getPcnDocumentModalDefinition } from '../utils/pcnDocumentModalPolicy';
import { PcnDocumentGenerationPanel } from './PcnDocumentGenerationPanel';

export function PcnDocumentOutputModal({
  dossier,
  proposalUpdatedAt,
  templates,
  documentRequirements,
  generatedDocuments,
  sampleLots,
  sampleRoutes,
  labRequests,
  users,
  kind,
  sampleRouteId,
  labRequestId,
  canGenerate,
  onPreflight,
  onGenerate,
  onConfirmGenerated,
  onClose,
}: {
  dossier: CertificationDossier;
  proposalUpdatedAt?: string;
  templates: PcnTemplateDefinition[];
  documentRequirements: PcnDocumentRequirement[];
  generatedDocuments: PcnGeneratedDocument[];
  sampleLots: PcnSampleLot[];
  sampleRoutes: PcnSampleRoute[];
  labRequests: OutboundLabRequest[];
  users: PcnUserAccount[];
  kind: PcnGeneratedDocumentKind;
  sampleRouteId?: string;
  labRequestId?: string;
  canGenerate: boolean;
  onPreflight: (kind: PcnGeneratedDocumentKind, sampleRouteId?: string, labRequestId?: string) => Promise<PcnDossierDocumentContext>;
  onGenerate: (kind: PcnGeneratedDocumentKind, formats: PcnGeneratedDocumentFormat[], sampleRouteId?: string, expectedContextHash?: string, labRequestId?: string) => Promise<PcnGeneratedDocument[]>;
  onConfirmGenerated: (generated: PcnGeneratedDocument, requirement: PcnDocumentRequirement) => Promise<void>;
  onClose: () => void;
}) {
  const definition = getPcnDocumentModalDefinition(kind);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/55 p-0 sm:items-center sm:p-4" role="presentation">
      <section className="flex min-h-0 max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-md sm:rounded-2xl" role="dialog" aria-modal="true" aria-labelledby="pcn-document-output-title">
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <FileText size={16} className="text-indigo-600" />
              <h2 id="pcn-document-output-title" className="text-sm font-black text-slate-900">{definition.label}</h2>
              <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[9px] font-black text-indigo-700">DOCX + PDF</span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-slate-500">{definition.description} Kết quả gồm bản Sinh DOCX và Sinh PDF, cùng một context dữ liệu của hồ sơ. Bấm “Kiểm tra dữ liệu” trước khi sinh.</p>
            <p className="mt-1 font-mono text-[9px] text-slate-400">{dossier.dossierCode} · {kind}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng modal sinh tài liệu" className="mobile-touch-target shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"><X size={18} /></button>
        </header>
        <main className="min-h-0 flex-1 mobile-scroll-y overflow-y-auto p-3 md:p-4">
          <PcnDocumentGenerationPanel
            dossier={dossier}
            proposalUpdatedAt={proposalUpdatedAt}
            templates={templates}
            documentRequirements={documentRequirements}
            generatedDocuments={generatedDocuments}
            sampleLots={sampleLots}
            sampleRoutes={sampleRoutes}
            labRequests={labRequests}
            users={users}
            canGenerate={canGenerate}
            initialKind={kind}
            initialSampleRouteId={sampleRouteId}
            initialLabRequestId={labRequestId}
            onPreflight={onPreflight}
            onGenerate={onGenerate}
            onConfirmGenerated={onConfirmGenerated}
          />
        </main>
        <footer className="flex shrink-0 flex-col items-stretch gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[10px] text-slate-400">Tài liệu chỉ được lưu vào bộ hồ sơ sau khi sinh thành công và giữ nguyên phiên bản cũ.</span>
          <button type="button" onClick={onClose} className="mobile-touch-target min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[10px] font-black text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 sm:w-auto">Đóng</button>
        </footer>
      </section>
    </div>
  );
}

export default PcnDocumentOutputModal;
