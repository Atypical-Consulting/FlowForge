import { act, render, screen } from "@testing-library/react";
import { GitBranch, Search } from "lucide-react";
import {
  registerCommand,
  useCommandRegistry,
} from "@/framework/command-palette/commandRegistry";
import { MenuDropdown } from "../MenuDropdown";
import type { MenuEntryDef } from "../menu-definitions";

const items: MenuEntryDef[] = [
  {
    type: "action",
    id: "branch-new",
    label: "New Branch...",
    icon: GitBranch,
    commandId: "create-branch",
  },
  {
    type: "action",
    id: "view-command-palette",
    label: "Command Palette",
    icon: Search,
    commandId: "command-palette",
  },
];

function renderDropdown() {
  return render(
    <MenuDropdown
      items={items}
      highlightedIndex={-1}
      onItemClick={() => {}}
      onKeyDown={() => {}}
      onSetHighlightedIndex={() => {}}
    />,
  );
}

describe("MenuDropdown", () => {
  beforeEach(() => {
    Object.defineProperty(navigator, "platform", {
      value: "Linux x86_64",
      configurable: true,
    });
    registerCommand({
      id: "create-branch",
      title: "Create Branch",
      category: "Branches",
      shortcut: "mod+shift+n",
      action: () => {},
    });
    registerCommand({
      id: "command-palette",
      title: "Command Palette",
      category: "Navigation",
      shortcut: "mod+k",
      action: () => {},
    });
  });

  it("sizes the dropdown to its content so labels never wrap", () => {
    renderDropdown();

    expect(screen.getByRole("menu")).toHaveClass("w-max");
    expect(screen.getByText("New Branch...")).toHaveClass("whitespace-nowrap");
  });

  it("shows the shortcut registered on the command, not a menu-local string", () => {
    renderDropdown();

    expect(screen.getByText("Ctrl+Shift+N")).toBeInTheDocument();
    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();
  });

  it("shows no shortcut for commands registered without one", () => {
    act(() => {
      registerCommand({
        id: "command-palette",
        title: "Command Palette",
        category: "Navigation",
        action: () => {},
      });
    });
    renderDropdown();

    expect(screen.queryByText("Ctrl+K")).not.toBeInTheDocument();
    expect(screen.getByText("Ctrl+Shift+N")).toBeInTheDocument();
  });

  it("follows the registry when a command's shortcut changes while open", () => {
    renderDropdown();
    expect(screen.getByText("Ctrl+K")).toBeInTheDocument();

    act(() => {
      useCommandRegistry.getState().register({
        id: "command-palette",
        title: "Command Palette",
        category: "Navigation",
        shortcut: "mod+shift+p",
        action: () => {},
      });
    });

    expect(screen.queryByText("Ctrl+K")).not.toBeInTheDocument();
    expect(screen.getByText("Ctrl+Shift+P")).toBeInTheDocument();
  });
});
