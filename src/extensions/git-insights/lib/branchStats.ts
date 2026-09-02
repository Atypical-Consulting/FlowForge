import type { BranchHealthInfo } from "../types";

const MS_PER_DAY = 86_400_000;

/**
 * Counts the branches that are "active" for the insights dashboard: local
 * branches (remote-tracking refs such as `origin/dev` duplicate their local
 * counterpart and are excluded) whose tip commit falls inside the selected
 * time window.
 */
export function countActiveBranches(
  branches: BranchHealthInfo[],
  days: number,
  now: number = Date.now(),
): number {
  const cutoff = now - days * MS_PER_DAY;
  return branches.filter(
    (branch) => !branch.isRemote && branch.lastCommitTimestampMs >= cutoff,
  ).length;
}
