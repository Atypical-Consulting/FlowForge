import type { GitflowStatus } from "../../../bindings";
import { queryClient } from "../../../core/lib/queryClient";
import { useGitOpsStore } from "../../../core/stores/domain/git-ops";
import {
  createBranchInfo,
  createRepoStatus,
  fireEvent,
  ok,
  render,
  screen,
  waitFor,
  within,
} from "../../../core/test-utils";
import {
  gitflowErr,
  gitflowOk,
} from "../../../core/test-utils/mocks/tauri-commands";
import { getGitflowActor } from "../machines/context";

const mockCommands = vi.hoisted(() => ({
  getGitflowStatus: vi.fn(),
  getRepositoryStatus: vi.fn(),
  listBranches: vi.fn(),
  listTags: vi.fn(),
  listStashes: vi.fn(),
  getUndoInfo: vi.fn(),
  getCommitGraph: vi.fn(),
  startFeature: vi.fn(),
  finishFeature: vi.fn(),
  abortGitflow: vi.fn(),
}));
const mockToast = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));
vi.mock("@/framework/stores/toast", () => mockToast);

import { GitflowPanel } from "./GitflowPanel";

function gitflowStatus(currentBranch: string): GitflowStatus {
  const onDevelop = currentBranch === "develop";
  const onFeature = currentBranch.startsWith("feature/");
  const featureName = currentBranch.replace(/^feature\//, "");
  return {
    currentBranch,
    isGitflowReady: true,
    canStartFeature: onDevelop,
    canFinishFeature: onFeature,
    canStartRelease: onDevelop,
    canFinishRelease: false,
    canStartHotfix: false,
    canFinishHotfix: false,
    canAbort: onFeature,
    activeFlow: onFeature
      ? { flowType: "feature", name: featureName, sourceBranch: "develop" }
      : null,
    context: {
      state: onFeature
        ? { type: "Feature", data: { name: featureName } }
        : { type: "Idle" },
      currentBranch,
      hasMain: true,
      hasDevelop: true,
      isInitialized: true,
    },
  };
}

/** Point every command at the given branch, as the backend would after a checkout. */
function setBackendBranch(branch: string) {
  mockCommands.getGitflowStatus.mockResolvedValue(
    gitflowOk(gitflowStatus(branch)),
  );
  mockCommands.getRepositoryStatus.mockResolvedValue(
    ok(createRepoStatus({ branchName: branch })),
  );
  mockCommands.listBranches.mockResolvedValue(
    ok(
      ["develop", "main", branch]
        .filter((name, i, all) => all.indexOf(name) === i)
        .map((name) => createBranchInfo({ name, isHead: name === branch })),
    ),
  );
}

describe("GitflowPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The machine actor is a module singleton: reset any leftover failure.
    getGitflowActor().send({ type: "DISMISS_ERROR" });
    setBackendBranch("develop");
    mockCommands.listTags.mockResolvedValue(ok([]));
    mockCommands.listStashes.mockResolvedValue(ok([]));
    mockCommands.getUndoInfo.mockResolvedValue(
      ok({
        canUndo: false,
        description: null,
        reflogMessage: null,
        targetOid: null,
      }),
    );
    mockCommands.getCommitGraph.mockResolvedValue(ok({ nodes: [], edges: [] }));

    // Repository opened on develop
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({ branchName: "develop" }),
      branchList: [createBranchInfo({ name: "develop", isHead: true })],
    });
  });

  it("refreshes repository state and enables Finish Feature after starting a feature", async () => {
    render(<GitflowPanel />);

    const finishFeature = await screen.findByRole("button", {
      name: "Finish Feature",
    });
    expect(finishFeature).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Feature" })).toBeEnabled(),
    );

    // The backend will report the new branch once the feature is started
    mockCommands.startFeature.mockImplementation(async (name: string) => {
      setBackendBranch(`feature/${name}`);
      return gitflowOk(`feature/${name}`);
    });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    fireEvent.click(screen.getByRole("button", { name: "Feature" }));
    fireEvent.change(screen.getByLabelText("Feature name"), {
      target: { value: "payments" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Start" }));

    await waitFor(() =>
      expect(mockCommands.startFeature).toHaveBeenCalledWith("payments"),
    );

    // Finish Feature follows the fresh gitflow status
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Finish Feature" }),
      ).toBeEnabled(),
    );

    // Store-backed state (header branch, branch list) was refreshed too
    const state = useGitOpsStore.getState();
    expect(state.repoStatus?.branchName).toBe("feature/payments");
    expect(state.branchList.find((b) => b.isHead)?.name).toBe(
      "feature/payments",
    );
    expect(state.gitflowStatus?.currentBranch).toBe("feature/payments");

    // TanStack queries were invalidated
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["repositoryStatus"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["stagingStatus"],
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["commitHistory"],
    });
  });

  describe("on a feature branch with a dirty working tree", () => {
    const DIRTY_TREE_MESSAGE =
      "You have uncommitted changes. Commit or stash them before running this Gitflow operation.";

    beforeEach(() => {
      setBackendBranch("feature/ui-test");
      useGitOpsStore.setState({
        repoStatus: createRepoStatus({
          branchName: "feature/ui-test",
          isDirty: true,
        }),
        branchList: [
          createBranchInfo({ name: "develop", isHead: false }),
          createBranchInfo({ name: "feature/ui-test", isHead: true }),
        ],
      });
      mockCommands.finishFeature.mockResolvedValue(
        gitflowErr({ type: "DirtyWorkingTree" }),
      );
      mockCommands.abortGitflow.mockResolvedValue(
        gitflowErr({ type: "DirtyWorkingTree" }),
      );
    });

    it("keeps a failed Finish Feature visible in the panel and dismiss clears it", async () => {
      render(<GitflowPanel />);

      const finishFeature = await screen.findByRole("button", {
        name: "Finish Feature",
      });
      await waitFor(() => expect(finishFeature).toBeEnabled());
      fireEvent.click(finishFeature);
      fireEvent.click(screen.getByRole("button", { name: "Finish" }));

      // The dialog stays open and shows the failure
      const dialog = screen.getByRole("dialog");
      expect(await within(dialog).findByRole("alert")).toHaveTextContent(
        DIRTY_TREE_MESSAGE,
      );
      expect(mockToast.toast.error).toHaveBeenCalledWith(DIRTY_TREE_MESSAGE);

      // Closing the dialog leaves the failure visible in the panel
      fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(screen.getByRole("alert")).toHaveTextContent(DIRTY_TREE_MESSAGE);

      fireEvent.click(screen.getByRole("button", { name: "Dismiss error" }));
      await waitFor(() =>
        expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
      );
      // The branch was never changed
      expect(useGitOpsStore.getState().repoStatus?.branchName).toBe(
        "feature/ui-test",
      );
    });

    it("shows a failed abort in the panel", async () => {
      render(<GitflowPanel />);

      const abort = await screen.findByRole("button", {
        name: "Abort current flow",
      });
      await waitFor(() => expect(abort).toBeEnabled());
      fireEvent.click(abort);

      expect(await screen.findByRole("alert")).toHaveTextContent(
        DIRTY_TREE_MESSAGE,
      );
      expect(mockCommands.abortGitflow).toHaveBeenCalledTimes(1);
      expect(mockToast.toast.error).toHaveBeenCalledWith(DIRTY_TREE_MESSAGE);
    });
  });
});
