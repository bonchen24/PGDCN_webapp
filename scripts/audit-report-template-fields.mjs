// Author: Gemini
// OS support: Web/Node
// Description: Audit DOCX evaluation placeholders against the configured clause blocks

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import AdmZip from 'adm-zip';
import { resolveLegacyTemplatePath } from './legacyTemplatePath.mjs';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const TCVN_TEMPLATE_AUDIT_CONFIG = [
  ['toaster', '5699-2-9', 'TOASTER_CLAUSES', 'TOASTER_REDUCED_CLAUSES'],
  ['iron', '5699-2-3', 'IRON_CLAUSES', 'IRON_REDUCED_CLAUSES'],
  ['rice_cooker', '5699-2-15', 'RICE_COOKER_CLAUSES', 'RICE_COOKER_REDUCED_CLAUSES'],
  ['fan', '5699-2-80', 'FAN_CLAUSES', 'FAN_REDUCED_CLAUSES'],
  ['storage_heater', '5699-2-21', 'STORAGE_HEATER_CLAUSES', 'STORAGE_HEATER_REDUCED_CLAUSES'],
  ['hair_dryer', '5699-2-23', 'SKIN_HAIR_CARE_CLAUSES', 'SKIN_HAIR_CARE_REDUCED_CLAUSES'],
  ['microwave', '5699-2-25', 'MICROWAVE_CLAUSES', 'MICROWAVE_REDUCED_CLAUSES'],
  ['instant_heater', '5699-2-35', 'INSTANT_HEATER_CLAUSES', 'INSTANT_HEATER_REDUCED_CLAUSES'],
];

const normalizeClauseId = (clauseId) => clauseId.replaceAll('.', '_');

function readClauseBlock(source, exportName) {
  const startMarker = new RegExp(`(?:export )?const ${exportName}:`);
  const startMatch = startMarker.exec(source);
  const start = startMatch?.index ?? -1;
  if (start < 0) {
    throw new Error(`Could not locate ${exportName} in lib/standards.ts`);
  }
  const end = source.indexOf('\nexport const ', start + startMatch[0].length);
  return source.slice(start, end < 0 ? source.length : end);
}

function extractConfiguredClauseIds(source, exportName) {
  return new Set(
    [...readClauseBlock(source, exportName).matchAll(/(?:\bid\s*:\s*|"id"\s*:\s*)"([^"]+)"/g)]
      .map((match) => normalizeClauseId(match[1])),
  );
}

function extractTemplateEvaluationIds(templatePath) {
  const zip = new AdmZip(templatePath);
  const documentXml = zip.readAsText('word/document.xml');
  const cells = [...documentXml.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)].map((match) => match[1]);
  const textSegments = cells.length > 0 ? cells : [documentXml];
  const evaluationIds = textSegments.flatMap((segment) => {
    const segmentText = [...segment.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
      .map((match) => match[1])
      .join('')
      .replaceAll('&amp;', '&')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>');
    return [...segmentText.matchAll(/\{eval_([^}]+)\}/g)].map((match) => match[1]);
  });
  return new Set(evaluationIds);
}

export function auditTemplateAgainstClauses({ templatePath, standardsPath, clauseExport }) {
  const source = fs.readFileSync(standardsPath, 'utf8');
  const templateEvaluations = extractTemplateEvaluationIds(templatePath);
  const configuredIds = extractConfiguredClauseIds(source, clauseExport);
  const missing = [...templateEvaluations].filter((id) => !configuredIds.has(id)).sort();
  const extra = [...configuredIds].filter((id) => !templateEvaluations.has(id)).sort();
  return {
    templateEvaluations: [...templateEvaluations].sort(),
    configuredIds: [...configuredIds].sort(),
    missing,
    extra,
  };
}

export function auditTcvnTemplates(root = workspaceRoot) {
  const standardsPath = path.join(root, 'lib', 'standards.ts');
  return TCVN_TEMPLATE_AUDIT_CONFIG.flatMap(([moduleId, standardId, fullExport, reducedExport]) => {
    const templates = [
      { criteriaType: 'full', filename: `${standardId} placeholder.docx`, clauseExport: fullExport },
      { criteriaType: 'reduced', filename: `${standardId} placeholder 4.docx`, clauseExport: reducedExport },
    ];
    return templates.map(({ criteriaType, filename, clauseExport }) => ({
      moduleId,
      standardId,
      criteriaType,
      templatePath: resolveLegacyTemplatePath(path.join(root, 'public', filename), root),
      clauseExport,
      ...auditTemplateAgainstClauses({
        templatePath: resolveLegacyTemplatePath(path.join(root, 'public', filename), root),
        standardsPath,
        clauseExport,
      }),
    }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  for (const result of auditTcvnTemplates()) {
    console.log(`${result.moduleId}/${result.criteriaType}: missing=${result.missing.join(',') || 'none'} extra=${result.extra.length}`);
  }
}

// --- End of scripts/audit-report-template-fields.mjs ---
