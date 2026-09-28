// Author: Gemini
// OS support: Web/Node
// Description: KQTN Footer OCR background job creation endpoint

import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { jsonBadRequest, jsonError } from '@/lib/server/response';
import {
  KQTN_FOOTER_JOB_MAX_ACTIVE,
  KqtnFooterJobRecord,
  kqtnFooterJobs,
  runKqtnFooterJob,
} from '@/lib/server/ocr';

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error: any) {
    return jsonError('Không thể nhận PDF scan.', 400, { code: 'KQTN_FOOTER_JOB_UPLOAD_FAILED' });
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return jsonBadRequest('A combined PDF file is required.');
  }

  const fileBuffer = Buffer.from(await (file as Blob).arrayBuffer());
  if (fileBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return jsonError('Only valid PDF files are accepted.', 415);
  }

  const hasActiveFooterJob = [...kqtnFooterJobs.values()].some(
    (job) => job.status === 'queued' || job.status === 'running',
  );
  if (hasActiveFooterJob && KQTN_FOOTER_JOB_MAX_ACTIVE <= 1) {
    return jsonError(
      'Đang có một PDF scan được OCR; vui lòng chờ job hiện tại hoàn tất.',
      429,
      { code: 'KQTN_FOOTER_JOB_BUSY' },
    );
  }

  const rawTotalPages = formData.get('totalPages');
  const parsedTotalPages = Number(rawTotalPages);
  const totalPages = Number.isFinite(parsedTotalPages) ? Math.max(0, Math.floor(parsedTotalPages)) : 0;
  const jobId = 'kqtn-footer-' + randomUUID();
  const job: KqtnFooterJobRecord = {
    jobId,
    status: 'queued',
    totalPages,
    processedPages: 0,
    pages: [],
    createdAt: Date.now(),
  };

  kqtnFooterJobs.set(jobId, job);
  console.log(`KQTN footer job accepted: jobId=${jobId}, pages=${totalPages}, payloadBytes=${fileBuffer.length}`);
  void runKqtnFooterJob(jobId, fileBuffer);

  return NextResponse.json(
    {
      jobId,
      status: job.status,
      strategy: job.strategy,
      totalPages: job.totalPages,
      processedPages: job.processedPages,
      pages: job.pages,
    },
    { status: 202 },
  );
}
