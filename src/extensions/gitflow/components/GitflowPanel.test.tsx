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
} from "../../../core/test-utils";
import { gitflowOk } from "../../../core/test-utils/mocks/tauri-commands";

const mockCommands = vi.hoisted(() => ({
  getGitflowStatus: vi.fn(),
  getRepositoryStatus: vi.fn(),
  listBranches: vi.fn(),
  listTags: vi.fn(),
  listStashes: vi.fn(),
  getUndoInfo: vi.fn(),
  getCommitGraph: vi.fn(),
  startFeature: vi.fn(),
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));

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
});
