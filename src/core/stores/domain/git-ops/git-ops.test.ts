import {
  ok,
  err,
  createBranchInfo,
  createTagInfo,
  createStashEntry,
} from "../../../test-utils/mocks/tauri-commands";
import { useGitOpsStore } from "./index";

const mockCommands = vi.hoisted(() => ({
  listBranches: vi.fn(),
  listAllBranches: vi.fn(),
  createBranch: vi.fn(),
  checkoutBranch: vi.fn(),
  checkoutRemoteBranch: vi.fn(),
  deleteBranch: vi.fn(),
  mergeBranch: vi.fn(),
  abortMerge: vi.fn(),
  listTags: vi.fn(),
  deleteTag: vi.fn(),
  listStashes: vi.fn(),
  stashSave: vi.fn(),
  stashApply: vi.fn(),
  stashPop: vi.fn(),
  stashDrop: vi.fn(),
  openRepository: vi.fn(),
  getRepositoryStatus: vi.fn(),
  closeRepository: vi.fn(),
  listWorktrees: vi.fn(),
  createWorktree: vi.fn(),
  deleteWorktree: vi.fn(),
  getGitflowStatus: vi.fn(),
  initGitflow: vi.fn(),
  startFeature: vi.fn(),
  finishFeature: vi.fn(),
  startRelease: vi.fn(),
  finishRelease: vi.fn(),
  startHotfix: vi.fn(),
  finishHotfix: vi.fn(),
  abortGitflow: vi.fn(),
  getUndoInfo: vi.fn(),
  undoLastOperation: vi.fn(),
  getCommitGraph: vi.fn(),
  cloneRepository: vi.fn(),
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));

vi.mock("../../../machines/navigation/context", () => ({
  getNavigationActor: () => ({ send: vi.fn() }),
}));

vi.mock("../../toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

describe("useGitOpsStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommands.listBranches.mockResolvedValue(ok([]));
    mockCommands.listTags.mockResolvedValue(ok([]));
    mockCommands.listStashes.mockResolvedValue(ok([]));
  });

  describe("Store composition", () => {
    it("has all slice state keys in initial state", () => {
      const state = useGitOpsStore.getState();

      // Repository slice
      expect(state).toHaveProperty("repoStatus");
      // Branch slice
      expect(state).toHaveProperty("branchList");
      // Tag slice
      expect(state).toHaveProperty("tagList");
      // Stash slice
      expect(state).toHaveProperty("stashList");
      // Worktree slice
      expect(state).toHaveProperty("worktreeList");
      // Gitflow slice
      expect(state).toHaveProperty("gitflowStatus");
      // Undo slice
      expect(state).toHaveProperty("undoInfo");
      // Topology slice
      expect(state).toHaveProperty("nodes");
      // Clone slice
      expect(state).toHaveProperty("cloneIsCloning");
    });

    it("all initial state values are defaults", () => {
      const state = useGitOpsStore.getState();

      expect(state.repoStatus).toBeNull();
      expect(state.branchList).toEqual([]);
      expect(state.tagList).toEqual([]);
      expect(state.stashList).toEqual([]);
      expect(state.worktreeList).toEqual([]);
      expect(state.gitflowStatus).toBeNull();
      expect(state.undoInfo).toBeNull();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.cloneIsCloning).toBe(false);
      expect(state.cloneProgress).toBeNull();
      expect(state.cloneError).toBeNull();
    });
  });

  describe("Branches slice", () => {
    it("loadBranches sets branchList on success", async () => {
      const branch = createBranchInfo({ name: "main" });
      mockCommands.listBranches.mockResolvedValueOnce(ok([branch]));

      await useGitOpsStore.getState().loadBranches();

      const state = useGitOpsStore.getState();
      expect(state.branchList).toHaveLength(1);
      expect(state.branchList[0].name).toBe("main");
      expect(state.branchIsLoading).toBe(false);
    });

    it("loadBranches sets error on failure", async () => {
      mockCommands.listBranches.mockResolvedValueOnce(
        err({ type: "NotARepository", message: "Not a git repository" }),
      );

      await useGitOpsStore.getState().loadBranches();

      const state = useGitOpsStore.getState();
      expect(state.branchError).toBeTruthy();
      expect(state.branchIsLoading).toBe(false);
    });

    it("createBranch returns branch info on success", async () => {
      const newBranch = createBranchInfo({ name: "feature/test" });
      mockCommands.createBranch.mockResolvedValueOnce(ok(newBranch));
      mockCommands.listBranches.mockResolvedValueOnce(ok([newBranch]));

      const result = await useGitOpsStore.getState().createBranch("feature/test", true);

      expect(result).not.toBeNull();
      expect(result!.name).toBe("feature/test");
    });
  });

  describe("Tags slice", () => {
    it("loadTags sets tagList on success", async () => {
      const tag = createTagInfo({ name: "v1.0.0" });
      mockCommands.listTags.mockResolvedValueOnce(ok([tag]));

      await useGitOpsStore.getState().loadTags();

      const state = useGitOpsStore.getState();
      expect(state.tagList).toHaveLength(1);
      expect(state.tagList[0].name).toBe("v1.0.0");
      expect(state.tagIsLoading).toBe(false);
    });

    it("loadTags sets error on failure", async () => {
      mockCommands.listTags.mockResolvedValueOnce(
        err({ type: "NotARepository", message: "Not a git repository" }),
      );

      await useGitOpsStore.getState().loadTags();

      const state = useGitOpsStore.getState();
      expect(state.tagError).toBeTruthy();
      expect(state.tagIsLoading).toBe(false);
    });

    it("clearTagError resets error to null", async () => {
      mockCommands.listTags.mockResolvedValueOnce(
        err({ type: "NotARepository", message: "Error" }),
      );
      await useGitOpsStore.getState().loadTags();
      expect(useGitOpsStore.getState().tagError).toBeTruthy();

      useGitOpsStore.getState().clearTagError();
      expect(useGitOpsStore.getState().tagError).toBeNull();
    });
  });

  describe("Stash slice", () => {
    it("loadStashes sets stashList on success", async () => {
      const stash = createStashEntry({ index: 0, message: "WIP" });
      mockCommands.listStashes.mockResolvedValueOnce(ok([stash]));

      await useGitOpsStore.getState().loadStashes();

      const state = useGitOpsStore.getState();
      expect(state.stashList).toHaveLength(1);
      expect(state.stashList[0].message).toBe("WIP");
      expect(state.stashIsLoading).toBe(false);
    });

    it("saveStash returns true on success", async () => {
      mockCommands.stashSave.mockResolvedValueOnce(ok("stash@{0}"));
      mockCommands.listStashes.mockResolvedValueOnce(ok([]));

      const result = await useGitOpsStore.getState().saveStash("test stash", false);

      expect(result).toBe(true);
      expect(mockCommands.stashSave).toHaveBeenCalledWith("test stash", false);
    });

    it("saveStash returns false and sets error on failure", async () => {
      mockCommands.stashSave.mockResolvedValueOnce(
        err({ type: "NothingToStash" }),
      );

      const result = await useGitOpsStore.getState().saveStash("test", true);

      expect(result).toBe(false);
      const state = useGitOpsStore.getState();
      expect(state.stashError).toBeTruthy();
      expect(state.stashIsLoading).toBe(false);
    });
  });

  describe("Clone slice", () => {
    it("startClone sets isCloning", () => {
      useGitOpsStore.getState().startClone();

      const state = useGitOpsStore.getState();
      expect(state.cloneIsCloning).toBe(true);
      expect(state.cloneProgress).toBeNull();
      expect(state.cloneError).toBeNull();
    });

    it("updateCloneProgress sets progress", () => {
      useGitOpsStore.getState().startClone();

      const progress = {
        event: "receiving" as const,
        data: { received: 10, total: 100, bytes: 1024 },
      };
      useGitOpsStore.getState().updateCloneProgress(progress);

      const state = useGitOpsStore.getState();
      expect(state.cloneProgress).toEqual(progress);
    });

    it("resetClone clears all clone state", () => {
      // Set some clone state first
      useGitOpsStore.getState().startClone();
      useGitOpsStore.getState().updateCloneProgress({
        event: "receiving" as const,
        data: { received: 50, total: 100, bytes: 2048 },
      });

      useGitOpsStore.getState().resetClone();

      const state = useGitOpsStore.getState();
      expect(state.cloneIsCloning).toBe(false);
      expect(state.cloneProgress).toBeNull();
      expect(state.cloneError).toBeNull();
    });
  });

  describe("Topology slice", () => {
    it("selectCommit sets topologySelectedCommit", () => {
      useGitOpsStore.getState().selectCommit("abc1234");

      expect(useGitOpsStore.getState().topologySelectedCommit).toBe("abc1234");

      useGitOpsStore.getState().selectCommit(null);
      expect(useGitOpsStore.getState().topologySelectedCommit).toBeNull();
    });

    it("resetTopology clears all topology state", () => {
      // Set some topology state first
      useGitOpsStore.getState().selectCommit("abc1234");

      useGitOpsStore.getState().resetTopology();

      const state = useGitOpsStore.getState();
      expect(state.nodes).toEqual([]);
      expect(state.edges).toEqual([]);
      expect(state.topologySelectedCommit).toBeNull();
      expect(state.topologyIsLoading).toBe(false);
      expect(state.topologyError).toBeNull();
      expect(state.topologyHasMore).toBe(true);
      expect(state.topologyLastRefresh).toBe(0);
      expect(state.topologyCurrentOffset).toBe(0);
    });
  });
});
