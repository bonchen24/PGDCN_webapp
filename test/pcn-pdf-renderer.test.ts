import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { buildPcnPdfRendererArgs, getPcnPdfRendererReadiness, resolvePcnPdfRenderer } from '../utils/pcnPdfRenderer.ts';

test('official PDF renderer is explicit and does not accept shell command arguments', () => {
  assert.deepEqual(resolvePcnPdfRenderer({}), { ready: false, reason: 'MISSING_RENDERER' });
  assert.equal(resolvePcnPdfRenderer({ PCN_DOCX_PDF_RENDERER: 'soffice' }).executable, 'soffice');
  assert.equal(resolvePcnPdfRenderer({ PCN_DOCX_PDF_RENDERER: 'C:\\Program Files\\LibreOffice\\program\\soffice.exe' }).ready, true);
  assert.equal(resolvePcnPdfRenderer({ PCN_DOCX_PDF_RENDERER: 'soffice --headless' }).reason, 'INVALID_RENDERER');
  assert.equal(getPcnPdfRendererReadiness({}).ready, false);
});

test('official PDF renderer isolates each LibreOffice run with a temporary profile', () => {
  const args = buildPcnPdfRendererArgs('C:\\temp\\source.docx', 'C:\\temp\\output', 'C:\\temp\\profile');
  assert.match(args[0], /^-env:UserInstallation=file:\/\//);
  assert.ok(args.includes('--headless'));
  assert.ok(args.includes('--norestore'));
  assert.ok(args.includes('--nofirststartwizard'));
  assert.deepEqual(args.slice(-3), ['--outdir', 'C:\\temp\\output', 'C:\\temp\\source.docx']);
});

test('official PDF route delegates to the renderer and never falls back to a hand-drawn PDF', () => {
  const server = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const renderer = fs.readFileSync(new URL('../utils/pcnPdfRenderer.ts', import.meta.url), 'utf8');
  assert.match(server, /renderPcnDocxToPdf/);
  assert.match(renderer, /--headless/);
  assert.match(renderer, /--convert-to/);
  assert.match(renderer, /%PDF-/);
  assert.doesNotMatch(server.slice(server.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"), server.indexOf("app.post('/api/pcn/templates/:templateId/review'")), /PDF phát hành chính thức chưa sẵn sàng/);
});

test('official PDF capability failures use a retryable 503 response', () => {
  const serverSource = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');
  const route = serverSource.slice(serverSource.indexOf("app.post('/api/pcn/issuance/:issuanceId/official-documents/generate'"), serverSource.indexOf("app.post('/api/pcn/templates/:templateId/review'"));
  assert.match(route, /normalizedMessage\.includes\(['"]chưa sẵn sàng['"]\)/);
  assert.match(route, /res\.status\(status\)\.json/);
  assert.match(fs.readFileSync(new URL('../design.md', import.meta.url), 'utf8'), /trả lỗi capability\/tạm thời phù hợp \(`503`\)/);
});

// --- End of pcn-pdf-renderer.test.ts ---
