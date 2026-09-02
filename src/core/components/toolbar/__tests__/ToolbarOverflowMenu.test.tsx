import { act, fireEvent, render, screen } from "@testing-library/react";
import { GitBranch, Search } from "lucide-react";
import { registerCommand } from "@/framework/command-palette/commandRegistry";
import type { ToolbarAction } from "@/framework/extension-system/toolbarRegistry";
import { ToolbarOverflowMenu } from "../ToolbarOverflowMenu";

const createBranch: ToolbarAction = {
  id: "tb:create-branch",
  label: "Create Branch",
  icon: GitBranch,
  group: "git-actions",
  priority: 1,
  shortcut: "mod+shift+b",
  execute: () => {},
};

const commandPalette: ToolbarAction = {
  id: "tb:command-palette",
  label: "Command Palette",
  icon: Search,
  group: "app",
  priority: 1,
  commandId: "command-palette",
  // Stale local hint: must be ignored in favour of the command registry.
  shortcut: "mod+shift+p",
  execute: () => {},
};

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
}

describe("ToolbarOverflowMenu", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "platform", {
      value: "Linux x86_64",
      configurable: true,
    });
    registerCommand({
      id: "command-palette",
      title: "Command Palette",
      category: "Navigation",
      shortcut: "mod+k",
      action: () => {},
    });
  });

  it("sizes the menu to its content and keeps labels on one line", () => {
    render(<ToolbarOverflowMenu actions={[createBranch]} />);
    openMenu();

    expect(screen.getByRole("menu")).toHaveClass("w-max");
    expect(screen.getByText("Create Branch")).toHaveClass("whitespace-nowrap");
    expect(screen.getByText("Ctrl+Shift+B")).toHaveClass(
      "ml-8",
      "shrink-0",
      "whitespace-nowrap",
    );
  });

  it("renders a neutral trigger without a count badge", () => {
    render(<ToolbarOverflowMenu actions={[createBranch, commandPalette]} />);

    const trigger = screen.getByRole("button", { name: "More actions" });
    expect(trigger).toHaveTextContent("");
    expect(trigger).toHaveAttribute("data-toolbar-overflow-trigger");
    expect(trigger).toHaveAttribute("aria-haspopup", "true");
  });

  it("shows the shortcut registered on the linked command, not the action's own string", () => {
    render(<ToolbarOverflowMenu actions={[commandPalette]} />);
    openMenu();

    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
    expect(screen.queryByText("Ctrl+Shift+P")).not.toBeInTheDocument();
  });

  it("follows the registry when the linked command's shortcut changes", () => {
    render(<ToolbarOverflowMenu actions={[commandPalette]} />);
    openMenu();

    act(() => {
      registerCommand({
        id: "command-palette",
        title: "Command Palette",
        category: "Navigation",
        shortcut: "mod+p",
        action: () => {},
      });
    });

    expect(screen.getByText("Ctrl+P")).toBeInTheDocument();
    expect(screen.queryByText("Ctrl+K")).not.toBeInTheDocument();
  });
});
