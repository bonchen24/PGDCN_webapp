// Author: Codex
// OS support: Node/Windows
// Description: Generate PCN operational DOCX files through the live API and compare them with surveyed source forms.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import PizZip from 'pizzip';
import { PCN_STANDARD_DOSSIER_FIXTURES } from '../utils/pcnStandardDossierFlow.ts';

type JsonRecord = Record<string, any>;
type DossierFixture = (typeof PCN_STANDARD_DOSSIER_FIXTURES)[number];
type DocumentKind = 'ASSIGNMENT_FORM' | 'EVALUATION_PLAN' | 'FIELD_INSPECTION' | 'SAMPLE_TAKING' | 'SAMPLE_CODING' | 'SAMPLE_HANDOVER' | 'SAMPLE_RETURN' | 'LAB_REQUEST';

interface RequestResult {
  status: number;
  payload: any;
  bytes?: Buffer;
}

interface GeneratedCheck {
  dossierCode: string;
  kind: DocumentKind;
  sourceRelativePath: string;
  sourceExtension: string;
  generatedFileName: string;
  generatedAssetId: string;
  generatedByteSize: number;
  generatedSha256: string;
  generatedTextLength: number;
  generatedContainsPlaceholders: boolean;
  sourceTextLength: number | null;
  sourceContains: Record<string, boolean>;
  generatedContains: Record<string, boolean>;
  notes: string[];
}

interface TestReport {
  generatedAt: string;
  baseUrl: string;
  sourceRoot: string;
  persistedInputUpdates: Array<{ dossierCode: string; dossierId: string; formKeys: string[]; handoverRequestId: string; handoverUpdated: boolean }>;
  documents: GeneratedCheck[];
}

const baseUrl = new URL(process.env.PCN_DOCX_TEST_BASE_URL || 'http://localhost:1357');
baseUrl.username = '';
baseUrl.password = '';
baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, '') || '/';

const sourceArgument = process.env.PCN_DOCX_SOURCE_ROOT || process.argv.find((argument) => argument.startsWith('--source='))?.slice('--source='.length) || '';
const sourceRoot = sourceArgument ? path.resolve(sourceArgument) : '';
const outputRoot = path.resolve(process.env.PCN_DOCX_QA_DIR || path.join('tmp', 'pcn-docx-source-qa-20260831'));
const username = String(process.env.PCN_DOCX_TEST_USERNAME || 'luongxuanhung').trim();
const password = process.env.PCN_DOCX_TEST_PASSWORD || process.env.PCN_SMOKE_PASSWORD || '';
const cookieJar = new Map<string, string>();

const generatedPlan: Array<{ fixture: DossierFixture; kind: DocumentKind; sourceFileName: string; sampleRoute?: 'PERFORMANCE' }> = [
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[0], kind: 'ASSIGNMENT_FORM', sourceFileName: 'Nhap data Bien ban 0583.docx' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[0], kind: 'EVALUATION_PLAN', sourceFileName: 'Nhap data Bien ban 0583.docx' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[0], kind: 'FIELD_INSPECTION', sourceFileName: 'BB KQ DANH GIA TAI HIEN TRUONG DA KY.pdf' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[0], kind: 'SAMPLE_TAKING', sourceFileName: 'BB LAY MAU DA KY.pdf', sampleRoute: 'PERFORMANCE' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[0], kind: 'SAMPLE_CODING', sourceFileName: 'BB LAY MAU DA KY.pdf', sampleRoute: 'PERFORMANCE' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[0], kind: 'SAMPLE_HANDOVER', sourceFileName: 'BB Hiện trường-BB lấy mẫu-Đại Dương LS.doc', sampleRoute: 'PERFORMANCE' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[0], kind: 'LAB_REQUEST', sourceFileName: 'PYC 0583 2 Quạt FULL.docx' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[1], kind: 'SAMPLE_TAKING', sourceFileName: 'bb lấy mẫu.doc', sampleRoute: 'PERFORMANCE' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[1], kind: 'SAMPLE_CODING', sourceFileName: 'bb lấy mẫu.doc', sampleRoute: 'PERFORMANCE' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[1], kind: 'SAMPLE_HANDOVER', sourceFileName: 'bb lấy mẫu.doc', sampleRoute: 'PERFORMANCE' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[1], kind: 'SAMPLE_RETURN', sourceFileName: '0499-19.docx', sampleRoute: 'PERFORMANCE' },
  { fixture: PCN_STANDARD_DOSSIER_FIXTURES[1], kind: 'LAB_REQUEST', sourceFileName: 'PYC 1739.pdf' },
];

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getItems(payload: unknown): JsonRecord[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (isRecord(payload) && Array.isArray(payload.items)) return payload.items.filter(isRecord);
  return [];
}

