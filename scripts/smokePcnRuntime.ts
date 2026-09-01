type JsonRecord = Record<string, unknown>;

interface RequestResult {
  status: number;
  payload: unknown;
}

interface SmokeCheck {
  name: string;
  ok: boolean;
  detail: string;
}

interface CheckResult {
  ok: boolean;
  detail: string;
}

const rawBaseUrl = process.env.PCN_SMOKE_BASE_URL || 'http://localhost:1357';
const baseUrl = new URL(rawBaseUrl);
baseUrl.username = '';
baseUrl.password = '';
baseUrl.pathname = baseUrl.pathname.replace(/\/+$/, '') || '/';

const username = String(process.env.PCN_SMOKE_USERNAME || 'admin').trim();
const password = process.env.PCN_SMOKE_PASSWORD ?? (process.env.NODE_ENV === 'production' ? '' : 'admin');
const requiredStationRoutes = {
  'QC4-ASSIGNMENT_FORM': 'ASSIGNMENT',
  'QC4-EVALUATION_PLAN': 'EVALUATION',
  'QC4-FIELD_INSPECTION': 'EVALUATION',
  'QC4-SAMPLE_CODING': 'SAMPLING_LAB',
  'QC9-ASSIGNMENT_FORM': 'ASSIGNMENT',
  'QC9-EVALUATION_PLAN': 'EVALUATION',
  'QC9-FIELD_INSPECTION': 'EVALUATION',
  'QC9-SAMPLE_CODING': 'SAMPLING_LAB',
} as const;
const checks: SmokeCheck[] = [];
const cookieJar = new Map<string, string>();

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function getItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload) && Array.isArray(payload.items)) return payload.items;
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
    if (!value) cookieJar.delete(name);
    else cookieJar.set(name, value);
  }
}

