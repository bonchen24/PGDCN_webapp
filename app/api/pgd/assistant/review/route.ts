// Author: Gemini
// OS support: Web/Node
// Description: PGD Assistant review execution with NDJSON streaming

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getPgdSessionUser, requirePgdSession } from '@/lib/server/pgd';
import { jsonBadRequest, jsonConflict } from '@/lib/server/response';
import {
  extractPgdAssistantTexts,
  loadPgdAssistantInput,
  semanticReviewPgdCriterion,
} from '@/lib/server/pgd-assistant';
import {
  PgdAssistantCriterion,
  PgdAssistantReview,
  buildPgdAssistantReview,
  getPgdAssistantCandidates,
} from '@/utils/pgdAssistant';
import { PcnPaddleOcrUnavailableError } from '@/utils/pcnApprovalReviewOcr';
import { GEMINI_API_KEY_MISSING_MESSAGE } from '@/lib/server/gemini';

export async function POST(req: NextRequest) {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const requestId = decodeURIComponent(String(body?.requestId || '')).trim();
  if (!requestId || requestId.length > 240 || /[\\/]/.test(requestId)) {
    return jsonBadRequest('Mã hồ sơ PGD không hợp lệ.');
  }

  try {
    const loaded = await loadPgdAssistantInput(requestId);
    if (getPgdAssistantCandidates([loaded.input.request]).length === 0) {
      return jsonConflict('Hồ sơ PGD không thuộc danh sách đang cần trợ lý kiểm tra.');
    }

    const actor = getPgdSessionUser(req)!;
    const startedAt = new Date().toISOString();
    const runId = randomUUID();

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
            requestId,
            startedAt,
            actorUsername: actor.username,
            message: 'Đã mở phiên đọc hồ sơ PGD. Kết quả sẽ hiện lần lượt theo 11 tiêu chí.',
          });

          const extracted = await extractPgdAssistantTexts(req, loaded.input, loaded.dossierDocuments);
          const baseReview = buildPgdAssistantReview({
            ...loaded.input,
            documentTexts: extracted.documentTexts,
            unreadableFiles: extracted.unreadableFiles,
          });

          const criteria: PgdAssistantCriterion[] = [];
          for (let index = 0; index < baseReview.criteria.length; index += 1) {
            const criterion = baseReview.criteria[index];
            writeEvent({
              type: 'criterion_started',
              index,
              total: baseReview.criteria.length,
              criterion: { id: criterion.id, title: criterion.title },
            });
            const reviewed = await semanticReviewPgdCriterion(req, criterion, extracted.documentTexts);
            criteria.push(reviewed);
            writeEvent({
              type: 'criterion_result',
              index,
              total: baseReview.criteria.length,
              criterion: reviewed,
            });
            writeEvent({
              type: 'criterion_completed',
              index,
              total: baseReview.criteria.length,
              criterionId: reviewed.id,
            });
          }

          const summary = {
            pass: criteria.filter((c) => c.status === 'PASS').length,
            warning: criteria.filter((c) => c.status === 'WARNING').length,
            error: criteria.filter((c) => c.status === 'ERROR').length,
            notEvaluable: criteria.filter((c) => c.status === 'NOT_EVALUABLE').length,
            conclusion: criteria.some((c) => c.status === 'ERROR')
              ? 'Cần xử lý lỗi trước khi xem xét tiếp.'
              : criteria.some((c) => c.status === 'NOT_EVALUABLE')
              ? 'Chưa đủ căn cứ cho một hoặc nhiều tiêu chí.'
              : criteria.some((c) => c.status === 'WARNING')
              ? 'Có cảnh báo cần người phụ trách đối chiếu.'
              : 'Bằng chứng hiện có phù hợp với 11 tiêu chí PGD.',
          } as PgdAssistantReview['summary'];

          writeEvent({
            type: 'run_completed',
            runId,
            requestId,
            finishedAt: new Date().toISOString(),
            summary,
            review: { domain: 'PGD', requestId, readOnly: true, criteria, summary },
            message: 'Đã hoàn tất phiên hỗ trợ PGD. Kết quả không làm thay đổi hồ sơ.',
          });
          controller.close();
        } catch (error: any) {
          const missingKey = error?.message === GEMINI_API_KEY_MISSING_MESSAGE;
          const storageMissing = error?.message === 'PGD private file storage is not configured.';
          const message = missingKey
            ? GEMINI_API_KEY_MISSING_MESSAGE
            : error instanceof PcnPaddleOcrUnavailableError
            ? `Dừng phiên AI: ${error.message}`
            : String(error?.message || error);
          const code = missingKey
            ? 'GEMINI_API_KEY_MISSING'
            : storageMissing
            ? 'PGD_STORAGE_NOT_CONFIGURED'
            : error?.code || 'PGD_ASSISTANT_FAILED';

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
    const storageMissing = error?.message === 'PGD private file storage is not configured.';
    const message = missingKey ? GEMINI_API_KEY_MISSING_MESSAGE : String(error?.message || error);
    const status = missingKey || storageMissing || error instanceof PcnPaddleOcrUnavailableError ? 503 : Number(error?.statusCode) || 500;
    const code = missingKey ? 'GEMINI_API_KEY_MISSING' : storageMissing ? 'PGD_STORAGE_NOT_CONFIGURED' : error?.code || 'PGD_ASSISTANT_FAILED';
    return NextResponse.json({ code, error: message }, { status });
  }
}