function getCookieHeaders(headers: Headers): string[] {
  const typedHeaders = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof typedHeaders.getSetCookie === 'function') return typedHeaders.getSetCookie();
  const value = headers.get('set-cookie');
  return value ? [value] : [];
}

function updateCookieJar(headers: Headers): void {
  for (const header of getCookieHeaders(headers)) {
    const pair = header.split(';', 1)[0] || '';
    const separator = pair.indexOf('=');
    if (separator < 1) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (value) cookieJar.set(name, value);
    else cookieJar.delete(name);
  }
}

async function request(pathname: string, init: RequestInit = {}): Promise<RequestResult> {
  const headers = new Headers(init.headers);
  const cookie = [...cookieJar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(new URL(pathname, baseUrl), { ...init, headers, signal: AbortSignal.timeout(60_000) });
  updateCookieJar(response.headers);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type') || '';
  let payload: any = bytes.toString('utf8');
  if (contentType.includes('application/json')) {
    try { payload = JSON.parse(payload); } catch { /* keep text */ }
  }
  return { status: response.status, payload, bytes };
}

async function expectJson(pathname: string, init: RequestInit = {}): Promise<any> {
  const result = await request(pathname, init);
  if (result.status < 200 || result.status >= 300) {
    throw new Error(`${init.method || 'GET'} ${pathname} → HTTP ${result.status}: ${typeof result.payload === 'string' ? result.payload : JSON.stringify(result.payload)}`);
  }
  return result.payload;
}

function jsonBody(body: unknown): RequestInit {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) };
}

function normalized(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCodePoint(parseInt(code, 16)));
}

function extractDocxText(body: Buffer): string {
  const zip = new PizZip(body);
  const xml = zip.file('word/document.xml')?.asText() || '';
  const parts: string[] = [];
  for (const match of xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)) parts.push(decodeXml(match[1]));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function extractPdfText(filePath: string): string | null {
  const python = process.env.PCN_DOCX_TEST_PYTHON || 'python';
  const code = [
    'import sys',
    'import pdfplumber',
    'with pdfplumber.open(sys.argv[1]) as pdf:',
    '    print("\\n".join((page.extract_text() or "") for page in pdf.pages))',
  ].join('; ');
  const result = spawnSync(python, ['-c', code, filePath], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
  return result.status === 0 ? String(result.stdout || '').replace(/\s+/g, ' ').trim() : null;
}

function extractSourceText(filePath: string): string | null {
  const extension = path.extname(filePath).toLowerCase();
  try {
    if (extension === '.docx') return extractDocxText(fs.readFileSync(filePath));
    if (extension === '.pdf') return extractPdfText(filePath);
  } catch {
    return null;
  }
  return null;
}

function findSourceFile(fixture: DossierFixture, fileName: string): string {
  const candidateRoots = [path.join(sourceRoot, fixture.sourceRelativeFolder)];
  const hint = fixture.sourceFilePathHints?.[fileName];
  if (hint) candidateRoots.push(path.join(sourceRoot, fixture.sourceRelativeFolder.split(/[\\/]/)[0], path.dirname(hint)));
  const wanted = normalized(fileName);
  const queue = candidateRoots.filter((root, index, all) => all.indexOf(root) === index).filter((root) => fs.existsSync(root));
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    const key = current.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) queue.push(fullPath);
      else if (normalized(entry.name) === wanted) return fullPath;
    }
  }
  throw new Error(`Không tìm thấy file nguồn ${fileName} trong nhánh ${fixture.sourceRelativeFolder}.`);
}

