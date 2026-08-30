import type { PcnSignerDelegation, PcnUserAccount } from '../types.ts';

export type PcnSignerMode = 'DIRECT' | 'DELEGATED' | 'NONE';

export interface PcnSignerAuthorizationInput {
  signerUsername: string;
  fieldCodes: string[];
  issuedAt: string;
  users: PcnUserAccount[];
  delegations: PcnSignerDelegation[];
}

export interface PcnSignerAuthorization {
  authorized: boolean;
  mode: PcnSignerMode;
  reason: string;
  user?: PcnUserAccount;
  delegation?: PcnSignerDelegation;
}

export interface PcnAuthorizedSignerOption {
  username: string;
  name: string;
  mode: Exclude<PcnSignerMode, 'NONE'>;
  delegationId?: string;
  validUntil?: string;
}

function normalizeUsername(value: string | undefined): string {
  return String(value || '').trim().toLocaleLowerCase('vi-VN');
}

function hasFieldScope(user: PcnUserAccount, fieldCodes: string[]): boolean {
  const requested = new Set(fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean));
  const assigned = (user.fieldCodes || []).map((code) => String(code).trim().toUpperCase()).filter(Boolean);
  return requested.size > 0 && assigned.some((code) => requested.has(code));
}

function isValidDateRange(delegation: PcnSignerDelegation, issuedAt: number): boolean {
  const effectiveFrom = Date.parse(delegation.effectiveFrom);
  const effectiveUntil = Date.parse(delegation.effectiveUntil);
  return Number.isFinite(effectiveFrom) && Number.isFinite(effectiveUntil) && effectiveFrom <= issuedAt && issuedAt <= effectiveUntil;
}

export function getPcnSignerAuthorization(input: PcnSignerAuthorizationInput): PcnSignerAuthorization {
  const signerUsername = normalizeUsername(input.signerUsername);
  const requestedFields = input.fieldCodes.map((code) => String(code).trim().toUpperCase()).filter(Boolean);
  const usersByUsername = new Map(input.users.map((user) => [normalizeUsername(user.username), user]));
  const signer = usersByUsername.get(signerUsername);
  if (!signerUsername || !signer) return { authorized: false, mode: 'NONE', reason: 'Người ký không tồn tại trong danh mục nhân sự PCN.' };
  if (!signer.active) return { authorized: false, mode: 'NONE', reason: 'Tài khoản người ký đã bị khóa hoặc không còn hoạt động.' };
  if (signer.systemRole === 'viewer' || signer.role === 'viewer') return { authorized: false, mode: 'NONE', reason: 'Tài khoản chỉ xem không được làm người ký.' };
  if (!hasFieldScope(signer, requestedFields)) return { authorized: false, mode: 'NONE', reason: 'Người ký chưa được phân công đúng Lĩnh vực của hồ sơ.' };
  const issuedAt = Date.parse(input.issuedAt);
  if (!Number.isFinite(issuedAt)) return { authorized: false, mode: 'NONE', reason: 'Ngày cấp không hợp lệ để kiểm tra thời hạn ủy quyền.' };

  if (signer.departmentRoleCode === 'LEADERSHIP') {
    return { authorized: true, mode: 'DIRECT', reason: 'Người ký trực tiếp thuộc danh mục lãnh đạo PCN.', user: signer };
  }

  const candidateDelegation = input.delegations
    .filter((delegation) => delegation.status === 'ACTIVE' && normalizeUsername(delegation.delegateUsername) === signerUsername)
    .sort((left, right) => Date.parse(right.effectiveUntil) - Date.parse(left.effectiveUntil))
    .find((delegation) => {
      const grantor = usersByUsername.get(normalizeUsername(delegation.grantorUsername));
      const approver = usersByUsername.get(normalizeUsername(delegation.approvedByUsername));
      const delegationFields = delegation.fieldCodes.map((code) => String(code).trim().toUpperCase());
      const fieldMatches = delegationFields.some((code) => requestedFields.includes(code));
      return Boolean(
        grantor?.active
        && grantor.departmentRoleCode === 'LEADERSHIP'
        && approver?.active
        && approver.systemRole === 'admin'
        && hasFieldScope(signer, delegationFields)
        && fieldMatches
        && isValidDateRange(delegation, issuedAt),
      );
    });

  if (candidateDelegation) {
    return { authorized: true, mode: 'DELEGATED', reason: 'Người ký được ủy quyền hợp lệ trong thời hạn và Lĩnh vực của hồ sơ.', user: signer, delegation: candidateDelegation };
  }
  return { authorized: false, mode: 'NONE', reason: 'Không có ủy quyền người ký hợp lệ cho tài khoản, Lĩnh vực hoặc thời điểm cấp số.', user: signer };
}

export function getPcnAuthorizedSignerOptions(input: Omit<PcnSignerAuthorizationInput, 'signerUsername'>): PcnAuthorizedSignerOption[] {
  const options: PcnAuthorizedSignerOption[] = [];
  for (const user of input.users) {
    const authorization = getPcnSignerAuthorization({ ...input, signerUsername: user.username });
    if (!authorization.authorized || authorization.mode === 'NONE') continue;
    options.push({
      username: user.username,
      name: user.name,
      mode: authorization.mode,
      ...(authorization.delegation ? { delegationId: authorization.delegation.id, validUntil: authorization.delegation.effectiveUntil } : {}),
    });
  }
  return options.sort((left, right) => {
    const modeCompare = Number(left.mode !== 'DIRECT') - Number(right.mode !== 'DIRECT');
    return modeCompare || left.name.localeCompare(right.name, 'vi');
  });
}

export function assertPcnSignerAuthorized(input: PcnSignerAuthorizationInput): PcnSignerAuthorization {
  const result = getPcnSignerAuthorization(input);
  if (!result.authorized) throw new Error(result.reason);
  return result;
}

// --- End of pcnSignerAuthorization.ts ---
