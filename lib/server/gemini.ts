// Author: Gemini
// OS support: Web/Node
// Description: Centralized Gemini client resolution, models, and fallback logic

import { NextRequest } from 'next/server';
import { GoogleGenAI, Type } from '@google/genai';
import {
  GEMINI_API_KEY_MISSING_MESSAGE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_CODE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE,
  isGeminiUpstreamUnavailable,
  resolveGeminiApiKey,
} from '@/utils/geminiCredentials';
import { DATABASE_PROFILE } from './env';
import { getPcnSessionUser, getSessionSecret } from './auth';
import { pool } from './postgres';
import { decryptPcnGeminiApiKey, normalizePcnGeminiApiKey } from '@/utils/pcnGeminiCredentials';

export function getPcnGeminiApiKeyFromPreferences(data: Record<string, any> | undefined): string | undefined {
  const encrypted = String(data?.geminiApiKeyEncrypted || '').trim();
  const decrypted = encrypted ? decryptPcnGeminiApiKey(encrypted, getSessionSecret()) : undefined;
  if (decrypted) return decrypted;
  try {
    const legacyKey = normalizePcnGeminiApiKey(data?.geminiApiKey);
    return legacyKey || undefined;
  } catch {
    return undefined;
  }
}

export {
  GoogleGenAI,
  Type,
  GEMINI_API_KEY_MISSING_MESSAGE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_CODE,
  GEMINI_API_UPSTREAM_UNAVAILABLE_MESSAGE,
  isGeminiUpstreamUnavailable,
  resolveGeminiApiKey,
};

export const CANDIDATE_MODELS = ['gemini-flash-latest', 'gemini-3.6-flash', 'gemini-3.1-flash-lite'];

export interface GeminiGenerationOptions {
  modelNames?: string[];
  attemptsPerModel?: number;
}

export async function getPcnPreferenceRecord(username: string): Promise<any | null> {
  const normalized = String(username || '').trim().toLowerCase().replace(/^@/, '').split('@')[0];
  if (!normalized) return null;
  const result = await pool.query(
    `SELECT data FROM app_documents WHERE collection_name = 'userPreferences' AND lower(document_id) = lower($1) LIMIT 1`,
    [normalized],
  );
  return result.rows[0] || null;
}

export async function getPcnStoredGeminiApiKey(req: NextRequest | Request): Promise<string | undefined> {
  if (DATABASE_PROFILE !== 'pcn') return undefined;
  const actor = getPcnSessionUser(req);
  if (!actor) return undefined;
  const preference = await getPcnPreferenceRecord(actor.username);
  return getPcnGeminiApiKeyFromPreferences(preference?.data);
}

export async function getPcnStoredGeminiModel(req: NextRequest | Request): Promise<string | undefined> {
  if (DATABASE_PROFILE !== 'pcn') return undefined;
  const actor = getPcnSessionUser(req);
  if (!actor) return undefined;
  const preference = await getPcnPreferenceRecord(actor.username);
  const model = String(preference?.data?.geminiModel || '').trim();
  return model || undefined;
}

export async function getGeminiClient(
  req: NextRequest | Request,
  options: { timeout?: number; personalOnly?: boolean } = {},
): Promise<GoogleGenAI> {
  const defaultApiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  const personalCredentialRequired = options.personalOnly === true || DATABASE_PROFILE === 'pcn';
  const requestApiKey = personalCredentialRequired ? undefined : req.headers.get('x-gemini-api-key');
  const personalApiKey = await getPcnStoredGeminiApiKey(req);
  const resolvedApiKey = personalCredentialRequired
    ? personalApiKey
    : resolveGeminiApiKey(
        defaultApiKey,
        typeof requestApiKey === 'string' && requestApiKey.trim() ? requestApiKey : personalApiKey,
      );

  if (!resolvedApiKey) {
    throw new Error(GEMINI_API_KEY_MISSING_MESSAGE);
  }

  return new GoogleGenAI({
    apiKey: resolvedApiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      ...(options.timeout !== undefined ? { timeout: options.timeout } : {}),
    },
  });
}

export async function getPersonalGeminiClient(
  req: NextRequest | Request,
  timeout = 90_000,
): Promise<GoogleGenAI> {
  return getGeminiClient(req, { timeout, personalOnly: true });
}

export async function getPersonalGeminiModel(req: NextRequest | Request): Promise<string | undefined> {
  return getPcnStoredGeminiModel(req);
}

export async function generateContentWithRetryAndFallback(
  activeAi: GoogleGenAI,
  params: { contents: any; config?: any },
  preferredModel?: string,
  options: GeminiGenerationOptions = {},
) {
  let lastError: any = null;
  const modelsToTry = options.modelNames || (preferredModel ? [preferredModel, ...CANDIDATE_MODELS.filter((m) => m !== preferredModel)] : CANDIDATE_MODELS);
  const attemptsPerModel = Math.max(1, Math.floor(options.attemptsPerModel || 2));

  for (const modelName of modelsToTry) {
    let retries = attemptsPerModel;
    while (retries > 0) {
      try {
        console.log(`Calling Gemini API with model: ${modelName} (retries left: ${retries - 1})...`);
        const response = await activeAi.models.generateContent({
          ...params,
          model: modelName,
        });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        console.warn(`Gemini model ${modelName} error:`, errMsg);

        const isQuotaOrNotFound =
          errMsg.includes('limit: 0') ||
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('free_tier') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('429') ||
          errMsg.includes('404') ||
          errMsg.includes('NOT_FOUND') ||
          errMsg.includes('not found');

        if (isQuotaOrNotFound) {
          console.warn(`Model ${modelName} encountered quota or model availability issue, switching to next model...`);
          break;
        }

        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('demand') ||
          errMsg.includes('overloaded');

        if (isTransient) {
          retries--;
          if (retries > 0) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
        }
        break;
      }
    }
  }

  throw lastError;
}

export async function createChatWithRetryAndFallback(
  activeAi: GoogleGenAI,
  params: { config?: any; history?: any },
  message: string,
  preferredModel?: string,
) {
  let lastError: any = null;
  const modelsToTry = preferredModel ? [preferredModel, ...CANDIDATE_MODELS.filter((m) => m !== preferredModel)] : CANDIDATE_MODELS;

  for (const modelName of modelsToTry) {
    let retries = 2;
    while (retries > 0) {
      try {
        console.log(`Creating Gemini Chat with model: ${modelName}...`);
        const chat = activeAi.chats.create({
          ...params,
          model: modelName,
        });
        const response = await chat.sendMessage({ message });
        return response;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        console.warn(`Gemini Chat model ${modelName} error:`, errMsg);

        const isQuotaOrNotFound =
          errMsg.includes('limit: 0') ||
          errMsg.includes('Quota exceeded') ||
          errMsg.includes('free_tier') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('429') ||
          errMsg.includes('404') ||
          errMsg.includes('NOT_FOUND') ||
          errMsg.includes('not found');

        if (isQuotaOrNotFound) {
          console.warn(`Chat model ${modelName} encountered quota or availability issue, switching to next model...`);
          break;
        }

        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('demand') ||
          errMsg.includes('overloaded');

        if (isTransient) {
          retries--;
          if (retries > 0) {
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
        }
        break;
      }
    }
  }

  throw lastError;
}
