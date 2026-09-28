// Author: Gemini
// OS support: Web/Node
// Description: PCN Approval Assistant candidates query endpoint

import { NextRequest, NextResponse } from 'next/server';
import { requirePcnSession } from '@/lib/server/auth';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { jsonError, jsonForbidden, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  assertApprovalAssistantField,
  canUseApprovalAssistant,
  normalizeApprovalAssistantRequirements,
  readApprovalAssistantRows,
} from '@/lib/server/pcn-approval-assistant';
import { getPcnApprovalReviewCandidates } from '@/utils/pcnApprovalReview';
import { CertificationDossier, CertificationProposal, PcnDossierDocument } from '@/types';

export async function GET(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Trợ lý kiểm duyệt PCN chỉ khả dụng trong profile PCN.');
  }
  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  try {
    const rawFieldCode = req.nextUrl.searchParams.get('fieldCode');
    const fieldCode = assertApprovalAssistantField(rawFieldCode);
    if (!canUseApprovalAssistant(req, fieldCode)) {
      return jsonForbidden('Tài khoản chưa được cấp quyền xem Lĩnh vực này.');
    }

    const [dossiers, proposals, requirements, documents] = await Promise.all([
      readApprovalAssistantRows('certificationDossiers'),
      readApprovalAssistantRows('certificationProposals'),
      readApprovalAssistantRows('pcnDocumentRequirements', `AND COALESCE((data->>'active')::boolean, false) = true`),
      readApprovalAssistantRows('dossierDocuments'),
    ]);

    const items = getPcnApprovalReviewCandidates({
      fieldCode,
      dossiers: dossiers as CertificationDossier[],
      proposals: proposals as CertificationProposal[],
      requirements: normalizeApprovalAssistantRequirements(requirements),
      documents: documents as PcnDossierDocument[],
    });

    return jsonOk({ items });
  } catch (error: any) {
    const status = Number(error?.statusCode) || 500;
    return jsonError(String(error?.message || error), status);
  }
}