function inputTokens(fixture: DossierFixture, kind: DocumentKind): Array<{ label: string; value: string }> {
  const tokens: Array<{ label: string; value: string }> = [];
  if (kind !== 'SAMPLE_HANDOVER') {
    tokens.push({ label: 'mã hồ sơ', value: fixture.dossierCode });
  }
  if (!['SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN'].includes(kind)) {
    tokens.push({ label: 'khách hàng', value: fixture.proposal.customerSnapshot.name });
  }
  if (['ASSIGNMENT_FORM', 'EVALUATION_PLAN', 'FIELD_INSPECTION', 'SAMPLE_TAKING', 'SAMPLE_HANDOVER', 'LAB_REQUEST'].includes(kind)) {
    tokens.push({ label: 'quy chuẩn', value: fixture.fieldCode === 'QC4' ? 'QCVN 4' : 'QCVN 9' });
  }
  if (['SAMPLE_TAKING', 'SAMPLE_CODING', 'SAMPLE_RETURN'].includes(kind)) {
    tokens.push({ label: 'mã lô', value: fixture.lotCode });
  }
  if (kind === 'LAB_REQUEST') tokens.push({ label: 'tên mẫu', value: fixture.sampleName });
  return tokens.filter((token) => normalized(token.value).length >= 3);
}

function buildOperationalForms(fixture: DossierFixture): JsonRecord {
  const isQc4 = fixture.fieldCode === 'QC4';
  const prefix = isQc4 ? 'QC4' : 'QC9';
  const base = {
    savedAt: '2026-08-31T08:00:00.000Z',
    savedByUsername: username,
  };
  return {
    assignment: {
      ...base,
      assignmentNumber: `PCN-${prefix}-PC-TEST-0583`,
      assignedAt: '2026-08-31',
      assignedBy: 'Lương Xuân Hùng',
      ownerUsername: 'tranhoangphuong',
      evaluatorUsername: 'vuthitham',
      reviewerUsername: 'luongxuanhung',
      scope: `${fixture.sampleName} theo ${prefix === 'QC4' ? 'QCVN 4:2009/BKHCN' : 'QCVN 9:2012/BKHCN'}`,
      notes: 'Dữ liệu kiểm thử sinh biên bản từ bộ hồ sơ chuẩn PCN · template QA r7.',
    },
    evaluationPlan: {
      ...base,
      plannedStartAt: '2026-08-31',
      plannedEndAt: '2026-09-01',
      location: isQc4 ? fixture.proposal.warehouseAddress : 'Kho hàng khách hàng theo hồ sơ Canzy',
      teamMembers: ['Trần Hoàng Phương', 'Vũ Thị Thắm'],
      scope: fixture.sampleName,
      criteria: `Áp dụng ${prefix === 'QC4' ? 'QCVN 4:2009/BKHCN' : 'QCVN 9:2012/BKHCN'} và hồ sơ kỹ thuật đã tiếp nhận.`,
      customerRepresentative: fixture.proposal.customerSnapshot.contactPerson,
      notes: 'Kế hoạch lập để đối chiếu form nguồn và kiểm tra pipeline · template QA r7.',
    },
    fieldInspection: {
      ...base,
      inspectedAt: '2026-08-31',
      location: isQc4 ? fixture.proposal.warehouseAddress : 'Kho hàng khách hàng theo hồ sơ Canzy',
      participants: ['Trần Hoàng Phương', 'Vũ Thị Thắm', fixture.proposal.customerSnapshot.contactPerson],
      findings: `Đã kiểm tra nhận dạng ${fixture.sampleName}, model ${fixture.sampleModel}; thông tin phù hợp với Đề nghị và lô mẫu.`,
      conclusion: 'Đủ căn cứ chuyển sang lấy mẫu và gửi phòng thử nghiệm.',
      nonconformities: [],
      notes: 'Biên bản kiểm thử; không thay thế văn bản ký chính thức · template QA r7.',
    },
    sampleTaking: {
      ...base,
      sampledAt: '2026-08-31',
      location: isQc4 ? fixture.proposal.warehouseAddress : 'Kho hàng khách hàng theo hồ sơ Canzy',
      samplingMethod: 'Lấy mẫu đại diện theo lô, niêm phong tại hiện trường.',
      participants: ['Trần Hoàng Phương', fixture.proposal.customerSnapshot.contactPerson],
      sampleQuantity: fixture.sampleQuantity,
      unit: 'mẫu',
      packaging: 'Nguyên vẹn, có tem niêm phong PCN.',
      sealCode: `${fixture.lotCode}-SEAL`,
      notes: 'Dữ liệu mẫu dùng cho kiểm thử sinh DOCX · template QA r7.',
    },
    sampleCoding: {
      ...base,
      codedAt: '2026-08-31',
      coder: 'Trần Hoàng Phương',
      lotCode: fixture.lotCode,
      sampleCodes: Array.from({ length: fixture.sampleQuantity }, (_item, index) => `${fixture.fieldCode}-${fixture.proposal.proposalCode.replace(/^DN-/, '')}-S${String(index + 1).padStart(2, '0')}`),
      sealCode: `${fixture.lotCode}-SEAL`,
      notes: 'Mã hóa mẫu theo lô; dùng để theo dõi cùng một lô qua từng phòng thử · template QA r7.',
    },
  };
}

