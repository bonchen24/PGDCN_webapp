import { spawn as nodeSpawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ARCHIFY_RENDERER_ENTRYPOINTS = {
  architecture: 'renderers/architecture/render-architecture.mjs',
  dataflow: 'renderers/dataflow/render-dataflow.mjs',
  sequence: 'renderers/sequence/render-sequence.mjs',
  lifecycle: 'renderers/lifecycle/render-lifecycle.mjs',
} as const;

export const ARCHIFY_TEMPLATE_ENTRYPOINT = 'assets/template.html';
export const ARCHIFY_PINNED_VENDOR_ROOT = path.resolve(process.cwd(), 'vendor', 'archify', 'archify');
export const ARCHIFY_RENDER_TIMEOUT_MS = 15_000;
export const ARCHIFY_MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

type SpawnChild = { once: (event: string, handler: (...values: any[]) => void) => SpawnChild; kill: () => void };
type Spawn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv; windowsHide: boolean; stdio: ['ignore', 'ignore', 'ignore'] }) => SpawnChild;
type RuntimeHooks = {
  spawn?: Spawn;
  writeInput?: (target: string, data: string, encoding: 'utf8') => Promise<void>;
  statOutput?: (target: string) => Promise<{ size: number }>;
  readOutput?: (target: string, encoding: 'utf8') => Promise<string>;
  remove?: (target: string, options: { recursive: true; force: true }) => Promise<void>;
  timeoutMs?: number;
};

let hooks: RuntimeHooks = {};

export function setArchifyRuntimeTestHooks(next: RuntimeHooks): void {
  hooks = next;
}

export function resetArchifyRuntimeTestHooks(): void {
  hooks = {};
}

function safeError(message: string, cause?: unknown): Error {
  const error = new Error(message);
  if (cause instanceof Error && cause.name === 'AbortError') error.name = 'AbortError';
  return error;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

const COMPONENT_TYPES = new Set(['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external']);
const VARIANTS = new Set(['default', 'emphasis', 'security', 'dashed']);
const SIDES = new Set(['left', 'right', 'top', 'bottom']);
const ID_PATTERN = /^[a-zA-Z][a-zA-Z0-9_-]*$/;
const FORBIDDEN_KEY_PATTERN = /(?:password|secret|token|credential|private|bytes|pii|payload|authorization|cookie|header)/i;

function invalid(): never { throw safeError('Dữ liệu Archify không hợp lệ.'); }
function stringValue(value: unknown, max = 4096): string { if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value) || /(?:^|[\\/])(?:password|secret|token)=/i.test(value)) return invalid(); return value; }
function idValue(value: unknown): string { const result = stringValue(value, 240); return ID_PATTERN.test(result) ? result : invalid(); }
function numberValue(value: unknown, minimum?: number): number { return typeof value === 'number' && Number.isFinite(value) && (minimum === undefined || value >= minimum) ? value : invalid(); }
function enumValue(value: unknown, values: Set<string>): string { return typeof value === 'string' && values.has(value) ? value : invalid(); }
function pointValue(value: unknown): [number, number] { return Array.isArray(value) && value.length === 2 ? [numberValue(value[0]), numberValue(value[1])] : invalid(); }
function optionalField<T>(value: T | undefined, project: (item: T) => unknown): unknown { return value === undefined ? undefined : project(value); }

function objectValue(value: unknown, allowed: Set<string>): Record<string, unknown> {
  if (!isRecord(value)) return invalid();
  for (const key of Object.keys(value)) if (FORBIDDEN_KEY_PATTERN.test(key) || !allowed.has(key)) invalid();
  return value;
}

