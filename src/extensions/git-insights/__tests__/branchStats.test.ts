import { describe, expect, it } from "vitest";
import { countActiveBranches } from "../lib/branchStats";
import type { BranchHealthInfo } from "../types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 2, 12, 0, 0);

function branch(
  name: string,
  ageDays: number,
  isRemote = false,
): BranchHealthInfo {
  return {
    name,
    isHead: name === "dev",
    isRemote,
    lastCommitDate: "2026-09-02",
    lastCommitTimestampMs: NOW - ageDays * DAY,
    lastCommitMessage: "",
    ahead: 0,
    behind: 0,
    isStale: ageDays > 30,
    isMerged: null,
  };
}

describe("countActiveBranches", () => {
  it("excludes remote-tracking branches", () => {
    const branches = [
      branch("dev", 0),
      branch("origin/dev", 0, true),
      branch("origin/main", 0, true),
    ];
    expect(countActiveBranches(branches, 30, NOW)).toBe(1);
  });

  it("only counts branches with a commit inside the time window", () => {
    const branches = [
      branch("dev", 0),
      branch("recent", 6),
      branch("edge", 7),
      branch("old", 8),
      branch("ancient", 120),
    ];
    expect(countActiveBranches(branches, 7, NOW)).toBe(3);
    expect(countActiveBranches(branches, 30, NOW)).toBe(4);
    expect(countActiveBranches(branches, 90, NOW)).toBe(4);
  });

  it("returns 0 for an empty list", () => {
    expect(countActiveBranches([], 30, NOW)).toBe(0);
  });
});
