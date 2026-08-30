export type PcnDocumentType = 'CERTIFICATION_PROPOSAL' | 'OUTBOUND_LAB_REQUEST';

import type { CertificationProposal } from '../types.ts';

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/đ/g, 'd')
    .trim();
}

export function classifyPcnDocumentType(label: string): PcnDocumentType {
  const normalized = normalize(label);
  if (normalized.includes('de nghi')) return 'CERTIFICATION_PROPOSAL';
  if (normalized.includes('pyc') && normalized.includes('ptn')) return 'OUTBOUND_LAB_REQUEST';
  if (normalized.includes('phieu yeu cau')) {
    throw new Error('Đầu vào PCN phải dùng Đề nghị; Phiếu yêu cầu chỉ dùng khi gửi PTN');
  }
  throw new Error('Không nhận diện được loại chứng từ PCN');
}

export function markPcnProposalConverted(
  proposal: CertificationProposal,
  dossierId: string,
  now: string = new Date().toISOString(),
): CertificationProposal {
  const normalizedDossierId = String(dossierId || '').trim();
  if (!normalizedDossierId) throw new Error('Đề nghị phải liên kết với hồ sơ chứng nhận');
  if (proposal.status === 'REJECTED') throw new Error('Không thể mở hồ sơ từ Đề nghị đã từ chối');
  return {
    ...proposal,
    status: 'CONVERTED',
    dossierId: normalizedDossierId,
    updatedAt: now,
  };
}

export interface PcnSampleAcceptanceInput {
  isSealed: boolean;
  isUnused: boolean;
  matchesProposal: boolean;
  sampleCount: number;
  minimumSampleCount: number;
}

export interface PcnSampleAcceptanceResult {
  accepted: boolean;
  reasons: string[];
}

export function evaluatePcnSampleAcceptance(input: PcnSampleAcceptanceInput): PcnSampleAcceptanceResult {
  const reasons: string[] = [];
  if (!input.isSealed) reasons.push('Mẫu chưa niêm phong hoặc không còn nguyên trạng');
  if (!input.isUnused) reasons.push('Mẫu đã qua sử dụng');
  if (!input.matchesProposal) reasons.push('Thông tin mẫu không khớp Đề nghị');
  if (input.sampleCount < input.minimumSampleCount) reasons.push('Số lượng mẫu chưa đạt mức tối thiểu');
  return { accepted: reasons.length === 0, reasons };
}
