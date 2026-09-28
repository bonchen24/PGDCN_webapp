import { PcnQualityDocument } from '@/types';
import { buildPcnQualityDocument } from '@/utils/pcnQualityDocuments';

export const PCN_FILE_ASSET_ID_PATTERN = /^file-asset-[a-f0-9-]+$/;

export function getPcnQualityDocumentMetadata(document: PcnQualityDocument): string {
  const { id, createdAt, updatedAt, fileAssetId, fileName, ...metadata } = document;
  return JSON.stringify(metadata);
}

export function samePcnQualityDocumentMetadata(left: PcnQualityDocument, right: PcnQualityDocument): boolean {
  return getPcnQualityDocumentMetadata(left) === getPcnQualityDocumentMetadata(right);
}

export { buildPcnQualityDocument };
