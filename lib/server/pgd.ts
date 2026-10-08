import { NextRequest, NextResponse } from 'next/server';
import { getPcnSessionUser } from './auth';
import { PcnUserAccount } from '@/types';
import { isPcnSystemManager } from '@/utils/pcnRbac';
import { getPgdCollectionMutationDenial, PGD_COLLECTIONS, PGD_DOMAIN } from '@/utils/pgdDomain';
import { jsonForbidden, jsonNotFound, jsonUnauthorized } from './response';
import { DATABASE_PROFILE } from './env';

export { PGD_COLLECTIONS, PGD_DOMAIN };

export function getPgdSessionUser(req: NextRequest | Request): PcnUserAccount | null {
  if (DATABASE_PROFILE !== 'pcn') return null;
  return getPcnSessionUser(req);
}

export function requirePgdSession(req: NextRequest | Request): NextResponse | null {
  if (DATABASE_PROFILE !== 'pcn') {
    return jsonNotFound('PGD chỉ khả dụng trong profile PGDCN.');
  }
  const user = getPgdSessionUser(req);
  if (!user) {
    return jsonUnauthorized('Phiên PGD không hợp lệ hoặc đã hết hạn.');
  }
  const isSystemManager = isPcnSystemManager(user);
  if (!isSystemManager && !user.departmentScopes?.includes('PGD')) {
    return jsonForbidden('Tài khoản chưa được cấp phạm vi PGD.');
  }
  return null;
}

export function requirePgdCollectionMutation(
  req: NextRequest | Request,
  collectionName: string,
  operation: 'write' | 'delete',
): NextResponse | null {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;
  const actor = getPgdSessionUser(req)!;
  const denial = getPgdCollectionMutationDenial(collectionName, actor.systemRole || actor.role, operation, actor);
  if (!denial) return null;
  const status = operation === 'delete' && denial.includes('append-only') ? 405 : 403;
  return jsonForbidden(denial, status);
}

export function requirePgdDossierManager(req: NextRequest | Request): NextResponse | null {
  const sessionError = requirePgdSession(req);
  if (sessionError) return sessionError;
  const actor = getPgdSessionUser(req);
  const isManager = Boolean(
    actor && (
      isPcnSystemManager(actor)
      || actor.pgdRole === 'PGD_ADMIN'
      || actor.pgdRole === 'PGD_MANAGER'
    )
  );
  if (!isManager) {
    return jsonForbidden('Chỉ Admin hoặc Quản lý PGD được phân công lại chủ hồ sơ.');
  }
  return null;
}

