// Author: Gemini
// OS support: Web/Node
// Description: Pure helpers for extracting and naming persisted Supabase Storage assets

import { Buffer } from 'node:buffer';

export interface Base64DataUriAsset {
  jsonPath: string;
  dataUri: string;
}

export interface DecodedBase64DataUri {
  mimeType: string;
  buffer: Buffer;
}

export interface StorageObjectPathInput {
  collectionName: string;
  documentId: string;
  jsonPath: string;
  sha256: string;
  mimeType: string;
}

const DATA_URI_PATTERN = /^data:([^;,]+)(?:;[^,]*)?;base64,(.*)$/s;

function getChildPath(parentPath: string, key: string): string {
  return /^[A-Za-z_$][\w$]*$/.test(key)
    ? `${parentPath}.${key}`
    : `${parentPath}[${JSON.stringify(key)}]`;
}

export function extractBase64DataUris(value: unknown, jsonPath = '$'): Base64DataUriAsset[] {
  if (typeof value === 'string') {
    const match = DATA_URI_PATTERN.exec(value);
    if (!match || !match[2].trim()) return [];
    return [{ jsonPath, dataUri: value }];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item, index) => extractBase64DataUris(item, `${jsonPath}[${index}]`));
  }

  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, child]) => extractBase64DataUris(child, getChildPath(jsonPath, key)));
  }

  return [];
}

export function decodeBase64DataUri(dataUri: string): DecodedBase64DataUri {
  const match = DATA_URI_PATTERN.exec(dataUri);
  if (!match) throw new Error('Expected a Base64 data URI');

  const encodedPayload = match[2].replace(/\s/g, '');
  if (!encodedPayload) throw new Error('Base64 data URI payload is empty');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(encodedPayload)) {
    throw new Error('Base64 data URI payload is malformed');
  }

  const buffer = Buffer.from(encodedPayload, 'base64');
  if (buffer.length === 0) throw new Error('Base64 data URI decoded bytes are empty');
  return { mimeType: match[1].toLowerCase(), buffer };
}

function safeSegment(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[_\-.]+/, '').slice(0, 180);
  return sanitized || 'asset';
}

function extensionForMimeType(mimeType: string): string {
  const extensions: Record<string, string> = {
    'image/gif': 'gif',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  return extensions[mimeType.toLowerCase()] || 'bin';
}

export function buildStorageObjectPath(input: StorageObjectPathInput): string {
  const collectionSegment = safeSegment(input.collectionName);
  const documentSegment = safeSegment(input.documentId);
  const fieldSegment = safeSegment(input.jsonPath.replace(/^[^A-Za-z0-9]+/, '').replace(/[^A-Za-z0-9]+/g, '_'));
  const checksum = input.sha256.toLowerCase();
  return `${collectionSegment}/${documentSegment}/${fieldSegment}-${checksum}.${extensionForMimeType(input.mimeType)}`;
}

// --- End of supabaseStorageMigration.ts ---
