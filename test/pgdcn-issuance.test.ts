import assert from 'node:assert/strict';
import test from 'node:test';
import { validatePgdIssuanceAction } from '../utils/pgdIssuance';

const signedPdf = { action: 'SIGN' as const, issueDate: '2026-11-06', expiryDate: '2027-11-06', fileName: 'final.pdf', fileSize: 128, mimeType: 'application/pdf', pdfHeaderValid: true };

test('PGD B7 signing requires B6 approval and a valid signed PDF/date range', () => {
  assert.equal(validatePgdIssuanceAction({ status: 'APPROVED_FOR_ISSUANCE' }, { status: 'APPROVED' }, signedPdf), null);
  assert.match(validatePgdIssuanceAction({ status: 'LEADERSHIP_APPROVAL' }, { status: 'DRAFT' }, signedPdf) || '', /B6/);
  assert.match(validatePgdIssuanceAction({ status: 'APPROVED_FOR_ISSUANCE' }, { status: 'APPROVED' }, { ...signedPdf, expiryDate: '2026-11-05' }) || '', /hết hạn/);
  assert.match(validatePgdIssuanceAction({ status: 'APPROVED_FOR_ISSUANCE' }, { status: 'APPROVED' }, { ...signedPdf, pdfHeaderValid: false }) || '', /PDF hợp lệ/);
});

test('PGD B7 delivery and archive require completed previous issuance gates', () => {
  assert.equal(validatePgdIssuanceAction({ status: 'SIGNED' }, { status: 'SIGNED', issuanceFileAssetId: 'asset-1' }, { action: 'DELIVER', deliveredTo: 'Nguyễn Văn A' }), null);
  assert.match(validatePgdIssuanceAction({ status: 'SIGNED' }, { status: 'SIGNED' }, { action: 'DELIVER', deliveredTo: 'Nguyễn Văn A' }) || '', /PDF/);
  assert.equal(validatePgdIssuanceAction({ status: 'RESULT_RETURNED' }, { status: 'SIGNED', deliveredAt: '2026-11-06T01:00:00.000Z', deliveredTo: 'Nguyễn Văn A' }, { action: 'ARCHIVE' }), null);
  assert.match(validatePgdIssuanceAction({ status: 'RESULT_RETURNED' }, { status: 'SIGNED' }, { action: 'ARCHIVE' }) || '', /bàn giao/);
});