function projectMeta(value: unknown, architecture = false, sequence = false): Record<string, unknown> {
  const allowed = new Set(['title', 'locale', 'subtitle', 'animation', 'visual_preset', 'quality_profile', 'views', 'legend', 'viewBox', 'output', ...(sequence ? ['column_fit'] : []), ...(architecture ? ['engineering_profile'] : [])]);
  const source = objectValue(value, allowed);
  const result: Record<string, unknown> = { title: stringValue(source.title) };
  if (source.locale !== undefined) result.locale = enumValue(source.locale, new Set(['en', 'zh-CN']));
  if (source.subtitle !== undefined) result.subtitle = stringValue(source.subtitle);
  if (source.animation !== undefined) result.animation = enumValue(source.animation, new Set(['trace', 'none']));
  if (source.visual_preset !== undefined) result.visual_preset = enumValue(source.visual_preset, new Set(['classic', 'signal-flow', 'blueprint', 'editorial']));
  if (source.quality_profile !== undefined) result.quality_profile = enumValue(source.quality_profile, new Set(['standard', 'showcase']));
  if (source.column_fit !== undefined) result.column_fit = enumValue(source.column_fit, new Set(['fixed', 'spread']));
  if (source.viewBox !== undefined) result.viewBox = pointValue(source.viewBox);
  if (source.engineering_profile !== undefined) result.engineering_profile = enumValue(source.engineering_profile, new Set(['deployment-ownership']));
  if (source.views !== undefined) {
    if (!Array.isArray(source.views) || source.views.length > 5) invalid();
    result.views = source.views.map((item) => { const view = objectValue(item, new Set(['id', 'label', 'focus', 'note'])); if (!Array.isArray(view.focus) || view.focus.length < 1) invalid(); return { id: idValue(view.id), label: stringValue(view.label, 48), focus: view.focus.map(idValue), ...(view.note === undefined ? {} : { note: stringValue(view.note, 140) }) }; });
  }
  if (source.legend !== undefined) {
    const legend = objectValue(source.legend, new Set(['mode', 'entries']));
    const projected: Record<string, unknown> = {};
    if (legend.mode !== undefined) projected.mode = enumValue(legend.mode, new Set(['auto', 'all', 'hidden']));
    if (legend.entries !== undefined) { const entries = objectValue(legend.entries, new Set(['frontend', 'backend', 'database', 'cloud', 'security', 'messagebus', 'external', 'default', 'emphasis', 'dashed', 'return', 'start', 'active', 'waiting', 'decision', 'success', 'failure', 'neutral'])); projected.entries = Object.fromEntries(Object.entries(entries).map(([key, item]) => { const entry = objectValue(item, new Set(['label', 'visible'])); return [key, { ...(entry.label === undefined ? {} : { label: stringValue(entry.label, 80) }), ...(entry.visible === undefined ? {} : { visible: typeof entry.visible === 'boolean' ? entry.visible : invalid() }) }]; })); }
    result.legend = projected;
  }
  return result;
}