async function request(pathname: string, init: RequestInit = {}): Promise<RequestResult> {
  const headers = new Headers(init.headers);
  const cookie = Array.from(cookieJar.entries()).map(([name, value]) => `${name}=${value}`).join('; ');
  if (cookie) headers.set('cookie', cookie);
  const response = await fetch(new URL(pathname, baseUrl), {
    ...init,
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  updateCookieJar(response.headers);
  const text = await response.text();
  let payload: unknown = text;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // The smoke result only needs status and selected JSON fields.
  }
  return { status: response.status, payload };
}

async function runCheck(
  name: string,
  operation: () => Promise<RequestResult>,
  validate: (result: RequestResult) => CheckResult,
): Promise<RequestResult | undefined> {
  try {
    const result = await operation();
    const outcome = validate(result);
    checks.push({ name, ok: outcome.ok, detail: outcome.detail });
    return outcome.ok ? result : undefined;
  } catch {
    checks.push({ name, ok: false, detail: 'NETWORK_OR_RUNTIME_ERROR' });
    return undefined;
  }
}

function statusCheck(result: RequestResult, expectedStatus: number): CheckResult {
  return {
    ok: result.status === expectedStatus,
    detail: `HTTP ${result.status}`,
  };
}

function jsonStatusCheck(result: RequestResult, expectedStatus: number, predicate: (payload: unknown) => boolean, detail: string): CheckResult {
  return {
    ok: result.status === expectedStatus && predicate(result.payload),
    detail: result.status === expectedStatus ? detail : `HTTP ${result.status}`,
  };
}

async function main(): Promise<void> {
  if (!password) throw new Error('Thiếu PCN_SMOKE_PASSWORD; không truyền mật khẩu qua tham số dòng lệnh.');

  await runCheck('public app shell', () => request('/'), (result) => ({
    ok: result.status === 200 && typeof result.payload === 'string' && result.payload.includes('<title>Phòng Chứng nhận - TVCI</title>'),
    detail: result.status === 200 ? 'HTTP 200; PCN app shell rendered' : `HTTP ${result.status}`,
  }));

  await runCheck('public health', () => request('/api/health'), (result) => jsonStatusCheck(
    result,
    200,
    (payload) => isRecord(payload) && payload.status === 'ok',
    'HTTP 200; status=ok',
  ));

  await runCheck('unauthenticated session boundary', () => request('/api/auth/pcn-session'), (result) => statusCheck(result, 401));

  const login = await runCheck(
    'PCN session login',
    () => request('/api/auth/pcn-session', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    }),
    (result) => jsonStatusCheck(
      result,
      200,
      (payload) => isRecord(payload) && payload.authenticated === true && isRecord(payload.user),
      'HTTP 200; authenticated=true',
    ),
  );

  if (login) {
    const dbHealth = await runCheck(
      'PCN database health',
      () => request('/api/db/health'),
      (result) => jsonStatusCheck(
        result,
        200,
        (payload) => isRecord(payload) && payload.status === 'ok' && payload.profile === 'pcn' && payload.databaseName === 'pcn_certification',
        'HTTP 200; profile=pcn; database=pcn_certification',
      ),
    );

    const customers = await runCheck('customer catalog', () => request('/api/db/customers'), (result) => statusCheck(result, 200));
    await runCheck(
      'PCN customer import preview boundary',
      () => request('/api/pcn/customer-import/preview', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceLabel: 'runtime-preview-smoke.csv',
          customers: [{ 'Mã khách hàng': '__PCN_RUNTIME_PREVIEW__', 'Tên khách hàng': 'Runtime preview' }],
        }),
      }),
      (result) => jsonStatusCheck(
        result,
        200,
        (payload) => isRecord(payload)
          && isRecord(payload.preview)
          && payload.preview.sourceCount === 1
          && payload.preview.acceptedCount === 1
          && typeof payload.preview.sourceHash === 'string'
          && /^[a-f0-9]{64}$/i.test(payload.preview.sourceHash),
        'HTTP 200; preview read-only and fingerprinted',
      ),
    );
    await runCheck(
      'PCN customer import apply guard',
      () => request('/api/pcn/customer-import/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          sourceLabel: 'runtime-preview-smoke.csv',
          customers: [{ 'Mã khách hàng': '__PCN_RUNTIME_PREVIEW__', 'Tên khách hàng': 'Runtime preview' }],
          expectedSourceHash: '',
          expectedTargetHashBefore: '',
          confirmation: '',
        }),
      }),
      (result) => ({
        ok: result.status === 409,
        detail: `HTTP ${result.status}; apply requires fresh fingerprint and confirmation`,
      }),
    );
    const fields = await runCheck('QC4/QC9/QC20 field catalog', () => request('/api/db/pcnCertificationFields'), (result) => statusCheck(result, 200));
    const users = await runCheck('PCN user catalog', () => request('/api/pcn/users'), (result) => statusCheck(result, 200));
    const departmentRoles = await runCheck('PCN department-role catalog', () => request('/api/pcn/department-roles'), (result) => statusCheck(result, 200));
    const documentRequirements = await runCheck(
      'PCN document requirements',
      () => request('/api/pcn/document-requirements'),
      (result) => jsonStatusCheck(
        result,
        200,
        (payload) => Object.entries(requiredStationRoutes).every(([requirementId, stationKey]) => {
          const requirement = getItems(payload).find((item): item is JsonRecord => isRecord(item) && item.id === requirementId);
          return Boolean(requirement && Array.isArray(requirement.stationKeys) && requirement.stationKeys.includes(stationKey));
        }),
        'HTTP 200; operational forms have station routing',
      ),
    );
    const dossiers = await runCheck('PCN dossier catalog', () => request('/api/db/certificationDossiers'), (result) => statusCheck(result, 200));
    const dossierItems = dossiers ? getItems(dossiers.payload) : [];
    const firstDossier = dossierItems.find((item): item is JsonRecord => isRecord(item) && typeof item.id === 'string');
    if (firstDossier) {
      await runCheck(
        'PCN document read-only preflight',
        () => request('/api/pcn/documents/generate', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ dossierId: firstDossier.id, kind: 'DOSSIER_COVER', dryRun: true, formats: ['DOCX'] }),
        }),
        (result) => jsonStatusCheck(
          result,
          200,
          (payload) => isRecord(payload)
            && isRecord(payload.context)
            && typeof payload.context.contextHash === 'string'
            && /^[a-f0-9]{64}$/i.test(payload.context.contextHash)
            && Array.isArray(payload.documents)
            && payload.documents.length === 0
            && Array.isArray(payload.activityLogs)
            && payload.activityLogs.length === 0,
          'HTTP 200; context preflight read-only',
        ),
      );
    } else {
      checks.push({ name: 'PCN document read-only preflight', ok: false, detail: 'NO_DOSSIER_RECORD' });
    }

    const settings = await runCheck(
      'PCN settings read boundary',
      () => request('/api/pcn/settings'),
      (result) => jsonStatusCheck(
        result,
        200,
        (payload) => isRecord(payload)
          && isRecord(payload.settings)
          && payload.settings.id === 'pcn-settings'
          && Array.isArray(payload.settings.fieldCodes)
          && payload.settings.fieldCodes.includes('QC20'),
        'HTTP 200; settings include QC20',
      ),
    );
    await runCheck(
      'PCN OCR boundary',
      () => request('/api/pcn/ocr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ context: 'proposal', fileName: 'invalid.txt', mimeType: 'text/plain', base64Data: 'aGVsbG8=' }),
      }),
      (result) => ({
        ok: result.status === 400,
        detail: `HTTP ${result.status}; OCR validates supported dossier files before processing`,
      }),
    );

    const backupList = await runCheck(
      'PCN backup catalog',
      () => request('/api/backups'),
      (result) => jsonStatusCheck(result, 200, (payload) => isRecord(payload) && Array.isArray(payload.items), 'HTTP 200; backup list readable'),
    );

    const backupItems = backupList ? getItems(backupList.payload) : [];
    const latestBackup = isRecord(backupItems[0]) && typeof backupItems[0].filename === 'string' ? backupItems[0] : undefined;
    let backupVerification: RequestResult | undefined;
    if (latestBackup) {
      const filename = String(latestBackup.filename);
      backupVerification = await runCheck(
        'latest PCN backup verification',
        () => request(`/api/backups/${encodeURIComponent(filename)}/verify`),
        (result) => jsonStatusCheck(
          result,
          200,
          (payload) => isRecord(payload) && payload.ok === true && payload.status === 'VALID',
          'HTTP 200; archive status=VALID',
        ),
      );
    } else {
      checks.push({ name: 'latest PCN backup verification', ok: false, detail: 'NO_BACKUP_ARCHIVE' });
    }

    const dbHealthPayload = dbHealth && isRecord(dbHealth.payload) ? dbHealth.payload : undefined;
    const customerItems = customers ? getItems(customers.payload).length : 0;
    const fieldItems = fields ? getItems(fields.payload).length : 0;
    const userItems = users && isRecord(users.payload) ? getItems(users.payload).length : 0;
    const roleItems = departmentRoles && isRecord(departmentRoles.payload) ? getItems(departmentRoles.payload).length : 0;
    const requirementItems = documentRequirements && isRecord(documentRequirements.payload) ? getItems(documentRequirements.payload).length : 0;
    const verificationPayload = backupVerification && isRecord(backupVerification.payload) ? backupVerification.payload : undefined;

    const summary = {
      checkedAt: new Date().toISOString(),
      baseUrl: baseUrl.toString(),
      profile: dbHealthPayload?.profile ?? null,
      database: dbHealthPayload?.databaseName ?? null,
      ok: checks.every((check) => check.ok),
      checks,
      catalogCounts: {
        customers: customerItems,
        certificationFields: fieldItems,
        users: userItems,
        departmentRoles: roleItems,
        documentRequirements: requirementItems,
        dossiers: dossierItems.length,
      },
      settings: settings && isRecord(settings.payload) ? settings.payload.settings : null,
      backup: latestBackup ? {
        filename: String(latestBackup.filename),
        status: verificationPayload?.status ?? null,
        ok: verificationPayload?.ok === true,
        manifestObjectCount: typeof verificationPayload?.manifestObjectCount === 'number' ? verificationPayload.manifestObjectCount : null,
        verifiedObjectCount: typeof verificationPayload?.verifiedObjectCount === 'number' ? verificationPayload.verifiedObjectCount : null,
        missingObjectCount: typeof verificationPayload?.missingObjectCount === 'number' ? verificationPayload.missingObjectCount : null,
        invalidObjectCount: typeof verificationPayload?.invalidObjectCount === 'number' ? verificationPayload.invalidObjectCount : null,
      } : null,
    };

    console.log(JSON.stringify(summary, null, 2));
    if (!summary.ok) process.exitCode = 1;
    return;
  }

  const summary = {
    checkedAt: new Date().toISOString(),
    baseUrl: baseUrl.toString(),
    profile: null,
    database: null,
    ok: false,
    checks,
    catalogCounts: null,
    settings: null,
    backup: null,
  };
  console.log(JSON.stringify(summary, null, 2));
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(`PCN runtime smoke thất bại: ${error instanceof Error ? error.message : 'RUNTIME_ERROR'}`);
  process.exitCode = 1;
});

// --- End of smokePcnRuntime.ts ---
