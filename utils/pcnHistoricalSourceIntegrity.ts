// Author: Codex
// OS support: Node
// Description: Verify historical source bytes before private-storage import

import { createHash } from 'node:crypto';

export interface PcnHistoricalSourceIntegrityExpectation {
  byteSize: number;
  sha256: string;
}

export function assertPcnHistoricalSourceBytes(
  expected: PcnHistoricalSourceIntegrityExpectation,
  body: Buffer,
): void {
  if (!Buffer.isBuffer(body)) throw new Error('Tệp nguồn lịch sử không phải Buffer.');
  const expectedByteSize = Number(expected.byteSize);
  const expectedSha256 = String(expected.sha256 || '').trim().toLowerCase();
  const actualSha256 = createHash('sha256').update(body).digest('hex');
  if (!Number.isInteger(expectedByteSize) || expectedByteSize < 0 || body.byteLength !== expectedByteSize) {
    throw new Error(`Byte size tệp lịch sử không khớp: kế hoạch ${expectedByteSize}, thực tế ${body.byteLength}.`);
  }
  if (!/^[a-f0-9]{64}$/.test(expectedSha256) || actualSha256 !== expectedSha256) {
    throw new Error(`SHA-256 tệp lịch sử không khớp: kế hoạch ${expectedSha256 || '(trống)'}, thực tế ${actualSha256}.`);
  }
}

// --- End of pcnHistoricalSourceIntegrity.ts ---