function projectCards(value: unknown): unknown[] | undefined { if (value === undefined) return undefined; if (!Array.isArray(value)) invalid(); return value.map((item) => { const card = objectValue(item, new Set(['dot', 'title', 'items'])); if (!Array.isArray(card.items)) invalid(); return { dot: enumValue(card.dot, new Set(['cyan', 'emerald', 'violet', 'amber', 'rose', 'orange', 'slate'])), title: stringValue(card.title), items: card.items.map((entry) => stringValue(entry)) }; }); }
function projectBrand(value: unknown): unknown { if (typeof value === 'string') return stringValue(value, 2048); const brand = objectValue(value, new Set(['url', 'sha256'])); if (typeof brand.url !== 'string' || !/^https?:\/\//.test(brand.url)) invalid(); if (typeof brand.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(brand.sha256)) invalid(); return { url: brand.url, sha256: brand.sha256 }; }
function projectCommonNode(value: unknown, allowed: Set<string>): Record<string, unknown> { const source = objectValue(value, allowed); return { id: idValue(source.id), type: enumValue(source.type, COMPONENT_TYPES), label: stringValue(source.label), ...(source.sublabel === undefined ? {} : { sublabel: stringValue(source.sublabel) }), ...(source.tag === undefined ? {} : { tag: stringValue(source.tag) }), ...(source.brand === undefined ? {} : { brand: projectBrand(source.brand) }) }; }
function projectRelationship(value: unknown, routes: Set<string>, options: { allowed?: Set<string>; classification?: boolean; note?: boolean; requiredLabel?: boolean } = {}): Record<string, unknown> { const allowed = options.allowed || new Set(['id', 'from', 'to', 'label', 'classification', 'variant', 'route', 'fromSide', 'toSide', 'via', 'labelAt', 'labelDx', 'labelDy', 'labelSegment', 'channelX', 'channelY', 'cornerRadius', 'note', 'width']); const edge = objectValue(value, allowed); const result: Record<string, unknown> = { ...(edge.id === undefined ? {} : { id: idValue(edge.id) }), from: idValue(edge.from), to: idValue(edge.to) }; if (options.requiredLabel || edge.label !== undefined) result.label = stringValue(edge.label); if (options.classification && edge.classification !== undefined) result.classification = stringValue(edge.classification); if (edge.variant !== undefined) result.variant = enumValue(edge.variant, VARIANTS); if (edge.route !== undefined) result.route = enumValue(edge.route, routes); if (edge.fromSide !== undefined) result.fromSide = enumValue(edge.fromSide, SIDES); if (edge.toSide !== undefined) result.toSide = enumValue(edge.toSide, SIDES); if (edge.via !== undefined) result.via = Array.isArray(edge.via) ? edge.via.map(pointValue) : invalid(); if (edge.labelAt !== undefined) result.labelAt = pointValue(edge.labelAt); for (const key of ['labelDx', 'labelDy', 'channelX', 'channelY', 'cornerRadius']) if (allowed.has(key) && edge[key] !== undefined) result[key] = numberValue(edge[key], key === 'cornerRadius' ? 0 : undefined); if (edge.labelSegment !== undefined) result.labelSegment = numberValue(edge.labelSegment, 0); if (edge.width !== undefined) result.width = numberValue(edge.width, 0.5); if (options.note && edge.note !== undefined) result.note = stringValue(edge.note); return result; }
function projectArchifyDocument(diagramType: keyof typeof ARCHIFY_RENDERER_ENTRYPOINTS, document: unknown): Record<string, unknown> {
  if (!isRecord(document) || document.schema_version !== 1 || document.diagram_type !== diagramType) invalid();
  const topLevelFields = { architecture: ['components', 'boundaries', 'connections'], dataflow: ['stages', 'nodes', 'flows'], sequence: ['participants', 'segments', 'messages', 'activations'], lifecycle: ['lanes', 'states', 'transitions'] }[diagramType];
  const source = objectValue(document, new Set(['schema_version', 'diagram_type', 'meta', 'cards', ...topLevelFields]));
  const result: Record<string, unknown> = { schema_version: 1, diagram_type: diagramType, meta: projectMeta(source.meta, diagramType === 'architecture', diagramType === 'sequence') };
  if (diagramType === 'architecture') {
    if (!Array.isArray(source.components) || source.components.length < 1) invalid();
    result.components = source.components.map((item) => { const node = projectCommonNode(item, new Set(['id', 'type', 'label', 'sublabel', 'tag', 'brand', 'sources', 'row', 'col', 'pos', 'size'])); const raw = item as Record<string, unknown>; if (raw.sources !== undefined) { if (!Array.isArray(raw.sources) || raw.sources.length < 1 || raw.sources.length > 3) invalid(); node.sources = raw.sources.map((entry) => { const itemSource = objectValue(entry, new Set(['path', 'line', 'end_line', 'label'])); const sourcePath = stringValue(itemSource.path, 240); if (/^(?:[a-zA-Z]:[\\/]|[\\/]{2}|\/)/.test(sourcePath) || sourcePath.includes('..')) invalid(); return { path: sourcePath, ...(itemSource.line === undefined ? {} : { line: numberValue(itemSource.line, 1) }), ...(itemSource.end_line === undefined ? {} : { end_line: numberValue(itemSource.end_line, 1) }), ...(itemSource.label === undefined ? {} : { label: stringValue(itemSource.label, 48) }) }; }); } if (raw.row !== undefined) node.row = numberValue(raw.row, 0); if (raw.col !== undefined) node.col = numberValue(raw.col, 0); if (raw.pos !== undefined) node.pos = pointValue(raw.pos); if (raw.size !== undefined) node.size = pointValue(raw.size); return node; });
    if (source.boundaries !== undefined) { if (!Array.isArray(source.boundaries)) invalid(); result.boundaries = source.boundaries.map((item) => { const boundary = objectValue(item, new Set(['kind', 'label', 'wraps', 'pad'])); if (!Array.isArray(boundary.wraps) || boundary.wraps.length < 1) invalid(); return { kind: enumValue(boundary.kind, new Set(['region', 'security-group'])), label: stringValue(boundary.label), wraps: boundary.wraps.map(idValue), ...(boundary.pad === undefined ? {} : { pad: numberValue(boundary.pad, 0) }) }; }); }
    if (source.connections !== undefined) { if (!Array.isArray(source.connections)) invalid(); result.connections = source.connections.map((item) => projectRelationship(item, new Set(['auto', 'straight', 'orthogonal-h', 'orthogonal-v']), { allowed: new Set(['id', 'from', 'to', 'label', 'variant', 'fromSide', 'toSide', 'route', 'via', 'labelAt', 'labelDx', 'labelDy', 'labelSegment', 'width']) })); }
  }
  if (diagramType === 'dataflow') { if (!Array.isArray(source.stages) || source.stages.length < 2 || source.stages.length > 5 || !Array.isArray(source.nodes) || source.nodes.length < 2 || !Array.isArray(source.flows)) invalid(); result.stages = source.stages.map((item) => { const stage = objectValue(item, new Set(['label'])); return { label: stringValue(stage.label) }; }); result.nodes = source.nodes.map((item) => { const node = projectCommonNode(item, new Set(['id', 'type', 'label', 'sublabel', 'tag', 'brand', 'stage', 'row', 'width', 'height', 'yOffset'])); const raw = item as Record<string, unknown>; return { ...node, stage: numberValue(raw.stage, 0), row: numberValue(raw.row, 0), ...(raw.width === undefined ? {} : { width: numberValue(raw.width, 48) }), ...(raw.height === undefined ? {} : { height: numberValue(raw.height, 36) }), ...(raw.yOffset === undefined ? {} : { yOffset: numberValue(raw.yOffset) }) }; }); result.flows = source.flows.map((item) => projectRelationship(item, new Set(['auto', 'straight', 'vertical-channel', 'bottom-channel', 'top-channel']), { allowed: new Set(['id', 'from', 'to', 'label', 'classification', 'variant', 'route', 'fromSide', 'toSide', 'via', 'labelAt', 'labelDx', 'labelDy', 'labelSegment', 'width']), classification: true, requiredLabel: true })); }
  if (diagramType === 'sequence') { if (!Array.isArray(source.participants) || source.participants.length < 2 || !Array.isArray(source.messages) || source.messages.length < 1) invalid(); result.participants = source.participants.map((item) => projectCommonNode(item, new Set(['id', 'type', 'label', 'sublabel', 'brand']))); if (source.segments !== undefined) { if (!Array.isArray(source.segments)) invalid(); result.segments = source.segments.map((item) => { const segment = objectValue(item, new Set(['from', 'to', 'label'])); return { from: numberValue(segment.from), to: numberValue(segment.to), label: stringValue(segment.label) }; }); } result.messages = source.messages.map((item) => { const message = objectValue(item, new Set(['id', 'from', 'to', 'y', 'label', 'variant', 'note'])); return { ...(message.id === undefined ? {} : { id: idValue(message.id) }), from: idValue(message.from), to: idValue(message.to), y: numberValue(message.y, 160), label: stringValue(message.label), ...(message.variant === undefined ? {} : { variant: enumValue(message.variant, new Set([...VARIANTS, 'return'])) }), ...(message.note === undefined ? {} : { note: stringValue(message.note) }) }; }); if (source.activations !== undefined) { if (!Array.isArray(source.activations)) invalid(); result.activations = source.activations.map((item) => { const activation = objectValue(item, new Set(['participant', 'from', 'to', 'type'])); return { participant: idValue(activation.participant), from: numberValue(activation.from), to: numberValue(activation.to), ...(activation.type === undefined ? {} : { type: enumValue(activation.type, COMPONENT_TYPES) }) }; }); } }
  if (diagramType === 'lifecycle') { if (!Array.isArray(source.lanes) || source.lanes.length < 1 || source.lanes.length > 4 || !Array.isArray(source.states) || source.states.length < 2 || !Array.isArray(source.transitions)) invalid(); result.lanes = source.lanes.map((item) => { const lane = objectValue(item, new Set(['id', 'label'])); return { id: idValue(lane.id), label: stringValue(lane.label) }; }); result.states = source.states.map((item) => { const state = objectValue(item, new Set(['id', 'type', 'label', 'sublabel', 'tag', 'brand', 'step', 'lane', 'col', 'width', 'height', 'yOffset'])); return { id: idValue(state.id), type: enumValue(state.type, new Set(['start', 'active', 'waiting', 'decision', 'success', 'failure', 'neutral', 'external'])), label: stringValue(state.label), lane: idValue(state.lane), col: numberValue(state.col, 0), ...(state.sublabel === undefined ? {} : { sublabel: stringValue(state.sublabel) }), ...(state.tag === undefined ? {} : { tag: stringValue(state.tag) }), ...(state.step === undefined ? {} : { step: stringValue(state.step) }), ...(state.brand === undefined ? {} : { brand: projectBrand(state.brand) }), ...(state.width === undefined ? {} : { width: numberValue(state.width, 48) }), ...(state.height === undefined ? {} : { height: numberValue(state.height, 36) }), ...(state.yOffset === undefined ? {} : { yOffset: numberValue(state.yOffset) }) }; }); result.transitions = source.transitions.map((item) => projectRelationship(item, new Set(['auto', 'straight', 'drop', 'bottom-channel', 'top-channel', 'right-channel', 'left-channel']), { allowed: new Set(['id', 'from', 'to', 'label', 'note', 'variant', 'route', 'fromSide', 'toSide', 'channelX', 'channelY', 'cornerRadius', 'labelAt', 'labelDx', 'labelDy', 'labelSegment', 'via', 'width']), note: true })); }
  const cards = projectCards(source.cards); if (cards !== undefined) result.cards = cards;
  return result;
}

export function sanitizeArchifyDocument(diagramType: keyof typeof ARCHIFY_RENDERER_ENTRYPOINTS, document: unknown): Record<string, unknown> { return projectArchifyDocument(diagramType, document); }
export function validateArchifyDocument(diagramType: keyof typeof ARCHIFY_RENDERER_ENTRYPOINTS, document: unknown): void { sanitizeArchifyDocument(diagramType, document); }

function qualityProfile(document: unknown): 'standard' | 'showcase' {
  const value = isRecord(document) && isRecord(document.meta) ? document.meta.quality_profile : undefined;
  return value === 'showcase' ? 'showcase' : 'standard';
}

function runtimeEnvironment(profile: 'standard' | 'showcase'): NodeJS.ProcessEnv {
  const environment = {} as NodeJS.ProcessEnv;
  for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'LANG']) {
    if (process.env[key] !== undefined) environment[key] = process.env[key];
  }
  environment.ARCHIFY_QUALITY_PROFILE = profile;
  return environment;
}

