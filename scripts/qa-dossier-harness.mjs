import { isAbsolute, relative, resolve, sep } from 'node:path';

export const DEFAULT_BASE_URL = 'http://127.0.0.1:1357';

const DOSSIER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/;

export function findListeningPids(netstatOutput, port) {
  const expectedPort = String(Number(port));
  if (!/^\d+$/.test(expectedPort) || Number(expectedPort) < 1 || Number(expectedPort) > 65535) return [];

  return [...new Set(String(netstatOutput || '').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)\s*$/i);
    return match && match[1].endsWith(`:${expectedPort}`) ? [match[2]] : [];
  }))];
}

export function selectBaseUrl(env = process.env) {
  const rawBaseUrl = String(env.PGDCN_UX_BASE_URL || '').trim();
  if (!rawBaseUrl) return DEFAULT_BASE_URL;

  let url;
  try {
    url = new URL(rawBaseUrl);
  } catch {
    throw new Error('PGDCN_UX_BASE_URL phải là một URL HTTP/HTTPS hợp lệ.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('PGDCN_UX_BASE_URL chỉ hỗ trợ HTTP hoặc HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('PGDCN_UX_BASE_URL không được chứa thông tin đăng nhập.');
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PGDCN_UX_BASE_URL chỉ hỗ trợ origin, không nhận path, query hoặc hash.');
  }

  return url.origin;
}

export function assertPcnAppFingerprint({ baseUrl, responseUrl, status, contentType = '', html = '' }) {
  const expected = new URL(baseUrl);
  let actual;
  try {
    actual = new URL(responseUrl);
  } catch {
    throw new Error(`Không xác định được origin phản hồi cho cổng QA ${expected.port || '(mặc định)'}.`);
  }

  if (actual.origin !== expected.origin) {
    throw new Error(`Origin/cổng phản hồi không khớp: đã chọn ${expected.origin}, nhưng GET / trả từ ${actual.origin}.`);
  }
  if (status < 200 || status >= 300) {
    throw new Error(`GET ${expected.origin}/ trả HTTP ${status}; không thể xác minh máy chủ QA.`);
  }

  const hasPgdcnTitle = /<title[^>]*>[^<]*TVCI[^<]*<\/title>/i.test(html);
  const hasVietnameseAppShell = /<html[^>]*\blang=["']vi["']/i.test(html)
    && /<div[^>]*\bid=["']root["']/i.test(html)
    && /\/_next\/static\//i.test(html);
  if (!String(contentType).toLowerCase().includes('text/html') || !hasPgdcnTitle || !hasVietnameseAppShell) {
    throw new Error(`Origin ${expected.origin} không phải giao diện PGDCN dự kiến (thiếu fingerprint HTML của TVCI/Next.js). Kiểm tra đúng process và cổng trước khi chạy QA.`);
  }

  return { origin: expected.origin, port: expected.port || (expected.protocol === 'https:' ? '443' : '80') };
}

export function resolveAuthentication(env = process.env) {
  const storageStatePath = String(env.PGDCN_QA_STORAGE_STATE || '').trim();
  if (storageStatePath) return { kind: 'storageState', path: storageStatePath };

  const username = String(env.PGDCN_QA_USERNAME || '').trim();
  const password = String(env.PGDCN_QA_PASSWORD || '');
  if (username && password) return { kind: 'credentials', username, password };
  if (username || password) {
    throw new Error('Đăng nhập UI cần cả PGDCN_QA_USERNAME và PGDCN_QA_PASSWORD.');
  }
  throw new Error('Cần phiên đăng nhập QA hợp lệ: đặt PGDCN_QA_STORAGE_STATE hoặc cả PGDCN_QA_USERNAME và PGDCN_QA_PASSWORD. Không có credential thì không chạy xác minh UI thật.');
}

export function assertAuthenticatedSession({ status, payload }, department) {
  if (status !== 200) {
    throw new Error(`GET /api/auth/pcn-session trả HTTP ${status}; cần phiên đăng nhập QA hợp lệ.`);
  }
  if (payload?.authenticated !== true || !payload.user || typeof payload.user !== 'object') {
    throw new Error('Phiên QA chưa xác thực. Đăng nhập bằng màn hình PGDCN hoặc cung cấp storage state Playwright đáng tin cậy.');
  }

  const user = payload.user;
  if (user.active === false) throw new Error('Tài khoản QA không hoạt động.');

  const scopes = Array.isArray(user.departmentScopes) ? user.departmentScopes : [];
  if (!scopes.includes(department)) {
    throw new Error(`Tài khoản đã đăng nhập nhưng không có scope ${department}; dùng phiên QA được cấp đúng phòng ban.`);
  }

  if (department === 'PGD') {
    const pgdRole = String(user.pgdRole || '').trim().toUpperCase();
    const managementRole = String(user.managementRoleCode || '').trim().toUpperCase();
    const systemRole = String(user.systemRole || user.role || '').trim().toLowerCase();
    const hasPgdRole = ['PGD_ADMIN', 'PGD_MANAGER', 'PGD_TECHNICAL', 'PGD_FIELD_INSPECTOR', 'PGD_DOCUMENT_CLERK', 'PGD_VIEWER'].includes(pgdRole);
    const hasOrganizationManagementRole = ['CENTER_DIRECTOR', 'CENTER_DEPUTY_DIRECTOR', 'DEPARTMENT_HEAD', 'DEPARTMENT_DEPUTY'].includes(managementRole);
    if (!hasPgdRole && !hasOrganizationManagementRole && systemRole !== 'admin') {
      throw new Error('Phiên PGD không có role PGD phù hợp; dùng tài khoản PGD hoặc quản lý được cấp phép.');
    }
    return pgdRole || managementRole || systemRole;
  }

  const role = String(user.departmentRoleCode || user.systemRole || user.role || '').trim();
  if (!role) throw new Error('Phiên PCN không có role hợp lệ.');
  return role;
}

export function collectDossierTargets(env = process.env) {
  const targets = [];
  const candidates = [
    ['PCN', env.PGDCN_QA_PCN_DOSSIER_ID, '/pgdcn/pcn/dossiers/'],
    ['PGD', env.PGDCN_QA_PGD_DOSSIER_ID, '/pgdcn/pgd/dossiers/'],
  ];

  for (const [department, rawId, route] of candidates) {
    const id = String(rawId || '').trim();
    if (!id) continue;
    if (!DOSSIER_ID_PATTERN.test(id)) {
      throw new Error(`Mã hồ sơ ${department} không an toàn; chỉ dùng chữ, số, dấu gạch ngang hoặc gạch dưới (tối đa 120 ký tự).`);
    }
    targets.push({ department, id, pathname: `${route}${encodeURIComponent(id)}` });
  }

  if (targets.length === 0) {
    throw new Error('Cần truyền ít nhất một mã hồ sơ QA qua PGDCN_QA_PCN_DOSSIER_ID hoặc PGDCN_QA_PGD_DOSSIER_ID.');
  }
  return targets;
}

export function assertDossierUiEvidence({ department, stageCount, documentPanel, documentRows = 0 }) {
  if (stageCount !== 7) {
    throw new Error(`${department} chỉ tìm thấy ${stageCount}/7 giai đoạn trên trang hồ sơ.`);
  }
  if (!documentPanel || (department === 'PCN' && documentRows < 1)) {
    throw new Error(`${department} không thấy bảng thao tác tài liệu mong đợi trên trang hồ sơ.`);
  }
  return { department, stageCount, documentRows };
}

export function assertPathOutsideRepository(path, repositoryRoot, purpose) {
  const resolvedPath = resolve(path);
  const resolvedRoot = resolve(repositoryRoot);
  const pathFromRoot = relative(resolvedRoot, resolvedPath);
  const isInside = pathFromRoot === ''
    || (!isAbsolute(pathFromRoot) && pathFromRoot !== '..' && !pathFromRoot.startsWith(`..${sep}`));
  if (isInside) {
    throw new Error(`Đường dẫn ${purpose} phải nằm ngoài repo để tránh ghi/commit nhầm dữ liệu nhạy cảm.`);
  }
  return resolvedPath;
}
