import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RepoStatsCards } from "../components/RepoStatsCards";
import { countActiveBranches } from "../lib/branchStats";
import type { BranchHealthInfo, RepoInsights } from "../types";

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 8, 2, 12, 0, 0);

function branch(
  name: string,
  overrides: Partial<BranchHealthInfo> = {},
): BranchHealthInfo {
  return {
    name,
    isHead: false,
    isRemote: false,
    lastCommitDate: "2026-09-02",
    lastCommitTimestampMs: NOW,
    lastCommitMessage: "work",
    ahead: 0,
    behind: 0,
    isStale: false,
    isMerged: false,
    ...overrides,
  };
}

const insights: RepoInsights = {
  totalCommits: 14,
  activeBranches: 12,
  contributorCount: 1,
  firstCommitMs: NOW - 3 * DAY,
  dailyCommits: [{ date: "2026-09-02", count: 14 }],
  contributors: [],
};

// 6 local branches (one stale, outside the 30-day window), 5 remote-tracking
// duplicates, and origin/HEAD is already filtered out by the backend.
const branches: BranchHealthInfo[] = [
  branch("dev", { isHead: true }),
  branch("main"),
  branch("feature/a"),
  branch("feature/b"),
  branch("feature/c"),
  branch("old/stale", {
    lastCommitTimestampMs: NOW - 45 * DAY,
    isStale: true,
  }),
  branch("origin/dev", { isRemote: true }),
  branch("origin/main", { isRemote: true }),
  branch("origin/feature/a", { isRemote: true }),
  branch("origin/feature/b", { isRemote: true }),
  branch("origin/feature/c", { isRemote: true }),
];

describe("RepoStatsCards", () => {
  it("shows the number of local branches active in the time range, not every ref", () => {
    const branchCount = countActiveBranches(branches, 30, NOW);
    expect(branchCount).toBe(5);

    render(
      <RepoStatsCards
        insights={insights}
        branchCount={branchCount}
        timeRange={30}
        isLoading={false}
      />,
    );

    const card = screen.getByTestId("stat-card-active-branches");
    expect(card).toHaveTextContent("Active Branches");
    expect(card).toHaveTextContent("5");
    expect(card).not.toHaveTextContent("11");
    expect(card).toHaveAttribute(
      "title",
      expect.stringContaining("last 30 days"),
    );
  });

  it("shows the total commit count from insights", () => {
    render(
      <RepoStatsCards
        insights={insights}
        branchCount={5}
        timeRange={30}
        isLoading={false}
      />,
    );

    expect(screen.getByTestId("stat-card-total-commits")).toHaveTextContent(
      "14",
    );
  });

  it("shows placeholders while loading", () => {
    render(
      <RepoStatsCards
        insights={null}
        branchCount={0}
        timeRange={7}
        isLoading={true}
      />,
    );

    const card = screen.getByTestId("stat-card-active-branches");
    expect(card).toHaveTextContent("—");
  });
});
