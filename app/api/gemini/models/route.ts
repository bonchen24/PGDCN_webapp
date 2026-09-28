// Author: Gemini
// OS support: Web/Node
// Description: List available Gemini models endpoint

import { NextRequest, NextResponse } from 'next/server';
import { requirePcnSession } from '@/lib/server/auth';
import { DATABASE_PROFILE } from '@/lib/server/env';
import { jsonError, jsonOk } from '@/lib/server/response';
import {
  GEMINI_API_KEY_MISSING_MESSAGE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_CODE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE,
  getGeminiClient,
  isGeminiUpstreamUnavailable,
} from '@/lib/server/gemini';

export async function GET(req: NextRequest) {
  try {
    if (DATABASE_PROFILE === 'pcn') {
      const sessionError = requirePcnSession(req);
      if (sessionError) return sessionError;
    }

    const selectedModel = String(req.nextUrl.searchParams.get('model') || '').trim().replace(/^models\//, '');
    const activeAi = await getGeminiClient(req, { personalOnly: DATABASE_PROFILE === 'pcn' });
    const response = await activeAi.models.list();
    const rawModels: any[] = [];

    if (response && typeof (response as any)[Symbol.asyncIterator] === 'function') {
      for await (const model of response as any) {
        rawModels.push(model);
      }
    } else if (Array.isArray((response as any)?.models)) {
      rawModels.push(...(response as any).models);
    } else if (Array.isArray(response)) {
      rawModels.push(...response);
    }

    const models = rawModels
      .filter((m: any) => {
        const name = (m.name || m.id || '').toLowerCase();
        const methods = m.supportedGenerationMethods || m.supportedActions || [];
        const isGemini = name.includes('gemini');
        const canGenerate = methods.length === 0 || methods.includes('generateContent');
        return isGemini && canGenerate;
      })
      .map((m: any) => {
        const id = (m.name || m.id || '').replace(/^models\//, '');
        return {
          id,
          name: m.name || id,
          displayName: m.displayName || id,
          description: m.description || '',
          inputTokenLimit: m.inputTokenLimit,
          outputTokenLimit: m.outputTokenLimit,
          supportedGenerationMethods: m.supportedGenerationMethods || [],
        };
      });

    return jsonOk({
      provider: 'GOOGLE_GEMINI',
      credentialScope: DATABASE_PROFILE === 'pcn' ? 'PERSONAL_PROJECT' : 'SERVER_OR_ENVIRONMENT',
      models,
      count: models.length,
      ...(selectedModel ? { selectedModel, selectedModelAvailable: models.some((m) => m.id === selectedModel) } : {}),
      checkedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error?.message === GEMINI_API_KEY_MISSING_MESSAGE) {
      return NextResponse.json(
        {
          code: 'GEMINI_API_KEY_MISSING',
          error: GEMINI_API_KEY_MISSING_MESSAGE,
        },
        { status: 503 },
      );
    }
    if (isGeminiUpstreamUnavailable(error)) {
      return NextResponse.json(
        {
          code: GEMINI_API_UPSTREAM_UNAVAILABLE_CODE,
          error: GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE,
        },
        { status: 503 },
      );
    }
    console.error('Lỗi lấy danh sách mô hình Gemini:', error);
    return jsonError(error?.message || 'Lỗi lấy danh sách mô hình từ Google', 500);
  }
}
