import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import type { ArchifyWorkflowDocument } from './pcnArchifyWorkflow.ts';
import { ARCHIFY_MAX_OUTPUT_BYTES, ARCHIFY_RENDERER_ENTRYPOINTS, ARCHIFY_TEMPLATE_ENTRYPOINT, runArchifyRenderer, resetArchifyRuntimeTestHooks, setArchifyRuntimeTestHooks, validateArchifyDocument } from './archifyRuntime.ts';
import type { ArchifyDiagramType, ArchifyDiagramResult } from './archifyDiagram.ts';

export { ARCHIFY_RENDERER_ENTRYPOINTS, ARCHIFY_TEMPLATE_ENTRYPOINT, resetArchifyRuntimeTestHooks, setArchifyRuntimeTestHooks } from './archifyRuntime.ts';
export type ArchifyRenderDomain = 'pcn' | 'pgd';
export type ArchifyRenderResult =
  | { available: false; diagramType: ArchifyDiagramType; reason: string }
  | { available: true; diagramType: ArchifyDiagramType; html: string };

export const ARCHIFY_VENDOR_ROOT = path.resolve(process.cwd(), 'vendor', 'archify', 'archify');

type ArchifyCompilerModule = {
  compileWorkflow: (input: { workflow: ArchifyWorkflowDocument; qualityProfile?: 'standard' | 'showcase' }) => { ok: boolean; svg: string; diagnostics?: unknown[]; error?: string };
};
type ArchifyUtilsModule = {
  applyTemplate: (template: string, input: { title: string; subtitle?: string; svg: string; cards?: string; locale?: string; visualPreset?: string; guidedViews?: unknown[]; sourceEvidence?: null }) => string;
  renderCards: (cards: ArchifyWorkflowDocument['cards']) => string;
};
let archifyRuntimePromise: Promise<{ compiler: ArchifyCompilerModule; utils: ArchifyUtilsModule }> | undefined;

async function loadWorkflowRuntime(): Promise<{ compiler: ArchifyCompilerModule; utils: ArchifyUtilsModule }> {
  if (!archifyRuntimePromise) {
    const compilerUrl = pathToFileURL(path.join(ARCHIFY_VENDOR_ROOT, 'renderers', 'workflow', 'workflow-compiler.mjs')).href;
    const utilsUrl = pathToFileURL(path.join(ARCHIFY_VENDOR_ROOT, 'renderers', 'shared', 'utils.mjs')).href;
    archifyRuntimePromise = Promise.all([import(compilerUrl), import(utilsUrl)]).then(([compiler, utils]) => ({ compiler: compiler as ArchifyCompilerModule, utils: utils as ArchifyUtilsModule }));
  }
  return archifyRuntimePromise;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
}

function injectFocusBridge(html: string, domain: ArchifyRenderDomain, recordId: string): string {
  const bridgePayload = scriptJson({ source: 'pcn-archify', domain, recordId });
  const bridge = `<script id="pcn-archify-focus-bridge">(function(){const context=${bridgePayload};const emit=function(detail){if(window.parent&&window.parent!==window){window.parent.postMessage(Object.assign({},context,detail),window.location.origin);}};document.addEventListener('click',function(event){const target=event.target&&event.target.closest?event.target.closest('[data-node-id],[data-edge-id]'):null;if(!target)return;const nodeId=target.getAttribute('data-node-id');const edgeId=target.getAttribute('data-edge-id');emit(Object.assign({},nodeId?{nodeId}:null,edgeId?{edgeId}:null));});document.addEventListener('keydown',function(event){if(event.key!=='Enter'&&event.key!==' ')return;const target=event.target&&event.target.closest?event.target.closest('[data-node-id],[data-edge-id]'):null;if(!target)return;const nodeId=target.getAttribute('data-node-id');const edgeId=target.getAttribute('data-edge-id');emit(Object.assign({},nodeId?{nodeId}:null,edgeId?{edgeId}:null));});})();</script>`;
  return html.includes('</body>') ? html.replace('</body>', `${bridge}</body>`) : `${html}${bridge}`;
}

