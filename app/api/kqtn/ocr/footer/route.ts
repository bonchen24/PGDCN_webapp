// Author: Gemini
// OS support: Web/Node
// Description: KQTN Footer OCR proxy route

import { NextRequest } from 'next/server';
import { proxyKqtnOcr } from '@/lib/server/ocr';

export async function POST(req: NextRequest) {
  return proxyKqtnOcr(req, 'footer');
}
