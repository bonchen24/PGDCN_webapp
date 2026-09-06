import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ArchifyWorkflowDocument } from './pcnArchifyWorkflow.ts';

export type ArchifyRenderDomain = 'pcn' | 'pgd';

export const ARCHIFY_VENDOR_ROOT = path.resolve(process.cwd(), 'vendor', 'archify', 'archify');

type ArchifyCompilerModule = {
  compileWorkflow: (input: { workflow: ArchifyWorkflowDocument; qualityProfile?: 'standard' | 'showcase' }) => {
    ok: boolean;
    svg: string;
    diagnostics?: unknown[];
    error?: string;
  };
};

type ArchifyUtilsModule = {
  applyTemplate: (template: string, input: {
    title: string;
    subtitle?: string;
    svg: string;
    cards?: string;
    locale?: string;
    visualPreset?: string;
    guidedViews?: unknown[];
    sourceEvidence?: null;
  }) => string;
  renderCards: (cards: ArchifyWorkflowDocument['cards']) => string;
};

let archifyRuntimePromise: Promise<{ compiler: ArchifyCompilerModule; utils: ArchifyUtilsModule }> | undefined;

async function loadArchifyRuntime(): Promise<{ compiler: ArchifyCompilerModule; utils: ArchifyUtilsModule }> {
  if (!archifyRuntimePromise) {
    const compilerUrl = pathToFileURL(path.join(ARCHIFY_VENDOR_ROOT, 'renderers', 'workflow', 'workflow-compiler.mjs')).href;
    const utilsUrl = pathToFileURL(path.join(ARCHIFY_VENDOR_ROOT, 'renderers', 'shared', 'utils.mjs')).href;
    archifyRuntimePromise = Promise.all([import(compilerUrl), import(utilsUrl)]).then(([compiler, utils]) => ({
      compiler: compiler as ArchifyCompilerModule,
      utils: utils as ArchifyUtilsModule,
    }));
  }
  return archifyRuntimePromise;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026');
}

function injectFocusBridge(html: string, domain: ArchifyRenderDomain, recordId: string): string {
  const bridgePayload = scriptJson({ source: 'pcn-archify', domain, recordId });
  const bridge = `<script id="pcn-archify-focus-bridge">(function(){const context=${bridgePayload};const emit=function(detail){if(window.parent&&window.parent!==window){window.parent.postMessage(Object.assign({},context,detail),window.location.origin);}};document.addEventListener('click',function(event){const target=event.target&&event.target.closest?event.target.closest('[data-node-id],[data-edge-id]'):null;if(!target)return;const nodeId=target.getAttribute('data-node-id');const edgeId=target.getAttribute('data-edge-id');emit(Object.assign({},nodeId?{nodeId}:null,edgeId?{edgeId}:null));});document.addEventListener('keydown',function(event){if(event.key!=='Enter'&&event.key!==' ')return;const target=event.target&&event.target.closest?event.target.closest('[data-node-id],[data-edge-id]'):null;if(!target)return;const nodeId=target.getAttribute('data-node-id');const edgeId=target.getAttribute('data-edge-id');emit(Object.assign({},nodeId?{nodeId}:null,edgeId?{edgeId}:null));});})();</script>`;
  return html.includes('</body>') ? html.replace('</body>', `${bridge}</body>`) : `${html}${bridge}`;
}

export async function renderArchifyWorkflowDocument(
  workflow: ArchifyWorkflowDocument,
  input: { domain: ArchifyRenderDomain; recordId: string },
): Promise<string> {
  if (!workflow || workflow.diagram_type !== 'workflow' || workflow.schema_version !== 2) {
    throw Object.assign(new Error('Archify workflow phải dùng schema_version 2 và diagram_type workflow.'), { statusCode: 422 });
  }
  const { compiler, utils } = await loadArchifyRuntime();
  const compiled = compiler.compileWorkflow({ workflow, qualityProfile: workflow.meta.quality_profile });
  if (!compiled.ok || !compiled.svg) {
    const error = new Error(compiled.error || 'Archify không thể biên dịch lưu trình hồ sơ.');
    Object.assign(error, { statusCode: 422, diagnostics: compiled.diagnostics || [] });
    throw error;
  }
  const templatePath = path.join(ARCHIFY_VENDOR_ROOT, 'assets', 'template.html');
  const template = fs.readFileSync(templatePath, 'utf8');
  const html = utils.applyTemplate(template, {
    title: workflow.meta.title,
    subtitle: workflow.meta.subtitle,
    svg: compiled.svg,
    cards: utils.renderCards(workflow.cards),
    locale: workflow.meta.locale,
    visualPreset: workflow.meta.visual_preset,
    guidedViews: workflow.meta.views,
    sourceEvidence: null,
  });
  return injectFocusBridge(html, input.domain, input.recordId);
}