function normalizeLightRoot(html: string): string {
  return html.replace(/<html\b([^>]*)>/i, (_match, attributes: string) => {
    const withoutTheme = attributes.replace(/\sdata-theme\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
    return `<html${withoutTheme} data-theme="light">`;
  });
}

function safeRenderError(message: string): Error {
  return Object.assign(new Error(message), { statusCode: 422 });
}

async function renderWorkflow(workflow: unknown, input: { domain: ArchifyRenderDomain; recordId: string }): Promise<string> {
  if (!workflow || typeof workflow !== 'object' || (workflow as any).diagram_type !== 'workflow' || (workflow as any).schema_version !== 2) throw safeRenderError('Archify workflow phải dùng schema_version 2 và diagram_type workflow.');
  try {
    const { compiler, utils } = await loadWorkflowRuntime();
    const typedWorkflow = workflow as ArchifyWorkflowDocument;
    const compiled = compiler.compileWorkflow({ workflow: typedWorkflow, qualityProfile: typedWorkflow.meta?.quality_profile });
    if (!compiled.ok || !compiled.svg) throw safeRenderError('Archify không thể biên dịch lưu trình hồ sơ.');
    const template = fs.readFileSync(path.join(ARCHIFY_VENDOR_ROOT, ARCHIFY_TEMPLATE_ENTRYPOINT), 'utf8');
    const html = utils.applyTemplate(template, { title: typedWorkflow.meta.title, subtitle: typedWorkflow.meta.subtitle, svg: compiled.svg, cards: utils.renderCards(typedWorkflow.cards), locale: typedWorkflow.meta.locale, visualPreset: typedWorkflow.meta.visual_preset, guidedViews: typedWorkflow.meta.views, sourceEvidence: null });
    return validateRenderedHtml(injectFocusBridge(normalizeLightRoot(html), input.domain, input.recordId));
  } catch {
    throw safeRenderError('Archify không thể biên dịch lưu trình hồ sơ.');
  }
}

function validateRenderedHtml(html: string): string {
  if (Buffer.byteLength(html) > ARCHIFY_MAX_OUTPUT_BYTES || !/^\s*<!doctype html>/i.test(html) || !/<html\b[^>]*>/i.test(html) || !/<\/html>\s*$/i.test(html) || !/<body\b[^>]*>/i.test(html) || !/<\/body>/i.test(html) || !/<svg\b[^>]*>/i.test(html) || !/archify-guided-views-data/.test(html)) throw safeRenderError('Archify trả về HTML không hợp lệ.');
  return html;
}

function unavailableResult(diagramType: ArchifyDiagramType, document: unknown): ArchifyRenderResult | undefined {
  if (!document || typeof document !== 'object' || (document as any).available !== false) return undefined;
  if ((document as any).diagramType !== diagramType) throw safeRenderError('Dữ liệu Archify không hợp lệ.');
  return { available: false, diagramType, reason: `Biểu đồ ${diagramType} hiện chưa khả dụng.` };
}

export async function renderArchifyDiagram(diagramType: ArchifyDiagramType, document: unknown, input: { domain: ArchifyRenderDomain; recordId: string }): Promise<ArchifyRenderResult> {
  if (!['workflow', 'lifecycle', 'dataflow', 'sequence', 'architecture'].includes(diagramType)) throw safeRenderError('Loại biểu đồ Archify không hỗ trợ.');
  const unavailable = unavailableResult(diagramType, document);
  if (unavailable) return unavailable;
  if (diagramType === 'workflow') return { available: true, diagramType, html: await renderWorkflow(document, input) };
  validateArchifyDocument(diagramType, document);
  const rendered = await runArchifyRenderer({ vendorRoot: ARCHIFY_VENDOR_ROOT, diagramType, document });
  return { available: true, diagramType, html: validateRenderedHtml(injectFocusBridge(normalizeLightRoot(rendered), input.domain, input.recordId)) };
}

export async function renderArchifyWorkflowDocument(workflow: ArchifyWorkflowDocument, input: { domain: ArchifyRenderDomain; recordId: string }): Promise<string> {
  const result = await renderArchifyDiagram('workflow', workflow, input);
  if (result.available === false) throw safeRenderError(result.reason);
  return result.html;
}

export type { ArchifyDiagramResult };
