import { createServer } from 'node:http';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const port = Number(process.env.GUIDE_SCREENSHOT_PORT || 45678);
const outputDir = path.resolve('docs', 'user-guide-assets');

const server = createServer(async (request, response) => {
  if (request.method !== 'POST') {
    response.writeHead(405, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('POST only');
    return;
  }
  const filename = String(request.headers['x-filename'] || '').replace(/[^a-zA-Z0-9._-]/g, '_');
  if (!filename || !filename.toLowerCase().endsWith('.png')) {
    response.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('Invalid filename');
    return;
  }
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, filename);
  await writeFile(outputPath, Buffer.concat(chunks));
  response.writeHead(201, { 'content-type': 'text/plain; charset=utf-8' });
  response.end(outputPath);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Guide screenshot receiver listening on http://127.0.0.1:${port}`);
});
