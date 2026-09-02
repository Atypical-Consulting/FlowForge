import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getCommandById } from "@/framework/command-palette/commandRegistry";
import { ExtensionAPI } from "@/framework/extension-system/ExtensionAPI";
import { useGitOpsStore } from "../../../stores/domain/git-ops";
import {
  act,
  createRepoStatus,
  fireEvent,
  render,
  screen,
} from "../../../test-utils";
import { MenuBar } from "../MenuBar";
import { menuDefinitions } from "../menu-definitions";

// Extension modules import the Tauri bindings; stub them so activation is side-effect free.
vi.mock("../../../../bindings", () => ({
  commands: {},
}));

import { onActivate as activateBranches } from "../../../../extensions/branches";
import { onActivate as activateRepository } from "../../../../extensions/repository";
import { onActivate as activateSync } from "../../../../extensions/sync";

/** Activate the built-in extensions that back the Repository/Branch/File menus. */
async function activateMenuExtensions(): Promise<ExtensionAPI[]> {
  const apis = [
    new ExtensionAPI("repository"),
    new ExtensionAPI("branches"),
    new ExtensionAPI("sync"),
  ];
  await activateRepository(apis[0]);
  await activateBranches(apis[1]);
  await activateSync(apis[2]);
  return apis;
}

function openRepository() {
  act(() => {
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({
        branchName: "develop",
        repoPath: "/home/user/ff-testrepo",
        repoName: "ff-testrepo",
      }),
    });
  });
}

function closeRepository() {
  act(() => {
    useGitOpsStore.setState({ repoStatus: null });
  });
}

function openMenu(label: string) {
  fireEvent.click(screen.getByRole("menuitem", { name: label }));
}

function getMenuItem(label: string): HTMLElement {
  // Item accessible names include the shortcut text, so anchor on the label prefix.
  return screen.getByRole("menuitem", {
    name: new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
  });
}

function expectEnabled(el: HTMLElement) {
  expect(el).not.toHaveAttribute("aria-disabled");
}

function expectDisabled(el: HTMLElement) {
  expect(el).toHaveAttribute("aria-disabled", "true");
}

describe("MenuBar enablement", () => {
  let apis: ExtensionAPI[] = [];

  beforeEach(async () => {
    apis = await activateMenuExtensions();
  });

  afterEach(() => {
    for (const api of apis) api.cleanup();
    apis = [];
  });

  it("every extension-backed menu entry resolves to a registered command", () => {
    const extensionCommandIds = menuDefinitions
      .flatMap((menu) => menu.items)
      .filter((item) => item.type === "action")
      .map((item) => item.commandId)
      .filter((id) => id.startsWith("ext:"))
      // init-repo is not activated in this test; it is covered by its own suite.
      .filter((id) => !id.startsWith("ext:init-repo:"));

    expect(extensionCommandIds.length).toBeGreaterThan(0);
    for (const id of extensionCommandIds) {
      expect(
        getCommandById(id),
        `command "${id}" is not registered`,
      ).toBeDefined();
    }
  });

  describe("with an open repository", () => {
    beforeEach(() => {
      openRepository();
    });

    it("enables Fetch, Pull, Push, Stage All, Toggle Amend and Refresh All", () => {
      render(<MenuBar />);
      openMenu("Repository");

      for (const label of [
        "Fetch",
        "Pull",
        "Push",
        "Stage All",
        "Toggle Amend",
        "Refresh All",
      ]) {
        expectEnabled(getMenuItem(label));
      }
    });

    it("enables Branch > New Branch...", () => {
      render(<MenuBar />);
      openMenu("Branch");

      expectEnabled(getMenuItem("New Branch..."));
    });

    it("enables View > Show Branches", () => {
      render(<MenuBar />);
      openMenu("View");

      expectEnabled(getMenuItem("Show Branches"));
    });

    it("enables File > Close Repository", () => {
      render(<MenuBar />);
      openMenu("File");

      expectEnabled(getMenuItem("Close Repository"));
    });
  });

  describe("without a repository", () => {
    it("disables File > Close Repository", () => {
      render(<MenuBar />);
      openMenu("File");

      expectDisabled(getMenuItem("Close Repository"));
    });

    it("keeps Open Repository... and Clone Repository... enabled", () => {
      render(<MenuBar />);
      openMenu("File");

      expectEnabled(getMenuItem("Open Repository..."));
      expectEnabled(getMenuItem("Clone Repository..."));
    });

    it("disables Refresh All", () => {
      render(<MenuBar />);
      openMenu("Repository");

      expectDisabled(getMenuItem("Refresh All"));
    });
  });

  it("re-evaluates enablement while a menu is open when the repository state changes", () => {
    render(<MenuBar />);
    openMenu("Repository");
    expectDisabled(getMenuItem("Refresh All"));

    openRepository();
    expectEnabled(getMenuItem("Refresh All"));

    closeRepository();
    expectDisabled(getMenuItem("Refresh All"));
  });

  it("re-evaluates enablement when a command is registered after the menu opened", () => {
    // Simulate an extension that activates after the user opened the menu.
    apis[2].cleanup();
    render(<MenuBar />);
    openRepository();
    openMenu("Repository");
    expectDisabled(getMenuItem("Fetch"));

    act(() => {
      apis[2] = new ExtensionAPI("sync");
      void activateSync(apis[2]);
    });
    expectEnabled(getMenuItem("Fetch"));
  });
});
