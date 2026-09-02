import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfirmDialogHost } from "@/core/components/ui/ConfirmDialogHost";
import { createStashEntry, ok } from "@/core/test-utils/mocks/tauri-commands";

vi.mock("../../../../bindings", () => ({
  commands: {
    listStashes: vi.fn(),
    stashApply: vi.fn(),
    stashPop: vi.fn(),
    stashDrop: vi.fn(),
  },
}));

import { commands } from "../../../../bindings";
import { StashList } from "../StashList";

const DROP_MESSAGE = "Drop this stash? This cannot be undone.";

function renderStashList() {
  return render(
    <>
      <StashList showSaveDialog={false} onCloseSaveDialog={() => {}} />
      <ConfirmDialogHost />
    </>,
  );
}

describe("StashList drop confirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(commands.listStashes).mockResolvedValue(
      ok([createStashEntry({ index: 0, message: "On main: wip" })]),
    );
    vi.mocked(commands.stashDrop).mockResolvedValue(ok(null));
  });

  it("asks for confirmation before dropping and does nothing on cancel", async () => {
    renderStashList();

    fireEvent.click(await screen.findByTitle("Drop (discard)"));

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveAccessibleDescription(DROP_MESSAGE);
    expect(commands.stashDrop).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(commands.stashDrop).not.toHaveBeenCalled();
  });

  it("drops the stash when the user confirms", async () => {
    renderStashList();

    fireEvent.click(await screen.findByTitle("Drop (discard)"));
    await screen.findByRole("alertdialog");

    const dropButton = screen.getByRole("button", { name: "Drop" });
    expect(dropButton).toHaveClass("bg-ctp-red");
    fireEvent.click(dropButton);

    await waitFor(() => expect(commands.stashDrop).toHaveBeenCalledWith(0));
    expect(commands.stashDrop).toHaveBeenCalledTimes(1);
  });

  it("does not drop the stash when Escape is pressed", async () => {
    renderStashList();

    fireEvent.click(await screen.findByTitle("Drop (discard)"));
    await screen.findByRole("alertdialog");

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(commands.stashDrop).not.toHaveBeenCalled();
  });
});
