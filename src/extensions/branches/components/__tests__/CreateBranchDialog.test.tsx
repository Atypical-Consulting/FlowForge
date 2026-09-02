import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useGitOpsStore } from "../../../../core/stores/domain/git-ops";
import { CreateBranchDialog } from "../CreateBranchDialog";

vi.mock("../../../../bindings", () => ({ commands: {} }));

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
});