function buildHandoverDetails(fixture: DossierFixture): JsonRecord {
  const forms = buildOperationalForms(fixture);
  return {
    senderName: 'Trần Hoàng Phương',
    senderUnit: 'Phòng Chứng nhận - TVCI',
    receiverName: fixture.fieldCode === 'QC4' ? 'Phòng thử nghiệm Hiệu suất' : 'Nguyễn Văn Đại',
    receiverUnit: fixture.fieldCode === 'QC4' ? 'Phòng thử nghiệm Hiệu suất - TVCI' : 'Phòng thử nghiệm Hiệu suất',
    handoverAt: '2026-08-31T09:00:00.000Z',
    receivedAt: '2026-08-31T09:30:00.000Z',
    location: 'TVCI - khu tiếp nhận mẫu',
    vehicle: 'Xe nội bộ TVCI',
    driver: 'Vũ Thị Thắm',
    quantity: Number(forms.sampleTaking.sampleQuantity || fixture.sampleQuantity),
    sampleCodes: forms.sampleCoding.sampleCodes,
    note: 'Giao mẫu theo PYC; thông tin được lập để kiểm thử biên bản DOCX.',
  };
}

async function login(): Promise<void> {
  if (!sourceRoot || !fs.existsSync(sourceRoot)) throw new Error(`SOURCE_ROOT không tồn tại: ${sourceRoot || '(trống)'}`);
  if (!password) throw new Error('Thiếu PCN_DOCX_TEST_PASSWORD hoặc PCN_SMOKE_PASSWORD; không truyền mật khẩu qua tham số dòng lệnh.');
  await expectJson('/api/auth/pcn-session', jsonBody({ username, password }));
}