function runChild(entrypoint: string, inputPath: string, outputPath: string, profile: 'standard' | 'showcase', vendorRoot: string): Promise<void> {
  const spawn: Spawn = hooks.spawn || (nodeSpawn as unknown as Spawn);
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(process.execPath, [entrypoint, inputPath, outputPath], {
      cwd: vendorRoot,
      env: runtimeEnvironment(profile),
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'ignore'],
    });
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    child.once('error', () => finish(safeError('Archify không thể khởi chạy bộ render.')));
    child.once('close', (code) => finish(code === 0 ? undefined : safeError('Archify không thể render biểu đồ.')));
    timer = setTimeout(() => {
      child.kill();
      finish(safeError('Archify render quá thời gian cho phép.'));
    }, hooks.timeoutMs ?? ARCHIFY_RENDER_TIMEOUT_MS);
  });
}

async function readCappedOutput(outputPath: string): Promise<string> {
  const outputStat = await (hooks.statOutput || stat)(outputPath);
  if (outputStat.size > ARCHIFY_MAX_OUTPUT_BYTES) throw safeError('Archify trả về nội dung quá lớn.');
  if (hooks.readOutput) {
    const output = await hooks.readOutput(outputPath, 'utf8');
    if (Buffer.byteLength(output) > ARCHIFY_MAX_OUTPUT_BYTES) throw safeError('Archify trả về nội dung quá lớn.');
    return output;
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of createReadStream(outputPath, { encoding: undefined, highWaterMark: 64 * 1024 })) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > ARCHIFY_MAX_OUTPUT_BYTES) throw safeError('Archify trả về nội dung quá lớn.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks, total).toString('utf8');
}

