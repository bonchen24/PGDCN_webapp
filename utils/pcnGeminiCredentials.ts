import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const ENCRYPTION_VERSION = 'v1';
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const MAX_API_KEY_LENGTH = 256;

function deriveEncryptionKey(secret: string): Buffer {
  const normalizedSecret = String(secret || '').trim();
  if (!normalizedSecret) throw new Error('PCN secret dùng để mã hóa Gemini API Key chưa được cấu hình.');
  return createHash('sha256').update(`pcn-gemini-api-key:${normalizedSecret}`, 'utf8').digest();
}

export function normalizePcnGeminiApiKey(value: unknown): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (normalized.length > MAX_API_KEY_LENGTH || /[\r\n\0]/.test(normalized)) {
    throw new Error('Gemini API Key không hợp lệ.');
  }
  return normalized;
}

export function encryptPcnGeminiApiKey(value: string, secret: string): string {
  const apiKey = normalizePcnGeminiApiKey(value);
  if (!apiKey) throw new Error('Gemini API Key không được để trống.');
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, deriveEncryptionKey(secret), iv);
  const ciphertext = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [
    ENCRYPTION_VERSION,
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join('.');
}

export function decryptPcnGeminiApiKey(value: unknown, secret: string): string | undefined {
  const serialized = String(value || '').trim();
  const [version, ivEncoded, authTagEncoded, ciphertextEncoded] = serialized.split('.');
  if (version !== ENCRYPTION_VERSION || !ivEncoded || !authTagEncoded || !ciphertextEncoded) return undefined;
  try {
    const decipher = createDecipheriv(
      ENCRYPTION_ALGORITHM,
      deriveEncryptionKey(secret),
      Buffer.from(ivEncoded, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(authTagEncoded, 'base64url'));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(ciphertextEncoded, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    const apiKey = normalizePcnGeminiApiKey(plaintext);
    return apiKey || undefined;
  } catch {
    return undefined;
  }
}

export function maskPcnGeminiApiKey(value: unknown): string {
  const apiKey = String(value ?? '').trim();
  if (!apiKey) return '';
  if (apiKey.length <= 8) return `••••${apiKey.slice(-2)}`;
  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

// --- End of pcnGeminiCredentials.ts ---
