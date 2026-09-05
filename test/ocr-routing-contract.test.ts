import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const root = fs.readFileSync(new URL('../server.ts', import.meta.url), 'utf8');

function routeBlock(route: string, nextRoute: string): string {
  const start = root.indexOf(route);
  assert.notEqual(start, -1, `missing route ${route}`);
  const end = root.indexOf(nextRoute, start);
  return root.slice(start, end < 0 ? undefined : end);
}

function nameplateOcrBlock(): string {
  const generate = routeBlock('app.post("/api/gemini/generate"', 'app.post("/api/upload-nas"');
  const start = generate.indexOf('if (action === "ocr")');
  assert.notEqual(start, -1, 'missing nameplate OCR branch');
  return generate.slice(start);
}

test('all structured OCR endpoints run PaddleOCR before any Gemini fallback', () => {
  const routes = [
    ['/api/gemini/extract-requests', 'app.post("/api/gemini/extract-results"'],
    ['/api/gemini/extract-results', 'app.post("/api/gemini/extract-kqtn-metadata"'],
    ['/api/gemini/extract-kqtn-metadata', 'app.post("/api/gemini/extract-kqtn-bulk-structure"'],
    ['/api/gemini/extract-kqtn-bulk-structure', 'app.post("/api/gemini/chat"'],
    ['/api/gemini/generate', 'app.post("/api/upload-nas"'],
  ] as const;

  for (const [route, nextRoute] of routes) {
    const block = routeBlock(`app.post("${route}"`, nextRoute);
    assert.match(block, /collectPaddleOcr/);
    assert.match(block, /getPersonalGeminiClient/);
  }
});

test('OCR fallback never resolves the system Gemini key or trusts a client model header', () => {
  const ocrBlocks = [
    routeBlock('app.post("/api/gemini/extract-requests"', 'app.post("/api/gemini/extract-results"'),
    routeBlock('app.post("/api/gemini/extract-results"', 'app.post("/api/gemini/extract-kqtn-metadata"'),
    routeBlock('app.post("/api/gemini/extract-kqtn-metadata"', 'app.post("/api/gemini/extract-kqtn-bulk-structure"'),
    routeBlock('app.post("/api/gemini/extract-kqtn-bulk-structure"', 'app.post("/api/gemini/chat"'),
    nameplateOcrBlock(),
  ];

  for (const block of ocrBlocks) {
    assert.match(block, /getPersonalGeminiClient/);
    assert.doesNotMatch(block, /req\.headers\[?["']x-gemini-model/);
  }
});

test('browser OCR helpers do not send a plaintext Gemini API key', () => {
  const gemini = fs.readFileSync(new URL('../utils/gemini.ts', import.meta.url), 'utf8');
  const aiChat = fs.readFileSync(new URL('../components/AIChatBot.tsx', import.meta.url), 'utf8');
  const nameplate = fs.readFileSync(new URL('../components/EmcBepDien1VungNauForm.tsx', import.meta.url), 'utf8');
  const report = fs.readFileSync(new URL('../components/ReportGeneratorView.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(gemini, /X-Gemini-API-Key/);
  assert.doesNotMatch(nameplate, /X-Gemini-API-Key/);
  assert.doesNotMatch(report, /X-Gemini-API-Key/);
  assert.match(aiChat, /resolveGeminiModel/);
});

// --- End of ocr-routing-contract.test.ts ---
