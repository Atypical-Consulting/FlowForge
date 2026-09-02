import { act, renderHook } from "@testing-library/react";
import { Search } from "lucide-react";
import { registerCommand } from "../../command-palette/commandRegistry";
import {
  resolveToolbarActionShortcut,
  type ToolbarAction,
  useToolbarActionShortcut,
} from "../toolbarRegistry";

const linked: ToolbarAction = {
  id: "tb:command-palette",
  label: "Command Palette",
  icon: Search,
  group: "app",
  priority: 1,
  commandId: "command-palette",
  shortcut: "mod+shift+p", // stale local hint
  execute: () => {},
};

const unlinked: ToolbarAction = {
  id: "ext:demo:widget",
  label: "Widget",
  icon: Search,
  group: "app",
  priority: 1,
  shortcut: "mod+shift+w",
  execute: () => {},
};

function registerPalette(shortcut?: string) {
  registerCommand({
    id: "command-palette",
    title: "Command Palette",
    category: "Navigation",
    shortcut,
    action: () => {},
  });
}

describe("resolveToolbarActionShortcut", () => {
  it("prefers the linked command's registered shortcut over a local string", () => {
    registerPalette("mod+k");
    expect(resolveToolbarActionShortcut(linked)).toBe("mod+k");
  });

  it("shows nothing (not the stale string) when the linked command has no shortcut", () => {
    registerPalette(undefined);
    expect(resolveToolbarActionShortcut(linked)).toBeUndefined();
  });

  it("shows nothing while the linked command is not registered", () => {
    expect(resolveToolbarActionShortcut(linked)).toBeUndefined();
  });

  it("falls back to the action's own shortcut when it has no command", () => {
    expect(resolveToolbarActionShortcut(unlinked)).toBe("mod+shift+w");
  });
});

describe("useToolbarActionShortcut", () => {
  it("re-renders when the linked command registers or changes its shortcut", () => {
    const { result } = renderHook(() => useToolbarActionShortcut(linked));
    expect(result.current).toBeUndefined();

    act(() => registerPalette("mod+k"));
    expect(result.current).toBe("mod+k");

    act(() => registerPalette("mod+p"));
    expect(result.current).toBe("mod+p");
  });

  it("returns the action's own shortcut when it has no command", () => {
    const { result } = renderHook(() => useToolbarActionShortcut(unlinked));
    expect(result.current).toBe("mod+shift+w");
  });
});
