import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { EnrichedBranch } from "../../../../core/lib/branchClassifier";
import { BranchItem } from "../BranchItem";

vi.mock("../../../../bindings", () => ({
  commands: {
    getBranchAheadBehind: vi
      .fn()
      .mockResolvedValue({ status: "ok", data: { ahead: 0, behind: 0 } }),
  },
}));

vi.mock("@/core/services/gitHookBus", () => ({
  gitHookBus: { onDid: vi.fn(() => () => {}) },
}));

vi.mock("@/framework/extension-system/contextMenuRegistry", () => ({
  useContextMenuRegistry: { getState: () => ({ showMenu: vi.fn() }) },
}));

function makeBranch(overrides: Partial<EnrichedBranch> = {}): EnrichedBranch {
  return {
    name: "feature/login",
    isHead: false,
    isRemote: false,
    isMerged: false,
    lastCommitOid: "abc1234",
    lastCommitMessage: "feat: login",
    remoteName: null,
    branchType: "feature",
    isPinned: false,
    lastVisited: null,
    ...overrides,
  };
}

function renderItem(branch: EnrichedBranch) {
  return render(
    <BranchItem
      branch={branch}
      onCheckout={vi.fn()}
      onDelete={vi.fn()}
      onMerge={vi.fn()}
      onTogglePin={vi.fn()}
    />,
  );
}

describe("BranchItem row layout", () => {
  it("gives the branch name priority in the row and a full-name tooltip", () => {
    renderItem(
      makeBranch({
        name: "origin/feature/login",
        isRemote: true,
        remoteName: "origin",
      }),
    );

    const name = screen.getByTestId("branch-name");
    expect(name).toHaveAttribute("title", "origin/feature/login");
    expect(name).toHaveClass("flex", "min-w-0", "flex-1");
    expect(screen.getByTestId("branch-name-prefix")).toHaveClass("truncate");
    expect(screen.getByTestId("branch-name-leaf")).toHaveClass("truncate");
    expect(screen.getByTestId("branch-name-leaf")).toHaveTextContent("login");
  });

  it("renders the type as a compact non-shrinking dot instead of a text pill", () => {
    renderItem(makeBranch());

    const dot = screen.getByTestId("branch-type-dot");
    expect(dot).toHaveClass("shrink-0");
    expect(dot).toHaveAttribute("title", "feature branch");
    // The name already says "feature/…" — no redundant "feature" text pill.
    expect(screen.queryByText("feature")).not.toBeInTheDocument();
  });

  it("keeps a compact, non-shrinking merged badge", () => {
    renderItem(makeBranch({ isMerged: true }));

    const merged = screen.getByTestId("branch-merged-badge");
    expect(merged).toHaveTextContent("merged");
    expect(merged).toHaveClass("shrink-0");
  });

  it("does not reserve room for hover actions while idle", () => {
    renderItem(makeBranch());

    const actions = screen.getByTestId("branch-actions");
    expect(actions).toHaveClass(
      "shrink-0",
      "max-w-0",
      "overflow-hidden",
      "group-hover/item:max-w-none",
      "group-focus-within/item:max-w-none",
    );
    // Actions stay in the DOM (and tab order) — only their width collapses.
    expect(screen.getByTitle("Switch to branch")).toBeInTheDocument();
  });
});
