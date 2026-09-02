import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGitOpsStore } from "../../../../core/stores/domain/git-ops";
import { err, ok } from "../../../../core/test-utils/mocks/tauri-commands";
import { CreateBranchDialog } from "../CreateBranchDialog";

const mockCommands = vi.hoisted(() => ({
  createBranch: vi.fn(),
  listBranches: vi.fn(),
  listAllBranches: vi.fn(),
}));

vi.mock("../../../../bindings", () => ({ commands: mockCommands }));

describe("CreateBranchDialog", () => {
  const createBranch = vi.fn();

  beforeEach(() => {
    createBranch.mockReset();
    createBranch.mockResolvedValue({ name: "feature/x" });
    act(() => {
      useGitOpsStore.setState({
        createBranch,
        branchIsLoading: false,
        branchError: null,
        branchMutationError: null,
      });
    });
  });

  it("is an accessible modal that autofocuses the branch name field", () => {
    render(<CreateBranchDialog onClose={vi.fn()} />);
    expect(
      screen.getByRole("dialog", { name: "Create Branch" }),
    ).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Branch name")).toHaveFocus();
  });

  it("closes on Escape and on backdrop click", async () => {
    const onClose = vi.fn();
    render(<CreateBranchDialog onClose={onClose} />);
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("creates the branch on Enter and closes", async () => {
    const onClose = vi.fn();
    render(<CreateBranchDialog onClose={onClose} />);
    await userEvent.type(
      screen.getByLabelText("Branch name"),
      "feature/x{Enter}",
    );
    await waitFor(() =>
      expect(createBranch).toHaveBeenCalledWith("feature/x", true),
    );
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("keeps Tab focus inside the dialog", async () => {
    render(
      <div>
        <button type="button">Outside</button>
        <CreateBranchDialog onClose={vi.fn()} />
      </div>,
    );
    const dialog = screen.getByRole("dialog");
    for (let i = 0; i < 6; i++) {
      await userEvent.tab();
      expect(dialog).toContainElement(document.activeElement as HTMLElement);
    }
  });

  describe("error feedback", () => {
    // These tests go through the real store action so the whole path
    // (backend error -> message -> dialog) is exercised.
    beforeEach(() => {
      mockCommands.createBranch.mockReset();
      mockCommands.listBranches.mockReset().mockResolvedValue(ok([]));
      mockCommands.listAllBranches.mockReset().mockResolvedValue(ok([]));
      act(() => {
        useGitOpsStore.setState({
          createBranch: useGitOpsStore.getInitialState().createBranch,
        });
      });
    });

    it("shows a descriptive error when the branch already exists and keeps it while the branch list reloads", async () => {
      mockCommands.createBranch.mockResolvedValue(
        err({ type: "BranchAlreadyExists", message: "main" }),
      );
      const onClose = vi.fn();
      render(<CreateBranchDialog onClose={onClose} />);

      await userEvent.type(screen.getByLabelText("Branch name"), "main{Enter}");

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent("A branch named 'main' already exists");
      expect(onClose).not.toHaveBeenCalled();

      // The file watcher (or another panel) reloading the list must not wipe
      // the dialog's error.
      await act(async () => {
        await useGitOpsStore.getState().loadBranches();
        await useGitOpsStore.getState().loadAllBranches(true);
      });

      expect(screen.getByRole("alert")).toHaveTextContent(
        "A branch named 'main' already exists",
      );
      expect(screen.getByRole("button", { name: "Create" })).toBeEnabled();
      expect(screen.getByLabelText("Branch name")).toHaveValue("main");
    });

    it("surfaces a backend InvalidBranchName error as a sentence", async () => {
      mockCommands.createBranch.mockResolvedValue(
        err({ type: "InvalidBranchName", message: "feature/x" }),
      );
      render(<CreateBranchDialog onClose={vi.fn()} />);

      await userEvent.type(
        screen.getByLabelText("Branch name"),
        "feature/x{Enter}",
      );

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "'feature/x' is not a valid branch name",
      );
    });

    it("flags an obviously invalid name while typing and does not submit it", async () => {
      render(<CreateBranchDialog onClose={vi.fn()} />);
      const input = screen.getByLabelText("Branch name");

      await userEvent.type(input, "bad name..with spaces");

      expect(screen.getByRole("alert")).toHaveTextContent(
        "Branch name cannot contain spaces or control characters",
      );
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();

      await userEvent.keyboard("{Enter}");
      expect(mockCommands.createBranch).not.toHaveBeenCalled();
    });

    it("clears the backend error once the user edits the name", async () => {
      mockCommands.createBranch.mockResolvedValue(
        err({ type: "BranchAlreadyExists", message: "main" }),
      );
      render(<CreateBranchDialog onClose={vi.fn()} />);

      await userEvent.type(screen.getByLabelText("Branch name"), "main{Enter}");
      await screen.findByRole("alert");

      await userEvent.type(screen.getByLabelText("Branch name"), "2");

      expect(screen.queryByRole("alert")).toBeNull();
      expect(useGitOpsStore.getState().branchMutationError).toBeNull();
    });

    it("does not show a stale mutation error from an earlier operation, and clears it on close", async () => {
      act(() => {
        useGitOpsStore.setState({ branchMutationError: "older failure" });
      });
      const onClose = vi.fn();
      render(<CreateBranchDialog onClose={onClose} />);

      expect(screen.queryByRole("alert")).toBeNull();

      mockCommands.createBranch.mockResolvedValue(
        err({ type: "BranchAlreadyExists", message: "main" }),
      );
      await userEvent.type(screen.getByLabelText("Branch name"), "main{Enter}");
      await screen.findByRole("alert");

      await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(useGitOpsStore.getState().branchMutationError).toBeNull();
    });
  });
});
