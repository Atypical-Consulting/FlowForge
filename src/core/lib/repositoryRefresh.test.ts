import { QueryClient } from "@tanstack/react-query";
import type { GitflowStatus, GraphNode } from "../../bindings";
import {
  createBranchInfo,
  createRepoStatus,
  createWorktreeInfo,
  gitflowOk,
  ok,
} from "../test-utils/mocks/tauri-commands";

const mockCommands = vi.hoisted(() => ({
  getRepositoryStatus: vi.fn(),
  listBranches: vi.fn(),
  getGitflowStatus: vi.fn(),
  getUndoInfo: vi.fn(),
  listTags: vi.fn(),
  listStashes: vi.fn(),
  listWorktrees: vi.fn(),
  getCommitGraph: vi.fn(),
}));

vi.mock("../../bindings", () => ({ commands: mockCommands }));

import { useGitOpsStore } from "../stores/domain/git-ops";
import {
  containsGitDirPath,
  invalidateRepositoryQueries,
  REPOSITORY_QUERY_KEYS,
  refreshRepositoryState,
} from "./repositoryRefresh";

function gitflowStatus(currentBranch: string): GitflowStatus {
  const onFeature = currentBranch.startsWith("feature/");
  return {
    currentBranch,
    isGitflowReady: true,
    canStartFeature: currentBranch === "develop",
    canFinishFeature: onFeature,
    canStartRelease: currentBranch === "develop",
    canFinishRelease: false,
    canStartHotfix: false,
    canFinishHotfix: false,
    canAbort: onFeature,
    activeFlow: null,
    context: {
      state: { type: "Idle" },
      currentBranch,
      hasMain: true,
      hasDevelop: true,
      isInitialized: true,
    },
  };
}

function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
}

describe("containsGitDirPath", () => {
  it("detects paths inside the .git directory (posix and windows)", () => {
    expect(containsGitDirPath(["/repo/.git/HEAD"])).toBe(true);
    expect(containsGitDirPath(["C:\\repo\\.git\\refs\\heads\\main"])).toBe(
      true,
    );
    expect(containsGitDirPath(["/repo/src/a.ts", "/repo/.git/HEAD"])).toBe(
      true,
    );
  });

  it("ignores working-tree paths, including .gitignore-like names", () => {
    expect(containsGitDirPath([])).toBe(false);
    expect(containsGitDirPath(["/repo/src/a.ts"])).toBe(false);
    expect(containsGitDirPath(["/repo/docs/.gitignore"])).toBe(false);
  });
});

describe("invalidateRepositoryQueries", () => {
  it("invalidates every repository-dependent query key", () => {
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    invalidateRepositoryQueries(queryClient);

    expect(REPOSITORY_QUERY_KEYS.length).toBeGreaterThan(0);
    for (const key of REPOSITORY_QUERY_KEYS) {
      expect(spy).toHaveBeenCalledWith({ queryKey: [...key] });
    }
  });
});

describe("refreshRepositoryState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommands.getRepositoryStatus.mockResolvedValue(
      ok(createRepoStatus({ branchName: "feature/payments" })),
    );
    mockCommands.listBranches.mockResolvedValue(
      ok([
        createBranchInfo({ name: "feature/payments", isHead: true }),
        createBranchInfo({ name: "develop", isHead: false }),
      ]),
    );
    mockCommands.getGitflowStatus.mockResolvedValue(
      gitflowOk(gitflowStatus("feature/payments")),
    );
    mockCommands.getUndoInfo.mockResolvedValue(
      ok({
        canUndo: false,
        description: null,
        reflogMessage: null,
        targetOid: null,
      }),
    );
    mockCommands.listTags.mockResolvedValue(ok([]));
    mockCommands.listStashes.mockResolvedValue(ok([]));
    mockCommands.listWorktrees.mockResolvedValue(
      ok([createWorktreeInfo({ branch: "feature/payments" })]),
    );
    mockCommands.getCommitGraph.mockResolvedValue(ok({ nodes: [], edges: [] }));

    // State captured when the repository was opened (still on develop)
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({ branchName: "develop" }),
      branchList: [createBranchInfo({ name: "develop", isHead: true })],
      gitflowStatus: gitflowStatus("develop"),
      worktreeList: [createWorktreeInfo({ branch: "develop" })],
    });
  });

  it("refreshes the store-backed state and invalidates the queries", async () => {
    const queryClient = createTestQueryClient();
    const spy = vi.spyOn(queryClient, "invalidateQueries");

    await refreshRepositoryState(queryClient);

    const state = useGitOpsStore.getState();
    expect(state.repoStatus?.branchName).toBe("feature/payments");
    expect(state.branchList.find((b) => b.isHead)?.name).toBe(
      "feature/payments",
    );
    expect(state.gitflowStatus?.canFinishFeature).toBe(true);
    expect(mockCommands.getUndoInfo).toHaveBeenCalled();
    expect(mockCommands.listTags).toHaveBeenCalled();
    expect(mockCommands.listStashes).toHaveBeenCalled();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["repositoryStatus"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["stagingStatus"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["commitHistory"] });
  });

  it("reloads the worktree list so the main worktree row follows HEAD", async () => {
    await refreshRepositoryState(createTestQueryClient());

    expect(mockCommands.listWorktrees).toHaveBeenCalledTimes(1);
    const main = useGitOpsStore.getState().worktreeList.find((w) => w.isMain);
    expect(main?.branch).toBe("feature/payments");
  });

  it("keeps a worktree listing failure non-fatal", async () => {
    mockCommands.listWorktrees.mockResolvedValue({
      status: "error",
      error: { type: "OperationFailed", message: "worktree list failed" },
    });

    await expect(
      refreshRepositoryState(createTestQueryClient()),
    ).resolves.toBeUndefined();
    expect(useGitOpsStore.getState().worktreeError).toBe(
      "worktree list failed",
    );
  });

  it("only reloads the commit graph when it has already been loaded", async () => {
    await refreshRepositoryState(createTestQueryClient());
    expect(mockCommands.getCommitGraph).not.toHaveBeenCalled();

    useGitOpsStore.setState({
      nodes: [{ oid: "abc", shortOid: "abc" } as unknown as GraphNode],
    });
    await refreshRepositoryState(createTestQueryClient());
    expect(mockCommands.getCommitGraph).toHaveBeenCalledTimes(1);
  });

  it("rejects with an aggregated error when a refresh fails", async () => {
    mockCommands.listBranches.mockRejectedValue(new Error("boom"));

    await expect(
      refreshRepositoryState(createTestQueryClient()),
    ).rejects.toThrow("boom");

    // Refreshes that did succeed are still applied
    expect(useGitOpsStore.getState().repoStatus?.branchName).toBe(
      "feature/payments",
    );
  });
});
