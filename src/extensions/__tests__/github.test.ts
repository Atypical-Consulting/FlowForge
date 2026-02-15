import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { getBladeRegistration } from "@/framework/layout/bladeRegistry";
import { getCommandById } from "@/framework/command-palette/commandRegistry";
import { useToolbarRegistry } from "@/framework/extension-system/toolbarRegistry";

// Mock blade components used by the GitHub extension
vi.mock("../github/blades/GitHubAuthBlade", () => ({
  GitHubAuthBlade: () => null,
}));
vi.mock("../github/blades/GitHubAccountBlade", () => ({
  GitHubAccountBlade: () => null,
}));
vi.mock("../github/components/GitHubStatusButton", () => ({
  GitHubStatusButton: () => null,
}));
vi.mock("../github/blades/PullRequestListBlade", () => ({
  PullRequestListBlade: () => null,
}));
vi.mock("../github/blades/PullRequestDetailBlade", () => ({
  PullRequestDetailBlade: () => null,
}));
vi.mock("../github/blades/IssueListBlade", () => ({
  IssueListBlade: () => null,
}));
vi.mock("../github/blades/IssueDetailBlade", () => ({
  IssueDetailBlade: () => null,
}));
vi.mock("../github/blades/CreatePullRequestBlade", () => ({
  CreatePullRequestBlade: () => null,
}));

// Mock the GitHub store
vi.mock("../github/githubStore", () => ({
  useGitHubStore: {
    getState: () => ({
      isAuthenticated: false,
      detectedRemotes: [],
      checkAuth: vi.fn(),
      resetRemotes: vi.fn(),
      detectRemotes: vi.fn(),
      signOut: vi.fn(),
      isAuthenticating: false,
      cancelAuth: vi.fn(),
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
  getSelectedRemote: vi.fn(),
  cancelGitHubPolling: vi.fn(),
}));

// Mock the git-ops store (post shim-removal path)
vi.mock("../../core/stores/domain/git-ops", () => ({
  useGitOpsStore: {
    getState: () => ({
      repoStatus: null,
    }),
    subscribe: vi.fn(() => vi.fn()),
  },
}));

// Mock other dependencies
vi.mock("../../core/lib/bladeOpener", () => ({
  openBlade: vi.fn(),
}));
vi.mock("../../core/lib/queryClient", () => ({
  queryClient: { removeQueries: vi.fn() },
}));

describe("github extension", () => {
  let api: ExtensionAPI;
  let onActivate: typeof import("../github").onActivate;
  let onDeactivate: typeof import("../github").onDeactivate;
  let cancelGitHubPolling: ReturnType<typeof vi.fn>;
  let queryClient: { removeQueries: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    api = new ExtensionAPI("github");
    // Reset toolbar registry
    useToolbarRegistry.setState({ actions: new Map(), visibilityTick: 0 });

    // Dynamically import to ensure mocks are applied
    const ghModule = await import("../github");
    onActivate = ghModule.onActivate;
    onDeactivate = ghModule.onDeactivate;

    const ghStore = await import("../github/githubStore");
    cancelGitHubPolling = ghStore.cancelGitHubPolling as ReturnType<typeof vi.fn>;

    const qc = await import("../../core/lib/queryClient");
    queryClient = qc.queryClient as { removeQueries: ReturnType<typeof vi.fn> };
  });

  afterEach(() => {
    api.cleanup();
    vi.clearAllMocks();
  });

  // --- Blade registration ---

  it("registers 7 blade types on activation", async () => {
    await onActivate(api);

    const bladeTypes = [
      "ext:github:sign-in",
      "ext:github:account",
      "ext:github:pull-requests",
      "ext:github:pull-request",
      "ext:github:issues",
      "ext:github:issue",
      "ext:github:create-pr",
    ];

    for (const type of bladeTypes) {
      expect(getBladeRegistration(type)).toBeDefined();
    }
  });

  it("blade types use ext:github: namespace", async () => {
    await onActivate(api);

    const bladeTypes = [
      "ext:github:sign-in",
      "ext:github:account",
      "ext:github:pull-requests",
      "ext:github:pull-request",
      "ext:github:issues",
      "ext:github:issue",
      "ext:github:create-pr",
    ];

    for (const type of bladeTypes) {
      expect(type.startsWith("ext:github:")).toBe(true);
      expect(getBladeRegistration(type)?.source).toBe("ext:github");
    }
  });

  // --- Command registration ---

  it("registers 5 commands on activation", async () => {
    await onActivate(api);

    const commandIds = [
      "ext:github:sign-in",
      "ext:github:sign-out",
      "ext:github:open-pull-requests",
      "ext:github:open-issues",
      "ext:github:create-pull-request",
    ];

    for (const id of commandIds) {
      expect(getCommandById(id)).toBeDefined();
    }
  });

  // --- Toolbar registration ---

  it("registers 4 toolbar actions on activation", async () => {
    await onActivate(api);

    const actions = useToolbarRegistry.getState().items;
    const toolbarIds = [
      "ext:github:github-status",
      "ext:github:open-pull-requests",
      "ext:github:open-issues",
      "ext:github:create-pr",
    ];

    for (const id of toolbarIds) {
      expect(actions.has(id)).toBe(true);
    }
  });

  // --- Cleanup ---

  it("cleanup removes all blade registrations", async () => {
    await onActivate(api);
    api.cleanup();

    const bladeTypes = [
      "ext:github:sign-in",
      "ext:github:account",
      "ext:github:pull-requests",
      "ext:github:pull-request",
      "ext:github:issues",
      "ext:github:issue",
      "ext:github:create-pr",
    ];

    for (const type of bladeTypes) {
      expect(getBladeRegistration(type)).toBeUndefined();
    }
  });

  it("cleanup removes all command registrations", async () => {
    await onActivate(api);
    api.cleanup();

    const commandIds = [
      "ext:github:sign-in",
      "ext:github:sign-out",
      "ext:github:open-pull-requests",
      "ext:github:open-issues",
      "ext:github:create-pull-request",
    ];

    for (const id of commandIds) {
      expect(getCommandById(id)).toBeUndefined();
    }
  });

  it("cleanup removes all toolbar registrations", async () => {
    await onActivate(api);
    api.cleanup();

    const actions = useToolbarRegistry.getState().items;
    const toolbarIds = [
      "ext:github:github-status",
      "ext:github:open-pull-requests",
      "ext:github:open-issues",
      "ext:github:create-pr",
    ];

    for (const id of toolbarIds) {
      expect(actions.has(id)).toBe(false);
    }
  });

  // --- Deactivation ---

  it("onDeactivate cancels polling and cleans up queries", () => {
    onDeactivate();

    expect(cancelGitHubPolling).toHaveBeenCalled();
    expect(queryClient.removeQueries).toHaveBeenCalledWith({
      queryKey: ["ext:github"],
    });
  });
});
