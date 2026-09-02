import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BranchInfo } from "../../../../bindings";
import { BranchSwitcherItem } from "../BranchSwitcherItem";

function makeBranch(overrides: Partial<BranchInfo> = {}): BranchInfo {
  return {
    name: "origin/feature/search",
    isHead: false,
    isRemote: true,
    isMerged: false,
    lastCommitOid: "abc1234",
    lastCommitMessage: "feat: search",
    remoteName: "origin",
    ...overrides,
  };
}

function renderItem(branch: BranchInfo) {
  return render(
    <BranchSwitcherItem
      branch={branch}
      isCurrent={false}
      isHighlighted={false}
      onSelect={vi.fn()}
    />,
  );
}

describe("BranchSwitcherItem row layout", () => {
  it("lets the name fill the row and exposes the full name as a tooltip", () => {
    renderItem(makeBranch());

    const name = screen.getByTestId("branch-name");
    expect(name).toHaveAttribute("title", "origin/feature/search");
    expect(name).toHaveClass("flex", "min-w-0", "flex-1");
    expect(screen.getByTestId("branch-name-prefix")).toHaveClass("truncate");
    expect(screen.getByTestId("branch-name-leaf")).toHaveTextContent("search");
  });

  it("keeps the remote badge and commit hash from shrinking", () => {
    renderItem(makeBranch());

    expect(screen.getByText("remote")).toHaveClass("shrink-0");
    expect(screen.getByText("abc1234")).toHaveClass("shrink-0");
  });
});
