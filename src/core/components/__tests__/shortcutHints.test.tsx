/**
 * Guards the single source of truth for shortcut hints: every surface that
 * shows a shortcut (menu bar, toolbar overflow menu, toolbar tooltips,
 * Toolbar settings) must display the shortcut registered on the command,
 * never a locally hard-coded string. The View menu once advertised Ctrl+K for
 * the command palette while the toolbar overflow menu said Ctrl+Shift+P.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  formatShortcut,
  getCommandById,
  useCommandRegistry,
} from "@/framework/command-palette";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import {
  resolveToolbarActionShortcut,
  useToolbarRegistry,
} from "@/framework/extension-system/toolbarRegistry";
import { fireEvent, render, screen } from "../../test-utils";
// Side-effect imports: register core commands and core toolbar actions.
import "../../commands";
import "../../commands/toolbar-actions";
import { MenuDropdown } from "../menu-bar/MenuDropdown";
import { menuDefinitions } from "../menu-bar/menu-definitions";
import { ToolbarOverflowMenu } from "../toolbar/ToolbarOverflowMenu";

// Extension modules import the Tauri bindings; stub them so activation is side-effect free.
vi.mock("../../../bindings", () => ({
  commands: {},
}));

import { onActivate as activateBranches } from "../../../extensions/branches";
import { onActivate as activateInitRepo } from "../../../extensions/init-repo";
import { onActivate as activateRepository } from "../../../extensions/repository";
import { onActivate as activateSync } from "../../../extensions/sync";

const viewMenu = menuDefinitions.find((m) => m.id === "view");
if (!viewMenu) throw new Error("View menu definition missing");

// Core commands and toolbar actions register at import time; the zustand test
// mock resets every store after each test, so snapshot them here and restore
// them before each test.
const coreCommands = new Map(useCommandRegistry.getState().items);
const coreToolbarActions = new Map(useToolbarRegistry.getState().items);

function getToolbarAction(id: string) {
  const action = useToolbarRegistry.getState().get(id);
  if (!action) throw new Error(`toolbar action "${id}" is not registered`);
  return action;
}

describe("shortcut hints come from the command registry", () => {
  let apis: ExtensionAPI[] = [];

  beforeEach(async () => {
    Object.defineProperty(navigator, "platform", {
      value: "Linux x86_64",
      configurable: true,
    });
    useCommandRegistry.setState({ items: new Map(coreCommands) });
    useToolbarRegistry.setState({ items: new Map(coreToolbarActions) });
    apis = [
      new ExtensionAPI("repository"),
      new ExtensionAPI("branches"),
      new ExtensionAPI("sync"),
      new ExtensionAPI("init-repo"),
    ];
    await activateRepository(apis[0]);
    await activateBranches(apis[1]);
    await activateSync(apis[2]);
    await activateInitRepo(apis[3]);
  });

  afterEach(() => {
    for (const api of apis) api.cleanup();
    apis = [];
  });

  it("registers a single primary shortcut for the command palette", () => {
    expect(getCommandById("command-palette")?.shortcut).toBe("mod+k");
  });

  it("View > Command Palette and the toolbar overflow menu show the same registry label", () => {
    const expected = formatShortcut(
      getCommandById("command-palette")?.shortcut ?? "",
    );
    expect(expected).toBe("Ctrl+K");

    const { unmount } = render(
      <MenuDropdown
        items={viewMenu.items}
        highlightedIndex={-1}
        onItemClick={() => {}}
        onKeyDown={() => {}}
        onSetHighlightedIndex={() => {}}
      />,
    );
    const menuItem = screen.getByRole("menuitem", { name: /^Command Palette/ });
    expect(menuItem).toHaveTextContent(expected);
    expect(menuItem).not.toHaveTextContent("Ctrl+Shift+P");
    unmount();

    render(
      <ToolbarOverflowMenu
        actions={[getToolbarAction("tb:command-palette")]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const overflowItem = screen.getByRole("menuitem", {
      name: /^Command Palette/,
    });
    expect(overflowItem).toHaveTextContent(expected);
    expect(overflowItem).not.toHaveTextContent("Ctrl+Shift+P");
  });

  it("every menu entry with a shortcut displays exactly the registered one", () => {
    for (const menu of menuDefinitions) {
      const { unmount } = render(
        <MenuDropdown
          items={menu.items}
          highlightedIndex={-1}
          onItemClick={() => {}}
          onKeyDown={() => {}}
          onSetHighlightedIndex={() => {}}
        />,
      );
      for (const item of menu.items) {
        if (item.type !== "action") continue;
        const command = getCommandById(item.commandId);
        expect(
          command,
          `command "${item.commandId}" is not registered`,
        ).toBeDefined();
        const menuItem = screen.getByRole("menuitem", {
          name: new RegExp(
            `^${item.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`,
          ),
        });
        const hint = menuItem.querySelector(".font-mono")?.textContent ?? "";
        expect(hint, `hint for "${item.label}"`).toBe(
          command?.shortcut ? formatShortcut(command.shortcut) : "",
        );
      }
      unmount();
    }
  });

  it("every toolbar action linked to a command resolves to a registered command and declares no local shortcut", () => {
    const linked = useToolbarRegistry
      .getState()
      .getAll()
      .filter((a) => a.commandId);
    expect(linked.length).toBeGreaterThan(0);

    for (const action of linked) {
      expect(
        getCommandById(action.commandId as string),
        `toolbar action "${action.id}" links to unknown command "${action.commandId}"`,
      ).toBeDefined();
      expect(
        action.shortcut,
        `toolbar action "${action.id}" duplicates its shortcut locally`,
      ).toBeUndefined();
    }
  });

  it("toolbar actions that mirror a menu command show the menu's shortcut", () => {
    const pairs: Array<[toolbarId: string, commandId: string]> = [
      ["tb:settings", "open-settings"],
      ["tb:command-palette", "command-palette"],
      ["ext:repository:open-repo", "ext:repository:open-repository"],
      ["ext:repository:clone-repo", "ext:repository:clone-repository"],
      ["ext:sync:fetch", "ext:sync:fetch"],
      ["ext:sync:pull", "ext:sync:pull"],
      ["ext:sync:push", "ext:sync:push"],
      ["ext:branches:create-branch", "ext:branches:create-branch"],
    ];
    for (const [toolbarId, commandId] of pairs) {
      const command = getCommandById(commandId);
      expect(
        command?.shortcut,
        `command "${commandId}" has no shortcut`,
      ).toBeTruthy();
      expect(
        resolveToolbarActionShortcut(getToolbarAction(toolbarId)),
        `toolbar action "${toolbarId}"`,
      ).toBe(command?.shortcut);
    }
  });
});
