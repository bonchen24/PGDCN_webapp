// Author: Codex
// OS support: Node
// Description: Safe, optional DOCX-to-PDF capability for official PCN documents

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_TIMEOUT_MS = 120_000;

export type PcnPdfRendererReason = 'MISSING_RENDERER' | 'INVALID_RENDERER';

export interface PcnPdfRendererReadiness {
  ready: boolean;
  executable?: string;
  reason?: PcnPdfRendererReason;
}

export function resolvePcnPdfRenderer(env: Record<string, string | undefined> = process.env): PcnPdfRendererReadiness {
  const executable = String(env.PCN_DOCX_PDF_RENDERER || '').trim();
  if (!executable) return { ready: false, reason: 'MISSING_RENDERER' };
  if (executable.startsWith('-') || /[\u0000\r\n|;&<>]/.test(executable) || /\s--[\w-]+/.test(executable)) {
    return { ready: false, reason: 'INVALID_RENDERER' };
  }
  return { ready: true, executable };
}

export function getPcnPdfRendererReadiness(env: Record<string, string | undefined> = process.env): PcnPdfRendererReadiness {
  return resolvePcnPdfRenderer(env);
}

function timeoutMs(env: Record<string, string | undefined>): number {
  const value = Number(env.PCN_DOCX_PDF_RENDERER_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);
  return Number.isFinite(value) && value >= 5_000 && value <= 10 * 60_000 ? value : DEFAULT_TIMEOUT_MS;
}

function safeStem(fileName: string): string {
  return path.basename(String(fileName || 'official-document').replace(/\.[^.]+$/, '')).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'official-document';
}

export function buildPcnPdfRendererArgs(inputPath: string, outputDir: string, profileDir: string): string[] {
  return [
    `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
    '--headless',
    '--norestore',
    '--nodefault',
    '--nolockcheck',
    '--nofirststartwizard',
    '--convert-to',
    'pdf:writer_pdf_Export',
    '--outdir',
    outputDir,
    inputPath,
  ];
}

function runRenderer(executable: string, args: string[], timeout: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error('Renderer PDF PCN vượt quá thời gian cho phép.'));
    }, timeout);
    child.stderr?.on('data', (chunk) => { stderr = `${stderr}${String(chunk)}`.slice(-2_000); });
    child.on('error', (error) => finish(new Error(`Không khởi động được renderer PDF PCN: ${error.message}`)));
    child.on('close', (code) => {
      if (code === 0) finish();
      else finish(new Error(`Renderer PDF PCN kết thúc với mã ${code ?? 'không xác định'}${stderr ? `: ${stderr.trim()}` : '.'}`));
    });
  });
}

export async function renderPcnDocxToPdf(
  docxBytes: Buffer,
  fileName = 'official-document.docx',
  env: Record<string, string | undefined> = process.env,
): Promise<Buffer> {
  if (!docxBytes?.length) throw new Error('DOCX nguồn để chuyển PDF đang rỗng.');
  const readiness = resolvePcnPdfRenderer(env);
  if (!readiness.ready || !readiness.executable) {
    throw new Error(readiness.reason === 'INVALID_RENDERER'
      ? 'Renderer PDF PCN không hợp lệ; chỉ nhận một executable, không nhận command string.'
      : 'PDF phát hành chính thức chưa sẵn sàng: chưa cấu hình PCN_DOCX_PDF_RENDERER.');
  }
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcn-official-pdf-'));
  const stem = safeStem(fileName);
  const inputPath = path.join(tempDir, `${stem}.docx`);
  const outputPath = path.join(tempDir, `${stem}.pdf`);
  const profileDir = path.join(tempDir, 'profile');
  try {
    await fs.writeFile(inputPath, docxBytes);
    await fs.mkdir(profileDir);
    await runRenderer(readiness.executable, buildPcnPdfRendererArgs(inputPath, tempDir, profileDir), timeoutMs(env));
    const pdfBytes = await fs.readFile(outputPath);
    if (pdfBytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Renderer PDF PCN tạo output không phải PDF hợp lệ.');
    return pdfBytes;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

// --- End of pcnPdfRenderer.ts ---
