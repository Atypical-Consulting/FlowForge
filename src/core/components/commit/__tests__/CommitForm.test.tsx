import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the extensions module to control isCCActive
const mockExtensionStatus = vi.hoisted(() => ({
  status: "inactive" as "active" | "inactive",
}));

vi.mock("../../../../extensions", () => ({
  useExtensionHost: (selector: (s: any) => any) =>
    selector({
      extensions: new Map([["conventional-commits", mockExtensionStatus]]),
    }),
}));

// Mock useBladeNavigation
vi.mock("../../../hooks/useBladeNavigation", () => ({
  useBladeNavigation: () => ({
    bladeStack: [],
    openBlade: vi.fn(),
  }),
}));

// Mock useCommitExecution
vi.mock("../../../hooks/useCommitExecution", () => ({
  useCommitExecution: () => ({
    commit: vi.fn(),
    isCommitting: false,
    commitError: null,
  }),
}));

// Mock useAmendPrefill
const mockAmendState = vi.hoisted(() => ({ amend: false }));

vi.mock(
  "../../../../extensions/conventional-commits/hooks/useAmendPrefill",
  () => ({
    useAmendPrefill: () => ({
      get amend() {
        return mockAmendState.amend;
      },
      toggleAmend: vi.fn(),
      setAmend: vi.fn(),
    }),
  }),
);

// Mock Tauri commands for staging status
vi.mock("../../../../bindings", () => ({
  commands: {
    getStagingStatus: vi.fn().mockResolvedValue({
      status: "ok",
      data: { staged: [], unstaged: [], untracked: [] },
    }),
  },
}));

// Mock ConventionalCommitForm since it has deep dependencies
vi.mock(
  "../../../../extensions/conventional-commits/components/ConventionalCommitForm",
  () => ({
    ConventionalCommitForm: () => <div data-testid="cc-form">CC Form</div>,
  }),
);

import type { RepoStatus } from "../../../../bindings";
import { useGitOpsStore } from "../../../stores/domain/git-ops";
import { createRepoStatus } from "../../../test-utils/mocks/tauri-commands";
import { CommitForm } from "../CommitForm";

/**
 * RepoStatus for a repository with a merge in progress. Cast because the
 * checked-in `src/bindings.ts` may predate the merge fields.
 */
function mergingRepoStatus(overrides?: {
  mergeHeadBranch?: string | null;
  mergeMessage?: string | null;
}): RepoStatus {
  return {
    ...createRepoStatus({ branchName: "develop" }),
    mergeInProgress: true,
    mergeHeadBranch: "conflict-a",
    mergeMessage: "Merge branch 'conflict-a' into develop",
    ...overrides,
  } as RepoStatus;
}

/**
 * RepoStatus for a repository mid cherry-pick or revert (single or one step of
 * a `git cherry-pick a..b` sequence). Same cast as above.
 */
function sequencerRepoStatus(
  operation: "cherryPick" | "revert",
  overrides?: { sequencerHead?: string | null; mergeMessage?: string | null },
): RepoStatus {
  return {
    ...createRepoStatus({ branchName: "develop" }),
    cherryPickInProgress: operation === "cherryPick",
    revertInProgress: operation === "revert",
    sequencerHead: "585521c",
    mergeMessage:
      operation === "cherryPick"
        ? "picked commit\n\n# Conflicts:\n#\tshared.txt"
        : 'Revert "add a"\n\nThis reverts commit 585521ce.',
    ...overrides,
  } as RepoStatus;
}

