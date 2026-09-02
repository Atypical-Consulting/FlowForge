import { useGitOpsStore } from "../../../core/stores/domain/git-ops";
import {
  act,
  createBranchInfo,
  createRepoStatus,
  ok,
  render,
  screen,
} from "../../../core/test-utils";

const mockCommands = vi.hoisted(() => ({
  checkoutBranch: vi.fn(),
  listBranches: vi.fn(),
  listAllBranches: vi.fn(),
  getRepositoryStatus: vi.fn(),
}));

vi.mock("../../../bindings", () => ({ commands: mockCommands }));

import { BranchSwitcher } from "./BranchSwitcher";

describe("BranchSwitcher current branch indicator", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCommands.listAllBranches.mockResolvedValue(ok([]));
    // Status captured when the repository was opened
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({ branchName: "develop" }),
    });
  });

  it("falls back to the repository status when no branch list is loaded", () => {
    render(<BranchSwitcher onSelectBranch={vi.fn()} />);
    expect(screen.getByLabelText("Branch: develop")).toBeInTheDocument();
  });

  it("shows the HEAD branch of the live branch list, not the status captured at open", () => {
    useGitOpsStore.setState({
      branchList: [
        createBranchInfo({ name: "develop", isHead: false }),
        createBranchInfo({ name: "feature/payments", isHead: true }),
      ],
    });

    render(<BranchSwitcher onSelectBranch={vi.fn()} />);
    expect(
      screen.getByLabelText("Branch: feature/payments"),
    ).toBeInTheDocument();
  });

  it("follows a checkout performed through the store", async () => {
    useGitOpsStore.setState({
      branchList: [
        createBranchInfo({ name: "develop", isHead: true }),
        createBranchInfo({ name: "main", isHead: false }),
      ],
    });
    mockCommands.checkoutBranch.mockResolvedValue(ok(null));
    mockCommands.listBranches.mockResolvedValue(
      ok([
        createBranchInfo({ name: "main", isHead: true }),
        createBranchInfo({ name: "develop", isHead: false }),
      ]),
    );
    mockCommands.getRepositoryStatus.mockResolvedValue(
      ok(createRepoStatus({ branchName: "main" })),
    );

    render(<BranchSwitcher onSelectBranch={vi.fn()} />);
    expect(screen.getByLabelText("Branch: develop")).toBeInTheDocument();

    await act(async () => {
      await useGitOpsStore.getState().checkoutBranch("main");
    });

    expect(screen.getByLabelText("Branch: main")).toBeInTheDocument();
    // The repository status itself was refreshed as well (header consumers)
    expect(useGitOpsStore.getState().repoStatus?.branchName).toBe("main");
  });
});
