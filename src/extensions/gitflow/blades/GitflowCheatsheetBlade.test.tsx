import { render } from "../../../core/test-utils/render";

const mockCommands = vi.hoisted(() => ({
  getGitflowStatus: vi.fn().mockResolvedValue({
    status: "ok",
    data: {
      currentBranch: "main",
      isGitflowReady: false,
      canStartFeature: false,
      canFinishFeature: false,
      canStartRelease: false,
      canFinishRelease: false,
      canStartHotfix: false,
      canFinishHotfix: false,
      canAbort: false,
      activeFlow: null,
      context: {
        state: { type: "Idle" },
        currentBranch: "main",
        hasMain: true,
        hasDevelop: false,
        isInitialized: false,
      },
    },
  }),
  getRepositoryStatus: vi.fn().mockResolvedValue({
    status: "ok",
    data: { branchName: "main", isDirty: false, repoPath: "/test", repoName: "test" },
  }),
  listBranches: vi.fn().mockResolvedValue({ status: "ok", data: [] }),
}));

vi.mock("../../../bindings", () => ({
  commands: mockCommands,
}));

import { GitflowCheatsheetBlade } from "./GitflowCheatsheetBlade";

describe("GitflowCheatsheetBlade", () => {
  it("renders without crashing", () => {
    const { container } = render(<GitflowCheatsheetBlade />);
    expect(container.firstChild).not.toBeNull();
  });
});
