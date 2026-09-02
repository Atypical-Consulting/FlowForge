import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialogHost } from "@/core/components/ui/ConfirmDialogHost";
import { createTagInfo, ok } from "@/core/test-utils/mocks/tauri-commands";

vi.mock("../../../../bindings", () => ({
  commands: {
    listTags: vi.fn(),
    deleteTag: vi.fn(),
  },
}));

import { commands } from "../../../../bindings";
import { TagList } from "../TagList";

function renderTagList() {
  return render(
    <>
      <TagList showCreateDialog={false} onCloseCreateDialog={() => {}} />
      <ConfirmDialogHost />
    </>,
  );
}

describe("TagList delete confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(commands.listTags).mockResolvedValue(
      ok([createTagInfo({ name: "v1.0.0" })]),
    );
    vi.mocked(commands.deleteTag).mockResolvedValue(ok(null));
  });

  it("asks for confirmation before deleting and does nothing on cancel", async () => {
    renderTagList();

    fireEvent.click(await screen.findByTitle("Delete tag"));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleDescription('Delete tag "v1.0.0"?');
    expect(commands.deleteTag).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(commands.deleteTag).not.toHaveBeenCalled();
  });

  it("deletes the tag when the user confirms", async () => {
    renderTagList();

    fireEvent.click(await screen.findByTitle("Delete tag"));
    await screen.findByRole("alertdialog");

    const deleteButton = screen.getByRole("button", { name: "Delete" });
    expect(deleteButton).toHaveClass("bg-ctp-red");
    fireEvent.click(deleteButton);

    await waitFor(() =>
      expect(commands.deleteTag).toHaveBeenCalledWith("v1.0.0"),
    );
    expect(commands.deleteTag).toHaveBeenCalledTimes(1);
  });

  it("does not delete the tag when Escape is pressed", async () => {
    renderTagList();

    fireEvent.click(await screen.findByTitle("Delete tag"));
    await screen.findByRole("alertdialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(commands.deleteTag).not.toHaveBeenCalled();
  });
});
