import { NextRequest } from 'next/server';
import { withPgTransaction } from '@/lib/server/postgres';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { getPcnStorageClient } from '@/lib/server/storage';
import { jsonBadRequest, jsonError, jsonOk } from '@/lib/server/response';
import { executeConfirmPcnDossierDocument } from '@/lib/server/pcn-dossier-operations';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ dossierId: string }> },
) {
  const mutationError = requirePcnMutation(req);
  if (mutationError) return mutationError;

  const actor = getPcnSessionUser(req)!;
  const { dossierId: rawDossierId } = await params;
  const dossierId = String(rawDossierId || '').trim();

  const bodyJson = await req.json().catch(() => ({}));
  const generatedDocumentId = String(bodyJson?.generatedDocumentId || '').trim();
  const draftId = String(bodyJson?.draftId || '').trim();
  const outputId = String(bodyJson?.outputId || '').trim();
  const confirmingDraftOutput = Boolean(draftId || outputId);
  const requirementId = String(bodyJson?.requirementId || '').trim();
  const nodeId = String(bodyJson?.nodeId || '').trim();

  if (
    !dossierId ||
    !requirementId ||
    (confirmingDraftOutput ? (!draftId || !outputId) : !generatedDocumentId) ||
    generatedDocumentId.length > 240 ||
    draftId.length > 240 ||
    outputId.length > 240 ||
    requirementId.length > 200 ||
    /[\\/]/.test(generatedDocumentId) ||
    /[\\/]/.test(draftId) ||
    /[\\/]/.test(outputId) ||
    /[\\/]/.test(requirementId)
  ) {
    return jsonBadRequest('Thiếu metadata xác nhận bản sinh vào checklist.');
  }

  const uploadedObjects: Array<{ bucketName: string; objectPath: string }> = [];

  try {
    const result = await withPgTransaction(async (client) => {
      return executeConfirmPcnDossierDocument(
        client,
        {
          actor,
          dossierId,
          requirementId,
          generatedDocumentId,
          draftId,
          outputId,
          nodeId,
        },
        uploadedObjects,
      );
    });

    return jsonOk(result, { status: result.idempotent ? 200 : 201 });
  } catch (error: any) {
    for (const uploaded of uploadedObjects.reverse()) {
      try {
        const storage = getPcnStorageClient();
        await storage.deleteObject(uploaded);
      } catch {
        // Keep the original confirmation error; cleanup is best effort.
      }
    }
    console.error('PCN generated document confirmation error:', error);
    const message = String(error?.message || error);
    const normalizedMessage = message.toLowerCase();
    const status = Number(error?.statusCode)
      || (normalizedMessage.includes('storage is not configured') ? 503
        : normalizedMessage.includes('không tìm thấy') ? 404
          : normalizedMessage.includes('không thuộc') || normalizedMessage.includes('không khớp') || normalizedMessage.includes('không hợp lệ') || normalizedMessage.includes('không thể xác nhận') || normalizedMessage.includes('ánh xạ') ? 400
            : 500);
    return jsonError(message, status);
  }
}
