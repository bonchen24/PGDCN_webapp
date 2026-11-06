import { PGD_DOMAIN, type PgdAssessmentRound } from './pgdDomain.ts';

export function createPgdAssessmentRound(input: {
  id: string;
  requestId: string;
  openedByUsername: string;
  existingRounds?: readonly PgdAssessmentRound[];
  reason?: string;
}, now = new Date().toISOString()): PgdAssessmentRound {
  const id = String(input.id || '').trim();
  const requestId = String(input.requestId || '').trim();
  const openedByUsername = String(input.openedByUsername || '').trim();
  if (!id || !requestId || !openedByUsername) throw new Error('Đợt đánh giá cần mã hồ sơ, mã đợt và người mở.');
  const rounds = input.existingRounds || [];
  if (rounds.some((round) => round.requestId === requestId && round.status === 'OPEN')) {
    throw new Error('Hãy đóng đợt đánh giá hiện tại trước khi mở đợt tiếp theo.');
  }
  const sequence = rounds.filter((round) => round.requestId === requestId).reduce((maximum, round) => Math.max(maximum, round.sequence), 0) + 1;
  return {
    id,
    domain: PGD_DOMAIN,
    requestId,
    sequence,
    label: `Đợt đánh giá ${sequence}`,
    status: 'OPEN',
    openedAt: now,
    openedByUsername,
    ...(String(input.reason || '').trim() ? { reason: String(input.reason).trim() } : {}),
  };
}

export function closePgdAssessmentRound(
  round: PgdAssessmentRound,
  input: { closedByUsername: string; outcome: NonNullable<PgdAssessmentRound['outcome']> },
  now = new Date().toISOString(),
): PgdAssessmentRound {
  if (round.status !== 'OPEN') throw new Error('Đợt đánh giá đã đóng.');
  const closedByUsername = String(input.closedByUsername || '').trim();
  if (!closedByUsername) throw new Error('Cần ghi nhận người đóng đợt đánh giá.');
  return { ...round, status: 'CLOSED', outcome: input.outcome, closedAt: now, closedByUsername };
}
