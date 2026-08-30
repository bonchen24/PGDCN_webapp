import type { UserAccount } from '../types.ts';
import { getUserFullName, normalizeUserKey } from './userIdentity.ts';

export const PCN_NEUTRAL_USER_LABEL = 'Người dùng hệ thống';

function clean(value: unknown): string {
  return String(value ?? '').trim();
}
function findUser(value: unknown, users: readonly UserAccount[]): UserAccount | undefined {
  const key = normalizeUserKey(value);
  if (!key) return undefined;
  return users.find((user) => normalizeUserKey(user.username) === key)
    || users.find((user) => normalizeUserKey(user.name) === key);
}

/** Resolve an internal PCN assignment key to a display-only human name. */
export function getPcnUserDisplayName(
  username: unknown,
  users: readonly UserAccount[] = [],
): string {
  const user = findUser(username, users);
  return user ? getUserFullName(user, PCN_NEUTRAL_USER_LABEL) : PCN_NEUTRAL_USER_LABEL;
}

/** Resolve an activity actor while refusing to render an unmapped username. */
export function getPcnActorDisplayName(
  actorName: unknown,
  actorUsername: unknown,
  users: readonly UserAccount[] = [],
): string {
  const actorUser = findUser(actorUsername, users) || findUser(actorName, users);
  if (actorUser) return getUserFullName(actorUser, PCN_NEUTRAL_USER_LABEL);

  const name = clean(actorName);
  const usernameKey = normalizeUserKey(actorUsername);
  if (name && (!usernameKey || normalizeUserKey(name) !== usernameKey)) return name;
  return PCN_NEUTRAL_USER_LABEL;
}
