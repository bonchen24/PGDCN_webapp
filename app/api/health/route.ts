// Author: Gemini
// OS support: Web/Node
// Description: Health check and runtime information endpoint for Next.js App Router

import { jsonOk } from '../../../lib/server/response.ts';
import { getRedisCacheHealth } from '../../../lib/server/redis-cache.ts';

function getBuildMetadata() {
  const revision = process.env.BUILD_REVISION || '';
  const createdAt = process.env.BUILD_CREATED_AT || '';
  const isRevision = /^[a-f0-9]{7,64}$/i.test(revision);
  const isCreatedAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(createdAt)
    && Number.isFinite(Date.parse(createdAt));

  return {
    revision: isRevision ? revision : null,
    createdAt: isCreatedAt ? createdAt : null,
  };
}

export async function GET() {
  return jsonOk({
    status: 'ok',
    runtime: 'nextjs',
    timestamp: new Date().toISOString(),
    build: getBuildMetadata(),
    redis: getRedisCacheHealth(),
  });
}
