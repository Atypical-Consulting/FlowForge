import { useGitOpsStore } from "@/core/stores/domain/git-ops";
import { act, createRepoStatus, render, screen } from "@/core/test-utils";
import { registerCommand } from "../commandRegistry";
import { CommandPalette } from "../components/CommandPalette";
import { usePaletteStore } from "../paletteStore";

function registerCommands() {
  registerCommand({
    id: "extension-manager",
    title: "Extension Manager",
    category: "Navigation",
    action: () => {},
  });
  registerCommand({
    id: "ext:sync:push",
    title: "Push",
    category: "Sync",
    source: "ext:sync",
    action: () => {},
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });
  registerCommand({
    id: "ext:branches:create-branch",
    title: "Create Branch",
    category: "Branches",
    source: "ext:branches",
    action: () => {},
    enabled: () => !!useGitOpsStore.getState().repoStatus,
  });
}

const open = () => act(() => usePaletteStore.getState().openPalette());
const close = () => act(() => usePaletteStore.getState().closePalette());

function openRepository() {
  act(() => {
    useGitOpsStore.setState({
      repoStatus: createRepoStatus({ branchName: "develop" }),
    });
  });
}

const item = (id: string) => document.getElementById(`cmd-${id}`);
const group = (name: string) => screen.queryByRole("group", { name });

describe("CommandPalette enablement", () => {
  beforeEach(() => {
    // jsdom does not implement scrollIntoView (used to keep the selection visible)
    Element.prototype.scrollIntoView = vi.fn();
    registerCommands();
  });

  it("lists commands whose enabled() became true when reopened after the repository opens", () => {
    render(<CommandPalette />);

    open();
    expect(group("Navigation")).toBeInTheDocument();
    expect(item("extension-manager")).toBeInTheDocument();
    expect(group("Sync")).not.toBeInTheDocument();
    expect(item("ext:sync:push")).not.toBeInTheDocument();
    close();

    openRepository();

    open();
    expect(group("Navigation")).toBeInTheDocument();
    expect(group("Sync")).toBeInTheDocument();
    expect(group("Branches")).toBeInTheDocument();
    expect(item("ext:sync:push")).toBeInTheDocument();
    expect(item("ext:branches:create-branch")).toBeInTheDocument();
  });

  it("finds a repo-gated command by query once the repository is open", () => {
    render(<CommandPalette />);
    openRepository();
    open();

    act(() => usePaletteStore.getState().setPaletteQuery("push"));
    expect(item("ext:sync:push")).toBeInTheDocument();
    expect(screen.queryByText("No matching commands")).not.toBeInTheDocument();
  });

  it("updates the list while open when the repository state changes", () => {
    render(<CommandPalette />);
    open();
    expect(item("ext:sync:push")).not.toBeInTheDocument();

    openRepository();
    expect(item("ext:sync:push")).toBeInTheDocument();

    act(() => useGitOpsStore.setState({ repoStatus: null }));
    expect(item("ext:sync:push")).not.toBeInTheDocument();
  });
});
