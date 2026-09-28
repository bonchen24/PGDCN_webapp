// Author: Gemini
// OS support: Web/Node
// Description: Export PCN Approval Assistant review report (DOCX / PDF)

import { NextRequest, NextResponse } from 'next/server';
import { getPcnSessionUser, requirePcnSession } from '@/lib/server/auth';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { jsonBadRequest, jsonError, jsonForbidden, jsonNotFound } from '@/lib/server/response';
import {
  pcnApprovalReviewRuns,
  pruneApprovalAssistantRuns,
} from '@/lib/server/pcn-approval-assistant';
import { buildPcnFileContentDisposition } from '@/lib/server/pcn-files';
import { buildPcnApprovalReviewDocx, buildPcnApprovalReviewPdf } from '@/utils/pcnApprovalReviewReport';

export async function POST(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Trợ lý kiểm duyệt PCN chỉ khả dụng trong profile PCN.');
  }
  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  try {
    pruneApprovalAssistantRuns();
    const runId = String(body?.runId || body?.exportToken || '').trim();
    const format = String(body?.format || '').trim().toUpperCase();
    const run = pcnApprovalReviewRuns.get(runId);
    if (!run || run.expiresAt <= Date.now()) {
      return jsonNotFound('Phiên hỗ trợ đã hết hạn, hãy chạy lại hồ sơ.');
    }

    const actor = getPcnSessionUser(req)!;
    if (run.username.toLowerCase() !== actor.username.toLowerCase()) {
      return jsonForbidden('Bạn không có quyền tải báo cáo của phiên này.');
    }

    const dossierCode = run.dossierCode;
    const report = { dossierCode, fieldCode: run.fieldCode, generatedAt: new Date().toISOString(), ...run.report };

    if (format === 'DOCX') {
      const docxBuffer = buildPcnApprovalReviewDocx(report);
      const headers = new Headers();
      headers.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      headers.set('Content-Disposition', buildPcnFileContentDisposition(`bao-cao-ho-tro-${dossierCode}.docx`, 'attachment'));
      return new NextResponse(new Uint8Array(docxBuffer), { status: 200, headers });
    }

    if (format === 'PDF') {
      const pdfBuffer = await buildPcnApprovalReviewPdf(report);
      const headers = new Headers();
      headers.set('Content-Type', 'application/pdf');
      headers.set('Content-Disposition', buildPcnFileContentDisposition(`bao-cao-ho-tro-${dossierCode}.pdf`, 'attachment'));
      return new NextResponse(new Uint8Array(pdfBuffer), { status: 200, headers });
    }

    return jsonBadRequest('Định dạng báo cáo chỉ hỗ trợ PDF hoặc DOCX.');
  } catch (error: any) {
    return jsonError(String(error?.message || error), Number(error?.statusCode) || 500);
  }
}
