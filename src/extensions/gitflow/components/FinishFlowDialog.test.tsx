import type { GitflowStatus } from "../../../bindings";
import { useGitOpsStore } from "../../../core/stores/domain/git-ops";
import { fireEvent, render, screen, waitFor } from "../../../core/test-utils";
import {
  gitflowErr,
  gitflowOk,
} from "../../../core/test-utils/mocks/tauri-commands";
import { getGitflowActor } from "../machines/context";

const mockCommands = vi.hoisted(() => ({
  finishFeature: vi.fn(),
}));
const mockRefresh = vi.hoisted(() => ({ refreshRepositoryState: vi.fn() }));
const mockToast = vi.hoisted(() => ({
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));
vi.mock("../../../core/lib/repositoryRefresh", () => mockRefresh);
vi.mock("@/framework/stores/toast", () => mockToast);

import { FinishFlowDialog } from "./FinishFlowDialog";

const DIRTY_TREE_MESSAGE =
  "You have uncommitted changes. Commit or stash them before running this Gitflow operation.";

const onFeatureStatus: GitflowStatus = {
  currentBranch: "feature/ui-test",
  isGitflowReady: true,
  canStartFeature: false,
  canFinishFeature: true,
  canStartRelease: false,
  canFinishRelease: false,
  canStartHotfix: false,
  canFinishHotfix: false,
  canAbort: true,
  activeFlow: { flowType: "feature", name: "ui-test", sourceBranch: "develop" },
  context: {
    state: { type: "Feature", data: { name: "ui-test" } },
    currentBranch: "feature/ui-test",
    hasMain: true,
    hasDevelop: true,
    isInitialized: true,
  },
};

describe("FinishFlowDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRefresh.refreshRepositoryState.mockResolvedValue(undefined);
    // The machine actor is a module singleton: reset any leftover failure.
    getGitflowActor().send({ type: "DISMISS_ERROR" });
    useGitOpsStore.setState({ gitflowStatus: onFeatureStatus });
  });

  it("stays open, shows the error and toasts it when finishing fails on a dirty tree", async () => {
    mockCommands.finishFeature.mockResolvedValue(
      gitflowErr({ type: "DirtyWorkingTree" }),
    );
    const onClose = vi.fn();
    render(<FinishFlowDialog flowType="feature" onClose={onClose} />);

    // No stale error is shown before submitting
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      DIRTY_TREE_MESSAGE,
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(mockToast.toast.error).toHaveBeenCalledWith(DIRTY_TREE_MESSAGE);
    expect(mockRefresh.refreshRepositoryState).not.toHaveBeenCalled();
    // Ready to retry once the tree is clean
    expect(screen.getByRole("button", { name: "Finish" })).toBeEnabled();
  });

  it("shows a loading state while finishing and closes on success", async () => {
    let resolveFinish: (value: unknown) => void = () => {};
    mockCommands.finishFeature.mockReturnValue(
      new Promise((resolve) => {
        resolveFinish = resolve;
      }),
    );
    const onClose = vi.fn();
    render(<FinishFlowDialog flowType="feature" onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Finish" }));

    const busy = await screen.findByRole("button", { name: "Finishing..." });
    expect(busy).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();

    resolveFinish(gitflowOk(null));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mockToast.toast.success).toHaveBeenCalledWith(
      "Finished feature ui-test into develop",
    );
    expect(mockRefresh.refreshRepositoryState).toHaveBeenCalledTimes(1);
    expect(mockToast.toast.error).not.toHaveBeenCalled();
  });
});
