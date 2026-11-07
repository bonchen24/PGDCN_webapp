// Author: Gemini
// OS support: Web/Node
// Description: Health check and runtime information endpoint for Next.js App Router

import { jsonOk } from '../../../lib/server/response.ts';
import { getRedisCacheHealth } from '../../../lib/server/redis-cache.ts';

export async function GET() {
  return jsonOk({
    status: 'ok',
    runtime: 'nextjs',
    timestamp: new Date().toISOString(),
    redis: getRedisCacheHealth(),
  });
}