describe("CommitForm graceful degradation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockExtensionStatus.status = "inactive";
    mockAmendState.amend = false;
    useGitOpsStore.setState({ repoStatus: createRepoStatus() });
  });

  const renderCommitForm = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <CommitForm />
      </QueryClientProvider>,
    );

  describe("merge in progress", () => {
    it("shows no merge hint and keeps Amend enabled when not merging", () => {
      renderCommitForm();

      expect(screen.queryByRole("status")).not.toBeInTheDocument();
      expect(
        screen.getByRole("checkbox", { name: "Amend last commit" }),
      ).toBeEnabled();
    });

    it("shows which branch is being merged and that the commit completes it", () => {
      useGitOpsStore.setState({ repoStatus: mergingRepoStatus() });
      renderCommitForm();

      const hint = screen.getByRole("status");
      expect(hint).toHaveTextContent(
        "Merging conflict-a — this commit will complete the merge",
      );
    });

    it("falls back to MERGE_HEAD when no branch name is known", () => {
      useGitOpsStore.setState({
        repoStatus: mergingRepoStatus({ mergeHeadBranch: null }),
      });
      renderCommitForm();

      expect(screen.getByRole("status")).toHaveTextContent(
        "Merging MERGE_HEAD",
      );
    });

    it("disables the Amend checkbox during a merge", () => {
      useGitOpsStore.setState({ repoStatus: mergingRepoStatus() });
      renderCommitForm();

      expect(
        screen.getByRole("checkbox", { name: "Amend last commit" }),
      ).toBeDisabled();
    });

    it("prefills an empty message from MERGE_MSG", () => {
      useGitOpsStore.setState({ repoStatus: mergingRepoStatus() });
      renderCommitForm();

      expect(screen.getByPlaceholderText("Commit message...")).toHaveValue(
        "Merge branch 'conflict-a' into develop",
      );
    });

    it("does not overwrite a message the user cleared or typed", () => {
      useGitOpsStore.setState({ repoStatus: mergingRepoStatus() });
      renderCommitForm();
      const textarea = screen.getByPlaceholderText("Commit message...");

      fireEvent.change(textarea, { target: { value: "" } });
      expect(textarea).toHaveValue("");

      fireEvent.change(textarea, { target: { value: "my own message" } });
      expect(textarea).toHaveValue("my own message");
    });

    it("allows committing the merge even with nothing staged", () => {
      // Resolving every conflict by keeping "ours" leaves nothing staged, yet
      // the merge commit is still needed to record the second parent.
      useGitOpsStore.setState({ repoStatus: mergingRepoStatus() });
      renderCommitForm();

      expect(screen.getByRole("button", { name: "Commit" })).toBeEnabled();
      expect(
        screen.queryByText("No staged changes to commit"),
      ).not.toBeInTheDocument();
    });
  });

  describe("cherry-pick / revert in progress", () => {
    it("shows which commit is being cherry-picked and prefills MERGE_MSG", () => {
      useGitOpsStore.setState({
        repoStatus: sequencerRepoStatus("cherryPick"),
      });
      renderCommitForm();

      expect(screen.getByRole("status")).toHaveTextContent(
        "Cherry-picking 585521c — this commit will complete it",
      );
      expect(screen.getByPlaceholderText("Commit message...")).toHaveValue(
        "picked commit",
      );
    });

    it("shows which commit is being reverted and prefills MERGE_MSG", () => {
      useGitOpsStore.setState({ repoStatus: sequencerRepoStatus("revert") });
      renderCommitForm();

      expect(screen.getByRole("status")).toHaveTextContent(
        "Reverting 585521c — this commit will complete it",
      );
      expect(screen.getByPlaceholderText("Commit message...")).toHaveValue(
        'Revert "add a"\n\nThis reverts commit 585521ce.',
      );
    });

    it("falls back to CHERRY_PICK_HEAD when the oid is unknown", () => {
      useGitOpsStore.setState({
        repoStatus: sequencerRepoStatus("cherryPick", { sequencerHead: null }),
      });
      renderCommitForm();

      expect(screen.getByRole("status")).toHaveTextContent(
        "Cherry-picking CHERRY_PICK_HEAD",
      );
    });

    it("keeps Amend enabled and still requires staged changes", () => {
      // Unlike a merge, git allows amending during a cherry-pick and refuses
      // an empty pick, so neither merge-specific rule applies here.
      useGitOpsStore.setState({
        repoStatus: sequencerRepoStatus("cherryPick"),
      });
      renderCommitForm();

      expect(
        screen.getByRole("checkbox", { name: "Amend last commit" }),
      ).toBeEnabled();
      expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
    });
  });

  it("hides CC toggle when extension is inactive", () => {
    mockExtensionStatus.status = "inactive";
    renderCommitForm();

    expect(screen.queryByText("Conventional Commits")).not.toBeInTheDocument();
  });

  it("shows CC toggle when extension is active", () => {
    mockExtensionStatus.status = "active";
    renderCommitForm();

    expect(screen.getByText("Conventional Commits")).toBeInTheDocument();
  });

  it("shows simple commit form when extension is inactive", () => {
    mockExtensionStatus.status = "inactive";
    renderCommitForm();

    expect(
      screen.getByPlaceholderText("Commit message..."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commit" })).toBeInTheDocument();
  });

  it("disables Commit button with a message but no staged files when not amending", () => {
    mockExtensionStatus.status = "inactive";
    mockAmendState.amend = false;
    renderCommitForm();

    fireEvent.change(screen.getByPlaceholderText("Commit message..."), {
      target: { value: "reword" },
    });

    expect(screen.getByRole("button", { name: "Commit" })).toBeDisabled();
    expect(screen.getByText("No staged changes to commit")).toBeInTheDocument();
  });

  it("enables Amend Commit button with a message and no staged files when amending", () => {
    mockExtensionStatus.status = "inactive";
    mockAmendState.amend = true;
    renderCommitForm();

    fireEvent.change(screen.getByPlaceholderText("Commit message..."), {
      target: { value: "reworded message" },
    });

    expect(screen.getByRole("button", { name: /Amend Commit/i })).toBeEnabled();
    // The "no staged changes" hint should be suppressed during amend.
    expect(
      screen.queryByText("No staged changes to commit"),
    ).not.toBeInTheDocument();
  });

  it("shows Commit heading regardless of extension status", () => {
    mockExtensionStatus.status = "inactive";
    renderCommitForm();

    // "Commit" appears as both the section heading (span) and the button label.
    // Verify the heading span is always present.
    const commitElements = screen.getAllByText("Commit");
    const heading = commitElements.find((el) => el.tagName === "SPAN");
    expect(heading).toBeInTheDocument();
  });
});

describe("stripCommentLines", () => {
  it("drops comment lines and surrounding blank lines like a commit would", async () => {
    const { stripCommentLines } = await import("../CommitForm");
    expect(
      stripCommentLines("Merge branch 'x'\n\n#Conflicts:\n#\tREADME.md\n"),
    ).toBe("Merge branch 'x'");
    expect(stripCommentLines("keep # inline\n  # comment")).toBe(
      "keep # inline",
    );
  });
});
