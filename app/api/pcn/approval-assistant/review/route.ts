// Author: Gemini
// OS support: Web/Node
// Description: PCN Approval Assistant review execution with NDJSON streaming

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPcnSessionUser, requirePcnSession } from '@/lib/server/auth';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { jsonBadRequest, jsonConflict, jsonError, jsonForbidden, jsonNotFound } from '@/lib/server/response';
import {
  PCN_APPROVAL_REVIEW_TTL_MS,
  approvalAssistantDossierStatus,
  assertApprovalAssistantField,
  canUseApprovalAssistant,
  extractApprovalAssistantTexts,
  loadApprovalAssistantInput,
  pcnApprovalReviewRuns,
  pruneApprovalAssistantRuns,
  semanticReviewCriterion,
} from '@/lib/server/pcn-approval-assistant';
import {
  PCN_APPROVAL_REVIEW_CRITERIA,
  PcnApprovalCriterionResult,
  buildPcnApprovalReview,
} from '@/utils/pcnApprovalReview';
import { PcnPaddleOcrUnavailableError } from '@/utils/pcnApprovalReviewOcr';
import { GEMINI_API_KEY_MISSING_MESSAGE } from '@/lib/server/gemini';
import { PcnCertificationFieldCode } from '@/types';

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

  let fieldCode: PcnCertificationFieldCode;
  try {
    fieldCode = assertApprovalAssistantField(body?.fieldCode);
  } catch (error: any) {
    return jsonError(String(error?.message || error), Number(error?.statusCode) || 400);
  }

  const dossierId = String(body?.dossierId || '').trim();
  if (!dossierId || dossierId.length > 240 || /[\\/]/.test(dossierId)) {
    return jsonBadRequest('Mã hồ sơ PCN không hợp lệ.');
  }

  if (!canUseApprovalAssistant(req, fieldCode)) {
    return jsonForbidden('Tài khoản chưa được cấp quyền xem Lĩnh vực này.');
  }

  const actor = getPcnSessionUser(req)!;

  try {
    const input = await loadApprovalAssistantInput(dossierId, fieldCode);
    if (
      input.dossier.historicalImport ||
      !input.dossier.fieldCodes.includes(fieldCode) ||
      !approvalAssistantDossierStatus.has(input.dossier.status)
    ) {
      return jsonConflict('Hồ sơ không thuộc danh sách đang cần trợ lý kiểm duyệt.');
    }

    const runId = randomUUID();
    const startedAt = new Date().toISOString();

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const writeEvent = (event: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          writeEvent({
            type: 'run_started',
            runId,
            dossierId,
            fieldCode,
            startedAt,
            message: 'Đã mở phiên đọc hồ sơ. Kết quả sẽ hiện lần lượt theo tiêu chí.',
          });

          const extracted = await extractApprovalAssistantTexts(req, input);
          const { documentTexts } = extracted;
          const baseReport = buildPcnApprovalReview({
            ...input,
            documentTexts,
            unreadableFiles: extracted.unreadableFiles,
          });

          const criteria: PcnApprovalCriterionResult[] = [];
          for (let index = 0; index < PCN_APPROVAL_REVIEW_CRITERIA.length; index += 1) {
            const criterion = baseReport.criteria[index];
            writeEvent({
              type: 'criterion_started',
              index,
              total: baseReport.criteria.length,
              criterion: { id: criterion.id, title: criterion.title },
            });
            const reviewed = await semanticReviewCriterion(req, criterion, documentTexts);
            criteria.push(reviewed);
            writeEvent({
              type: 'criterion_result',
              index,
              total: baseReport.criteria.length,
              criterion: reviewed,
            });
            writeEvent({
              type: 'criterion_completed',
              index,
              total: baseReport.criteria.length,
              criterionId: reviewed.id,
            });
          }

          const summary = {
            pass: criteria.filter((c) => c.status === 'PASS').length,
            warning: criteria.filter((c) => c.status === 'WARNING').length,
            error: criteria.filter((c) => c.status === 'ERROR').length,
            notEvaluable: criteria.filter((c) => c.status === 'NOT_EVALUABLE').length,
            highestSeverity: criteria.some((c) => c.severity === 'CRITICAL')
              ? 'CRITICAL'
              : criteria.some((c) => c.severity === 'ATTENTION')
              ? 'ATTENTION'
              : 'INFO',
            conclusion: criteria.some((c) => c.status === 'NOT_EVALUABLE')
              ? 'CHƯA ĐỦ CĂN CỨ'
              : criteria.some((c) => c.status === 'ERROR' || c.status === 'WARNING')
              ? 'CẦN KIỂM TRA/BỔ SUNG'
              : 'KHÔNG PHÁT HIỆN BẤT THƯỜNG RÕ',
          } as ReturnType<typeof buildPcnApprovalReview>['summary'];

          const report = { criteria, summary };
          pcnApprovalReviewRuns.set(runId, {
            runId,
            username: actor.username,
            dossierId,
            dossierCode: input.dossier.dossierCode,
            fieldCode,
            report,
            expiresAt: Date.now() + PCN_APPROVAL_REVIEW_TTL_MS,
          });
          pruneApprovalAssistantRuns();

          writeEvent({
            type: 'run_completed',
            runId,
            finishedAt: new Date().toISOString(),
            summary,
            exportToken: runId,
            message: 'Đã hoàn tất phiên hỗ trợ. Kết quả không làm thay đổi hồ sơ.',
          });
          controller.close();
        } catch (error: any) {
          const missingKey = error?.message === GEMINI_API_KEY_MISSING_MESSAGE;
          const message = missingKey
            ? GEMINI_API_KEY_MISSING_MESSAGE
            : error instanceof PcnPaddleOcrUnavailableError
            ? `Dừng phiên AI: ${error.message}`
            : String(error?.message || error);
          const code = missingKey
            ? 'GEMINI_API_KEY_MISSING'
            : error?.code || 'PCN_APPROVAL_ASSISTANT_FAILED';

          writeEvent({ type: 'run_error', code, message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    const missingKey = error?.message === GEMINI_API_KEY_MISSING_MESSAGE;
    const message = missingKey
      ? GEMINI_API_KEY_MISSING_MESSAGE
      : error instanceof PcnPaddleOcrUnavailableError
      ? `Dừng phiên AI: ${error.message}`
      : String(error?.message || error);
    const status = missingKey || error instanceof PcnPaddleOcrUnavailableError ? 503 : Number(error?.statusCode) || 500;
    const code = missingKey ? 'GEMINI_API_KEY_MISSING' : error?.code || 'PCN_APPROVAL_ASSISTANT_FAILED';
    return NextResponse.json({ code, error: message }, { status });
  }
}
