import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateTagDialog } from "../CreateTagDialog";

const createTag = vi.fn();

vi.mock("../../../../bindings", () => ({
  commands: {
    createTag: (...args: unknown[]) => createTag(...args),
  },
}));

describe("CreateTagDialog", () => {
  beforeEach(() => {
    createTag.mockReset();
    createTag.mockResolvedValue({ status: "ok", data: null });
  });

  it("is an accessible modal that autofocuses the tag name field", () => {
    render(<CreateTagDialog onClose={vi.fn()} onCreated={vi.fn()} />);
    const dialog = screen.getByRole("dialog", { name: "Create Tag" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByLabelText("Tag name")).toHaveFocus();
  });

  it("closes on Escape after typing", async () => {
    const onClose = vi.fn();
    render(<CreateTagDialog onClose={onClose} onCreated={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Tag name"), "v2.0.0");
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
    expect(createTag).not.toHaveBeenCalled();
  });

  it("closes on backdrop click", async () => {
    const onClose = vi.fn();
    render(<CreateTagDialog onClose={onClose} onCreated={vi.fn()} />);
    await userEvent.click(screen.getByTestId("dialog-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("creates the tag when Enter is pressed in the name field", async () => {
    const onClose = vi.fn();
    const onCreated = vi.fn();
    render(<CreateTagDialog onClose={onClose} onCreated={onCreated} />);

    await userEvent.type(screen.getByLabelText("Tag name"), "v2.0.0{Enter}");

    await waitFor(() =>
      expect(createTag).toHaveBeenCalledWith("v2.0.0", null, null),
    );
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it("does not submit on Enter when the name is empty", async () => {
    render(<CreateTagDialog onClose={vi.fn()} onCreated={vi.fn()} />);
    await userEvent.keyboard("{Enter}");
    expect(createTag).not.toHaveBeenCalled();
  });
});
