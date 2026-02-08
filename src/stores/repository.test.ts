import {
  createRepoStatus,
  ok,
  err,
} from "../test-utils/mocks/tauri-commands";
import { useRepositoryStore } from "./repository";

const mockCommands = vi.hoisted(() => ({
  openRepository: vi.fn(),
  getRepositoryStatus: vi.fn(),
  closeRepository: vi.fn(),
}));

vi.mock("../bindings", () => ({
  commands: mockCommands,
}));

describe("useRepositoryStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default resolved values
    mockCommands.openRepository.mockResolvedValue(ok(createRepoStatus()));
    mockCommands.getRepositoryStatus.mockResolvedValue(ok(createRepoStatus()));
    mockCommands.closeRepository.mockResolvedValue(ok(null));
  });

  it("has correct initial state", () => {
    const state = useRepositoryStore.getState();
    expect(state.status).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("openRepository sets status on success", async () => {
    const repoStatus = createRepoStatus({ branchName: "develop" });
    mockCommands.openRepository.mockResolvedValueOnce(ok(repoStatus));

    await useRepositoryStore.getState().openRepository("/test/repo");

    const state = useRepositoryStore.getState();
    expect(state.status).toEqual(repoStatus);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });

  it("openRepository sets error on failure", async () => {
    mockCommands.openRepository.mockResolvedValueOnce(
      err({ type: "NotARepository", message: "Not a git repo" }),
    );

    await expect(
      useRepositoryStore.getState().openRepository("/bad/path"),
    ).rejects.toThrow();

    const state = useRepositoryStore.getState();
    expect(state.status).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeTruthy();
  });

  it("resets state between tests (auto-reset verification)", () => {
    const state = useRepositoryStore.getState();
    expect(state.status).toBeNull();
    expect(state.isLoading).toBe(false);
    expect(state.error).toBeNull();
  });
});
