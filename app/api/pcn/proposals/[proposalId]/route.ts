import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { withPgTransaction } from '@/lib/server/db';
import { getPcnSessionUser, requirePcnMutation } from '@/lib/server/auth';
import { jsonError, jsonForbidden, jsonOk, jsonUnauthorized } from '@/lib/server/response';
import { getDocumentPayload, mapDocumentRow } from '@/lib/server/collections';
import { buildActivityLog, validateActivityLogPayload } from '@/lib/server/activity-logs';
import { diffActivityFields } from '@/utils/activityLog';
import { isSafePcnSampleKey, stablePcnMutationId } from '@/lib/server/pcn-signer-delegations';
import { assertPcnDossierOperator } from '@/lib/server/pcn-dossiers';
import { formatPcnIntakeValidationIssues, validatePcnProposalIntake } from '@/utils/pcnIntakePolicy';
import { CertificationDossier, CertificationProposal } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ proposalId: string }> | { proposalId: string } }
) {
  const actor = getPcnSessionUser(req);
  if (!actor) {
    return jsonUnauthorized('Phiên PCN không hợp lệ hoặc đã hết hạn.');
  }
  if (!requirePcnMutation(actor)) {
    return jsonForbidden('Bạn không có quyền thực hiện thao tác trong PCN.');
  }

  const resolvedParams = await Promise.resolve(context.params);
  const proposalId = decodeURIComponent(String(resolvedParams.proposalId || '')).trim();

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonError('Invalid JSON payload', 400);
  }

  const idempotencyKey = String(body?.idempotencyKey || '').trim();
  const rawUpdates = body?.updates;
  if (!isSafePcnSampleKey(proposalId) || !isSafePcnSampleKey(idempotencyKey)) {
    return jsonError('Mã Đề nghị và idempotencyKey phải hợp lệ.', 400);
  }
  if (!rawUpdates || typeof rawUpdates !== 'object' || Array.isArray(rawUpdates)) {
    return jsonError('Thiếu dữ liệu cập nhật Đề nghị.', 400);
  }

  const allowedFields = new Set([
    'channel',
    'customerId',
    'customerSnapshot',
    'warehouseAddress',
    'productName',
    'productType',
    'model',
    'brand',
    'specifications',
    'manufacturer',
    'manufacturerAddress',
    'quantity',
  ]);
  const unknownFields = Object.keys(rawUpdates).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    return jsonError(
      `Trường cập nhật Đề nghị không được phép: ${unknownFields.join(', ')}.`,
      400
    );
  }

  const idempotencyFingerprint = createHash('sha256')
    .update(JSON.stringify({ proposalId, updates: rawUpdates }))
    .digest('hex');

  try {
    const result = await withPgTransaction(async (client) => {
      const proposalResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationProposals' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [proposalId]
      );
      if (proposalResult.rows.length === 0) {
        throw Object.assign(new Error('Không tìm thấy Đề nghị cần cập nhật.'), { statusCode: 404 });
      }
      const proposal = mapDocumentRow(proposalResult.rows[0]) as CertificationProposal;
      const dossierId = String(proposal.dossierId || '').trim();
      if (!dossierId) {
        throw Object.assign(new Error('Đề nghị chưa có hồ sơ liên kết để cập nhật.'), { statusCode: 409 });
      }

      const dossierResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'certificationDossiers' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [dossierId]
      );
      if (dossierResult.rows.length === 0) {
        throw Object.assign(new Error('Đề nghị đã tồn tại nhưng thiếu hồ sơ liên kết.'), { statusCode: 409 });
      }
      const dossier = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
      if (String(dossier.proposalId || '').trim() !== proposal.id) {
        throw Object.assign(new Error('Liên kết hai chiều giữa Đề nghị và hồ sơ không hợp lệ.'), { statusCode: 409 });
      }
      assertPcnDossierOperator(dossier, actor);

      const proposalActivityId = stablePcnMutationId(
        'activity-pcn-proposal-update',
        `${proposalId}:${idempotencyKey}`
      );
      const existingActivityResult = await client.query(
        `SELECT document_id, data FROM app_documents
         WHERE collection_name = 'activityLogs' AND document_id = $1
         LIMIT 1 FOR UPDATE`,
        [proposalActivityId]
      );
      if (existingActivityResult.rows.length > 0) {
        const existingActivity = mapDocumentRow(existingActivityResult.rows[0]) as Record<string, any>;
        if (
          existingActivity.idempotencyFingerprint &&
          existingActivity.idempotencyFingerprint !== idempotencyFingerprint
        ) {
          throw Object.assign(
            new Error('idempotencyKey đã được dùng cho một cập nhật Đề nghị khác.'),
            { statusCode: 409 }
          );
        }
        const dossierSnapshot = mapDocumentRow(dossierResult.rows[0]) as CertificationDossier;
        const dossierActivityId = stablePcnMutationId(
          'activity-pcn-dossier-proposal-update',
          `${proposalId}:${idempotencyKey}`
        );
        const dossierActivityResult = await client.query(
          `SELECT document_id, data FROM app_documents WHERE collection_name = 'activityLogs' AND document_id = $1 LIMIT 1`,
          [dossierActivityId]
        );
        return {
          proposal,
          dossier: dossierSnapshot,
          activityLogs: [
            existingActivity,
            ...(dossierActivityResult.rows[0] ? [mapDocumentRow(dossierActivityResult.rows[0])] : []),
          ],
          idempotent: true as const,
        };
      }

      if (!['INTAKE_REVIEW', 'AWAITING_DOCUMENTS'].includes(dossier.status)) {
        throw Object.assign(
          new Error('Chỉ được sửa Đề nghị khi hồ sơ đang kiểm tra đầu vào hoặc chờ bổ sung hồ sơ.'),
          { statusCode: 409 }
        );
      }

      const updates: any = {};
      if (rawUpdates.channel !== undefined) {
        const channel = String(rawUpdates.channel || '').trim().toUpperCase();
        if (!['DIRECT', 'EMAIL', 'ONLINE_ZALO', 'OTHER'].includes(channel)) {
          throw Object.assign(new Error('Kênh tiếp nhận Đề nghị không hợp lệ.'), { statusCode: 400 });
        }
        updates.channel = channel;
      }
      if (rawUpdates.customerSnapshot !== undefined) {
        const incomingCustomer = rawUpdates.customerSnapshot;
        if (!incomingCustomer || typeof incomingCustomer !== 'object' || Array.isArray(incomingCustomer)) {
          throw Object.assign(new Error('Snapshot khách hàng cập nhật không hợp lệ.'), { statusCode: 400 });
        }
        const currentCustomer = proposal.customerSnapshot || { name: '', address: '' };
        const customer: Record<string, string> = {};
        for (const key of ['name', 'address', 'taxId', 'phone', 'email', 'contactPerson'] as const) {
          if (
            incomingCustomer[key] !== undefined &&
            incomingCustomer[key] !== null &&
            typeof incomingCustomer[key] !== 'string'
          ) {
            throw Object.assign(new Error(`Trường khách hàng ${key} phải là chuỗi.`), { statusCode: 400 });
          }
          const value =
            incomingCustomer[key] === undefined
              ? String((currentCustomer as any)[key] || '').trim()
              : String(incomingCustomer[key] || '').trim();
          if (value) customer[key] = value;
        }
        updates.customerSnapshot = customer;
      }
      for (const field of [
        'customerId',
        'warehouseAddress',
        'productName',
        'productType',
        'model',
        'brand',
        'specifications',
        'manufacturer',
        'manufacturerAddress',
      ] as const) {
        if (rawUpdates[field] === undefined) continue;
        if (rawUpdates[field] !== null && typeof rawUpdates[field] !== 'string') {
          throw Object.assign(new Error(`Trường ${field} phải là chuỗi hoặc null.`), { statusCode: 400 });
        }
        updates[field] = String(rawUpdates[field] || '').trim() || undefined;
      }
      if (rawUpdates.quantity !== undefined) {
        const quantity = Number(rawUpdates.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) {
          throw Object.assign(new Error('Số lượng mẫu phải là số nguyên dương.'), { statusCode: 400 });
        }
        updates.quantity = quantity;
      }
      const candidate = {
        ...proposal,
        ...updates,
        id: proposal.id,
        proposalCode: proposal.proposalCode,
        fieldCodes: proposal.fieldCodes,
      } as CertificationProposal;
      const intakeValidation = validatePcnProposalIntake(candidate);
      if (!intakeValidation.valid) {
        throw Object.assign(
          new Error(formatPcnIntakeValidationIssues(intakeValidation.issues)),
          { statusCode: 400 }
        );
      }

      const now = new Date().toISOString();
      const nextProposal: CertificationProposal = { ...candidate, updatedAt: now };
      const nextDossier: CertificationDossier = {
        ...dossier,
        customerSnapshot: { ...nextProposal.customerSnapshot },
        updatedAt: now,
      };
      const proposalChanges = diffActivityFields(proposal, nextProposal, [
        'channel',
        'customerId',
        'customerSnapshot',
        'warehouseAddress',
        'productName',
        'productType',
        'model',
        'brand',
        'specifications',
        'manufacturer',
        'manufacturerAddress',
        'quantity',
      ]);
      if (proposalChanges.length === 0) {
        return { proposal, dossier, activityLogs: [], idempotent: true as const };
      }

      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationProposals' AND document_id = $1`,
        [proposal.id, JSON.stringify(getDocumentPayload(nextProposal))]
      );
      await client.query(
        `UPDATE app_documents SET data = $2::jsonb, updated_at = CURRENT_TIMESTAMP
         WHERE collection_name = 'certificationDossiers' AND document_id = $1`,
        [dossier.id, JSON.stringify(getDocumentPayload(nextDossier))]
      );

      const dossierChanges = diffActivityFields(dossier, nextDossier, ['customerSnapshot', 'updatedAt']);
      const proposalActivity = {
        ...buildActivityLog({
          id: proposalActivityId,
          action: 'UPDATED',
          entityType: 'PCN_PROPOSAL',
          entityId: proposal.id,
          entityLabel: proposal.proposalCode,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          summary: 'Cập nhật thông tin đầu vào Đề nghị chứng nhận',
          source: 'UI',
          changes: proposalChanges,
          createdAt: now,
        }),
        idempotencyKey,
        idempotencyFingerprint,
      };
      const dossierActivity = {
        ...buildActivityLog({
          id: stablePcnMutationId('activity-pcn-dossier-proposal-update', `${proposalId}:${idempotencyKey}`),
          action: 'UPDATED',
          entityType: 'PCN_DOSSIER',
          entityId: dossier.id,
          entityLabel: dossier.dossierCode,
          actorUsername: actor.username,
          actorName: actor.name,
          actorRole: actor.systemRole || actor.role,
          summary: 'Đồng bộ hồ sơ sau khi cập nhật Đề nghị',
          source: 'UI',
          changes: dossierChanges,
          createdAt: now,
        }),
        idempotencyKey,
        idempotencyFingerprint,
      };
      for (const activity of [proposalActivity, dossierActivity]) {
        const validationError = validateActivityLogPayload(activity);
        if (validationError) throw new Error(validationError);
        await client.query(
          `INSERT INTO app_documents (collection_name, document_id, data, updated_at)
           VALUES ('activityLogs', $1, $2::jsonb, CURRENT_TIMESTAMP)
           ON CONFLICT (collection_name, document_id) DO NOTHING`,
          [activity.id, JSON.stringify(getDocumentPayload(activity))]
        );
      }
      return {
        proposal: nextProposal,
        dossier: nextDossier,
        activityLogs: [proposalActivity, dossierActivity],
        idempotent: false as const,
      };
    });
    return jsonOk(result);
  } catch (error: any) {
    console.error('PCN proposal update error:', error);
    const status = Number(error?.statusCode) || 500;
    return jsonError(error?.message || String(error), status);
  }
}
