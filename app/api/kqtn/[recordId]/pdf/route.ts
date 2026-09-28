// Author: Gemini
// OS support: Web/Node
// Description: KQTN Record PDF upload, download, and deletion endpoints

import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { pool, withPgTransaction } from '@/lib/server/postgres';
import { getDocumentPayload } from '@/lib/server/collections';
import { jsonBadRequest, jsonCreated, jsonError, jsonForbidden, jsonNotFound, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import {
  KQTN_PDF_MAX_BYTES,
  buildKqtnPdfContentDisposition,
  getKqtnPdfMetadata,
  getKqtnStorageBucket,
  getKqtnStorageClient,
  sanitizeKqtnPathSegment,
} from '@/lib/server/kqtn-storage';
import { getKqtnSessionUsername, getSystemUserRoleByUsername } from '@/lib/server/kqtn-auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId: rawRecordId } = await params;
  const recordId = String(rawRecordId || '').trim();
  if (!recordId) return jsonBadRequest('Missing KQTN record id.');

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch (error: any) {
    return jsonBadRequest('Yêu cầu tải file không hợp lệ.');
  }

  const file = formData.get('file');
  if (!file || typeof file === 'string') {
    return jsonBadRequest('A PDF file is required.');
  }

  const fileBuffer = Buffer.from(await (file as Blob).arrayBuffer());
  if (fileBuffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    return jsonError('Only valid PDF files are accepted.', 415);
  }

  const bucketName = getKqtnStorageBucket();
  const sha256 = createHash('sha256').update(fileBuffer).digest('hex');
  const objectPath = `kqtnRecords/${sanitizeKqtnPathSegment(recordId)}/result-${sha256}.pdf`;
  const assetId = `kqtn-pdf-${sanitizeKqtnPathSegment(recordId)}-${sha256.slice(0, 16)}`;

  try {
    const storage = getKqtnStorageClient();
    const existing = await pool.query(
      `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2`,
      ['kqtnRecords', recordId],
    );
    if (existing.rows.length === 0) {
      return jsonNotFound('KQTN record not found.');
    }

    const oldPdf = getKqtnPdfMetadata(existing.rows[0].data);
    await storage.ensurePrivateBucket(bucketName, KQTN_PDF_MAX_BYTES);
    await storage.uploadObject({
      bucketName,
      objectPath,
      body: fileBuffer,
      mimeType: 'application/pdf',
    });

    const fileName = (file as File).name || 'result.pdf';
    const metadata = {
      assetId,
      bucketName,
      objectPath,
      originalName: String(fileName).replace(/[\\"]/g, '_').slice(0, 255),
      mimeType: 'application/pdf',
      byteSize: fileBuffer.length,
      sha256,
      uploadedAt: new Date().toISOString(),
      uploadedBy: String(req.headers.get('x-user-name') || 'KTV'),
    };

    try {
      await withPgTransaction(async (client) => {
        const locked = await client.query(
          `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 FOR UPDATE`,
          ['kqtnRecords', recordId],
        );
        if (locked.rows.length === 0) throw new Error('KQTN record not found.');
        const currentData = locked.rows[0].data || {};
        const currentPdf = getKqtnPdfMetadata(currentData);
        const nextData = { ...currentData, resultPdf: metadata };
        await client.query(
          `UPDATE app_documents SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $2 AND document_id = $3`,
          [JSON.stringify(getDocumentPayload({ ...nextData, id: recordId })), 'kqtnRecords', recordId],
        );
        if (currentPdf?.assetId) {
          await client.query(`DELETE FROM file_assets WHERE id = $1`, [currentPdf.assetId]);
        }
        await client.query(
          `INSERT INTO file_assets (id, bucket_name, object_path, source_collection, source_document_id, source_json_path, mime_type, byte_size, sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT (id) DO UPDATE SET bucket_name = EXCLUDED.bucket_name, object_path = EXCLUDED.object_path, byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256, updated_at = CURRENT_TIMESTAMP`,
          [assetId, bucketName, objectPath, 'kqtnRecords', recordId, 'resultPdf', 'application/pdf', fileBuffer.length, sha256],
        );
      });
    } catch (error) {
      await storage.deleteObject({ bucketName, objectPath }).catch(() => undefined);
      throw error;
    }

    if (oldPdf?.objectPath && oldPdf.objectPath !== objectPath) {
      await storage.deleteObject({ bucketName: oldPdf.bucketName || bucketName, objectPath: oldPdf.objectPath }).catch((error) => {
        console.warn('Unable to remove replaced KQTN PDF object:', error);
      });
    }

    return jsonCreated({ recordId, resultPdf: metadata });
  } catch (error: any) {
    console.error('KQTN PDF upload error:', error);
    const status = String(error?.message || '').includes('storage is not configured') ? 503 : 500;
    return jsonError(error?.message || String(error), status);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId: rawRecordId } = await params;
  const recordId = String(rawRecordId || '').trim();
  const searchParams = req.nextUrl.searchParams;
  const isDownload = searchParams.has('download');

  try {
    const result = await pool.query(
      `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2`,
      ['kqtnRecords', recordId],
    );
    const recordData = result.rows[0]?.data;
    const pdf = getKqtnPdfMetadata(recordData);
    if (!pdf) return jsonNotFound('KQTN PDF not found.');

    if (isDownload) {
      const paymentConfirmed = recordData?.customerPaymentConfirmed === true;
      if (!paymentConfirmed) {
        const username = getKqtnSessionUsername(req);
        if (!username) {
          return jsonUnauthorized('Phiên đăng nhập KQTN không hợp lệ hoặc đã hết hạn.');
        }
        const role = await getSystemUserRoleByUsername(username);
        if (role !== 'admin') {
          return jsonForbidden('Chưa mở khóa tải PDF KQTN; cần xác nhận thanh toán với khách hàng.');
        }
      }
    }

    const storage = getKqtnStorageClient();
    const downloaded = await storage.downloadObject({
      bucketName: pdf.bucketName || getKqtnStorageBucket(),
      objectPath: pdf.objectPath,
    });

    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Length', String(downloaded.body.byteLength));
    headers.set(
      'Content-Disposition',
      buildKqtnPdfContentDisposition(pdf.originalName, isDownload ? 'attachment' : 'inline'),
    );

    return new NextResponse(new Uint8Array(downloaded.body), { status: 200, headers });
  } catch (error: any) {
    console.error('KQTN PDF download error:', error);
    const status = String(error?.message || '').includes('storage is not configured') ? 503 : 500;
    return jsonError(error?.message || String(error), status);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ recordId: string }> },
) {
  const { recordId: rawRecordId } = await params;
  const recordId = String(rawRecordId || '').trim();

  try {
    const result = await pool.query(
      `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2`,
      ['kqtnRecords', recordId],
    );
    const pdf = getKqtnPdfMetadata(result.rows[0]?.data);
    if (!pdf) return jsonNotFound('KQTN PDF not found.');

    const storage = getKqtnStorageClient();
    await storage.deleteObject({
      bucketName: pdf.bucketName || getKqtnStorageBucket(),
      objectPath: pdf.objectPath,
    });

    await withPgTransaction(async (client) => {
      const locked = await client.query(
        `SELECT data FROM app_documents WHERE collection_name = $1 AND document_id = $2 FOR UPDATE`,
        ['kqtnRecords', recordId],
      );
      if (locked.rows.length === 0) throw new Error('KQTN record not found.');
      const data = { ...(locked.rows[0].data || {}) };
      delete data.resultPdf;
      await client.query(
        `UPDATE app_documents SET data = $1::jsonb, updated_at = CURRENT_TIMESTAMP WHERE collection_name = $2 AND document_id = $3`,
        [JSON.stringify(getDocumentPayload({ ...data, id: recordId })), 'kqtnRecords', recordId],
      );
      if (pdf.assetId) {
        await client.query(`DELETE FROM file_assets WHERE id = $1`, [pdf.assetId]);
      }
    });

    return jsonOk({ deleted: true, recordId });
  } catch (error: any) {
    console.error('KQTN PDF delete error:', error);
    const status = String(error?.message || '').includes('storage is not configured') ? 503 : 500;
    return jsonError(error?.message || String(error), status);
  }
}
