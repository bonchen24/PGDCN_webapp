import assert from 'node:assert/strict';
import test from 'node:test';
import PizZip from 'pizzip';
import { PDFDocument } from 'pdf-lib';

import { buildPcnApprovalReviewDocx, buildPcnApprovalReviewPdf } from '../utils/pcnApprovalReviewReport.ts';

const report = {
  dossierCode: 'HS-001',
  fieldCode: 'QC4',
  generatedAt: '2026-09-02T00:00:00.000Z',
  criteria: [{ id: 'ENTRY_GATE', title: 'Điều kiện', status: 'PASS', severity: 'INFO', source: 'RULE', summary: 'Đạt', findings: [] }],
  summary: { pass: 1, warning: 0, error: 0, notEvaluable: 0, highestSeverity: 'INFO', conclusion: 'KHÔNG PHÁT HIỆN BẤT THƯỜNG RÕ' },
} as any;

test('approval assistant reports are transient valid DOCX and PDF artifacts', async () => {
  const docx = buildPcnApprovalReviewDocx(report);
  const zip = new PizZip(docx);
  assert.ok(zip.file('word/document.xml'));
  assert.match(zip.file('word/document.xml')?.asText() || '', /BÁO CÁO HỖ TRỢ KIỂM DUYỆT/);

  const pdf = await buildPcnApprovalReviewPdf(report);
  assert.equal(pdf.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.equal((await PDFDocument.load(pdf)).getPageCount(), 1);
});

