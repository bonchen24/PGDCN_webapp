// Author: Gemini
// OS support: Web/Node
// Description: Audit special-module DOCX placeholders against report payload keys

import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { resolveLegacyTemplatePath } from './legacyTemplatePath.mjs';

const serverSource = fs.readFileSync(fileURLToPath(new URL('../server.legacy.ts', import.meta.url)), 'utf8');
const serverKeys = new Set([
  ...['anh_1', 'anh_2', 'anh_3', 'anh_4', 'anh_5', 'anh_6'],
  ...[...serverSource.matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((match) => match[1]),
  ...[...serverSource.matchAll(/data\[['"`]([A-Za-z_][A-Za-z0-9_]*)['"`]\]/g)].map((match) => match[1]),
  ...[...serverSource.matchAll(/data\[`([A-Za-z_][A-Za-z0-9_]*)`\]/g)].map((match) => match[1]),
  ...[...serverSource.matchAll(/data\.([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => match[1]),
]);

function extractTemplateTokens(template) {
  const zip = new AdmZip(resolveLegacyTemplatePath(template));
  const xmls = zip.getEntries()
    .filter((entry) => /^word\/(document|header|footer)[^/]*\.xml$/.test(entry.entryName))
    .map((entry) => entry.getData().toString('utf8'));
  const segments = xmls.flatMap((xml) => {
    const cells = [...xml.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((match) => match[1]);
    return cells.length > 0 ? cells : [xml];
  });
  return new Set(segments.flatMap((segment) => {
    const text = [...segment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]).join('');
    return [...text.matchAll(/\{([^{}]+)\}/g)].map((match) => match[1].trim());
  }));
}

export function auditSpecialTemplate(template) {
  const tokens = extractTemplateTokens(template);
  const payloadTokens = [...tokens]
    .filter((token) => token.startsWith('#') || token.startsWith('/') || token.startsWith('%') || /^[A-Za-z_][A-Za-z0-9_]*$/.test(token))
    .filter((token) => !token.includes('table') || token.startsWith('#') || token.startsWith('/'));
  const missing = payloadTokens
    .map((token) => token.replace(/^[#/%]/, ''))
    .filter((key) => !['table', 'image'].includes(key) && !serverKeys.has(key) && !key.startsWith('muc_') && !key.startsWith('kq_') && !['donvi_4_3', 'productImage1', 'productImage2'].includes(key))
    .sort();
  return { template, tokens: [...tokens].sort(), missing };
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  for (const template of process.argv.slice(2)) {
    const result = auditSpecialTemplate(template);
    console.log(`${template}: missing=${result.missing.length ? result.missing.join(',') : 'none'}`);
  }
}

// --- End of audit-special-template-fields.mjs ---
