'use client';

import { useState } from 'react';

import type { CertificationDossier, PcnUserAccount, UserAccount } from '../types';
import {
  getPcnAssignableDossierUsers,
  getPcnDossierAssignmentDenial,
  getPcnOwnerAssignmentAuthorityDenial,
  isPcnDossierAssignmentManager,
} from '../utils/pcnDossierAssignment';
import { getPcnUserDisplayName } from '../utils/pcnUserIdentity';
import DossierOwnerAssignmentPicker from './DossierOwnerAssignmentPicker';

export type PcnDossierAssignmentControlProps = {
  dossier: Pick<CertificationDossier, 'id' | 'dossierCode' | 'fieldCodes' | 'ownerUsername'>;
  users: PcnUserAccount[];
  currentUser: UserAccount | null;
  onAssign?: (ownerUsername: string) => Promise<void>;
  onClaim?: () => Promise<void>;
  claimDenial?: string | null;
  disabled?: boolean;
  compact?: boolean;
};

export function PcnDossierAssignmentControl({
  dossier,
  users,
  currentUser,
  onAssign,
  onClaim,
  claimDenial,
  disabled = false,
  compact = false,
}: PcnDossierAssignmentControlProps) {
  const [saving, setSaving] = useState(false);
  const ownerUsername = String(dossier.ownerUsername || '').trim();
  const canManageAssignment = isPcnDossierAssignmentManager(currentUser) && Boolean(onAssign);
  const isViewer = [currentUser?.systemRole, currentUser?.role]
    .some((role) => String(role || '').trim().toLowerCase() === 'viewer');
  const assignableUsers = getPcnAssignableDossierUsers(dossier.fieldCodes, users);
  const assignmentOptions = assignableUsers.map((user) => ({
    username: user.username,
    displayName: getPcnUserDisplayName(user.username, users),
    searchText: [user.username, user.name, user.position, user.departmentRoleCode, user.systemRole].filter(Boolean).join(' '),
    description: [user.position, user.username].filter(Boolean).join(' · '),
  }));

  const resolvedClaimDenial = claimDenial ?? (!currentUser
    ? 'Chưa xác định người dùng hiện tại.'
    : getPcnOwnerAssignmentAuthorityDenial({
      currentUsername: ownerUsername,
      nextUsername: currentUser.username,
      actorUsername: currentUser.username,
      actorSystemRole: currentUser.systemRole || currentUser.role,
      actorManagementRoleCode: currentUser.managementRoleCode,
      actorDepartmentRoleCode: currentUser.departmentRoleCode,
    }) || getPcnDossierAssignmentDenial({
      assignmentLabel: 'Người thực hiện',
      currentUsername: ownerUsername,
      nextUsername: currentUser.username,
      dossierFieldCodes: dossier.fieldCodes,
      users,
    }));

  const saveAssignment = async (nextUsername: string) => {
    if (!onAssign || !currentUser || !canManageAssignment || saving || disabled) {
      throw new Error('Bạn không thể phân công hồ sơ lúc này.');
    }
    const denial = getPcnOwnerAssignmentAuthorityDenial({
      currentUsername: ownerUsername,
      nextUsername,
      actorUsername: currentUser.username,
      actorSystemRole: currentUser.systemRole || currentUser.role,
      actorManagementRoleCode: currentUser.managementRoleCode,
      actorDepartmentRoleCode: currentUser.departmentRoleCode,
    }) || getPcnDossierAssignmentDenial({
      assignmentLabel: 'Người thực hiện',
      currentUsername: ownerUsername,
      nextUsername,
      dossierFieldCodes: dossier.fieldCodes,
      users,
    });
    if (denial) throw new Error(denial);
    await onAssign(nextUsername);
  };

  const claim = async () => {
    if (!onClaim || saving || disabled || ownerUsername || resolvedClaimDenial) return;
    setSaving(true);
    try {
      await onClaim();
    } finally {
      setSaving(false);
    }
  };

  if (canManageAssignment) {
    return (
      <div data-testid="pcn-dossier-assignment-control" className={compact ? 'min-w-0' : 'mt-3'}>
        <DossierOwnerAssignmentPicker
          ownerUsername={ownerUsername}
          ownerDisplayName={getPcnUserDisplayName(ownerUsername, users)}
          canAssign={canManageAssignment}
          compact={compact}
          unassignedLabel="Chưa phân công"
          assignLabel="Giao hồ sơ"
          transferLabel="Đổi người"
          confirmAssignLabel="Xác nhận giao hồ sơ"
          confirmTransferLabel="Xác nhận đổi người"
          onAssign={saveAssignment}
          options={assignmentOptions}
          disabled={disabled || saving}
        />
        {!compact && <p className="mt-1 text-[9px] text-emerald-700">Quản trị viên/Quản lý chọn nhân viên đang hoạt động trong phòng và đúng phạm vi lĩnh vực.</p>}
      </div>
    );
  }

  return (
    <div data-testid="pcn-dossier-assignment-control" className={compact ? 'min-w-0 flex-1' : 'mt-3'}>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex min-h-8 items-center rounded-full border px-2 py-1 text-[10px] font-black ${ownerUsername ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-800'}`} title={ownerUsername ? 'Chỉ người được gắn tên hoặc Quản trị viên/Quản lý được thao tác hồ sơ.' : 'Hồ sơ đang chờ nhân viên trong phòng tự nhận hoặc được Quản trị viên/Quản lý phân công.'}>
          {ownerUsername ? `Người thực hiện: ${getPcnUserDisplayName(ownerUsername, users)}` : 'Chưa phân công'}
        </span>
        {!ownerUsername && onClaim && currentUser && !isViewer && (
          <button
            type="button"
            onClick={() => { void claim().catch(() => undefined); }}
            disabled={disabled || saving || Boolean(resolvedClaimDenial)}
            title={resolvedClaimDenial || 'Tự gán tên mình vào hồ sơ'}
            className="min-h-10 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1.5 text-[10px] font-black text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Đang nhận…' : 'Nhận hồ sơ'}
          </button>
        )}
      </div>
      {!ownerUsername && !onClaim && <p className="mt-1 text-[9px] text-slate-500">Chờ Quản trị viên/Quản lý phân công hoặc nhân viên trong phòng nhận hồ sơ.</p>}
      {ownerUsername && currentUser && ownerUsername.toLowerCase() !== currentUser.username.trim().toLowerCase() && <p className="mt-1 text-[9px] text-slate-500">Hồ sơ đã gắn người khác; bạn chỉ được thao tác hồ sơ đã gắn tên mình.</p>}
    </div>
  );
}

export default PcnDossierAssignmentControl;
