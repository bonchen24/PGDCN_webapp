'use client';

import { useMemo } from 'react';
import type { PcnUserAccount } from '../types';
import { isPgdSystemManager, type PgdMutationUser } from '../utils/pgdDomain';
import DossierOwnerAssignmentPicker, { type DossierOwnerAssignmentOption } from './DossierOwnerAssignmentPicker';

export function canAssignPgdDossierOwner(user?: PgdMutationUser | null): boolean {
  if (!user) return false;
  const roles = [user.systemRole, user.role].map((role) => String(role || '').trim().toLowerCase());
  const pgdRole = String(user.pgdRole || '').trim().toUpperCase();
  if (roles.includes('viewer') || pgdRole === 'PGD_VIEWER') return false;

  const isSystemManager = isPgdSystemManager(user);
  const hasPgdScope = (user.departmentScopes || []).some((scope) => String(scope).trim().toUpperCase() === 'PGD');
  const isPgdRoleManager = ['PGD_ADMIN', 'PGD_MANAGER'].includes(pgdRole);
  return isSystemManager || (hasPgdScope && isPgdRoleManager);
}

export function getPgdOwnerAssignmentCandidates(users: readonly PcnUserAccount[]): DossierOwnerAssignmentOption[] {
  return users
    .filter((user) => {
      const roles = [user.systemRole, user.role].map((role) => String(role || '').trim().toLowerCase());
      const pgdRole = String(user.pgdRole || '').trim().toUpperCase();
      const hasPgdScope = (user.departmentScopes || []).some((scope) => String(scope).trim().toUpperCase() === 'PGD');
      return Boolean(user.active) && hasPgdScope && !roles.includes('viewer') && pgdRole !== 'PGD_VIEWER';
    })
    .map((user) => {
      const displayName = String(user.name || '').trim() || user.username;
      const metadata = [user.position, user.departmentRoleCode, user.pgdRole, user.managementRoleCode, user.systemRole || user.role]
        .filter(Boolean)
        .join(' ');
      return {
        username: user.username,
        displayName,
        searchText: `${displayName} ${user.username} ${metadata}`,
        description: [metadata, user.username].filter(Boolean).join(' · '),
      };
    });
}

export type PgdDossierAssignmentControlProps = {
  requestId: string;
  ownerUsername?: string;
  ownerDisplayName?: string;
  users: readonly PcnUserAccount[];
  currentUser?: PgdMutationUser | null;
  onAssignOwner?: (requestId: string, ownerUsername: string) => Promise<unknown>;
  canAssign?: boolean;
  disabled?: boolean;
  compact?: boolean;
  unassignedLabel?: string;
};

export default function PgdDossierAssignmentControl({
  requestId,
  ownerUsername,
  ownerDisplayName,
  users,
  currentUser,
  onAssignOwner,
  canAssign: explicitPermission,
  disabled = false,
  compact = false,
  unassignedLabel,
}: PgdDossierAssignmentControlProps) {
  const options = useMemo(() => getPgdOwnerAssignmentCandidates(users), [users]);
  const canAssign = Boolean(onAssignOwner) && (explicitPermission ?? canAssignPgdDossierOwner(currentUser));
  const normalizedOwner = String(ownerUsername || '').trim();
  const resolvedOwnerName = ownerDisplayName || users.find((user) => user.username.trim().toLowerCase() === normalizedOwner.toLowerCase())?.name || normalizedOwner;

  return (
    <DossierOwnerAssignmentPicker
      options={options}
      ownerUsername={normalizedOwner}
      ownerDisplayName={resolvedOwnerName}
      canAssign={canAssign}
      disabled={disabled}
      compact={compact}
      unassignedLabel={unassignedLabel}
      assignLabel="Giao hồ sơ"
      transferLabel="Đổi người"
      confirmAssignLabel="Xác nhận giao hồ sơ"
      confirmTransferLabel="Xác nhận đổi người"
      onAssign={async (username) => {
        if (!onAssignOwner) throw new Error('Thao tác giao hồ sơ chưa sẵn sàng. Vui lòng thử lại sau.');
        await onAssignOwner(requestId, username);
      }}
    />
  );
}