async function updateInputs(fixture: DossierFixture, dossier: JsonRecord, labRequests: JsonRecord[], routes: JsonRecord[]): Promise<{ handoverRequestId: string; handoverUpdated: boolean }> {
  const forms = buildOperationalForms(fixture);
  await expectJson(`/api/pcn/dossiers/${encodeURIComponent(dossier.id)}`, jsonBody({
    idempotencyKey: `docx-source-input-v7-${dossier.id}`,
    updates: { operationalForms: forms },
  }));
  const route = routes.find((item) => item.sampleLotId && item.labCode === 'PERFORMANCE');
  const request = route ? labRequests.find((item) => item.id === route.labRequestId) : undefined;
  if (!request) throw new Error(`Không tìm thấy PYC hiệu suất cho ${fixture.dossierCode}.`);
  await expectJson(`/api/pcn/lab-requests/${encodeURIComponent(request.id)}/status`, jsonBody({
    status: request.status,
    idempotencyKey: `docx-source-handover-v7-${request.id}`,
    updates: { handoverDetails: buildHandoverDetails(fixture) },
  }));
  return { handoverRequestId: request.id, handoverUpdated: true };
}

async function generate(fixture: DossierFixture, dossier: JsonRecord, kind: DocumentKind, labRequest: JsonRecord | undefined, route: JsonRecord | undefined): Promise<{ generated: JsonRecord; body: Buffer }> {
  const selection = kind === 'LAB_REQUEST' ? { labRequestId: labRequest?.id } : ['SAMPLE_TAKING', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN'].includes(kind) ? { sampleRouteId: route?.id } : {};
  if ((kind === 'LAB_REQUEST' && !labRequest) || (selection.sampleRouteId === undefined && ['SAMPLE_TAKING', 'SAMPLE_CODING', 'SAMPLE_HANDOVER', 'SAMPLE_RETURN'].includes(kind))) {
    throw new Error(`Thiếu selection cho ${fixture.dossierCode}/${kind}.`);
  }
  const preflight = await expectJson('/api/pcn/documents/generate', jsonBody({ dossierId: dossier.id, kind, formats: ['DOCX'], dryRun: true, ...selection }));
  if (!preflight.context?.contextHash) throw new Error(`Preflight không trả contextHash cho ${fixture.dossierCode}/${kind}.`);
  const generatedPayload = await expectJson('/api/pcn/documents/generate', jsonBody({ dossierId: dossier.id, kind, formats: ['DOCX'], expectedContextHash: preflight.context.contextHash, ...selection }));
  const generated = (generatedPayload.documents || [])[0];
  if (!generated?.fileAssetId) throw new Error(`API không trả fileAssetId cho ${fixture.dossierCode}/${kind}.`);
  const download = await request(`/api/pcn/files/${encodeURIComponent(generated.fileAssetId)}`);
  if (download.status !== 200 || !download.bytes?.length) throw new Error(`Không tải được file sinh ${fixture.dossierCode}/${kind}: HTTP ${download.status}.`);
  return { generated, body: download.bytes };
}

async function main(): Promise<void> {
  await login();
  fs.mkdirSync(outputRoot, { recursive: true });
  const dossierItems = getItems(await expectJson('/api/db/certificationDossiers'));
  const labRequests = getItems(await expectJson('/api/db/labRequests'));
  const routes = getItems(await expectJson('/api/db/pcnSampleRoutes'));
  const report: TestReport = { generatedAt: new Date().toISOString(), baseUrl: baseUrl.toString().replace(/\/$/, ''), sourceRoot, persistedInputUpdates: [], documents: [] };
  const updatedInputs = new Map<string, { handoverRequestId: string; handoverUpdated: boolean }>();

  for (const fixture of PCN_STANDARD_DOSSIER_FIXTURES) {
    const dossier = dossierItems.find((item) => item.dossierCode === fixture.dossierCode);
    if (!dossier) throw new Error(`Không tìm thấy hồ sơ seeded ${fixture.dossierCode}.`);
    const dossierRequests = labRequests.filter((item) => item.dossierId === dossier.id);
    const dossierRoutes = routes.filter((item) => dossierRequests.some((request) => request.sampleRouteId === item.id) || item.sampleLotId && dossier.sampleLotIds?.includes(item.sampleLotId));
    updatedInputs.set(dossier.id, await updateInputs(fixture, dossier, dossierRequests, dossierRoutes));
    report.persistedInputUpdates.push({ dossierCode: fixture.dossierCode, dossierId: dossier.id, formKeys: ['assignment', 'evaluationPlan', 'fieldInspection', 'sampleTaking', 'sampleCoding'], ...updatedInputs.get(dossier.id)! });
  }

  const refreshedRequests = getItems(await expectJson('/api/db/labRequests'));
  const refreshedRoutes = getItems(await expectJson('/api/db/pcnSampleRoutes'));
  for (const plan of generatedPlan) {
    const dossier = dossierItems.find((item) => item.dossierCode === plan.fixture.dossierCode)!;
    const dossierRequests = refreshedRequests.filter((item) => item.dossierId === dossier.id);
    const dossierRoutes = refreshedRoutes.filter((item) => item.sampleLotId && dossier.sampleLotIds?.includes(item.sampleLotId));
    const route = plan.sampleRoute ? dossierRoutes.find((item) => item.labCode === plan.sampleRoute) : undefined;
    const request = plan.kind === 'LAB_REQUEST'
      ? dossierRequests.find((item) => item.pycNumber === (plan.fixture.labArtifacts.find((artifact) => artifact.labCode === 'PERFORMANCE')?.pycNumber || ''))
      : route?.labRequestId ? dossierRequests.find((item) => item.id === route.labRequestId) : undefined;
    const generatedResult = await generate(plan.fixture, dossier, plan.kind, request, route);
    const dossierOutputDir = path.join(outputRoot, plan.fixture.fieldCode.toLowerCase());
    fs.mkdirSync(dossierOutputDir, { recursive: true });
    const outputPath = path.join(dossierOutputDir, `${plan.kind.toLowerCase()}.docx`);
    fs.writeFileSync(outputPath, generatedResult.body);
    const sourcePath = findSourceFile(plan.fixture, plan.sourceFileName);
    const generatedText = extractDocxText(generatedResult.body);
    const sourceText = extractSourceText(sourcePath);
    const tokens = inputTokens(plan.fixture, plan.kind);
    const generatedContains = Object.fromEntries(tokens.map((token) => [token.label, normalized(generatedText).includes(normalized(token.value))]));
    const sourceContains = Object.fromEntries(tokens.map((token) => [token.label, sourceText ? normalized(sourceText).includes(normalized(token.value)) : false]));
    const notes: string[] = [];
    const extension = path.extname(sourcePath).toLowerCase();
    if (extension === '.doc' || extension === '.pdf') notes.push(`Nguồn ${extension.toUpperCase()} được đối chiếu nội dung; cần render riêng để so sánh bố cục.`);
    if (!sourceText) notes.push('Không trích xuất được text nguồn bằng bộ đọc hiện có; giữ nguyên file nguồn và ghi nhận để đối chiếu trực quan.');
    if (generatedText.includes('[[') || generatedText.includes(']]')) notes.push('CẢNH BÁO: DOCX còn placeholder chưa thay.');
    report.documents.push({
      dossierCode: plan.fixture.dossierCode,
      kind: plan.kind,
      sourceRelativePath: path.relative(sourceRoot, sourcePath),
      sourceExtension: extension,
      generatedFileName: generatedResult.generated.fileName,
      generatedAssetId: generatedResult.generated.fileAssetId,
      generatedByteSize: generatedResult.body.length,
      generatedSha256: generatedResult.generated.sha256,
      generatedTextLength: generatedText.length,
      generatedContainsPlaceholders: generatedText.includes('[[') || generatedText.includes(']]'),
      sourceTextLength: sourceText?.length ?? null,
      sourceContains,
      generatedContains,
      notes,
    });
  }

  const reportPath = path.join(outputRoot, 'report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, reportPath, generatedCount: report.documents.length, outputRoot, generatedAssets: report.documents.map((document) => ({ dossierCode: document.dossierCode, kind: document.kind, assetId: document.generatedAssetId })) }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