export async function runArchifyRenderer(input: {
  diagramType: keyof typeof ARCHIFY_RENDERER_ENTRYPOINTS;
  document: unknown;
}): Promise<string> {
  const sanitizedDocument = sanitizeArchifyDocument(input.diagramType, input.document);
  const tempDir = await mkdtemp(path.join(process.cwd(), '.pcn-archify-'));
  const inputPath = path.join(tempDir, 'diagram.json');
  const outputPath = path.join(tempDir, 'diagram.html');
  const entrypoint = path.resolve(ARCHIFY_PINNED_VENDOR_ROOT, ARCHIFY_RENDERER_ENTRYPOINTS[input.diagramType]);
  let operationFailed = false;
  try {
    await (hooks.writeInput || writeFile)(inputPath, JSON.stringify(sanitizedDocument), 'utf8');
    await runChild(entrypoint, inputPath, outputPath, qualityProfile(sanitizedDocument), ARCHIFY_PINNED_VENDOR_ROOT);
    return await readCappedOutput(outputPath);
  } catch (error) {
    operationFailed = true;
    if (error instanceof Error && error.message.startsWith('Archify')) throw error;
    throw safeError('Archify không thể render biểu đồ.', error);
  } finally {
    try {
      await (hooks.remove || rm)(tempDir, { recursive: true, force: true });
    } catch {
      if (!operationFailed) throw safeError('Archify không thể dọn dẹp phiên render.');
    }
  }
}
