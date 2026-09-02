import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../dialog";

interface FormDialogProps {
  onOpenChange?: (open: boolean) => void;
  onSubmit?: (name: string) => void;
  closeOnEscape?: boolean;
  closeOnBackdropClick?: boolean;
  withDescription?: boolean;
}

/** A realistic "Create X" dialog: title, one text field, checkbox, footer. */
function FormDialog({
  onOpenChange = () => {},
  onSubmit = () => {},
  closeOnEscape,
  closeOnBackdropClick,
  withDescription,
}: FormDialogProps) {
  const [name, setName] = useState("");
  return (
    <Dialog open={true} onOpenChange={onOpenChange}>
      <DialogContent
        closeOnEscape={closeOnEscape}
        closeOnBackdropClick={closeOnBackdropClick}
      >
        <DialogHeader>
          <DialogTitle>Create Thing</DialogTitle>
        </DialogHeader>
        {withDescription && (
          <DialogDescription>Some helpful description</DialogDescription>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onSubmit(name.trim());
          }}
        >
          <label htmlFor="thing-name">Thing name</label>
          <input
            id="thing-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <label>
            <input type="checkbox" /> Option
          </label>
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)}>
              Cancel
            </button>
            <button type="submit" disabled={!name.trim()}>
              Create
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Host with a trigger button that mounts/unmounts the dialog. */
function Host({ onSubmit }: { onSubmit?: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open
      </button>
      <button type="button">Outside</button>
      {open && <FormDialog onOpenChange={setOpen} onSubmit={onSubmit} />}
    </div>
  );
}

