export const ASSIGNMENT_STATUS = {
  CANDIDATE: "candidate",
  COMMITTED: "committed",
  DRAFT: "draft",
} as const;

export function sumTargetJp(rows: Array<{ targetJp: number }>): number {
  return rows.reduce((sum, row) => sum + Number(row.targetJp || 0), 0);
}

export function sumAssignedJp(rows: Array<{ jpPerMinggu: number }>): number {
  return rows.reduce((sum, row) => sum + Number(row.jpPerMinggu || 0), 0);
}

export function remainingJp(targetJp: number, scheduledJp: number): number {
  return Math.max(0, Number(targetJp || 0) - Number(scheduledJp || 0));
}

export function progressPercent(targetJp: number, scheduledJp: number): number {
  const target = Number(targetJp || 0);
  if (target <= 0) return 0;
  return Math.round((Number(scheduledJp || 0) / target) * 100);
}

/** Official schedule metric: only committed assignments count as scheduled. */
export function isCommittedStatus(status: string): boolean {
  return status === ASSIGNMENT_STATUS.COMMITTED;
}

/** Pending proposal metric: candidate assignments are never treated as official schedule. */
export function isCandidateStatus(status: string): boolean {
  return status === ASSIGNMENT_STATUS.CANDIDATE;
}
