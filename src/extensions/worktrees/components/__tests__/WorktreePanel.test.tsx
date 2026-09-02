import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWorktreeInfo, ok } from "@/core/test-utils/mocks/tauri-commands";

const mockCommands = vi.hoisted(() => ({
  listWorktrees: vi.fn(),
}));

vi.mock("../../../../bindings", () => ({ commands: mockCommands }));

import { gitHookBus } from "@/core/services/gitHookBus";
import { useGitOpsStore } from "../../../../core/stores/domain/git-ops";
import { WorktreePanel } from "../WorktreePanel";

function mainWorktreeOn(branch: string) {
  return ok([createWorktreeInfo({ name: "flowforge", branch, isMain: true })]);
}

describe("WorktreePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommands.listWorktrees.mockResolvedValue(
      mainWorktreeOn("feature/ui-test"),
    );
  });

  it("loads the worktree list on mount", async () => {
    render(<WorktreePanel onOpenDeleteDialog={vi.fn()} />);

    expect(await screen.findByText("feature/ui-test")).toBeInTheDocument();
    expect(mockCommands.listWorktrees).toHaveBeenCalledTimes(1);
  });

  it("reloads on the checkout hook so the main worktree row follows HEAD", async () => {
    render(<WorktreePanel onOpenDeleteDialog={vi.fn()} />);
    expect(await screen.findByText("feature/ui-test")).toBeInTheDocument();

    mockCommands.listWorktrees.mockResolvedValue(mainWorktreeOn("develop"));
    await act(async () => {
      await gitHookBus.emitDid("checkout", { branchName: "develop" });
    });

    expect(await screen.findByText("develop")).toBeInTheDocument();
    expect(screen.queryByText("feature/ui-test")).not.toBeInTheDocument();
    expect(mockCommands.listWorktrees).toHaveBeenCalledTimes(2);
  });

  it("reloads when a branch is created (it may have been checked out)", async () => {
    render(<WorktreePanel onOpenDeleteDialog={vi.fn()} />);
    expect(await screen.findByText("feature/ui-test")).toBeInTheDocument();

    mockCommands.listWorktrees.mockResolvedValue(mainWorktreeOn("feature/new"));
    await act(async () => {
      await gitHookBus.emitDid("branch-create", { branchName: "feature/new" });
    });

    expect(await screen.findByText("feature/new")).toBeInTheDocument();
  });

  it("stops listening once unmounted", async () => {
    const { unmount } = render(<WorktreePanel onOpenDeleteDialog={vi.fn()} />);
    expect(await screen.findByText("feature/ui-test")).toBeInTheDocument();
    unmount();

    await act(async () => {
      await gitHookBus.emitDid("checkout", { branchName: "develop" });
    });

    expect(mockCommands.listWorktrees).toHaveBeenCalledTimes(1);
  });

  it("keeps the header badge count in sync with the reloaded list", async () => {
    render(<WorktreePanel onOpenDeleteDialog={vi.fn()} />);
    expect(await screen.findByText("feature/ui-test")).toBeInTheDocument();
    expect(useGitOpsStore.getState().worktreeList).toHaveLength(1);

    mockCommands.listWorktrees.mockResolvedValue(
      ok([
        createWorktreeInfo({ name: "flowforge", branch: "develop" }),
        createWorktreeInfo({
          name: "hotfix",
          path: "/test/hotfix",
          branch: "hotfix/1.0.1",
          isMain: false,
        }),
      ]),
    );
    await act(async () => {
      await gitHookBus.emitDid("checkout", { branchName: "develop" });
    });

    expect(await screen.findByText("hotfix/1.0.1")).toBeInTheDocument();
    expect(useGitOpsStore.getState().worktreeList).toHaveLength(2);
  });
});
