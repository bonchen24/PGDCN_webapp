// Author: Gemini
// OS support: Web/Node
// Description: KQTN Footer OCR background job status endpoint

import { NextRequest, NextResponse } from 'next/server';
import { jsonError, jsonOk } from '@/lib/server/response';
import { kqtnFooterJobs } from '@/lib/server/ocr';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId: rawJobId } = await params;
  const jobId = String(rawJobId || '').trim();
  const job = kqtnFooterJobs.get(jobId);
  if (!job) {
    return jsonError('Footer OCR job không còn tồn tại hoặc đã hết hạn.', 404, {
      code: 'KQTN_FOOTER_JOB_NOT_FOUND',
    });
  }

  return jsonOk({
    jobId: job.jobId,
    status: job.status,
    strategy: job.strategy,
    totalPages: job.totalPages,
    processedPages: job.processedPages,
    pages: job.pages,
    ...(job.error ? { error: job.error } : {}),
  });
}
