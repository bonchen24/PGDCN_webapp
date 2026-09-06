import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const ARCHIFY_RENDERER_ENTRYPOINTS = {
  architecture: 'renderers/architecture/render-architecture.mjs',
  dataflow: 'renderers/dataflow/render-dataflow.mjs',
  sequence: 'renderers/sequence/render-sequence.mjs',
  lifecycle: 'renderers/lifecycle/render-lifecycle.mjs',
} as const;

export const ARCHIFY_TEMPLATE_ENTRYPOINT = 'assets/template.html';
export const ARCHIFY_RENDER_TIMEOUT_MS = 15_000;
export const ARCHIFY_MAX_OUTPUT_BYTES = 12 * 1024 * 1024;

type Spawn = typeof nodeSpawn;
type RuntimeHooks = {
  spawn?: Spawn;
  remove?: (target: string, options: { recursive: true; force: true }) => Promise<void>;
  readOutput?: (target: string, encoding: 'utf8') => Promise<string>;
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

function requireArray(document: Record<string, unknown>, key: string, minimum: number): void {
  if (!Array.isArray(document[key]) || document[key].length < minimum) throw safeError('Dữ liệu Archify không hợp lệ.');
}

export function validateArchifyDocument(diagramType: keyof typeof ARCHIFY_RENDERER_ENTRYPOINTS, document: unknown): void {
  if (!isRecord(document) || document.schema_version !== 1 || document.diagram_type !== diagramType || !isRecord(document.meta) || typeof document.meta.title !== 'string' || !document.meta.title.trim()) {
    throw safeError('Dữ liệu Archify không hợp lệ.');
  }
  if (diagramType === 'architecture') requireArray(document, 'components', 1);
  if (diagramType === 'dataflow') { requireArray(document, 'stages', 2); requireArray(document, 'nodes', 2); requireArray(document, 'flows', 0); }
  if (diagramType === 'sequence') { requireArray(document, 'participants', 2); requireArray(document, 'messages', 1); }
  if (diagramType === 'lifecycle') { requireArray(document, 'lanes', 1); requireArray(document, 'states', 2); requireArray(document, 'transitions', 0); }
}

function qualityProfile(document: unknown): 'standard' | 'showcase' {
  const value = isRecord(document) && isRecord(document.meta) ? document.meta.quality_profile : undefined;
  return value === 'showcase' ? 'showcase' : 'standard';
}

function runtimeEnvironment(profile: 'standard' | 'showcase'): NodeJS.ProcessEnv {
  const environment = { ...process.env };
  delete environment.ARCHIFY_REPO_ROOT;
  delete environment.ARCHIFY_QUALITY_PROFILE;
  environment.ARCHIFY_QUALITY_PROFILE = profile;
  return environment;
}

function runChild(entrypoint: string, inputPath: string, outputPath: string, profile: 'standard' | 'showcase'): Promise<void> {
  const spawn = hooks.spawn || nodeSpawn;
  return new Promise((resolve, reject) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const child = spawn(process.execPath, [entrypoint, inputPath, outputPath], {
      cwd: path.dirname(path.dirname(entrypoint)),
      env: runtimeEnvironment(profile),
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
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

export async function runArchifyRenderer(input: {
  vendorRoot: string;
  diagramType: keyof typeof ARCHIFY_RENDERER_ENTRYPOINTS;
  document: unknown;
}): Promise<string> {
  validateArchifyDocument(input.diagramType, input.document);
  const tempDir = await mkdtemp(path.join(process.cwd(), '.pcn-archify-'));
  const inputPath = path.join(tempDir, 'diagram.json');
  const outputPath = path.join(tempDir, 'diagram.html');
  const entrypoint = path.resolve(input.vendorRoot, ARCHIFY_RENDERER_ENTRYPOINTS[input.diagramType]);
  try {
    await writeFile(inputPath, JSON.stringify(input.document), 'utf8');
    await runChild(entrypoint, inputPath, outputPath, qualityProfile(input.document));
    const output = await (hooks.readOutput || readFile)(outputPath, 'utf8');
    if (Buffer.byteLength(output) > ARCHIFY_MAX_OUTPUT_BYTES) throw safeError('Archify trả về nội dung quá lớn.');
    return output;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Archify')) throw error;
    throw safeError('Archify không thể render biểu đồ.', error);
  } finally {
    await (hooks.remove || rm)(tempDir, { recursive: true, force: true });
  }
}