describe("Dialog", () => {
  describe("a11y attributes", () => {
    it("renders role=dialog, aria-modal and aria-labelledby pointing at the title", () => {
      render(<FormDialog />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAttribute("aria-modal", "true");
      const title = screen.getByRole("heading", { name: "Create Thing" });
      expect(title).toHaveAttribute("id");
      expect(dialog).toHaveAttribute("aria-labelledby", title.id);
      expect(dialog).toHaveAccessibleName("Create Thing");
      expect(dialog).not.toHaveAttribute("aria-describedby");
    });

    it("wires aria-describedby when a DialogDescription is present", () => {
      render(<FormDialog withDescription />);
      const dialog = screen.getByRole("dialog");
      expect(dialog).toHaveAccessibleDescription("Some helpful description");
    });
  });

  describe("closing", () => {
    it("closes when Escape is pressed", async () => {
      const onOpenChange = vi.fn();
      render(<FormDialog onOpenChange={onOpenChange} />);
      await userEvent.type(screen.getByLabelText("Thing name"), "v2.0.0");

      await userEvent.keyboard("{Escape}");

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("stops Escape from reaching document-level bubble listeners (global hotkeys)", async () => {
      const globalListener = vi.fn();
      document.addEventListener("keydown", globalListener);
      try {
        render(<FormDialog />);
        await userEvent.keyboard("{Escape}");
        expect(globalListener).not.toHaveBeenCalled();
      } finally {
        document.removeEventListener("keydown", globalListener);
      }
    });

    it("does not close on Escape when closeOnEscape is false", async () => {
      const onOpenChange = vi.fn();
      render(<FormDialog onOpenChange={onOpenChange} closeOnEscape={false} />);
      await userEvent.keyboard("{Escape}");
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("closes when the backdrop is clicked", async () => {
      const onOpenChange = vi.fn();
      render(<FormDialog onOpenChange={onOpenChange} />);

      await userEvent.click(screen.getByTestId("dialog-backdrop"));

      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("does not close when clicking inside the dialog content", async () => {
      const onOpenChange = vi.fn();
      render(<FormDialog onOpenChange={onOpenChange} />);

      await userEvent.click(screen.getByRole("dialog"));
      await userEvent.click(screen.getByLabelText("Thing name"));

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("does not close on backdrop click when closeOnBackdropClick is false", async () => {
      const onOpenChange = vi.fn();
      render(
        <FormDialog onOpenChange={onOpenChange} closeOnBackdropClick={false} />,
      );
      await userEvent.click(screen.getByTestId("dialog-backdrop"));
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it("closes from the header close button", async () => {
      const onOpenChange = vi.fn();
      render(<FormDialog onOpenChange={onOpenChange} />);
      await userEvent.click(screen.getByRole("button", { name: "Close" }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("focus management", () => {
    it("autofocuses the first form field (not the close button) on open", () => {
      render(<FormDialog />);
      expect(screen.getByLabelText("Thing name")).toHaveFocus();
    });

    it("prefers an element marked data-autofocus", () => {
      render(
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm</DialogTitle>
            </DialogHeader>
            <button type="button">Cancel</button>
            <button type="button" data-autofocus>
              Confirm
            </button>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByRole("button", { name: "Confirm" })).toHaveFocus();
    });

    it("falls back to the first non-close focusable when there is no field", () => {
      render(
        <Dialog open={true} onOpenChange={() => {}}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm</DialogTitle>
            </DialogHeader>
            <button type="button">Cancel</button>
            <button type="button">OK</button>
          </DialogContent>
        </Dialog>,
      );
      expect(screen.getByRole("button", { name: "Cancel" })).toHaveFocus();
    });

    it("traps Tab focus inside the dialog (wraps from last to first)", async () => {
      render(<FormDialog />);
      const nameInput = screen.getByLabelText("Thing name");
      const closeBtn = screen.getByRole("button", { name: "Close" });
      const createBtn = screen.getByRole("button", { name: "Create" });
      expect(nameInput).toHaveFocus();

      // Enable submit so it is focusable, then walk forward to the end.
      await userEvent.type(nameInput, "x");
      await userEvent.tab(); // checkbox
      await userEvent.tab(); // Cancel
      await userEvent.tab(); // Create
      expect(createBtn).toHaveFocus();

      await userEvent.tab(); // wraps to first focusable: header Close button
      expect(closeBtn).toHaveFocus();
    });

    it("traps Shift+Tab focus inside the dialog (wraps from first to last)", async () => {
      render(<FormDialog />);
      const nameInput = screen.getByLabelText("Thing name");
      await userEvent.type(nameInput, "x");
      const closeBtn = screen.getByRole("button", { name: "Close" });
      const createBtn = screen.getByRole("button", { name: "Create" });

      closeBtn.focus();
      await userEvent.tab({ shift: true });
      expect(createBtn).toHaveFocus();
    });

    it("pulls focus back inside if it escapes the dialog", () => {
      render(
        <div>
          <button type="button">Outside</button>
          <FormDialog />
        </div>,
      );
      const outside = screen.getByRole("button", { name: "Outside" });
      act(() => outside.focus());
      expect(outside).not.toHaveFocus();
      expect(screen.getByRole("dialog")).toContainElement(
        document.activeElement as HTMLElement,
      );
    });

    it("restores focus to the trigger element on close", async () => {
      render(<Host />);
      const trigger = screen.getByRole("button", { name: "Open" });
      await userEvent.click(trigger);
      expect(screen.getByLabelText("Thing name")).toHaveFocus();

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(trigger).toHaveFocus();
    });
  });

  describe("submission", () => {
    it("submits the primary action when Enter is pressed in the name field", async () => {
      const onSubmit = vi.fn();
      render(<FormDialog onSubmit={onSubmit} />);

      await userEvent.type(screen.getByLabelText("Thing name"), "v2.0.0");
      await userEvent.keyboard("{Enter}");

      expect(onSubmit).toHaveBeenCalledWith("v2.0.0");
    });

    it("does not submit on Enter while the form is invalid", async () => {
      const onSubmit = vi.fn();
      render(<FormDialog onSubmit={onSubmit} />);

      await userEvent.keyboard("{Enter}");

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe("stacking", () => {
    it("only the top-most dialog reacts to Escape", () => {
      const outerChange = vi.fn();
      const innerChange = vi.fn();
      render(
        <Dialog open={true} onOpenChange={outerChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Outer</DialogTitle>
            </DialogHeader>
            <Dialog open={true} onOpenChange={innerChange}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Inner</DialogTitle>
                </DialogHeader>
                <button type="button">Inner OK</button>
              </DialogContent>
            </Dialog>
          </DialogContent>
        </Dialog>,
      );

      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });

      expect(innerChange).toHaveBeenCalledWith(false);
      expect(outerChange).not.toHaveBeenCalled();
    });
  });
});
