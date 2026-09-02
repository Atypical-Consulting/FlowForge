import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "../../../test-utils";
import { MenuBar } from "../MenuBar";

const OPEN_STYLE = "bg-ctp-surface0";

function getTrigger(label: string): HTMLElement {
  return screen.getByRole("menuitem", { name: label });
}

async function expectMenuClosed() {
  // The dropdown leaves through an AnimatePresence exit transition.
  await waitFor(() =>
    expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
  );
}

describe("MenuBar open/close state", () => {
  it("shows the trigger as open while its dropdown is open", () => {
    render(<MenuBar />);
    fireEvent.click(getTrigger("File"));

    expect(getTrigger("File")).toHaveAttribute("aria-expanded", "true");
    expect(getTrigger("File")).toHaveClass(OPEN_STYLE);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("resets the trigger to its idle style when Escape closes the dropdown", async () => {
    render(<MenuBar />);
    fireEvent.click(getTrigger("File"));

    fireEvent.keyDown(screen.getByRole("menu"), { key: "Escape" });

    const trigger = getTrigger("File");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).not.toHaveClass(OPEN_STYLE);
    // Keyboard focus returns to the trigger (rendered as a focus ring, not
    // as the "open" fill).
    expect(trigger).toHaveFocus();
    expect(trigger.className).toContain("focus-visible:ring-1");
    await expectMenuClosed();
  });

  it("resets the trigger when Escape is pressed on the trigger itself", async () => {
    render(<MenuBar />);
    fireEvent.click(getTrigger("File"));

    fireEvent.keyDown(getTrigger("File"), { key: "Escape" });

    expect(getTrigger("File")).toHaveAttribute("aria-expanded", "false");
    expect(getTrigger("File")).not.toHaveClass(OPEN_STYLE);
    await expectMenuClosed();
  });

  it("does not swallow Escape when no menu is open", () => {
    render(<MenuBar />);
    const notPrevented = fireEvent.keyDown(getTrigger("File"), {
      key: "Escape",
    });

    // Not prevented: the global Escape hotkey (pop blade) may still run.
    expect(notPrevented).toBe(true);
  });

  it("resets the trigger on an outside click", async () => {
    render(<MenuBar />);
    fireEvent.click(getTrigger("File"));
    expect(getTrigger("File")).toHaveClass(OPEN_STYLE);

    fireEvent.mouseDown(document.body);

    expect(getTrigger("File")).toHaveAttribute("aria-expanded", "false");
    expect(getTrigger("File")).not.toHaveClass(OPEN_STYLE);
    await expectMenuClosed();
  });
});
