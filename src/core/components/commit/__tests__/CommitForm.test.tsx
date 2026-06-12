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

import { CommitForm } from "../CommitForm";

describe("CommitForm graceful degradation", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    mockExtensionStatus.status = "inactive";
    mockAmendState.amend = false;
  });

  const renderCommitForm = () =>
    render(
      <QueryClientProvider client={queryClient}>
        <CommitForm />
      </QueryClientProvider>,
    );

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
