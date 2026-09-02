import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { confirm, useConfirmStore } from "@/framework/stores/confirm";
import { ConfirmDialogHost } from "../ConfirmDialogHost";

function requestConfirm(options: Parameters<typeof confirm>[0]) {
  let promise: Promise<boolean> = Promise.resolve(false);
  act(() => {
    promise = confirm(options);
  });
  return promise;
}

describe("ConfirmDialogHost", () => {
  it("renders nothing while no confirmation is pending", () => {
    render(<ConfirmDialogHost />);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("shows title and description and focuses the primary button", () => {
    render(<ConfirmDialogHost />);
    requestConfirm({
      title: "Drop stash",
      description: "Drop this stash? This cannot be undone.",
      confirmLabel: "Drop",
    });

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAccessibleName("Drop stash");
    expect(dialog).toHaveAccessibleDescription(
      "Drop this stash? This cannot be undone.",
    );
    expect(screen.getByRole("button", { name: "Drop" })).toHaveFocus();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("resolves true when the confirm button is clicked", async () => {
    render(<ConfirmDialogHost />);
    const promise = requestConfirm({
      title: "Delete tag",
      confirmLabel: "Delete",
    });

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await expect(promise).resolves.toBe(true);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(useConfirmStore.getState().pending).toBeNull();
  });

  it("resolves false when the cancel button is clicked", async () => {
    render(<ConfirmDialogHost />);
    const promise = requestConfirm({
      title: "Delete tag",
      cancelLabel: "Keep",
    });

    fireEvent.click(screen.getByRole("button", { name: "Keep" }));

    await expect(promise).resolves.toBe(false);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("resolves false when Escape is pressed", async () => {
    render(<ConfirmDialogHost />);
    const promise = requestConfirm({ title: "Undo" });

    fireEvent.keyDown(document, { key: "Escape" });

    await expect(promise).resolves.toBe(false);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
  });

  it("resolves false when the backdrop is clicked", async () => {
    const { container } = render(<ConfirmDialogHost />);
    const promise = requestConfirm({ title: "Undo" });

    const backdrop = container.querySelector('[aria-hidden="true"].fixed');
    expect(backdrop).not.toBeNull();
    if (backdrop) fireEvent.click(backdrop);

    await expect(promise).resolves.toBe(false);
  });

  it("uses default labels when none are provided", () => {
    render(<ConfirmDialogHost />);
    requestConfirm({ title: "Continue?" });

    expect(screen.getByRole("button", { name: "Confirm" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
  });

  it("styles the confirm button as destructive for danger requests", () => {
    render(<ConfirmDialogHost />);
    requestConfirm({ title: "Drop stash", confirmLabel: "Drop", danger: true });

    expect(screen.getByRole("button", { name: "Drop" })).toHaveClass(
      "bg-ctp-red",
    );
  });

  it("does not style the confirm button as destructive by default", () => {
    render(<ConfirmDialogHost />);
    requestConfirm({ title: "Amend commit", confirmLabel: "Amend" });

    expect(screen.getByRole("button", { name: "Amend" })).not.toHaveClass(
      "bg-ctp-red",
    );
  });

  it("cancels a pending request when a newer one supersedes it", async () => {
    render(<ConfirmDialogHost />);
    const first = requestConfirm({ title: "First" });
    const second = requestConfirm({ title: "Second" });

    await expect(first).resolves.toBe(false);
    expect(screen.getByRole("alertdialog")).toHaveAccessibleName("Second");

    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await expect(second).resolves.toBe(true);
  });
});
