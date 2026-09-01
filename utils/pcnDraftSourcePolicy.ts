import type { CertificationDossier, CertificationProposal } from '../types.ts';

export interface PcnDraftSourceSelection {
  sourceProposalId?: string;
  sourceDossierId?: string;
  proposal?: CertificationProposal;
  dossier?: CertificationDossier;
}

function hasHistoricalImport(value: { historicalImport?: unknown } | undefined): boolean {
  return Boolean(value?.historicalImport && typeof value.historicalImport === 'object');
}

/** Validate optional draft source links before a workspace is persisted. */
export function validatePcnDraftSourceSelection(selection: PcnDraftSourceSelection): void {
  const sourceProposalId = String(selection.sourceProposalId || '').trim();
  const sourceDossierId = String(selection.sourceDossierId || '').trim();
  if (sourceProposalId && (!selection.proposal || selection.proposal.id !== sourceProposalId)) {
    throw new Error('Không tìm thấy Đề nghị nguồn trong database PCN.');
  }
  if (sourceDossierId && (!selection.dossier || selection.dossier.id !== sourceDossierId)) {
    throw new Error('Không tìm thấy hồ sơ nguồn trong database PCN.');
  }
  if (selection.proposal && selection.dossier && selection.dossier.proposalId !== selection.proposal.id) {
    throw new Error('Đề nghị và hồ sơ nguồn không thuộc cùng một bộ hồ sơ PCN.');
  }
  if (selection.proposal?.dossierId && selection.dossier && selection.proposal.dossierId !== selection.dossier.id) {
    throw new Error('Liên kết ngược của Đề nghị và hồ sơ nguồn không khớp.');
  }
  if (hasHistoricalImport(selection.proposal) || hasHistoricalImport(selection.dossier)) {
    throw new Error('Không được dùng hồ sơ lịch sử làm nguồn soạn thảo PCN.');
  }
}

