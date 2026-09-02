import { useGitOpsStore } from "../../../../core/stores/domain/git-ops";
import {
  act,
  createBranchInfo,
  createRepoStatus,
  fireEvent,
  render,
  screen,
} from "../../../../core/test-utils";
import { BranchList } from "../BranchList";

const mockCommands = vi.hoisted(() => ({
  listBranches: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  listAllBranches: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
  getBranchAheadBehind: vi
    .fn()
    .mockResolvedValue({ status: "ok", data: { ahead: 0, behind: 0 } }),
  getGitflowStatus: vi.fn().mockResolvedValue({ status: "ok", data: null }),
}));

vi.mock("../../../../bindings", () => ({
  commands: mockCommands,
}));

vi.mock("@/core/services/gitHookBus", () => ({
  gitHookBus: { onDid: vi.fn(() => () => {}) },
}));

vi.mock("@/framework/extension-system/contextMenuRegistry", () => ({
  useContextMenuRegistry: { getState: () => ({ showMenu: vi.fn() }) },
}));

function seedRepository() {
  act(() => {
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({ repoPath: "/repo", branchName: "main" }),
      branchList: [
        createBranchInfo({ name: "main", isHead: true }),
        createBranchInfo({ name: "feature/a", isHead: false, isMerged: true }),
      ],
      branchAllList: [
        createBranchInfo({ name: "main", isHead: true }),
        createBranchInfo({ name: "feature/a", isHead: false, isMerged: true }),
      ],
    });
  });
}

function renderList() {
  return render(
    <BranchList showCreateDialog={false} onCloseCreateDialog={() => {}} />,
  );
}

function enterCleanUpMode() {
  fireEvent.click(screen.getByRole("button", { name: /clean up/i }));
  expect(screen.getByText(/selected/)).toBeInTheDocument();
}

describe("BranchList clean-up mode", () => {
  beforeEach(() => {
    seedRepository();
  });

  it("exits clean-up mode on Escape", () => {
    renderList();
    enterCleanUpMode();

    fireEvent.keyDown(document.body, { key: "Escape" });

    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /clean up/i }),
    ).toBeInTheDocument();
  });

  it("ignores an Escape that a dialog already handled", () => {
    renderList();
    enterCleanUpMode();

    // The shared Dialog handles Escape in the capture phase and marks it
    // consumed; the list must not double-handle it.
    const consumed = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    consumed.preventDefault();
    act(() => {
      document.body.dispatchEvent(consumed);
    });

    expect(screen.getByText(/selected/)).toBeInTheDocument();
  });

  it("does not react to Escape outside clean-up mode", () => {
    renderList();
    const event = fireEvent.keyDown(document.body, { key: "Escape" });
    expect(event).toBe(true);
    expect(
      screen.getByRole("button", { name: /clean up/i }),
    ).toBeInTheDocument();
  });
});
