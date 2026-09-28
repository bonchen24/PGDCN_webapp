// Author: Gemini
// OS support: Web/Node
// Description: PCN AI Assistant endpoint for operational queries

import { NextRequest, NextResponse } from 'next/server';
import { requirePcnSession } from '@/lib/server/auth';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { pool } from '@/lib/server/postgres';
import { mapDocumentRow } from '@/lib/server/collections';
import { jsonBadRequest, jsonError, jsonNotFound, jsonOk } from '@/lib/server/response';
import {
  CertificationDossier,
  CertificationProposal,
  OutboundLabRequest,
  PcnDocumentRequirement,
  PcnDossierDocument,
  PcnSampleLot,
  PcnSampleRoute,
  ReturnedTestResult,
} from '@/types';
import { filterPcnFutureWorkSnapshot } from '@/utils/pcnActiveData';
import { buildPcnAssistantSnapshot } from '@/utils/pcnAssistant';
import {
  generateContentWithRetryAndFallback,
  getGeminiClient,
  getPcnStoredGeminiModel,
} from '@/lib/server/gemini';

export async function POST(req: NextRequest) {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('Trợ lý PCN chỉ khả dụng trong profile PCN.');
  }
  const sessionError = requirePcnSession(req);
  if (sessionError) return sessionError;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return jsonBadRequest('Yêu cầu không hợp lệ.');
  }

  const message = String(body?.message || '').trim().slice(0, 2000);
  if (!message) {
    return jsonBadRequest('Hãy nhập câu hỏi cho trợ lý PCN.');
  }

  try {
    const [
      dossiersResult,
      proposalsResult,
      requestsResult,
      resultsResult,
      lotsResult,
      routesResult,
      requirementsResult,
      documentsResult,
    ] = await Promise.all([
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationDossiers' ORDER BY updated_at DESC LIMIT 200`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'certificationProposals' ORDER BY updated_at DESC LIMIT 200`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'labRequests' ORDER BY updated_at DESC LIMIT 500`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'returnedResults' ORDER BY updated_at DESC LIMIT 500`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleLots' ORDER BY updated_at DESC LIMIT 500`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnSampleRoutes' ORDER BY updated_at DESC LIMIT 1000`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'pcnDocumentRequirements' AND COALESCE((data->>'active')::boolean, false) = true LIMIT 500`),
      pool.query(`SELECT document_id, data FROM app_documents WHERE collection_name = 'dossierDocuments' ORDER BY updated_at DESC LIMIT 2000`),
    ]);

    const dossiers = dossiersResult.rows.map(mapDocumentRow) as CertificationDossier[];
    const proposals = proposalsResult.rows.map(mapDocumentRow) as CertificationProposal[];
    const activeSnapshot = filterPcnFutureWorkSnapshot({ proposals, dossiers, customers: [] });
    const activeDossierIds = new Set(activeSnapshot.dossiers.map((d) => d.id));

    const sampleLotRecords = lotsResult.rows.map(mapDocumentRow) as PcnSampleLot[];
    const sampleLots = sampleLotRecords.filter((lot) => activeDossierIds.has(String(lot.dossierId || '')));
    const activeLotIds = new Set(sampleLots.map((lot) => lot.id));

    const sampleRouteRecords = routesResult.rows.map(mapDocumentRow) as PcnSampleRoute[];
    const sampleRoutes = sampleRouteRecords.filter((route) => activeLotIds.has(String(route.sampleLotId || '')));

    const labRequestRecords = requestsResult.rows.map(mapDocumentRow) as OutboundLabRequest[];
    const labRequests = labRequestRecords.filter((request) => activeDossierIds.has(String(request.dossierId || '')));
    const activeRequestIds = new Set(labRequests.map((request) => request.id));

    const returnedResultRecords = resultsResult.rows.map(mapDocumentRow) as ReturnedTestResult[];
    const returnedResults = returnedResultRecords.filter(
      (result) => activeDossierIds.has(String(result.dossierId || '')) || activeRequestIds.has(String(result.labRequestId || '')),
    );

    const requirements = requirementsResult.rows.map(mapDocumentRow) as PcnDocumentRequirement[];
    const documentRecords = documentsResult.rows.map(mapDocumentRow) as PcnDossierDocument[];
    const documents = documentRecords.filter((document) => activeDossierIds.has(String(document.dossierId || '')));

    const context = JSON.stringify(
      buildPcnAssistantSnapshot({
        dossiers: activeSnapshot.dossiers,
        proposals: activeSnapshot.proposals,
        requirements,
        documents,
        labRequests,
        sampleLots,
        sampleRoutes,
        returnedResults,
      }),
    );

    const ai = await getGeminiClient(req, { timeout: 30000 });
    const response = await generateContentWithRetryAndFallback(
      ai,
      {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `Bạn là trợ lý AI vận hành của Phòng Chứng nhận PCN thuộc TVCI. Chỉ sử dụng snapshot PCN dưới đây. Không dùng thuật ngữ lịch thử, không nói thay Phòng Giám định, không bịa dữ liệu và không tự đề nghị mutation. Trả lời tiếng Việt ngắn gọn, nêu rõ mã hồ sơ/PYC nếu có, bước 1-5 liên quan và hành động người dùng cần mở trong card. Nếu snapshot không đủ, nói rõ cần kiểm tra trực tiếp trong hồ sơ.\n\nSnapshot PCN:\n${context}\n\nCâu hỏi người dùng:\n${message}`,
              },
            ],
          },
        ],
        config: { temperature: 0.2 },
      },
      (req.headers.get('x-gemini-model') as string) || (await getPcnStoredGeminiModel(req)),
      { attemptsPerModel: 1 },
    );

    return jsonOk({ response: String(response.text || '').trim() || 'Trợ lý chưa có câu trả lời.' });
  } catch (error: any) {
    console.error('PCN assistant error:', error);
    return jsonError(error?.message || 'Trợ lý AI PCN hiện chưa sẵn sàng.', 503);
  }
}
